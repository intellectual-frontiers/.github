// Spec: 0003-host FR-017, FR-027
/**
 * `ergonex shell print|install|uninstall <bash|zsh|fish|pwsh|nu>` (commons 0003-host FR-017 to FR-019, 0001-ergonex FR-020, FR-021): `print` writes the snippet for that shell on standard output and changes nothing; `install` writes the one
 * marked block into the shell's start-up file, and `uninstall` removes exactly that block; `--dry-run` shows the unified diff of either and writes nothing. Neither creates a start-up file that is not there: where it is absent `install` writes nothing
 * and says the command that creates it (0003-host FR-026). Run twice, `install` leaves one block. Only `print` writes no evidence record: it is what a start-up file may run at every start.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { value } from "../platform/k-args.ts";
import { existsSync, readTextFile, writeTextFile } from "../platform/r-fs.ts";
import { unifiedDiff } from "../diff.ts";
import { programsNamed } from "../host/probe.ts";
import { describeBlockError, installBlock, removeBlock } from "../shell/block.ts";
import { type Completions, createCommand, isShell, rcFileFor, type Shell, SHELLS, snippetFor } from "../shell/snippet.ts";
import type { Context, Outcome } from "../modules/types.ts";
import { defineCommand } from "./define.ts";
import { changes, HOME, reads } from "./options.ts";

const SHELL_OPERAND = [{ name: "SHELL", help: `One of ${SHELLS.join(", ")}.`, arity: "one" }] as const;

/** The shell a word names, or the failure that says it is not one. */
function shellOf(word: string | undefined): Shell | Outcome {
  const w = word ?? "";
  return isShell(w) ? w : err({ kind: "usage", message: `${JSON.stringify(w)} is not a shell ergonex knows: ${SHELLS.join(", ")}` });
}

/** What the snippet completes: the words of the program's tree, and for each the words below it. */
function completionsOf(ctx: Context): Completions {
  return ctx.builtins.map((m) => ({ module: m.name, commands: m.commands }));
}

const snippetOf = (ctx: Context, shell: Shell): string =>
  snippetFor(shell, {
    home: ctx.globals.home === undefined ? { kind: "default" } : { kind: "path", path: ctx.globals.home },
    completions: completionsOf(ctx),
    // only Nushell reads it: its aliases are fixed when a file is read, so the short name enx is left out where another program of that name is on the PATH (0003-host FR-027)
    enxTaken: shell === "nu" && programsNamed("enx", ctx.env["PATH"] ?? ctx.env["Path"], ctx.platform.windows).length > 0,
  });

const print = defineCommand({
  name: "print",
  summary: `Print the snippet for a shell (${SHELLS.join(", ")}) on standard output; it writes nothing.`,
  options: { ...HOME },
  operands: SHELL_OPERAND,
  examples: [{ args: ["bash"], says: "Print the snippet for bash." }],
  action: reads(),
  run: (ctx, args) => {
    const shell = shellOf(args.positionals[0]);
    if (typeof shell !== "string") return Promise.resolve(shell);
    return Promise.resolve(ok({ text: snippetOf(ctx, shell).replace(/\n$/, ""), data: null, findings: [], noEvidence: true }));
  },
});

/** `install` and `uninstall`: the one marked block of the start-up file, written or removed, or shown as a diff in a preview. */
async function edit(ctx: Context, word: string | undefined, rcOption: string | undefined, install: boolean): Promise<Outcome> {
  const shell = shellOf(word);
  if (typeof shell !== "string") return shell;
  const snippet = snippetOf(ctx, shell);
  const home = ctx.env["HOME"] ?? ctx.env["USERPROFILE"];
  const rc =
    rcOption ??
    (home === undefined
      ? undefined
      : rcFileFor(shell, {
          home,
          xdgConfigHome: ctx.env["XDG_CONFIG_HOME"],
          zdotdir: ctx.env["ZDOTDIR"],
          windows: ctx.platform.windows,
          darwin: ctx.platform.os === "darwin",
        }));
  if (rc === undefined) return err({ kind: "environment", message: "the start-up file cannot be found: HOME is not set; give --rc FILE" });
  const before = existsSync(rc) ? await readTextFile(rc) : undefined;
  // ergonex never creates a start-up file (0003-host FR-026): where there is none it writes nothing and says how to make one
  if (install && before === undefined)
    return err({
      kind: "environment",
      message: `${rc} does not exist, and ergonex never creates a start-up file: nothing was written; create it with \`${createCommand(shell, rc)}\` and run this again`,
    });
  const edited = install ? installBlock(before, snippet) : removeBlock(before ?? "");
  if (edited.kind === "err") return err({ kind: "environment", message: `${rc}: ${describeBlockError(edited.error)}` });
  if (!edited.value.changed)
    return ok({
      text: `${rc} ${install ? "already has the ergonex block" : "has no ergonex block"}; nothing changed`,
      data: { rc, written: false },
      findings: [],
      facts: { applied: false },
      title: "Nothing to change",
    });
  const diff = unifiedDiff(rc, before ?? "", edited.value.text).trimEnd();
  if (ctx.mode === "dry-run") return ok({ text: diff, data: { rc, written: false }, findings: [], noEvidence: true });
  try {
    await writeTextFile(rc, edited.value.text);
  } catch (e) {
    return err({ kind: "environment", message: `${rc} cannot be written: ${e instanceof Error ? e.message : String(e)}` });
  }
  return ok({
    text: `${diff}\n${install ? "wrote the ergonex block to" : "removed the ergonex block from"} ${rc}`,
    data: { rc, written: true },
    findings: [],
    facts: { applied: true },
    title: install ? "Block written" : "Block removed",
  });
}

const RC = { rc: value({ help: "The start-up file to use instead of the shell's own.", valueName: "FILE" }) };

const install = defineCommand({
  name: "install",
  summary: "Write one marked block of the snippet into the shell's start-up file; --dry-run shows the diff of it and writes nothing.",
  options: { ...HOME, ...RC },
  operands: SHELL_OPERAND,
  examples: [
    { args: ["bash", "--dry-run"], says: "Show the block that would be written to ~/.bashrc." },
    { args: ["bash"], says: "Write it." },
  ],
  action: changes({ idempotent: true, dryRun: true }),
  run: (ctx, args) => edit(ctx, args.positionals[0], args.options.rc, true),
});

const uninstall = defineCommand({
  name: "uninstall",
  summary: "Remove exactly the block `install` wrote; --dry-run shows the diff of it and writes nothing.",
  options: { ...HOME, ...RC },
  operands: SHELL_OPERAND,
  examples: [{ args: ["bash"], says: "Remove the block from ~/.bashrc." }],
  action: changes({ idempotent: true, dryRun: true }),
  run: (ctx, args) => edit(ctx, args.positionals[0], args.options.rc, false),
});

/** The commands of `ergonex shell`. */
export const shellCommands = { print, install, uninstall } as const;
