/**
 * Tests of the logical layer of Estate (commons estate 0003-estate-logical FR-001 to FR-004): moves between states that keep and give up owners, the move of a capability that needs a passed
 * acceptance test, operational truth (declared against observed, with the age of the observation) and the assets nobody declared. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { defineAsset, installOf, ownerOf, type Asset } from "../src/governance/mod.ts";
import { moveCapability, moveState, operationalTruth, unexpectedAssets, type AcceptanceRecord } from "../src/logical/mod.ts";

const ALL = { provision: "fleetctl", identity: "fleetctl", plan: "fleetctl", converge: "fleetctl", verify: "archon", observe: "archon", update: "fleetctl", access: "archon", backup: "fleetctl", retire: "fleetctl" } as const;

function asset(state: "discovered" | "adopted" | "managed", owners: Record<string, string>): Asset {
  const a = defineAsset({ id: "synthetic-server-01", kind: "server", state, owners });
  if (a.kind === "err") throw new Error(a.error.join("; "));
  return a.value;
}

proves(["0002-estate-governance FR-003", "0003-estate-logical FR-001"], "an adoption and a release keep and give up owners, keep the way of joining, a managed asset is never moved, and a move that is not allowed is refused", () => {
  const discovered = asset("discovered", {});
  const none = moveState(discovered, "adopted");
  assert(none.kind === "err" && none.error.length === 2, "observe and verify need an owner");
  const adopted = moveState(discovered, "adopted", { observe: "archon", verify: "archon" });
  assert(adopted.kind === "ok" && ownerOf(adopted.value, "observe") === "archon" && ownerOf(adopted.value, "verify") === "archon");
  const released = moveState(adopted.kind === "ok" ? adopted.value : discovered, "discovered");
  assert(released.kind === "ok" && released.value.capabilities.every((c) => !c.offered), "a released asset offers nothing");
  const paired = defineAsset({ id: "synthetic-workstation-01", kind: "workstation", state: "adopted", origin: "paired", owners: { observe: "archon", verify: "archon" } });
  assert(paired.kind === "ok");
  const back = moveState(paired.value, "discovered");
  assert(back.kind === "ok" && back.value.origin === "paired", "where it came from is kept");
  const managed = asset("managed", ALL);
  for (const to of ["adopted", "discovered"] as const) {
    const r = moveState(managed, to);
    assert(r.kind === "err" && r.error[0]?.includes("never moved") === true, `a managed asset is not moved to ${to}`);
  }
  const skip = moveState(discovered, "managed", ALL, { by: "ada", planHash: HASH });
  assert(skip.kind === "err" && skip.error[0]?.includes("never moved") === true);
  const same = moveState(discovered, "discovered");
  assert(same.kind === "err" && same.error[0]?.includes("already") === true);
});

const HASH = `sha256:${"a".repeat(64)}`;

proves(["0003-estate-logical FR-008"], "an adopted asset is taken over only with an approval and an owner for each capability that is new, keeps where it came from, is then inherited and does not offer provision, and cannot go back", () => {
  const adopted = defineAsset({ id: "synthetic-workstation-01", kind: "server", state: "adopted", origin: "paired", owners: { observe: "archon", verify: "archon" } });
  assert(adopted.kind === "ok");
  const { provision: _p, ...rest } = ALL;
  const noApproval = moveState(adopted.value, "managed", rest);
  assert(noApproval.kind === "err" && noApproval.error[0]?.includes("only with an approval") === true);
  for (const bad of [{ by: "", planHash: HASH }, { by: "ada", planHash: "abc" }]) assertEquals(moveState(adopted.value, "managed", rest, bad).kind, "err");
  const noOwners = moveState(adopted.value, "managed", {}, { by: "ada", planHash: HASH });
  assert(noOwners.kind === "err" && noOwners.error.length > 0, "an owner is needed for each capability that is new");
  const taken = moveState(adopted.value, "managed", rest, { by: "ada", planHash: HASH });
  assert(taken.kind === "ok" && taken.value.state === "managed" && taken.value.origin === "paired" && installOf(taken.value) === "inherited");
  assertEquals(ownerOf(taken.value, "provision"), undefined);
  const withProvision = moveState(adopted.value, "managed", ALL, { by: "ada", planHash: HASH });
  assert(withProvision.kind === "err" && withProvision.error.some((m) => m.includes("provision")), "provision is not given to an inherited asset");
  const back = moveState(taken.value, "adopted");
  assert(back.kind === "err" && back.error[0]?.includes("never moved") === true);
});

proves(["0003-estate-logical FR-002"], "a capability moves to another system only with a passed acceptance test for this asset, this capability and that system", () => {
  const managed = asset("managed", ALL);
  const record: AcceptanceRecord = { asset: "synthetic-server-01", capability: "converge", system: "archon", test: "synthetic-network-01-AT-06", passedAt: "2026-12-01T10:00:00Z" };
  const none = moveCapability(managed, "converge", "archon", undefined);
  assert(none.kind === "err" && none.error[0]?.includes("only when its acceptance test has passed") === true);
  for (const wrong of [{ ...record, asset: "other" }, { ...record, capability: "update" as const }, { ...record, system: "someone" }]) {
    const r = moveCapability(managed, "converge", "archon", wrong);
    assert(r.kind === "err" && r.error[0]?.includes("acceptance record is for") === true);
  }
  const moved = moveCapability(managed, "converge", "archon", record);
  assert(moved.kind === "ok" && ownerOf(moved.value, "converge") === "archon" && ownerOf(moved.value, "update") === "fleetctl");
  const same = moveCapability(moved.kind === "ok" ? moved.value : managed, "converge", "archon", record);
  assert(same.kind === "err" && same.error[0]?.includes("already owned") === true);
  const adopted = asset("adopted", { observe: "archon", verify: "archon" });
  const notOffered = moveCapability(adopted, "converge", "archon", record);
  assert(notOffered.kind === "err" && notOffered.error[0]?.includes("not offered") === true);
  assertEquals(moveCapability(managed, "converge", "Not A System", record).kind, "err");
});

proves(["0003-estate-logical FR-003"], "operational truth tells what differs between declared and observed, how old the observation is, and never says an unobserved asset agrees", () => {
  const adopted = asset("adopted", { observe: "archon", verify: "archon" });
  const declared = { "pkg.git": { version: "2.43.0" }, "svc.ssh": { enabled: true } };
  const base = { asset: adopted, declared, now: "2026-12-01T12:00:00Z", within: "PT24H" };
  const same = operationalTruth({ ...base, observed: { at: "2026-12-01T11:00:00Z", source: "probe", state: declared } });
  assert(same.kind === "ok" && same.value.agrees && same.value.currency === "fresh" && same.value.observedAt === "2026-12-01T11:00:00Z" && same.value.alignment === "aligned" && same.value.source === "probe");
  const drifted = operationalTruth({ ...base, observed: { at: "2026-12-01T11:00:00Z", source: "probe", state: { "pkg.git": { version: "2.44.0" }, "svc.cron": { enabled: true } } } });
  assert(drifted.kind === "ok" && !drifted.value.agrees && drifted.value.alignment === "drifted");
  assertEquals(drifted.kind === "ok" ? drifted.value.difference?.added : undefined, ["svc.cron"]);
  assertEquals(drifted.kind === "ok" ? drifted.value.difference?.removed : undefined, ["svc.ssh"]);
  assertEquals(drifted.kind === "ok" ? drifted.value.difference?.changed.map((c) => c.path) : undefined, ["version"]);
  const stale = operationalTruth({ ...base, observed: { at: "2026-11-29T11:00:00Z", source: "probe", state: declared } });
  assert(stale.kind === "ok" && stale.value.currency === "stale" && stale.value.agrees);
  const never = operationalTruth({ ...base, observed: undefined });
  assert(never.kind === "ok" && never.value.currency === "never-observed" && !never.value.agrees && never.value.difference === null && never.value.alignment === "not-observed" && never.value.source === null);
  const discovered = operationalTruth({ asset: asset("discovered", {}), declared, observed: { at: "2026-12-01T11:00:00Z", source: "probe", state: { x: 1 } }, now: base.now, within: base.within });
  assert(discovered.kind === "ok" && discovered.value.difference === null && discovered.value.alignment === "not-observed", "nothing is declared of a discovered asset, so it is never aligned");
  assertEquals(operationalTruth({ ...base, observed: undefined, within: "soon" }).kind, "err");
  assertEquals(operationalTruth({ ...base, observed: undefined, now: "yesterday" }).kind, "err");
});

proves(["0003-estate-logical FR-004"], "the assets seen that nobody declared, and the ones declared and never seen, are told in order", () => {
  assertEquals(unexpectedAssets(["synthetic-server-01", "synthetic-workstation-01"], ["synthetic-server-01", "printer", "cam"]), { unexpected: ["cam", "printer"], unseen: ["synthetic-workstation-01"] });
  assertEquals(unexpectedAssets([], []), { unexpected: [], unseen: [] });
});
