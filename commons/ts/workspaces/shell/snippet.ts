/**
 * The shell snippet (commons 0024-ifws-host FR-017, FR-018): what `ifws shell <bash|zsh|fish|pwsh|nu>` prints on standard output. It does four things and no more: exports `IFC_WORKSPACES_HOME`
 * where it is not set, adds `<home>/.if-workspaces/tools/bin` to the `PATH` (once) so that `ifws-*` modules and the pinned tools resolve, defines the completions of `ifws`, and defines one function,
 * `wcd`, that changes to a repository of the workspace by its name.
 *
 * @remarks
 * Pure: the snippet is text made from the shell's name, the root (the default, `$HOME/workspaces`, or a path a run named) and the modules to complete. It holds no secret and no command that runs
 * anything but `find`, `cd` and the shell's own builtins. It never edits a file; `block.ts` is what `ifws shell --install` writes and removes. A path is quoted for its shell, so that a root with
 * a space or a quote in it is one word.
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";

/** The shells `ifws shell` knows. */
export type Shell = "bash" | "zsh" | "fish" | "pwsh" | "nu";

/** All the shells, in the order `ifws shell` names them. */
export const SHELLS: readonly Shell[] = ["bash", "zsh", "fish", "pwsh", "nu"];

/** Whether a word names a shell. */
export function isShell(word: string): word is Shell {
  return SHELLS.some((s) => s === word);
}

/** Where the root is, for a snippet: the default of the system, or a path a run named. */
export type HomeSpec = { readonly kind: "default" } | { readonly kind: "path"; readonly path: string };

/** What a snippet completes: the modules, and for each the commands it takes after its name. */
export type Completions = readonly { readonly module: string; readonly commands: readonly string[] }[];

/** What the snippet is made from. */
export type SnippetFacts = { readonly home: HomeSpec; readonly completions: Completions };

/** The folder below the root where the pinned tools and the shims of `ifws-*` modules are. */
export const TOOLS_BIN = ".if-workspaces/tools/bin";

const posixQuote = (s: string): string => `'${s.replaceAll("'", `'\\''`)}'`;
const fishQuote = (s: string): string => `'${s.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
const pwshQuote = (s: string): string => `'${s.replaceAll("'", "''")}'`;
const nuQuote = (s: string): string => `"${s.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

const words = (c: Completions): string => c.map((m) => m.module).join(" ");

/** `bash` and `zsh` share the body: POSIX parameter expansion, `case`, `find` and `cd`. */
function posix(f: SnippetFacts, shell: "bash" | "zsh"): string {
  const home = f.home.kind === "default" ? "" : posixQuote(f.home.path);
  const several = f.completions.filter((m) => m.commands.length > 1);
  const completion =
    shell === "bash"
      ? [
          "_ifws_complete() {",
          '  local cur="${COMP_WORDS[COMP_CWORD]}"',
          '  if [ "$COMP_CWORD" -eq 1 ]; then',
          `    COMPREPLY=($(compgen -W ${posixQuote(words(f.completions))} -- "$cur"))`,
          '  elif [ "$COMP_CWORD" -eq 2 ]; then',
          '    case "${COMP_WORDS[1]}" in',
          ...several.map((m) => `      ${m.module}) COMPREPLY=($(compgen -W ${posixQuote(m.commands.join(" "))} -- "$cur")) ;;`),
          "    esac",
          "  fi",
          "}",
          "complete -F _ifws_complete ifws",
        ]
      : [
          "_ifws_complete() {",
          "  if (( CURRENT == 2 )); then",
          `    compadd -- ${words(f.completions)}`,
          "  elif (( CURRENT == 3 )); then",
          '    case "${words[2]}" in',
          ...several.map((m) => `      ${m.module}) compadd -- ${m.commands.join(" ")} ;;`),
          "    esac",
          "  fi",
          "}",
          "if (( $+functions[compdef] )); then compdef _ifws_complete ifws; fi",
        ];
  return [
    "# IF Workspaces (ifws): the root, the pinned tools on the PATH, the completions of ifws, and wcd.",
    f.home.kind === "default"
      ? 'export IFC_WORKSPACES_HOME="${IFC_WORKSPACES_HOME:-$HOME/workspaces}"'
      : `if [ -z "\${IFC_WORKSPACES_HOME:-}" ]; then export IFC_WORKSPACES_HOME=${home}; fi`,
    'case ":$PATH:" in',
    `  *":$IFC_WORKSPACES_HOME/${TOOLS_BIN}:"*) ;;`,
    `  *) export PATH="$IFC_WORKSPACES_HOME/${TOOLS_BIN}:$PATH" ;;`,
    "esac",
    ...completion,
    "wcd() {",
    '  if [ -z "$1" ]; then echo "usage: wcd NAME" >&2; return 2; fi',
    '  _ifws_hits=$(find "$IFC_WORKSPACES_HOME" -maxdepth 8 \\( -name .worktrees -o -name .if-workspaces -o -name .git \\) -prune -o -type d -name "$1" -exec test -e \'{}/.git\' \\; -print 2>/dev/null | sort)',
    '  if [ -z "$_ifws_hits" ]; then',
    '    echo "wcd: no repository named $1 in $IFC_WORKSPACES_HOME" >&2; unset _ifws_hits; return 1',
    "  fi",
    '  if [ "$(printf \'%s\\n\' "$_ifws_hits" | wc -l)" -gt 1 ]; then',
    '    echo "wcd: more than one repository is named $1:" >&2; printf \'%s\\n\' "$_ifws_hits" >&2; unset _ifws_hits; return 1',
    "  fi",
    '  cd "$_ifws_hits" || { unset _ifws_hits; return 1; }',
    "  unset _ifws_hits",
    "}",
  ].join("\n");
}

function fish(f: SnippetFacts): string {
  const home = f.home.kind === "default" ? '"$HOME/workspaces"' : fishQuote(f.home.path);
  const several = f.completions.filter((m) => m.commands.length > 1);
  return [
    "# IF Workspaces (ifws): the root, the pinned tools on the PATH, the completions of ifws, and wcd.",
    `set -q IFC_WORKSPACES_HOME; or set -gx IFC_WORKSPACES_HOME ${home}`,
    `fish_add_path -g "$IFC_WORKSPACES_HOME/${TOOLS_BIN}"`,
    `complete -c ifws -f -n __fish_use_subcommand -a ${fishQuote(words(f.completions))}`,
    ...several.map((m) => `complete -c ifws -f -n '__fish_seen_subcommand_from ${m.module}' -a ${fishQuote(m.commands.join(" "))}`),
    "function wcd",
    "    if test (count $argv) -lt 1",
    "        echo 'usage: wcd NAME' >&2; return 2",
    "    end",
    "    set -l hits (find $IFC_WORKSPACES_HOME -maxdepth 8 '(' -name .worktrees -o -name .if-workspaces -o -name .git ')' -prune -o -type d -name $argv[1] -exec test -e '{}/.git' ';' -print 2>/dev/null | sort)",
    "    if test (count $hits) -eq 0",
    '        echo "wcd: no repository named $argv[1] in $IFC_WORKSPACES_HOME" >&2; return 1',
    "    end",
    "    if test (count $hits) -gt 1",
    "        echo \"wcd: more than one repository is named $argv[1]:\" >&2; printf '%s\\n' $hits >&2; return 1",
    "    end",
    "    cd $hits[1]",
    "end",
  ].join("\n");
}

function pwsh(f: SnippetFacts): string {
  const home = f.home.kind === "default" ? "(Join-Path $HOME 'workspaces')" : pwshQuote(f.home.path);
  const several = f.completions.filter((m) => m.commands.length > 1);
  return [
    "# IF Workspaces (ifws): the root, the pinned tools on the PATH, the completions of ifws, and wcd.",
    `if (-not $env:IFC_WORKSPACES_HOME) { $env:IFC_WORKSPACES_HOME = ${home} }`,
    `$ifwsBin = Join-Path $env:IFC_WORKSPACES_HOME '${TOOLS_BIN}'`,
    "if (($env:PATH -split [IO.Path]::PathSeparator) -notcontains $ifwsBin) { $env:PATH = $ifwsBin + [IO.Path]::PathSeparator + $env:PATH }",
    "Register-ArgumentCompleter -Native -CommandName ifws -ScriptBlock {",
    "    param($wordToComplete, $commandAst, $cursorPosition)",
    "    $parts = @($commandAst.CommandElements | ForEach-Object { $_.ToString() })",
    `    $choices = if ($parts.Count -le 1 -or ($parts.Count -eq 2 -and $wordToComplete)) { ${pwshQuote(words(f.completions))} -split ' ' }`,
    ...several.map((m) => `    elseif ($parts[1] -eq '${m.module}') { ${pwshQuote(m.commands.join(" "))} -split ' ' }`),
    "    else { @() }",
    "    $choices | Where-Object { $_ -like \"$wordToComplete*\" } | ForEach-Object { [Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }",
    "}",
    "function wcd {",
    "    param([Parameter(Mandatory = $true)][string]$Name)",
    "    $hits = @(Get-ChildItem -Path $env:IFC_WORKSPACES_HOME -Directory -Recurse -Depth 7 -Filter $Name -ErrorAction SilentlyContinue |",
    "        Where-Object { (Test-Path (Join-Path $_.FullName '.git')) -and $_.FullName -notmatch '[\\\\/]\\.(worktrees|if-workspaces)[\\\\/]' })",
    '    if ($hits.Count -eq 0) { Write-Error "wcd: no repository named $Name in $env:IFC_WORKSPACES_HOME"; return }',
    '    if ($hits.Count -gt 1) { Write-Error ("wcd: more than one repository is named ${Name}: " + ($hits.FullName -join ", ")); return }',
    "    Set-Location $hits[0].FullName",
    "}",
  ].join("\n");
}

function nu(f: SnippetFacts): string {
  const home = f.home.kind === "default" ? '($nu.home-path | path join "workspaces")' : nuQuote(f.home.path);
  const several = f.completions.filter((m) => m.commands.length > 1);
  return [
    "# IF Workspaces (ifws): the root, the pinned tools on the PATH, the completions of ifws, and wcd.",
    `$env.IFC_WORKSPACES_HOME = ($env.IFC_WORKSPACES_HOME? | default ${home})`,
    `let ifws_bin = ($env.IFC_WORKSPACES_HOME | path join ".if-workspaces" "tools" "bin")`,
    "$env.PATH = ($env.PATH | split row (char esep) | where { |p| $p != $ifws_bin } | prepend $ifws_bin)",
    `def "nu-complete ifws" [] { [${f.completions.map((m) => nuQuote(m.module)).join(" ")}] }`,
    ...several.map((m) => `def "nu-complete ifws ${m.module}" [] { [${m.commands.map(nuQuote).join(" ")}] }`),
    'extern "ifws" [ module?: string@"nu-complete ifws", ...rest: string ]',
    "def --env wcd [name: string] {",
    '    let hits = (glob ($env.IFC_WORKSPACES_HOME | path join "**" $name) --depth 8 --no-file | where { |p| (($p | path join ".git") | path exists) and not ($p =~ "[\\\\/]\\.(worktrees|if-workspaces)[\\\\/]") } | sort)',
    '    if ($hits | is-empty) { error make { msg: $"wcd: no repository named ($name) in ($env.IFC_WORKSPACES_HOME)" } }',
    '    if ($hits | length) > 1 { error make { msg: $"wcd: more than one repository is named ($name): ($hits | str join ", ")" } }',
    "    cd ($hits | first)",
    "}",
  ].join("\n");
}

/** The snippet for a shell, ending in one newline. */
export function snippetFor(shell: Shell, facts: SnippetFacts): string {
  switch (shell) {
    case "bash":
    case "zsh":
      return `${posix(facts, shell)}\n`;
    case "fish":
      return `${fish(facts)}\n`;
    case "pwsh":
      return `${pwsh(facts)}\n`;
    case "nu":
      return `${nu(facts)}\n`;
    default:
      return absurd(shell);
  }
}

/** What the system gives of where a shell's start-up file is. */
export type RcFacts = {
  readonly home: string;
  readonly xdgConfigHome?: string | undefined;
  readonly zdotdir?: string | undefined;
  readonly windows: boolean;
  readonly darwin: boolean;
};

/**
 * The start-up file a shell reads, which `ifws shell --install` writes one block into: `~/.bashrc`, `~/.zshrc` (under `$ZDOTDIR` where it is set), `~/.config/fish/conf.d/ifws.fish`, PowerShell's
 * profile and Nushell's `config.nu`. A run that names `--rc` uses that file instead; this is the default, as a path with `/` between parts (the host gives it its native separators).
 */
export function rcFileFor(shell: Shell, f: RcFacts): string {
  const home = f.home.replace(/[\\/]+$/, "");
  const config = f.xdgConfigHome !== undefined && f.xdgConfigHome !== "" ? f.xdgConfigHome.replace(/[\\/]+$/, "") : `${home}/.config`;
  switch (shell) {
    case "bash":
      return `${home}/.bashrc`;
    case "zsh":
      return `${f.zdotdir !== undefined && f.zdotdir !== "" ? f.zdotdir.replace(/[\\/]+$/, "") : home}/.zshrc`;
    case "fish":
      return `${config}/fish/conf.d/ifws.fish`;
    case "pwsh":
      return f.windows
        ? `${home}/Documents/PowerShell/Microsoft.PowerShell_profile.ps1`
        : `${config}/powershell/Microsoft.PowerShell_profile.ps1`;
    case "nu":
      return f.darwin && f.xdgConfigHome === undefined
        ? `${home}/Library/Application Support/nushell/config.nu`
        : `${config}/nushell/config.nu`;
    default:
      return absurd(shell);
  }
}
