/**
 * The store against the conformance suite of AnyFS (commons anyfs-onedrive 0003-anyfs-onedrive-tests FR-001): every case, on a Graph made in process that gives the digest of the contents and on one that does not.
 *
 * @module
 */
import { runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fakeGraph } from "./fake-graph.ts";
import { open } from "./support.ts";

const failures = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

for (const hashes of [true, false]) {
  proves(["0003-anyfs-onedrive-tests FR-001"], `the store passes every case of the conformance suite of AnyFS on a Graph that ${hashes ? "gives" : "does not give"} the digest of the contents`, async () => {
    const fake = fakeGraph({ hashes });
    let n = 0;
    const reports = await runConformance(async () => await open(fake, {}, `conf${n++}`));
    assertEquals(failures(reports), []);
    assert(reports.some((r) => r.id === "race-absent" && r.failure === undefined), "the race of writers that expect no object was run");
    assert(reports.some((r) => r.id === "race-revision" && r.failure === undefined), "the race of revisions was run: the store has cas");
    assertEquals(fake.leaked, [], "no token went to the download address");
  });
}
