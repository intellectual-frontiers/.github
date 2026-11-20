/**
 * The registry of integrations (commons 0019-mizan-integrations FR-002): a typed lookup by the formats an integration reads and writes. An integration is added once; an
 * identifier or a pair of formats and a standard that is already there is refused with a finding, not overwritten.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { AnyIntegration, Direction, Format } from "./types.ts";

/** Why an integration is not added. */
export type RegistryError =
  | { readonly kind: "id-taken"; readonly id: string }
  | { readonly kind: "pair-taken"; readonly from: Format; readonly to: Format; readonly standard: string; readonly id: string };

/** A registry: the integrations added so far, in order. */
export type Registry = { readonly integrations: readonly AnyIntegration[] };

/** An empty registry. */
export const emptyRegistry: Registry = { integrations: [] };

/** A registry with the integration added, or why it was not. */
export function register(r: Registry, i: AnyIntegration): Result<Registry, RegistryError> {
  if (r.integrations.some((x) => x.id === i.id)) return err({ kind: "id-taken", id: i.id });
  const same = r.integrations.find((x) => x.from === i.from && x.to === i.to && x.standard === i.standard && x.direction === i.direction);
  if (same !== undefined) return err({ kind: "pair-taken", from: i.from, to: i.to, standard: i.standard, id: same.id });
  return ok({ integrations: [...r.integrations, i] });
}

/** The integrations that read a format and write another, of a direction, for a standard (any standard where none is given). */
export function lookup(
  r: Registry,
  q: { readonly direction: Direction; readonly from: Format; readonly to: Format; readonly standard?: string },
): readonly AnyIntegration[] {
  return r.integrations.filter(
    (i) => i.direction === q.direction && i.from === q.from && i.to === q.to && (q.standard === undefined || i.standard === q.standard),
  );
}
