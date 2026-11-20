// Spec: 0003-toolchain-logical FR-005
/**
 * The plan of tools: for each resolved tool and what is observed of it, whether it is as pinned (`none`), absent (`install`) or different (`replace`). A copy found on the path counts only where the
 * policy allows a system copy and the fleet does not ask for exact, hashed tools, and then at the least version the tool states (the version of its pin where it states none); a copy of the store or
 * of a manager counts at the pinned version only, and any version counts where nothing pins one.
 *
 * @example
 * ```ts
 * import { planTools } from "./plan.ts";
 * // planTools(resolution, new Map(), context) gives an entry `install` for each resolved tool
 * ```
 *
 * @module
 */
import type { DialectId } from "@intellectual-frontiers/archon/governance";
import { compareVersions, type ToolName } from "@intellectual-frontiers/toolchain/governance";
import type { Context, Resolution } from "./resolve.ts";

/** Where an installed copy of a tool was found. */
export type Found = "path" | "store" | "manager";

/** What is observed of one tool. */
export type ObservedTool = { readonly version: string; readonly from: Found };

/** What is observed of the tools of a computer, by name; a tool with no entry is absent. */
export type ObservedTools = ReadonlyMap<ToolName, ObservedTool>;

/** What must be done about a tool. */
export type ToolAction = "none" | "install" | "replace";

/** One entry of the plan. */
export type ToolPlanEntry = {
  readonly tool: ToolName;
  /** The version it is carried out at; none where nothing pins one. */
  readonly version: string | undefined;
  readonly dialect: DialectId;
  readonly action: ToolAction;
  readonly observed: ObservedTool | undefined;
};

/** The plan of tools. */
export type ToolPlan = { readonly platform: string; readonly entries: readonly ToolPlanEntry[] };

/** What the rule that decides an action reads. */
export type ActionInput = {
  readonly seen: ObservedTool | undefined;
  /** The version the tool is carried out at; none where nothing pins one. */
  readonly version: string | undefined;
  /** The least version of a copy found on the path that may be taken. */
  readonly minimum: string | undefined;
  readonly systemCopy: Context["systemCopy"];
  readonly integrity: Context["integrity"];
};

/** The action for one tool: absent is `install`; a copy on the path counts only where the policy allows a system copy and the fleet does not ask for exact, hashed tools, and then at the least version (the pinned version where none is stated); a copy of the store or of a manager counts at the pinned version only, and any version counts where nothing pins one. The one rule, used by the plan and by the dialects. */
export function actionFor(i: ActionInput): ToolAction {
  if (i.seen === undefined) return "install";
  if (i.seen.from === "path") {
    const floor = i.minimum ?? i.version;
    const allowed = i.systemCopy === "minimum" && i.integrity !== "exact-hashed";
    return allowed && (floor === undefined || compareVersions(i.seen.version, floor) >= 0) ? "none" : "replace";
  }
  return i.version === undefined || compareVersions(i.seen.version, i.version) === 0 ? "none" : "replace";
}

/** The plan for a resolution and what is observed. */
export function planTools(resolution: Resolution, observed: ObservedTools, ctx: Context): ToolPlan {
  const entries = resolution.entries.map((r): ToolPlanEntry => {
    const seen = observed.get(r.tool.name);
    const action = actionFor({ seen, version: r.version, minimum: r.tool.minimum, systemCopy: ctx.systemCopy, integrity: ctx.integrity });
    return { tool: r.tool.name, version: r.version, dialect: r.dialect, action, observed: seen };
  });
  return { platform: resolution.platform, entries };
}
