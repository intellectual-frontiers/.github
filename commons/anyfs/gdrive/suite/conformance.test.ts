/**
 * The store against the conformance suite of AnyFS (commons anyfs-gdrive 0003-anyfs-gdrive-tests FR-001): every case its capabilities call for (all but the cases that need `cas`, which it does not have), on a Drive made
 * in process that gives `sha256Checksum` and on one that does not, with the race of writers that expect no object among them.
 *
 * @module
 */
import { runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fakeDrive } from "./fake-drive.ts";
import { open } from "./support.ts";

const failures = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

for (const checksums of [true, false]) {
  proves(["0003-anyfs-gdrive-tests FR-001"], `the store passes every case of the conformance suite of AnyFS that its capabilities call for, on a Drive that ${checksums ? "gives" : "does not give"} sha256Checksum`, async () => {
    const fake = fakeDrive({ checksums });
    const reports = await runConformance(async () => (await open(fake)).store);
    assertEquals(failures(reports), []);
    assert(reports.some((r) => r.id === "race-absent" && r.failure === undefined), "the race of writers that expect no object was run");
    assert(!reports.some((r) => r.id === "race-revision"), "the race of revisions needs cas, which the store does not have");
  });
}
