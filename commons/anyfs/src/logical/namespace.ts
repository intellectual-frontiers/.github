// Spec: 0003-anyfs-logical FR-005
/**
 * A namespace: many stores mounted at prefixes and seen as one. A path is resolved to the store of the longest prefix that holds it, with the path below the prefix; a list across mounts merges the lists in the
 * order of the paths and hides what a mount at a longer prefix covers. Mounts are values in code, never a table read from a file, and an operation that would cross two mounts (a rename, a batch) is refused,
 * because no store can make it as one change.
 *
 * @example
 * ```ts
 * import { emptyNamespace, mount } from "./namespace.ts";
 * // const ns = mount(mount(emptyNamespace, fleetPrefix, fleetStore), secretsPrefix, secretsStore)
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { comparePaths, type Cursor, isUnder, parseCursor, parsePath, type Path, type Prefix, type Problem, refused, relativePrefix, relativeTo, ROOT, unavailable } from "@intellectual-frontiers/anyfs/governance";
import type { Change, Done, Handler, Op, Stat } from "./ops.ts";
import { mapDone, mapOp, mapProblem, type PathMap } from "./remap.ts";
import { type AnyStore, makeStore, type OpCapability, type Store } from "./store.ts";

/** A store mounted at a prefix. */
export type Mount = { readonly prefix: Prefix; readonly store: AnyStore };
/** The mounts of a namespace, the longest prefix first. */
export type Namespace = { readonly mounts: readonly Mount[] };

/** A namespace with no mount. */
export const emptyNamespace: Namespace = { mounts: [] };

/** A namespace with one more mount, or why it cannot: a prefix holds one mount. */
export function mount(ns: Namespace, prefix: Prefix, store: AnyStore): Result<Namespace, string> {
  if (ns.mounts.some((m) => m.prefix === prefix)) return err(`${prefix === "" ? "the root" : prefix} already has a mount`);
  const mounts = [...ns.mounts, { prefix, store }].sort((a, b) => b.prefix.length - a.prefix.length || comparePaths(a.prefix, b.prefix));
  return ok({ mounts });
}

/** The mount that holds a path and the path below its prefix, or the refusal where no mount holds it. */
export function resolve(ns: Namespace, path: Path): Result<{ readonly mount: Mount; readonly path: Path }, Problem> {
  for (const m of ns.mounts) {
    if (isUnder(m.prefix, path)) {
      const inner = relativeTo(m.prefix, path);
      if (inner !== undefined) return ok({ mount: m, path: inner });
    }
  }
  return err(refused("outside-scope", "no store is mounted where this path is", path));
}

const outer = (prefix: Prefix, path: Path): Result<Path, Problem> => {
  const p = parsePath(prefix === "" ? path : `${prefix}/${path}`);
  return p.kind === "ok" ? p : err(refused("too-large", p.error, path));
};

const PAGE = 1000;

/** The namespace as one store of the capabilities given, which every mount has: or the capability a mount lacks. Search is not made across mounts. */
export function asStore<C extends OpCapability>(ns: Namespace, id: string, capabilities: readonly C[]): Result<Store<C>, string> {
  if (ns.mounts.length === 0) return err("a namespace with no mount has no store");
  for (const c of capabilities) {
    if (c === "search") return err("a search is not made across mounts: ask the store of one");
    if (c === "merge") return err("a merge is not made across mounts: ask the store of one");
    const lacking = ns.mounts.find((m) => !m.store.capabilities.has(c));
    if (lacking !== undefined) return err(`${lacking.prefix === "" ? "the root mount" : lacking.prefix} does not have ${c}`);
  }
  const first = ns.mounts[0];
  if (first === undefined) return err("a namespace with no mount has no store");
  const weakest = ns.mounts.some((m) => m.store.consistency === "eventual-listing") ? "eventual-listing" : ns.mounts.some((m) => m.store.consistency === "read-your-writes") ? "read-your-writes" : "strong";

  const single = async (mountOf: Mount, op: Op): Promise<Result<Done, Problem>> => {
    const strip: PathMap = {
      path: (p) => {
        const r = relativeTo(mountOf.prefix, p);
        return r === undefined ? err(refused("outside-scope", `${p} is not below ${mountOf.prefix}`, p)) : ok(r);
      },
      prefix: (p) => ok(p),
    };
    const add: PathMap = { path: (p) => outer(mountOf.prefix, p), prefix: (p) => ok(p) };
    const inner = mapOp(strip, op);
    if (inner.kind === "err") return inner;
    const done = await mountOf.store.handle(inner.value);
    if (done.kind === "err") {
      const toOuter = (p: Path): Path => {
        const o = outer(mountOf.prefix, p);
        return o.kind === "ok" ? o.value : p;
      };
      return err(mapProblem(toOuter, done.error));
    }
    return mapDone(add, done.value);
  };

  const sameMount = (paths: readonly Path[]): Result<Mount, Problem> => {
    let found: Mount | undefined;
    for (const p of paths) {
      const r = resolve(ns, p);
      if (r.kind === "err") return r;
      if (found !== undefined && found !== r.value.mount) return err(refused("outside-scope", `the paths of one operation are in two mounts (${found.prefix || "root"} and ${r.value.mount.prefix || "root"}), and no store makes it as one`, p));
      found = r.value.mount;
    }
    return found === undefined ? err(refused("outside-scope", "the operation names no path")) : ok(found);
  };

  const list = async (op: Extract<Op, { op: "list" }>): Promise<Result<Done, Problem>> => {
    const p = op.prefix;
    const covers = (m: Prefix): boolean => relativePrefix(m, p) !== undefined;
    const inside = (m: Prefix): boolean => relativePrefix(p, m) !== undefined;
    const entries: Stat[] = [];
    for (const m of ns.mounts) {
      if (!covers(m.prefix) && !inside(m.prefix)) continue;
      const innerPrefix = relativePrefix(m.prefix, p) ?? ROOT;
      let after: Cursor | undefined;
      for (;;) {
        const page = await m.store.handle({ op: "list", prefix: innerPrefix, limit: PAGE, ...(after === undefined ? {} : { after }) });
        if (page.kind === "err") return err(page.error);
        if (page.value.op !== "list") return err(unavailable("a store answered a list with something else", false));
        for (const e of page.value.value.entries) {
          const o = outer(m.prefix, e.path);
          if (o.kind === "err") return o;
          const r = resolve(ns, o.value);
          if (r.kind === "ok" && r.value.mount === m) entries.push({ ...e, path: o.value });
        }
        after = page.value.value.next;
        if (after === undefined) break;
      }
    }
    entries.sort((a, b) => comparePaths(a.path, b.path));
    let from = 0;
    if (op.after !== undefined) {
      const last = decodeURIComponent(op.after);
      from = entries.findIndex((e) => comparePaths(e.path, last) > 0);
      if (from < 0) from = entries.length;
    }
    const limit = Math.min(op.limit ?? PAGE, 10000);
    const page = entries.slice(from, from + limit);
    const lastEntry = page[page.length - 1];
    if (from + limit < entries.length && lastEntry !== undefined) {
      const next = parseCursor(encodeURIComponent(lastEntry.path));
      if (next.kind === "err") return err(unavailable(next.error, false));
      return ok({ op: "list", value: { entries: page, next: next.value } });
    }
    return ok({ op: "list", value: { entries: page } });
  };

  const handle: Handler = async (op) => {
    switch (op.op) {
      case "list":
        return list(op);
      case "batch": {
        const m = sameMount(op.changes.map((c: Change) => c.path));
        return m.kind === "err" ? m : single(m.value, op);
      }
      case "rename": {
        const m = sameMount([op.from, op.to]);
        return m.kind === "err" ? m : single(m.value, op);
      }
      case "search":
        return err(refused("capability-absent", "a search is not made across mounts"));
      case "merge":
        return err(refused("capability-absent", "a merge is not made across mounts"));
      case "read":
      case "write":
      case "stat":
      case "delete":
      case "history":
      case "rangeRead":
      case "append": {
        const r = resolve(ns, op.path);
        return r.kind === "err" ? r : single(r.value.mount, op);
      }
      default:
        return err(unavailable("an operation of no known kind", false));
    }
  };
  return ok(makeStore({ id, place: first.store.place, consistency: weakest, traits: first.store.traits, capabilities, handle }));
}
