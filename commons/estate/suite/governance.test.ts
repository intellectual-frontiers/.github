/**
 * Tests of the governance of Estate (commons estate 0002-estate-governance FR-001 to FR-006): the identities, the three states and what each offers, the moves between them, an asset with a line for
 * every capability, the refusals, and the typed estate, whose links to an asset that does not exist do not compile. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { CAPABILITIES, STATES, defineAsset, defineEstate, installOf, mayMove, offers, ownerOf, parseAssetId, parseAssetKind, parseSystemId, reasonNotOffered } from "../src/governance/mod.ts";

proves(["0002-estate-governance FR-001"], "the identities are made only by their parsers and a text that is not one is refused with its rule", () => {
  for (const ok of ["synthetic-server-01", "build-01.example", "a1"]) assertEquals(parseAssetId(ok).kind, "ok", ok);
  for (const bad of ["Synthetic-Server-01", "1a", "a b", "", "a..b", "x".repeat(101)]) assertEquals(parseAssetId(bad).kind, "err", JSON.stringify(bad));
  const r = parseAssetId("Synthetic-Server-01");
  assert(r.kind === "err" && r.error.includes("not an asset id"));
  assertEquals(parseAssetKind("network-device").kind, "ok");
  assertEquals(parseAssetKind("Network").kind, "err");
  assertEquals(parseSystemId("archon").kind, "ok");
  assertEquals(parseSystemId("a.b").kind, "err");
});

proves(["0002-estate-governance FR-002", "0002-estate-governance FR-003"], "each state offers what it should, a capability not offered has a reason, and an asset moves only as allowed", () => {
  assertEquals([...STATES], ["discovered", "adopted", "managed"]);
  assertEquals(CAPABILITIES.filter((c) => offers("discovered", c)), [], "a discovered asset is listed and nothing more");
  assertEquals(CAPABILITIES.filter((c) => offers("adopted", c)), ["verify", "observe"], "an adopted asset is observed and checked");
  assertEquals(CAPABILITIES.filter((c) => offers("managed", c)).length, 10);
  assertEquals(CAPABILITIES.filter((c) => offers("managed", c, "paired")).length, 9, "a managed asset that is not provisioned does not offer provision");
  assertEquals(offers("managed", "provision", "provisioned"), true);
  assert(reasonNotOffered("managed", "provision", "integration")?.includes("installed by someone else") === true);
  assertEquals(reasonNotOffered("managed", "converge"), undefined);
  assert(reasonNotOffered("adopted", "converge")?.includes("never changed") === true);
  assert(reasonNotOffered("discovered", "observe")?.includes("only listed") === true);
  assertEquals(mayMove("discovered", "adopted"), true);
  assertEquals(mayMove("adopted", "discovered"), true);
  assertEquals(mayMove("adopted", "managed"), true, "an adopted asset is taken over");
  assertEquals(mayMove("managed", "adopted"), false);
  assertEquals(mayMove("discovered", "managed"), false);
  assertEquals(mayMove("managed", "discovered"), false);
});

proves(["0002-estate-governance FR-004"], "an asset says for every capability, in order, that it is offered and by whom, or that it is not and why", () => {
  const a = defineAsset({ id: "synthetic-server-01", kind: "server", state: "adopted", owners: { observe: "archon", verify: "archon" } });
  assert(a.kind === "ok");
  assertEquals(a.value.capabilities.map((c) => c.capability), [...CAPABILITIES]);
  const converge = a.value.capabilities.find((c) => c.capability === "converge");
  assert(converge !== undefined && !converge.offered && converge.reason.includes("never changed"));
  assertEquals(ownerOf(a.value, "observe"), "archon");
  assertEquals(ownerOf(a.value, "converge"), undefined);
  const d = defineAsset({ id: "printer", kind: "device", state: "discovered", owners: {} });
  assert(d.kind === "ok" && d.value.capabilities.filter((c) => !c.offered).length === 10, "every capability of a discovered asset carries a reason");
});

proves(["0002-estate-governance FR-005"], "an asset is refused, with every reason, for an owner of what its state does not offer, a missing owner, and a name that is not well formed", () => {
  const owned = defineAsset({ id: "synthetic-server-01", kind: "server", state: "adopted", owners: { observe: "archon", verify: "archon", converge: "archon" } });
  assert(owned.kind === "err" && owned.error.some((m) => m.includes("converge is owned by archon") && m.includes("does not offer it")));
  const missing = defineAsset({ id: "synthetic-server-01", kind: "server", state: "adopted", owners: { observe: "archon" } });
  assert(missing.kind === "err" && missing.error.length === 1 && missing.error.every((m) => m.includes("has no owner")));
  const bad = defineAsset({ id: "Synthetic-Server-01", kind: "Server", state: "discovered", owners: { observe: "Archon" } });
  assert(bad.kind === "err" && bad.error.length === 3, JSON.stringify(bad));
});

proves(["0002-estate-governance FR-006"], "a typed estate makes each asset by its key, refuses a link that is wrong as data, and does not compile a link to an asset that is not there", () => {
  const owners = { observe: "archon", verify: "archon" } as const;
  const estate = defineEstate({ "synthetic-server-01": { kind: "server", state: "adopted", owners }, "synthetic-workstation-01": { kind: "workstation", state: "adopted", owners } }, [{ from: "synthetic-workstation-01", to: "synthetic-server-01", kind: "boots" }]);
  assert(estate.kind === "ok");
  assertEquals(estate.value.ids, ["synthetic-server-01", "synthetic-workstation-01"]);
  assertEquals(String(estate.value.assets["synthetic-server-01"].id), "synthetic-server-01");
  assertEquals(estate.value.links.length, 1);
  const bad = defineEstate({ "synthetic-server-01": { kind: "server", state: "adopted", owners } }, [
    // @ts-expect-error the end of a link that is no asset of the estate does not compile
    { from: "synthetic-server-01", to: "nowhere", kind: "uses" },
  ]);
  assert(bad.kind === "err" && bad.error.some((m) => m.includes("nowhere, which is no asset")));
  const loop = defineEstate({ "synthetic-server-01": { kind: "server", state: "adopted", owners } }, [{ from: "synthetic-server-01", to: "synthetic-server-01", kind: "uses" }]);
  assert(loop.kind === "err" && loop.error.some((m) => m.includes("linked to itself")));
  const asset = defineEstate({ x: { kind: "server", state: "adopted", owners: { observe: "archon" } } }, []);
  assert(asset.kind === "err", "an asset that is refused refuses the estate");
});

proves(["0002-estate-governance FR-007"], "an asset says where it came from, a managed asset is provisioned by default, only a managed asset can be, an inherited managed asset does not offer provision, and any other word is refused", () => {
  const paired = defineAsset({ id: "synthetic-workstation-01", kind: "workstation", state: "adopted", origin: "paired", owners: { observe: "archon", verify: "archon" } });
  assert(paired.kind === "ok" && paired.value.origin === "paired" && installOf(paired.value) === "inherited");
  const all = Object.fromEntries(CAPABILITIES.map((c) => [c, "archon"]));
  const provisioned = defineAsset({ id: "synthetic-server-01", kind: "server", state: "managed", owners: all });
  assert(provisioned.kind === "ok" && provisioned.value.origin === "provisioned" && installOf(provisioned.value) === "provisioned", "provisioned is the default origin of a managed asset");
  assert(provisioned.value.capabilities.every((c) => c.offered), "a provisioned asset offers every capability");
  const { provision: _p, ...rest } = all;
  const inherited = defineAsset({ id: "synthetic-server-01", kind: "server", state: "managed", origin: "paired", owners: rest });
  assert(inherited.kind === "ok" && installOf(inherited.value) === "inherited");
  const line = inherited.value.capabilities.find((c) => c.capability === "provision");
  assert(line !== undefined && !line.offered && line.reason.includes("installed by someone else"), "an inherited asset does not offer provision");
  assertEquals(inherited.value.capabilities.filter((c) => c.offered).length, CAPABILITIES.length - 1);
  const owned = defineAsset({ id: "synthetic-server-01", kind: "server", state: "managed", origin: "paired", owners: all });
  assert(owned.kind === "err" && owned.error.some((m) => m.includes("provision is owned by archon")));
  const wrong = defineAsset({ id: "synthetic-workstation-01", kind: "workstation", state: "adopted", origin: "provisioned", owners: { observe: "archon", verify: "archon" } });
  assert(wrong.kind === "err" && wrong.error.some((m) => m.includes("only a managed asset can be provisioned")));
  // @ts-expect-error an origin outside the closed list does not compile
  const unknown = defineAsset({ id: "x", kind: "server", state: "adopted", origin: "wandered-in", owners: { observe: "archon", verify: "archon" } });
  assert(unknown.kind === "err" && unknown.error.some((m) => m.includes("is not an origin")));
});
