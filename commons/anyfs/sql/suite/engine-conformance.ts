/**
 * The conformance of one engine (0010-sql-dialects FR-001): the store passes the laws of AnyFS and the merge suite on the engine. Each engine has a test file of its own that calls this, so that CI's shards (0001-libraries FR-034)
 * can run the long ones beside one another.
 *
 * @module
 */
import { runConformance, runMergeConformance, type MakeReplicas, type MergeFace } from "@intellectual-frontiers/anyfs/conformance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { asCore, ENGINES, monotone, replicaOf, storeOn } from "./kit.ts";

const failures = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] =>
  reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

/** Registers the test of the engine called `name`. */
export function engineConformance(name: string): void {
  const engine = ENGINES.find((e) => e.name === name);
  if (engine === undefined) throw new Error(`no engine called ${name}`);
  proves(
    ["0010-sql-dialects FR-001"],
    `on ${engine.name} the store passes every case of the suite its capabilities name, and the merge suite of AnyFS`,
    async () => {
      const reports = await runConformance(async () => asCore(await storeOn(await engine.make())));
      assertEquals(failures(reports), []);
      assert(reports.length >= 18, "the cases that need cas, batch, rename and history are run");
      const replicas: MakeReplicas = async (count, options) => {
        const clock = monotone();
        const faces: MergeFace[] = [];
        for (let i = 0; i < count; i++) {
          const s = await storeOn(await engine.make(), {
            replica: replicaOf(i),
            clock,
            ...(options.trusting ? { trust: { kind: "open" as const } } : {}),
          });
          faces.push({ store: s.store as unknown as MergeFace["store"], replica: s.replica });
        }
        return faces;
      };
      const merge = await runMergeConformance(replicas);
      assertEquals(failures(merge), []);
      assertEquals(merge.length, 12);
    },
  );
}
