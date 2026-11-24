/**
 * The fleet as it is meant to run (commons anyfs-ssh 0005-anyfs-ssh-mirror FR-001 to FR-004): the store of a real ssh server is the primary of a mirror, a branch of a Git repository and a folder are its replicas,
 * and what a fleet needs of that is done there: a write goes to the host and is settled into one commit of the branch, a second settlement makes no commit, a replica changed by someone else is left as it is, the
 * host can be lost for a read and the Git replica answers it as degraded, the Git replica becomes the primary and the host a replica of it, and two writers who expect the same revision are one winner and one conflict.
 * The server is a real OpenSSH server made for the run, and where none can be made the test is skipped.
 *
 * @module
 */
import { err } from "@intellectual-frontiers/core";
import { expectAbsent, expectAny, expectRev, parsePath, type Path, unavailable } from "@intellectual-frontiers/anyfs/governance";
import { makeStore, type OpCapability } from "@intellectual-frontiers/anyfs/logical";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { openMirror, parseReplicaName, type Mirror, type MirrorEvent, type ReplicaName } from "@intellectual-frontiers/anyfs-bridge/mirror";
import { allowDeletes } from "@intellectual-frontiers/anyfs-bridge/governance";
import { gitRefStore, parseIdentity } from "@intellectual-frontiers/anyfs-git";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { openSshStore, type SshStore } from "../src/mod.ts";
import { executorOf, placeOf, type SshdHost, withSshd } from "../tools/sshd-test.ts";

const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const name = (text: string): ReplicaName => {
  const r = parseReplicaName(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);
const gitEnv = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
const gitOut = async (repo: string, ...args: string[]): Promise<string> => {
  const r = await proc.run(["git", "-C", repo, ...args], { env: gitEnv });
  if (!r.success) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout.trim();
};
const identity = (() => {
  const r = parseIdentity("Fleet Collector", "collector@example.test");
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
})();

type World = {
  readonly host: SshdHost;
  readonly repo: string;
  readonly folder: string;
  readonly ssh: SshStore;
  /** Makes the ssh store answer `unavailable` to what it is asked, as a host that cannot be reached does. */
  readonly outage: { down: boolean };
  readonly mirror: Mirror<OpCapability | "cas">;
  readonly events: MirrorEvent[];
};

/** Runs `use` with a mirror of a real ssh server, a branch of a bare repository and a folder. Skipped where no server can be had. */
async function inWorld<T>(auto: "manual" | "after-write", use: (w: World) => Promise<T>): Promise<{ readonly kind: "ran"; readonly value: T } | { readonly kind: "skipped"; readonly reason: string }> {
  if (proc.which("git") === undefined) return { kind: "skipped", reason: "this computer has no git" };
  return withSshd(async (host) => {
    const tmp = await fs.realPath(await fs.makeTempDir({ prefix: "anyfs-mirror-ssh-" }));
    try {
      const repo = path.join(tmp, "fleet.git");
      const folder = path.join(tmp, "copy");
      await fs.mkdir(folder);
      await gitOut(tmp, "init", "-q", "--bare", "-b", "main", repo);
      const opened = await openSshStore(executorOf(host), { place: placeOf(host), root: `${host.root}/fleet`, create: true });
      if (opened.kind === "err") throw new Error(opened.error);
      const outage = { down: false };
      const base = opened.value.store;
      const caps = [...base.capabilities].filter((c): c is OpCapability => c !== "watch" && c !== "lock");
      const primary = makeStore({
        id: base.id,
        place: base.place,
        consistency: base.consistency,
        traits: base.traits,
        capabilities: caps,
        handle: async (op) => (outage.down ? err(unavailable("the host cannot be reached", true)) : base.handle(op)),
      });
      const git = await gitRefStore({ repo, branch: "fleet", commit: { author: identity, clock: () => Date.UTC(2026, 0, 1) } });
      if (git.kind === "err") throw new Error(git.error);
      const copy = await localStore(folder);
      if (copy.kind === "err") throw new Error(copy.error);
      const events: MirrorEvent[] = [];
      const m = await openMirror({ name: name("ssh"), store: primary }, [{ name: name("git"), store: git.value.store }, { name: name("copy"), store: copy.value }], {
        deletes: allowDeletes(100),
        fallback: "unavailable",
        auto,
      });
      if (m.kind === "err") throw new Error(JSON.stringify(m.error));
      m.value.subscribe((e) => events.push(e));
      try {
        return await use({ host, repo, folder, ssh: opened.value.store, outage, mirror: m.value, events });
      } finally {
        await m.value.close();
      }
    } finally {
      await fs.remove(tmp, { recursive: true }).catch(() => undefined);
    }
  });
}

proves(["0005-anyfs-ssh-mirror FR-001"], "a fleet written to the ssh host is settled into one commit of the Git branch and the files of a folder, a second settlement makes no commit, and the ledgers are the host's and are hidden (skipped where no server can be had)", async (t) => {
  const t0 = Date.now();
  const ran = await inWorld("manual", async (w) => {
    const names = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    for (const n of names) assert((await w.mirror.store.write(p(`machines/${n}.json`), bytes(`{"machine":"${n}"}\n`), expectAbsent)).kind === "ok");
    const s1 = await w.mirror.settle();
    assert(s1.kind === "ok");
    assertEquals(s1.value.map((s) => [s.replica, s.state.kind, s.applied, s.failed]), [["git", "in-sync", 10, 0], ["copy", "in-sync", 10, 0]]);
    assertEquals(await gitOut(w.repo, "rev-list", "--count", "fleet"), "1", "ten changes of one settlement are one commit");
    assertEquals((await gitOut(w.repo, "ls-tree", "-r", "--name-only", "fleet")).split("\n").length, 10);
    assertEquals((await fs.readTextFile(path.join(w.folder, "machines/a.json"))).trim(), '{"machine":"a"}');
    const s2 = await w.mirror.settle();
    assert(s2.kind === "ok");
    assertEquals(s2.value.map((s) => s.applied), [0, 0]);
    assertEquals(await gitOut(w.repo, "rev-list", "--count", "fleet"), "1", "a second settlement makes no commit");
    await w.mirror.store.write(p("machines/k.json"), bytes("{}\n"), expectAny);
    await w.mirror.store.delete(p("machines/a.json"), expectAny);
    await w.mirror.settle();
    assertEquals(await gitOut(w.repo, "rev-list", "--count", "fleet"), "2");
    assert(!(await gitOut(w.repo, "ls-tree", "-r", "--name-only", "fleet")).includes("machines/a.json"));
    const listed = await w.mirror.store.list(p("machines") as never);
    assert(listed.kind === "ok" && listed.value.entries.length === 10);
    const all = await w.mirror.store.list("" as never);
    assert(all.kind === "ok" && all.value.entries.every((e) => !e.path.startsWith("_mirror-ledger")));
    assert((await gitOut(w.repo, "ls-tree", "-r", "--name-only", "fleet")).split("\n").every((n) => !n.startsWith("_mirror-ledger")), "a ledger is never copied to a replica");
    const raw = await w.ssh.list("" as never);
    assert(raw.kind === "ok" && raw.value.entries.some((e) => e.path.startsWith("_mirror-ledger/")), "the ledgers are on the host");
    return Date.now() - t0;
  });
  if (ran.kind === "skipped") {
    t.skip(ran.reason);
    return;
  }
  console.log(`mirror over a real sshd: scenario 1 took ${ran.value} ms`);
});

proves(["0005-anyfs-ssh-mirror FR-002"], "a replica that someone changed is diverged and left as it is, the Git replica answers a read as degraded when the host cannot be reached, and a host that comes back is read again (skipped where no server can be had)", async (t) => {
  const ran = await inWorld("manual", async (w) => {
    await w.mirror.store.write(p("a.json"), bytes("1"), expectAny);
    await w.mirror.store.write(p("b.json"), bytes("2"), expectAny);
    await w.mirror.settle();
    // someone commits to the branch directly
    const git = await gitRefStore({ repo: w.repo, branch: "fleet", commit: { author: identity } });
    if (git.kind === "err") throw new Error(git.error);
    assert((await git.value.store.write(p("a.json"), bytes("edited by a person"), expectAny)).kind === "ok");
    await w.mirror.store.write(p("a.json"), bytes("3"), expectAny);
    const s = await w.mirror.settle();
    assert(s.kind === "ok");
    const gitState = s.value.find((x) => x.replica === name("git"));
    assert(gitState?.state.kind === "diverged" && gitState.state.paths.includes(p("a.json")));
    assertEquals((await git.value.store.read(p("a.json")))?.kind === "ok" && new TextDecoder().decode((await git.value.store.read(p("a.json")) as { value: { bytes: Uint8Array } }).value.bytes), "edited by a person");
    assert(w.events.some((e) => e.kind === "diverged"));
    // the host is lost: the store says so, the mirror answers from the replica and says that it did
    w.outage.down = true;
    const store = await w.mirror.store.read(p("b.json"));
    assert(store.kind === "err" && store.error.kind === "unavailable");
    const degraded = await w.mirror.read(p("b.json"));
    assert(degraded.kind === "ok" && degraded.value.degraded);
    assertEquals(degraded.value.degraded && degraded.value.standing, "converged");
    assert(w.events.some((e) => e.kind === "degraded-read"));
    // a write to a lost host fails as the host's own, and nothing is queued for the replicas
    const lost = await w.mirror.store.write(p("c.json"), bytes("4"), expectAny);
    assert(lost.kind === "err" && lost.error.kind === "unavailable");
    w.outage.down = false;
    const back = await w.mirror.read(p("b.json"));
    assert(back.kind === "ok" && !back.value.degraded);
  });
  if (ran.kind === "skipped") t.skip(ran.reason);
});

proves(["0005-anyfs-ssh-mirror FR-003"], "the Git replica becomes the primary and the host a replica of it, and back, with the writes of each period at the other (skipped where no server can be had)", async (t) => {
  const ran = await inWorld("manual", async (w) => {
    await w.mirror.store.write(p("x.json"), bytes("1"), expectAny);
    await w.mirror.settle();
    const up = await w.mirror.promote(name("git"));
    assert(up.kind === "ok", JSON.stringify(up));
    assertEquals(w.mirror.roles().primary, name("git"));
    // the ledgers moved to the branch in one commit, and writes now go to the branch, one commit each, and reach the host by settlement
    assertEquals(await gitOut(w.repo, "rev-list", "--count", "fleet"), "2", "the promotion made one commit, of the ledgers");
    await w.mirror.store.write(p("y.json"), bytes("2"), expectAny);
    assertEquals(await gitOut(w.repo, "rev-list", "--count", "fleet"), "3");
    const hostBefore = await w.ssh.read(p("y.json"));
    assert(hostBefore.kind === "err", "the host does not have it before the settlement");
    const s = await w.mirror.settle();
    assert(s.kind === "ok");
    assertEquals(s.value.map((x) => x.replica).sort(), [name("copy"), name("ssh")]);
    assert(s.value.every((x) => x.state.kind === "in-sync"));
    const hostAfter = await w.ssh.read(p("y.json"));
    assert(hostAfter.kind === "ok" && new TextDecoder().decode(hostAfter.value.bytes) === "2");
    const down = await w.mirror.promote(name("ssh"));
    assert(down.kind === "ok", JSON.stringify(down));
    assertEquals(w.mirror.roles().primary, name("ssh"));
    assert(w.events.filter((e) => e.kind === "promoted").length === 2);
    await w.mirror.store.write(p("z.json"), bytes("3"), expectAny);
    const s2 = await w.mirror.settle();
    assert(s2.kind === "ok" && s2.value.every((x) => x.state.kind === "in-sync"));
    assertEquals((await gitOut(w.repo, "show", "fleet:z.json")), "3");
  });
  if (ran.kind === "skipped") t.skip(ran.reason);
});

proves(["0005-anyfs-ssh-mirror FR-004"], "two writers through the mirror who expect the same revision of the host are one winner and one conflict, and the replicas hold the winner (skipped where no server can be had)", async (t) => {
  const ran = await inWorld("after-write", async (w) => {
    const first = await w.mirror.store.write(p("race.json"), bytes("0"), expectAbsent);
    assert(first.kind === "ok");
    const [a, b] = await Promise.all([w.mirror.store.write(p("race.json"), bytes("A"), expectRev(first.value.rev)), w.mirror.store.write(p("race.json"), bytes("B"), expectRev(first.value.rev))]);
    assertEquals([a.kind, b.kind].sort(), ["err", "ok"]);
    const loser = a.kind === "err" ? a : b;
    assert(loser.kind === "err" && loser.error.kind === "conflict");
    await w.mirror.drain();
    await w.mirror.settle();
    const winner = a.kind === "ok" ? "A" : "B";
    assertEquals(await gitOut(w.repo, "show", "fleet:race.json"), winner);
    assertEquals((await fs.readTextFile(path.join(w.folder, "race.json"))).trim(), winner);
  });
  if (ran.kind === "skipped") t.skip(ran.reason);
});
