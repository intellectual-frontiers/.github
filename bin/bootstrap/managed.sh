#!/bin/sh
# What bootstrap-archon.sh puts in the files it manages for a person, as a filter from a file's text to its new text
# (0053-machine-bootstrap FR-009). It is the POSIX sh port of ws-host's ws_host/lib/managed.py: the same marker lines, so that ws-host
# and this script recognise each other's blocks, and the same rule that running it twice gives the same text.
#
# chezmoi runs it from a `modify_` script: the file's current text on standard input, the new text on standard output.
#
#   sh managed.sh KIND ARG [KIND ARG ...]
#
#   bash THEME        the prompt block for ~/.bashrc; THEME is the oh-my-posh theme's path ($HOME/... is written as it is)
#   fish THEME        the prompt block for fish's config.fish
#   modern-bash ICONS the aliases and hooks of the modern tools for ~/.bashrc; ICONS is icons or plain
#   modern-fish ICONS the same for fish
#   modern-git ICONS  git's pager block, placed first in ~/.gitconfig so that anything the person sets below it wins
#
# BOOTSTRAP_KEEP_BLOCK=1 keeps a prompt block that is already there exactly as it is, so a theme a person edited is never put back.
# A block whose end line is gone is left alone. Nothing outside the markers is touched.
set -eu

END='# <<< workspaces-host <<<'
MODERN_BEGIN='# >>> workspaces-host: modern-cli (ws-host kit add modern-cli) >>>'

begin_of() {   # begin_of KIND
  case $1 in
    bash | fish) printf '# >>> workspaces-host: prompt (ws-host shell add %s) >>>\n' "$1" ;;
    modern-*) printf '%s\n' "$MODERN_BEGIN" ;;
  esac
}

prompt_comment() {   # prompt_comment SHELL
  printf '%s\n' "# Delete these lines to go back to your old prompt. ws-host-pretty needs a Nerd Font in your terminal, ws-host-plain does not:" \
    "# put the path of ws-host-plain.omp.json in place of the theme below, or run the bootstrap again with BOOTSTRAP_PROMPT=plain."
}

modern_comment() {
  printf '%s\n' "# Delete these lines to go back to the old commands, or put WS_HOST_MODERN=no in ~/.config/workspaces-host/ws-host.env so setup does not add them again." \
    "# Each line is used only when its program is installed. Icons need a Nerd Font in your terminal: put WS_HOST_PROMPT=plain in the same file to leave them out."
}

emit_body() {   # emit_body KIND ARG
  kind=$1; arg=$2
  case $kind in
    bash)
      prompt_comment bash
      cat <<'EOF'
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) PATH="$HOME/.local/bin:$PATH" ;; esac
if command -v oh-my-posh >/dev/null 2>&1; then
EOF
      # shellcheck disable=SC2016  # the text of a block, not a command
      printf '  eval "$(oh-my-posh init bash --config "%s")"\n' "$arg"
      printf 'fi\n'
      ;;
    fish)
      prompt_comment fish
      cat <<'EOF'
if status is-interactive
  fish_add_path -g $HOME/.local/bin
  if command -q oh-my-posh
EOF
      printf '    oh-my-posh init fish --config "%s" | source\n' "$arg"
      printf '  end\nend\n'
      ;;
    modern-bash)
      i=""; [ "$arg" = plain ] || i=" --icons=auto"
      modern_comment
      printf '%s\n' 'if [[ $- == *i* ]]; then' '  if command -v eza >/dev/null 2>&1; then'
      printf "    alias ls='eza --group-directories-first%s'\n" "$i"
      printf "    alias ll='eza -l --group-directories-first --git%s'\n" "$i"
      printf "    alias la='eza -la --group-directories-first --git%s'\n" "$i"
      printf "    alias lt='eza --tree --level=2%s'\n" "$i"
      printf "    alias tree='eza --tree%s'\n" "$i"
      cat <<'EOF'
  else
    alias ll='ls -lh'
    alias la='ls -lAh'
  fi
  command -v bat >/dev/null 2>&1 && alias cat='bat --plain --paging=never'
  command -v btop >/dev/null 2>&1 && alias top='btop'
  alias ..='cd ..'
  alias ...='cd ../..'
  command -v zoxide >/dev/null 2>&1 && eval "$(zoxide init bash)"
  command -v fzf >/dev/null 2>&1 && fzf --bash >/dev/null 2>&1 && eval "$(fzf --bash)"
fi
EOF
      ;;
    modern-fish)
      i=""; [ "$arg" = plain ] || i=" --icons=auto"
      modern_comment
      printf '%s\n' 'if status is-interactive' '  if command -q eza'
      printf "    alias ls 'eza --group-directories-first%s'\n" "$i"
      printf "    alias ll 'eza -l --group-directories-first --git%s'\n" "$i"
      printf "    alias la 'eza -la --group-directories-first --git%s'\n" "$i"
      printf "    alias lt 'eza --tree --level=2%s'\n" "$i"
      printf "    alias tree 'eza --tree%s'\n" "$i"
      cat <<'EOF'
  else
    alias ll 'ls -lh'
    alias la 'ls -lAh'
  end
  command -q bat; and alias cat 'bat --plain --paging=never'
  command -q btop; and alias top btop
  alias .. 'cd ..'
  alias ... 'cd ../..'
  command -q zoxide; and zoxide init fish | source
  command -q fzf; and fzf --fish 2>/dev/null | source
end
EOF
      ;;
    modern-git)
      printf '%s\n' "# Delete these lines to go back to git's own look. They sit first in the file, so anything you set yourself below wins." \
        '[core]' '	pager = delta' '[interactive]' '	diffFilter = delta --color-only' '[delta]' '	navigate = true' '	line-numbers = true' \
        '[merge]' '	conflictstyle = zdiff3'
      ;;
    *) echo "managed.sh: unknown kind $kind" >&2; return 2 ;;
  esac
}

emit_block() {   # emit_block KIND ARG
  begin_of "$1"
  emit_body "$1" "$2"
  printf '%s\n' "$END"
}

# upsert KIND ARG FILE: the text of FILE with the block added, or the existing block replaced; the new text on standard output.
upsert() {
  kind=$1; arg=$2; file=$3
  begin=$(begin_of "$kind")
  keep=0
  case $kind in bash | fish) [ "${BOOTSTRAP_KEEP_BLOCK:-0}" = 1 ] && keep=1 ;; esac
  mode=append
  [ "$kind" = modern-git ] && mode=prepend
  emit_block "$kind" "$arg" >"$work/block"
  rc=0
  awk -v begin="$begin" -v endm="$END" -v keep="$keep" -v mode="$mode" -v blockfile="$work/block" '
    { line[NR] = $0 }
    END {
      while ((getline s < blockfile) > 0) blk[++nb] = s
      b = 0; e = 0
      for (i = 1; i <= NR; i++) if (line[i] == begin) { b = i; break }
      if (b) {
        for (i = b + 1; i <= NR; i++) if (line[i] == endm) { e = i; break }
        if (!e || keep) exit 3          # the end line is lost, or the person keeps the block: the file stays as it is
        for (i = 1; i < b; i++) print line[i]
        for (i = 1; i <= nb; i++) print blk[i]
        for (i = e + 1; i <= NR; i++) print line[i]
        exit 0
      }
      if (mode == "prepend") {
        for (i = 1; i <= nb; i++) print blk[i]
        if (NR > 0) print ""
        for (i = 1; i <= NR; i++) print line[i]
      } else {
        for (i = 1; i <= NR; i++) print line[i]
        if (NR > 0) print ""
        for (i = 1; i <= nb; i++) print blk[i]
      }
    }' "$file" || rc=$?
  return "$rc"
}

work=$(mktemp -d "${TMPDIR:-/tmp}/managed.XXXXXX")
trap 'rm -rf "$work"' EXIT
cat >"$work/cur"
while [ "$#" -ge 2 ]; do
  kind=$1; arg=$2; shift 2
  case $kind in
    bash | fish | modern-bash | modern-fish | modern-git) ;;
    *) echo "managed.sh: unknown kind $kind" >&2; exit 2 ;;
  esac
  rc=0
  upsert "$kind" "$arg" "$work/cur" >"$work/next" || rc=$?
  case $rc in
    0) mv "$work/next" "$work/cur" ;;
    3) ;;                                   # left as it was
    *) exit "$rc" ;;
  esac
done
cat "$work/cur"
