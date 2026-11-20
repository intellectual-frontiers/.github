// Spec: 0003-toolchain-logical FR-006
/**
 * The requirements of Archon for a resolution: one of kind `tool` for each resolved tool, with the id `tool.<name>`, a dependency on the requirement of each tool it needs, and as its desired state
 * data that names the tool, the version it is carried out at, its program, its scope, its phases, the dialect and the source (the download a pin gave, or the packages). They are made, never
 * written: the version and the hash in them come from the pin, and Archon orders and plans them for the dialect that was chosen.
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
  return source.kind === "download"
    ? { kind: "download", pin: source.pin, version: source.download.version, url: source.download.url, sha256: source.download.sha256, format: source.download.format, bin: source.download.bin }
    : { kind: "package", manager: source.manager, packages: [...source.packages] };
}

function desiredOf(r: ResolvedTool): JsonValue {
  return {
    tool: r.tool.name,
    version: r.version ?? null,
    pinPolicy: r.tool.pin,
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
      summary: `${r.tool.name} ${r.version ?? "(any current version)"} is installed (${r.tool.summary})`,
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
