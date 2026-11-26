// Spec: 0005-package-managers-adapter FR-001, FR-002, FR-003
/**
 * The adapter of the operating system package managers, as one table: the key is the package manager fact (`apt`, `dnf`, `yum`, `zypper`, `apk`, `pacman`, `brew`, `winget`, `mise`) and each row is the data of
 * the manager (what it guarantees, how it writes an exact version, the exit status of a query of a package that is missing). The commands are the ontology's; `installSteps` gives, for the tools of an order that
 * the manager installs, the install and the check as `ArgvStep`s of core, words only, with no shell and no elevation program in the words (the identity is `as`).
 *
 * @example
 * ```ts
 * import { specOf } from "./table.ts";
 * specOf("dnf"); // { kind: "ok", value: the data of dnf }
 * specOf("emerge"); // { kind: "err", error: names the keys of the table }
 * ```
 *
 * @module
 */
import { err, ok, type ArgvStep, type Result } from "@intellectual-frontiers/core";
import type { Requirement } from "@intellectual-frontiers/desired-os-state/governance";
import { parseManagerId } from "@intellectual-frontiers/toolchain/governance";
import type { ToolGuarantees } from "@intellectual-frontiers/toolchain/logical";
import { jobArgv, jobOf, type CommandSource, type ManagerSpec } from "./manager.ts";

/** The keys of the table. */
export const MANAGER_KEYS = ["apt", "dnf", "yum", "zypper", "apk", "pacman", "brew", "winget", "mise"] as const;
/** One key of the table. */
export type ManagerKey = (typeof MANAGER_KEYS)[number];

const LINUX = ["linux-x64", "linux-arm64"] as const;
const SYSTEM: ToolGuarantees = { pin: "exact", integrity: "signature", scopes: ["system"], platforms: LINUX, binds: "package", sourceBuild: false };

function row(key: ManagerKey, summary: string, guarantees: ToolGuarantees, versioning: ManagerSpec["versioning"], missingExit: number | undefined): ManagerSpec {
  const manager = parseManagerId(`manager-${key}`);
  if (manager.kind === "err") throw new Error(manager.error);
  return { id: key, manager: manager.value, summary, guarantees, versioning, missingExit };
}

/** The table: one row for each package manager. */
export const PACKAGE_MANAGERS: Readonly<Record<ManagerKey, ManagerSpec>> = {
  apt: row("apt", "Debian and Ubuntu's package manager, which checks the signed index of its repositories.", SYSTEM, { kind: "joined", joiner: "=" }, 1),
  dnf: row("dnf", "Fedora, Red Hat and Rocky Linux's package manager, which checks the signature of each package.", SYSTEM, { kind: "joined", joiner: "-" }, 1),
  yum: row("yum", "The older package manager of Red Hat's family, which checks the signature of each package.", SYSTEM, { kind: "joined", joiner: "-" }, undefined),
  zypper: row("zypper", "SUSE's package manager, which checks the signature of each package.", SYSTEM, { kind: "joined", joiner: "=" }, undefined),
  apk: row("apk", "Alpine's package manager, which checks the signed index of its repositories.", SYSTEM, { kind: "joined", joiner: "=" }, 1),
  pacman: row("pacman", "Arch's package manager, which installs the current version of a package from its signed repositories.", { ...SYSTEM, pin: "rolling" }, { kind: "none", reason: "pacman installs the current version of a package; an older one is an archive, not a flag" }, 1),
  brew: row("brew", "Homebrew, which installs the current bottle of a formula in a folder of the user's own, checked by the SHA-256 of the bottle.", { pin: "rolling", integrity: "hash", scopes: ["user"], platforms: ["macos-x64", "macos-arm64", "linux-x64", "linux-arm64"], binds: "package", sourceBuild: true }, { kind: "none", reason: "Homebrew installs the current version of a formula; an older line is a formula of its own (jq@1), named as the package" }, 1),
  winget: row("winget", "WinGet, whose manifests carry the SHA-256 of each installer, which it checks before it runs one.", { pin: "exact", integrity: "hash", scopes: ["user", "system"], platforms: ["windows-x64"], binds: "package", sourceBuild: false }, { kind: "flags", packageFlags: ["--id"], exactFlags: ["--exact"], versionFlag: "--version" }, undefined),
  mise: row("mise", "Mise, which installs the tools of an account in the account's own folder at the versions it is told.", { pin: "exact", integrity: "none", scopes: ["user"], platforms: ["linux-x64", "linux-arm64", "macos-x64", "macos-arm64", "windows-x64"], binds: "package", sourceBuild: true }, { kind: "joined", joiner: "@" }, undefined),
};

/** The data of a manager by its key, or the keys of the table where it is not one. */
export function specOf(key: string): Result<ManagerSpec, string> {
  const found = MANAGER_KEYS.find((k) => k === key);
  return found === undefined ? err(`${JSON.stringify(key)} is not a package manager of the table: ${MANAGER_KEYS.join(", ")}`) : ok(PACKAGE_MANAGERS[found]);
}

/** What a manager does for one tool: the install and, where the manager can be asked, the check that says whether it is there. */
export type PackageStep = {
  readonly requirement: string;
  readonly tool: string;
  readonly install: ArgvStep;
  /** The query of the package; it succeeds with 0 (installed) or with the exit status of a missing package. */
  readonly check?: ArgvStep;
};

/** The install and the check, as steps of core, of each tool of the requirements that this manager installs; or every reason a command cannot be made. */
export function installSteps(spec: ManagerSpec, commands: CommandSource, requirements: readonly Requirement[]): Result<readonly PackageStep[], readonly string[]> {
  const out: PackageStep[] = [];
  const problems: string[] = [];
  for (const r of requirements) {
    const job = jobOf(spec, r);
    if (job === undefined) continue;
    const install = jobArgv(spec, commands, job, "Install", {});
    if (install.kind === "err") {
      problems.push(install.error);
      continue;
    }
    const asked = jobArgv(spec, commands, job, "QueryInstalled", {});
    const identity = (admin: boolean): "root" | "user" => (admin ? "root" : "user");
    const step: PackageStep = { requirement: job.requirement, tool: job.tool, install: { argv: install.value.argv, as: identity(install.value.admin), expect: [0] } };
    out.push(asked.kind === "ok" && spec.missingExit !== undefined ? { ...step, check: { argv: asked.value.argv, as: identity(asked.value.admin), expect: [0, spec.missingExit] } } : step);
  }
  return problems.length > 0 ? err(problems) : ok(out);
}
