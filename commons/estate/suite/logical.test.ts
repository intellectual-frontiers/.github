/**
 * Tests of the logical layer of Estate (commons estate 0003-estate-logical FR-001 to FR-004): moves between states that keep and give up owners, the move of a capability that needs a passed
 * acceptance test, operational truth (declared against observed, with the age of the observation) and the assets nobody declared. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { defineAsset, ownerOf, type Asset } from "../src/governance/mod.ts";
import { moveCapability, moveState, operationalTruth, unexpectedAssets, type AcceptanceRecord } from "../src/logical/mod.ts";

const ALL = { provision: "stolos", identity: "stolos", plan: "stolos", converge: "stolos", verify: "archon", observe: "archon", update: "stolos", access: "archon", backup: "stolos", retire: "stolos" } as const;

function asset(state: "discovered" | "adopted" | "managed", owners: Record<string, string>): Asset {
  const a = defineAsset({ id: "olympia", kind: "server", state, owners });
  if (a.kind === "err") throw new Error(a.error.join("; "));
  return a.value;
}

proves(["0002-estate-governance FR-003", "0003-estate-logical FR-001"], "a move keeps the owners of what the new state offers, gives up the rest, takes the owners of what is new, and is refused where it is not allowed", () => {
  const managed = asset("managed", ALL);
  const adopted = moveState(managed, "adopted");
  assert(adopted.kind === "ok");
  assertEquals([ownerOf(adopted.value, "verify"), ownerOf(adopted.value, "observe"), ownerOf(adopted.value, "access"), ownerOf(adopted.value, "converge")], ["archon", "archon", "archon", undefined]);
  const back = moveState(adopted.value, "managed");
  assert(back.kind === "err" && back.error.length === 7, "seven capabilities need an owner again");
  const again = moveState(adopted.value, "managed", { provision: "archon", identity: "archon", plan: "archon", converge: "archon", update: "archon", backup: "archon", retire: "archon" });
  assert(again.kind === "ok" && ownerOf(again.value, "verify") === "archon" && ownerOf(again.value, "converge") === "archon");
  const discovered = asset("discovered", { observe: "archon" });
  const skip = moveState(discovered, "managed");
  assert(skip.kind === "err" && skip.error[0]?.includes("adopted first") === true);
  const same = moveState(discovered, "discovered");
  assert(same.kind === "err" && same.error[0]?.includes("already") === true);
  const up = moveState(discovered, "adopted", { verify: "archon", access: "archon" });
  assert(up.kind === "ok" && ownerOf(up.value, "observe") === "archon");
});

proves(["0003-estate-logical FR-002"], "a capability moves to another system only with a passed acceptance test for this asset, this capability and that system", () => {
  const managed = asset("managed", ALL);
  const record: AcceptanceRecord = { asset: "olympia", capability: "converge", system: "archon", test: "FCR-AT-06", passedAt: "2026-12-01T10:00:00Z" };
  const none = moveCapability(managed, "converge", "archon", undefined);
  assert(none.kind === "err" && none.error[0]?.includes("only when its acceptance test has passed") === true);
  for (const wrong of [{ ...record, asset: "other" }, { ...record, capability: "update" as const }, { ...record, system: "someone" }]) {
    const r = moveCapability(managed, "converge", "archon", wrong);
    assert(r.kind === "err" && r.error[0]?.includes("acceptance record is for") === true);
  }
  const moved = moveCapability(managed, "converge", "archon", record);
  assert(moved.kind === "ok" && ownerOf(moved.value, "converge") === "archon" && ownerOf(moved.value, "update") === "stolos");
  const same = moveCapability(moved.kind === "ok" ? moved.value : managed, "converge", "archon", record);
  assert(same.kind === "err" && same.error[0]?.includes("already owned") === true);
  const adopted = asset("adopted", { observe: "archon", verify: "archon", access: "archon" });
  const notOffered = moveCapability(adopted, "converge", "archon", record);
  assert(notOffered.kind === "err" && notOffered.error[0]?.includes("not offered") === true);
  assertEquals(moveCapability(managed, "converge", "Not A System", record).kind, "err");
});

proves(["0003-estate-logical FR-003"], "operational truth tells what differs between declared and observed, how old the observation is, and never says an unobserved asset agrees", () => {
  const adopted = asset("adopted", { observe: "archon", verify: "archon", access: "archon" });
  const declared = { "pkg.git": { version: "2.43.0" }, "svc.ssh": { enabled: true } };
  const base = { asset: adopted, declared, now: "2026-12-01T12:00:00Z", within: "PT24H" };
  const same = operationalTruth({ ...base, observed: { at: "2026-12-01T11:00:00Z", state: declared } });
  assert(same.kind === "ok" && same.value.agrees && same.value.currency === "fresh" && same.value.observedAt === "2026-12-01T11:00:00Z");
  const drifted = operationalTruth({ ...base, observed: { at: "2026-12-01T11:00:00Z", state: { "pkg.git": { version: "2.44.0" }, "svc.cron": { enabled: true } } } });
  assert(drifted.kind === "ok" && !drifted.value.agrees);
  assertEquals(drifted.kind === "ok" ? drifted.value.difference?.added : undefined, ["svc.cron"]);
  assertEquals(drifted.kind === "ok" ? drifted.value.difference?.removed : undefined, ["svc.ssh"]);
  assertEquals(drifted.kind === "ok" ? drifted.value.difference?.changed.map((c) => c.path) : undefined, ["version"]);
  const stale = operationalTruth({ ...base, observed: { at: "2026-11-29T11:00:00Z", state: declared } });
  assert(stale.kind === "ok" && stale.value.currency === "stale" && stale.value.agrees);
  const never = operationalTruth({ ...base, observed: undefined });
  assert(never.kind === "ok" && never.value.currency === "never-observed" && !never.value.agrees && never.value.difference === null);
  const discovered = operationalTruth({ asset: asset("discovered", { observe: "archon" }), declared, observed: { at: "2026-12-01T11:00:00Z", state: { x: 1 } }, now: base.now, within: base.within });
  assert(discovered.kind === "ok" && discovered.value.difference === null, "nothing is declared of a discovered asset");
  assertEquals(operationalTruth({ ...base, observed: undefined, within: "soon" }).kind, "err");
  assertEquals(operationalTruth({ ...base, observed: undefined, now: "yesterday" }).kind, "err");
});

proves(["0003-estate-logical FR-004"], "the assets seen that nobody declared, and the ones declared and never seen, are told in order", () => {
  assertEquals(unexpectedAssets(["olympia", "defiant"], ["olympia", "printer", "cam"]), { unexpected: ["cam", "printer"], unseen: ["defiant"] });
  assertEquals(unexpectedAssets([], []), { unexpected: [], unseen: [] });
});
