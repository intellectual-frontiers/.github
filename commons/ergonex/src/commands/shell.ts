// Spec: 0003-host FR-017
/**
 * `ergonex shell` (commons 0003-host FR-017 to FR-019, 0001-ergonex FR-020, FR-021): `ergonex shell <bash|zsh|fish|pwsh|nu>` prints the snippet for that shell on standard output and writes nothing; `--install`
 * shows a unified diff of the one marked block it would write in the shell's start-up file and asks, and writes only after a yes (and ends with a usage failure where there is no terminal and no
 * `--yes`); `--uninstall` removes exactly that block. Neither creates a start-up file that is not there: where it is absent `--install` writes nothing and says the command that creates it (0003-host FR-026). Run twice, `--install` leaves one block. Only the printing form writes no evidence record: it is what a start-up file may run at every start.
 *
 * @module
 */
import { flag, value } from "../platform/k-args.ts";
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import { existsSync, readTextFile, writeTextFile } from "../platform/r-fs.ts";
import { unifiedDiff } from "../diff.ts";
import { describeBlockError, installBlock, removeBlock } from "../shell/block.ts";
import { type Completions, createCommand, isShell, rcFileFor, SHELLS, snippetFor } from "../shell/snippet.ts";
import { defineCommand, GLOBAL_OPTIONS, type ErgonexModule } from "../modules/types.ts";

const OPTIONS = {
  ...GLOBAL_OPTIONS,
  install: flag({
    help: "Show a diff of the block this would write to the shell's start-up file, ask, and write it.",
  }),
  uninstall: flag({
    help: "Remove exactly the block `--install` wrote, after showing the diff and asking.",
  }),
  rc: value({
    help: "The start-up file to use instead of the shell's own.",
    valueName: "FILE",
  }),
  yes: flag({ help: "Do not ask: write after showing the diff." }),
};

const shell = defineCommand({
  name: "shell",
  summary:
    "Print the snippet for a shell (bash, zsh, fish, pwsh, nu); --install writes one marked block after showing a diff, --uninstall removes it.",
  options: OPTIONS,
  operands: [{ name: "SHELL", help: `One of ${SHELLS.join(", ")}.`, arity: "one" }],
  run: async (ctx, args) => {
    const [word = ""] = args.positionals;
    if (!isShell(word))
      return err({
        kind: "usage",
        message: `${JSON.stringify(word)} is not a shell ergonex knows: ${SHELLS.join(", ")}`,
      });
    if (args.options.install && args.options.uninstall)
      return err({
        kind: "usage",
        message: "--install and --uninstall are two things; give one",
      });
    const completions: Completions = ctx.builtins.map((m) => ({
      module: m.name,
      commands: m.commands.map((c) => c.name),
    }));
    const snippet = snippetFor(word, {
      home: ctx.globals.home === undefined ? { kind: "default" } : { kind: "path", path: ctx.globals.home },
      completions,
    });
    if (!args.options.install && !args.options.uninstall)
      return ok({
        text: snippet.replace(/\n$/, ""),
        data: null,
        findings: [],
        noEvidence: true,
      });

    const home = ctx.env["HOME"] ?? ctx.env["USERPROFILE"];
    const rc =
      args.options.rc ??
      (home === undefined
        ? undefined
        : rcFileFor(word, {
            home,
            xdgConfigHome: ctx.env["XDG_CONFIG_HOME"],
            zdotdir: ctx.env["ZDOTDIR"],
            windows: ctx.platform.windows,
            darwin: ctx.platform.os === "darwin",
          }));
    if (rc === undefined)
      return err({
        kind: "environment",
        message: "the start-up file cannot be found: HOME is not set; give --rc FILE",
      });
    const before = existsSync(rc) ? await readTextFile(rc) : undefined;
    // ergonex never creates a start-up file (0003-host FR-026): where there is none it writes nothing and says how to make one
    if (args.options.install && before === undefined)
      return err({
        kind: "environment",
        message: `${rc} does not exist, and ergonex never creates a start-up file: nothing was written; create it with \`${createCommand(word, rc)}\` and run this again`,
      });
    const edited = args.options.install ? installBlock(before, snippet) : removeBlock(before ?? "");
    if (edited.kind === "err")
      return err({
        kind: "environment",
        message: `${rc}: ${describeBlockError(edited.error)}`,
      });
    if (!edited.value.changed) {
      return ok({
        text: `${rc} ${args.options.install ? "already has the ergonex block" : "has no ergonex block"}; nothing changed`,
        data: { rc, written: false },
        findings: [],
        facts: { applied: false },
      });
    }
    const diff = unifiedDiff(rc, before ?? "", edited.value.text);
    ctx.note(diff);
    if (!args.options.yes) {
      if (!ctx.interact.terminal)
        return err({
          kind: "usage",
          message: `there is no terminal to ask on: run it in a terminal, or give --yes to write ${rc} after seeing the diff above`,
        });
      const answer = await ctx.interact.ask(
        `${args.options.install ? "Write" : "Remove"} this block ${args.options.install ? "to" : "from"} ${rc}? [y/N] `,
      );
      if (answer === undefined || !/^\s*y(es)?\s*$/i.test(answer))
        return ok({
          text: `not written: ${rc} is as it was`,
          data: { rc, written: false },
          findings: [],
          facts: { applied: false },
        });
    }
    try {
      await writeTextFile(rc, edited.value.text);
    } catch (e) {
      return err({
        kind: "environment",
        message: `${rc} cannot be written: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
    return ok({
      text: `${args.options.install ? "wrote the ergonex block to" : "removed the ergonex block from"} ${rc}`,
      data: { rc, written: true },
      findings: [],
      facts: { applied: true },
    });
  },
});

/** The module `ergonex shell`. */
export const shellModule: ErgonexModule = {
  name: "shell",
  summary: shell.summary,
  commands: [shell],
};
