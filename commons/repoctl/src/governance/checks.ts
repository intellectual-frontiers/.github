// Spec: 0002-repoctl-governance FR-006
/**
 * The checks of `repoctl check` that are not generators, declared once as data (commons repoctl 0002-repoctl-governance FR-006): the programs of commons that judge the repository and the problem code a finding of each is
 * reported with. The checks of the generated files are the generators' own (`generators.ts`), the check of the version constants and the checks of the specification kit of each library are made by Repoctl from the manifests.
 *
 * @example
 * ```ts
 * import { CHECKS } from "./checks.ts";
 * CHECKS.map((c) => c.id); // ["specs", "rules", "versions"]
 * ```
 *
 * @module
 */
import type { ProblemCode } from "./problems.ts";

/** The name of every check that runs a program of the repository once: a closed union. */
export type CheckId = "specs" | "rules" | "versions";

/** A check: the program, the code of its findings and the problem it is when it ends with 1. */
export type Check = {
  readonly id: CheckId;
  readonly summary: string;
  /** The arguments of `bun`, from the repository's root. */
  readonly command: readonly string[];
  readonly code: ProblemCode;
};

/** Every check of the repository that is one program, in the order they are reported. */
export const CHECKS: readonly Check[] = [
  { id: "specs", summary: "The format of the specification kit of commons.", command: ["commons/tools/mizan-check.ts"], code: "E-SPEC-KIT" },
  { id: "rules", summary: "The rules Mizan adds to the format, held by the baseline that only shrinks.", command: ["commons/libraries/src/check.ts"], code: "E-MIZAN-RULE" },
  { id: "versions", summary: "The version records: a record that is wrong, an identity that changed and a version that went back.", command: ["commons/libraries/src/versions.ts", "check"], code: "E-VERSIONS" },
];
