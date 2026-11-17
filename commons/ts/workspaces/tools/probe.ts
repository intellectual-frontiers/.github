/**
 * The version probes of `git`, `bun` and `node` (commons 0023-if-workspaces FR-038, 0025-ifws FR-018): IFWS verifies them and never installs them, so a probe is a judgement on what
 * `<tool> --version` said, as a sum type: the version is there and enough, it is too old, it is missing, or what it said is not a version. Bun is the default runtime and Node 26 the backup;
 * Deno is not a runtime of IFWS.
 *
 * @remarks
 * Pure: the host layer (`host/probe.ts`) runs the programs and hands the text over. A probe that fails is a finding that says what to do (how to install the tool), never an install.
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import { atLeast, versionIn } from "../../kernel/semver.ts";
import type { Finding } from "../findings.ts";

/** The tools that are probed, never installed. */
export type ProbedTool = "git" | "bun" | "node";

/** The probed tools in the order they are reported. */
export const PROBES: readonly ProbedTool[] = ["git", "bun", "node"];

/** The oldest version of each probed tool IFWS works with. */
export const MINIMUM_VERSIONS: Readonly<Record<ProbedTool, string>> = { git: "2.25.0", bun: "1.3.0", node: "26.0.0" };

/** What a probe found. */
export type Probe =
  | { readonly kind: "ok"; readonly tool: ProbedTool; readonly version: string }
  | { readonly kind: "too-old"; readonly tool: ProbedTool; readonly version: string; readonly minimum: string }
  | { readonly kind: "missing"; readonly tool: ProbedTool }
  | { readonly kind: "unreadable"; readonly tool: ProbedTool; readonly said: string };

/** The way to install a probed tool, as one sentence (IFWS never does it). */
export function installAdvice(tool: ProbedTool): string {
  switch (tool) {
    case "git":
      return "install Git from https://git-scm.com/downloads or with your system's package manager";
    case "bun":
      return "install Bun from https://bun.sh (the default runtime of Intellectual Frontiers)";
    case "node":
      return "install Node 26 from https://nodejs.org (the backup runtime)";
    default:
      return absurd(tool);
  }
}

/**
 * Judges what `<tool> --version` printed (`undefined` where the program is not on the path): `git version 2.43.0`, `1.3.5` and `v26.1.0` are the shapes, and a version is read from the first
 * dotted number found, whatever surrounds it (`git version 2.43.0.windows.1` is 2.43.0).
 */
export function judgeProbe(tool: ProbedTool, said: string | undefined): Probe {
  if (said === undefined) return { kind: "missing", tool };
  const found = versionIn(said);
  if (found === undefined) return { kind: "unreadable", tool, said: said.trim().slice(0, 80) };
  const minimum = MINIMUM_VERSIONS[tool];
  return atLeast(found, minimum) ? { kind: "ok", tool, version: found } : { kind: "too-old", tool, version: found, minimum };
}

/** A probe as one sentence that says what is wrong and what to do, or what was found. */
export function describeProbe(p: Probe): string {
  switch (p.kind) {
    case "ok":
      return `${p.tool} ${p.version}`;
    case "too-old":
      return `${p.tool} ${p.version} is older than ${p.minimum}: ${installAdvice(p.tool)}`;
    case "missing":
      return `${p.tool} is not on the path: ${installAdvice(p.tool)}`;
    case "unreadable":
      return `${p.tool} --version said ${JSON.stringify(p.said)}, which holds no version: ${installAdvice(p.tool)}`;
    default:
      return absurd(p);
  }
}

/** The finding of a probe that is not ok (an error: IFWS cannot work without the tool), or undefined where it is ok. */
export function probeFinding(p: Probe, today: string): Finding | undefined {
  if (p.kind === "ok") return undefined;
  return { ruleId: `ifws/tool-${p.kind}`, severity: "Error", message: describeProbe(p), subject: p.tool, firstSeen: today };
}

/** The probed tools' versions of the ones that were found, by name, for the evidence of a run (0023-if-workspaces FR-042, FR-043). */
export function probedVersions(probes: readonly Probe[]): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const p of probes) if (p.kind === "ok" || p.kind === "too-old") out[p.tool] = p.version;
  return out;
}
