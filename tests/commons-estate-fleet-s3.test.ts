/**
 * The fleet with a bucket as a replica (commons estate 0006-estate-fleet-store FR-010, FR-012): a fleet store settled into a bucket of a real S3-compatible server (RustFS, where its binary can be had and run)
 * holds the same documents there, and the bucket opened as a fleet store of its own gives the same estate. Where the server cannot be run the test is skipped with the reason. Every name is made up.
 *
 * @module
 */
import process from "node:process";
import { assert, assertEquals, proves } from "../commons/test/src/test.ts";
import { expectAbsent } from "../commons/anyfs/src/governance/mod.ts";
import { memoryStore } from "../commons/anyfs/src/physical/memory/mod.ts";
import {
  createBucket,
  fetchTransport,
  makeClient,
  openS3Store,
  parseBucketName,
  parseEndpoint,
  staticCredentials,
} from "../commons/anyfs/s3/src/mod.ts";
import { parsePlace } from "../commons/anyfs/src/governance/mod.ts";
import { assessSnapshot, openFleetStore } from "../commons/estate/src/physical/mod.ts";
import { rustfsBinary, startRustfs } from "../commons/anyfs/s3/tools/rustfs.ts";
import { adopted, managed, named, ticking } from "../commons/estate/suite/support.ts";

const AT = Date.UTC(2026, 10, 20, 10, 0, 0);

proves(
  ["0006-estate-fleet-store FR-010", "0006-estate-fleet-store FR-012"],
  "a fleet store settled into a bucket of a real S3-compatible server holds the same documents there, and the bucket opened as a fleet store gives the same estate",
  async (t) => {
    const bin = await rustfsBinary();
    if (bin.kind === "err") {
      t.skip(`RustFS was not run: ${bin.error}`);
      return;
    }
    const run = await startRustfs(bin.value);
    if (run.kind === "err") {
      t.skip(`RustFS was not run: ${run.error}`);
      return;
    }
    process.once("exit", () => run.value.kill());
    try {
      const keys = staticCredentials(run.value.accessKey, run.value.secretKey);
      const bucket = parseBucketName("fleet-copy");
      const endpoint = parseEndpoint(run.value.endpoint);
      if (keys.kind === "err" || bucket.kind === "err" || endpoint.kind === "err")
        throw new Error("the throwaway keys, bucket or endpoint are not accepted");
      const client = makeClient({
        endpoint: endpoint.value,
        region: "us-east-1",
        bucket: bucket.value,
        addressing: "path",
        credentials: keys.value,
        transport: fetchTransport(),
        timeoutMs: 10_000,
        payload: "auto",
        now: () => new Date(),
      });
      const made = await createBucket(client, "us-east-1");
      if (made.kind === "err") throw new Error(made.error);
      const place = parsePlace("s3://fleet-copy/estate");
      if (place.kind === "err" || place.value.kind !== "s3") throw new Error("not a place");
      const opened = await openS3Store({ place: place.value, credentials: keys.value, endpoint: run.value.endpoint });
      if (opened.kind === "err") throw new Error(opened.error);
      if (opened.value.mode === "read-only") throw new Error("the keys can write");
      const bucketStore = opened.value.store;

      const fleet = await openFleetStore({
        primary: { name: named("record"), store: memoryStore({ name: "record" }) },
        replicas: [{ name: named("copy"), store: bucketStore }],
        create: true,
        identity: "example-fleet",
        actor: "operator",
        clock: ticking(AT),
      });
      assert(fleet.kind === "ok");
      for (const a of [adopted("olympia"), managed("athens")]) assert((await fleet.value.putAsset(a, expectAbsent)).kind === "ok");
      assert((await fleet.value.declare("olympia", { os: "linux" }, expectAbsent)).kind === "ok");
      assert(
        (
          await fleet.value.recordObservation({
            asset: "olympia",
            at: new Date(AT).toISOString(),
            source: "probe",
            state: { os: "linux" },
            results: [{ id: "p", status: "pass", controls: ["c"] }],
          })
        ).kind === "ok",
      );
      const settled = await fleet.value.settle();
      assert(settled.kind === "ok");
      assertEquals(
        settled.value.map((s) => [s.replica, s.state.kind]),
        [["copy", "in-sync"]],
      );
      assertEquals(
        (await fleet.value.status()).map((s) => s.state.kind),
        ["in-sync"],
      );

      if (opened.value.mode !== "cas") {
        t.skip(
          `the bucket was settled and holds the documents, but the endpoint keeps no conditional writes (${opened.value.mode}), so it cannot be opened as a fleet store of its own`,
        );
        return;
      }
      const alone = await openFleetStore({
        primary: { name: named("copy"), store: opened.value.store },
        identity: "example-fleet",
        actor: "operator-2",
        clock: ticking(AT),
      });
      assert(alone.kind === "ok", `the bucket opens as a fleet store: ${alone.kind === "err" ? JSON.stringify(alone.error) : ""}`);
      const [a, b] = [await fleet.value.snapshot({ observations: "all" }), await alone.value.snapshot({ observations: "all" })];
      assert(a.kind === "ok" && b.kind === "ok");
      assertEquals(b.value.assets.map((x) => x.id).sort(), a.value.assets.map((x) => x.id).sort());
      const [x, y] = [assessSnapshot(a.value, "2026-11-20T10:30:00Z", "PT1H"), assessSnapshot(b.value, "2026-11-20T10:30:00Z", "PT1H")];
      assert(x.kind === "ok" && y.kind === "ok");
      assertEquals(y.value, x.value, "the estate's truth is the same from the bucket");
    } finally {
      await run.value.stop();
    }
  },
);
