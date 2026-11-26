/**
 * What the tests share: a permit for applying to one asset, made the only way one is made (`permits` of estate, over an organizational boundary that its owner approved), with made up names.
 *
 * @module
 */
import { BOTTOM, sel, parseAssetId, parseBoundaryId, parsePrincipalId, type AnyBoundary, type Permit } from "@intellectual-frontiers/estate/governance";
import { approve, permits, planOf, verified } from "@intellectual-frontiers/estate/logical";

const must = <T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }): T => {
  if (r.kind === "err") throw new Error(String(r.error));
  return r.value;
};

/** A permit for `apply` on the asset at the instant: an organizational boundary of the fleet that owns the asset, approved by its owner. */
export async function applyPermit(asset: string, at: string): Promise<Permit<"apply">> {
  const owner = must(parsePrincipalId("synthetic-person-01"));
  const target = must(parseAssetId(asset));
  const boundary: AnyBoundary = {
    id: must(parseBoundaryId("synthetic-boundary-01")),
    kind: "organizational",
    name: "synthetic engagement",
    owner,
    roles: { owner: [owner] },
    categorization: BOTTOM,
    include: sel.or(),
    exclude: sel.or(),
    overrides: [],
    decisions: [{ asset: target, disposition: { t: "in-scope", role: "owned" }, by: owner, at: "2026-01-01T00:00:00.000Z" }],
    parents: [],
    constraints: [],
    interconnections: [],
    inheritances: [],
    accepted: [],
    version: 1,
  };
  const plan = await planOf(boundary);
  const approved = must(await approve(boundary, plan.hash, owner, "2026-01-01T00:00:00.000Z", true));
  return must(permits("apply", target, [await verified(approved)], at));
}
