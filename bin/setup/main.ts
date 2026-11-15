// The machine setup of erga (erga's 009-machine-bootstrap), in TypeScript on Deno. bin/erga-bootstrap.sh (Linux, macOS) and bin/erga-bootstrap.ps1 (Windows) only
// get the pinned Deno and run this. On Linux and a Mac it is the bootstrap (packages, with administrator rights, asked for once) and then the setup of the account
// that runs it, in one process; with --setup it is the setup alone. On Windows it prepares WSL 2 and runs the Linux bootstrap inside (windows.ts).
//
// The run, in order (FR-008: the bootstrap's plan holds every step of the setup's, in the same order, and adds only the packages):
//   packages (bootstrap) -> what the account must have -> preflight -> the network -> gh -> the sign-in -> the token -> access to erga -> identity -> settings kept
//   -> rustup and uv -> the installation record -> workspace and clone -> the Rust toolchain -> erga's commands -> summary, doctor and the one optional line
import { type Ctx, RunState } from "./context.ts";
import { absPath, assertNever, done, type ExitStatus, exitStatusOf, type Phase, type Stop } from "./result.ts";
import { type Env, HELP, type Options, parseOptions } from "./options.ts";
import { Log, lookOf, shortPath, Ui, write } from "./ui.ts";
import { describe, reach, Retries } from "./net.ts";
import { deviceId, type Props, Signals } from "./telemetry.ts";
import { detect, hostKind, type Platform } from "./platform.ts";
import { Admin, checkPrereqs, installLibraries, installPackages } from "./packages.ts";
import { pinnedPrereqs, setupRuntime, setupRustToolchain } from "./runtime.ts";
import { checkAccess, githubInit, identity, keepSettings, secretOf, signIn } from "./github.ts";
import { workspaceAndClone } from "./clone.ts";
import { runErga } from "./erga.ts";
import { recordInstall } from "./record.ts";
import { finish } from "./finish.ts";
import { firstLine, isDir, run, which } from "./proc.ts";
import { closingWords, prepareWindows, type WindowsHost } from "./windows.ts";
import { pin } from "./table.ts";

const readText = async (f: string): Promise<string> => await Deno.readTextFile(f).catch(() => "");

/** Before anything is fetched: what would make a long run fail late (FR-050). */
async function preflight(ctx: Ctx, plat: Platform): Promise<void> {
  if (ctx.opts.dryRun) return;
  if (Deno.uid() === 0) ctx.ui.warn("This runs as root. It works, but everything is then kept in root's home folder; a user of your own (any name) is the usual choice.");
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
    if (r.ok) ctx.ui.log.line(`network: ${h} answers`);
    else {
      why = describe(r.error);
      ctx.ui.log.line(`network: ${h} does not answer (${why})`);
      bad.push(h);
    }
  }
  if (bad.length === 0) return done;
  const { r, b, z, c } = ctx.ui.p;
  ctx.ui.phaseDrop();
  ctx.ui.say(`${r}${b}${ctx.ui.e.stop}This computer cannot reach: ${z}${b}${bad.join(" ")}${z}${r} (${why}).${z}`);
  ctx.ui.say("That is the network or DNS, not this setup, and nothing has been changed. Things that usually fix it:");
  ctx.ui.say(`  ${c}1.${z} Try another network (a phone hotspot is a quick test), or turn a VPN off.`);
  ctx.ui.say(`  ${c}2.${z} Use a different DNS server: 1.1.1.1 or 8.8.8.8.`);
  if (plat.wsl) ctx.ui.say(`  ${c}3.${z} On WSL: in PowerShell run ${b}wsl --shutdown${z}, open Debian again, and check that ${b}/etc/resolv.conf${z} lists a server.`);
  ctx.ui.say(
    `Then run this again. On a network that keeps dropping, add ${b}--patient${z} (15 tries, longer waits), or set ${b}ERGA_RETRIES=20${z}; ${b}BOOTSTRAP_NO_NETCHECK=1${z} skips this look.`,
  );
  return { ok: false, error: { kind: "unreachable", hosts: bad } };
}

function announceTelemetry(ctx: Ctx): void {
  const { d, z, b, g } = ctx.ui.p;
  const t = ctx.opts.telemetry;
  const e = ctx.ui.e.radio;
  switch (t.kind) {
    case "refused":
      ctx.ui.say(`${d}${e}Telemetry is off: ${t.why} is set.${z}`); // a person who said no is told only that (FR-053)
      return;
    case "on":
      ctx.ui.say(
        `${g}${e}Telemetry is on:${z} ${b}ERGA_SIGNALS_URL${z} and ${b}ERGA_SIGNALS_TOKEN${z} are set, so this setup reports to ArcaSignals how long each step takes, and where a failure's log is.`,
      );
      ctx.ui.say(
        `${d}   It sends a device id made from this computer, the kind of computer (WSL, virtual machine) and the system. Also this computer's name and your Linux user name, as erga's own telemetry does. Never a password, a token or a file.${z}`,
      );
      return;
    case "half":
      ctx.ui.say(`${d}${e}Telemetry is off: ${t.missing} is not set (both ERGA_SIGNALS_URL and ERGA_SIGNALS_TOKEN are needed to report to ArcaSignals).${z}`);
      return;
    case "off":
      ctx.ui.say(
        `${d}${e}Telemetry is off (optional). To record this setup in ArcaSignals, press Ctrl+C, run ${z}${b}export ERGA_SIGNALS_URL=<arca's door> ERGA_SIGNALS_TOKEN=<a token arca issued>${z}${d}, then start again; the setup keeps them for every new terminal.`,
      );
      ctx.ui.say(`   Without them nothing breaks; there is just no telemetry.${z}`);
      return;
    default:
      return assertNever(t);
  }
}

/** The setup of this account (what erga-setup.sh was): no administrator rights; `libraries` is the bootstrap's way to install system libraries, or null. */
async function setupAccount(ctx: Ctx, plat: Platform, libraries: ((pkgs: readonly string[]) => Promise<boolean>) | null): Promise<Phase> {
  const ui = ctx.ui;
  const user = await firstLine(["id", "-un"]);
  ui.say(`${ui.p.b}${ui.e.rocket}Setting up this account${ui.p.z} (${plat.pretty}, ${plat.arch}${plat.wsl ? ", under WSL" : ""}, user ${user}) for erga.`);
  if (ctx.opts.dryRun) ui.say(`${ui.p.d}Dry run: this lists the steps and changes nothing.${ui.p.z}`);
  announceTelemetry(ctx);
  ctx.signals.event("bootstrap_started", { method: ctx.opts.mode, tty: ctx.hasTty ? "yes" : "no", distro: plat.id, distro_version: plat.version });
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
    if (!p.ok) return p;
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
    if (!r.ok) return r;
  }
  return done;
}

async function machineProps(env: Env, plat: Platform | null, home: string): Promise<Props> {
  const kind = await hostKind(env);
  const pv = await readText("/proc/version");
  let mem = 0;
  try {
    mem = Math.floor(Deno.systemMemoryInfo().total / 1073741824);
  } catch { /* unknown */ }
  const free = Number((await run(["df", "-k", home])).output.split("\n")[1]?.trim().split(/\s+/)[3] ?? "0") / 1048576;
  return {
    hostname: Deno.hostname(),
    os_user: await firstLine(["id", "-un"]),
    host_kind: kind,
    wsl_version: pv.includes("WSL2") ? "2" : /microsoft/i.test(pv) ? "1" : "",
    os_id: plat?.id ?? "",
    os_version: plat?.version ?? "",
    kernel: Deno.osRelease(),
    arch: plat?.arch ?? Deno.build.arch,
    cpus: navigator.hardwareConcurrency,
    memory_gb: mem,
    disk_free_gb: Number.isFinite(free) ? Math.floor(free) : 0,
  };
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Linux and a Mac: the bootstrap, or the setup alone. */
async function posix(opts: Options, env: Env): Promise<ExitStatus> {
  const paths = opts.paths;
  const t = stamp(new Date());
  let logPath: string | null = null, supportPath: string | null = null;
  if (!opts.dryRun) {
    try {
      await Deno.mkdir(paths.logDir, { recursive: true });
      await Deno.writeTextFile(`${paths.logDir}/bootstrap-${t}.log`, "");
      logPath = `${paths.logDir}/bootstrap-${t}.log`;
      supportPath = `${paths.logDir}/support-${t}.txt`;
    } catch { /* no log: the stop message says so */ }
  }
  const look = lookOf(env);
  const ui = new Ui(look, new Log(logPath, supportPath), opts.dryRun);
  const st = new RunState();
  const retries = new Retries(opts.retry, (line) => {
    write("err", `  ${ui.e.retry}${line}\n`);
    ui.log.line(`retry: ${line}`);
  });
  const work = await Deno.makeTempDir({ dir: env.TMPDIR || undefined, prefix: "erga-setup." });
  const signals = new Signals(
    opts.dryRun ? { kind: "off" } : opts.telemetry,
    `${paths.ergaState}/telemetry`,
    (() => {
      let id: Promise<string> | null = null;
      return () => (id ??= deviceId(env.ERGA_DEVICE_ID_FILE || `${paths.home}/.erga-bootstrap/device-id`));
    })(),
    (() => {
      let m: Promise<Props> | null = null;
      return () => (m ??= machineProps(env, st.platform, paths.home));
    })(),
    () => env.ERGA_PERSON || "",
  );
  let hasTty = false;
  try {
    (await Deno.open("/dev/tty", { read: true })).close();
    hasTty = true;
  } catch { /* no terminal to ask on */ }
  const ctx: Ctx = { opts, env, ui, retries, signals, st, work, hasTty };
  const admin = new Admin(Deno.uid() ?? 1000);
  const onInt = () => {
    void Deno.remove(work, { recursive: true }).catch(() => {}).finally(() => Deno.exit(130));
  };
  Deno.addSignalListener("SIGINT", onInt);
  Deno.addSignalListener("SIGTERM", onInt);
  const originalPath = Deno.env.get("PATH") ?? "";

  const outcome = await (async (): Promise<Phase | "notes"> => {
    const plat = await detect(opts.osRelease, env);
    if (!plat.ok) return plat;
    st.platform = plat.value;
    const p = plat.value;
    // ~/.local/bin and ~/.cargo/bin, for this run alone: the line of `ergactl agent-tools shell emit` puts them on the PATH of every shell
    Deno.env.set("PATH", `${paths.bin}:${paths.cargoBin}:${originalPath}`);
    if (!opts.dryRun) { for (const d of [paths.bin, paths.data, paths.state, paths.cache]) await Deno.mkdir(d, { recursive: true }); }
    if (opts.mode === "bootstrap") {
      ui.say(`${ui.p.b}${ui.e.rocket}Setting up this computer${ui.p.z} (${p.pretty}, ${p.arch}${p.wsl ? ", under WSL" : ""}) for erga.`);
      if (opts.dryRun) ui.say(`${ui.p.d}Dry run: this lists the steps and changes nothing.${ui.p.z}`);
      signals.event("bootstrap_started", { tty: hasTty ? "yes" : "no", distro: p.id, distro_version: p.version, script: "bootstrap" });
      const pk = await installPackages(ctx, p, admin);
      if (!pk.ok) return pk;
      ui.heading(`${ui.e.rocket}Setting up erga in this account`);
    }
    const libraries = opts.mode === "bootstrap" ? (pkgs: readonly string[]) => installLibraries(ctx, admin, p.family, pkgs) : null;
    const r = await setupAccount(ctx, p, libraries);
    if (!r.ok) return r;
    ui.phaseClose();
    return (await finish(ctx, p, originalPath)) ? done : "notes";
  })();
  admin.release();

  let status: ExitStatus;
  if (outcome === "notes") status = 1;
  else if (outcome.ok) status = 0;
  else {
    status = exitStatusOf(outcome.error);
    say(ctx, outcome.error);
  }
  if (!opts.dryRun) {
    const oc = status === 0 ? "finished" : status === 4 ? "stopped" : status === 5 ? "sign-in-pending" : status === 130 ? "interrupted" : "failed";
    signals.event("bootstrap_finished", {
      outcome: oc,
      exit_code: status,
      duration_ms: Date.now() - signals.started,
      steps: st.stepNo,
      problems: st.problems.length,
      log_file: logPath === null ? "" : shortPath(paths.home, logPath),
    });
    await signals.wait();
  }
  await Deno.remove(work, { recursive: true }).catch(() => {});
  Deno.removeSignalListener("SIGINT", onInt);
  Deno.removeSignalListener("SIGTERM", onInt);
  return status;
}

/** What a Stop says, where the part that stopped has not said it already. */
function say(ctx: Ctx, s: Stop): void {
  const { r, b, z } = ctx.ui.p;
  switch (s.kind) {
    case "cannot-set-up":
      ctx.ui.log.line(`cannot continue: ${s.reason} (fix: ${s.fix})`);
      ctx.ui.sayErr(`${r}${b}${ctx.ui.e.stop}The computer cannot be set up yet:${z} ${s.reason}`);
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
      return assertNever(s);
  }
}

/** Windows: WSL 2, the Linux user, then the Linux bootstrap inside (windows.ts). */
async function windows(opts: Options, env: Env): Promise<ExitStatus> {
  const host: WindowsHost = {
    run: async (argv, how, extra) => {
      const [cmd, ...args] = argv;
      if (cmd === undefined) return { code: 127, output: "" };
      try {
        const out = await new Deno.Command(cmd, {
          args,
          env: extra as Record<string, string> | undefined,
          stdin: how === "interactive" ? "inherit" : "null",
          stdout: how === "quiet" ? "piped" : "inherit",
          stderr: how === "quiet" ? "piped" : "inherit",
        }).output();
        const dec = (b: Uint8Array) => new TextDecoder(b.length > 1 && b[1] === 0 ? "utf-16le" : "utf-8").decode(b);
        return { code: out.code, output: how === "quiet" ? dec(out.stdout) + dec(out.stderr) : "" };
      } catch (e) {
        return { code: 127, output: e instanceof Error ? e.message : String(e) };
      }
    },
    hasWsl: () => which("wsl.exe") !== null || which("wsl") !== null,
    ask: (q) => Promise.resolve(prompt(q) ?? ""),
    programFiles: async () => {
      const root = `${env.ProgramFiles || "C:\\Program Files"}\\PostgreSQL`;
      const out: { name: string; hasPgCtl: boolean }[] = [];
      try {
        for await (const d of Deno.readDir(root)) if (d.isDirectory) out.push({ name: d.name, hasPgCtl: isDir(`${root}\\${d.name}\\bin`) });
      } catch { /* none */ }
      return out;
    },
    say: (text) => write("out", `${text}\n`),
    warn: (text) => write("err", `${text}\n`),
  };
  const o = await prepareWindows(host, {
    distro: env.ERGA_WSL_DISTRO || "Debian",
    user: env.ERGA_WSL_USER || "",
    bootstrapUrl: env.ERGA_BOOTSTRAP_URL || `${opts.baseUrl}/bin/erga-bootstrap.sh`,
    baseUrl: opts.baseUrl,
    dryRun: opts.dryRun,
  });
  for (const l of closingWords(o, env.ERGA_WSL_DISTRO || "Debian")) write(o.kind === "stopped" ? "err" : "out", `${l}\n`);
  switch (o.kind) {
    case "done":
    case "planned":
      return 0;
    case "notes":
      return 1;
    case "stopped":
      return o.status === 1 || o.status === 2 || o.status === 3 || o.status === 4 || o.status === 5 || o.status === 130 ? o.status : 4;
    default:
      return assertNever(o);
  }
}

export async function main(argv: readonly string[], env: Env): Promise<ExitStatus> {
  const isWin = Deno.build.os === "windows";
  const homeRaw = env.HOME || (isWin ? env.USERPROFILE ?? "" : "");
  const home = absPath(homeRaw);
  // Everything lives under the home folder: stop before writing anywhere else (FR-012).
  if (home === null || homeRaw === "/" || !isDir(homeRaw)) {
    write(
      "err",
      `The computer cannot be set up yet: HOME is not a real folder (it is '${homeRaw}').\nFix: run this as the person who will use the computer, in a normal login shell.\n`,
    );
    return 3;
  }
  const configDir = env.XDG_CONFIG_HOME && absPath(env.XDG_CONFIG_HOME) !== null ? env.XDG_CONFIG_HOME : `${home}/.config`;
  const settings = await readText(`${configDir}/erga/setup.env`);
  const secrets = await readText(`${configDir}/erga/secrets.env`);
  const parsed = parseOptions(argv, env, home, settings, (n) => secretOf(secrets, n), navigator.hardwareConcurrency);
  if (!parsed.ok) {
    write("err", `${parsed.error}\n`);
    return 2;
  }
  const opts = parsed.value;
  if (opts.help) {
    write("out", `${HELP}\n`);
    return 0;
  }
  return isWin ? await windows(opts, env) : await posix(opts, env);
}

if (import.meta.main) {
  Deno.exit(await main(Deno.args, Deno.env.toObject()));
}
