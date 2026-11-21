/**
 * Tests of reading back what was captured (commons evidence-capture 0005-evidence-capture-views) with real Git and real `ssh-keygen`: spans, the structured difference between two states (the last change, between instants, since a span), the changes of every asset newest first,
 * what was known at an instant (a later batch does not change what was known earlier), whether the journal holds, the timer that follows the policy's cadence, and sealing, exporting and verifying with the signer of a key. States are made-up JSON.
 *
 * @module
 */
import { defineCapturePolicy } from "@intellectual-frontiers/estate/governance";
import { gitRefStore, type GitRefStore } from "@intellectual-frontiers/grc/stores/gitref";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { durationText, parseSpan } from "../src/logical/mod.ts";
import { changesSince, collect, diffAsset, exportWith, knownAt, readSignersFile, sealsOf, sealWith, timerEvery, timerFor, verifyBundleAt, verifyJournalOf, type StateCodec } from "../src/physical/mod.ts";

type State = { readonly firewall: string };
type Diff = { readonly from: string; readonly to: string } | "same";
const codec: StateCodec<State, Diff> = {
  read: (t) => {
    try {
      return JSON.parse(t) as State;
    } catch {
      return undefined;
    }
  },
  diff: (a, b) => (a.firewall === b.firewall ? "same" : { from: a.firewall, to: b.firewall }),
};

const mk = (input = {}) => {
  const r = defineCapturePolicy(input);
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
};
const policy = mk();

async function withJournal<T>(f: (store: GitRefStore, dir: string) => Promise<T>): Promise<T> {
  return fs.withTempDir(async (dir) => {
    assert((await proc.run(["git", "init", "-q", "-b", "main"], { cwd: dir })).success);
    const store = gitRefStore({ repo: dir, branch: "evidence", identity: { name: "collector", email: "collector@localhost" } });
    let firewall = "off";
    const run = async (now: string) => {
      const r = await collect({ store, policy, assets: [{ id: "sparta", state: "managed" }], observe: async () => ({ kind: "ok", value: { stateText: `${JSON.stringify({ firewall })}\n` } }), now, runtime: path.join(dir, ".git", "capture-runtime") });
      assert(r.kind === "ok", r.kind === "err" ? r.error : "");
    };
    await run("2026-12-01T10:00:00Z");
    await run("2026-12-01T10:15:00Z");
    firewall = "on";
    await run("2026-12-01T10:30:00Z");
    firewall = "off";
    await run("2026-12-01T10:45:00Z");
    return f(store, dir);
  });
}

proves(["0005-evidence-capture-views FR-001"], "a span is 30m, 7d or ISO 8601, and is shown in the largest whole unit", () => {
  assertEquals([parseSpan("30m"), parseSpan("7d"), parseSpan("PT1H")], [{ kind: "ok", value: 1_800_000 }, { kind: "ok", value: 604_800_000 }, { kind: "ok", value: 3_600_000 }]);
  assertEquals(parseSpan("soon").kind, "err");
  assertEquals([durationText(0), durationText(3_600_000), durationText(5_400_000), durationText(86_400_000), durationText(1500)], ["0s", "1h", "90m", "1d", "1500ms"]);
});

proves(["0005-evidence-capture-views FR-002"], "the difference of an asset's state is the last change by default, between two instants or commits, or since a span, and nothing where there is nothing to compare", async () => {
  await withJournal(async (store) => {
    const last = await diffAsset(store, "evidence", codec, "sparta", { from: "", to: "", since: "", now: "2026-12-01T11:00:00Z" });
    assert(last.kind === "ok" && last.value !== undefined);
    assertEquals([last.value.diff, last.value.from.at, last.value.to.at], [{ from: "on", to: "off" }, "2026-12-01T10:30:00.000Z", "2026-12-01T10:45:00.000Z"]);
    const between = await diffAsset(store, "evidence", codec, "sparta", { from: "2026-12-01T10:00:00Z", to: "2026-12-01T10:30:00Z", since: "", now: "2026-12-01T11:00:00Z" });
    assert(between.kind === "ok" && between.value !== undefined);
    assertEquals(between.value.diff, { from: "off", to: "on" });
    const since = await diffAsset(store, "evidence", codec, "sparta", { from: "", to: "", since: "20m", now: "2026-12-01T10:50:00Z" });
    assert(since.kind === "ok" && since.value !== undefined);
    assertEquals(since.value.from.at, "2026-12-01T10:30:00.000Z");
    const unknown = await diffAsset(store, "evidence", codec, "nobody", { from: "", to: "", since: "", now: "2026-12-01T11:00:00Z" });
    assert(unknown.kind === "err" && unknown.error.includes("no state of nobody is kept on the branch evidence"));
    assertEquals((await diffAsset(store, "evidence", codec, "sparta", { from: "", to: "", since: "1x", now: "2026-12-01T11:00:00Z" })).kind, "err");
  });
});

proves(["0005-evidence-capture-views FR-003"], "the changes are listed newest first, each with its difference from the state before, and the first state is marked", async () => {
  await withJournal(async (store) => {
    const all = await changesSince(store, codec, { since: "", now: "2026-12-01T11:00:00Z" });
    assert(all.kind === "ok");
    assertEquals(all.value.map((c) => [c.at, c.first, c.diff]), [["2026-12-01T10:45:00.000Z", false, { from: "on", to: "off" }], ["2026-12-01T10:30:00.000Z", false, { from: "off", to: "on" }], ["2026-12-01T10:00:00.000Z", true, undefined]]);
    const recent = await changesSince(store, codec, { since: "20m", now: "2026-12-01T11:00:00Z" });
    assert(recent.kind === "ok");
    assertEquals(recent.value.length, 1);
  });
});

proves(["0005-evidence-capture-views FR-004"], "what was known at an instant is the state the branch held then and the last look the journal holds up to then, and a later batch does not change it", async () => {
  await withJournal(async (store) => {
    const k = await knownAt(store, codec, "2026-12-01T10:40:00Z");
    assert(k.kind === "ok" && k.value.commit !== undefined);
    const a = k.value.assets[0];
    assertEquals([a?.asset, a?.state, a?.lastLookAt, a?.ageMs], ["sparta", { firewall: "on" }, "2026-12-01T10:30:00Z", 600_000]);
    assertEquals((await knownAt(store, codec, "2026-01-01T00:00:00Z")), { kind: "ok", value: { commit: undefined, assets: [] } });
  });
});

proves(["0005-evidence-capture-views FR-005"], "the journal is verified and its head named, and a branch that does not exist says nothing was captured", async () => {
  await withJournal(async (store) => {
    const v = await verifyJournalOf(store, "evidence");
    assert(v.kind === "ok" && v.value.entries >= 4 && v.value.head !== undefined && v.value.branch === "evidence");
  });
  await fs.withTempDir(async (dir) => {
    await proc.run(["git", "init", "-q", "-b", "main"], { cwd: dir });
    const empty = await verifyJournalOf(gitRefStore({ repo: dir, branch: "evidence", identity: { name: "c", email: "c@localhost" } }), "evidence");
    assert(empty.kind === "err" && empty.error.includes("nothing was captured"));
  });
});

proves(["0005-evidence-capture-views FR-006"], "the timer fires in the largest whole step of the clock that is not longer than the shortest cadence, every hour for longer ones, and is planned for a scheduler", () => {
  const every = (managed: string, adopted = "P1D") => timerEvery(mk({ cadence: { managed, adopted } }));
  assertEquals([every("PT15M"), every("PT1M"), every("PT7M"), every("PT2H")], [{ kind: "minutes", every: 15 }, { kind: "minutes", every: 1 }, { kind: "minutes", every: 6 }, { kind: "hourly" }].map((x, i) => (i === 3 ? { kind: "hourly" } : x)));
  const t = timerFor(policy, { name: "evidence-lab", owner: { domain: "example.test", folder: "Lab" }, argv: ["/usr/bin/bun", "run.ts", "collect"], workdir: "/srv/lab", os: "linux", home: "/home/ada", uid: 1000 });
  assert(t.kind === "ok", t.kind === "err" ? t.error : "");
  assertEquals([t.value.firesEvery, t.value.windowMs], ["15 minutes", 1_800_000]);
});

proves(["0005-evidence-capture-views FR-007", "0005-evidence-capture-views FR-008"], "a key is sealed with only if it is a signer's (and the one the policy names), an export without a key is refused where a seal is asked for, and a bundle is verified offline with the signers of a file", async () => {
  await withJournal(async (store, dir) => {
    const gen = async (name: string) => {
      const file = path.join(dir, name);
      assert((await proc.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", name, "-f", file])).success);
      return { file, signer: { name, role: "daily", key: (await fs.readTextFile(`${file}.pub`)).trim() } };
    };
    const ada = await gen("ada");
    const other = await gen("other");
    const strict = mk({ sealing: { required: "on-export", key: "ada" } });
    const stranger = await sealWith(store, strict, [ada.signer], { fleet: "lab", keyFile: other.file, agent: false, now: "2026-12-01T11:00:00Z" });
    assert(stranger.kind === "err" && stranger.error.includes("is not the key of a signer of the fleet"));
    const wrongOne = await sealWith(store, strict, [ada.signer, other.signer], { fleet: "lab", keyFile: other.file, agent: false, now: "2026-12-01T11:00:00Z" });
    assert(wrongOne.kind === "err" && wrongOne.error.includes("asks for the seal of ada"));
    const sealed = await sealWith(store, strict, [ada.signer], { fleet: "lab", keyFile: ada.file, agent: false, now: "2026-12-01T11:00:00Z" });
    assert(sealed.kind === "ok" && sealed.value.signer === "ada");
    const seals = await sealsOf(store, strict, [ada.signer]);
    assert(seals.kind === "ok" && seals.value.status.lastSealedSeq === sealed.value.seq && seals.value.lastSealedAt === "2026-12-01T11:00:00Z" && seals.value.required === "on-export");
    const unsigned = await exportWith(store, strict, [ada.signer], { fleet: "lab", out: path.join(dir, "b0"), until: "", keyFile: "", agent: false, now: "2026-12-01T11:30:00Z" });
    assert(unsigned.kind === "err" && unsigned.error.includes("sealing.required is on-export"));
    const out = path.join(dir, "bundle");
    const exported = await exportWith(store, strict, [ada.signer], { fleet: "lab", out, until: "", keyFile: ada.file, agent: false, now: "2026-12-01T11:30:00Z" });
    assert(exported.kind === "ok", exported.kind === "err" ? exported.error : "");
    const signersFile = path.join(dir, "signers.json");
    await fs.writeTextFile(signersFile, JSON.stringify([ada.signer]));
    assertEquals((await readSignersFile(signersFile)).kind, "ok");
    await fs.writeTextFile(path.join(dir, "bad.json"), '{"signers":[{"name":1}]}');
    assertEquals((await readSignersFile(path.join(dir, "bad.json"))).kind, "err");
    const verified = await verifyBundleAt(out, signersFile, "2026-12-01T12:00:00Z");
    assert(verified.kind === "ok" && verified.value.ok, JSON.stringify(verified));
    const strangerSigners = path.join(dir, "other-signers.json");
    await fs.writeTextFile(strangerSigners, JSON.stringify([other.signer]));
    const bad = await verifyBundleAt(out, strangerSigners, "2026-12-01T12:00:00Z");
    assert(bad.kind === "err" || !bad.value.ok, "a bundle is not verified with signers that did not sign it");
  });
});
