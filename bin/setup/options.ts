// The command line and the environment, parsed once at the boundary into typed options: nothing after this reads a raw switch.
import { type AbsPath, absPath, err, ok, type Result } from "./result.ts";

export type Env = Readonly<Record<string, string>>;
/** bootstrap: the computer whole (packages with administrator rights, then the account); setup: the account alone, never with administrator rights. */
export type Mode = "bootstrap" | "setup";
/** What `ergactl toolchain ensure` is given (BOOTSTRAP_TOOLCHAIN): the default (what ergactl downloads at its pin and is missing), none, all, or names. */
export type ToolchainChoice =
  | { readonly kind: "missing" }
  | { readonly kind: "none" }
  | { readonly kind: "all" }
  | { readonly kind: "names"; readonly names: readonly string[] };
export type RetryPolicy = { readonly tries: number; readonly base: number; readonly cap: number };
/** The settings of ArcaSignals (009-machine-bootstrap FR-052 to FR-054). */
export type Telemetry =
  | { readonly kind: "on"; readonly url: string; readonly token: string }
  | { readonly kind: "refused"; readonly why: "DO_NOT_TRACK=1" | "ERGA_OBSERVE=off" }
  | { readonly kind: "half"; readonly missing: "ERGA_SIGNALS_URL" | "ERGA_SIGNALS_TOKEN" }
  | { readonly kind: "off" };

/** What each BOOTSTRAP_NO_* switch turns off; true means the step runs. */
export type Switches = {
  readonly packages: boolean; // BOOTSTRAP_NO_PACKAGES, BOOTSTRAP_NO_APT
  readonly download: boolean; // BOOTSTRAP_NO_DOWNLOAD: no fetched program (gh, rustup, uv)
  readonly runtime: boolean; // BOOTSTRAP_NO_RUNTIME: no rustup, Rust or uv
  readonly auth: boolean; // BOOTSTRAP_NO_AUTH
  readonly clone: boolean; // BOOTSTRAP_NO_CLONE
  readonly erga: boolean; // BOOTSTRAP_NO_ERGA
  readonly netcheck: boolean; // BOOTSTRAP_NO_NETCHECK
  readonly keepGoing: boolean; // BOOTSTRAP_KEEP_GOING=1
  readonly verbose: boolean; // BOOTSTRAP_VERBOSE=1
};

export type Paths = {
  readonly home: AbsPath;
  readonly bin: string; // ~/.local/bin
  readonly data: string; // erga-setup's own data: the pinned tools
  readonly tools: string;
  readonly state: string;
  readonly cache: string;
  readonly configDir: string;
  readonly settingsFile: string; // ~/.config/erga/setup.env
  readonly secretsFile: string; // ~/.config/erga/secrets.env, as `ergactl secrets` writes it
  readonly installFile: string; // ~/.config/erga/install.toml
  readonly ergaState: string; // erga's state folder: the telemetry journal
  readonly cargoBin: string;
  readonly logDir: string;
  readonly workspaces: string;
  readonly target: string; // the clone
};

export type Options = {
  readonly mode: Mode;
  readonly dryRun: boolean;
  readonly help: boolean;
  readonly switches: Switches;
  readonly retry: RetryPolicy;
  readonly patient: boolean;
  readonly jobs: number;
  readonly baseUrl: string; // where this repository is served from (BOOTSTRAP_URL)
  readonly ergaUrl: string;
  readonly rustupUrl: string | null; // BOOTSTRAP_RUSTUP_URL, a test's or a mirror's
  readonly role: string | null; // ERGA_ROLE
  readonly toolchain: ToolchainChoice;
  readonly support: string;
  readonly telemetry: Telemetry;
  readonly osRelease: string;
  readonly paths: Paths;
};

export const DEFAULT_BASE = "https://raw.githubusercontent.com/intellectual-frontiers/.github/main";
export const DEFAULT_ERGA = "https://github.com/intellectual-frontiers/erga";

/** A whole number of one or more, else the default (ERGA_RETRIES and the rest). */
export function count(value: string | undefined, fallback: number): number {
  return value !== undefined && /^[1-9][0-9]*$/.test(value) ? Number(value) : fallback;
}

/** The retry policy (009-machine-bootstrap FR-034): 8 tries from 3 seconds to 60, or --patient's 15 from 5 to 120; each knob its own variable. */
export function retryPolicy(env: Env, patient: boolean): RetryPolicy {
  const d = patient ? { tries: 15, base: 5, cap: 120 } : { tries: 8, base: 3, cap: 60 };
  return { tries: count(env.ERGA_RETRIES, d.tries), base: count(env.ERGA_RETRY_DELAY, d.base), cap: count(env.ERGA_RETRY_MAX_DELAY, d.cap) };
}

/** One NAME=value of ~/.config/erga/setup.env (the last one counts; quotes around the value are dropped). */
export function settingOf(text: string, name: string): string | undefined {
  let found: string | undefined;
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=\s*(.*)$/);
    if (m !== null && m[1] === name) found = (m[2] ?? "").replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
  return found;
}

/** The environment, then the settings file, then the default. */
function setting(env: Env, settings: string, name: string): string | undefined {
  return Object.hasOwn(env, name) ? env[name] : settingOf(settings, name);
}

export function toolchainChoice(value: string | undefined): ToolchainChoice {
  const v = (value ?? "").trim();
  if (v === "") return { kind: "missing" };
  if (v === "none") return { kind: "none" };
  if (v === "all") return { kind: "all" };
  return { kind: "names", names: v.split(/[\s,]+/).filter((n) => n !== "") };
}

/** The XDG rule: the variable where it is an absolute path, else the default. */
const xdg = (value: string | undefined, fallback: string): string => value !== undefined && absPath(value) !== null ? value : fallback;

export function pathsOf(env: Env, home: AbsPath, workspaces: string): Paths {
  const data = xdg(env.XDG_DATA_HOME, `${home}/.local/share`);
  const state = xdg(env.XDG_STATE_HOME, `${home}/.local/state`);
  const configDir = xdg(env.XDG_CONFIG_HOME, `${home}/.config`);
  const ws = workspaces === "~" ? home : workspaces.startsWith("~/") ? `${home}/${workspaces.slice(2)}` : workspaces;
  return {
    home,
    bin: `${home}/.local/bin`,
    data: `${data}/erga-setup`,
    tools: `${data}/erga-setup/tools`,
    state: `${state}/erga-setup`,
    cache: `${xdg(env.XDG_CACHE_HOME, `${home}/.cache`)}/erga-setup`,
    configDir,
    settingsFile: `${configDir}/erga/setup.env`,
    secretsFile: `${configDir}/erga/secrets.env`,
    installFile: `${configDir}/erga/install.toml`,
    ergaState: `${state}/erga`,
    cargoBin: `${xdg(env.CARGO_HOME, `${home}/.cargo`)}/bin`,
    logDir: env.BOOTSTRAP_LOG_DIR !== undefined && env.BOOTSTRAP_LOG_DIR !== "" ? env.BOOTSTRAP_LOG_DIR : `${home}/.erga-bootstrap/log`,
    workspaces: ws,
    target: `${ws}/github.com/intellectual-frontiers/erga`,
  };
}

export function telemetryOf(env: Env, secrets: (name: string) => string | undefined): Telemetry {
  const lower = (v: string | undefined) => (v ?? "").toLowerCase();
  if (["1", "true", "yes"].includes(lower(env.DO_NOT_TRACK))) return { kind: "refused", why: "DO_NOT_TRACK=1" };
  if (["off", "0", "false", "no"].includes(lower(env.ERGA_OBSERVE))) return { kind: "refused", why: "ERGA_OBSERVE=off" };
  // the token's name in erga's spec is INFRO_ERGA_SIGNAL_INGEST_PRODUCTION_TOKEN; ERGA_SIGNALS_TOKEN is the one this setup has always read, and wins
  const url = (env.ERGA_SIGNALS_URL || secrets("ERGA_SIGNALS_URL") || "").replace(/\/+$/, "");
  const token = env.ERGA_SIGNALS_TOKEN || env.INFRO_ERGA_SIGNAL_INGEST_PRODUCTION_TOKEN || secrets("ERGA_SIGNALS_TOKEN") || "";
  if (url !== "" && token !== "") return { kind: "on", url, token };
  if (url !== "") return { kind: "half", missing: "ERGA_SIGNALS_TOKEN" };
  if (token !== "") return { kind: "half", missing: "ERGA_SIGNALS_URL" };
  return { kind: "off" };
}

export type Cpus = number;

/**
 * The command line and the environment, as options. `home` was checked first (FR-012); `settings` is the text of ~/.config/erga/setup.env, or "".
 */
export function parseOptions(
  argv: readonly string[],
  env: Env,
  home: AbsPath,
  settings: string,
  secrets: (name: string) => string | undefined,
  cpus: Cpus,
): Result<Options, string> {
  let dryRun = false, help = false, patient = env.BOOTSTRAP_PATIENT === "1", mode: Mode = "bootstrap";
  for (const a of argv) {
    switch (a) {
      case "--dry-run":
      case "-n":
        dryRun = true;
        break;
      case "--patient":
        patient = true;
        break;
      case "--setup":
        mode = "setup";
        break;
      case "-h":
      case "--help":
        help = true;
        break;
      default:
        return err(`erga-setup: unknown option ${a} (try --help)`);
    }
  }
  const on = (name: string) => env[name] === "1";
  const jobsDefault = Math.min(6, Math.max(2, cpus * 2));
  const role = setting(env, settings, "ERGA_ROLE");
  return ok({
    mode,
    dryRun,
    help,
    patient,
    switches: {
      packages: !(on("BOOTSTRAP_NO_PACKAGES") || on("BOOTSTRAP_NO_APT")),
      download: !on("BOOTSTRAP_NO_DOWNLOAD"),
      runtime: !on("BOOTSTRAP_NO_RUNTIME"),
      auth: !on("BOOTSTRAP_NO_AUTH"),
      clone: !on("BOOTSTRAP_NO_CLONE"),
      erga: !on("BOOTSTRAP_NO_ERGA"),
      netcheck: !on("BOOTSTRAP_NO_NETCHECK"),
      keepGoing: on("BOOTSTRAP_KEEP_GOING"),
      verbose: on("BOOTSTRAP_VERBOSE"),
    },
    retry: retryPolicy(env, patient),
    jobs: count(env.BOOTSTRAP_JOBS, jobsDefault),
    baseUrl: (env.BOOTSTRAP_URL || DEFAULT_BASE).replace(/\/+$/, ""),
    ergaUrl: env.ERGA_URL || DEFAULT_ERGA,
    rustupUrl: env.BOOTSTRAP_RUSTUP_URL || null,
    role: role !== undefined && role !== "" ? role : null,
    toolchain: toolchainChoice(setting(env, settings, "BOOTSTRAP_TOOLCHAIN")),
    support: env.BOOTSTRAP_SUPPORT || "the Intellectual Frontiers support team",
    telemetry: telemetryOf(env, secrets),
    osRelease: env.BOOTSTRAP_OS_RELEASE || "/etc/os-release",
    paths: pathsOf(env, home, setting(env, settings, "ERGA_WORKSPACES") || `${home}/workspaces`),
  });
}

export const HELP = `Set up a computer for erga, the company's repository (erga's 009-machine-bootstrap). erga-bootstrap.sh (Linux, macOS) and erga-bootstrap.ps1 (Windows)
only get Deno and run this, the setup, which is TypeScript:

  curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/erga-bootstrap.sh | sh
  curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/erga-bootstrap.sh | sh -s -- --dry-run
  irm https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/erga-bootstrap.ps1 | iex          (Windows: WSL 2 and Debian, then the same inside it)

On Linux (the Debian or Arch family, under WSL 2 too) and on a Mac with Apple silicon it:
  1. Packages (the bootstrap only, and the one step with administrator rights: it says why and asks for your password once): git, curl, wget, tar, xz, unzip and
     the C compiler and linker Rust links with, by the names of commons' packaging table, with apt or pacman. A Mac gets no package: the Command Line Tools are checked.
  2. GitHub: gh (the publisher's release, pinned and checked by SHA-256, where none is on the PATH) and the sign-in (a code and a browser); a GH_TOKEN is used instead.
  3. Rust and uv: rustup from the pinned rustup-init (into ~/.rustup and ~/.cargo, no startup file touched) and the pinned uv.
  4. The copy of the private erga repository in ~/workspaces/github.com/intellectual-frontiers/erga (or its fast-forward), the Rust toolchain it names, and there
     bin/setup.sh, ./ergactl repo workspace set --role (with ERGA_ROLE), ./ergactl toolchain ensure, ./ergactl check --quick and, last, ./ergactl doctor.
  5. The links ~/.local/bin/ergactl and arcactl, the record ~/.config/erga/install.toml, and the one optional line that puts erga on your PATH.
It writes none of your dotfiles and no git config, installs no shell, editor or assistant, and is safe to run again.

Options (after \`sh -s --\` when piped):
  --dry-run, -n   list every step it would take, change nothing, fetch nothing, ask for nothing (the bootstrap still gets Deno, which runs this)
  --patient       for a network that drops often (15 tries, longer waits)
  --setup         this account alone, with no administrator rights and no package (what erga-setup.sh did)
  -h, --help      this text

Environment (a "1" switches it on):
  ERGA_URL, ERGA_ROLE, ERGA_WORKSPACES     where to clone erga from; the workspace's role (developer or operator); the workspaces folder (default ~/workspaces)
  GH_TOKEN, GITHUB_TOKEN                   a GitHub token with access to erga: no interactive sign-in
  ERGA_SIGNALS_URL, ERGA_SIGNALS_TOKEN     optional telemetry to ArcaSignals (DO_NOT_TRACK=1 or ERGA_OBSERVE=off turn it off)
  BOOTSTRAP_NO_PACKAGES / BOOTSTRAP_NO_APT, BOOTSTRAP_NO_DOWNLOAD, BOOTSTRAP_NO_RUNTIME, BOOTSTRAP_NO_AUTH, BOOTSTRAP_NO_CLONE, BOOTSTRAP_NO_ERGA, BOOTSTRAP_NO_NETCHECK
  BOOTSTRAP_TOOLCHAIN (names, none or all), BOOTSTRAP_KEEP_GOING, BOOTSTRAP_VERBOSE, BOOTSTRAP_JOBS, BOOTSTRAP_PATIENT, BOOTSTRAP_LOG_DIR, BOOTSTRAP_SUPPORT
  ERGA_RETRIES, ERGA_RETRY_DELAY, ERGA_RETRY_MAX_DELAY   tries and waits for the network (default 8, 3 and 60 seconds)
  ERGA_WSL_DISTRO, ERGA_WSL_USER           Windows only: the distribution (default Debian) and the Linux user (default: asked)
ERGA_WORKSPACES, ERGA_ROLE and BOOTSTRAP_TOOLCHAIN are read from the environment, then from ~/.config/erga/setup.env (one NAME=value a line).

Exit status: 0 done, 1 ergactl's own doctor or check found something to look at, 2 usage, 3 the computer cannot be set up yet, 4 a step failed (the log and a support
file are named), 5 the GitHub sign-in did not finish. Everything is logged to ~/.erga-bootstrap/log/.`;
