// Spec: 0002-machine-probe-contract FR-004
/**
 * The probe's two scripts, as text: a POSIX shell script for Linux and macOS and a PowerShell script for Windows. Each answers `facts`, `version` and one osquery SELECT and refuses everything else, reads only, listens on nothing and needs no
 * root. They are shipped with the library as files and read here, so that what is installed on a machine is exactly what was reviewed.
 *
 * @example
 * ```ts
 * import { probeScript } from "./scripts.ts";
 * (await probeScript("posix")).startsWith("#!/bin/sh"); // true
 * ```
 *
 * @module
 */
import * as fs from "@intellectual-frontiers/system/fs";
import * as path from "@intellectual-frontiers/system/path";

/** The system a script is for. */
export type ScriptKind = "posix" | "windows";

const HERE = path.dirname(path.fromFileUrl(import.meta.url));

/** The text of the probe script for a system. */
export async function probeScript(kind: ScriptKind): Promise<string> {
  return fs.readTextFile(path.join(HERE, "scripts", kind === "posix" ? "machine-probe.sh" : "machine-probe.ps1"));
}

/** The path of the script for a system in the library, for a test or an installer that copies the file. */
export function probeScriptPath(kind: ScriptKind): string {
  return path.join(HERE, "scripts", kind === "posix" ? "machine-probe.sh" : "machine-probe.ps1");
}

/** The command that runs a script on the machine itself: `sh` for the POSIX script, PowerShell 7 (`pwsh`) with no profile and no prompt for the Windows one. The request is the words of the probe, each its own argument, which both scripts join with a space, as a forced command would give them. */
export function probeCommand(kind: ScriptKind, scriptPath: string, request: string): readonly string[] {
  const words = request.split(" ").filter((w) => w !== "");
  return kind === "posix" ? ["sh", scriptPath, ...words] : ["pwsh", "-NoProfile", "-NonInteractive", "-File", scriptPath, ...words];
}

/** The system a family of operating system is run on: Windows for `windows`, POSIX for any other. */
export function scriptKindOf(family: string): ScriptKind {
  return family.toLowerCase() === "windows" ? "windows" : "posix";
}
