// Spec: 0002-repoctl-governance FR-006
/**
 * The checks of `repoctl check` that are not generators, declared in a repository's configuration as data (commons repoctl 0002-repoctl-governance FR-006; 0009-repoctl-config FR-003): a named program that judges the repository, the sentence that
 * names it and the problem code a finding of it is reported with. The checks of the generated files are the generators' own (`generators.ts`).
 *
 * @example
 * ```ts
 * import type { Check } from "./checks.ts";
 * const c: Pick<Check, "code"> = { code: "E-CHECK-FAILED" };
 * c.code; // "E-CHECK-FAILED"
 * ```
 *
 * @module
 */
import type { StepId } from "./ids.ts";
import type { ProblemCode } from "./problems.ts";
import type { Step } from "./generators.ts";

/** A check: the program (or typed function), the code of its findings. It ends with 0 where nothing is wrong, with 1 where something is, and its lines are the findings. */
export type Check = {
  readonly id: StepId;
  readonly summary: string;
  readonly run: Step;
  readonly code: ProblemCode;
};
