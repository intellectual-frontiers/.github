// Spec: 0003-anyfs-cli-logical FR-008, FR-009
/**
 * What a verb says of how it did its work (commons anyfs-cli 0003-anyfs-cli-logical FR-008, FR-009): every operation of the POSIX view of a store ends with its fidelity (native, emulated with a risk, or refused), and a
 * verb keeps each in a trail. At the end the trail is a verdict: with `--strict` any operation that the library carried out by a means that can lose or change what was meant is a problem (`E-STRICT`), and with
 * `-v` the emulations are written as lines so that nothing is pretended silently.
 *
 * @example
 * ```ts
 * import { newTrail } from "./trail.ts";
 * const trail = newTrail();
 * trail.steps.length; // 0
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { describeErrno, describeFidelity, isStrictViolation, type Fidelity, type Outcome, type PosixError } from "@intellectual-frontiers/anyfs-posix/governance";

/** One step: the operation, the path it was about, and how it was carried out. */
export type Step = { readonly op: string; readonly path: string; readonly fidelity: Fidelity; readonly notes: readonly string[] };

/** The steps of a verb, in order. */
export type Trail = { readonly steps: Step[] };

/** An empty trail. */
export function newTrail(): Trail {
  return { steps: [] };
}

/** A failed operation as a sentence: its errno in words, the path and what the store said. */
export function describeFailure(e: PosixError): string {
  const where = e.path === undefined ? "" : ` ${e.path}`;
  const store = e.problem === undefined ? "" : ` (${e.problem.kind})`;
  return `${e.errno}${where}: ${e.message}${store}; ${describeErrno(e.errno)}`;
}

/** Keeps the fidelity of an operation, and gives its value, or the error it ended with. */
export function keep<T>(trail: Trail, op: string, path: string, done: Result<Outcome<T>, PosixError>): Result<T, PosixError> {
  if (done.kind === "ok") {
    trail.steps.push({ op, path, fidelity: done.value.fidelity, notes: done.value.notes });
    return ok(done.value.value);
  }
  trail.steps.push({ op, path, fidelity: done.error.fidelity, notes: [] });
  return err(done.error);
}

/** The steps a program that asks for strictness stops at. */
export function strictViolations(trail: Trail): readonly Step[] {
  return trail.steps.filter((s) => isStrictViolation(s.fidelity));
}

/** The steps that were not native, once each (an operation on many files is one line), in the order met. */
export function emulatedLines(trail: Trail): readonly string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const s of trail.steps) {
    if (s.fidelity.kind === "native") continue;
    const line = `${s.op}: ${describeFidelity(s.fidelity)}`;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines;
}
