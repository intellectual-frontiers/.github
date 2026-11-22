/**
 * The store against a live Google Drive account (commons anyfs-gdrive 0003-anyfs-gdrive-tests FR-003). THIS TEST HAS NOT BEEN RUN: it needs a token and a folder of a test account, which the owner has not given
 * (`ANYFS_GDRIVE_TEST_TOKEN`, a bearer token of a test account with the `drive` scope, and `ANYFS_GDRIVE_TEST_FOLDER`, the identifier of a folder the test may write in). Where they are not set it is skipped with its
 * reason. Where they are, it works below a folder of its own in that folder for each case (the store is scoped to it, so that nothing is made outside it), and removes what it made (for good, not to the trash).
 *
 * @module
 */
import process from "node:process";
import { runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { parsePrefix } from "@intellectual-frontiers/anyfs/governance";
import { sub } from "@intellectual-frontiers/anyfs/logical";
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { openDriveStore, staticToken } from "../src/mod.ts";
import { placeOf } from "./support.ts";

proves(["0003-anyfs-gdrive-tests FR-003"], "the store passes the conformance suite of AnyFS on a live account, in a folder of its own that it removes", async (t) => {
  const token = process.env["ANYFS_GDRIVE_TEST_TOKEN"];
  const folder = process.env["ANYFS_GDRIVE_TEST_FOLDER"];
  if (token === undefined || token === "" || folder === undefined || folder === "") {
    t.skip("ANYFS_GDRIVE_TEST_TOKEN and ANYFS_GDRIVE_TEST_FOLDER are not set: no live account was named, so the live run has not been made");
    return;
  }
  const made: { cleanup: () => Promise<void> }[] = [];
  const make = async () => {
    const o = await openDriveStore({ place: placeOf(folder), token: staticToken(token), deletion: "delete" });
    if (o.kind === "err") throw new Error(o.error);
    const prefix = `anyfs-live-${Date.now().toString(36)}-${made.length}`;
    const scope = parsePrefix(prefix);
    if (scope.kind === "err") throw new Error(scope.error);
    made.push({
      cleanup: async () => {
        const listed = await o.value.list(scope.value, {});
        if (listed.kind === "ok") for (const e of listed.value.entries) await o.value.delete(e.path, { kind: "any" });
      },
    });
    // every case works below a folder of its own, so that nothing is made outside it
    return sub(o.value, scope.value);
  };
  try {
    const reports = await runConformance(make);
    assertEquals(reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`), []);
  } finally {
    for (const m of made) await m.cleanup();
  }
});
