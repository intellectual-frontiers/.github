// Spec: 0006-agents FR-033, FR-034
/**
 * What differs by distribution (commons ergonex 0006-agents FR-033, FR-034): one interface, `ergonex:Distro`, with Omarchy as the reference implementation and a generic fallback. Nothing else of
 * Ergonex tests for a distribution by name. Omarchy is recognized by `ID=omarchy` in `/etc/os-release`, never by `OMARCHY_PATH` (a desktop session sets it and an SSH command does not); tools are
 * installed with `mise` and not `pacman` unless the policy allows the package manager; a `mise` shim that exists is no proof that a tool is installed.
 *
 * @example
 * ```ts
 * import { distroOf } from "./distro.ts";
 * distroOf("ID=omarchy\n").id; // "omarchy"
 * ```
 *
 * @module
 */
/** The fields of `/etc/os-release`: lines of `KEY=value`, the value possibly quoted; comments and blank lines are ignored. */
export function parseOsRelease(text: string): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq);
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && (value.startsWith('"') || value.startsWith("'")) && value.endsWith(value[0] ?? "")) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

/** What differs by distribution. */
export type Distro = {
  /** `omarchy` or `generic`. */
  readonly id: "omarchy" | "generic";
  /** The `ID` of `os-release`, or `unknown`. */
  readonly osId: string;
  /** The folder the installed `ergonex` is put in (the one an SSH command finds on its `PATH`). */
  readonly installDir: (home: string) => string;
  /** How tools are installed: `mise` (Omarchy) or by Ergonex's own pinned artifacts. */
  readonly toolManager: "mise" | "pinned";
  /** The command that turns the SSH server on, as words to tell a person, or undefined where the distribution has none of its own. */
  readonly sshEnable: (key: string) => string | undefined;
  /** The file in which a person's rules for every harness live, where the distribution has one. */
  readonly sharedInstructions: (home: string) => string | undefined;
  /** Whether the package manager may be used for tools (never, unless the policy allows it). */
  readonly packageManager: "pacman" | "none";
};

/** The Omarchy implementation. */
export const OMARCHY: Distro = {
  id: "omarchy",
  osId: "omarchy",
  installDir: (home) => `${home}/.local/bin`,
  toolManager: "mise",
  sshEnable: (key) => `omarchy-setup-security-sshd --key=${key}`,
  sharedInstructions: (home) => `${home}/.agents/AGENTS.md`,
  packageManager: "pacman",
};

/** The fallback. */
export function genericDistro(osId: string): Distro {
  return {
    id: "generic",
    osId,
    installDir: (home) => `${home}/.local/bin`,
    toolManager: "pinned",
    sshEnable: () => undefined,
    sharedInstructions: () => undefined,
    packageManager: "none",
  };
}

/** The distribution of an `os-release` text: Omarchy where `ID=omarchy`, the generic one otherwise. */
export function distroOf(osRelease: string | undefined): Distro {
  const fields = parseOsRelease(osRelease ?? "");
  if (fields["ID"] === "omarchy") return OMARCHY;
  return genericDistro(fields["ID"] ?? "unknown");
}

/** The tools `mise ls --json` says are installed (`installed: true`), by name: a shim is no tool, and nothing is run to find out. */
export function parseMiseInstalled(json: string): readonly string[] {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return [];
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  const out: string[] = [];
  for (const [name, versions] of Object.entries(value)) {
    if (Array.isArray(versions) && versions.some((v) => typeof v === "object" && v !== null && "installed" in v && v.installed === true)) out.push(name);
  }
  return out.sort();
}

/** Whether a path is a `mise` shim, which exists whether or not the tool is installed. */
export function isMiseShim(path: string): boolean {
  return /[\\/]mise[\\/]shims[\\/]/.test(path);
}

/** The recommendation of FR-019: where the host is Omarchy and not a disposable environment, to run agents on a disposable Omarchy virtual machine or a spare machine, and the way in. */
export function disposableRecommendation(distro: Distro, disposable: boolean): string | undefined {
  if (distro.id !== "omarchy" || disposable) return undefined;
  const enable = distro.sshEnable("KEY");
  return `run agents on a disposable Omarchy virtual machine or a spare machine, not on a machine you live in; the way in is the SSH server that \`${enable ?? ""}\` turns on`;
}

/** Why `remote` refuses a system that is not Linux (FR-032): the phase in which that system comes, or nothing for Linux. */
export function systemRefusal(kernel: string): string | undefined {
  switch (kernel) {
    case "Linux":
      return undefined;
    case "Darwin":
      return "the machine runs macOS, and only Linux is a target now: macOS comes in the second phase of `remote`; nothing was changed";
    case "":
      return "the machine did not say what system it runs, and only Linux is a target now; nothing was changed";
    default:
      return `the machine runs ${kernel}, and only Linux is a target now: Windows OpenSSH comes in the third phase of \`remote\`, and no other system is planned; nothing was changed`;
  }
}
