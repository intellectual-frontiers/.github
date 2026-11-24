/**
 * The suite of signed deltas on one engine (commons anyfs-sql 0011-sql-signing FR-001), shared by one file for each engine so that the shards of CI run the engines beside one another.
 *
 * @module
 */
import { type MakeSigned, runSigningConformance } from "@intellectual-frontiers/anyfs/conformance";
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { ENGINES, monotone, storeOn } from "./kit.ts";

const failures = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

/** The cases of the suite of signed deltas, on the engine named. */
export function signingConformance(name: string): void {
  const engine = ENGINES.find((e) => e.name === name);
  if (engine === undefined) throw new Error(`no engine ${name}`);
  proves(["0011-sql-signing FR-001"], `on ${engine.name} replicas pass every case of the suite of signed deltas`, async () => {
    const make: MakeSigned = async (ids, trusts) => {
      const clock = monotone(Date.now());
      const faces = [];
      for (const [i, id] of ids.entries()) {
        const s = await storeOn(await engine.make(), { replica: id, clock, trust: trusts[i] ?? { kind: "open" } });
        faces.push({ store: s.store as unknown as Parameters<MakeSigned>[0] extends never ? never : import("@intellectual-frontiers/anyfs/conformance").MergeFace["store"], replica: s.replica });
      }
      return faces;
    };
    const reports = await runSigningConformance(make);
    assertEquals(failures(reports), []);
    assertEquals(reports.length, 9);
  });
}
