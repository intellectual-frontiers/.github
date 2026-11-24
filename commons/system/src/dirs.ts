// Spec: 0001-system FR-008
/**
 * Where a program keeps its files on each system, by the conventions the system and the tools we depend on already have, never by one of ours (commons 0031-install-locations): the XDG Base Directory
 * Specification on Linux and macOS (as `git` and `gh` do on both), and Windows' known folders on Windows (as `gh` does), with the `XDG_*` variables honored on every system where they are set. Every function takes the
 * environment and the system as values, so that a test on one system proves the paths of another; nothing here reads the host.
 *
 * @remarks
 * Config is `$XDG_CONFIG_HOME/<app>` (else `~/.config/<app>`) and `%APPDATA%\<app>`; data is `$XDG_DATA_HOME/<app>` (else `~/.local/share/<app>`) and `%LOCALAPPDATA%\<app>`; state, which is what a program
 * remembers between runs and a person would not want to back up, is `$XDG_STATE_HOME/<app>` (else `~/.local/state/<app>`) and `%LOCALAPPDATA%\<app>\state`; cache is `$XDG_CACHE_HOME/<app>` (else `~/.cache/<app>`)
 * and `%LOCALAPPDATA%\<app>\cache`; the runtime folder (locks and sockets) is `$XDG_RUNTIME_DIR/<app>` where the variable is set and there is none otherwise, and the caller uses its state folder; user programs go in
 * `~/.local/bin`, which the XDG specification names for them, and Windows has no such folder (WinGet links the programs it installs into its own, which is already on the path, and a runtime's global install has its
 * own). A value of an `XDG_*` variable that is not an absolute path is ignored, as the specification says.
 *
 * @limits
 * It makes no folder and reads none. Where no home folder can be found and no variable names the folder, the folder is `undefined`, never a guess.
 *
 * @example
 * ```ts
 * import { dirsOf } from "./dirs.ts";
 * const env = (n: string): string | undefined => ({ HOME: "/home/a" })[n];
 * dirsOf("acme", env, "linux").config; // "/home/a/.config/acme"
 * ```
 *
 * @module
 */
import { posix, win32 } from "./path.ts";

/** An operating system, by the names `proc.build.os` gives. */
export type Os = "linux" | "darwin" | "windows";

/** A variable's value, or `undefined`. */
export type Env = (name: string) => string | undefined;

/** The folders a program keeps its files in; each is undefined where it cannot be found. */
export type Dirs = {
  readonly config: string | undefined;
  readonly data: string | undefined;
  readonly state: string | undefined;
  readonly cache: string | undefined;
  /** For locks and sockets: undefined where `XDG_RUNTIME_DIR` is not set, and the caller uses `state`. */
  readonly runtime: string | undefined;
  /** Where a program a person installs is put: `~/.local/bin`; undefined on Windows. */
  readonly bin: string | undefined;
};

const rulesOf = (os: Os): typeof posix => (os === "windows" ? win32 : posix);

/** The home folder: `HOME`, and on Windows `USERPROFILE` first. */
export function homeOf(env: Env, os: Os): string | undefined {
  const h = os === "windows" ? (env("USERPROFILE") ?? env("HOME")) : env("HOME");
  return h === undefined || h === "" ? undefined : h;
}

/** An XDG variable's value where it is set to an absolute path, as the specification says to read it. */
function xdg(env: Env, name: string, os: Os): string | undefined {
  const v = env(name);
  return v !== undefined && v !== "" && (rulesOf(os).isAbsolute(v) || (os === "windows" && posix.isAbsolute(v))) ? v : undefined;
}

/** The folders of the program `app` on the system `os`, from the variables `env` gives. */
export function dirsOf(app: string, env: Env, os: Os): Dirs {
  const r = rulesOf(os);
  const home = homeOf(env, os);
  const under = (base: string | undefined, ...rest: readonly string[]): string | undefined =>
    base === undefined ? undefined : r.join(base, ...rest);
  const fromHome = (...parts: readonly string[]): string | undefined => (home === undefined ? undefined : r.join(home, ...parts));
  if (os === "windows") {
    const local = env("LOCALAPPDATA") ?? fromHome("AppData", "Local");
    const roaming = env("APPDATA") ?? fromHome("AppData", "Roaming");
    return {
      config: under(xdg(env, "XDG_CONFIG_HOME", os) ?? roaming, app),
      data: under(xdg(env, "XDG_DATA_HOME", os) ?? local, app),
      state: xdg(env, "XDG_STATE_HOME", os) === undefined ? under(local, app, "state") : under(xdg(env, "XDG_STATE_HOME", os), app),
      cache: xdg(env, "XDG_CACHE_HOME", os) === undefined ? under(local, app, "cache") : under(xdg(env, "XDG_CACHE_HOME", os), app),
      runtime: under(xdg(env, "XDG_RUNTIME_DIR", os), app),
      bin: undefined,
    };
  }
  return {
    config: under(xdg(env, "XDG_CONFIG_HOME", os) ?? fromHome(".config"), app),
    data: under(xdg(env, "XDG_DATA_HOME", os) ?? fromHome(".local", "share"), app),
    state: under(xdg(env, "XDG_STATE_HOME", os) ?? fromHome(".local", "state"), app),
    cache: under(xdg(env, "XDG_CACHE_HOME", os) ?? fromHome(".cache"), app),
    runtime: under(xdg(env, "XDG_RUNTIME_DIR", os), app),
    bin: fromHome(".local", "bin"),
  };
}
