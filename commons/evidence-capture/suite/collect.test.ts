/**
 * Tests of one run of the collector (commons evidence-capture 0003-evidence-capture-collect FR-001 to FR-007) over real Git in temporary repositories, with a driven clock and an observer that gives what the test says: the state kept only where it
 * changed, the journal and its batched commits, failures, the assets that are due, the lock, the pushes, and the journal read back. Every name is made up.
 *
 * @module
 */
import { defineCapturePolicy, type CapturePolicy, type CapturePolicyInput } from "@intellectual-frontiers/estate/governance";
import { gitRefStore, type GitRefStore } from "@intellectual-frontiers/grc/stores/gitref";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { acquireLock } from "@intellectual-frontiers/system/lock";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { CaptureFailure, Observed, Observer } from "../src/governance/mod.ts";
import { collect, readJournal, type Collected } from "../src/physical/mod.ts";

const skip = proc.which("git") === undefined ? { skip: "git is not installed" } : {};
const text = (b: Uint8Array | undefined): string | undefined => (b === undefined ? undefined : new TextDecoder().decode(b));

async function git(dir: string, ...args: string[]): Promise<string> {
  const r = await proc.run(["git", "-c", "user.name=person", "-c", "user.email=person@example.test", ...args], { cwd: dir });
  if (!r.success) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

const policyOf = (input: CapturePolicyInput = {}): CapturePolicy => {
  const r = defineCapturePolicy(input);
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
};

type Rig = {
  readonly dir: string;
  readonly store: GitRefStore;
  readonly states: Record<string, string | CaptureFailure | "hang">;
  run(now: string, policy?: CapturePolicy, more?: { assets?: readonly Observed[]; only?: readonly string[]; limits?: { concurrency: number; perHostTimeoutMs: number } }): Promise<Collected>;
};

async function withRig<T>(f: (r: Rig) => Promise<T>): Promise<T> {
  return fs.withTempDir(async (dir) => {
    await git(dir, "init", "-q", "-b", "main");
    const store = gitRefStore({ repo: dir, branch: "evidence", identity: { name: "collector", email: "collector@localhost" } });
    const states: Rig["states"] = { "synthetic-server-03": '{"firewall":"off"}\n' };
    const observe: Observer = async (asset) => {
      const s = states[asset.id];
      if (s === "hang") await new Promise((r) => setTimeout(r, 2000));
      if (s === undefined || s === "hang") return { kind: "err", error: { kind: "unreachable", message: "no such machine" } };
      return typeof s === "string" ? { kind: "ok", value: { stateText: s } } : { kind: "err", error: s };
    };
    const rig: Rig = {
      dir,
      store,
      states,
      async run(now, policy = policyOf(), more = {}) {
        const r = await collect({ store, policy, assets: more.assets ?? [{ id: "synthetic-server-03", state: "managed" }], observe, now, runtime: path.join(dir, ".git", "opsfolio-evidence"), ...(more.only === undefined ? {} : { only: more.only }), ...(more.limits === undefined ? {} : { limits: more.limits }) });
        assert(r.kind === "ok", r.kind === "err" ? r.error : "");
        return r.value;
      },
    };
    return f(rig);
  });
}

const count = (dir: string) => git(dir, "rev-list", "--count", "evidence").then(Number);

proves(["0003-evidence-capture-collect FR-001", "0003-evidence-capture-collect FR-002"], "a state is kept only where it changed, every look is journaled, commits come when a state changed or the batch interval has run, and the commit is made at the instant and names what changed", async () => {
  await withRig(async (r) => {
    const first = await r.run("2026-12-01T10:00:00Z");
    assertEquals([first.assets[0]?.outcome, first.assets[0]?.journaled, first.commit !== undefined, first.pending], ["changed", true, true, 0]);
    assertEquals(text(await r.store.read("state/synthetic-server-03.json")), '{"firewall":"off"}\n');
    assertEquals(await git(r.dir, "log", "-1", "--format=%cI|%s", "evidence"), "2026-12-01T10:00:00+00:00|captured 2026-12-01T10:00:00Z: changed synthetic-server-03; 1 entries");
    for (const [i, now] of ["2026-12-01T10:15:00Z", "2026-12-01T10:30:00Z", "2026-12-01T10:45:00Z"].entries()) {
      const run = await r.run(now);
      assertEquals([run.assets[0]?.outcome, run.assets[0]?.journaled, run.commit, run.pending], ["unchanged", true, undefined, i + 1], "no state commit, the entry waits");
    }
    assertEquals(await count(r.dir), 1, "nothing was committed while nothing changed and the batch was not due");
    const pendingFile = await fs.readTextFile(path.join(r.dir, ".git", "opsfolio-evidence", "pending.jsonl"));
    assertEquals(pendingFile.split("\n").filter((l) => l !== "").length, 3, "the waiting entries are in a file of the run's own");
    const batch = await r.run("2026-12-01T11:00:00Z");
    assert(batch.commit !== undefined && batch.pending === 0, "the batch interval of an hour has run");
    assertEquals(await count(r.dir), 2);
    assertEquals((await r.store.history("state/synthetic-server-03.json")).length, 1, "the state was committed once");
    r.states["synthetic-server-03"] = '{"firewall":"on"}\n';
    const changed = await r.run("2026-12-01T11:15:00Z");
    assertEquals([changed.assets[0]?.outcome, changed.commit !== undefined], ["changed", true]);
    assertEquals((await r.store.history("state/synthetic-server-03.json")).map((h) => h.at), ["2026-12-01T11:15:00.000Z", "2026-12-01T10:00:00.000Z"]);
    assertEquals(text(await r.store.read("state/synthetic-server-03.json")), '{"firewall":"on"}\n');
    const journal = await readJournal(r.store);
    assert(journal.kind === "ok");
    assertEquals(journal.value.map((e) => e.type), ["capture.changed", "capture.unchanged", "capture.unchanged", "capture.unchanged", "capture.unchanged", "capture.changed"]);
    assertEquals(journal.value.map((e) => e.createdAt).filter((_, i) => i < 2), ["2026-12-01T10:00:00Z", "2026-12-01T10:15:00Z"]);
    assert(journal.value.every((e) => e.subject === "synthetic-server-03"));
    assertEquals(await git(r.dir, "status", "--porcelain=v1"), "", "the working tree is untouched");
  });
}, skip);

proves(["0003-evidence-capture-collect FR-002"], "with a journal of changes and a heartbeat, only a change and the heartbeat are entries", async () => {
  await withRig(async (r) => {
    const p = policyOf({ journal: { granularity: "changes-and-heartbeat", heartbeat: "PT30M" } });
    const outcomes: boolean[] = [];
    for (const now of ["2026-12-01T10:00:00Z", "2026-12-01T10:15:00Z", "2026-12-01T10:30:00Z", "2026-12-01T10:45:00Z", "2026-12-01T11:00:00Z"]) outcomes.push((await r.run(now, p)).assets[0]?.journaled ?? false);
    assertEquals(outcomes, [true, false, true, false, true]);
  });
}, skip);

proves(["0003-evidence-capture-collect FR-003"], "a look that fails is journaled as its kind and leaves the state kept as it was", async () => {
  await withRig(async (r) => {
    await r.run("2026-12-01T10:00:00Z");
    const kept = text(await r.store.read("state/synthetic-server-03.json"));
    r.states["synthetic-server-03"] = { kind: "unreachable", message: "connection refused" };
    const a = await r.run("2026-12-01T10:15:00Z");
    assertEquals([a.assets[0]?.outcome, a.assets[0]?.journaled], ["unreachable", true]);
    r.states["synthetic-server-03"] = { kind: "refused", message: "only SELECT" };
    assertEquals((await r.run("2026-12-01T10:30:00Z")).assets[0]?.outcome, "refused");
    r.states["synthetic-server-03"] = { kind: "unreadable", message: "not facts" };
    assertEquals((await r.run("2026-12-01T10:45:00Z")).assets[0]?.outcome, "unreadable");
    r.states["synthetic-server-03"] = "hang";
    const slow = await r.run("2026-12-01T11:00:00Z", policyOf(), { limits: { concurrency: 1, perHostTimeoutMs: 100 } });
    assertEquals(slow.assets[0]?.outcome, "unreachable", "a look that takes too long");
    assertEquals(text(await r.store.read("state/synthetic-server-03.json")), kept, "the state is as it was");
    const journal = await readJournal(r.store);
    assert(journal.kind === "ok");
    assertEquals(journal.value.map((e) => e.type), ["capture.changed", "capture.unreachable", "capture.refused", "capture.unreadable", "capture.unreachable"]);
  });
}, skip);

proves(["0003-evidence-capture-collect FR-004"], "only the assets that are due are looked at, those told are looked at whether due or not, and the number at once is limited", async () => {
  await withRig(async (r) => {
    r.states["synthetic-server-02"] = '{"x":1}\n';
    const assets: Observed[] = [{ id: "synthetic-server-03", state: "managed" }, { id: "synthetic-server-02", state: "adopted" }];
    const first = await r.run("2026-12-01T10:00:00Z", policyOf(), { assets });
    assertEquals(first.assets.map((a) => [a.id, a.outcome]), [["synthetic-server-02", "changed"], ["synthetic-server-03", "changed"]]);
    const later = await r.run("2026-12-01T10:15:00Z", policyOf(), { assets });
    assertEquals(later.assets.map((a) => [a.id, a.outcome]), [["synthetic-server-02", "not-due"], ["synthetic-server-03", "unchanged"]], "an adopted asset is looked at once a day");
    const told = await r.run("2026-12-01T10:16:00Z", policyOf(), { assets, only: ["synthetic-server-02"] });
    assertEquals(told.assets.map((a) => [a.id, a.outcome]), [["synthetic-server-02", "unchanged"], ["synthetic-server-03", "not-due"]]);
    const none = await r.run("2026-12-01T10:17:00Z", policyOf(), { assets });
    assertEquals(none.assets.map((a) => a.outcome), ["not-due", "not-due"]);
    assertEquals(none.commit, undefined);
    let running = 0;
    let most = 0;
    const many: Observed[] = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, state: "managed" as const }));
    const observe: Observer = async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((x) => setTimeout(x, 20));
      running -= 1;
      return { kind: "ok", value: { stateText: "{}\n" } };
    };
    const done = await collect({ store: r.store, policy: policyOf(), assets: many, observe, now: "2026-12-02T10:00:00Z", runtime: path.join(r.dir, ".git", "opsfolio-evidence"), limits: { concurrency: 2, perHostTimeoutMs: 1000 } });
    assert(done.kind === "ok");
    assertEquals(most, 2);
  });
}, skip);

proves(["0003-evidence-capture-collect FR-005"], "a run does not wait for the lock: it ends with an error that says so and changes nothing", async () => {
  await withRig(async (r) => {
    const runtime = path.join(r.dir, ".git", "opsfolio-evidence");
    await fs.mkdir(runtime, { recursive: true });
    const held = await acquireLock(path.join(runtime, "lock"), { wait: false, command: "another run" });
    assert(held !== undefined);
    try {
      const blocked = await collect({ store: r.store, policy: policyOf(), assets: [{ id: "synthetic-server-03", state: "managed" }], observe: async () => ({ kind: "ok", value: { stateText: "{}\n" } }), now: "2026-12-01T10:00:00Z", runtime });
      assertEquals(blocked, { kind: "err", error: "another collection is running" });
      assertEquals(await r.store.head(), undefined);
    } finally {
      held.release();
    }
    assertEquals((await r.run("2026-12-01T10:01:00Z")).assets[0]?.outcome, "changed", "and once it is free a run goes on");
  });
}, skip);

proves(["0003-evidence-capture-collect FR-006"], "the branch alone is pushed as the policy says, a push that fails is an entry and leaves the remote as it was, and a later run tries again", async () => {
  await withRig(async (r) => {
    const remote = path.join(r.dir, "..", `remote-${crypto.randomUUID().slice(0, 8)}.git`);
    await git(r.dir, "init", "-q", "--bare", remote);
    await git(r.dir, "remote", "add", "origin", remote);
    await fs.writeTextFile(path.join(r.dir, "w.txt"), "work\n");
    await git(r.dir, "add", "w.txt");
    await git(r.dir, "commit", "-q", "-m", "a person's work");
    try {
      const never = await r.run("2026-12-01T10:00:00Z");
      assertEquals(never.pushed, "not-asked");
      assertEquals(await git(remote, "branch", "--list"), "");
      r.states["synthetic-server-03"] = '{"firewall":"on"}\n';
      const after = policyOf({ push: { mode: "after-commit" } });
      const pushed = await r.run("2026-12-01T10:15:00Z", after);
      assertEquals(pushed.pushed, "pushed");
      assertEquals((await git(remote, "branch", "--list")).trim(), "evidence", "only the evidence branch");
      assertEquals(await git(remote, "rev-parse", "evidence"), await git(r.dir, "rev-parse", "evidence"));
      assertEquals((await r.run("2026-12-01T10:30:00Z", after)).pushed, "not-due", "nothing was committed, so nothing is pushed");
      // another clone moves the remote: the next push is refused, not forced
      const other = path.join(r.dir, "..", `other-${crypto.randomUUID().slice(0, 8)}`);
      await git(r.dir, "clone", "-q", remote, other);
      await git(other, "checkout", "-q", "evidence");
      await fs.writeTextFile(path.join(other, "intruder.txt"), "x\n");
      await git(other, "add", "intruder.txt");
      await git(other, "commit", "-q", "-m", "intruder");
      await git(other, "push", "-q", "origin", "evidence");
      const theirs = await git(remote, "rev-parse", "evidence");
      r.states["synthetic-server-03"] = '{"firewall":"off"}\n';
      const failed = await r.run("2026-12-01T10:45:00Z", after);
      assertEquals([failed.pushed, failed.pending], ["failed", 1], "the failure waits as an entry");
      assertEquals(await git(remote, "rev-parse", "evidence"), theirs, "the remote is as it was");
      const again = await r.run("2026-12-01T11:00:00Z", after);
      assertEquals(again.pushed, "not-due");
      const journal = await readJournal(r.store);
      assert(journal.kind === "ok");
      assertEquals(journal.value.filter((e) => e.type === "push.failed").length, 0, "the entry is committed with the next commit");
      // every: interval
      const every = policyOf({ push: { mode: "every", every: "PT1H" } });
      assertEquals((await r.run("2026-12-01T11:15:00Z", every)).pushed, "failed", "the interval has run and the remote has moved");
      await fs.remove(other, { recursive: true });
    } finally {
      await fs.remove(remote, { recursive: true }).catch(() => undefined);
    }
  });
}, skip);

proves(["0003-evidence-capture-collect FR-007"], "the journal is read back in order and verified naming the first entry that does not follow, and entries waiting for a commit survive the end of a run", async () => {
  await withRig(async (r) => {
    await r.run("2026-12-01T10:00:00Z");
    await r.run("2026-12-01T10:15:00Z");
    const waiting = await fs.readTextFile(path.join(r.dir, ".git", "opsfolio-evidence", "pending.jsonl"));
    assertEquals(waiting.split("\n").filter((l) => l !== "").length, 1);
    const later = await r.run("2026-12-01T11:00:00Z");
    assert(later.commit !== undefined, "a later run commits what waited");
    const journal = await readJournal(r.store);
    assert(journal.kind === "ok" && journal.value.length === 3);
    assertEquals(journal.value.map((e) => e.seq), [1, 2, 3]);
    // tamper: change the second entry's subject on the branch
    const file = "journal/2026/12/01.jsonl";
    const day = text(await r.store.read(file)) ?? "";
    const tampered = day.replace('"subject":"synthetic-server-03"', '"subject":"synthetic-server-02"').replace('"subject":"synthetic-server-02"', '"subject":"synthetic-server-02"');
    const lines = day.split("\n");
    lines[1] = (lines[1] ?? "").replace("synthetic-server-03", "elsewhere");
    await r.store.commit([{ path: file, bytes: new TextEncoder().encode(lines.join("\n")) }], "tamper");
    void tampered;
    const broken = await readJournal(r.store);
    assert(broken.kind === "err" && broken.error.includes("entry 2 was changed"), JSON.stringify(broken));
  });
}, skip);
