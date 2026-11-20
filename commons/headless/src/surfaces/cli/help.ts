// Spec: 0004-headless-cli FR-010
/**
 * The documents generated from a program's tree (commons headless 0004-headless-cli FR-010): its help at every level, its completions for bash, zsh,
 * fish and PowerShell, and its man page. They are made from the declaration alone, so a command added to the tree is in all of them with nothing
 * else written, and none can say what the parser does not accept. A verb's help includes the options its effect gives it (`--dry-run`, `--yes`) and what its
 * action is: what it may change, whether it is safe to repeat, who it is for.
 *
 * @example
 * ```ts
 * import { completions } from "./help.ts";
 * import { programOf, branch } from "@intellectual-frontiers/headless/logical";
 * completions(programOf({ name: "tool", summary: "A tool.", version: "1", children: [branch({ name: "repo", summary: "Repos.", children: [] })] }), "bash").includes("repo"); // true
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { longName, type Spec } from "@intellectual-frontiers/terminal/args";
import { commandHelp, type Group } from "@intellectual-frontiers/terminal/commands";
import { EXIT_NAMES, exitCodeOf, exitMeaning, type ActionFacts } from "@intellectual-frontiers/headless/governance";
import { BUILT_IN_WORDS, placedCommands, standardOptions, treeOf, verbOf, type Placed, type Program } from "@intellectual-frontiers/headless/logical";

/** The words the surface itself answers, beside the program's commands. */
export const BUILT_IN = BUILT_IN_WORDS;

/** The shells there are completions for. */
export const SHELLS = ["bash", "zsh", "fish", "powershell"] as const;

/** A shell there are completions for. */
export type Shell = (typeof SHELLS)[number];

/** Whether a word names a shell there are completions for. */
export function isShell(word: string): word is Shell {
  return (SHELLS as readonly string[]).includes(word);
}

/** What an action is, in lines for its help. */
export function effectLines(f: ActionFacts): readonly string[] {
  const effect =
    f.effect === "read"
      ? "only reads: it changes nothing"
      : f.effect === "mutate"
        ? "changes something"
        : "destroys something that cannot be undone";
  const how = [
    ...(f.dryRun ? ["--dry-run shows what it would do"] : []),
    ...(f.check ? ["--check changes nothing and ends with findings where it would"] : []),
    ...(f.effect === "destructive" ? ["it asks first; --yes confirms without asking"] : []),
  ];
  const who = f.audience === "human" ? "a person" : f.audience === "machine" ? "programs" : "anyone";
  return [
    `Effect: ${effect}${how.length === 0 ? "" : ` (${how.join("; ")})`}`,
    `Repeating it: ${f.idempotent ? "safe, it changes nothing the second time" : "not promised to be safe"}`,
    `For: ${who}`,
  ];
}

function placedAt(program: Program, path: readonly string[]): Placed | undefined {
  return placedCommands(program.children).find((p) => p.path.length === path.length && p.path.every((w, i) => w === path[i]));
}

/** The help of the node named by `path` (the words below the program), or `undefined` where there is none. */
export function helpFor(program: Program, path: readonly string[]): string | undefined {
  const tree = treeOf(program);
  const placed = placedAt(program, path);
  if (placed !== undefined) {
    const verb = { ...verbOf(placed.command), options: { ...placed.command.options, ...standardOptions(placed.facts) } };
    return [commandHelp([program.name, ...path], verb), "", ...effectLines(placed.facts)].join("\n");
  }
  let node: Group | undefined = tree;
  for (const w of path) {
    const next: Group["children"][number] | undefined = node?.children.find((c) => c.name === w);
    node = next?.kind === "group" ? next : undefined;
    if (node === undefined) return undefined;
  }
  const base = commandHelp([program.name, ...path], node ?? tree);
  return path.length === 0 ? [base, "", `Built in: ${BUILT_IN.join(", ")}, --version`].join("\n") : base;
}

/** What a shell completes after a path of words: the words of that place. */
export type Completion = { readonly path: readonly string[]; readonly words: readonly string[] };

const optionWords = (spec: Spec): readonly string[] =>
  Object.keys(spec).flatMap((k) => {
    const o = spec[k];
    if (o === undefined) return [];
    const long = longName(k);
    return [long, ...(o.kind === "flag" && o.negatable ? [`--no-${long.slice(2)}`] : []), ...(o.short === undefined ? [] : [`-${o.short}`])];
  });

/** Every place a shell completes: each branch with its commands, each command with its options. The program's own place is first and holds the built-in words. */
export function completionTable(program: Program): readonly Completion[] {
  const out: Completion[] = [];
  const walk = (children: readonly (typeof program.children)[number][], path: readonly string[]): void => {
    for (const n of children) {
      const here = [...path, n.name];
      if (n.kind === "branch") {
        out.push({ path: here, words: [...n.children.map((c) => c.name), "--help"] });
        walk(n.children, here);
      }
    }
  };
  out.push({ path: [], words: [...program.children.map((c) => c.name), ...BUILT_IN, "--help", "--version"] });
  walk(program.children, []);
  for (const p of placedCommands(program.children)) {
    out.push({ path: p.path, words: ["--help", ...optionWords({ ...p.command.options, ...standardOptions(p.facts) })] });
  }
  return out;
}

const ident = (name: string): string => name.replace(/[^A-Za-z0-9]+/g, "_");

/** The completion script of a program for a shell. */
export function completions(program: Program, shell: Shell): string {
  const table = completionTable(program);
  const name = program.name;
  switch (shell) {
    case "bash":
      return [
        `# bash completion for ${name}: source it, or put it in /etc/bash_completion.d/`,
        `_${ident(name)}() {`,
        `  local cur="\${COMP_WORDS[COMP_CWORD]}" path="" i word`,
        `  for ((i = 1; i < COMP_CWORD; i++)); do word="\${COMP_WORDS[i]}"; [[ "$word" == -* ]] || path="$path $word"; done`,
        `  path="\${path# }"`,
        `  local words=""`,
        `  case "$path" in`,
        ...table.map((c) => `    '${c.path.join(" ")}') words='${c.words.join(" ")}' ;;`),
        `  esac`,
        `  COMPREPLY=($(compgen -W "$words" -- "$cur"))`,
        `}`,
        `complete -F _${ident(name)} ${name}`,
        "",
      ].join("\n");
    case "zsh":
      return [
        `#compdef ${name}`,
        `# zsh completion for ${name}: put it in a folder of $fpath as _${name}`,
        `_${ident(name)}() {`,
        `  local path="\${(j: :)\${(@)words[2,CURRENT-1]:#-*}}"`,
        `  local -a w`,
        `  case "$path" in`,
        ...table.map((c) => `    '${c.path.join(" ")}') w=(${c.words.map((x) => `'${x}'`).join(" ")}) ;;`),
        `  esac`,
        `  compadd -a w`,
        `}`,
        `_${ident(name)} "$@"`,
        "",
      ].join("\n");
    case "fish":
      return [
        `# fish completion for ${name}: put it in ~/.config/fish/completions/${name}.fish`,
        ...table.flatMap((c) =>
          c.words.map((w) => {
            const cond = `test (string join " " (commandline -opc | string match -rv '^-' | tail -n +2)) = '${c.path.join(" ")}'`;
            return w.startsWith("--")
              ? `complete -c ${name} -n "${cond}" -l ${w.slice(2)}`
              : w.startsWith("-")
                ? `complete -c ${name} -n "${cond}" -s ${w.slice(1)}`
                : `complete -c ${name} -n "${cond}" -f -a '${w}'`;
          }),
        ),
        "",
      ].join("\n");
    case "powershell":
      return [
        `# PowerShell completion for ${name}: add it to your profile`,
        `Register-ArgumentCompleter -Native -CommandName '${name}' -ScriptBlock {`,
        `  param($wordToComplete, $commandAst, $cursorPosition)`,
        `  $path = (($commandAst.CommandElements | Select-Object -Skip 1 | ForEach-Object { $_.ToString() } | Where-Object { $_ -notlike '-*' }) -join ' ')`,
        `  $table = @{`,
        ...table.map((c) => `    '${c.path.join(" ")}' = @(${c.words.map((x) => `'${x}'`).join(", ")})`),
        `  }`,
        `  $words = $table[$path]`,
        `  if ($null -eq $words) { $words = $table[($path -replace ' [^ ]*$', '')] }`,
        `  $words | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }`,
        `}`,
        "",
      ].join("\n");
    default:
      return absurd(shell);
  }
}

const roff = (s: string): string => s.replace(/\\/g, "\\\\").replace(/-/g, "\\-").replace(/^([.'])/, "\\&$1");

/** The man page of a program, in roff: its commands with their options and effects, and its exit statuses from the one table. It holds no date, so the same program gives the same bytes. */
export function manPage(program: Program): string {
  const lines: string[] = [
    `.TH ${program.name.toUpperCase()} 1 "" "${roff(program.name)} ${roff(program.version)}"`,
    ".SH NAME",
    `${roff(program.name)} \\- ${roff(program.summary)}`,
    ".SH SYNOPSIS",
    `.B ${roff(program.name)}`,
    "[\\fIcommand\\fR] [\\fIoptions\\fR]",
    ".SH COMMANDS",
  ];
  for (const p of placedCommands(program.children)) {
    lines.push(".TP", `.B ${roff([program.name, ...p.path].join(" "))}`, roff(p.command.summary));
    for (const l of effectLines(p.facts)) lines.push(".br", roff(l));
    const spec = { ...p.command.options, ...standardOptions(p.facts) };
    for (const k of Object.keys(spec)) {
      const o = spec[k];
      if (o === undefined) continue;
      lines.push(".RS", ".TP", `.B ${roff(longName(k))}`, roff(o.help), ".RE");
    }
  }
  lines.push(".SH EXIT STATUS");
  for (const n of EXIT_NAMES) lines.push(".TP", `.B ${exitCodeOf(n)}`, roff(exitMeaning(n)));
  return `${lines.join("\n")}\n`;
}
