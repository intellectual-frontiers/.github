// Spec: 0002-toolchain-governance FR-002, FR-003, FR-004, FR-005, FR-006, FR-008
/**
 * A tool: a program a computer needs, declared once. It has a pin policy, what it provides and needs, the phase of work that first needs it, the scope it lives in and the bindings that say how a
 * dialect obtains it: a reference to a pin of the packaging ontology (which holds the version and the checksums, so that a declaration never copies a version or a hash), or the names a package
 * manager of the ontology knows. `defineTool` is the one way to make one, and it refuses with every reason what is not one. A download, as a pin gives it for a platform, is checked by
 * `defineDownload`.
 *
 * @example
 * ```ts
 * import { defineTool } from "./tool.ts";
 * const r = defineTool({
 *   name: "jq",
 *   summary: "A command line JSON processor.",
 *   pin: "exact",
 *   program: "jq",
 *   versionArgs: ["--version"],
 *   phases: ["core"],
 *   scope: "user",
 *   bindings: [{ kind: "pin", pin: "jq" }, { kind: "package", manager: "manager-brew", packages: ["jq"] }],
 * });
 * r.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256Of, type Sha256 } from "@intellectual-frontiers/crypto/sha256";
import { findSecretLike } from "@intellectual-frontiers/desired-os-state/governance";
import { compareVersions, parseManagerId, parsePinId, parseToolName, parseVersion, type ManagerId, type PinId, type ToolName, type Version } from "./ids.ts";

/** A platform a pin can have a download for. */
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
/** The format of what a download address gives. */
export type ArtifactFormat = "zip" | "tar" | "file";

/** What a pin gives for one platform: the version, the address, the SHA-256 of what is there, its format and the folder of its programs inside it. */
export type Download = {
  readonly version: Version;
  readonly downloadUrl: string;
  readonly sha256: Sha256;
  readonly archiveFormat: ArtifactFormat;
  readonly binPath: string;
};

/** How a dialect obtains a tool: the download a pin of the ontology gives, or the names of the packages a package manager of the ontology knows (at a version, where one is named). */
export type Binding =
  | { readonly kind: "pin"; readonly pin: PinId }
  | { readonly kind: "package"; readonly manager: ManagerId; readonly packages: readonly string[]; readonly version?: Version };

/** A tool. It holds no version and no hash of a pin: it references the pin. */
export type Tool = {
  readonly name: ToolName;
  readonly summary: string;
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
  /** The other names a copy of its program may go by on a computer (Chromium is also `chrome` and `google-chrome`), tried after the program's own. */
  readonly alsoNamed: readonly string[];
  readonly phases: readonly Phase[];
  readonly scope: Scope;
  readonly bindings: readonly Binding[];
};

/** A download as a source of pins gives it. */
export type DownloadInput = { readonly version: string; readonly downloadUrl: string; readonly sha256: string; readonly archiveFormat: string; readonly binPath: string };

/** A binding as written. */
export type BindingInput =
  | { readonly kind: "pin"; readonly pin: string }
  | { readonly kind: "package"; readonly manager: string; readonly packages: readonly string[]; readonly version?: string };

/** What `defineTool` takes. */
export type ToolInput = {
  readonly name: string;
  readonly summary: string;
  readonly pin: string;
  readonly minimum?: string;
  readonly program: string;
  readonly versionArgs: readonly string[];
  readonly needs?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly provides?: readonly string[];
  readonly alsoNamed?: readonly string[];
  readonly phases: readonly string[];
  readonly scope: string;
  readonly bindings: readonly BindingInput[];
};

function oneOf<T extends string>(values: readonly T[], text: string): T | undefined {
  return values.find((v) => v === text);
}

/** A download from what a source of pins gave, or every reason it is not one: an `https` address with no user name or password, a SHA-256, a format and a folder inside the unpacked folder. */
export function defineDownload(input: DownloadInput): Result<Download, readonly string[]> {
  const problems: string[] = [];
  const version = parseVersion(input.version);
  if (version.kind === "err") problems.push(version.error);
  let url: URL | undefined;
  try {
    url = new URL(input.downloadUrl);
  } catch {
    problems.push(`${JSON.stringify(input.downloadUrl)} is not an address`);
  }
  if (url !== undefined) {
    if (url.protocol !== "https:") problems.push(`the address is https, and ${JSON.stringify(input.downloadUrl)} is not`);
    if (url.username !== "" || url.password !== "") problems.push("the address holds a user name or a password");
  }
  const hash = sha256Of(input.sha256);
  if (hash === undefined) problems.push(`${JSON.stringify(input.sha256)} is not a SHA-256 (64 hexadecimal digits)`);
  const format = oneOf<ArtifactFormat>(["zip", "tar", "file"], input.archiveFormat);
  if (format === undefined) problems.push(`${JSON.stringify(input.archiveFormat)} is not a format (zip, tar, file)`);
  if (input.binPath.startsWith("/") || input.binPath.includes("\\") || input.binPath.split("/").includes("..")) problems.push(`the folder of programs ${JSON.stringify(input.binPath)} is not a path inside the unpacked folder`);
  if (problems.length > 0 || version.kind === "err" || hash === undefined || format === undefined) return err(problems);
  return ok({ version: version.value, downloadUrl: input.downloadUrl, sha256: hash, archiveFormat: format, binPath: input.binPath });
}

/** A tool, or every reason the input is not one. */
export function defineTool(input: ToolInput): Result<Tool, readonly string[]> {
  const problems: string[] = [];
  const name = parseToolName(input.name);
  if (name.kind === "err") problems.push(name.error);
  if (input.summary.trim() === "") problems.push("a tool has a summary");
  const pin = oneOf(PIN_POLICIES, input.pin);
  if (pin === undefined) problems.push(`${JSON.stringify(input.pin)} is not a pin policy (${PIN_POLICIES.join(", ")})`);
  let minimum: Version | undefined;
  if (input.minimum !== undefined) {
    const m = parseVersion(input.minimum);
    if (m.kind === "err") problems.push(`the minimum: ${m.error}`);
    else minimum = m.value;
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
  for (const n of input.alsoNamed ?? []) if (n.trim() === "" || /[\\/]/.test(n)) problems.push(`the other name ${JSON.stringify(n)} is a program name, with no path in it`);

  if (input.bindings.length === 0) problems.push("a tool has at least one binding");
  const bindings: Binding[] = [];
  let pinBindings = 0;
  const managers = new Set<string>();
  for (const b of input.bindings) {
    if (b.kind === "pin") {
      pinBindings++;
      if (pinBindings > 1) problems.push("a tool has one pin binding at most");
      const p = parsePinId(b.pin);
      if (p.kind === "err") problems.push(p.error);
      else bindings.push({ kind: "pin", pin: p.value });
    } else {
      const m = parseManagerId(b.manager);
      if (m.kind === "err") problems.push(m.error);
      if (b.packages.length === 0 || b.packages.some((p) => p.trim() === "")) problems.push(`the package binding of ${b.manager} names at least one package, none empty`);
      if (managers.has(b.manager)) problems.push(`a tool has one package binding for ${b.manager} at most`);
      managers.add(b.manager);
      let version: Version | undefined;
      if (b.version !== undefined) {
        const v = parseVersion(b.version);
        if (v.kind === "err") problems.push(`the version of the package binding of ${b.manager}: ${v.error}`);
        else version = v.value;
      }
      if (m.kind === "ok") {
        const base = { kind: "package" as const, manager: m.value, packages: b.packages };
        bindings.push(version === undefined ? base : { ...base, version });
      }
    }
  }
  if (minimum !== undefined) {
    for (const b of bindings) if (b.kind === "package" && b.version !== undefined && compareVersions(minimum, b.version) > 0) problems.push(`the minimum ${minimum} is above the version ${b.version} of the package binding of ${b.manager}`);
  }

  if (problems.length > 0 || name.kind === "err" || pin === undefined || scope === undefined) return err(problems.length > 0 ? problems : ["the tool is incomplete"]);
  const base = { name: name.value, summary: input.summary, pin, program: input.program, versionArgs: input.versionArgs, needs, env, provides: input.provides ?? [], alsoNamed: input.alsoNamed ?? [], phases, scope, bindings };
  return ok(minimum === undefined ? base : { ...base, minimum });
}
