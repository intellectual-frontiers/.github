/**
 * Tests of the store beside the bridge of AnyFS (commons anyfs-githost 0002-anyfs-githost-store FR-014): the laws of a transfer hold between a branch on a host and memory, in each direction, and between two branches; a tree copied to a
 * branch with an atomic apply is one commit, a second sync of it plans nothing because the revisions are the digests of the bytes, and a change at the source is one commit more.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { expectAny, parsePath, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { apply, type Dest, prepare } from "@intellectual-frontiers/anyfs-bridge/logical";
import { runBridgeConformance, type MakePair } from "@intellectual-frontiers/anyfs-bridge/conformance";
import { allowDeletes, forbidDeletes } from "@intellectual-frontiers/anyfs-bridge/governance";
import { bytes, rig } from "./support.ts";

const p = (t: string) => {
  const r = parsePath(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const failures = (reports: Awaited<ReturnType<typeof runBridgeConformance>>): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

proves(["0002-anyfs-githost-store FR-014"], "every law of a transfer holds between memory and a branch on each host, a branch and memory, and between two branches", async () => {
  for (const label of ["github", "gitlab"] as const) {
    const r = rig(label);
    let n = 0;
    const branch = async (): Promise<Dest> => (await r.writable({ prefix: `p${n++}` })) as unknown as Dest;
    for (const [from, to] of [["memory", "host"], ["host", "memory"], ["host", "host"]] as const) {
      const make: MakePair = async () => ({
        source: from === "memory" ? (memoryStore({ name: "s" }) as unknown as Dest) : await branch(),
        dest: to === "memory" ? (memoryStore({ name: "d" }) as unknown as Dest) : await branch(),
      });
      assertEquals(failures(await runBridgeConformance(make)), [], `${label}: ${from} to ${to}`);
    }
  }
});

proves(["0002-anyfs-githost-store FR-014"], "a tree copied to a branch with an atomic apply is one commit, a second sync plans nothing, a change is one commit more, and what is synced back is the same tree", async () => {
  for (const label of ["github", "gitlab"] as const) {
    const r = rig(label);
    const local = memoryStore({ name: "local" });
    const names = ["a.txt", "dir/b.txt", "dir/deep/c.bin", "with space/d.txt", "ü/é.txt"];
    for (const n of names) assert((await local.write(p(n), bytes(`content of ${n}`), expectAny)).kind === "ok");
    const remote = (await r.writable({ prefix: "tree" })) as unknown as Dest;
    const there = { store: local as unknown as Dest, prefix: ROOT };
    const here = { store: remote, prefix: ROOT };
    const before = r.repo.length("main");

    const up = await prepare({ kind: "sync", deletes: forbidDeletes }, there, here);
    assert(up.kind === "ok", label);
    assertEquals(up.value.plan.actions.map((a) => a.kind), names.map(() => "create"));
    const done = await apply(up.value, { atomic: true });
    assert(done.kind === "ok" && done.value.failed === 0 && done.value.done === names.length, `${label}: ${JSON.stringify(done)}`);
    assertEquals(r.repo.length("main"), before + 1, `${label}: the whole tree is one commit`);

    const again = await prepare({ kind: "sync", deletes: forbidDeletes }, there, here);
    assert(again.kind === "ok");
    assertEquals(again.value.plan.actions.length, 0, `${label}: a second sync has nothing to do`);
    assertEquals(r.repo.length("main"), before + 1);

    assert((await local.write(p("a.txt"), bytes("changed"), expectAny)).kind === "ok");
    assert((await local.delete(p("dir/b.txt"), expectAny)).kind === "ok");
    const change = await prepare({ kind: "sync", deletes: allowDeletes(5) }, there, here);
    assert(change.kind === "ok");
    assertEquals(change.value.plan.actions.map((a) => a.kind).sort(), ["delete", "update"]);
    const ran = await apply(change.value, { atomic: true });
    assert(ran.kind === "ok" && ran.value.failed === 0, label);
    assertEquals(r.repo.length("main"), before + 2, `${label}: the change is one commit more`);

    const back = memoryStore({ name: "back" }) as unknown as Dest;
    const down = await prepare({ kind: "sync", deletes: forbidDeletes }, here, { store: back, prefix: ROOT });
    assert(down.kind === "ok");
    assert((await apply(down.value)).kind === "ok");
    const listed = await back.list(ROOT);
    assert(listed.kind === "ok" && listed.value.entries.length === names.length - 1, label);
  }
});
