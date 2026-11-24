// Spec: 0005-anyfs-posix-conformance FR-001
/**
 * The small kit the cases of the suite are written with: a failure that says what differed, the bytes of a text, and the reading of an outcome, an error and a fidelity. The kit imports nothing but the types
 * of the library, so the suite can run in the tests of any store that has a view.
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import type { OpName } from "../store-ops.ts";
import type { Errno, Fidelity, Outcome, PosixError } from "@intellectual-frontiers/anyfs-posix/governance";
import type { Posix } from "../posix.ts";

/** What a case runs against: a new, empty view, and where the store allows it the operations the store was asked for since the last reset. */
export type World = {
  readonly posix: Posix;
  /** The operations of the store since the last reset, where the world records them. */
  readonly trace?: () => readonly OpName[];
  readonly reset?: () => void;
};

/** What a case is given: a function that makes a new world. */
export type Make = () => Promise<World>;

/** A case: its id, what it says, the capabilities the store must have and must not have, whether it needs a trace, and the code. */
export type Case = {
  readonly id: string;
  readonly title: string;
  readonly needs: readonly Capability[];
  readonly lacks: readonly Capability[];
  readonly traced: boolean;
  readonly run: (make: Make) => Promise<void>;
};

/** A case failed: the sentence says what differed. */
export class ConformanceFailure extends Error {
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

/** The outcome of a result that must be `ok`, or a failure that says what the view said. */
export function good<T>(r: Result<Outcome<T>, PosixError>, what: string): Outcome<T> {
  if (r.kind === "err") throw new ConformanceFailure(`${what}: expected ok, the view said ${r.error.errno}: ${r.error.message}`);
  return r.value;
}

/** The error of a result that must be an error of a code, or a failure. */
export function bad(r: Result<unknown, PosixError>, errno: Errno, what: string): PosixError {
  if (r.kind === "ok") throw new ConformanceFailure(`${what}: expected ${errno}, the view did it`);
  if (r.error.errno !== errno) throw new ConformanceFailure(`${what}: expected ${errno}, the view said ${r.error.errno}: ${r.error.message}`);
  return r.error;
}

/** Fails unless a fidelity is of a kind and, for an emulation or a refusal, of a reason. */
export function fidelityIs(f: Fidelity, kind: Fidelity["kind"], reason: string | undefined, what: string): void {
  if (f.kind !== kind) throw new ConformanceFailure(`${what}: expected ${kind}, got ${f.kind}${f.kind === "native" ? "" : ` (${f.reason})`}`);
  if (reason !== undefined && f.kind !== "native" && f.reason !== reason) throw new ConformanceFailure(`${what}: expected the reason ${reason}, got ${f.reason}`);
}

/** The names of a directory as `name` for a file and `name/` for a directory. */
export function names(entries: readonly { readonly name: string; readonly type: "file" | "dir" }[]): readonly string[] {
  return entries.map((e) => (e.type === "dir" ? `${e.name}/` : e.name));
}
