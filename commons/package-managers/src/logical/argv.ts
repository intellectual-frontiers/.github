// Spec: 0003-package-managers-logical FR-001, FR-002, FR-003, FR-004
/**
 * The command of an operation as an argument vector: the words of the ontology's template with the names put where they go (never through a shell), the exact version written as the manager
 * writes it, the environment the manager needs as the `env` program, and the program that raises the rights put first only where the manager needs them. A name or a version that could be taken for an option is refused.
 *
 * @example
 * ```ts
 * import { commandArgv } from "./argv.ts";
 * // commandArgv(spec, { packages: ["jq"], version: "1.7.1" }, { kind: "joined", joiner: "=" }, { elevate: [] })
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { isSafeName, isSafeVersion, type CommandSpec, type Versioning } from "@intellectual-frontiers/package-managers/governance";

/** What a command is made for: the packages (the version, where there is one, is the first's) and nothing else. */
export type Subject = { readonly packages: readonly string[]; readonly version?: string | undefined };

/** What changes the command made: the program that raises the rights (none by default) and whether the form that asks a person nothing is used (it is, by default). */
export type Shape = { readonly elevate?: readonly string[]; readonly interactive?: boolean };

/** A command ready to run. */
export type Argv = { readonly argv: readonly string[]; readonly admin: boolean; readonly verified: boolean };

function words(template: string): readonly string[] {
  return template.trim().split(/\s+/).filter((w) => w !== "");
}

function namesOf(subject: Subject, versioning: Versioning): Result<readonly string[], string> {
  for (const p of subject.packages) if (!isSafeName(p)) return err(`${JSON.stringify(p)} is not a package name that is safe in a command`);
  const [first, ...rest] = subject.packages;
  if (first === undefined) return err("no package is named");
  const version = subject.version;
  if (version === undefined) {
    return ok(versioning.kind === "flags" ? [...versioning.packageFlags, first, ...versioning.exactFlags, ...rest] : subject.packages);
  }
  if (!isSafeVersion(version)) return err(`${JSON.stringify(version)} is not a version that is safe in a command`);
  switch (versioning.kind) {
    case "joined":
      return ok([`${first}${versioning.joiner}${version}`, ...rest]);
    case "flags":
      return rest.length > 0 ? err("a version is written as flags for one package, and more than one is named") : ok([...versioning.packageFlags, first, ...versioning.exactFlags, versioning.versionFlag, version]);
    case "none":
      return err(`this manager cannot install an exact version: ${versioning.reason}`);
  }
}

/** The argument vector of a command for a subject, or why it cannot be made. */
export function commandArgv(spec: CommandSpec, subject: Subject, versioning: Versioning, shape: Shape = {}): Result<Argv, string> {
  const template = shape.interactive === true ? spec.template : (spec.nonInteractive ?? spec.template);
  const parts = words(template);
  const at = parts.filter((w) => w === "{packages}" || w === "{package}");
  if (at.length !== 1) return err(`the template ${JSON.stringify(template)} of ${spec.manager} has ${at.length} places for names, and one is needed`);
  if (parts.some((w) => w.includes("{") && w !== "{packages}" && w !== "{package}")) return err(`the template ${JSON.stringify(template)} of ${spec.manager} has a place this library does not fill`);
  if (at[0] === "{package}" && subject.packages.length !== 1) return err(`${spec.manager} asks about one package at a time`);
  const names = namesOf(subject, versioning);
  if (names.kind === "err") return names;
  const body = parts.flatMap((w) => (w === "{packages}" || w === "{package}" ? names.value : [w]));
  const prefix = [...(spec.needsAdministrator ? (shape.elevate ?? []) : []), ...(spec.environment === undefined ? [] : ["env", spec.environment])];
  return ok({ argv: [...prefix, ...body], admin: spec.needsAdministrator, verified: spec.verified });
}

/** The first version in the text a manager prints, without an epoch (`1:2.43.0-1` is `2.43.0-1`) and without a trailing dot, or nothing. */
export function versionIn(text: string): string | undefined {
  const m = /(?:^|[^0-9A-Za-z.])(?:\d+:)?(\d+(?:\.\d+)+(?:[-+~][0-9A-Za-z.+~]+)?)/.exec(text);
  return m?.[1]?.replace(/\.$/, "");
}

/** Whether an installed version is the one asked for: the same, or the one asked for followed by a packager's revision (`2.43.0` is `2.43.0-1ubuntu7`). */
export function sameVersion(observed: string, wanted: string): boolean {
  return observed === wanted || observed.startsWith(`${wanted}-`) || observed.startsWith(`${wanted}+`) || observed.startsWith(`${wanted}~`);
}
