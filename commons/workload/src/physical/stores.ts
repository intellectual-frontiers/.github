// Spec: 0002-workload-effects FR-003
/**
 * The attachment of a store to a workshop, for every form that attaches: a store is attached only where it offers every capability the attachment needs, the missing capability is named otherwise, and the workshop port does
 * the attaching and the detaching. The executor of a form records the facts as events; this holds the rule.
 *
 * @example
 * ```ts
 * import { attachStore } from "./stores.ts";
 * // await attachStore(decls, catalog, workshop, "synthetic-db-01")
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { StoreClass, StoreDecl } from "@intellectual-frontiers/workload/governance";
import type { StoreCatalog, WorkshopPort } from "./ports.ts";

/** The class of the store once it is attached, or why it was not: the store is not known, or it lacks a capability the attachment needs. */
export async function attachStore(decls: readonly StoreDecl[], catalog: StoreCatalog, workshop: WorkshopPort, ref: string): Promise<Result<StoreClass, string>> {
  const decl = decls.find((x) => x.ref === ref);
  const offer = catalog.offer(ref);
  if (decl === undefined || offer === undefined) return err(`the store ${ref} is not known`);
  const lacking = decl.needs.filter((c) => !offer.capabilities.includes(c));
  if (lacking.length > 0) return err(`the store ${ref} lacks the capability ${lacking.join(", ")}`);
  const a = await workshop.attach(ref);
  return a.kind === "err" ? err(a.error) : ok(offer.class);
}

/** Detaches a store from the workshop, or says why not. */
export async function detachStore(workshop: WorkshopPort, ref: string): Promise<Result<void, string>> {
  const d = await workshop.detach(ref);
  return d.kind === "err" ? err(`the store ${ref} was not detached: ${d.error}`) : ok(undefined);
}
