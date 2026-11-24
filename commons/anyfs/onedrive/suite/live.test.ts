/**
 * The store against a live tenant of Microsoft Graph (commons anyfs-onedrive 0003-anyfs-onedrive-tests FR-003). THIS TEST HAS NOT BEEN RUN: it needs a token and a drive of a test tenant, which the owner has not given
 * (`ANYFS_ONEDRIVE_TEST_TOKEN`, a bearer token of a test account with `Files.ReadWrite`, and `ANYFS_ONEDRIVE_TEST_DRIVE`, `me` or the id of a drive). Where they are not set it is skipped with its reason. Where they are, it
 * makes a folder of its own below the root of the drive, runs the conformance suite of AnyFS in one folder for each case, and removes everything it made.
 *
 * @module
 */
import process from "node:process";
import { runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { ROOT } from "@intellectual-frontiers/anyfs/governance";
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { openOneDriveStore, staticToken } from "../src/mod.ts";
import { placeOf } from "./support.ts";

proves(["0003-anyfs-onedrive-tests FR-003"], "the store passes the conformance suite of AnyFS on a live tenant, in a folder of its own that it removes", async (t) => {
  const token = process.env["ANYFS_ONEDRIVE_TEST_TOKEN"];
  const drive = process.env["ANYFS_ONEDRIVE_TEST_DRIVE"];
  if (token === undefined || token === "" || drive === undefined || drive === "") {
    t.skip("ANYFS_ONEDRIVE_TEST_TOKEN and ANYFS_ONEDRIVE_TEST_DRIVE are not set: no live tenant was named, so the live run has not been made");
    return;
  }
  const base = `anyfs-live-${Date.now().toString(36)}`;
  const opened: { delete: () => Promise<void> }[] = [];
  let n = 0;
  const make = async () => {
    const o = await openOneDriveStore({ place: placeOf(`onedrive://${drive}/${base}/run-${n++}`), token: staticToken(token) });
    if (o.kind === "err") throw new Error(o.error);
    opened.push({
      delete: async () => {
        const listed = await o.value.list(ROOT, {});
        if (listed.kind === "ok") for (const e of listed.value.entries) await o.value.delete(e.path, { kind: "any" });
      },
    });
    return o.value;
  };
  try {
    const reports = await runConformance(make);
    assertEquals(reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`), []);
  } finally {
    for (const o of opened) await o.delete();
  }
});
