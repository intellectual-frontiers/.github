// Spec: 0003-planning-reconcile FR-009
/**
 * The outbox (0037-planning FR-014, FR-033): a patch is applied only to a source that declares the capability it needs; for any other it is an outbox entry that names the capability, or the reason the place
 * cannot say it, and is offered again when a source that can apply it is given. Pure.
 *
 * @example
 * ```ts
 * import { route } from "./outbox.ts";
 * // route(patch, { name: "markdown", capabilities }, now).kind // "apply" or "outbox"
 * ```
 *
 * @module
 */
import { capabilityFor, type Capability, type Instant, makePatch, mayApply, type OutboxEntry, type Patch } from "@intellectual-frontiers/planning/governance";

/** What a patch comes to for a source. */
export type Routed = { readonly kind: "apply"; readonly patch: Patch } | { readonly kind: "outbox"; readonly entry: OutboxEntry };

/** Whether a patch is applied to a source with these capabilities or waits in the outbox, naming the capability the source lacks. */
export function route(patch: Patch, source: { readonly name: string; readonly capabilities: ReadonlySet<Capability> }, at: Instant): Routed {
  if (mayApply(patch, source.capabilities)) return { kind: "apply", patch };
  return { kind: "outbox", entry: { patch, waiting: { kind: "capability", capability: capabilityFor(patch) }, at } };
}

/** The entries a source can now apply, as patches for that source and place, and the entries that still wait. */
export function redeliver(
  entries: readonly OutboxEntry[],
  source: { readonly name: string; readonly capabilities: ReadonlySet<Capability> },
  place: string,
): { readonly patches: readonly Patch[]; readonly waiting: readonly OutboxEntry[] } {
  const patches: Patch[] = [];
  const waiting: OutboxEntry[] = [];
  for (const entry of entries) {
    const again = makePatch(source.name, place, entry.patch.event, entry.patch.source === source.name ? entry.patch.fingerprint : undefined);
    if (again.kind === "ok" && mayApply(again.value, source.capabilities)) patches.push(again.value);
    else waiting.push(entry);
  }
  return { patches, waiting };
}
