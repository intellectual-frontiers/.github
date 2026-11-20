// Spec: 0002-repoctl-governance FR-005
/**
 * The generators of a repository, declared in its configuration as data (commons repoctl 0002-repoctl-governance FR-005; 0009-repoctl-config FR-003): each is a program (or a typed function) that makes files from sources and checks that they are what
 * it makes, with the globs of what it reads and of what it writes and the generators it declares to come after. `repoctl sync` runs them in the order those facts give, `repoctl merge` knows a generated file by them and `repoctl check` runs each one's check.
 *
 * @example
 * ```ts
 * import type { Generator } from "./generators.ts";
 * const g: Pick<Generator, "outputs"> = { outputs: ["README.md"] };
 * g.outputs; // ["README.md"]
 * ```
 *
 * @module
 */
import type { StepId } from "./ids.ts";

/** How a step ended: the status (0 it is as it should be, 1 it is not, anything else it could not run) and what it said. */
export type StepRun = { readonly code: number; readonly stdout: string; readonly stderr: string };

/** What a typed step is given: the repository's root, as an absolute path. */
export type StepContext = { readonly repo: string };

/** A step that is a typed function in the configuration, in place of a program. */
export type StepFunction = (context: StepContext) => Promise<StepRun>;

/** A step: the argument vector of a program run from the repository's root (no shell between), or a typed function. */
export type Step = { readonly kind: "program"; readonly argv: readonly string[] } | { readonly kind: "function"; readonly call: StepFunction; readonly label: string };

/** A generator: what it is, how it makes its files and checks them, and what it reads and writes. */
export type Generator = {
  readonly id: StepId;
  readonly summary: string;
  /** Makes the files. */
  readonly run: Step;
  /** Writes nothing and ends with 0 where the files are what `run` makes and with 1 where they are not. */
  readonly check: Step;
  /** What it reads, as globs from the repository's root (`*` is one segment's characters, `**` any number of segments). */
  readonly inputs: readonly string[];
  /** What it writes, as globs from the repository's root. */
  readonly outputs: readonly string[];
  /** The generators it comes after, besides those whose outputs it reads. */
  readonly after: readonly StepId[];
  /** The outputs (globs, a subset of `outputs`) that also hold text a person wrote and that the generator leaves as it finds it, so that a merge keeps the lines of both sides of them before it makes the generated part again. */
  readonly mixed: readonly string[];
};

/** The command that makes a step's files again, as a person types it. */
export function stepText(step: Step): string {
  return step.kind === "program" ? step.argv.join(" ") : step.label;
}
