// Spec: 0001-change-control-layers FR-001
/**
 * The Logical layer of Change Control: the policy parsed and the range of changes judged.
 *
 * @module
 */
export { allowedSigners, judgeRange, matches, parsePolicy } from "./judge.ts";
export type { Commit, Judgement, Verdict } from "./judge.ts";
