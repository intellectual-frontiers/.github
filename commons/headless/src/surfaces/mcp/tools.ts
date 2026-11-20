// Spec: 0013-mcp-surface FR-001, FR-002, FR-005
/**
 * The tools of a tool server, generated from governance (commons headless 0013-mcp-surface FR-001): one tool for each command of the program that the caller's tier may see, that may come through
 * the `mcp` channel and that is not for a person alone, with a JSON Schema made from the command's options and operands and the hints a client needs (`readOnlyHint`, `destructiveHint`,
 * `idempotentHint`). Pure: the same program and tier give the same tools, in the order of the tree.
 *
 * @remarks
 * What a person alone may give (`humanOnly` options) is absent from the schema, so is every standard option of the command line but `--dry-run` and `--check` (the surface decides the rest: it never asks, takes no
 * `--yes`, and wants the JSON document); the schema and the argument vector are the logical layer's (`machine-args`), shared with the REST surface.
 *
 * @example
 * ```ts
 * import { toolName } from "./tools.ts";
 * toolName("archon", ["server", "dry-list"]); // "archon_server_dry_list"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type TierName } from "@intellectual-frontiers/headless/governance";
import { offeredOptions, placedCommands, schemaOfOption, visibleProgram, type ArgSchema, type Placed, type Program } from "@intellectual-frontiers/headless/logical";

/** A tool, as `tools/list` returns it. */
export type McpTool = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties: { readonly [argument: string]: ArgSchema };
    readonly required: readonly string[];
    readonly additionalProperties: false;
  };
  readonly annotations: { readonly readOnlyHint: boolean; readonly destructiveHint: boolean; readonly idempotentHint: boolean; readonly openWorldHint: boolean };
};

/** The name of the tool of a command: the program's name and its words joined by underscores (`archon_server_list`). */
export function toolName(program: string, path: readonly string[]): string {
  return [program, ...path].join("_").replace(/[^A-Za-z0-9_]/g, "_");
}

/** Whether a command may be a tool: it may come through the `mcp` channel and it is not for a person alone. */
export function listable(p: Placed): boolean {
  return p.reach !== undefined && p.reach.channels.includes("mcp") && p.facts.audience !== "human";
}

/** The tool of one command. */
export function toolOf(program: string, p: Placed): McpTool {
  const properties: Record<string, ArgSchema> = {};
  const required: string[] = [];
  for (const [key, o] of Object.entries(offeredOptions(p))) {
    properties[key] = schemaOfOption(o);
    if (o.kind === "value" && o.fallback.kind === "required") required.push(key);
  }
  for (const operand of p.command.operands) {
    properties[operand.name] = operand.arity === "many" ? { type: "array", items: { type: "string" }, description: operand.help } : { type: "string", description: operand.help };
    if (operand.arity === "one" || operand.arity === "many") required.push(operand.name);
  }
  return {
    name: toolName(program, p.path),
    title: `${program} ${p.id}`,
    description: `${p.command.summary} (${p.facts.kind}, effect ${p.facts.effect}${p.facts.idempotent ? ", safe to repeat" : ""}.)`,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    annotations: { readOnlyHint: p.facts.effect === "read", destructiveHint: p.facts.effect === "destructive", idempotentHint: p.facts.idempotent, openWorldHint: false },
  };
}

/** A tool and the command it is of. */
export type Served = { readonly tool: McpTool; readonly placed: Placed };

/** What is wrong with the tools of a program. */
export type ToolProblem = { readonly rule: "mcp/name-collision"; readonly name: string; readonly ids: readonly string[] };

/** The tools a caller of a tier is served, each with its command, or the names that two commands would share. */
export function served(program: Program, tier: TierName): Result<readonly Served[], readonly ToolProblem[]> {
  const seen = visibleProgram(program, tier);
  const all = placedCommands(seen.children).filter(listable).map((placed): Served => ({ tool: toolOf(program.name, placed), placed }));
  const byName = new Map<string, string[]>();
  for (const s of all) byName.set(s.tool.name, [...(byName.get(s.tool.name) ?? []), s.placed.id]);
  const problems = [...byName.entries()].filter(([, ids]) => ids.length > 1).map(([name, ids]): ToolProblem => ({ rule: "mcp/name-collision", name, ids }));
  return problems.length > 0 ? err(problems) : ok(all);
}
