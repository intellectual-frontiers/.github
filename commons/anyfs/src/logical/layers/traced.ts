// Spec: 0004-anyfs-middleware FR-002
/**
 * The traced layer: one span for each operation, begun and ended through a tracer the caller gives. A span names the operation and says what the store is, which path, what the outcome was and how many bytes
 * moved; it never holds the bytes or any text of a file. A tracer that throws never fails an operation.
 *
 * @example
 * ```ts
 * import { traced } from "./traced.ts";
 * // const store = traced(inner, tracer)
 * ```
 *
 * @module
 */
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import { type Done, type Op, pathOf } from "../ops.ts";
import { type Carried, carriedCapabilities, makeStore, type Store } from "../store.ts";
import type { Span, Tracer } from "./ports.ts";

/** The number of bytes an operation moved: what it carried, or what it answered with. */
export function bytesOf(op: Op, done: Done | undefined): number | undefined {
  if (done !== undefined) {
    switch (done.op) {
      case "read":
      case "rangeRead":
        return done.value.bytes.length;
      case "stat":
        return done.value.size;
      case "write":
      case "delete":
      case "list":
      case "batch":
      case "rename":
      case "history":
      case "append":
      case "search":
        break;
      default:
        break;
    }
  }
  switch (op.op) {
    case "write":
    case "append":
      return op.bytes.length;
    case "batch":
      return op.changes.reduce((n, c) => n + (c.kind === "put" ? c.bytes.length : 0), 0);
    default:
      return undefined;
  }
}

const safely = <T>(run: () => T): T | undefined => {
  try {
    return run();
  } catch {
    return undefined;
  }
};

/** A store that makes a span for each operation of its argument, and keeps its capabilities. */
export function traced<C extends Capability>(store: Store<C>, tracer: Tracer): Store<Carried<C>> {
  return makeStore({
    id: store.id,
    place: store.place,
    consistency: store.consistency,
    traits: store.traits,
    capabilities: carriedCapabilities(store),
    handle: async (op) => {
      const path = pathOf(op);
      const span: Span | undefined = safely(() => tracer.start(`anyfs.${op.op}`, { "anyfs.store": store.id, "anyfs.op": op.op, ...(path === undefined ? {} : { "anyfs.path": path }) }));
      const r = await store.handle(op);
      const size = bytesOf(op, r.kind === "ok" ? r.value : undefined);
      safely(() => span?.end({ "anyfs.outcome": r.kind === "ok" ? "ok" : r.error.kind, ...(size === undefined ? {} : { "anyfs.bytes": size }) }));
      return r;
    },
  });
}
