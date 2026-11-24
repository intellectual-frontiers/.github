/**
 * Tests of the store beside the bridge of AnyFS (commons anyfs-s3 0002-anyfs-s3-store FR-014): the laws of a transfer hold between a store of S3 and a store in memory or in S3, in each direction, on the server in
 * process and on RustFS where it can be run; a copy of a tree to a bucket and back is the same tree, and a second sync of it has nothing to do, because the revisions of the two are the same digests.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { expectAny, parsePath, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { apply, type Dest, prepare } from "@intellectual-frontiers/anyfs-bridge/logical";
import { runBridgeConformance, type MakePair } from "@intellectual-frontiers/anyfs-bridge/conformance";
import { allowDeletes, forbidDeletes } from "@intellectual-frontiers/anyfs-bridge/governance";
import { bucketOn, onServers, type Server, writableOn } from "./support.ts";

let counter = 0;
const unique = (label: string): string => `${label}-${Date.now().toString(36)}-${counter++}`;
const p = (t: string) => {
  const r = parsePath(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);

const failures = (reports: Awaited<ReturnType<typeof runBridgeConformance>>): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

async function s3(server: Server, bucket: string): Promise<Dest> {
  let n = 0;
  return (await writableOn(server, bucket, `p${n++}-${counter++}`)).store as unknown as Dest;
}

proves(["0002-anyfs-s3-store FR-014"], "every law of a transfer holds between memory and a bucket, a bucket and memory, and a bucket and a bucket, on both servers", async (t) => {
  await onServers(
    async (server, label) => {
      const bucket = unique("laws");
      await bucketOn(server, bucket);
      for (const [from, to] of [["memory", "s3"], ["s3", "memory"], ["s3", "s3"]] as const) {
        const make: MakePair = async () => ({
          source: from === "memory" ? (memoryStore({ name: "s" }) as unknown as Dest) : await s3(server, bucket),
          dest: to === "memory" ? (memoryStore({ name: "d" }) as unknown as Dest) : await s3(server, bucket),
        });
        assertEquals(failures(await runBridgeConformance(make)), [], `${label}: ${from} to ${to}`);
      }
    },
    (reason) => t.skip(reason),
  );
});

proves(["0002-anyfs-s3-store FR-014"], "a tree copied to a bucket and synced back is the same tree, and a second sync of either way plans nothing, because the revisions are the digests of the bytes", async (t) => {
  await onServers(
    async (server, label) => {
      const bucket = unique("sync");
      await bucketOn(server, bucket);
      const local = memoryStore({ name: "local" });
      const names = ["a.txt", "dir/b.txt", "dir/deep/c.bin", "with space/d.txt", "ü/é.txt"];
      for (const n of names) assert((await local.write(p(n), bytes(`content of ${n}`), expectAny)).kind === "ok");
      const remote = (await writableOn(server, bucket, "tree")).store as unknown as Dest;
      const there = { store: local as unknown as Dest, prefix: ROOT };
      const here = { store: remote, prefix: ROOT };

      const up = await prepare({ kind: "sync", deletes: forbidDeletes }, there, here);
      assert(up.kind === "ok", label);
      assertEquals(up.value.plan.actions.map((a) => a.kind), names.map(() => "create"));
      const done = await apply(up.value);
      assert(done.kind === "ok" && done.value.failed === 0 && done.value.done === names.length, `${label}: ${JSON.stringify(done)}`);

      const again = await prepare({ kind: "sync", deletes: forbidDeletes }, there, here);
      assert(again.kind === "ok");
      assertEquals(again.value.plan.actions.length, 0, `${label}: a second sync has nothing to do`);
      assertEquals(again.value.plan.actions.length === 0 && again.value.plan.unchanged, names.length);

      const back = memoryStore({ name: "back" }) as unknown as Dest;
      const down = await prepare({ kind: "sync", deletes: forbidDeletes }, here, { store: back, prefix: ROOT });
      assert(down.kind === "ok");
      assert((await apply(down.value)).kind === "ok");
      for (const n of names) {
        const r = await back.read(p(n));
        assert(r.kind === "ok" && new TextDecoder().decode(r.value.bytes) === `content of ${n}`, n);
      }
      // a change at the source is an update, a file taken away is a delete the allowance has to name
      assert((await local.write(p("a.txt"), bytes("changed"), expectAny)).kind === "ok");
      assert((await local.delete(p("dir/b.txt"), expectAny)).kind === "ok");
      const refused = await prepare({ kind: "sync", deletes: forbidDeletes }, there, here);
      assert(refused.kind === "ok", JSON.stringify(refused));
      assertEquals(refused.value.plan.actions.map((a) => a.kind).sort(), ["skip", "update"]);
      const withDelete = await prepare({ kind: "sync", deletes: allowDeletes(5) }, there, here);
      assert(withDelete.kind === "ok");
      assertEquals(withDelete.value.plan.actions.map((a) => a.kind).sort(), ["delete", "update"]);
      const ran = await apply(withDelete.value);
      assert(ran.kind === "ok" && ran.value.failed === 0);
      assertEquals((await remote.read(p("dir/b.txt"))).kind, "err");
    },
    (reason) => t.skip(reason),
  );
});
