// Spec: 0002-toolchain-governance FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * A tool: a program a computer needs, declared once. It has one exact version, a pin policy, what it provides and needs, the phase of work that first needs it, the scope it lives in and the
 * bindings that say how a dialect obtains it: the artifacts of each platform (an `https` address, the SHA-256 of what is there, its format and the folder of its programs) or the names a
 * package manager knows. `defineTool` is the one way to make one, and it refuses with every reason what is not one.
 *
 * @example
 * ```ts
 * import { defineTool } from "./tool.ts";
 * const r = defineTool({
 *   name: "jq",
 *   summary: "A command line JSON processor.",
 *   version: "1.7.1",
 *   pin: "exact",
 *   program: "jq",
 *   versionArgs: ["--version"],
 *   phases: ["core"],
 *   scope: "user",
 *   bindings: [{ kind: "package", dialect: "homebrew", packages: ["jq"] }],
 * });
 * r.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256Of, type Sha256 } from "@intellectual-frontiers/crypto/sha256";
import { findSecretLike, parseDialectId, type DialectId } from "@intellectual-frontiers/archon/governance";
import { compareVersions, parseToolName, parseVersion, type ToolName, type Version } from "./ids.ts";

/** A platform a tool can have an artifact for. */
export type Platform = "linux-x64" | "linux-arm64" | "macos-x64" | "macos-arm64" | "windows-x64";
/** Every platform. */
export const PLATFORMS: readonly Platform[] = ["linux-x64", "linux-arm64", "macos-x64", "macos-arm64", "windows-x64"];
/** The phase of work that first needs a tool. */
export type Phase = "core" | "dev" | "test" | "stage" | "publish";
/** Every phase, from the first needed to the last. */
export const PHASES: readonly Phase[] = ["core", "dev", "test", "stage", "publish"];
/** Where a tool lives: in a user's folder, or in the system's. */
export type Scope = "user" | "system";
/** How strictly a tool is pinned. */
export type PinPolicy = "exact" | "release-line" | "rolling";
/** Every pin policy, from the least strict to the most. */
export const PIN_POLICIES: readonly PinPolicy[] = ["rolling", "release-line", "exact"];
/** The format of what an artifact address gives. */
export type ArtifactFormat = "zip" | "tar" | "file";

/** What one platform downloads: its address, the SHA-256 of what is there, its format and the folder of its programs inside it. */
export type Artifact = {
  readonly url: string;
  readonly sha256: Sha256;
  readonly format: ArtifactFormat;
  readonly bin: string;
};

/** How a dialect obtains a tool: an artifact for each platform it has, or the names of the packages a dialect's manager knows. */
export type Binding =
  | { readonly kind: "artifact"; readonly artifacts: { readonly [P in Platform]?: Artifact } }
  | { readonly kind: "package"; readonly dialect: DialectId; readonly packages: readonly string[] };

/** A tool. */
export type Tool = {
  readonly name: ToolName;
  readonly summary: string;
  /** The one exact version it is pinned to, or the one it was proven with where the pin is not exact. */
  readonly version: Version;
  readonly pin: PinPolicy;
  /** The least version of a copy found on the computer that may be taken. */
  readonly minimum?: Version;
  /** The program, or the file, whose presence proves it. */
  readonly program: string;
  /** How the program is asked its version; none where it cannot be asked. */
  readonly versionArgs: readonly string[];
  readonly needs: readonly ToolName[];
  /** The variables it sets for the programs that run it. */
  readonly env: Readonly<Record<string, string>>;
  /** The other programs it provides. */
  readonly provides: readonly string[];
  readonly phases: readonly Phase[];
  readonly scope: Scope;
  readonly bindings: readonly Binding[];
};

/** An artifact as written. */
export type ArtifactInput = { readonly url: string; readonly sha256: string; readonly format: string; readonly bin: string };

/** A binding as written. */
export type BindingInput =
  | { readonly kind: "artifact"; readonly artifacts: Readonly<Record<string, ArtifactInput>> }
  | { readonly kind: "package"; readonly dialect: string; readonly packages: readonly string[] };

/** What `defineTool` takes. */
export type ToolInput = {
  readonly name: string;
  readonly summary: string;
  readonly version: string;
  readonly pin: string;
  readonly minimum?: string;
  readonly program: string;
  readonly versionArgs: readonly string[];
  readonly needs?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly provides?: readonly string[];
  readonly phases: readonly string[];
  readonly scope: string;
  readonly bindings: readonly BindingInput[];
};

function oneOf<T extends string>(values: readonly T[], text: string): T | undefined {
  return values.find((v) => v === text);
}

/** An artifact from what was written, or every reason it is not one. */
function artifactOf(platform: string, input: ArtifactInput): Result<Artifact, readonly string[]> {
  const problems: string[] = [];
  let url: URL | undefined;
  try {
    url = new URL(input.url);
  } catch {
    problems.push(`${platform}: ${JSON.stringify(input.url)} is not an address`);
  }
  if (url !== undefined) {
    if (url.protocol !== "https:") problems.push(`${platform}: the address is https, and ${JSON.stringify(input.url)} is not`);
    if (url.username !== "" || url.password !== "") problems.push(`${platform}: the address holds a user name or a password`);
  }
  const hash = sha256Of(input.sha256);
  if (hash === undefined) problems.push(`${platform}: ${JSON.stringify(input.sha256)} is not a SHA-256 (64 hexadecimal digits)`);
  const format = oneOf<ArtifactFormat>(["zip", "tar", "file"], input.format);
  if (format === undefined) problems.push(`${platform}: ${JSON.stringify(input.format)} is not a format (zip, tar, file)`);
  if (input.bin.startsWith("/") || input.bin.includes("\\") || input.bin.split("/").includes("..")) problems.push(`${platform}: the folder of programs ${JSON.stringify(input.bin)} is not a path inside the unpacked folder`);
  if (problems.length > 0 || hash === undefined || format === undefined) return err(problems);
  return ok({ url: input.url, sha256: hash, format, bin: input.bin });
}

/** A tool, or every reason the input is not one. */
export function defineTool(input: ToolInput): Result<Tool, readonly string[]> {
  const problems: string[] = [];
  const name = parseToolName(input.name);
  if (name.kind === "err") problems.push(name.error);
  if (input.summary.trim() === "") problems.push("a tool has a summary");
  const version = parseVersion(input.version);
  if (version.kind === "err") problems.push(version.error);
  const pin = oneOf(PIN_POLICIES, input.pin);
  if (pin === undefined) problems.push(`${JSON.stringify(input.pin)} is not a pin policy (${PIN_POLICIES.join(", ")})`);
  let minimum: Version | undefined;
  if (input.minimum !== undefined) {
    const m = parseVersion(input.minimum);
    if (m.kind === "err") problems.push(`the minimum: ${m.error}`);
    else {
      minimum = m.value;
      if (version.kind === "ok" && compareVersions(m.value, version.value) > 0) problems.push(`the minimum ${m.value} is above the version ${version.value}`);
    }
  }
  if (input.program.trim() === "") problems.push("a tool names its program");
  const scope = oneOf<Scope>(["user", "system"], input.scope);
  if (scope === undefined) problems.push(`${JSON.stringify(input.scope)} is not a scope (user, system)`);
  if (input.phases.length === 0) problems.push("a tool has at least one phase");
  const phases: Phase[] = [];
  for (const p of input.phases) {
    const phase = oneOf(PHASES, p);
    if (phase === undefined) problems.push(`${JSON.stringify(p)} is not a phase (${PHASES.join(", ")})`);
    else phases.push(phase);
  }
  const needs: ToolName[] = [];
  for (const n of input.needs ?? []) {
    const r = parseToolName(n);
    if (r.kind === "ok") needs.push(r.value);
    else problems.push(`a need: ${r.error}`);
  }
  const env = input.env ?? {};
  for (const [k, v] of Object.entries(env)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(k)) problems.push(`the variable ${JSON.stringify(k)} is named with upper case letters, digits and underscores`);
    for (const f of findSecretLike(v, "$", k)) problems.push(`the variable ${k} holds what looks like a secret (${f.why})`);
  }
  for (const f of findSecretLike(input.program)) problems.push(`the program holds what looks like a secret (${f.why})`);

  if (input.bindings.length === 0) problems.push("a tool has at least one binding");
  const bindings: Binding[] = [];
  let artifactBindings = 0;
  const dialects = new Set<string>();
  for (const b of input.bindings) {
    if (b.kind === "artifact") {
      artifactBindings++;
      if (artifactBindings > 1) problems.push("a tool has one artifact binding at most");
      const artifacts: { [P in Platform]?: Artifact } = {};
      const entries = Object.entries(b.artifacts);
      if (entries.length === 0) problems.push("an artifact binding has an artifact for at least one platform");
      for (const [platform, a] of entries) {
        const p = oneOf(PLATFORMS, platform);
        if (p === undefined) {
          problems.push(`${JSON.stringify(platform)} is not a platform (${PLATFORMS.join(", ")})`);
          continue;
        }
        const r = artifactOf(platform, a);
        if (r.kind === "err") problems.push(...r.error);
        else artifacts[p] = r.value;
      }
      bindings.push({ kind: "artifact", artifacts });
    } else {
      const d = parseDialectId(b.dialect);
      if (d.kind === "err") problems.push(d.error);
      if (b.packages.length === 0 || b.packages.some((p) => p.trim() === "")) problems.push(`the package binding of ${b.dialect} names at least one package, none empty`);
      if (dialects.has(b.dialect)) problems.push(`a tool has one package binding for ${b.dialect} at most`);
      dialects.add(b.dialect);
      if (d.kind === "ok") bindings.push({ kind: "package", dialect: d.value, packages: b.packages });
    }
  }

  if (problems.length > 0 || name.kind === "err" || version.kind === "err" || pin === undefined || scope === undefined) return err(problems.length > 0 ? problems : ["the tool is incomplete"]);
  const base = { name: name.value, summary: input.summary, version: version.value, pin, program: input.program, versionArgs: input.versionArgs, needs, env, provides: input.provides ?? [], phases, scope, bindings };
  return ok(minimum === undefined ? base : { ...base, minimum });
}
