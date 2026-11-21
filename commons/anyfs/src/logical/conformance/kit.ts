// Spec: 0005-anyfs-conformance FR-001
/**
 * The small kit the cases are written with: a failure that says what differed, the bytes of a text, the paths and revisions a case names, and the narrowing of a store to the capabilities a case needs. The
 * kit imports nothing outside the library, so the suite can run in the tests of any backend.
 *
 * @module
 */
import { type Capability, CORE_CAPABILITIES, type CoreCapability, parsePath, type Path, type Problem, describeProblem, type Revision } from "@intellectual-frontiers/anyfs/governance";
import type { Result } from "@intellectual-frontiers/core";
import { view } from "../attenuate.ts";
import type { OpCapability, Store } from "../store.ts";

/** What a case runs against: a function that makes a new, empty store of at least the core capabilities. */
export type Make = () => Promise<Store<CoreCapability>>;

/** A case: its id, what it says, the capabilities it needs and the code. */
export type Case = {
  readonly id: string;
  readonly title: string;
  readonly needs: readonly Capability[];
  readonly run: (make: Make) => Promise<void>;
};

/** A case failed: the sentence says what differed. */
export class ConformanceFailure extends Error {
  /** The failure, with the id of the case in front. */
  constructor(message: string) {
    super(message);
    this.name = "ConformanceFailure";
  }
}

/** Fails with a sentence unless the condition holds. */
export function expect(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ConformanceFailure(message);
}

/** Fails unless two values are the same by their JSON. */
export function same(actual: unknown, expected: unknown, what: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new ConformanceFailure(`${what}: expected ${b}, got ${a}`);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
/** The bytes of a text. */
export const bytes = (text: string): Uint8Array => encoder.encode(text);
/** The text of some bytes. */
export const text = (b: Uint8Array): string => decoder.decode(b);

/** A path the case names: a parse that cannot fail for the paths written in the suite. */
export function pathOf(source: string): Path {
  const r = parsePath(source);
  if (r.kind === "err") throw new ConformanceFailure(`the suite names ${JSON.stringify(source)}, which is not a path: ${r.error}`);
  return r.value;
}

/** The value of a result that must be `ok`, or a failure that says what the store said. */
export function good<T>(r: Result<T, Problem>, what: string): T {
  if (r.kind === "err") throw new ConformanceFailure(`${what}: expected ok, the store said ${describeProblem(r.error)}`);
  return r.value;
}

/** The problem of a result that must be an error of a kind, or a failure. */
export function bad<T>(r: Result<T, Problem>, kind: Problem["kind"], what: string): Problem {
  if (r.kind === "ok") throw new ConformanceFailure(`${what}: expected ${kind}, the store did it`);
  if (r.error.kind !== kind) throw new ConformanceFailure(`${what}: expected ${kind}, the store said ${describeProblem(r.error)}`);
  return r.error;
}

/** The store as a store of the capabilities named (and the core ones), or a failure: a case that needs one is only run for a store that has it. */
export function withCapabilities<D extends OpCapability>(store: Store<CoreCapability>, ...needed: readonly D[]): Store<CoreCapability | D> {
  const v = view(store, [...CORE_CAPABILITIES, ...needed]);
  if (v.kind === "err") throw new ConformanceFailure(`the case needs ${needed.join(", ")}: ${v.error}`);
  return v.value;
}

/** A revision the case holds: for a comparison, never made up. */
export type Held = Revision;
