// Spec: 0002-estate-governance FR-006
/**
 * The typed estate: the assets of an organization written as data in which every reference is derived from the data. A link between assets names its ends by the keys of the assets, so that an
 * unknown asset is a compile error the editor shows, and `defineEstate` also refuses it as a value where the data came from a place the compiler did not see.
 *
 * @example
 * ```ts
 * import { defineEstate } from "./estate.ts";
 * const estate = defineEstate(
 *   { synthetic-server-01: { kind: "server", state: "adopted", owners: { observe: "desired-os-state", verify: "desired-os-state", access: "desired-os-state" } } },
 *   [],
 * );
 * estate.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { defineAsset, type Asset, type AssetInput } from "./asset.ts";
import { checkLink } from "./kinds.ts";

/** The input for an asset, whose identity is its key. */
export type AssetSpec = Omit<AssetInput, "id">;

/** A link between two assets, by their keys. */
export type Link<K extends string> = { readonly from: K; readonly to: K; readonly kind: string };

/** A typed estate: the assets by key, and the links between them. */
export type Estate<K extends string> = {
  readonly assets: { readonly [P in K]: Asset };
  readonly links: readonly Link<K>[];
  /** The keys, in order. */
  readonly ids: readonly K[];
};

/** An estate from its assets (the key of each is its id) and links, or every reason it is refused; a link whose end is not a key of the assets does not compile. */
export function defineEstate<const A extends Readonly<Record<string, AssetSpec>>>(
  assets: A,
  links: readonly Link<Extract<keyof A, string>>[],
): Result<Estate<Extract<keyof A, string>>, readonly string[]> {
  type K = Extract<keyof A, string>;
  const problems: string[] = [];
  const made: Partial<Record<K, Asset>> = {};
  const keys = (Object.keys(assets) as K[]).sort();
  for (const key of keys) {
    const spec = assets[key];
    if (spec === undefined) continue;
    const a = defineAsset({ ...spec, id: key });
    if (a.kind === "err") problems.push(...a.error);
    else made[key] = a.value;
  }
  for (const l of links) {
    if (!keys.includes(l.from)) problems.push(`a link starts at ${l.from}, which is no asset`);
    if (!keys.includes(l.to)) problems.push(`a link ends at ${l.to}, which is no asset`);
    if (l.from === l.to) problems.push(`${l.from} is linked to itself`);
    const [a, b] = [made[l.from], made[l.to]];
    if (a !== undefined && b !== undefined) for (const m of checkLink(l.kind, a.kind, b.kind)) problems.push(`${l.from} to ${l.to}: ${m}`);
  }
  return problems.length > 0 ? err(problems) : ok({ assets: made as { readonly [P in K]: Asset }, links, ids: keys });
}
