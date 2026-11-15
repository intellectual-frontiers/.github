// The end (009-machine-bootstrap FR-055 to FR-059, FR-101): the summary, ./ergactl doctor, what to do next, and the one optional line for the person's own startup
// file. Nothing here writes any.
import { absurd } from "../../commons/ts/kernel/absurd.ts";
import * as fs from "../../commons/ts/runtime/fs.ts";
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
      const rc = await fs.readTextFile(`${home}/.bashrc`).catch(() => "");
      return { line: 'eval "$(ergactl agent-tools shell emit bash --json | jq -r .text)"', file: rc.includes(".bashrc.local") ? "~/.bashrc.local" : "~/.bashrc" };
    }
    default:
      return absurd(sh);
  }
}

/** Returns false where something failed (exit status 1). */
export async function finish(ctx: Ctx, plat: Platform, originalPath: string): Promise<boolean> {
  const ui = ctx.ui;
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
      ui.say(`  ${e.cross} bin/setup.sh: the clone could not be made ready for ./ergactl (exit status ${st.setup})`);
      failed = true;
    } else {
      const t = st.toolchain;
      switch (t.kind) {
        case "left-for-sign-in":
          ui.say(`  - ./ergactl toolchain ensure (left until you sign in to GitHub)`);
          break;
        case "nothing":
          ui.say(`  - ./ergactl toolchain ensure: nothing to install`);
          break;
        case "ran":
          if (t.code === 0) ui.say(`  ${e.tick} ./ergactl toolchain ensure`);
          else {
            ui.say(`  ${e.cross} ./ergactl toolchain ensure (exit status ${t.code})`);
            failed = true;
          }
          break;
        default:
          absurd(t);
      }
      const k = st.check;
      switch (k.kind) {
        case "absent":
          ui.say(`  - ./ergactl check --quick: this ergactl has no quick check yet; the full ./ergactl check takes minutes and is yours to run`);
          break;
        case "ran":
          if (k.code === 0) ui.say(`  ${e.tick} ./ergactl check --quick`);
          else {
            ui.say(`  ${e.cross} ./ergactl check --quick (exit status ${k.code})`);
            failed = true;
          }
          break;
        default:
          absurd(k);
      }
    }
    ui.say(
      `  ergactl and arcactl need no database to start. A command that does (records, the Decisions, the journal) uses a PostgreSQL 18 that you provide and says what is missing: arcactl pg doctor checks it. On an archon server: archon pg connect prime --write.`,
    );
    if (st.check.kind === "ran") {
      ui.say(
        `  The full check, ./ergactl check, checks the whole repository (minutes), and ./ergactl test runs its tests: run them yourself when you want them.`,
      );
    }
  }
  if (ctx.st.problems.length > 0) {
    ui.say("");
    ui.say(`These did not work, and nothing else depended on them:`);
    for (const p of ctx.st.problems) ui.say(`  - ${p}`);
    ui.say("Run this again to retry; what is installed stays.");
  }
  retrySummary(ctx);
  if (ctx.st.skipped.length > 0) {
    ui.say("");
    ui.say(`${e.key}Left until you sign in to GitHub (not a failure):`);
    ui.say(`  ${ctx.st.skipped.join(", ")}`);
    ui.say(
      `Sign in with GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https, or export GH_TOKEN, then run this again: it installs just these.`,
    );
  }
  await handOver(ctx);
  if (st.doctor !== 0) {
    ui.say(`  ${e.warn} ./ergactl doctor found something to look at (exit status ${st.doctor}): its next step, above, says what to do.`);
    failed = true;
  }
  const home = ctx.opts.paths.home;
  const target = shortPath(home, ctx.opts.paths.target);
  const bin = ctx.opts.paths.bin;
  ui.say("");
  if (ctx.st.cloned && st.ran && st.setup !== 0) {
    ui.say(`${e.next}Next: in ${target} run bin/setup.sh to see why it stopped, then run this setup again.`);
  } else if (ctx.st.cloned) {
    ui.say(`${e.next}Next: the step ./ergactl doctor names above. ergactl help says what each domain of erga does.`);
    ui.say(`Run ergactl from any folder (${shortPath(home, bin)}/ergactl runs the clone's launcher), or as ./ergactl in ${target}.`);
  }
  // The last words: one optional line for the person's own startup file; nothing here wrote any (010-shell FR-007, FR-008; FR-101)
  const { line, file } = await emitLine(shellOf(ctx.env.SHELL ?? "", plat.os), home);
  ui.say("");
  if (originalPath.split(":").includes(bin)) {
    ui.say(`${e.sync}One optional line: for erga's programs, its completions and your erga settings in every new terminal, add this line to ${file}`);
  } else {
    ui.say(
      `${e.sync}One optional line: ${
        shortPath(home, bin)
      }, where erga is, is not on this window's PATH. To have it (and erga's programs, completions and settings) in every new terminal, add this line to ${file}`,
    );
  }
  ui.say("");
  ui.say(`    ${line}`);
  ui.say("");
  ui.say(
    `Leave it out if you manage your own PATH: this setup wrote none of your files. Until then run ergactl as ${
      shortPath(home, bin)
    }/ergactl, or ./ergactl in the clone. ergactl agent-tools shell status says where things stand.`,
  );
  return !failed;
}
