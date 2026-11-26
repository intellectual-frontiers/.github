/**
 * What the tests share: a permit for a scan of one asset, made the only way one is made (`permits` of estate, over an engagement-scope boundary that its owner approved), with made up names.
 *
 * @module
 */
import { BOTTOM, sel, parseAssetId, parseBoundaryId, parsePrincipalId, type AnyBoundary, type Permit } from "@intellectual-frontiers/estate/governance";
import { approve, permits, planOf, verified } from "@intellectual-frontiers/estate/logical";

const must = <T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }): T => {
  if (r.kind === "err") throw new Error(String(r.error));
  return r.value;
};

/** A permit for `scan` on the asset at the instant: the engagement is approved by its owner, and open from 2026-01-01 to 2027-01-01. */
export async function scanPermit(asset: string, at: string): Promise<Permit<"scan">> {
  const owner = must(parsePrincipalId("synthetic-person-01"));
  const target = must(parseAssetId(asset));
  const boundary: AnyBoundary = {
    id: must(parseBoundaryId("synthetic-boundary-01")),
    kind: "engagement-scope",
    name: "synthetic engagement",
    owner,
    roles: { "client-approver": [owner] },
    categorization: BOTTOM,
    include: sel.or(),
    exclude: sel.or(),
    overrides: [],
    decisions: [{ asset: target, disposition: { t: "in-scope", role: "target" }, by: owner, at: "2026-01-01T00:00:00.000Z" }],
    parents: [],
    constraints: [],
    interconnections: [],
    inheritances: [],
    accepted: [],
    actions: ["scan"],
    window: { from: "2026-01-01T00:00:00.000Z", until: "2027-01-01T00:00:00.000Z" },
    version: 1,
  };
  const plan = await planOf(boundary);
  const approved = must(await approve(boundary, plan.hash, owner, "2026-01-01T00:00:00.000Z", true));
  return must(permits("scan", target, [await verified(approved)], at));
}
