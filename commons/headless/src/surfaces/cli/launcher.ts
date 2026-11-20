// Spec: 0004-headless-cli FR-013
/**
 * The helpers of a launcher (commons headless 0004-headless-cli FR-013): the program that starts the program, and may find that it cannot. A failure
 * to start is typed, and each kind has its status in the range `sysexits.h` reserves (64 to 78), apart from the statuses of a run (0 to 4): a service
 * manager, a shell and a person can tell "it could not start" from "it ran and found something". It is written as one line, `program: reason`, and one
 * `fix:` line where there is a fix, and nothing else.
 *
 * @example
 * ```ts
 * import { formatStartupFailure, startupExit } from "./launcher.ts";
 * startupExit({ kind: "config", message: "tool.toml has no [server]" }); // 78
 * formatStartupFailure("tool", { kind: "osfile", message: "tool.toml is missing", fix: "tool init" }); // "tool: tool.toml is missing\nfix: tool init\n"
 * ```
 *
 * @module
 */
import { exitCodeOf, type ExitName } from "@intellectual-frontiers/headless/governance";

/** Why a program could not start. */
export type StartupKind = "usage" | "unavailable" | "software" | "osfile" | "config";

/** Every kind. */
export const STARTUP_KINDS: readonly StartupKind[] = ["usage", "unavailable", "software", "osfile", "config"];

/** A failure to start. */
export type StartupFailure = {
  readonly kind: StartupKind;
  /** What is wrong, in a plain sentence. */
  readonly message: string;
  /** One command that fixes it, where there is one. */
  readonly fix?: string;
};

/** The status a failure to start ends the program with. */
export function startupExit(f: StartupFailure): number {
  return exitCodeOf(`startup-${f.kind}` satisfies ExitName);
}

/** What a failure to start writes: `program: message`, and `fix: command` where it has one; both end in a newline. */
export function formatStartupFailure(program: string, f: StartupFailure): string {
  return `${program}: ${f.message}\n${f.fix === undefined ? "" : `fix: ${f.fix}\n`}`;
}
