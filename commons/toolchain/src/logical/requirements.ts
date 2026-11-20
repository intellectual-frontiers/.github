// Spec: 0003-toolchain-logical FR-006
/**
 * The requirements of Archon for a resolution: one of kind `tool` for each resolved tool, with the id `tool.<name>`, a dependency on the requirement of each tool it needs, and as its desired
 * state data that names the tool, its version, its program, its scope, its phases, the dialect and the source. Archon orders and plans them, and the dialect that was chosen carries them out.
 *
 * @example
 * ```ts
 * import { requirementsFor } from "./requirements.ts";
 * // requirementsFor(resolution, { by: "all" }) is a Result of the requirements of kind tool
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { defineRequirement, type JsonValue, type Requirement, type SubjectSelectorInput } from "@intellectual-frontiers/archon/governance";
import type { Resolution, ResolvedTool, Source } from "./resolve.ts";

function sourceOf(source: Source): JsonValue {
  return source.kind === "artifact"
    ? { kind: "artifact", url: source.artifact.url, sha256: source.artifact.sha256, format: source.artifact.format, bin: source.artifact.bin }
    : { kind: "package", packages: [...source.packages] };
}

function desiredOf(r: ResolvedTool): JsonValue {
  return {
    tool: r.tool.name,
    version: r.tool.version,
    pin: r.tool.pin,
    program: r.tool.program,
    versionArgs: [...r.tool.versionArgs],
    scope: r.tool.scope,
    phases: [...r.tool.phases],
    dialect: r.dialect,
    source: sourceOf(r.source),
  };
}

/** The requirements of kind `tool` for a resolution and a selector of subjects, or every reason one is refused. */
export function requirementsFor(resolution: Resolution, subject: SubjectSelectorInput): Result<readonly Requirement[], readonly string[]> {
  const out: Requirement[] = [];
  const problems: string[] = [];
  for (const r of resolution.entries) {
    const made = defineRequirement({
      id: `tool.${r.tool.name}`,
      summary: `${r.tool.name} ${r.tool.version} is installed (${r.tool.summary})`,
      why: ["a tool the computer needs to do its work (toolchain)"],
      subject,
      kind: "tool",
      desired: desiredOf(r),
      change: "additive",
      dependsOn: r.tool.needs.map((n) => `tool.${n}`),
    });
    if (made.kind === "ok") out.push(made.value);
    else problems.push(...made.error.map((m) => `${r.tool.name}: ${m}`));
  }
  return problems.length > 0 ? err(problems) : ok(out);
}
