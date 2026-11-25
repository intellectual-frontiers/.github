// Spec: 0006-workbench-dialects FR-001, FR-006
/**
 * The dialect of Codex: the one thing every harness reads, `AGENTS.md`, carries the contract, with `workbench ready` as the first command to run, and a gate is a stop the agent is told of in words. Approval and sandbox settings
 * are the operator's choice in the harness's own configuration and are not generated here: the format is checked against the harness's current documentation before a dialect writes it, and until then this dialect only carries.
 *
 * @module
 */
import type { Contract, Requirement } from "@intellectual-frontiers/workbench/governance";
import { agentsBlock, type Dialect, type Disposition, type RenderedFile, spliceBlock } from "@intellectual-frontiers/workbench/logical";

function express(r: Requirement): Disposition {
  return r.kind === "authority"
    ? { kind: "unexpressed", reason: `the gate ${r.gate} needs a person`, needsPerson: true }
    : { kind: "carried", how: "the first command of AGENTS.md is `workbench ready`" };
}

/** The dialect. */
export const dialect: Dialect = { name: "codex", holder: "agent", express: (r, _c) => express(r) };

/** The files the dialect makes: the generated block of `AGENTS.md`, put into the file it is given. */
export function render(contract: Contract, existing = ""): readonly RenderedFile[] {
  return [{ path: "AGENTS.md", text: spliceBlock(existing, agentsBlock(contract)) }];
}
