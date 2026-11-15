// The end (009-machine-bootstrap FR-055 to FR-059, FR-101): the summary, ./ergactl doctor, what to do next, and the one optional line for the person's own startup
// file. Nothing here writes any.
import type { Ctx } from "./context.ts";
import type { Platform } from "./platform.ts";
import { handOver } from "./erga.ts";
import { retrySummary } from "./steps.ts";
import { shortPath } from "./ui.ts";

export type Shell = "bash" | "zsh" | "fish";

/** The person's shell, from SHELL; a Mac starts zsh unless the person chose bash. */
export function shellOf(shell: string, os: Platform["os"]): Shell {
  if (shell.endsWith("/zsh")) return "zsh";
  if (shell.endsWith("/fish")) return "fish";
  if (os === "darwin" && !shell.endsWith("/bash")) return "zsh";
  return "bash";
}

/** The one optional line of erga's 010-shell FR-007, and the file to put it in. */
export async function emitLine(sh: Shell, home: string): Promise<{ readonly line: string; readonly file: string }> {
  switch (sh) {
    case "fish":
      return { line: "ergactl agent-tools shell emit fish --json | jq -r .text | source", file: "~/.config/fish/conf.d/erga.fish" };
    case "zsh":
      return { line: 'eval "$(ergactl agent-tools shell emit zsh --json | jq -r .text)"', file: "~/.zshrc" };
    case "bash": {
      // a managed .bashrc that reads ~/.bashrc.local names the file that is the person's own
      const rc = await Deno.readTextFile(`${home}/.bashrc`).catch(() => "");
      return { line: 'eval "$(ergactl agent-tools shell emit bash --json | jq -r .text)"', file: rc.includes(".bashrc.local") ? "~/.bashrc.local" : "~/.bashrc" };
    }
  }
}

/** Returns false where something failed (exit status 1). */
export async function finish(ctx: Ctx, plat: Platform, originalPath: string): Promise<boolean> {
  const ui = ctx.ui;
  const { r, g, y, b, c, d, z } = ui.p;
  const e = ui.e;
  if (ctx.opts.dryRun) {
    ui.say("");
    ui.say("That was a dry run: nothing was changed, fetched or asked.");
    return true;
  }
  ui.heading("Summary");
  let failed = false;
  const st = ctx.st.erga;
  if (st.ran) {
    if (st.setup !== 0) {
      ui.say(`  ${r}${e.cross}${z} bin/setup.sh: the clone could not be made ready for ./ergactl (exit status ${st.setup})`);
      failed = true;
    } else {
      const t = st.toolchain;
      switch (t.kind) {
        case "left-for-sign-in":
          ui.say(`  ${y}-${z} ./ergactl toolchain ensure (left until you sign in to GitHub)`);
          break;
        case "nothing":
          ui.say(`  ${g}-${z} ./ergactl toolchain ensure: nothing to install`);
          break;
        case "ran":
          if (t.code === 0) ui.say(`  ${g}${e.tick}${z} ./ergactl toolchain ensure`);
          else {
            ui.say(`  ${r}${e.cross}${z} ./ergactl toolchain ensure (exit status ${t.code})`);
            failed = true;
          }
          break;
      }
      const k = st.check;
      switch (k.kind) {
        case "absent":
          ui.say(`  ${y}-${z} ./ergactl check --quick: this ergactl has no quick check yet; the full ${b}./ergactl check${z} takes minutes and is yours to run`);
          break;
        case "ran":
          if (k.code === 0) ui.say(`  ${g}${e.tick}${z} ./ergactl check --quick`);
          else {
            ui.say(`  ${r}${e.cross}${z} ./ergactl check --quick (exit status ${k.code})`);
            failed = true;
          }
          break;
      }
    }
    ui.say(
      `  ${d}ergactl and arcactl need no database to start. A command that does (records, the Decisions, the journal) uses a PostgreSQL 18 that you provide and says what is missing: ${z}${b}arcactl pg doctor${z}${d} checks it. On an archon server: ${z}${b}archon pg connect prime --write${z}${d}.${z}`,
    );
    if (st.check.kind === "ran") {
      ui.say(
        `  ${d}The full check, ${z}${b}./ergactl check${z}${d}, checks the whole repository (minutes), and ${z}${b}./ergactl test${z}${d} runs its tests: run them yourself when you want them.${z}`,
      );
    }
  }
  if (ctx.st.problems.length > 0) {
    ui.say("");
    ui.say(`${b}These did not work, and nothing else depended on them:${z}`);
    for (const p of ctx.st.problems) ui.say(`  - ${p}`);
    ui.say("Run this again to retry; what is installed stays.");
  }
  retrySummary(ctx);
  if (ctx.st.skipped.length > 0) {
    ui.say("");
    ui.say(`${y}${b}${e.key}Left until you sign in to GitHub${z} (not a failure):`);
    ui.say(`  ${ctx.st.skipped.join(", ")}`);
    ui.say(
      `Sign in with ${b}GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https${z}, or export ${b}GH_TOKEN${z}, then run this again: it installs just these.`,
    );
  }
  await handOver(ctx);
  if (st.doctor !== 0) {
    ui.say(`  ${y}${e.warn}${z} ./ergactl doctor found something to look at (exit status ${st.doctor}): its next step, above, says what to do.`);
    failed = true;
  }
  const home = ctx.opts.paths.home;
  const target = shortPath(home, ctx.opts.paths.target);
  const bin = ctx.opts.paths.bin;
  ui.say("");
  if (ctx.st.cloned && st.ran && st.setup !== 0) {
    ui.say(`${b}${e.next}Next${z}: in ${target} run ${c}bin/setup.sh${z} to see why it stopped, then run this setup again.`);
  } else if (ctx.st.cloned) {
    ui.say(`${b}${e.next}Next${z}: the step ${c}./ergactl doctor${z} names above. ${c}ergactl help${z} says what each domain of erga does.`);
    ui.say(`Run ergactl from any folder (${shortPath(home, bin)}/ergactl runs the clone's launcher), or as ./ergactl in ${target}.`);
  }
  // The last words: one optional line for the person's own startup file; nothing here wrote any (010-shell FR-007, FR-008; FR-101)
  const { line, file } = await emitLine(shellOf(ctx.env.SHELL ?? "", plat.os), home);
  ui.say("");
  if (originalPath.split(":").includes(bin)) {
    ui.say(`${b}${e.sync}One optional line${z}: for erga's programs, its completions and your erga settings in every new terminal, add this line to ${b}${file}${z}`);
  } else {
    ui.say(
      `${b}${e.sync}One optional line${z}: ${b}${
        shortPath(home, bin)
      }${z}, where erga is, is not on this window's PATH. To have it (and erga's programs, completions and settings) in every new terminal, add this line to ${b}${file}${z}`,
    );
  }
  ui.say("");
  ui.say(`    ${c}${line}${z}`);
  ui.say("");
  ui.say(
    `${d}Leave it out if you manage your own PATH: this setup wrote none of your files. Until then run ergactl as ${z}${b}${
      shortPath(home, bin)
    }/ergactl${z}${d}, or ./ergactl in the clone. ${z}${b}ergactl agent-tools shell status${z}${d} says where things stand.${z}`,
  );
  return !failed;
}
