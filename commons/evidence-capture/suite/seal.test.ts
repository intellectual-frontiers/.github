/**
 * Tests of the seal and the bundle (commons evidence-capture 0004-evidence-capture-seal FR-001 to FR-006) with real Git and real `ssh-keygen`: a journal sealed and its seal verified, an unsealed tail counted, a changed journal found, a bundle exported with and
 * without a key and verified offline, and each way a bundle can be wrong named. Every name is made up.
 *
 * @module
 */
import { defineCapturePolicy } from "@intellectual-frontiers/estate/governance";
import { gitRefStore, type GitRefStore } from "@intellectual-frontiers/grc/stores/gitref";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { collect, exportBundle, readJournal, sealJournal, sealStatus, verifyBundleDir, type TrustedSigner } from "../src/physical/mod.ts";

const skip = proc.which("git") === undefined || proc.which("ssh-keygen") === undefined ? { skip: "git or ssh-keygen is not installed" } : {};
const policy = (() => {
  const r = defineCapturePolicy();
  if (r.kind === "err") throw new Error("policy");
  return r.value;
})();

async function key(dir: string, name: string): Promise<{ file: string; signer: TrustedSigner }> {
  const file = path.join(dir, name);
  assert((await proc.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", name, "-f", file])).success);
  return { file, signer: { name, role: "daily", key: (await fs.readTextFile(`${file}.pub`)).trim() } };
}

async function withJournal<T>(f: (store: GitRefStore, dir: string, states: { text: string }) => Promise<T>): Promise<T> {
  return fs.withTempDir(async (dir) => {
    assert((await proc.run(["git", "init", "-q", "-b", "main"], { cwd: dir })).success);
    const store = gitRefStore({ repo: dir, branch: "evidence", identity: { name: "collector", email: "collector@localhost" } });
    const states = { text: '{"firewall":"off"}\n' };
    const run = async (now: string) => {
      const r = await collect({ store, policy, assets: [{ id: "sparta", state: "managed" }, { id: "athens", state: "managed" }], observe: async (a) => ({ kind: "ok", value: { stateText: a.id === "sparta" ? states.text : '{"x":1}\n' } }), now, runtime: path.join(dir, ".git", "opsfolio-evidence") });
      assert(r.kind === "ok", r.kind === "err" ? r.error : "");
    };
    await run("2026-12-01T10:00:00Z");
    await run("2026-12-01T10:15:00Z");
    states.text = '{"firewall":"on"}\n';
    await run("2026-12-01T10:30:00Z");
    return f(store, dir, states);
  });
}

proves(["0004-evidence-capture-seal FR-001", "0004-evidence-capture-seal FR-002"], "the journal is sealed with a person's key, the seal verifies, the entries after it are counted, and a changed journal or a seal by another key is found", async () => {
  await withJournal(async (store, dir) => {
    const k = await key(dir, "daily");
    const other = await key(dir, "other");
    const before = await readJournal(store);
    assert(before.kind === "ok");
    const n = before.value.length;
    const sealed = await sealJournal(store, { fleet: "test", key: { keyFile: k.file }, now: "2026-12-01T11:00:00Z" });
    assert(sealed.kind === "ok" && sealed.value.seq === n && sealed.value.commit !== undefined, JSON.stringify(sealed));
    const after = await readJournal(store);
    assert(after.kind === "ok" && after.value.length === n + 1 && after.value.at(-1)?.type === "seal" && after.value.at(-1)?.previous === before.value.at(-1)?.digest);
    const status = await sealStatus(store, [k.signer]);
    assert(status.kind === "ok");
    assertEquals([status.value.seals.map((s) => [s.seq, s.ok]), status.value.lastSealedSeq, status.value.unsealed], [[[n, true]], n, 0]);
    // entries after the seal are counted
    const more = await collect({ store, policy, assets: [{ id: "sparta", state: "managed" }], observe: async () => ({ kind: "ok", value: { stateText: '{"firewall":"off"}\n' } }), now: "2026-12-01T11:15:00Z", runtime: path.join(dir, ".git", "opsfolio-evidence") });
    assert(more.kind === "ok");
    await collect({ store, policy: { ...policy, journal: { ...policy.journal, commit: { every: "PT1M" } } }, assets: [{ id: "sparta", state: "managed" }], observe: async () => ({ kind: "ok", value: { stateText: '{"firewall":"off"}\n' } }), now: "2026-12-01T12:30:00Z", runtime: path.join(dir, ".git", "opsfolio-evidence") });
    const later = await sealStatus(store, [k.signer]);
    assert(later.kind === "ok" && later.value.unsealed >= 1, JSON.stringify(later));
    const wrong = await sealStatus(store, [other.signer]);
    assert(wrong.kind === "ok" && wrong.value.seals[0]?.ok === false && wrong.value.seals[0].detail.includes("another key") && wrong.value.lastSealedSeq === undefined);
    // a changed journal
    const file = "journal/2026/12/01.jsonl";
    const day = new TextDecoder().decode(await store.read(file)).split("\n");
    day[0] = (day[0] ?? "").replace("sparta", "athens");
    await store.commit([{ path: file, bytes: new TextEncoder().encode(day.join("\n")) }], "tamper");
    const broken = await sealStatus(store, [k.signer]);
    assert(broken.kind === "err" && broken.error.includes("does not hold"), JSON.stringify(broken));
    assertEquals((await sealJournal(store, { fleet: "test", key: { keyFile: k.file }, now: "2026-12-01T13:00:00Z" })).kind, "err", "a journal that does not hold is not sealed");
  });
}, skip);

proves(["0004-evidence-capture-seal FR-001"], "an empty journal is not sealed and a key that cannot sign is an error", async () => {
  await fs.withTempDir(async (dir) => {
    assert((await proc.run(["git", "init", "-q", "-b", "main"], { cwd: dir })).success);
    const store = gitRefStore({ repo: dir, branch: "evidence", identity: { name: "c", email: "c@localhost" } });
    const k = await key(dir, "daily");
    const empty = await sealJournal(store, { fleet: "test", key: { keyFile: k.file }, now: "2026-12-01T11:00:00Z" });
    assert(empty.kind === "err" && empty.error.includes("nothing to seal"));
  });
  await withJournal(async (store, dir) => {
    const bad = await sealJournal(store, { fleet: "test", key: { keyFile: path.join(dir, "missing") }, now: "2026-12-01T11:00:00Z" });
    assert(bad.kind === "err" && bad.error.includes("ssh-keygen did not sign"));
    assertEquals((await store.list("seals")).length, 0, "nothing was kept");
  });
}, skip);

proves(["0004-evidence-capture-seal FR-003", "0004-evidence-capture-seal FR-004", "0004-evidence-capture-seal FR-005"], "a bundle is exported up to an instant, signed with a key, and verified offline; each way it can be wrong is named", async () => {
  await withJournal(async (store, dir) => {
    const k = await key(dir, "daily");
    const stranger = await key(dir, "stranger");
    const out = path.join(dir, "..", `bundle-${crypto.randomUUID().slice(0, 8)}`);
    try {
      const made = await exportBundle(store, { fleet: "test", out, until: "2026-12-01T10:20:00Z", now: "2026-12-01T11:00:00Z", key: { keyFile: k.file }, signers: [k.signer] });
      assert(made.kind === "ok", made.kind === "err" ? made.error : "");
      assertEquals([made.value.entries, made.value.items, made.value.signed], [4, 2, true], "four entries up to 10:20, the two distinct states");
      for (const f of ["manifest.json", "ledger.json", "evidence.json", "signature.json", "signers.json"]) assert(await fs.exists(path.join(out, f)), f);
      const good = await verifyBundleDir(out, [k.signer], "2026-12-02T00:00:00Z");
      assert(good.kind === "ok" && good.value.ok && !good.value.trustedOwn, JSON.stringify(good));
      const own = await verifyBundleDir(out, undefined, "2026-12-02T00:00:00Z");
      assert(own.kind === "ok" && own.value.ok && own.value.trustedOwn, "the bundle's own signers, and it says so");
      const wrongKey = await verifyBundleDir(out, [stranger.signer], "2026-12-02T00:00:00Z");
      assert(wrongKey.kind === "ok" && !wrongKey.value.ok && wrongKey.value.report.findings.some((f) => f.kind === "signer-unallowed"), JSON.stringify(wrongKey));
      // an item changed
      let first: { name: string } | undefined;
      for await (const e of fs.readDir(path.join(out, "items"))) {
        first = first ?? e;
      }
      assert(first !== undefined);
      await fs.writeTextFile(path.join(out, "items", first.name), "changed\n");
      const changed = await verifyBundleDir(out, [k.signer], "2026-12-02T00:00:00Z");
      assert(changed.kind === "ok" && changed.value.report.findings.some((f) => f.kind === "item-hash-mismatch" && f.digest === first.name), JSON.stringify(changed));
      // a journal cut or changed
      const ledger = JSON.parse(await fs.readTextFile(path.join(out, "ledger.json"))) as unknown[];
      await fs.writeTextFile(path.join(out, "ledger.json"), JSON.stringify(ledger.slice(0, 2)));
      const cut = await verifyBundleDir(out, [k.signer], "2026-12-02T00:00:00Z");
      assert(cut.kind === "ok" && cut.value.report.findings.some((f) => f.kind === "chain-broken" || f.kind === "not-canonical"), JSON.stringify(cut));
      // a manifest changed after it was signed
      await fs.writeTextFile(path.join(out, "manifest.json"), (await fs.readTextFile(path.join(out, "manifest.json"))).replace("manifest:", "manifesx:"));
      const manifest = await verifyBundleDir(out, [k.signer], "2026-12-02T00:00:00Z");
      assert(manifest.kind === "ok" && manifest.value.report.findings.some((f) => f.kind === "signature-bad"), JSON.stringify(manifest));
      // refusals
      assertEquals((await exportBundle(store, { fleet: "test", out, until: "2026-12-01T10:20:00Z", now: "x", signers: [] })).kind, "err", "a folder that exists");
      assertEquals((await exportBundle(store, { fleet: "test", out: `${out}-2`, until: "yesterday", now: "x", signers: [] })).kind, "err");
      assertEquals((await exportBundle(store, { fleet: "test", out: `${out}-2`, until: "2020-01-01T00:00:00Z", now: "x", signers: [] })).kind, "err", "nothing up to that instant");
    } finally {
      await fs.remove(out, { recursive: true }).catch(() => undefined);
    }
    // unsigned
    const plain = path.join(dir, "..", `plain-${crypto.randomUUID().slice(0, 8)}`);
    try {
      const unsigned = await exportBundle(store, { fleet: "test", out: plain, until: "2026-12-02T00:00:00Z", now: "2026-12-02T00:00:00Z", signers: [k.signer] });
      assert(unsigned.kind === "ok" && !unsigned.value.signed);
      assertEquals(await fs.exists(path.join(plain, "signature.json")), false);
      const v = await verifyBundleDir(plain, [k.signer], "2026-12-02T00:00:00Z");
      assert(v.kind === "ok" && !v.value.ok && v.value.report.findings.some((f) => f.kind === "signature-absent"));
    } finally {
      await fs.remove(plain, { recursive: true }).catch(() => undefined);
    }
    assertEquals((await verifyBundleDir(path.join(dir, "nothing"), [k.signer], "2026-12-02T00:00:00Z")).kind, "err");
  });
}, skip);

proves(["0004-evidence-capture-seal FR-006"], "exporting and verifying a bundle use no network, write only the bundle's folder, and read a key only through ssh-keygen", async () => {
  const source = await fs.readTextFile(path.join(path.dirname(path.fromFileUrl(import.meta.url)), "..", "src", "physical", "bundle.ts"));
  for (const word of ["fetch(", "@intellectual-frontiers/net", "node:net", "node:http", "readTextFile(o.key", "readFile(o.key"]) assert(!source.includes(word), `bundle.ts has no ${word}`);
  assert(source.includes("sshsigSigner.sign"), "a key is used through the signer, which runs ssh-keygen");
  await withJournal(async (store, dir) => {
    const k = await key(dir, "daily");
    const names = async (): Promise<string[]> => {
      const out: string[] = [];
      for await (const e of fs.readDir(dir)) out.push(e.name);
      return out.sort();
    };
    const before = await names();
    const status = await proc.run(["git", "status", "--porcelain=v1"], { cwd: dir });
    const out = path.join(await fs.makeTempDir({ prefix: "bundle-" }), "b");
    try {
      const made = await exportBundle(store, { fleet: "test", out, until: "2026-12-02T00:00:00Z", now: "2026-12-02T00:00:00Z", key: { keyFile: k.file }, signers: [k.signer] });
      assert(made.kind === "ok");
      assert((await verifyBundleDir(out, [k.signer], "2026-12-02T00:00:00Z")).kind === "ok");
    } finally {
      await fs.remove(path.dirname(out), { recursive: true }).catch(() => undefined);
    }
    assertEquals(await names(), before, "nothing was written beside the repository");
    assertEquals((await proc.run(["git", "status", "--porcelain=v1"], { cwd: dir })).stdout, status.stdout, "and its working tree is as it was");
  });
}, skip);
