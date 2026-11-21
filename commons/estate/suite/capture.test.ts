/**
 * Tests of the capture policy (commons estate 0004-estate-capture FR-001 to FR-008): the defaults, every reason a policy cannot hold given together, the cadences and the freshness window, the journal and its heartbeat, pushing, the seal, and the
 * cadence of an asset. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { cadenceOf, DEFAULT_CAPTURE_POLICY, defineCapturePolicy, freshnessWindowMs, type CapturePolicyInput } from "../src/governance/mod.ts";

const refused = (input: CapturePolicyInput): readonly string[] => {
  const r = defineCapturePolicy(input);
  assert(r.kind === "err", "the policy was refused");
  return r.error;
};

proves(["0004-estate-capture FR-001"], "no input gives the defaults, a left out field is the default, and every reason is given together", () => {
  const p = defineCapturePolicy();
  assertEquals(p, { kind: "ok", value: DEFAULT_CAPTURE_POLICY });
  assertEquals(DEFAULT_CAPTURE_POLICY.cadence, { managed: "PT15M", adopted: "P1D", perAsset: {} });
  assertEquals([DEFAULT_CAPTURE_POLICY.branch, DEFAULT_CAPTURE_POLICY.collector.runsOn, DEFAULT_CAPTURE_POLICY.push, DEFAULT_CAPTURE_POLICY.sealing.required], ["evidence", "controller", { mode: "never", remote: "origin", every: null }, "on-export"]);
  const some = defineCapturePolicy({ push: { mode: "after-commit" }, cadence: { perAsset: { olympia: "PT5M" } } });
  assert(some.kind === "ok" && some.value.push.mode === "after-commit" && some.value.push.remote === "origin" && some.value.cadence.managed === "PT15M" && some.value.cadence.perAsset["olympia"] === "PT5M");
  assert(refused({ branch: "main", cadence: { managed: "soon" }, push: { mode: "every" } }).length >= 3, "every reason together");
});

proves(["0004-estate-capture FR-002"], "the branch is a name of a branch that is not the tenant's own", () => {
  for (const bad of ["main", "master", "HEAD", "trunk", "develop"]) assert(refused({ branch: bad })[0]?.includes("branch of its own") === true, bad);
  for (const bad of ["", "a b", "x..y", "-x", "x.lock", "x//y"]) assertEquals(defineCapturePolicy({ branch: bad }).kind, "err", JSON.stringify(bad));
  for (const good of ["evidence", "ops/evidence", "evidence-fcr"]) assertEquals(defineCapturePolicy({ branch: good }).kind, "ok", good);
});

proves(["0004-estate-capture FR-003"], "the collector runs on the controller or on an asset", () => {
  assertEquals(defineCapturePolicy({ collector: { runsOn: "olympia" } }).kind, "ok");
  assertEquals(defineCapturePolicy({ collector: { runsOn: "controller" } }).kind, "ok");
  assert(refused({ collector: { runsOn: "Olympia" } })[0]?.includes("controller or on an asset") === true);
});

proves(["0004-estate-capture FR-004"], "a cadence is a duration above zero and at most seven days, for each kind and each asset named, and the freshness window is twice the cadence capped at seven days", () => {
  assertEquals(defineCapturePolicy({ cadence: { managed: "PT1M", adopted: "P7D" } }).kind, "ok");
  for (const bad of ["P8D", "PT0S", "soon", "P0D", ""]) assertEquals(defineCapturePolicy({ cadence: { adopted: bad } }).kind, "err", JSON.stringify(bad));
  assert(refused({ cadence: { adopted: "P8D" } })[0]?.includes("longer than seven days") === true);
  assert(refused({ cadence: { perAsset: { "Not An Asset": "PT5M" } } }).some((m) => m.includes("is not an asset")));
  assert(refused({ cadence: { perAsset: { olympia: "P9D" } } })[0]?.includes("olympia") === true);
  assertEquals([freshnessWindowMs(900_000), freshnessWindowMs(86_400_000), freshnessWindowMs(5 * 86_400_000), freshnessWindowMs(7 * 86_400_000)], [1_800_000, 172_800_000, 7 * 86_400_000, 7 * 86_400_000]);
});

proves(["0004-estate-capture FR-005"], "the journal is every capture or changes and a heartbeat, a heartbeat is for the second and no longer than any freshness window, and the commit interval is a duration", () => {
  assert(refused({ journal: { granularity: "every-capture", heartbeat: "PT10M" } })[0]?.includes("every capture is journaled already") === true);
  assert(refused({ journal: { granularity: "changes-and-heartbeat" } })[0]?.includes("needs the heartbeat") === true);
  const stale = refused({ journal: { granularity: "changes-and-heartbeat", heartbeat: "PT1H" } });
  assert(stale.some((m) => m.includes("managed assets") && m.includes("look stale between heartbeats")), JSON.stringify(stale));
  const ok = defineCapturePolicy({ journal: { granularity: "changes-and-heartbeat", heartbeat: "PT30M" } });
  assert(ok.kind === "ok" && ok.value.journal.heartbeat === "PT30M");
  assertEquals(defineCapturePolicy({ cadence: { managed: "PT2H" }, journal: { granularity: "changes-and-heartbeat", heartbeat: "PT1H" } }).kind, "ok", "an hour fits a managed asset every two hours");
  assertEquals(defineCapturePolicy({ journal: { granularity: "changes-and-heartbeat", heartbeat: "PT0S" } }).kind, "err");
  assertEquals(defineCapturePolicy({ journal: { granularity: "nope" as never } }).kind, "err");
  assertEquals(defineCapturePolicy({ journal: { commit: { every: "PT5M" } } }).kind, "ok");
  assertEquals(defineCapturePolicy({ journal: { commit: { every: "never" } } }).kind, "err");
});

proves(["0004-estate-capture FR-006"], "pushing is never, after a commit or at an interval, to a named remote, and an interval is for the interval mode alone", () => {
  assertEquals(defineCapturePolicy({ push: { mode: "every", every: "PT1H", remote: "backup" } }).kind, "ok");
  assert(refused({ push: { mode: "every" } })[0]?.includes("needs the interval") === true);
  assert(refused({ push: { mode: "never", every: "PT1H" } })[0]?.includes("for pushing at an interval") === true);
  assertEquals(defineCapturePolicy({ push: { mode: "sometimes" as never } }).kind, "err");
  assertEquals(defineCapturePolicy({ push: { remote: "-x" } }).kind, "err");
  assertEquals(defineCapturePolicy({ push: { mode: "every", every: "PT0S" } }).kind, "err");
});

proves(["0004-estate-capture FR-007"], "a seal is never, with an export or due every day, and a requirement written out names a signer", () => {
  assertEquals(defineCapturePolicy({ sealing: { required: "daily", key: "snshah-daily" } }).kind, "ok");
  assertEquals(defineCapturePolicy({ sealing: { required: "never" } }).kind, "ok");
  assert(refused({ sealing: { required: "on-export" } })[0]?.includes("name it") === true);
  assertEquals(defineCapturePolicy({ sealing: { required: "weekly" as never, key: "k" } }).kind, "err");
  assertEquals(defineCapturePolicy({ sealing: { required: "daily", key: "a b" } }).kind, "err");
});

proves(["0004-estate-capture FR-008"], "the cadence of an asset is its own, else that of its state, and a discovered asset has none", () => {
  const policy = defineCapturePolicy({ cadence: { perAsset: { olympia: "PT5M" } } });
  assert(policy.kind === "ok");
  assertEquals(cadenceOf(policy.value, { id: "olympia", state: "managed" }), "PT5M");
  assertEquals(cadenceOf(policy.value, { id: "athens", state: "managed" }), "PT15M");
  assertEquals(cadenceOf(policy.value, { id: "sparta", state: "adopted" }), "P1D");
  assertEquals(cadenceOf(policy.value, { id: "printer", state: "discovered" }), undefined);
});
