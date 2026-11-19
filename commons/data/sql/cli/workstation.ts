// Spec: 0047-arcactl-init FR-001
/**
 * The workstation model of `arcactl` (commons data 0047-arcactl-init FR-001): where a person's files are, on Linux, macOS and Windows, for what `arcactl init` sets up: the files libpq and `psql` read
 * (`.pgpass`, `pg_service.conf`, `.psqlrc`), the directories `arcactl` keeps its own settings, cache and state in, and the profile of each shell. It is a function of the platform and the environment,
 * and touches no file, so that a test can say where a Windows user's files are on Linux. libpq's own variables win where it has them (`PGPASSFILE`, `PGSERVICEFILE`, `PSQLRC`).
 *
 * @module
 */
import { posix, win32 } from "node:path";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";

/** The platforms whose rules are known. */
export type Platform = "linux" | "darwin" | "win32";
/** The shells a profile can be made for. */
export type Shell = "bash" | "zsh" | "fish" | "pwsh" | "nu" | "sh";
export const shells: readonly Shell[] = ["bash", "zsh", "fish", "pwsh", "nu", "sh"];

/** What a person's machine says of itself. */
export interface Host {
  readonly platform: Platform;
  readonly env: Readonly<Record<string, string | undefined>>;
}

/** The profile files of a shell: which are written, and whether all of them or the first that is there. */
export interface Profile {
  readonly files: readonly string[];
  readonly policy: "all" | "first-existing";
}

/** Where a person's files are. */
export interface Paths {
  readonly platform: Platform;
  readonly home: string;
  /** The directory `arcactl` keeps its settings in, and where the `psql` file it owns is. */
  readonly config: string;
  readonly cache: string;
  readonly state: string;
  readonly pgpass: string;
  readonly pgServiceFile: string;
  /** The `psqlrc` that `psql` reads. */
  readonly psqlrc: string;
  /** The `psql` file `arcactl` owns, which the managed block of `psqlrc` includes. */
  readonly arcaPsqlrc: string;
  /** The file of the instances `arcactl` knows. */
  readonly instances: string;
  readonly profiles: Readonly<Record<Shell, Profile>>;
}

/** Whether a name is a platform. */
export const isPlatform = (s: string): s is Platform => s === "linux" || s === "darwin" || s === "win32";

const set = (v: string | undefined): string | undefined => (v === undefined || v === "" ? undefined : v);

/**
 * Where the files are.
 *
 * @param host - the platform and the environment
 * @returns the paths, or why they cannot be known (no home directory)
 */
export function pathsOf(host: Host): Result<Paths, string> {
  const e = host.env;
  const win = host.platform === "win32";
  const p = win ? win32 : posix;
  const home = win ? (set(e["USERPROFILE"]) ?? (set(e["HOMEDRIVE"]) !== undefined && set(e["HOMEPATH"]) !== undefined ? `${e["HOMEDRIVE"]}${e["HOMEPATH"]}` : undefined)) : set(e["HOME"]);
  if (home === undefined) return err(win ? "the home directory is not known: USERPROFILE is not set" : "the home directory is not known: HOME is not set");
  const appdata = set(e["APPDATA"]) ?? p.join(home, "AppData", "Roaming");
  const local = set(e["LOCALAPPDATA"]) ?? p.join(home, "AppData", "Local");
  const xdgConfig = set(e["XDG_CONFIG_HOME"]) ?? p.join(home, ".config");
  const config = win ? p.join(appdata, "arcactl") : p.join(xdgConfig, "arcactl");
  const cache = win ? p.join(local, "arcactl", "cache") : p.join(set(e["XDG_CACHE_HOME"]) ?? p.join(home, ".cache"), "arcactl");
  const state = win ? p.join(local, "arcactl", "state") : p.join(set(e["XDG_STATE_HOME"]) ?? p.join(home, ".local", "state"), "arcactl");
  const pgdir = p.join(appdata, "postgresql");
  const profiles: Record<Shell, Profile> = {
    bash: host.platform === "darwin" ? { files: [p.join(home, ".bash_profile"), p.join(home, ".bashrc")], policy: "first-existing" } : { files: [p.join(home, ".bashrc")], policy: "all" },
    zsh: { files: [p.join(set(e["ZDOTDIR"]) ?? home, ".zshrc")], policy: "all" },
    fish: { files: [p.join(xdgConfig, "fish", "conf.d", "arcactl.fish")], policy: "all" },
    pwsh: win
      ? { files: [p.join(home, "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1"), p.join(home, "Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1")], policy: "all" }
      : { files: [p.join(xdgConfig, "powershell", "Microsoft.PowerShell_profile.ps1")], policy: "all" },
    nu: { files: [win ? p.join(appdata, "nushell", "config.nu") : p.join(xdgConfig, "nushell", "config.nu")], policy: "all" },
    sh: { files: [p.join(home, ".profile")], policy: "all" },
  };
  const pwshOverride = set(e["ARCACTL_PWSH_PROFILE"]);
  if (pwshOverride !== undefined) profiles.pwsh = { files: [pwshOverride], policy: "all" };
  return ok({
    platform: host.platform,
    home,
    config,
    cache,
    state,
    pgpass: set(e["PGPASSFILE"]) ?? (win ? p.join(pgdir, "pgpass.conf") : p.join(home, ".pgpass")),
    pgServiceFile: set(e["PGSERVICEFILE"]) ?? (win ? p.join(pgdir, ".pg_service.conf") : p.join(home, ".pg_service.conf")),
    psqlrc: set(e["PSQLRC"]) ?? (win ? p.join(pgdir, "psqlrc.conf") : p.join(home, ".psqlrc")),
    arcaPsqlrc: p.join(config, "psqlrc"),
    instances: p.join(config, "instances.json"),
    profiles,
  });
}

/** The files of a profile that are to be written: all, or the first that exists (the first where none does). */
export function profileTargets(profile: Profile, exists: (file: string) => boolean): readonly string[] {
  if (profile.policy === "all") return profile.files;
  const first = profile.files.find(exists) ?? profile.files[0];
  return first === undefined ? [] : [first];
}

/** The shell a name says, where it is one: `/usr/bin/zsh`, `pwsh.exe`, `powershell` and `nu` included. */
export function shellOf(name: string | undefined): Shell | undefined {
  if (name === undefined) return undefined;
  const base = (name.split(/[\\/]/).pop() ?? "").toLowerCase().replace(/\.exe$/, "");
  if (base === "powershell") return "pwsh";
  if (base === "nushell") return "nu";
  return (shells as readonly string[]).includes(base) ? (base as Shell) : base === "dash" || base === "ash" ? "sh" : undefined;
}
