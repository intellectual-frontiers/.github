// The one part that uses administrator rights, the bootstrap's (009-machine-bootstrap FR-015, FR-018, FR-020 to FR-023): the packages the computer lacks, with the
// family's own manager and by the names of commons' packaging table, after saying why and asking for the password once. The setup alone never comes here.
import { type Ctx, problem } from "./context.ts";
import { done, err, ok, type Phase, type Result, type Stop } from "./result.ts";
import { adminInstall, adminInstallPrograms, family, type FamilyId, programs, programsOf } from "./table.ts";
import { isExecutable, run, which } from "./proc.ts";
import { retryCommand } from "./net.ts";
import { stepSoft, task } from "./steps.ts";
import type { Platform } from "./platform.ts";

const cannot = (reason: string, fix: string): Result<never, Stop> => err({ kind: "cannot-set-up", reason, fix });

/** The package the family calls a program, or null where the table names none. */
export function packageName(fam: FamilyId, program: string): string | null {
  const p = (programs as Readonly<Record<string, { readonly names: Readonly<Partial<Record<FamilyId, string>>> }>>)[program];
  return p?.names[fam] ?? null;
}

/** The packages the setup needs from the computer, by the family's names; "a|b" is the first of the alternatives the distribution has. */
export function wantedPackages(fam: FamilyId): string[] {
  return programsOf("required").map((p) => packageName(fam, p)).filter((n): n is string => n !== null);
}

/** Administrator rights, asked for once, with the reason first (FR-020), and kept alive for the length of the run. */
export class Admin {
  #ready = false;
  #prefix: readonly string[] = [];
  #keepAlive: ReturnType<typeof setInterval> | null = null;
  constructor(readonly uid: number) {}
  get prefix(): readonly string[] {
    return this.#prefix;
  }
  async get(ctx: Ctx, fam: FamilyId, why: string): Promise<boolean> {
    if (this.#ready) return true;
    if (this.uid === 0) return (this.#ready = true);
    if (which("sudo") === null) return false;
    this.#prefix = ["sudo"];
    const { b, d, z } = ctx.ui.p;
    ctx.ui.say(`${b}${ctx.ui.e.key}I need administrator rights to ${why}.${z}`);
    ctx.ui.say(`${d}Type your ${fam === "macos" ? "Mac" : "Linux"} password when asked, once. Nothing shows while you type: that is normal.${z}`);
    const r = ctx.hasTty ? await run(["sudo", "-v"], { terminal: true }) : await run(["sudo", "-n", "true"]);
    if (r.code !== 0) return false;
    this.#ready = true;
    const keep = setInterval(() => void run(["sudo", "-n", "true"]), 50_000);
    Deno.unrefTimer(keep);
    this.#keepAlive = keep;
    return true;
  }
  release(): void {
    if (this.#keepAlive !== null) clearInterval(this.#keepAlive);
  }
}

/** Whether any of the alternatives "a|b" is installed, by the family's own query. */
async function installed(fam: FamilyId, spec: string): Promise<boolean> {
  const words: readonly string[] = family(fam).queryInstalledWords;
  if (words.length === 0) return false;
  for (const alt of spec.split("|")) {
    const r = await run([...words, alt]);
    if (r.code !== 0) continue;
    if (fam === "debian" && !r.output.includes("install ok installed")) continue;
    return true;
  }
  return false;
}

/** The version the package manager would install, or "" where it has none. */
async function candidate(fam: FamilyId, name: string): Promise<string> {
  const words: readonly string[] = family(fam).queryCandidateWords;
  if (words.length === 0) return "";
  const out = (await run([...words, name])).output;
  const m = fam === "arch" ? out.match(/^Version\s*:\s*(\S+)/m) : out.match(/^\s*Candidate:\s*(\S+)/m);
  const v = m?.[1] ?? "";
  return v === "(none)" ? "" : v;
}

/** The family's command as administrator, with the environment it asks for; apt's quiet flag and lock wait are this setup's own. Never -Sy on Arch (FR-015). */
function managerArgv(admin: Admin, fam: FamilyId, words: readonly string[], args: readonly string[]): string[] {
  const envWord: string = family(fam).environment;
  const extra = fam === "debian" ? ["-qq", "-o", "DPkg::Lock::Timeout=900", "-o", "Acquire::Retries=3"] : [];
  return [...admin.prefix, ...(envWord !== "" ? ["env", envWord] : []), ...words, ...extra, ...args];
}

async function pmInstall(ctx: Ctx, admin: Admin, fam: FamilyId, pkgs: readonly string[], label: string, counted: boolean): Promise<number> {
  const words: readonly string[] = family(fam).installWords;
  let counting;
  if (counted && fam === "debian") {
    // apt prints a line for each package three times: Get (downloaded), Unpacking, Setting up; counting all three makes the number rise from the start
    const sim = await run([...admin.prefix, "env", family(fam).environment, "apt-get", "install", "-s", "-y", ...pkgs]);
    const total = sim.output.split("\n").filter((l) => l.startsWith("Inst ")).length;
    if (total > 0) counting = { re: /^(Get:|Unpacking |Setting up )/, total, div: 3 };
  }
  return await stepSoft(
    ctx,
    label,
    task(async (out) => {
      const r = await retryCommand(ctx.retries, `packages (${fam})`, managerArgv(admin, fam, words, pkgs), { onOutput: out });
      return r.code;
    }),
    counting,
  );
}

/** A Mac: no package manager and no package (FR-018). The Command Line Tools are Apple's and need a person at the screen. */
export async function macNeedTools(): Promise<Phase> {
  if ((await run(["xcode-select", "-p"])).code === 0 && isExecutable("/usr/bin/git")) {
    return which("curl") !== null ? done : cannot("this Mac has no curl, which macOS always carries.", "repair macOS, or run the setup from a Mac that has it");
  }
  return cannot(
    "this Mac has no Command Line Tools, Apple's own set of programs (git and the C compiler and linker that Rust needs among them), and installing them needs a person at the screen.",
    "run  xcode-select --install  in a terminal, click Install in the window that opens, wait for it to finish, then run this setup again",
  );
}

async function macPackages(ctx: Ctx): Promise<Phase> {
  ctx.ui.phase(`${ctx.ui.e.pkg}Checking this Mac`);
  if (ctx.opts.dryRun) {
    ctx.ui.would("check that the Command Line Tools are here (git); if not, stop and say to run: xcode-select --install");
    ctx.ui.would("install no package: macOS has curl, tar and unzip, and the setup gets gh itself");
    return done;
  }
  const t = await macNeedTools();
  if (!t.ok) return t;
  ctx.ui.say("A Mac needs no package from this script: the setup fetches gh itself, into the account's own folder.");
  return done;
}

export async function installPackages(ctx: Ctx, plat: Platform, admin: Admin): Promise<Phase> {
  const fam = plat.family;
  if (fam === "macos") return await macPackages(ctx);
  ctx.ui.phase(`${ctx.ui.e.pkg}Setting up the everyday programs (${fam} family)`);
  if (!plat.tested) ctx.ui.warn(`This is ${plat.pretty}. The bootstrap is made for Debian 12 and 13, Ubuntu 24.04 and 26.04, and Arch; I will go on, and say what does not work.`);
  const missing: string[] = [];
  for (const spec of wantedPackages(fam)) if (!(await installed(fam, spec))) missing.push(spec);
  if (missing.length === 0) {
    ctx.ui.say("Everything the packages give is here.");
    return done;
  }
  const installWords: readonly string[] = family(fam).installWords;
  if (!ctx.opts.switches.packages || which(installWords[0] ?? "") === null) {
    for (const cmd of ["git", "curl"]) {
      if (which(cmd) === null) return cannot(`this computer lacks ${cmd} and I may not install packages.`, adminInstall(fam, missing));
    }
    ctx.ui.warn(`Not installed, because packages are off here: ${missing.join(" ")}`);
    problem(ctx, `packages not installed: ${missing.join(" ")}`);
    return done;
  }
  const refresh: readonly string[] = family(fam).refreshWords;
  if (ctx.opts.dryRun) {
    if (admin.uid !== 0) ctx.ui.would("say why administrator rights are needed and ask for your password, once");
    if (refresh.length === 0) ctx.ui.would(`install with ${family(fam).manager} (--needed, never refreshing the package list alone): ${missing.join(" ")}`);
    else ctx.ui.would(`refresh the package list, then install with ${family(fam).manager}: ${missing.join(" ")}`);
    return done;
  }
  if (admin.uid === 0) ctx.ui.say(`Installing: ${missing.join(" ")}.`);
  if (!(await admin.get(ctx, fam, "install the common programs (git, curl, wget and others)"))) {
    return cannot(
      "I could not get administrator rights (no sudo, or the password was not accepted).",
      `run this again and type your Linux password, or ask an administrator to install: ${missing.join(" ")}`,
    );
  }
  let chosen: string[];
  if (refresh.length === 0) {
    // the table has no refresh for the family (Arch: never -Sy), and the names are its own: a package it cannot find means a list older than the repositories
    chosen = missing;
  } else {
    // One package source that cannot be read must not stop the setup: apt keeps what it knew of it, so the packages are looked for in what it has (FR-021).
    let aptFailed = "";
    if (
      await stepSoft(
        ctx,
        `${ctx.ui.e.list}Checking what is new in Debian`,
        task(async (out) => (await retryCommand(ctx.retries, `packages (${fam})`, managerArgv(admin, fam, refresh, []), { onOutput: out })).code),
      ) !== 0
    ) {
      aptFailed = ctx.st.lastOutput.split("\n").filter((l) => /^(E|W):/.test(l)).slice(0, 2).map((l) => l.slice(0, 170)).join(" ");
      ctx.ui.warn(`apt could not read every package source (${aptFailed || "see the log"}); I go on with what it could read.`);
      problem(ctx, `apt update did not read every package source: ${aptFailed || "see the log"}`);
    }
    chosen = [];
    const lacking: string[] = [];
    for (const spec of missing) {
      let pick: string | null = null;
      for (const alt of spec.split("|")) {
        if ((await candidate(fam, alt)) !== "") {
          pick = alt;
          break;
        }
      }
      if (pick !== null) chosen.push(pick);
      else lacking.push(spec);
    }
    if (aptFailed !== "" && chosen.length === 0) {
      return cannot(
        `apt could not read its package sources, so none of the packages can be found: ${aptFailed}`,
        "check your network and /etc/apt/sources.list.d (a mirror that is down can be replaced by http://archive.ubuntu.com/ubuntu), run: sudo apt update, then run this again",
      );
    }
    if (lacking.length > 0) {
      ctx.ui.warn(`This distribution has no package for: ${lacking.join(" ")}`);
      problem(ctx, `no package for: ${lacking.join(" ")}`);
    }
  }
  if (chosen.length > 0 && (await pmInstall(ctx, admin, fam, chosen, `${ctx.ui.e.pkg}Installing programs`, true)) !== 0) {
    if (fam === "arch" && /target not found|failed retrieving file|could not find/i.test(ctx.st.lastOutput)) {
      return cannot(
        "pacman could not find a package, so its package list is probably older than the repositories (it was not refreshed here: that alone would leave the system partly upgraded).",
        "run: sudo pacman -Syu   then run this again",
      );
    }
    return cannot("the packages could not be installed.", `run: ${adminInstall(fam, chosen)}`);
  }
  return done;
}

/** The system libraries erga says its programs need (FR-023), installed with the rights the bootstrap has; false where packages are off or it could not. */
export async function installLibraries(ctx: Ctx, admin: Admin, fam: FamilyId, pkgs: readonly string[]): Promise<boolean> {
  if (!ctx.opts.switches.packages) return false;
  if (!(await admin.get(ctx, fam, `install the system libraries erga's programs link against (${pkgs.join(" ")})`))) return false;
  // PostgreSQL is nobody here's to install, start or stop: no step of this setup touches it
  return (await pmInstall(ctx, admin, fam, pkgs, `${ctx.ui.e.pkg}Installing system libraries for erga's programs`, false)) === 0;
}

/** What the account must already have: the setup installs no package (FR-016). git and curl stop it; the others are named, with the one command, and it goes on. */
export async function checkPrereqs(ctx: Ctx, plat: Platform): Promise<Phase> {
  if (plat.family === "macos") return await macNeedTools();
  for (const cmd of ["git", "curl"]) {
    if (which(cmd) === null) {
      return cannot(
        `this account has no ${cmd}, and the setup installs no package (it never uses administrator rights).`,
        `from an account that has them, run:  ${adminInstallPrograms(plat.family, [cmd])}   (or run erga-bootstrap.sh, which installs what is needed and then runs this setup)`,
      );
    }
  }
  // unzip and tar unpack what is fetched; cc is the C compiler and linker Rust links with (Thyra and ArcaDrive; no erga command needs it)
  const missing = ["tar", "xz", "unzip", "cc"].filter((c) => which(c) === null);
  if (missing.length === 0) return done;
  ctx.ui.warn(`This account has no ${missing.join(" ")}, which the setup needs for some steps, and it installs no package.`);
  problem(ctx, `missing programs: ${missing.join(" ")} (from an account with administrator rights: ${adminInstallPrograms(plat.family, missing)})`);
  return ok(undefined);
}
