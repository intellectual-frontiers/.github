// Spec: 0001-ergonex FR-012
/**
 * What the commands of `ergonex` share (commons 0001-ergonex FR-012 to FR-016, FR-022): loading the workspace for a command, and the findings a plan's refusals and skips become. A command is declared with `define.ts` and its body returns a `Report` or a `Failure`; these are the parts of that report that more than one command writes.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { type Json, parseJson5 } from "@intellectual-frontiers/formats";
import type { Finding } from "../findings.ts";
import { describeAction, type Plan } from "../plan.ts";
import type { Context, Outcome } from "../modules/types.ts";
import { loadFailureOutcome, loadWorkspace, type Loaded } from "../host/workspace.ts";

/** Runs `f` on the loaded workspace, or gives the outcome that says why it could not be loaded. */
export async function withWorkspace(ctx: Context, f: (loaded: Loaded) => Promise<Outcome>): Promise<Outcome> {
  const loaded = await loadWorkspace(ctx);
  return loaded.kind === "ok" ? await f(loaded.value) : loadFailureOutcome(loaded.error, ctx);
}

/** The findings a plan holds: a refusal is a warning (a person must act), a repository that is locked or has diverged is a warning, and nothing else is a finding. */
export function planFindings(plan: Plan, today: string): readonly Finding[] {
  const out: Finding[] = [];
  for (const a of plan.actions) {
    switch (a.kind) {
      case "Refuse":
        out.push({
          ruleId: `ergonex/${a.why.kind}`,
          severity: "Warning",
          message: describeAction(a),
          subject: a.target,
          firstSeen: today,
        });
        break;
      case "Skip":
        if (a.why.kind === "locked" || a.why.kind === "diverged")
          out.push({
            ruleId: `ergonex/repository-${a.why.kind}`,
            severity: "Warning",
            message: describeAction(a),
            subject: a.target,
            firstSeen: today,
          });
        break;
      case "Clone":
      case "FastForward":
      case "CreateWorktree":
      case "ConfigureRepo":
      case "ConfigureHost":
      case "WriteGenerated":
      case "RemoveGenerated":
      case "InstallTool":
        break;
      default:
        return absurd(a);
    }
  }
  return out;
}

/** Any plain value (what a command computed: numbers, strings, arrays, records) as the JSON a report carries. */
export function jsonOf(value: unknown): Json {
  const text = JSON.stringify(value);
  if (text === undefined) return null;
  const r = parseJson5(text);
  return r.kind === "ok" ? r.value : null;
}
