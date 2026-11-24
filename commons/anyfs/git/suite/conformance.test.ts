/**
 * Tests of the conformance of the Git stores (commons anyfs-git 0006-git-conformance FR-001, FR-002): both stores pass the cases of the conformance suite of AnyFS that their capabilities name, in a repository
 * that is bare and in one that is not, every law of the bridge holds between them and the stores of memory and of a folder, and a sync into a branch is one commit.
 *
 * @module
 */
import { casesFor, runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { expectAny, ROOT } from "@intellectual-frontiers/anyfs/governance";
import type { CoreCapability } from "@intellectual-frontiers/anyfs/governance";
import type { Store } from "@intellectual-frontiers/anyfs/logical";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { forbidDeletes } from "@intellectual-frontiers/anyfs-bridge/governance";
import { apply, type Dest, prepare } from "@intellectual-frontiers/anyfs-bridge/logical";
import { type MakePair, runBridgeConformance } from "@intellectual-frontiers/anyfs-bridge/conformance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { gitWorktreeStore } from "../src/mod.ts";
import { bytes, commitsOf, fs as tfs, git, p, refIn, who } from "./kit.ts";

const failures = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

/** Repositories made for the laws, and removed when the test ends. */
class Folders {
  readonly #dirs: string[] = [];
  async make(kind: "bare" | "worktree"): Promise<string> {
    const dir = await tfs.makeTempDir({ prefix: "anyfs-git-law-" });
    this.#dirs.push(dir);
    if (kind === "bare") {
      await git(dir, "init", "-q", "--bare", "-b", "main");
    } else {
      await git(dir, "init", "-q", "-b", "main");
      await git(dir, "commit", "-q", "--allow-empty", "-m", "first");
    }
    return dir;
  }
  async plain(): Promise<string> {
    const dir = await tfs.makeTempDir({ prefix: "anyfs-git-plain-" });
    this.#dirs.push(dir);
    return dir;
  }
  async done(): Promise<void> {
    for (const d of this.#dirs) await tfs.remove(d, { recursive: true }).catch(() => undefined);
  }
}

const branchOf = async (folders: Folders, kind: "bare" | "worktree"): Promise<Dest> => (await refIn(await folders.make(kind))).store as unknown as Dest;
const worktreeOf = async (folders: Folders): Promise<Dest> => {
  const dir = await folders.make("worktree");
  const r = await gitWorktreeStore({ dir, commit: { author: who } });
  if (r.kind === "err") throw new Error(r.error);
  return r.value.store as unknown as Dest;
};

proves(["0006-git-conformance FR-001"], "the store of a branch passes every case of the suite its capabilities name, in a bare repository and in one with a working tree, and the store of a working tree does too", async () => {
  const folders = new Folders();
  try {
    for (const kind of ["bare", "worktree"] as const) {
      const make = async (): Promise<Store<CoreCapability>> => (await branchOf(folders, kind)) as unknown as Store<CoreCapability>;
      const sample = await make();
      assertEquals([...sample.capabilities].sort(), ["batch", "cas", "delete", "history", "list", "read", "rename", "stat", "write"]);
      const reports = await runConformance(make);
      assertEquals(failures(reports), [], `a branch in a ${kind} repository`);
      assertEquals(reports.length, casesFor(sample.capabilities).length);
      assert(reports.length >= 18, "the cases that need cas, batch, rename and history are run");
    }
    const make = async (): Promise<Store<CoreCapability>> => (await worktreeOf(folders)) as unknown as Store<CoreCapability>;
    const reports = await runConformance(make);
    assertEquals(failures(reports), [], "a working tree");
    assert(reports.length >= 14);
  } finally {
    await folders.done();
  }
});

proves(["0006-git-conformance FR-002"], "every law of the bridge holds between a store in memory or in a folder and the store of a branch, in both directions, and between two branches", async () => {
  const folders = new Folders();
  try {
    const local = async (): Promise<Dest> => {
      const r = await localStore(await folders.plain(), { create: true });
      if (r.kind === "err") throw new Error(r.error);
      return r.value as unknown as Dest;
    };
    const pairs: readonly [string, MakePair][] = [
      ["memory to a branch", async () => ({ source: memoryStore({ name: "s" }) as unknown as Dest, dest: await branchOf(folders, "bare") })],
      ["a branch to memory", async () => ({ source: await branchOf(folders, "bare"), dest: memoryStore({ name: "d" }) as unknown as Dest })],
      ["a folder to a branch", async () => ({ source: await local(), dest: await branchOf(folders, "worktree") })],
      ["a branch to a folder", async () => ({ source: await branchOf(folders, "worktree"), dest: await local() })],
      ["a branch to a branch", async () => ({ source: await branchOf(folders, "bare"), dest: await branchOf(folders, "bare") })],
    ];
    for (const [name, make] of pairs) assertEquals(failures(await runBridgeConformance(make)), [], name);
  } finally {
    await folders.done();
  }
});

proves(["0006-git-conformance FR-002"], "a sync into the store of a branch applied atomically is one commit however many files it changes, and a second sync makes none", async () => {
  const folders = new Folders();
  try {
    const dir = await folders.make("bare");
    const target = await refIn(dir);
    const source = memoryStore({ name: "files" });
    for (let i = 0; i < 12; i++) await source.write(p(`tree/${i % 3}/file-${i}`), bytes(`content ${i}`), expectAny);
    const prepared = await prepare({ kind: "sync", deletes: forbidDeletes }, { store: source as unknown as Dest, prefix: ROOT }, { store: target.store as unknown as Dest, prefix: ROOT });
    if (prepared.kind === "err") throw new Error(JSON.stringify(prepared.error));
    const done = await apply(prepared.value, { atomic: true });
    if (done.kind === "err") throw new Error(JSON.stringify(done.error));
    assertEquals(await commitsOf(dir, "fleet"), 1);
    assertEquals((await git(dir, "ls-tree", "-r", "--name-only", "fleet")).trim().split("\n").length, 12);
    const again = await prepare({ kind: "sync", deletes: forbidDeletes }, { store: source as unknown as Dest, prefix: ROOT }, { store: target.store as unknown as Dest, prefix: ROOT });
    if (again.kind === "err") throw new Error(JSON.stringify(again.error));
    assertEquals(again.value.plan.actions.length, 0);
    await apply(again.value, { atomic: true });
    assertEquals(await commitsOf(dir, "fleet"), 1);
    // without the atomic option each file is its own commit: the option is what makes a sync one commit
    const other = await refIn(await folders.make("bare"));
    const second = await prepare({ kind: "copy" }, { store: source as unknown as Dest, prefix: ROOT }, { store: other.store as unknown as Dest, prefix: ROOT });
    if (second.kind === "err") throw new Error(JSON.stringify(second.error));
    await apply(second.value);
    assertEquals(await commitsOf(other.repo, "fleet"), 12);
  } finally {
    await folders.done();
  }
});
