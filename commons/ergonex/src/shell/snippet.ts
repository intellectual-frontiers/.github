// Spec: 0003-host FR-017
/**
 * The shell snippet (commons 0003-host FR-017, FR-018): what `ergonex shell print <bash|zsh|fish|pwsh|nu>` prints on standard output. It does four things and no more: exports `ERGONEX_HOME`
 * where it is not set, adds `<home>/.ergonex/tools/bin` to the `PATH` (once) so that `ergonex-*` modules and the pinned tools resolve, defines the completions of `ergonex`, and defines one function,
 * `wcd`, that changes to a repository of the workspace by its name.
 *
 * @remarks
 * Pure: the snippet is text made from the shell's name, the root (the default, `$HOME/workspaces`, or a path a run named) and the modules to complete. It holds no secret and no command that runs
 * anything but `find`, `cd` and the shell's own builtins. It never edits a file; `block.ts` is what `ergonex shell install` writes and removes. A path is quoted for its shell, so that a root with
 * a space or a quote in it is one word.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";

/** The shells `ergonex shell` knows. */
export type Shell = "bash" | "zsh" | "fish" | "pwsh" | "nu";

/** All the shells, in the order `ergonex shell` names them. */
export const SHELLS: readonly Shell[] = ["bash", "zsh", "fish", "pwsh", "nu"];

/** Whether a word names a shell. */
export function isShell(word: string): word is Shell {
  return SHELLS.some((s) => s === word);
}

/** Where the root is, for a snippet: the default of the system, or a path a run named. */
export type HomeSpec = { readonly kind: "default" } | { readonly kind: "path"; readonly path: string };

/** What a snippet completes: the modules, and for each the commands it takes after its name. */
export type Completions = readonly {
  readonly module: string;
  readonly commands: readonly string[];
}[];

/** What the snippet is made from. */
export type SnippetFacts = {
  readonly home: HomeSpec;
  readonly completions: Completions;
};

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
          "_ergonex_complete() {",
          '  local cur="${COMP_WORDS[COMP_CWORD]}"',
          '  if [ "$COMP_CWORD" -eq 1 ]; then',
          `    COMPREPLY=($(compgen -W ${posixQuote(words(f.completions))} -- "$cur"))`,
          '  elif [ "$COMP_CWORD" -eq 2 ]; then',
          '    case "${COMP_WORDS[1]}" in',
          ...several.map((m) => `      ${m.module}) COMPREPLY=($(compgen -W ${posixQuote(m.commands.join(" "))} -- "$cur")) ;;`),
          "    esac",
          "  fi",
          "}",
          "complete -F _ergonex_complete ergonex",
        ]
      : [
          "_ergonex_complete() {",
          "  if (( CURRENT == 2 )); then",
          `    compadd -- ${words(f.completions)}`,
          "  elif (( CURRENT == 3 )); then",
          '    case "${words[2]}" in',
          ...several.map((m) => `      ${m.module}) compadd -- ${m.commands.join(" ")} ;;`),
          "    esac",
          "  fi",
          "}",
          "if (( $+functions[compdef] )); then compdef _ergonex_complete ergonex; fi",
        ];
  return [
    "# IF Workspaces (ergonex): the root, the pinned tools on the PATH, the completions of ergonex, and wcd.",
    f.home.kind === "default"
      ? 'export ERGONEX_HOME="${ERGONEX_HOME:-$HOME/workspaces}"'
      : `if [ -z "\${ERGONEX_HOME:-}" ]; then export ERGONEX_HOME=${home}; fi`,
    "# the shims of the tools ergonex installs are in ~/.local/bin, which the XDG specification names for a person's own programs (0031-install-locations)",
    'case ":$PATH:" in',
    '  *":$HOME/.local/bin:"*) ;;',
    '  *) export PATH="$HOME/.local/bin:$PATH" ;;',
    "esac",
    "# the person's GitHub sign-in as the token for reading packages, kept in the environment of this shell and never in a file (ergonex 0004-onboarding FR-004).",
    'if [ -z "${ERGONEX_GITHUB_TOKEN:-}" ] && command -v gh >/dev/null 2>&1; then',
    '  if ERGONEX_GITHUB_TOKEN="$(gh auth token 2>/dev/null)" && [ -n "$ERGONEX_GITHUB_TOKEN" ]; then export ERGONEX_GITHUB_TOKEN; else unset ERGONEX_GITHUB_TOKEN; fi',
    "fi",
    ...completion,
    "wcd() {",
    '  if [ -z "$1" ]; then echo "usage: wcd NAME" >&2; return 2; fi',
    '  _ergonex_hits=$(find "$ERGONEX_HOME" -maxdepth 8 \\( -name .worktrees -o -name .ergonex -o -name .git \\) -prune -o -type d -name "$1" -exec test -e \'{}/.git\' \\; -print 2>/dev/null | sort)',
    '  if [ -z "$_ergonex_hits" ]; then',
    '    echo "wcd: no repository named $1 in $ERGONEX_HOME" >&2; unset _ergonex_hits; return 1',
    "  fi",
    '  if [ "$(printf \'%s\\n\' "$_ergonex_hits" | wc -l)" -gt 1 ]; then',
    '    echo "wcd: more than one repository is named $1:" >&2; printf \'%s\\n\' "$_ergonex_hits" >&2; unset _ergonex_hits; return 1',
    "  fi",
    '  cd "$_ergonex_hits" || { unset _ergonex_hits; return 1; }',
    "  unset _ergonex_hits",
    "}",
  ].join("\n");
}

function fish(f: SnippetFacts): string {
  const home = f.home.kind === "default" ? '"$HOME/workspaces"' : fishQuote(f.home.path);
  const several = f.completions.filter((m) => m.commands.length > 1);
  return [
    "# IF Workspaces (ergonex): the root, the pinned tools on the PATH, the completions of ergonex, and wcd.",
    `set -q ERGONEX_HOME; or set -gx ERGONEX_HOME ${home}`,
    "# the shims of the tools ergonex installs are in ~/.local/bin, which the XDG specification names for a person's own programs (0031-install-locations)",
    'fish_add_path -g "$HOME/.local/bin"',
    "# the person's GitHub sign-in as the token for reading packages, kept in the environment of this shell and never in a file (ergonex 0004-onboarding FR-004).",
    "if not set -q ERGONEX_GITHUB_TOKEN; and command -q gh",
    '    set -l token (gh auth token 2>/dev/null); and test -n "$token"; and set -gx ERGONEX_GITHUB_TOKEN $token',
    "end",
    `complete -c ergonex -f -n __fish_use_subcommand -a ${fishQuote(words(f.completions))}`,
    ...several.map((m) => `complete -c ergonex -f -n '__fish_seen_subcommand_from ${m.module}' -a ${fishQuote(m.commands.join(" "))}`),
    "function wcd",
    "    if test (count $argv) -lt 1",
    "        echo 'usage: wcd NAME' >&2; return 2",
    "    end",
    "    set -l hits (find $ERGONEX_HOME -maxdepth 8 '(' -name .worktrees -o -name .ergonex -o -name .git ')' -prune -o -type d -name $argv[1] -exec test -e '{}/.git' ';' -print 2>/dev/null | sort)",
    "    if test (count $hits) -eq 0",
    '        echo "wcd: no repository named $argv[1] in $ERGONEX_HOME" >&2; return 1',
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
    "# IF Workspaces (ergonex): the root, the pinned tools on the PATH, the completions of ergonex, and wcd.",
    `if (-not $env:ERGONEX_HOME) { $env:ERGONEX_HOME = ${home} }`,
    "# the shims of the tools ergonex installs: ~/.local/bin (XDG) on Linux and macOS, and the tools folder of ergonex's data on Windows (0031-install-locations)",
    "$ergonexBin = if ($IsLinux -or $IsMacOS) { Join-Path $HOME '.local/bin' } else { Join-Path $(if ($env:XDG_DATA_HOME) { $env:XDG_DATA_HOME } else { $env:LOCALAPPDATA }) 'ergonex\\tools\\bin' }",
    "if (($env:PATH -split [IO.Path]::PathSeparator) -notcontains $ergonexBin) { $env:PATH = $ergonexBin + [IO.Path]::PathSeparator + $env:PATH }",
    "# the person's GitHub sign-in as the token for reading packages, kept in the environment of this shell and never in a file (ergonex 0004-onboarding FR-004).",
    "if (-not $env:ERGONEX_GITHUB_TOKEN -and (Get-Command gh -ErrorAction SilentlyContinue)) {",
    "    $ergonexToken = (& gh auth token 2>$null)",
    '    if ($LASTEXITCODE -eq 0 -and $ergonexToken) { $env:ERGONEX_GITHUB_TOKEN = "$ergonexToken".Trim() }',
    "}",
    "Register-ArgumentCompleter -Native -CommandName ergonex -ScriptBlock {",
    "    param($wordToComplete, $commandAst, $cursorPosition)",
    "    $parts = @($commandAst.CommandElements | ForEach-Object { $_.ToString() })",
    `    $choices = if ($parts.Count -le 1 -or ($parts.Count -eq 2 -and $wordToComplete)) { ${pwshQuote(words(f.completions))} -split ' ' }`,
    ...several.map((m) => `    elseif ($parts[1] -eq '${m.module}') { ${pwshQuote(m.commands.join(" "))} -split ' ' }`),
    "    else { @() }",
    "    $choices | Where-Object { $_ -like \"$wordToComplete*\" } | ForEach-Object { [Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }",
    "}",
    "function wcd {",
    "    param([Parameter(Mandatory = $true)][string]$Name)",
    "    $hits = @(Get-ChildItem -Path $env:ERGONEX_HOME -Directory -Recurse -Depth 7 -Filter $Name -ErrorAction SilentlyContinue |",
    "        Where-Object { (Test-Path (Join-Path $_.FullName '.git')) -and $_.FullName -notmatch '[\\\\/]\\.(worktrees|ergonex)[\\\\/]' })",
    '    if ($hits.Count -eq 0) { Write-Error "wcd: no repository named $Name in $env:ERGONEX_HOME"; return }',
    '    if ($hits.Count -gt 1) { Write-Error ("wcd: more than one repository is named ${Name}: " + ($hits.FullName -join ", ")); return }',
    "    Set-Location $hits[0].FullName",
    "}",
  ].join("\n");
}

function nu(f: SnippetFacts): string {
  const home = f.home.kind === "default" ? '($nu.home-path | path join "workspaces")' : nuQuote(f.home.path);
  const several = f.completions.filter((m) => m.commands.length > 1);
  return [
    "# IF Workspaces (ergonex): the root, the pinned tools on the PATH, the completions of ergonex, and wcd.",
    `$env.ERGONEX_HOME = ($env.ERGONEX_HOME? | default ${home})`,
    "# the shims of the tools ergonex installs: ~/.local/bin (XDG) on Linux and macOS, and the tools folder of ergonex's data on Windows (0031-install-locations)",
    `let ergonex_bin = (if ($nu.os-info.name == "windows") { (($env.XDG_DATA_HOME? | default $env.LOCALAPPDATA) | path join "ergonex" "tools" "bin") } else { ($env.HOME | path join ".local" "bin") })`,
    "$env.PATH = ($env.PATH | split row (char esep) | where { |p| $p != $ergonex_bin } | prepend $ergonex_bin)",
    "# the person's GitHub sign-in as the token for reading packages, kept in the environment of this shell and never in a file (ergonex 0004-onboarding FR-004).",
    'if (($env.ERGONEX_GITHUB_TOKEN? | default "") == "") and (which gh | is-not-empty) {',
    "    let result = (do { gh auth token } | complete)",
    "    if $result.exit_code == 0 and ($result.stdout | str trim | is-not-empty) { $env.ERGONEX_GITHUB_TOKEN = ($result.stdout | str trim) }",
    "}",
    `def "nu-complete ergonex" [] { [${f.completions.map((m) => nuQuote(m.module)).join(" ")}] }`,
    ...several.map((m) => `def "nu-complete ergonex ${m.module}" [] { [${m.commands.map(nuQuote).join(" ")}] }`),
    'extern "ergonex" [ module?: string@"nu-complete ergonex", ...rest: string ]',
    "def --env wcd [name: string] {",
    '    let hits = (glob ($env.ERGONEX_HOME | path join "**" $name) --depth 8 --no-file | where { |p| (($p | path join ".git") | path exists) and not ($p =~ "[\\\\/]\\.(worktrees|ergonex)[\\\\/]") } | sort)',
    '    if ($hits | is-empty) { error make { msg: $"wcd: no repository named ($name) in ($env.ERGONEX_HOME)" } }',
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
 * The start-up file a shell reads, which `ergonex shell install` writes one block into: `~/.bashrc`, `~/.zshrc` (under `$ZDOTDIR` where it is set), `~/.config/fish/conf.d/ergonex.fish`, PowerShell's
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
      return `${config}/fish/conf.d/ergonex.fish`;
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

/**
 * What a person runs to create a start-up file that does not exist (0003-host FR-026): `ergonex shell install` never creates one, so it says the command and the path. A path with a quote in it is quoted
 * for the shell it names.
 */
export function createCommand(shell: Shell, rc: string): string {
  const slash = Math.max(rc.lastIndexOf("/"), rc.lastIndexOf("\\"));
  const dir = slash > 0 ? rc.slice(0, slash) : ".";
  const single = (t: string): string => `'${t.replaceAll("'", shell === "pwsh" || shell === "nu" ? "''" : "'\\''")}'`;
  switch (shell) {
    case "bash":
    case "zsh":
    case "fish":
      return `mkdir -p ${single(dir)} && touch ${single(rc)}`;
    case "pwsh":
      return `New-Item -ItemType File -Force -Path ${single(rc)}`;
    case "nu":
      return `mkdir ${single(dir)}; touch ${single(rc)}`;
    default:
      return absurd(shell);
  }
}
