// Spec: 0003-toolchain-logical FR-003, FR-004
/**
 * The resolution of tools: each tool wanted, and each tool those need, to the first dialect of the fleet's preference that can carry it out here: it has a binding for the tool on the platform,
 * reaches the platform and the scope, pins at least as exactly as the tool and the fleet's control ask for, meets the control, and does not build from source. A tool that no dialect can
 * carry out is refused with every dialect and the reason it was not chosen.
 *
 * @example
 * ```ts
 * import { resolveTools } from "./resolve.ts";
 * // resolveTools(catalog, [name], dialects, { platform: "linux-x64", preference, integrity: "rolling", systemCopy: "minimum" })
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Controls, DialectId } from "@intellectual-frontiers/archon/governance";
import type { Artifact, Catalog, Platform, Tool, ToolName } from "@intellectual-frontiers/toolchain/governance";
import { meetsIntegrity, pinOfControl, pinRank, type ToolDialect } from "./guarantees.ts";

/** What a resolution is made for. */
export type Context = {
  readonly platform: Platform;
  /** The dialects of the fleet, most preferred first. */
  readonly preference: readonly DialectId[];
  /** The control of the assurance: how strictly tools are pinned. */
  readonly integrity: Controls["toolIntegrity"];
  /** Whether a copy found on the path may be taken at the least version a tool states. */
  readonly systemCopy: "minimum" | "never";
};

/** Where a tool comes from, by the dialect chosen. */
export type Source =
  | { readonly kind: "artifact"; readonly artifact: Artifact }
  | { readonly kind: "package"; readonly packages: readonly string[] };

/** A tool and the dialect chosen for it. */
export type ResolvedTool = { readonly tool: Tool; readonly dialect: DialectId; readonly source: Source };

/** The tools resolved for a platform, in the order of needs. */
export type Resolution = { readonly platform: Platform; readonly entries: readonly ResolvedTool[] };

/** Why a tool was not carried out by a dialect. */
export type NotChosen = { readonly dialect: DialectId; readonly reason: string };

/** Why a resolution could not be made. */
export type ResolveProblem =
  | { readonly kind: "unknown-tool"; readonly tool: string }
  | { readonly kind: "unexpressed"; readonly tool: ToolName; readonly reasons: readonly NotChosen[] };

/** Why a dialect cannot carry out a tool here, or the source if it can. */
function tryDialect(tool: Tool, d: ToolDialect, ctx: Context): { readonly source: Source } | { readonly reason: string } {
  const g = d.guarantees;
  if (g.sourceBuild) return { reason: "it can build from source, and only what a publisher released is installed" };
  if (!g.platforms.includes(ctx.platform)) return { reason: `it cannot reach ${ctx.platform}` };
  if (!g.scopes.includes(tool.scope)) return { reason: `it cannot install in the ${tool.scope} scope` };
  const required = pinRank(tool.pin) > pinRank(pinOfControl(ctx.integrity)) ? tool.pin : pinOfControl(ctx.integrity);
  if (pinRank(g.pin) < pinRank(required)) return { reason: `it pins ${g.pin}, and ${required} is asked for` };
  const unmet = meetsIntegrity(ctx.integrity, g);
  if (unmet.length > 0) return { reason: unmet.join("; ") };
  if (g.binds === "artifact") {
    const binding = tool.bindings.find((b) => b.kind === "artifact");
    const artifact = binding?.kind === "artifact" ? binding.artifacts[ctx.platform] : undefined;
    return artifact === undefined ? { reason: `the tool has no artifact for ${ctx.platform}` } : { source: { kind: "artifact", artifact } };
  }
  const binding = tool.bindings.find((b) => b.kind === "package" && b.dialect === d.id);
  return binding?.kind === "package" ? { source: { kind: "package", packages: binding.packages } } : { reason: `the tool has no package binding for ${d.id}` };
}

/** The tools wanted and the tools they need, each with the dialect and source chosen for it, or every tool that cannot be resolved and why. */
export function resolveTools(catalog: Catalog, wanted: readonly string[], dialects: readonly ToolDialect[], ctx: Context): Result<Resolution, readonly ResolveProblem[]> {
  const problems: ResolveProblem[] = [];
  const needed = new Set<ToolName>();
  const visit = (name: string): void => {
    const tool = [...catalog.tools.values()].find((t) => t.name === name);
    if (tool === undefined) {
      if (!problems.some((p) => p.kind === "unknown-tool" && p.tool === name)) problems.push({ kind: "unknown-tool", tool: name });
      return;
    }
    if (needed.has(tool.name)) return;
    needed.add(tool.name);
    for (const n of tool.needs) visit(n);
  };
  for (const w of wanted) visit(w);

  const entries: ResolvedTool[] = [];
  for (const name of catalog.sequence) {
    if (!needed.has(name)) continue;
    const tool = catalog.tools.get(name);
    if (tool === undefined) continue;
    const reasons: NotChosen[] = [];
    let chosen: ResolvedTool | undefined;
    for (const id of ctx.preference) {
      const d = dialects.find((x) => x.id === id);
      if (d === undefined) {
        reasons.push({ dialect: id, reason: "it is not one of the dialects given" });
        continue;
      }
      const r = tryDialect(tool, d, ctx);
      if ("source" in r) {
        chosen = { tool, dialect: d.id, source: r.source };
        break;
      }
      reasons.push({ dialect: d.id, reason: r.reason });
    }
    if (chosen === undefined) problems.push({ kind: "unexpressed", tool: name, reasons });
    else entries.push(chosen);
  }
  return problems.length > 0 ? err(problems) : ok({ platform: ctx.platform, entries });
}
