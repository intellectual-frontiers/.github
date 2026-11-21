// Spec: 0003-anyfs-logical FR-004
/**
 * Attenuation: a store given to a program is made smaller before it is given. `readOnly` takes away every capability that changes anything, `sub` shows only what is below a prefix, and `only` keeps the
 * capabilities named. Each makes a store of a type that has no more than its argument, and each can only narrow: there is no function here that gives a store a capability it did not have. A program that
 * holds a store has no other way to the place, because a store has no ambient file system behind it.
 *
 * @example
 * ```ts
 * import { readOnly, sub } from "./attenuate.ts";
 * // const fleet = readOnly(sub(root, prefix)): reads below `prefix` and nothing else
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Capability, type Path, type Prefix, parsePath, parsePrefix, type Problem, refused, relativeTo } from "@intellectual-frontiers/anyfs/governance";
import { mapDone, mapOp, mapProblem, type PathMap } from "./remap.ts";
import { type AnyStore, type Carried, capabilitiesWithout, carriedCapabilities, makeStore, type OpCapability, type Store } from "./store.ts";

/** The capabilities that change something. */
export const MUTATING_CAPABILITIES = ["write", "delete", "batch", "rename", "append", "lock"] as const;
/** One capability that changes something. */
export type MutatingCapability = (typeof MUTATING_CAPABILITIES)[number];

/** A store with none of the capabilities of its argument that change anything. */
export function readOnly<C extends Capability>(store: Store<C>): Store<Exclude<C, MutatingCapability | "watch" | "lock">> {
  return makeStore({
    id: `${store.id}#read-only`,
    place: store.place,
    consistency: store.consistency,
    traits: store.traits,
    capabilities: capabilitiesWithout(store, MUTATING_CAPABILITIES),
    handle: store.handle,
  });
}

/** A store with only the capabilities named, which the argument has: the compiler refuses a capability it lacks. */
export function only<C extends Capability, K extends C & OpCapability>(store: Store<C>, capabilities: readonly K[]): Store<K> {
  return makeStore({
    id: `${store.id}#only`,
    place: store.place,
    consistency: store.consistency,
    traits: store.traits,
    capabilities: capabilities.filter((c) => store.capabilities.has(c)),
    handle: store.handle,
  });
}

/** A store of the capabilities named, from a store whose type does not say them (one a function was given as any store): the store has them, or the answer says which it lacks. */
export function view<D extends OpCapability>(store: AnyStore, capabilities: readonly D[]): Result<Store<D>, string> {
  const lacking = capabilities.filter((c) => !store.capabilities.has(c));
  if (lacking.length > 0) return err(`${store.id} does not have ${lacking.join(", ")}`);
  return ok(
    makeStore({
      id: store.id,
      place: store.place,
      consistency: store.consistency,
      traits: store.traits,
      capabilities,
      handle: store.handle,
    }),
  );
}

const join = (prefix: Prefix, text: string): string => (prefix === "" ? text : `${prefix}/${text}`);

function lowerPath(prefix: Prefix, path: Path): Result<Path, Problem> {
  const r = relativeTo(prefix, path);
  return r === undefined ? err(refused("outside-scope", `the store answered with ${path}, which is not below ${prefix}`)) : ok(r);
}

/** A store of only what is below a prefix of its argument: every path is below the prefix and none can name the way out of it. It has the capabilities of its argument that have an operation. */
export function sub<C extends Capability>(store: Store<C>, prefix: Prefix): Store<Carried<C>> {
  const into: PathMap = {
    path: (path) => {
      const p = parsePath(join(prefix, path));
      return p.kind === "ok" ? p : err(refused("too-large", p.error, path));
    },
    prefix: (inner) => {
      if (inner === "") return ok(prefix);
      const p = parsePrefix(join(prefix, inner));
      return p.kind === "ok" ? p : err(refused("too-large", p.error));
    },
  };
  const out: PathMap = { path: (path) => lowerPath(prefix, path), prefix: (p) => ok(p) };
  return makeStore({
    id: `${store.id}#${prefix === "" ? "root" : prefix}`,
    place: store.place,
    consistency: store.consistency,
    traits: store.traits,
    capabilities: carriedCapabilities(store),
    handle: async (op) => {
      const lifted = mapOp(into, op);
      if (lifted.kind === "err") return lifted;
      const done = await store.handle(lifted.value);
      if (done.kind === "err") return err(mapProblem((p) => relativeTo(prefix, p) ?? p, done.error));
      return mapDone(out, done.value);
    },
  });
}
