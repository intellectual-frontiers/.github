// Spec: 0004-estate-iac-drift FR-001, FR-002
/**
 * Drift between what the code says and what a cloud shows. The code is the assets imported from infrastructure as code that carry an identifier (a state does, a plan of resources not yet made does not); the cloud is what a read-only connector listed. They are matched by provider and identifier, and the
 * difference is said in four words: in the code and not in the cloud (it was deleted, or never made), in the cloud and not in the code (made by hand, or by other code), in both in a different region, and in the code with no identifier (a plan, so nothing can be compared). A resource of a type the code
 * does not cover is not reported as missing from it unless the whole cloud is asked for.
 *
 * @example
 * ```ts
 * import { driftBetween } from "./drift.ts";
 * driftBetween([], []); // []
 * ```
 *
 * @module
 */
import type { Imported } from "@intellectual-frontiers/estate-iac/governance";

/** A resource a read-only connector showed. */
export type Observed = { readonly provider: string; readonly type: string; readonly identifier: string; readonly region?: string };

/** One difference. */
export type Drift = {
  readonly kind: "not-in-cloud" | "not-in-code" | "region-differs" | "no-identifier";
  readonly asset?: string;
  readonly provider: string;
  readonly type: string;
  readonly identifier?: string;
  readonly detail: string;
};

const keyOf = (provider: string, identifier: string): string => `${provider}\u0000${identifier}`;

/** The differences between the cloud resources of the code and the resources of the cloud. `all` also reports the resources of the cloud of types the code does not cover. */
export function driftBetween(code: readonly Imported[], cloud: readonly Observed[], options: { readonly all?: boolean } = {}): readonly Drift[] {
  const out: Drift[] = [];
  const resources = code.filter((a) => a.kind === "cloud-resource");
  const shown = new Map(cloud.map((o) => [keyOf(o.provider, o.identifier), o]));
  const covered = new Set<string>();
  const matched = new Set<string>();
  for (const a of resources) {
    const provider = String(a.attributes["provider"] ?? "other");
    const type = String(a.attributes["type"] ?? "");
    covered.add(`${provider}\u0000${type}`);
    const identifier = typeof a.attributes["identifier"] === "string" ? a.attributes["identifier"] : undefined;
    if (identifier === undefined) {
      out.push({ kind: "no-identifier", asset: a.id, provider, type, detail: `${a.id} has no identifier in the code (a plan, not a state), so it cannot be compared with the cloud` });
      continue;
    }
    const seen = shown.get(keyOf(provider, identifier));
    if (seen === undefined) {
      out.push({ kind: "not-in-cloud", asset: a.id, provider, type, identifier, detail: `${a.id} (${type}) is in the code and the cloud does not show ${identifier}` });
      continue;
    }
    matched.add(keyOf(provider, identifier));
    const region = typeof a.attributes["region"] === "string" ? a.attributes["region"] : undefined;
    if (region !== undefined && seen.region !== undefined && region !== seen.region) out.push({ kind: "region-differs", asset: a.id, provider, type, identifier, detail: `${a.id} is in ${region} in the code and in ${seen.region} in the cloud` });
  }
  for (const o of cloud) {
    if (matched.has(keyOf(o.provider, o.identifier))) continue;
    if (options.all !== true && !covered.has(`${o.provider}\u0000${o.type}`)) continue;
    out.push({ kind: "not-in-code", provider: o.provider, type: o.type, identifier: o.identifier, detail: `the cloud shows ${o.identifier} (${o.type}) and no code says it` });
  }
  return out;
}
