// Spec: 0047-arcactl-init FR-006, FR-007
/**
 * `arcactl shell` (commons data 0047-arcactl-init FR-006, FR-007): the one script a person's shell sources to be ready to use an arca instance: the `ARCA_*` variables, `PGSERVICE` and `PGOPTIONS` so that
 * `psql` and every libpq tool reach the right instance and schema, a few functions (`arca`, `arca-doctor`, `arca-psql`, `arca-use`, `arca-off`), and completions. It is text made from its input
 * alone, for bash, zsh, fish, PowerShell, nushell and POSIX `sh`; it connects to nothing and writes nothing, so it is safe in a profile, and it never holds a password. Sourcing it twice is the same as
 * once, switching instance replaces what the last one set, and `arca-off` takes everything away.
 *
 * @remarks
 * A value is quoted by the rules of its shell, so that any text (spaces, quotes, `$`, backticks, newlines) arrives as it is. `PGOPTIONS` is the person's where they have set it: it is replaced only
 * where it is empty or was set by this script before.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { modelNames } from "./config.ts";
import { checkIds } from "./doctor.ts";
import { passwordOf } from "./redact.ts";
import { type Shell, shells } from "./workstation.ts";

/** What a script is made from. */
export interface ShellInput {
  readonly shell: Shell;
  /** The instance's name, which is also its libpq service where there is one. */
  readonly instance?: string;
  /** What the instance is for: `dev`, `staging`, `prod`. */
  readonly env?: string;
  readonly schema: string;
  readonly models?: readonly string[];
  /** The `arca.config.ts` the shell is to use. */
  readonly config?: string;
  /** The directory `arcactl` keeps its settings in. */
  readonly home?: string;
  /** The libpq service (`pg_service.conf`) that has the host, user and the rest; the password is in libpq's own files. */
  readonly service?: string;
  /** A connection URL without a password. */
  readonly url?: string;
  /** Whether to add the `arca-prompt` function. */
  readonly prompt?: boolean;
}

/** A command and its options, which the completions are made from. */
export interface Command {
  readonly name: string;
  readonly help: string;
  readonly flags: readonly { readonly name: string; readonly help: string; readonly values?: readonly string[]; readonly switch?: true }[];
}

/** The commands `arcactl` has. */
export const commands: readonly Command[] = [
  {
    name: "doctor",
    help: "check the database against the models",
    flags: [
      { name: "--config", help: "arca.config.ts" },
      { name: "--models", help: "the models wanted", values: modelNames },
      { name: "--schema", help: "the schema" },
      { name: "--check", help: "only these checks", values: checkIds },
      { name: "--json", help: "machine-readable output", switch: true },
      { name: "--url", help: "connection URL" },
      { name: "--non-interactive", help: "run as a server", switch: true },
    ],
  },
  {
    name: "sql",
    help: "write the DDL of the models",
    flags: [
      { name: "--models", help: "the models", values: modelNames },
      { name: "--config", help: "arca.config.ts" },
      { name: "--module", help: "a module of your own" },
      { name: "--schema", help: "the schema" },
      { name: "--dialect", help: "the dialect", values: ["postgres", "sqlite", "duckdb"] },
      { name: "--no-invariants", help: "leave out the triggers", switch: true },
    ],
  },
  {
    name: "lint",
    help: "hold the models to governance's rules",
    flags: [
      { name: "--models", help: "the models", values: modelNames },
      { name: "--config", help: "arca.config.ts" },
      { name: "--module", help: "a module of your own" },
      { name: "--strict", help: "a warning fails too", switch: true },
    ],
  },
  {
    name: "generate",
    help: "write what a generator makes",
    flags: [
      { name: "--models", help: "the models", values: modelNames },
      { name: "--config", help: "arca.config.ts" },
      { name: "--module", help: "a module of your own" },
      { name: "--dialect", help: "the dialect", values: ["postgres", "sqlite", "duckdb"] },
    ],
  },
  {
    name: "list",
    help: "list generators, models, tables, codes, invariants",
    flags: [
      { name: "--models", help: "the models", values: modelNames },
      { name: "--config", help: "arca.config.ts" },
      { name: "--module", help: "a module of your own" },
    ],
  },
  {
    name: "init",
    help: "set up your workstation",
    flags: [
      { name: "--instance", help: "the instance" },
      { name: "--host", help: "its host" },
      { name: "--port", help: "its port" },
      { name: "--database", help: "its database" },
      { name: "--user", help: "its user" },
      { name: "--sslmode", help: "SSL mode" },
      { name: "--env", help: "dev, staging or prod", values: ["dev", "staging", "prod"] },
      { name: "--shell", help: "the shells", values: [...shells, "all", "auto", "none"] },
      { name: "--discover", help: "look at every instance found", switch: true },
      { name: "--local", help: "look for PostgreSQL on this machine", switch: true },
      { name: "--password-stdin", help: "read the password from standard input", switch: true },
      { name: "--dry-run", help: "show the changes and write nothing", switch: true },
      { name: "--yes", help: "make the changes without asking", switch: true },
      { name: "--undo", help: "take away what init put in", switch: true },
      { name: "--no-psql", help: "leave the psql files alone", switch: true },
    ],
  },
  {
    name: "shell",
    help: "print the script that sets up this shell",
    flags: [
      { name: "--shell", help: "the shell", values: shells },
      { name: "--instance", help: "the instance" },
      { name: "--env", help: "dev, staging or prod", values: ["dev", "staging", "prod"] },
      { name: "--schema", help: "the schema" },
      { name: "--service", help: "the libpq service" },
      { name: "--models", help: "the models", values: modelNames },
      { name: "--config", help: "arca.config.ts" },
      { name: "--prompt", help: "add arca-prompt", switch: true },
      { name: "--env-json", help: "the variables as JSON", switch: true },
    ],
  },
];

/** The variables a script sets, in order, and what each is. */
export function variablesOf(i: ShellInput): readonly (readonly [string, string])[] {
  const out: [string, string][] = [];
  const add = (k: string, v: string | undefined): void => void (v === undefined || v === "" ? undefined : out.push([k, v]));
  add("ARCA_INSTANCE", i.instance);
  add("ARCA_ENV", i.env);
  add("ARCA_SCHEMA", i.schema);
  add("ARCA_MODELS", i.models?.join(","));
  add("ARCA_CONFIG", i.config);
  add("ARCA_HOME", i.home);
  add("ARCA_SERVICE", i.service);
  add("ARCA_DATABASE_URL", i.url);
  return out;
}

/** The value of `PGOPTIONS` the script offers: the search path. */
export const pgoptionsOf = (i: ShellInput): string => `-c search_path=${i.schema},public`;

/** What is wrong with the input of a script. */
export function checkInput(i: ShellInput): readonly string[] {
  const out: string[] = [];
  if (!(shells as readonly string[]).includes(i.shell)) out.push(`${i.shell} is not a shell this script is made for (${shells.join(", ")})`);
  if (i.instance !== undefined && !/^[a-z0-9][a-z0-9._-]{0,62}$/.test(i.instance)) out.push(`the instance name ${JSON.stringify(i.instance)} is not lower-case letters, digits, dots, dashes and underscores`);
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(i.schema)) out.push(`the schema name ${JSON.stringify(i.schema)} is not a lower-case name`);
  if (i.service !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(i.service)) out.push(`the service name ${JSON.stringify(i.service)} is not letters, digits, dots, dashes and underscores`);
  if (i.url !== undefined && passwordOf(i.url) !== undefined) out.push("the URL has a password: a shell script never holds one; keep it in .pgpass and name a service");
  if (i.env !== undefined && !/^[a-z][a-z0-9-]{0,30}$/.test(i.env)) out.push(`the environment ${JSON.stringify(i.env)} is not a lower-case word`);
  return out;
}

// ---- quoting: each shell's own rules

/** A value as a single-quoted word in a POSIX shell (bash, zsh, sh). */
export const quotePosix = (v: string): string => `'${v.replaceAll("'", `'\\''`)}'`;
/** A value as a single-quoted word in fish, where only a backslash and a quote are escaped inside. */
export const quoteFish = (v: string): string => `'${v.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
/** A value as a single-quoted string in PowerShell, where a quote is doubled. */
export const quotePwsh = (v: string): string => `'${v.replaceAll("'", "''")}'`;
/** A value as a double-quoted string in nushell, with its escapes. */
export const quoteNu = (v: string): string =>
  `"${v.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t")}"`;

const FN = ["arca", "arca-doctor", "arca-psql", "arca-use", "arca-off"] as const;
const FN_PROMPT = "arca-prompt";
const MANAGED = ["ARCA_INSTANCE", "ARCA_ENV", "ARCA_SCHEMA", "ARCA_MODELS", "ARCA_CONFIG", "ARCA_HOME", "ARCA_SERVICE", "ARCA_DATABASE_URL", "ARCA_PGOPTIONS"] as const;
const header = (shell: Shell): string => `# arcactl shell for ${shell}: source this; arca-off takes it away`;
const wordsOf = (xs: readonly string[]): string => xs.join(" ");

function posix(i: ShellInput, vars: readonly (readonly [string, string])[]): string {
  const q = quotePosix;
  const sh = i.shell === "sh";
  const name = (n: string): string => (sh ? n.replaceAll("-", "_") : n);
  const set = new Set(vars.map(([k]) => k));
  const pgo = pgoptionsOf(i);
  const lines = [header(i.shell)];
  for (const k of MANAGED) if (k !== "ARCA_PGOPTIONS" && !set.has(k)) lines.push(`unset ${k}`);
  if (!set.has("ARCA_SERVICE")) lines.push(`if [ -n "\${ARCA_SERVICE-}" ] && [ "\${PGSERVICE-}" = "\${ARCA_SERVICE-}" ]; then unset PGSERVICE; fi`);
  for (const [k, v] of vars) lines.push(`export ${k}=${q(v)}`);
  if (set.has("ARCA_SERVICE")) lines.push(`export PGSERVICE=${q(i.service ?? "")}`);
  lines.push(`if [ -z "\${PGOPTIONS-}" ] || [ "\${PGOPTIONS-}" = "\${ARCA_PGOPTIONS-}" ]; then export PGOPTIONS=${q(pgo)}; fi`);
  lines.push(`export ARCA_PGOPTIONS=${q(pgo)}`);
  lines.push(
    `${name("arca")}() { arcactl "$@"; }`,
    `${name("arca-doctor")}() { arcactl doctor "$@"; }`,
    `${name("arca-psql")}() { psql "$@"; }`,
    `${name("arca-use")}() { if [ -z "\${1-}" ]; then echo "usage: ${name("arca-use")} <instance>" >&2; return 2; fi; eval "$(arcactl shell --shell ${i.shell} --instance "$1")"; }`,
  );
  if (i.prompt === true) lines.push(`${name(FN_PROMPT)}() { printf '%s' "[\${ARCA_INSTANCE-}\${ARCA_ENV:+:\${ARCA_ENV}}]"; }`);
  const gone = [...FN, ...(i.prompt === true ? [FN_PROMPT] : [])].map(name);
  lines.push(
    `${name("arca-off")}() { if [ "\${PGOPTIONS-}" = "\${ARCA_PGOPTIONS-}" ]; then unset PGOPTIONS; fi; if [ -n "\${ARCA_SERVICE-}" ] && [ "\${PGSERVICE-}" = "\${ARCA_SERVICE-}" ]; then unset PGSERVICE; fi; unset ${wordsOf(MANAGED)}; unset -f ${wordsOf(gone)} 2>/dev/null; return 0; }`,
  );
  const cmds = commands.map((c) => c.name);
  if (i.shell === "bash") {
    lines.push(
      `_arcactl() { local cur="\${COMP_WORDS[COMP_CWORD]}" prev="\${COMP_WORDS[COMP_CWORD-1]}" cmd="\${COMP_WORDS[1]}"; COMPREPLY=();`,
      `  if [ "$COMP_CWORD" -eq 1 ]; then COMPREPLY=($(compgen -W "${wordsOf(cmds)}" -- "$cur")); return; fi;`,
      `  case "$cmd $prev" in`,
      ...commands.flatMap((c) => c.flags.filter((f) => f.values !== undefined).map((f) => `    "${c.name} ${f.name}") COMPREPLY=($(compgen -W "${wordsOf(f.values ?? [])}" -- "$cur")); return;;`)),
      `  esac`,
      `  case "$cmd" in`,
      ...commands.map((c) => `    ${c.name}) COMPREPLY=($(compgen -W "${wordsOf(c.flags.map((f) => f.name))}" -- "$cur"));;`),
      `  esac; }`,
      `complete -F _arcactl arcactl arca`,
    );
  } else if (i.shell === "zsh") {
    lines.push(
      `_arcactl() { local -a cmds; local state; cmds=(${commands.map((c) => q(`${c.name}:${c.help}`)).join(" ")});`,
      `  if (( CURRENT == 2 )); then _describe 'command' cmds; return; fi;`,
      `  case "\${words[2]} \${words[CURRENT-1]}" in`,
      ...commands.flatMap((c) => c.flags.filter((f) => f.values !== undefined).map((f) => `    "${c.name} ${f.name}") compadd -- ${wordsOf(f.values ?? [])};;`)),
      `    *) case "\${words[2]}" in`,
      ...commands.map((c) => `      ${c.name}) compadd -- ${wordsOf(c.flags.map((f) => f.name))};;`),
      `    esac;;`,
      `  esac; }`,
      `if (( $+functions[compdef] )); then compdef _arcactl arcactl arca; fi`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function fish(i: ShellInput, vars: readonly (readonly [string, string])[]): string {
  const q = quoteFish;
  const set = new Set(vars.map(([k]) => k));
  const pgo = pgoptionsOf(i);
  const lines = [header("fish")];
  for (const k of MANAGED) if (k !== "ARCA_PGOPTIONS" && !set.has(k)) lines.push(`set -e ${k}`);
  if (!set.has("ARCA_SERVICE")) lines.push(`if set -q ARCA_SERVICE; and test "$PGSERVICE" = "$ARCA_SERVICE"; set -e PGSERVICE; end`);
  for (const [k, v] of vars) lines.push(`set -gx ${k} ${q(v)}`);
  if (set.has("ARCA_SERVICE")) lines.push(`set -gx PGSERVICE ${q(i.service ?? "")}`);
  lines.push(`if not set -q PGOPTIONS; or test -z "$PGOPTIONS"; or test "$PGOPTIONS" = "$ARCA_PGOPTIONS"; set -gx PGOPTIONS ${q(pgo)}; end`);
  lines.push(`set -gx ARCA_PGOPTIONS ${q(pgo)}`);
  lines.push(
    `function arca; arcactl $argv; end`,
    `function arca-doctor; arcactl doctor $argv; end`,
    `function arca-psql; psql $argv; end`,
    `function arca-use; if test (count $argv) -lt 1; echo "usage: arca-use <instance>" >&2; return 2; end; arcactl shell --shell fish --instance $argv[1] | source; end`,
  );
  if (i.prompt === true) lines.push(`function ${FN_PROMPT}; printf '%s' "[$ARCA_INSTANCE"(test -n "$ARCA_ENV"; and echo ":$ARCA_ENV")"]"; end`);
  const gone = [...FN, ...(i.prompt === true ? [FN_PROMPT] : [])];
  lines.push(
    `function arca-off; if test "$PGOPTIONS" = "$ARCA_PGOPTIONS"; set -e PGOPTIONS; end; if set -q ARCA_SERVICE; and test "$PGSERVICE" = "$ARCA_SERVICE"; set -e PGSERVICE; end; set -e ${wordsOf(MANAGED)}; functions -e ${wordsOf(gone)}; end`,
  );
  lines.push(`complete -c arcactl -e`, `complete -c arca -e`);
  for (const bin of ["arcactl", "arca"]) {
    for (const c of commands) lines.push(`complete -c ${bin} -f -n __fish_use_subcommand -a ${c.name} -d ${q(c.help)}`);
    for (const c of commands)
      for (const f of c.flags) lines.push(`complete -c ${bin} -f -n '__fish_seen_subcommand_from ${c.name}' -l ${f.name.slice(2)} -d ${q(f.help)}${f.values === undefined ? "" : ` -xa ${q(wordsOf(f.values))}`}`);
  }
  return `${lines.join("\n")}\n`;
}

function pwsh(i: ShellInput, vars: readonly (readonly [string, string])[]): string {
  const q = quotePwsh;
  const set = new Set(vars.map(([k]) => k));
  const pgo = pgoptionsOf(i);
  const lines = [header("pwsh")];
  for (const k of MANAGED) if (k !== "ARCA_PGOPTIONS" && !set.has(k)) lines.push(`Remove-Item Env:${k} -ErrorAction SilentlyContinue`);
  if (!set.has("ARCA_SERVICE")) lines.push(`if ($env:ARCA_SERVICE -and $env:PGSERVICE -eq $env:ARCA_SERVICE) { Remove-Item Env:PGSERVICE -ErrorAction SilentlyContinue }`);
  for (const [k, v] of vars) lines.push(`$env:${k} = ${q(v)}`);
  if (set.has("ARCA_SERVICE")) lines.push(`$env:PGSERVICE = ${q(i.service ?? "")}`);
  lines.push(`if (-not $env:PGOPTIONS -or $env:PGOPTIONS -eq $env:ARCA_PGOPTIONS) { $env:PGOPTIONS = ${q(pgo)} }`);
  lines.push(`$env:ARCA_PGOPTIONS = ${q(pgo)}`);
  lines.push(
    `function global:arca { arcactl @args }`,
    `function global:arca-doctor { arcactl doctor @args }`,
    `function global:arca-psql { psql @args }`,
    `function global:arca-use { param([Parameter(Mandatory = $true)][string]$Name) arcactl shell --shell pwsh --instance $Name | Out-String | Invoke-Expression }`,
  );
  if (i.prompt === true) lines.push(`function global:${FN_PROMPT} { "[$env:ARCA_INSTANCE" + $(if ($env:ARCA_ENV) { ":$env:ARCA_ENV" }) + "]" }`);
  const gone = [...FN, ...(i.prompt === true ? [FN_PROMPT] : [])];
  lines.push(
    `function global:arca-off { if ($env:PGOPTIONS -eq $env:ARCA_PGOPTIONS) { Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue }; if ($env:ARCA_SERVICE -and $env:PGSERVICE -eq $env:ARCA_SERVICE) { Remove-Item Env:PGSERVICE -ErrorAction SilentlyContinue }; ${MANAGED.map((k) => `Remove-Item Env:${k} -ErrorAction SilentlyContinue`).join("; ")}; ${gone.map((f) => `Remove-Item Function:\\${f} -ErrorAction SilentlyContinue`).join("; ")} }`,
  );
  const completions = commands.map((c) => `    '${c.name}' { ${c.flags.map((f) => q(f.name)).join(", ")} }`).join("\n");
  lines.push(
    `Register-ArgumentCompleter -Native -CommandName arcactl, arca -ScriptBlock {`,
    `  param($wordToComplete, $commandAst, $cursorPosition)`,
    `  $parts = $commandAst.CommandElements | ForEach-Object { $_.ToString() }`,
    `  $options = if ($parts.Count -le 1 -or ($parts.Count -eq 2 -and $wordToComplete)) { ${commands.map((c) => q(c.name)).join(", ")} } else { switch ($parts[1]) {`,
    completions,
    `  } }`,
    `  $options | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }`,
    `}`,
  );
  return `${lines.join("\n")}\n`;
}

function nu(i: ShellInput, vars: readonly (readonly [string, string])[]): string {
  const q = quoteNu;
  const set = new Set(vars.map(([k]) => k));
  const pgo = pgoptionsOf(i);
  const lines = [header("nu")];
  for (const k of MANAGED) if (k !== "ARCA_PGOPTIONS" && !set.has(k)) lines.push(`hide-env -i ${k}`);
  if (!set.has("ARCA_SERVICE")) lines.push(`if (($env.ARCA_SERVICE? | default "") != "") and ($env.PGSERVICE? == $env.ARCA_SERVICE?) { hide-env -i PGSERVICE }`);
  for (const [k, v] of vars) lines.push(`$env.${k} = ${q(v)}`);
  if (set.has("ARCA_SERVICE")) lines.push(`$env.PGSERVICE = ${q(i.service ?? "")}`);
  lines.push(`if (($env.PGOPTIONS? | default "") == "") or ($env.PGOPTIONS? == $env.ARCA_PGOPTIONS?) { $env.PGOPTIONS = ${q(pgo)} }`);
  lines.push(`$env.ARCA_PGOPTIONS = ${q(pgo)}`);
  lines.push(
    `def --wrapped arca [...rest: string] { ^arcactl ...$rest }`,
    `def --wrapped arca-doctor [...rest: string] { ^arcactl doctor ...$rest }`,
    `def --wrapped arca-psql [...rest: string] { ^psql ...$rest }`,
    `def --env arca-use [name: string] { let vars = (^arcactl shell --shell nu --env-json --instance $name | from json); load-env $vars; if (($env.PGOPTIONS? | default "") == "") { $env.PGOPTIONS = $env.ARCA_PGOPTIONS } }`,
  );
  if (i.prompt === true) lines.push(`def ${FN_PROMPT} [] { $"[($env.ARCA_INSTANCE? | default '')(if (($env.ARCA_ENV? | default '') != '') { ':' + $env.ARCA_ENV } else { '' })]" }`);
  lines.push(`def --env arca-off [] { if ($env.PGOPTIONS? == $env.ARCA_PGOPTIONS?) { hide-env -i PGOPTIONS }; if (($env.ARCA_SERVICE? | default "") != "") and ($env.PGSERVICE? == $env.ARCA_SERVICE?) { hide-env -i PGSERVICE }; ${MANAGED.map((k) => `hide-env -i ${k}`).join("; ")} }`);
  for (const c of commands) lines.push(`extern "arcactl ${c.name}" [ ${c.flags.map((f) => `${f.name}${f.switch === true ? "" : ": string"}`).join(" ")} ]`);
  return `${lines.join("\n")}\n`;
}

/**
 * The script for a shell.
 *
 * @param input - what it is made from
 * @returns the script, or every reason it cannot be made
 */
export function shellScript(input: ShellInput): Result<string, readonly string[]> {
  const bad = checkInput(input);
  if (bad.length > 0) return err(bad);
  const vars = variablesOf(input);
  switch (input.shell) {
    case "bash":
    case "zsh":
    case "sh":
      return ok(posix(input, vars));
    case "fish":
      return ok(fish(input, vars));
    case "pwsh":
      return ok(pwsh(input, vars));
    case "nu":
      return ok(nu(input, vars));
  }
}

/** The variables of an input as JSON, for a shell that cannot evaluate text it is given (nushell's `arca-use`). */
export function envJson(input: ShellInput): Result<string, readonly string[]> {
  const bad = checkInput(input);
  if (bad.length > 0) return err(bad);
  const all = Object.fromEntries([...variablesOf(input), ...(input.service === undefined ? [] : [["PGSERVICE", input.service] as const]), ["ARCA_PGOPTIONS", pgoptionsOf(input)] as const]);
  return ok(JSON.stringify(all));
}
