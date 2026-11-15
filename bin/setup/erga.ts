// erga, in the clone (009-machine-bootstrap FR-055 to FR-058, FR-089): bin/setup.sh (the pinned Deno, the workspace's packages and generated files; without it no
// ./ergactl runs), ./ergactl repo workspace set --role, ./ergactl toolchain ensure, ./ergactl check --quick and, last, ./ergactl doctor. Every one after
// bin/setup.sh runs even when one before it failed; none runs where bin/setup.sh failed.
import { type Ctx, problem, skipGithub } from "./context.ts";
import type { ToolchainChoice } from "./options.ts";
import { exists, isExecutable, run } from "./proc.ts";
import { command, stepSoft } from "./steps.ts";
import { githubReady } from "./github.ts";
import { shortPath, write } from "./ui.ts";

/** In the clone, for a step: every question answered yes (FR-065), no administrator rights, no progress lines, and its events said to come from a setup. */
const quiet = { ERGA_ASSUME_YES: "1", ERGA_NO_ADMIN: "1", ERGA_ENVIRONMENT: "bootstrap", ERGA_PROGRESS: "never" };
const inErga = (ctx: Ctx, argv: readonly string[]) => command(argv, { cwd: ctx.opts.paths.target, env: quiet });

const WRAPPER_MARK = "erga-setup wrapper";

/** ~/.local/bin/NAME runs the clone's launcher of that name, so that the command works from any folder (FR-058). */
export async function linkLauncher(ctx: Ctx, name: string): Promise<void> {
  const { target, bin } = ctx.opts.paths;
  const launcher = `${target}/${name}`;
  if (!isExecutable(launcher)) return; // a copy of erga with no such launcher has nothing to link
  await Deno.mkdir(bin, { recursive: true });
  const w = `${bin}/${name}`;
  const link = await Deno.readLink(w).catch(() => null);
  if (link !== null) {
    const a = await Deno.realPath(w).catch(() => null);
    const b = await Deno.realPath(launcher).catch(() => null);
    if (a !== null && a === b) return; // a link to the clone's launcher (a person's, or an earlier erga's) is already right
    if (a === null) await Deno.remove(w); // a link to a clone that is gone
  }
  const mine = !exists(w) || (await Deno.readTextFile(w).catch(() => "")).includes(WRAPPER_MARK);
  if (mine) {
    await Deno.writeTextFile(w, `#!/bin/sh\n# ${WRAPPER_MARK}: runs the clone's launcher, so ${name} works from any folder\nexec "${target}/${name}" "$@"\n`);
    await Deno.chmod(w, 0o755);
  } else if (link !== null) {
    ctx.ui.warn(`${w} is a link to ${link}, not to this copy of erga, so I left it; run ${name} as ${launcher}`);
  } else {
    ctx.ui.warn(`${w} is a file of yours, so I left it; run ${name} as ${launcher}`);
  }
}

/** A wrapper this setup made for the retired Rust `erga` or `arca` goes where the clone no longer has that launcher; a file or link of the person's stays. */
async function unlinkRetired(ctx: Ctx, name: string): Promise<void> {
  if (isExecutable(`${ctx.opts.paths.target}/${name}`)) return;
  const w = `${ctx.opts.paths.bin}/${name}`;
  const st = await Deno.lstat(w).catch(() => null);
  if (st !== null && st.isFile && (await Deno.readTextFile(w).catch(() => "")).includes(WRAPPER_MARK)) await Deno.remove(w);
}

/** One entry of `ergactl toolchain list --json`, as far as the setup reads it. */
type ListEntry = { readonly name: string; readonly found: unknown; readonly optional: boolean; readonly systemPackages: readonly string[] };
type List = { readonly entries: readonly ListEntry[]; readonly systemPackages: readonly string[]; readonly systemCommand: string } | null;

const strings = (x: unknown): string[] => Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : [];
const record = (x: unknown): Readonly<Record<string, unknown>> | null => typeof x === "object" && x !== null && !Array.isArray(x) ? x as Record<string, unknown> : null;

/** The JSON of `ergactl toolchain list --json`, parsed at the boundary; null where it is not JSON with `data` (an ergactl that prints its table). */
export function parseList(text: string): List {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  const top = record(doc);
  if (top === null) return null;
  const data = top.data;
  const dataObj = record(data);
  const entries: ListEntry[] = Array.isArray(data)
    ? data.map(record).filter((e): e is Readonly<Record<string, unknown>> => e !== null && typeof e.name === "string").map((e) => ({
      name: String(e.name),
      found: e.found ?? null,
      optional: e.optional === true,
      systemPackages: strings(e.system_packages),
    }))
    : [];
  if (!Array.isArray(data) && dataObj === null) return null;
  const union = [...new Set(entries.flatMap((e) => e.systemPackages))];
  const pkgs = strings(top.system_packages).length > 0 ? strings(top.system_packages) : dataObj !== null ? strings(dataObj.system_packages) : union;
  const action = (Array.isArray(top.actions) ? top.actions : []).map(record).find((a) => a !== null && a.title === "Install the system packages");
  const cmd = typeof top.system_command === "string"
    ? top.system_command
    : dataObj !== null && typeof dataObj.system_command === "string"
    ? dataObj.system_command
    : typeof action?.command === "string"
    ? action.command.replace(/^sudo /, "")
    : "";
  return { entries, systemPackages: pkgs, systemCommand: cmd };
}

/** The names of `ergactl toolchain list`: from its JSON where it gives one, else from its table (the name, the version, then where it comes from). */
export function toolchainNamesOf(text: string, which: "all" | "missing"): string[] {
  const list = parseList(text);
  if (list !== null && list.entries.length > 0) {
    return list.entries.filter((e) => which === "all" || (e.found === null && !e.optional)).map((e) => e.name);
  }
  return text.split("\n").filter((l) => /^[a-z][a-z0-9-]*\s/.test(l) && l.trim().split(/\s+/).length >= 2)
    .filter((l) => which === "all" || / downloaded at its pin /.test(l)).map((l) => l.split(/\s+/)[0] ?? "").filter((n) => n !== "");
}

async function listOutput(ctx: Ctx): Promise<string> {
  const r = await run(["./ergactl", "toolchain", "list", "--json"], { cwd: ctx.opts.paths.target });
  return r.code === 0 ? r.output : "";
}

/**
 * The system libraries erga's own programs link against, which erga names from its own declarations (FR-023): the bootstrap installs them with the rights it has
 * (`install`); the setup alone names the one command for a person who has them, and goes on.
 */
async function systemLibraries(ctx: Ctx, install: ((pkgs: readonly string[]) => Promise<boolean>) | null): Promise<void> {
  const list = parseList(await listOutput(ctx));
  if (list === null || list.systemPackages.length === 0) return;
  if (install !== null && await install(list.systemPackages)) return;
  const pk = list.systemPackages.join(" ");
  ctx.ui.warn(
    `erga's programs need these system libraries, which only an account with administrator rights can install: ${pk}. From such an account run: sudo ${list.systemCommand}`,
  );
  problem(ctx, `system libraries are missing: ${pk} (from an account with administrator rights: sudo ${list.systemCommand})`);
}

/** Whether this ergactl has the quick check (FR-057): an ergactl without it is not given a check that takes minutes in its place. */
async function hasQuickCheck(ctx: Ctx): Promise<boolean> {
  return (await run(["./ergactl", "repository", "check", "--help"], { cwd: ctx.opts.paths.target })).output.includes("--quick");
}

async function names(ctx: Ctx, choice: ToolchainChoice): Promise<string[]> {
  switch (choice.kind) {
    case "none":
      return [];
    case "all":
      return toolchainNamesOf(await listOutput(ctx), "all");
    case "missing":
      return toolchainNamesOf(await listOutput(ctx), "missing");
    case "names":
      return [...choice.names];
  }
}

export async function runErga(ctx: Ctx, installLibraries: ((pkgs: readonly string[]) => Promise<boolean>) | null): Promise<void> {
  const ui = ctx.ui;
  const { target } = ctx.opts.paths;
  const s = ctx.opts.switches;
  ui.heading(`${ui.e.rocket}erga`);
  if (ctx.opts.dryRun) {
    if (!s.clone || !s.erga) return;
    ui.would("link ~/.local/bin/ergactl and ~/.local/bin/arcactl to the clone's launchers");
    ui.would(
      "run in the clone: bin/setup.sh (the pinned Deno into erga's toolchain store, then deno.json, the packages of deno.lock and the generated files; a few minutes the first time, once)",
    );
    if (ctx.opts.role !== null) ui.would(`run in the clone: ./ergactl repo workspace set --role ${ctx.opts.role} (this workspace's role, erga 009-machine-bootstrap FR-089)`);
    ui.would(
      "ask erga which system libraries its programs need that this computer lacks (./ergactl toolchain list); the bootstrap installs them with the package manager, the setup alone names the one command for an administrator",
    );
    ui.would("run in the clone: ./ergactl toolchain ensure (every entry of ./ergactl toolchain list that ergactl downloads at its pin)");
    ui.would(
      "run in the clone: ./ergactl check --quick, where this ergactl has it (the sections that compile or run every test left out; the full ./ergactl check takes minutes and is left to you)",
    );
    ui.would("run in the clone, last: ./ergactl doctor, which says what to do next");
    return;
  }
  if (!ctx.st.cloned || !isExecutable(`${target}/ergactl`)) {
    ui.say("erga's ./ergactl is not here yet, so I ran none of its commands.");
    return;
  }
  await linkLauncher(ctx, "ergactl");
  await linkLauncher(ctx, "arcactl");
  await unlinkRetired(ctx, "erga");
  await unlinkRetired(ctx, "arca");
  if (!s.erga) {
    ui.say("Skipped erga's commands (BOOTSTRAP_NO_ERGA=1).");
    return;
  }
  const st = ctx.st.erga;
  st.ran = true;
  ui.phase(`${ui.e.rocket}Getting erga ready ${ui.p.d}(the first time takes a few minutes, once)${ui.p.z}`);
  // bin/setup.sh: the pinned Deno (checked by SHA-256) into erga's toolchain store, then deno.json, the packages of deno.lock and the generated files
  st.setup = await stepSoft(ctx, `${ui.e.dl}Getting Deno and erga's packages ready (bin/setup.sh)`, inErga(ctx, ["./bin/setup.sh"]));
  if (st.setup !== 0) {
    problem(ctx, `erga's bin/setup.sh did not finish, so no ./ergactl command was run (in ${shortPath(ctx.opts.paths.home, target)} run: bin/setup.sh, to see why)`);
    ui.phaseClose();
    return;
  }
  // The workspace's role, before the programs, so that the toolchain installs what the role needs (FR-089); none given, the workspace is a developer's.
  if (ctx.opts.role !== null) {
    const role = ctx.opts.role;
    if (await stepSoft(ctx, `${ui.e.ok}Recording this workspace as a ${role}'s`, inErga(ctx, ["./ergactl", "repo", "workspace", "set", "--role", role])) !== 0) {
      problem(ctx, `ergactl repo workspace set --role ${role} did not finish (run it in ${shortPath(ctx.opts.paths.home, target)} to see why)`);
    }
  } else {
    ui.say("This workspace is a developer's; ./ergactl repo workspace set --role operator makes it an operator's (ERGA_ROLE=operator does it here).");
  }
  const toEnsure = await names(ctx, ctx.opts.toolchain);
  if (toEnsure.length > 0 && !githubReady(ctx)) {
    st.toolchain = { kind: "left-for-sign-in" };
    ui.say(`Left until you sign in to GitHub: ./ergactl toolchain ensure (${toEnsure.join(" ")}).`);
    skipGithub(ctx, `ergactl toolchain ensure: ${toEnsure.join(" ")}`);
  } else if (toEnsure.length > 0) {
    await systemLibraries(ctx, installLibraries);
    st.toolchain = { kind: "ran", code: await stepSoft(ctx, `${ui.e.pkg}Installing the programs erga uses`, inErga(ctx, ["./ergactl", "toolchain", "ensure", ...toEnsure])) };
  }
  if (await hasQuickCheck(ctx)) {
    st.check = { kind: "ran", code: await stepSoft(ctx, `${ui.e.ok}Checking that erga is healthy (a quick check)`, inErga(ctx, ["./ergactl", "check", "--quick"])) };
  } else {
    ui.log.line("this ergactl has no check --quick, so no check was run; the full check is ./ergactl check");
  }
  ui.phaseClose();
  if (st.check.kind === "ran" && st.check.code !== 0) {
    ui.say(`${ui.p.y}${ui.e.warn}erga's own checks found things to look at (setup itself is fine):${ui.p.z}`);
    for (const l of ctx.st.lastOutput.split("\n").filter((x) => /❌|❎|\[[a-z-]+\]/.test(x)).slice(0, 12)) ui.say(`   ${l}`);
  }
}

/** ./ergactl doctor, last (FR-055, FR-056): how this computer stands and the next step; its output is shown whole, and kept in the log. */
export async function handOver(ctx: Ctx): Promise<void> {
  const st = ctx.st.erga;
  if (!st.ran || st.setup !== 0) return;
  ctx.ui.heading(`${ctx.ui.e.ok}ergactl doctor: how this computer stands`);
  const r = await run(["./ergactl", "doctor"], { cwd: ctx.opts.paths.target, env: { ERGA_ASSUME_YES: "1", ERGA_NO_ADMIN: "1", ERGA_ENVIRONMENT: "bootstrap" } });
  st.doctor = r.code;
  write("out", r.output);
  ctx.st.stepNo++;
  ctx.ui.log.raw(`\n==== STEP ${ctx.st.stepNo}: ./ergactl doctor (exit ${r.code})\n${r.output}`);
  ctx.signals.event("bootstrap_step", { step: "ergactl doctor", phase: "erga", outcome: r.code === 0 ? "ok" : "failed", exit_code: r.code, step_no: ctx.st.stepNo });
}
