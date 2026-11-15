// The machine setup of erga (erga's 009-machine-bootstrap), in TypeScript on Deno. bin/erga-bootstrap.sh (Linux, macOS) and bin/erga-bootstrap.ps1 (Windows) only
// get the pinned Deno and run this. On Linux and a Mac it is the bootstrap (packages, with administrator rights, asked for once) and then the setup of the account
// that runs it, in one process; with --setup it is the setup alone. On Windows it prepares WSL 2 and runs the Linux bootstrap inside (windows.ts).
//
// The run, in order (FR-008: the bootstrap's plan holds every step of the setup's, in the same order, and adds only the packages):
//   packages (bootstrap) -> what the account must have -> preflight -> the network -> gh -> the sign-in -> the token -> access to erga -> identity -> settings kept
//   -> rustup and uv -> the installation record -> workspace and clone -> the Rust toolchain -> erga's commands -> summary, doctor and the one optional line
//
// It runs on IFC TypeScript (commons/ts, commons 0005-typescript-runtime): the kernel's Result, decoders and command-line parser, and the runtime's file system,
// processes, terminal, verified downloads and OpenTelemetry signals, imported by relative path so that Deno resolves them from a checkout and from the raw URL
// the bootstrap gives alike. The run is the root span of its steps (signals.ts), and the screen is their rendering (ui.ts).
import { absurd } from "../../commons/ts/kernel/absurd.ts";
import { done, err, ok } from "../../commons/ts/kernel/result.ts";
import * as fs from "../../commons/ts/runtime/fs.ts";
import { describeFailure, reach, Retries } from "../../commons/ts/runtime/net.ts";
import * as proc from "../../commons/ts/runtime/proc.ts";
import { type Ctx, RunState } from "./context.ts";
import { absPath, type ExitStatus, exitStatusOf, type Phase, type Stop, stop } from "./stop.ts";
import { type Env, HELP, type Options, parseOptions } from "./options.ts";
import { Log, lookOf, shortPath, Ui } from "./ui.ts";
import { deviceId, type Props, resourceOf, startSignals } from "./signals.ts";
import { detect, hostKind, type Platform } from "./platform.ts";
import { Admin, checkPrereqs, installLibraries, installPackages } from "./packages.ts";
import { pinnedPrereqs, setupRuntime, setupRustToolchain } from "./runtime.ts";
import { checkAccess, githubInit, identity, keepSettings, secretOf, signIn } from "./github.ts";
import { workspaceAndClone } from "./clone.ts";
import { runErga } from "./erga.ts";
import { recordInstall } from "./record.ts";
import { finish } from "./finish.ts";
import { hasTerminal, isDir, run, which } from "./proc.ts";
import { closingWords, prepareWindows, type WindowsHost } from "./windows.ts";
import { pin } from "./table.ts";

const readText = async (f: string): Promise<string> => await fs.readTextFile(f).catch(() => "");

/** Before anything is fetched: what would make a long run fail late (FR-050). */
async function preflight(ctx: Ctx, plat: Platform): Promise<void> {
  if (ctx.opts.dryRun) return;
  if (proc.isRoot()) ctx.ui.warn("This runs as root. It works, but everything is then kept in root's home folder; a user of your own (any name) is the usual choice.");
  if (plat.wsl && !(await readText("/proc/version")).includes("WSL2")) {
    ctx.ui.warn("This looks like WSL 1, which lacks what some programs need. Move it to WSL 2 in PowerShell: wsl --set-version <distribution> 2");
  }
  const free = Number((await run(["df", "-k", ctx.opts.paths.home])).output.split("\n")[1]?.trim().split(/\s+/)[3] ?? "NaN") / 1048576;
  if (Number.isFinite(free) && free < 10) {
    ctx.ui.warn(
      `Only ${
        Math.floor(free)
      } GB are free in your home folder, and everything erga uses (the typesetter, the test browser, Java and more) needs about 10 GB. It may stop for want of room; free some space first.`,
    );
  }
}

/** The hosts the setup needs, looked at before the long installs: a name that will not resolve is found in a minute, not ten minutes in (FR-037). */
export const HOSTS = [
  "github.com",
  "api.github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "static.rust-lang.org",
  "index.crates.io",
  "static.crates.io",
] as const;

async function checkNetwork(ctx: Ctx, plat: Platform): Promise<Phase> {
  const s = ctx.opts.switches;
  if (ctx.opts.dryRun || !s.netcheck || (!s.download && !s.clone)) return done;
  ctx.ui.phase(`${ctx.ui.e.sync}Checking the network`);
  const bad: string[] = [];
  let why = "";
  for (const h of HOSTS) {
    const r = await reach(ctx.retries, h);
    if (r.kind === "ok") ctx.ui.log.line(`network: ${h} answers`);
    else {
      why = describeFailure(r.error);
      ctx.ui.log.line(`network: ${h} does not answer (${why})`);
      bad.push(h);
    }
  }
  if (bad.length === 0) return done;
  ctx.ui.phaseDrop();
  ctx.ui.say(`${ctx.ui.e.stop}This computer cannot reach: ${bad.join(" ")} (${why}).`);
  ctx.ui.say("That is the network or DNS, not this setup, and nothing has been changed. Things that usually fix it:");
  ctx.ui.say("  1. Try another network (a phone hotspot is a quick test), or turn a VPN off.");
  ctx.ui.say("  2. Use a different DNS server: 1.1.1.1 or 8.8.8.8.");
  if (plat.wsl) ctx.ui.say("  3. On WSL: in PowerShell run wsl --shutdown, open Debian again, and check that /etc/resolv.conf lists a server.");
  ctx.ui.say(
    "Then run this again. On a network that keeps dropping, add --patient (15 tries, longer waits), or set ERGA_RETRIES=20; BOOTSTRAP_NO_NETCHECK=1 skips this look.",
  );
  return stop({ kind: "unreachable", hosts: bad });
}

function announceTelemetry(ctx: Ctx): void {
  const t = ctx.opts.telemetry;
  const e = ctx.ui.e.radio;
  switch (t.kind) {
    case "refused":
      ctx.ui.say(`${e}Telemetry is off: ${t.why} is set.`); // a person who said no is told only that (FR-053)
      return;
    case "on":
      ctx.ui.say(
        `${e}Telemetry is on: ERGA_SIGNALS_URL and ERGA_SIGNALS_TOKEN are set, so this setup reports to ArcaSignals how long each step takes, and where a failure's log is.`,
      );
      ctx.ui.say(
        "   It sends a device id made from this computer, the kind of computer (WSL, virtual machine) and the system. Also this computer's name and your Linux user name, as erga's own telemetry does. Never a password, a token or a file.",
      );
      return;
    case "half":
      ctx.ui.say(`${e}Telemetry is off: ${t.missing} is not set (both ERGA_SIGNALS_URL and ERGA_SIGNALS_TOKEN are needed to report to ArcaSignals).`);
      return;
    case "off":
      ctx.ui.say(
        `${e}Telemetry is off (optional). To record this setup in ArcaSignals, press Ctrl+C, run export ERGA_SIGNALS_URL=<arca's door> ERGA_SIGNALS_TOKEN=<a token arca issued>, then start again; the setup keeps them for every new terminal.`,
      );
      ctx.ui.say("   Without them nothing breaks; there is just no telemetry.");
      return;
    default:
      return absurd(t);
  }
}

/** The setup of this account (what erga-setup.sh was): no administrator rights; `libraries` is the bootstrap's way to install system libraries, or null. */
async function setupAccount(ctx: Ctx, plat: Platform, libraries: ((pkgs: readonly string[]) => Promise<boolean>) | null): Promise<Phase> {
  const ui = ctx.ui;
  const user = await proc.firstLine(["id", "-un"]);
  ui.say(`${ui.e.rocket}Setting up this account (${plat.pretty}, ${plat.arch}${plat.wsl ? ", under WSL" : ""}, user ${user}) for erga.`);
  if (ctx.opts.dryRun) ui.say("Dry run: this lists the steps and changes nothing.");
  announceTelemetry(ctx);
  const gh = pin("gh").version;
  if (ctx.opts.dryRun) {
    ui.heading(`${ui.e.pkg}What this computer must already have`);
    if (plat.family === "macos") {
      ui.would("check that the Command Line Tools are here (git); if not, stop and say to run: xcode-select --install");
      ui.would(`get gh ${gh} from its publisher's release (checked by SHA-256) into ~/.local/share, where this Mac has none`);
    } else {
      ui.would("check that git and curl are here (and tar, xz, unzip and a C compiler and linker, cc, which some steps need); this setup installs no package");
      ui.would(`get gh ${gh} from its publisher's release (checked by SHA-256) into ~/.local/share, where this account has none`);
    }
  } else {
    const p = await checkPrereqs(ctx, plat);
    if (p.kind === "err") return p;
  }
  await preflight(ctx, plat);
  const steps: (() => Promise<Phase>)[] = [
    () => checkNetwork(ctx, plat),
    () => ctx.opts.dryRun ? Promise.resolve(done) : pinnedPrereqs(ctx, plat), // gh comes after the look at the network, since it is a download; the sign-in needs it
    () => signIn(ctx),
    async () => (await githubInit(ctx), done),
    () => checkAccess(ctx),
    async () => (await identity(ctx), done),
    async () => (await keepSettings(ctx), done),
    () => setupRuntime(ctx, plat),
    async () => (await recordInstall(ctx, plat, await hostKind(ctx.env)), done),
    async () => (await workspaceAndClone(ctx), done),
    () => setupRustToolchain(ctx),
    async () => (await runErga(ctx, libraries), done),
  ];
  for (const s of steps) {
    const r = await s();
    if (r.kind === "err") return r;
  }
  return done;
}

/** The memory of this computer in GiB: Linux's /proc/meminfo, a Mac's sysctl; 0 where neither says. */
async function memoryGb(): Promise<number> {
  const kb = Number((await readText("/proc/meminfo")).match(/^MemTotal:\s+(\d+) kB/m)?.[1] ?? "NaN");
  if (Number.isFinite(kb)) return Math.floor(kb / 1048576);
  const bytes = Number(await proc.firstLine(["sysctl", "-n", "hw.memsize"]));
  return Number.isFinite(bytes) ? Math.floor(bytes / 1073741824) : 0;
}

/** The machine as every signal of a run carries it (FR-054): read only where telemetry is on. */
async function machineProps(env: Env, plat: Platform | null, home: string): Promise<Props> {
  const kind = await hostKind(env);
  const pv = await readText("/proc/version");
  const free = Number((await run(["df", "-k", home])).output.split("\n")[1]?.trim().split(/\s+/)[3] ?? "0") / 1048576;
  return {
    hostname: proc.hostname(),
    os_user: await proc.firstLine(["id", "-un"]),
    host_kind: kind,
    wsl_version: pv.includes("WSL2") ? "2" : /microsoft/i.test(pv) ? "1" : "",
    os_id: plat?.id ?? "",
    os_version: plat?.version ?? "",
    kernel: await proc.firstLine(["uname", "-r"]),
    arch: plat?.arch ?? proc.build.arch,
    cpus: navigator.hardwareConcurrency,
    memory_gb: await memoryGb(),
    disk_free_gb: Number.isFinite(free) ? Math.floor(free) : 0,
  };
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** How a run ended, as the telemetry says it. */
function outcomeOf(status: ExitStatus): string {
  return status === 0 ? "finished" : status === 4 ? "stopped" : status === 5 ? "sign-in-pending" : status === 130 ? "interrupted" : "failed";
}

/** Linux and a Mac: the bootstrap, or the setup alone. */
async function posix(opts: Options, env: Env): Promise<ExitStatus> {
  const paths = opts.paths;
  const t = stamp(new Date());
  let logPath: string | null = null, supportPath: string | null = null;
  if (!opts.dryRun) {
    try {
      await fs.mkdir(paths.logDir, { recursive: true });
      await fs.writeTextFile(`${paths.logDir}/bootstrap-${t}.log`, "");
      logPath = `${paths.logDir}/bootstrap-${t}.log`;
      supportPath = `${paths.logDir}/support-${t}.txt`;
    } catch { /* no log: the stop message says so */ }
  }
  const ui = new Ui(lookOf(env), new Log(logPath, supportPath), opts.dryRun, opts.switches.verbose);
  const st = new RunState();
  const retries = new Retries(opts.retry, (line) => ui.retry(line));
  const work = await fs.makeTempDir({ ...(env.TMPDIR ? { dir: env.TMPDIR } : {}), prefix: "erga-setup." });
  const hasTty = await hasTerminal();
  const plat = await detect(opts.osRelease, env);
  if (plat.kind === "ok") st.platform = plat.value;
  // the telemetry: sent only where it is on and this is no dry run (FR-054); the screen renders its steps either way
  const settings = opts.dryRun ? { kind: "off" as const } : opts.telemetry;
  const runId = `${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 8)}-${new Date().toISOString().slice(11, 19).replaceAll(":", "")}-${proc.pid}`;
  const resource = settings.kind === "on"
    ? resourceOf(await deviceId(env.ERGA_DEVICE_ID_FILE || `${paths.home}/.erga-bootstrap/device-id`), runId, await machineProps(env, st.platform, paths.home))
    : {};
  const signals = startSignals({ settings, resource, journalDir: `${paths.ergaState}/telemetry`, ui });
  const ctx: Ctx = { opts, env, ui, retries, signals, st, work, hasTty };
  const admin = new Admin(proc.uid() ?? 1000);
  const onInt = () => {
    void fs.remove(work, { recursive: true }).catch(() => {}).finally(() => proc.exit(130));
  };
  proc.addSignalListener("SIGINT", onInt);
  proc.addSignalListener("SIGTERM", onInt);
  const originalPath = proc.env.get("PATH") ?? "";

  const steps = async (): Promise<Phase | "notes"> => {
    if (plat.kind === "err") return plat;
    const p = plat.value;
    // ~/.local/bin and ~/.cargo/bin, for this run alone: the line of `ergactl agent-tools shell emit` puts them on the PATH of every shell
    proc.env.set("PATH", `${paths.bin}:${paths.cargoBin}:${originalPath}`);
    if (!opts.dryRun) { for (const d of [paths.bin, paths.data, paths.state, paths.cache]) await fs.mkdir(d, { recursive: true }); }
    if (opts.mode === "bootstrap") {
      ui.say(`${ui.e.rocket}Setting up this computer (${p.pretty}, ${p.arch}${p.wsl ? ", under WSL" : ""}) for erga.`);
      if (opts.dryRun) ui.say("Dry run: this lists the steps and changes nothing.");
      const pk = await installPackages(ctx, p, admin);
      if (pk.kind === "err") return pk;
      ui.heading(`${ui.e.rocket}Setting up erga in this account`);
    }
    const libraries = opts.mode === "bootstrap" ? (pkgs: readonly string[]) => installLibraries(ctx, admin, p.family, pkgs) : null;
    const r = await setupAccount(ctx, p, libraries);
    if (r.kind === "err") return r;
    ui.phaseClose();
    return (await finish(ctx, p, originalPath)) ? done : "notes";
  };

  // the run is the root span of its steps; it ends with how the run ended (FR-054)
  const run0 = plat.kind === "ok" ? { distro: plat.value.id, distro_version: plat.value.version } : {};
  const status = await signals.telemetry.span("bootstrap.run", { method: opts.mode, script: opts.mode, tty: hasTty, ...run0 }, async (span) => {
    const outcome = await steps();
    admin.release();
    let status: ExitStatus;
    if (outcome === "notes") status = 1;
    else if (outcome.kind === "ok") status = 0;
    else {
      status = exitStatusOf(outcome.error);
      say(ctx, outcome.error);
    }
    span.set({
      outcome: outcomeOf(status),
      exit_code: status,
      steps: st.stepNo,
      problems: st.problems.length,
      log_file: logPath === null ? "" : shortPath(paths.home, logPath),
    });
    return status === 0 ? ok(status) : err({ status, message: outcomeOf(status) });
  }).then((r) => r.kind === "ok" ? r.value : r.error.status);
  await signals.close();
  await ui.close();
  await fs.remove(work, { recursive: true }).catch(() => {});
  proc.removeSignalListener("SIGINT", onInt);
  proc.removeSignalListener("SIGTERM", onInt);
  return status;
}

/** What a Stop says, where the part that stopped has not said it already. */
function say(ctx: Ctx, s: Stop): void {
  switch (s.kind) {
    case "cannot-set-up":
      ctx.ui.log.line(`cannot continue: ${s.reason} (fix: ${s.fix})`);
      ctx.ui.sayErr(`${ctx.ui.e.stop}The computer cannot be set up yet: ${s.reason}`);
      ctx.ui.sayErr(`Fix: ${s.fix}`);
      return;
    case "usage":
      ctx.ui.sayErr(s.message);
      return;
    case "step-failed":
    case "unreachable":
    case "sign-in":
    case "interrupted":
      return; // said where it happened
    default:
      return absurd(s);
  }
}

/** wsl.exe writes UTF-16 where it is not told otherwise. */
const decode = (b: Uint8Array): string => new TextDecoder(b.length > 1 && b[1] === 0 ? "utf-16le" : "utf-8").decode(b);

/** Windows: WSL 2, the Linux user, then the Linux bootstrap inside (windows.ts). */
async function windows(opts: Options, env: Env, ui: Ui): Promise<ExitStatus> {
  const host: WindowsHost = {
    run: async (argv, how, extra) => {
      try {
        const out = await proc.output(argv, {
          ...(extra === undefined ? {} : { env: extra }),
          stdin: how === "interactive" ? "inherit" : "null",
          stdout: how === "quiet" ? "piped" : "inherit",
          stderr: how === "quiet" ? "piped" : "inherit",
        });
        return { code: out.code, output: how === "quiet" ? decode(out.stdout) + decode(out.stderr) : "" };
      } catch (e) {
        return { code: 127, output: e instanceof Error ? e.message : String(e) };
      }
    },
    hasWsl: () => which("wsl.exe") !== null || which("wsl") !== null,
    // the one question the renderer cannot ask: the Linux user name, on the terminal itself
    ask: (q) => Promise.resolve(prompt(q) ?? ""),
    programFiles: async () => {
      const root = `${env.ProgramFiles || "C:\\Program Files"}\\PostgreSQL`;
      const out: { name: string; hasPgCtl: boolean }[] = [];
      try {
        for await (const d of fs.readDir(root)) if (d.isDirectory) out.push({ name: d.name, hasPgCtl: isDir(`${root}\\${d.name}\\bin`) });
      } catch { /* none */ }
      return out;
    },
    say: (text) => ui.say(text),
    warn: (text) => ui.sayErr(text),
  };
  const o = await prepareWindows(host, {
    distro: env.ERGA_WSL_DISTRO || "Debian",
    user: env.ERGA_WSL_USER || "",
    bootstrapUrl: env.ERGA_BOOTSTRAP_URL || `${opts.baseUrl}/bin/erga-bootstrap.sh`,
    baseUrl: opts.baseUrl,
    dryRun: opts.dryRun,
  });
  for (const l of closingWords(o, env.ERGA_WSL_DISTRO || "Debian")) {
    if (o.kind === "stopped") ui.sayErr(l);
    else ui.say(l);
  }
  switch (o.kind) {
    case "done":
    case "planned":
      return 0;
    case "notes":
      return 1;
    case "stopped":
      return o.status === 1 || o.status === 2 || o.status === 3 || o.status === 4 || o.status === 5 || o.status === 130 ? o.status : 4;
    default:
      return absurd(o);
  }
}

export async function main(argv: readonly string[], env: Env): Promise<ExitStatus> {
  const isWin = proc.build.os === "windows";
  // what is said before a run has its own screen: the help, a usage error, a home that is not one
  const screen = new Ui(lookOf(env), new Log(null, null), false);
  const early = async (status: ExitStatus, text: string, stream: "out" | "err"): Promise<ExitStatus> => {
    if (stream === "out") screen.say(text);
    else screen.sayErr(text);
    await screen.close();
    return status;
  };
  const homeRaw = env.HOME || (isWin ? env.USERPROFILE ?? "" : "");
  const home = absPath(homeRaw);
  // Everything lives under the home folder: stop before writing anywhere else (FR-012).
  if (home === null || homeRaw === "/" || !isDir(homeRaw)) {
    return await early(
      3,
      `The computer cannot be set up yet: HOME is not a real folder (it is '${homeRaw}').\nFix: run this as the person who will use the computer, in a normal login shell.`,
      "err",
    );
  }
  const configDir = env.XDG_CONFIG_HOME && absPath(env.XDG_CONFIG_HOME) !== null ? env.XDG_CONFIG_HOME : `${home}/.config`;
  const settings = await readText(`${configDir}/erga/setup.env`);
  const secrets = await readText(`${configDir}/erga/secrets.env`);
  const parsed = parseOptions(argv, env, home, settings, (n) => secretOf(secrets, n), navigator.hardwareConcurrency);
  if (parsed.kind === "err") return await early(2, parsed.error, "err");
  const opts = parsed.value;
  if (opts.help) return await early(0, HELP, "out");
  if (!isWin) {
    await screen.close();
    return await posix(opts, env);
  }
  const status = await windows(opts, env, screen);
  await screen.close();
  return status;
}

if (import.meta.main) {
  proc.exit(await main(proc.args, proc.env.toObject()));
}
