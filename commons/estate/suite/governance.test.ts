/**
 * Tests of the governance of Estate (commons estate 0002-estate-governance FR-001 to FR-006): the identities, the three states and what each offers, the moves between them, an asset with a line for
 * every capability, the refusals, and the typed estate, whose links to an asset that does not exist do not compile. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { CAPABILITIES, STATES, defineAsset, defineEstate, mayMove, offers, ownerOf, parseAssetId, parseAssetKind, parseSystemId, reasonNotOffered } from "../src/governance/mod.ts";

proves(["0002-estate-governance FR-001"], "the identities are made only by their parsers and a text that is not one is refused with its rule", () => {
  for (const ok of ["olympia", "build-01.example", "a1"]) assertEquals(parseAssetId(ok).kind, "ok", ok);
  for (const bad of ["Olympia", "1a", "a b", "", "a..b", "x".repeat(101)]) assertEquals(parseAssetId(bad).kind, "err", JSON.stringify(bad));
  const r = parseAssetId("Olympia");
  assert(r.kind === "err" && r.error.includes("not an asset id"));
  assertEquals(parseAssetKind("network-device").kind, "ok");
  assertEquals(parseAssetKind("Network").kind, "err");
  assertEquals(parseSystemId("archon").kind, "ok");
  assertEquals(parseSystemId("a.b").kind, "err");
});

proves(["0002-estate-governance FR-002", "0002-estate-governance FR-003"], "each state offers what it should, a capability not offered has a reason, and an asset moves only as allowed", () => {
  assertEquals([...STATES], ["discovered", "adopted", "managed"]);
  assertEquals(CAPABILITIES.filter((c) => offers("discovered", c)), ["observe"]);
  assertEquals(CAPABILITIES.filter((c) => offers("adopted", c)), ["verify", "observe", "access"]);
  assertEquals(CAPABILITIES.filter((c) => offers("managed", c)).length, 10);
  assertEquals(reasonNotOffered("managed", "converge"), undefined);
  assert(reasonNotOffered("adopted", "converge")?.includes("never changed") === true);
  assert(reasonNotOffered("discovered", "verify")?.includes("nobody has adopted") === true);
  assertEquals(mayMove("discovered", "adopted"), true);
  assertEquals(mayMove("adopted", "managed"), true);
  assertEquals(mayMove("managed", "adopted"), true);
  assertEquals(mayMove("adopted", "discovered"), true);
  assertEquals(mayMove("discovered", "managed"), false, "an asset is adopted first");
  assertEquals(mayMove("managed", "discovered"), false);
});

proves(["0002-estate-governance FR-004"], "an asset says for every capability, in order, that it is offered and by whom, or that it is not and why", () => {
  const a = defineAsset({ id: "olympia", kind: "server", state: "adopted", owners: { observe: "archon", verify: "archon", access: "archon" } });
  assert(a.kind === "ok");
  assertEquals(a.value.capabilities.map((c) => c.capability), [...CAPABILITIES]);
  const converge = a.value.capabilities.find((c) => c.capability === "converge");
  assert(converge !== undefined && !converge.offered && converge.reason.includes("never changed"));
  assertEquals(ownerOf(a.value, "observe"), "archon");
  assertEquals(ownerOf(a.value, "converge"), undefined);
  const d = defineAsset({ id: "printer", kind: "device", state: "discovered", owners: { observe: "archon" } });
  assert(d.kind === "ok" && d.value.capabilities.filter((c) => !c.offered).length === 9, "nine capabilities carry a reason");
});

proves(["0002-estate-governance FR-005"], "an asset is refused, with every reason, for an owner of what its state does not offer, a missing owner, and a name that is not well formed", () => {
  const owned = defineAsset({ id: "olympia", kind: "server", state: "adopted", owners: { observe: "archon", verify: "archon", access: "archon", converge: "archon" } });
  assert(owned.kind === "err" && owned.error.some((m) => m.includes("converge is owned by archon") && m.includes("does not offer it")));
  const missing = defineAsset({ id: "olympia", kind: "server", state: "adopted", owners: { observe: "archon" } });
  assert(missing.kind === "err" && missing.error.length === 2 && missing.error.every((m) => m.includes("has no owner")));
  const bad = defineAsset({ id: "Olympia", kind: "Server", state: "discovered", owners: { observe: "Archon" } });
  assert(bad.kind === "err" && bad.error.length === 3, JSON.stringify(bad));
});

proves(["0002-estate-governance FR-006"], "a typed estate makes each asset by its key, refuses a link that is wrong as data, and does not compile a link to an asset that is not there", () => {
  const owners = { observe: "archon", verify: "archon", access: "archon" } as const;
  const estate = defineEstate({ olympia: { kind: "server", state: "adopted", owners }, defiant: { kind: "workstation", state: "adopted", owners } }, [{ from: "defiant", to: "olympia", kind: "boots" }]);
  assert(estate.kind === "ok");
  assertEquals(estate.value.ids, ["defiant", "olympia"]);
  assertEquals(String(estate.value.assets.olympia.id), "olympia");
  assertEquals(estate.value.links.length, 1);
  const bad = defineEstate({ olympia: { kind: "server", state: "adopted", owners } }, [
    // @ts-expect-error the end of a link that is no asset of the estate does not compile
    { from: "olympia", to: "nowhere", kind: "uses" },
  ]);
  assert(bad.kind === "err" && bad.error.some((m) => m.includes("nowhere, which is no asset")));
  const loop = defineEstate({ olympia: { kind: "server", state: "adopted", owners } }, [{ from: "olympia", to: "olympia", kind: "uses" }]);
  assert(loop.kind === "err" && loop.error.some((m) => m.includes("linked to itself")));
  const asset = defineEstate({ x: { kind: "server", state: "adopted", owners: { observe: "archon" } } }, []);
  assert(asset.kind === "err", "an asset that is refused refuses the estate");
});
