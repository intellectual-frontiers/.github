// Spec: 0002-engine FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * Composition (commons data 0002-engine FR-005 to FR-009): a project passes its extensions, an explicit list, to `compose`, which puts them in an order that satisfies
 * `requires` (the project's own order where `requires` does not decide), finds every mistake in the list and returns it as a value, and gives back a `Composition`. The
 * composition answers `contributions(point)` (what a layer needs of its extensions reaches it as a value, in order), starts the extensions that are not lazy, and
 * activates a lazy one when `fire` is given one of its events, once, even when two events fire at once.
 *
 * @remarks
 * The engine keeps no registry: everything is in the composition `compose` returns, and nothing registers by being imported. An activation that failed stays failed in its composition.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { contextFor, type HandleError, type Provided } from "./handle.ts";
import type { ExtensionId } from "./id.ts";
import { CONTRACT, type Entry, type EventName, type Extension, isLazy } from "./manifest.ts";
import type { ContributionPoint, PointName } from "./point.ts";

/** What is wrong with a list of extensions; `compose` returns all of it together. */
export type ComposeError =
  | { readonly kind: "duplicate"; readonly id: ExtensionId }
  | { readonly kind: "missing"; readonly id: ExtensionId; readonly requiredBy: ExtensionId }
  | { readonly kind: "cycle"; readonly nodes: readonly ExtensionId[] }
  | { readonly kind: "contract"; readonly id: ExtensionId; readonly wanted: number; readonly have: number }
  | { readonly kind: "unprovided"; readonly id: ExtensionId; readonly handle: PointName };

/** Why an extension did not activate. */
export type ActivationError =
  | { readonly kind: "failed"; readonly id: ExtensionId; readonly message: string }
  | { readonly kind: "mismatch"; readonly id: ExtensionId; readonly loaded: string }
  | { readonly kind: "contract"; readonly id: ExtensionId; readonly wanted: number; readonly have: number }
  | { readonly kind: "handle"; readonly id: ExtensionId; readonly error: HandleError };

/** What a project gives `compose` besides the list. */
export interface ComposeOptions {
  /** The values for the handles the extensions use. */
  readonly provided?: readonly Provided[];
}

/** The extensions of a project, in order, and what they add. */
export interface Composition {
  /** The identifiers in the order that satisfies `requires`. */
  readonly order: readonly ExtensionId[];
  /** What the extensions contribute to a point, in order: those that are not lazy at once, a lazy one once it is activated. */
  contributions<T>(point: ContributionPoint<T>): readonly T[];
  /** Activates the extensions that are not lazy, in order, once each; gives the identifiers it activated now. */
  start(): Promise<Result<readonly ExtensionId[], readonly ActivationError[]>>;
  /** Activates the lazy extensions that an event starts, after what they require, once each; gives the identifiers it activated now. */
  fire(event: EventName): Promise<Result<readonly ExtensionId[], readonly ActivationError[]>>;
  /** The identifiers activated so far, in the order they were. */
  activated(): readonly ExtensionId[];
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Composes a project's extensions.
 *
 * @param entries - the extensions, the project's list
 * @param options - the values for the handles they use
 * @returns the composition, or everything that is wrong with the list
 */
export function compose(entries: readonly Entry[], options: ComposeOptions = {}): Result<Composition, readonly ComposeError[]> {
  const errors: ComposeError[] = [];
  const byId = new Map<ExtensionId, Entry>();
  for (const e of entries) {
    if (byId.has(e.id)) errors.push({ kind: "duplicate", id: e.id });
    else byId.set(e.id, e);
  }
  const provided = new Map<PointName, unknown>((options.provided ?? []).map((p) => [p.name, p.value]));
  for (const e of byId.values()) {
    if (e.contract !== CONTRACT) errors.push({ kind: "contract", id: e.id, wanted: e.contract, have: CONTRACT });
    for (const r of e.requires) if (!byId.has(r)) errors.push({ kind: "missing", id: r, requiredBy: e.id });
    if (!isLazy(e)) for (const h of e.uses) if (!provided.has(h.name)) errors.push({ kind: "unprovided", id: e.id, handle: h.name });
  }
  const order: ExtensionId[] = [];
  const state = new Map<ExtensionId, "visiting" | "done">();
  const path: ExtensionId[] = [];
  const visit = (id: ExtensionId): void => {
    const s = state.get(id);
    if (s === "done") return;
    if (s === "visiting") {
      errors.push({ kind: "cycle", nodes: [...path.slice(path.indexOf(id)), id] });
      return;
    }
    state.set(id, "visiting");
    path.push(id);
    for (const r of byId.get(id)?.requires ?? []) if (byId.has(r)) visit(r);
    path.pop();
    state.set(id, "done");
    order.push(id);
  };
  for (const id of byId.keys()) visit(id);
  if (errors.length > 0) return err(errors);

  const loaded = new Map<ExtensionId, Extension>();
  for (const e of byId.values()) if (!isLazy(e)) loaded.set(e.id, e);
  const active: ExtensionId[] = [];
  const memo = new Map<ExtensionId, Promise<Result<true, ActivationError>>>();

  const activate = async (id: ExtensionId): Promise<Result<true, ActivationError>> => {
    const entry = byId.get(id);
    if (entry === undefined) return err({ kind: "failed", id, message: "it is not in the composition" });
    for (const r of entry.requires) {
      const needed = await ensure(r);
      if (needed.kind === "err") return needed;
    }
    let ext: Extension;
    if (isLazy(entry)) {
      try {
        ext = await entry.load();
      } catch (e) {
        return err({ kind: "failed", id, message: messageOf(e) });
      }
      if (ext.id !== id) return err({ kind: "mismatch", id, loaded: ext.id });
      if (ext.contract !== CONTRACT) return err({ kind: "contract", id, wanted: ext.contract, have: CONTRACT });
      for (const h of ext.uses)
        if (!provided.has(h.name)) return err({ kind: "handle", id, error: { kind: "unprovided", handle: h.name } });
    } else ext = entry;
    try {
      await ext.activate?.(contextFor(ext.uses, provided));
    } catch (e) {
      return err({ kind: "failed", id, message: messageOf(e) });
    }
    if (isLazy(entry)) loaded.set(id, ext);
    active.push(id);
    return ok(true);
  };
  const ensure = (id: ExtensionId): Promise<Result<true, ActivationError>> => {
    const prior = memo.get(id);
    if (prior !== undefined) return prior;
    const started = activate(id);
    memo.set(id, started);
    return started;
  };
  const run = async (ids: readonly ExtensionId[]): Promise<Result<readonly ExtensionId[], readonly ActivationError[]>> => {
    const before = new Set(active);
    const failures: ActivationError[] = [];
    for (const id of ids) {
      const r = await ensure(id);
      if (r.kind === "err" && !failures.some((f) => f.kind === r.error.kind && f.id === r.error.id)) failures.push(r.error);
    }
    return failures.length > 0 ? err(failures) : ok(active.filter((id) => !before.has(id)));
  };

  return ok({
    order,
    contributions<T>(point: ContributionPoint<T>): readonly T[] {
      const out: T[] = [];
      for (const id of order) {
        for (const c of loaded.get(id)?.contributes ?? []) {
          // the one place a contribution is read back as its type: `contribute` typed it by the same point
          if (c.point === point.name) out.push(c.value as T);
        }
      }
      return out;
    },
    start: () =>
      run(
        order.filter((id) => {
          const e = byId.get(id);
          return e !== undefined && !isLazy(e);
        }),
      ),
    fire: (event) =>
      run(
        order.filter((id) => {
          const e = byId.get(id);
          return e !== undefined && isLazy(e) && e.events.includes(event);
        }),
      ),
    activated: () => [...active],
  });
}
