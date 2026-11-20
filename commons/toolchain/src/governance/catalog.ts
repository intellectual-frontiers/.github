// Spec: 0002-toolchain-governance FR-007
/**
 * A catalog: the tools of a fleet or a work, each once, with every need among them and no cycle, in an order where each tool comes after the tools it needs. It is the one place a pin and a hash
 * are written.
 *
 * @example
 * ```ts
 * import { defineCatalog } from "./catalog.ts";
 * // defineCatalog([jq, git]) is a Result of a catalog in the order of needs
 * ```
 *
 * @module
 */
import { err, ok, order, type Result } from "@intellectual-frontiers/core";
import type { ToolName } from "./ids.ts";
import type { Tool } from "./tool.ts";

/** A catalog. */
export type Catalog = {
  readonly tools: ReadonlyMap<ToolName, Tool>;
  /** The names in an order where each comes after the tools it needs. */
  readonly sequence: readonly ToolName[];
};

/** A catalog from tools, or every reason it is not one. */
export function defineCatalog(tools: readonly Tool[]): Result<Catalog, readonly string[]> {
  const problems: string[] = [];
  const byName = new Map<ToolName, Tool>();
  for (const t of tools) {
    if (byName.has(t.name)) problems.push(`the tool ${t.name} is in the catalog twice`);
    byName.set(t.name, t);
  }
  const providers = new Map<string, ToolName>();
  for (const t of byName.values()) {
    for (const n of t.needs) if (!byName.has(n)) problems.push(`${t.name} needs ${n}, which is not in the catalog`);
    for (const p of [t.program, ...t.provides, ...t.alsoNamed]) {
      const other = providers.get(p);
      if (other !== undefined && other !== t.name) problems.push(`the program ${p} is provided by ${other} and by ${t.name}`);
      providers.set(p, t.name);
    }
  }
  const graph = new Map<ToolName, readonly ToolName[]>();
  for (const t of byName.values()) graph.set(t.name, t.needs);
  const sequence = order(graph);
  if (sequence.kind === "err") problems.push(`the needs of ${sequence.error.nodes.join(", ")} are a cycle`);
  if (problems.length > 0 || sequence.kind === "err") return err(problems);
  return ok({ tools: byName, sequence: sequence.value });
}
