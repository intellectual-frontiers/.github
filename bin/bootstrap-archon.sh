#!/bin/sh
# Set up a new computer for the Intellectual Frontiers harness: a slim Debian 12 or 13 (amd64 or arm64), under WSL 2 or in a virtual machine, becomes
# a complete working environment with a clone of the harness repository, `archon` (0053-machine-bootstrap).
#
#   cd && sudo apt update && sudo apt install -y curl wget      (a bare Debian has neither)
#   curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/bootstrap-archon.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/bootstrap-archon.sh | sh -s -- --dry-run
#
# It is a self-contained port of what ws-host (workspaces-host) installs for its default kits (base, shell and embedded-sql) and does for the
# terminal's look, git and the workspaces folder. It never calls, clones or needs ws-host. It:
#
#   1. installs what is missing with apt (it says so and asks for your password once, first),
#   2. gets the pinned mise, and through it Python and uv, then the modern command line tools, each checked against a checksum,
#   3. installs fish 4, Oh My Posh with ws-host's themes and chezmoi, and has chezmoi give bash and fish the prompt,
#   4. signs you in to GitHub (a code and a browser), sets the name and email on your commits where git has none,
#   5. copies the private archon repository to ~/workspaces/github.com/intellectual-frontiers/archon (or updates it by fast-forward only),
#   6. offers to make fish your login shell,
#   7. runs, in the clone, ./archon doctor, ./archon toolchain ensure and ./archon check, and says what to do next.
#
# Safe to run again: what is already in place changes nothing, your own files change only between marked lines (a copy is kept first), and a
# clone with your work in it is left exactly as it is. Long steps show one line with a spinner (at a terminal only); what a step printed is
# kept in a log and shown only if the step fails.
#
# Options (after `sh -s --` when piped):  --dry-run   list every step it would take, change nothing, fetch nothing, ask for nothing
#                                          -h, --help  this text
#
# Environment, so it can be tested (a "1" switches it on):
#   BOOTSTRAP_URL          where the data files come from when run from a pipe (default: raw.githubusercontent.com/intellectual-frontiers/.github/main)
#   ARCHON_URL             where to clone archon from (default: https://github.com/intellectual-frontiers/archon)
#   BOOTSTRAP_NO_APT=1     never install a package
#   BOOTSTRAP_NO_DOWNLOAD=1  fetch no program (mise, chezmoi, Oh My Posh, fish, the modern tools)
#   BOOTSTRAP_NO_RUNTIME=1 do not install Python and uv with mise (the uv already on the PATH is used)
#   BOOTSTRAP_NO_DOTFILES=1   do not touch ~/.bashrc, fish's config.fish or ~/.gitconfig
#   BOOTSTRAP_NO_AUTH=1    do not sign in to GitHub or set git's name and email
#   BOOTSTRAP_NO_CHSH=1    never offer to change the login shell (BOOTSTRAP_CHSH=yes changes it without asking, no never does)
#   BOOTSTRAP_NO_CLONE=1   do not copy or update archon (and so run nothing in it)
#   BOOTSTRAP_NO_ARCHON=1  copy archon but run none of its commands
#   BOOTSTRAP_KIT          the kits to install, space-separated (default: base shell embedded-sql; WS_HOST_KIT is read too)
#   BOOTSTRAP_PROMPT       pretty (default; needs a Nerd Font), plain, or no; naming one here also replaces a prompt block already in ~/.bashrc
#   BOOTSTRAP_TOOLCHAIN    the names for `archon toolchain ensure` (default: every entry not ready and not marked optional; none; all)
#   BOOTSTRAP_GIT_NAME, BOOTSTRAP_GIT_EMAIL   the name and email to put on your commits (set over what git has)
#   BOOTSTRAP_FRESH=1      look for a newer release of each tool that follows its newest release, even when one is installed
#   BOOTSTRAP_YES=1        answer yes to the questions that default to yes
# ws-host's own names are honoured where it has them: WS_HOST_HOME (the workspaces folder, default ~/workspaces), WS_HOST_WORKSPACES, WS_HOST_KIT,
# WS_HOST_PROMPT, WS_HOST_MODERN, WS_HOST_GIT_NAME, WS_HOST_GIT_EMAIL, WS_HOST_NO_APT, in the environment or in ~/.config/workspaces-host/ws-host.env.
#
# Exit status: 0 done, 1 archon's own doctor or check found something to look at, 2 usage, 3 the machine cannot be set up yet, 4 a step failed (setup stops, and
# says where the log and the support file are), 5 the GitHub sign-in did not finish.
# Everything is logged to ~/.archon-bootstrap/log/ (BOOTSTRAP_LOG_DIR changes it); BOOTSTRAP_SUPPORT names who to send the support file to; BOOTSTRAP_KEEP_GOING=1 does not stop at a failed step.
# shellcheck disable=SC2034  # the pinned checksums are read by arch_sha, through eval
set -eu

# ---- what is pinned (the same releases ws-host pins; each is checked by SHA-256 before it is unpacked) -------------------------------------------

MISE_VERSION=2026.10.3
MISE_SHA256_X86_64=ff0870ddad7f8c5ba673ceb3e7659f0353da8263eabe8b82220f5816a772c786
MISE_SHA256_AARCH64=a5141f834d883239c2542b9a2136e75428779b2040206537399714d8c534d91f
PYTHON_VERSION=3.14.8
UV_VERSION=0.12.23

CHEZMOI_VERSION=2.73.0
CHEZMOI_SHA256_X86_64=b597729b687af4488a848240134cb633de8ca0f04e0d26d48f400ee2ac338ffa
CHEZMOI_SHA256_AARCH64=abcb840401d3c1f2356e0f53f5d52aa10d10f572654d9626db9ad0ca4dc03355

POSH_VERSION=31.4.1
POSH_SHA256_X86_64=bfd0ccab85dc031c848b09b68226f1be942d2ce18978f94c9659b6e7e1b259af
POSH_SHA256_AARCH64=9649d66f978e65dc669307546bee61b7ff45fa0621c333be85db029382f1e859

# fish 4 for a distribution whose own fish is older (Debian 12 has 3.6). ws-host unpacks the fish project's Ubuntu package, which needs a newer C
# library than Debian 12 has; the project's own static release runs on any Linux, so that is what is pinned here.
FISH_VERSION=4.9.3
FISH_SHA256_X86_64=8f643d10ad1abb0ef7072764c01ceb5cf61b2d373fda400cf60f0bad69b7e095
FISH_SHA256_AARCH64=57349f0111728c64b703a84e611aa97ff4d1fa8466385d64e67bd5bc3ffa49fc

# glab for a Debian whose archive has none (Debian 12)
GLAB_VERSION=1.120.0
GLAB_SHA256_X86_64=4e6c59de9f7ed2f304bf93aad01ea8f8a69584f0450ce90ad696ef81f69c69aa
GLAB_SHA256_AARCH64=c60ebb4cb36f276714847a118845b9b4e69f46a8080c68b21ca63f158722cdea

# The tools that follow their newest release: name, GitHub repository, then the programs to link (link=file name it may have, a|b). Each is taken
# only with the checksum GitHub states for the release file or the one its publisher put beside it (ws-host's _tools.py and embedded_sql.py).
MODERN_TOOLS='
eza eza-community/eza eza=eza
zoxide ajeetdsouza/zoxide zoxide=zoxide
fzf junegunn/fzf fzf=fzf
yazi sxyazi/yazi yazi=yazi ya=ya
bat sharkdp/bat bat=bat
delta dandavison/delta delta=delta
sd chmln/sd sd=sd
yq mikefarah/yq yq=yq_linux_amd64|yq_linux_arm64|yq
glow charmbracelet/glow glow=glow
btop aristocratos/btop btop=btop
dust bootandy/dust dust=dust
duf muesli/duf duf=duf
procs dalance/procs procs=procs
just casey/just just=just
watchexec watchexec/watchexec watchexec=watchexec
hyperfine sharkdp/hyperfine hyperfine=hyperfine
scc boyter/scc scc=scc
lazygit jesseduffield/lazygit lazygit=lazygit
tealdeer tealdeer-rs/tealdeer tldr=tldr
xh ducaale/xh xh=xh
shfmt mvdan/sh shfmt=shfmt
actionlint rhysd/actionlint actionlint=actionlint
'
SQL_TOOLS='
turso tursodatabase/turso-cli turso=turso
usql xo/usql usql=usql|usql_static
litestream benbjohnson/litestream litestream=litestream
sqruff quarylabs/sqruff sqruff=sqruff
dbmate amacneil/dbmate dbmate=dbmate-linux-amd64|dbmate-linux-arm64|dbmate
'
# Python tools, each in a virtual environment of its own: name, PyPI package, then link=path inside it
PY_TOOLS='
sqlite-utils sqlite-utils sqlite-utils=bin/sqlite-utils
datasette datasette datasette=bin/datasette
harlequin harlequin harlequin=bin/harlequin
visidata visidata vd=bin/vd visidata=bin/visidata
'

# ---- settings ----------------------------------------------------------------------------------------------------------------------------------

raw_url=${BOOTSTRAP_URL:-https://raw.githubusercontent.com/intellectual-frontiers/.github/main}
archon_url=${ARCHON_URL:-https://github.com/intellectual-frontiers/archon}
github_api=${BOOTSTRAP_GITHUB_API:-${WS_HOST_GITHUB_API:-https://api.github.com}}
pypi_url=${BOOTSTRAP_PYPI:-${WS_HOST_PYPI:-https://pypi.org}}

dry=0
orig_path=$PATH

usage() {
  sed -n '2,/^# shellcheck disable=SC2034/p' "$0" 2>/dev/null | sed '$d' | sed 's/^# \{0,1\}//' || true
}

for arg in "$@"; do
  case $arg in
    --dry-run | -n) dry=1 ;;
    -h | --help)
      case $0 in *bootstrap-archon.sh) usage ;; *) echo "Usage: curl -fsSL URL | sh -s -- [--dry-run]   (see the header of bootstrap-archon.sh)" ;; esac
      exit 0 ;;
    *) echo "bootstrap-archon: unknown option $arg (try --help)" >&2; exit 2 ;;
  esac
done

# Everything lives under the home folder: stop before writing anywhere else.
if [ -z "${HOME:-}" ] || [ ! -d "$HOME" ] || [ "$HOME" = / ]; then
  echo "The computer cannot be set up yet: HOME is not a real folder (it is '${HOME:-}')." >&2
  echo "Fix: run this as the person who will use the computer, in a normal login shell." >&2
  exit 3
fi

# ---- how it looks: colour and emoji only at a terminal (never with NO_COLOR), so a log or a pipe stays plain -------------------------------------

if [ -t 2 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != dumb ]; then
  b=$(printf '\033[1m'); c=$(printf '\033[1;36m'); g=$(printf '\033[32m'); r=$(printf '\033[31m'); y=$(printf '\033[33m'); d=$(printf '\033[2m'); z=$(printf '\033[0m'); yb=$(printf '\033[1;93m')
else
  b=""; c=""; g=""; r=""; y=""; d=""; z=""; yb=""
fi
# shellcheck disable=SC1003  # the last frame is a backslash
case "${LC_ALL:-${LC_CTYPE:-${LANG:-}}}" in
  *[Uu][Tt][Ff]*) frames='⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏'; tick='✅'; cross='❌'; warnmark='⚠️ '; e_rocket='🚀 '; e_pkg='📦 '; e_dl='📥 '; e_list='📋 '; e_py='🐍 '; e_font='🔤 '
     e_one='1️⃣ '; e_two='2️⃣ '; e_three='3️⃣ '; e_four='4️⃣ '; e_ok='✅ '; e_stop='🛑 '; e_what='❓ '; e_why='💬 '; e_log='📄 '; e_pack='🎁 '; e_help='🤝 '; e_key='🔐 '; e_dir='📂 '; e_sync='🔄 '; e_paint='🎨 '; e_shell='🐟 '; e_next='👉 ' ;;
  *) frames='| / - \'; tick='ok'; cross='x'; warnmark='!'; e_rocket=''; e_pkg=''; e_dl=''; e_list=''; e_py=''; e_font=''
     e_one=''; e_two=''; e_three=''; e_four=''; e_ok=''; e_stop=''; e_what=''; e_why=''; e_log=''; e_pack=''; e_help=''; e_key=''; e_dir=''; e_sync=''; e_paint=''; e_shell=''; e_next='-> ' ;;
esac

# Every environment variable name in a message (capitals with an underscore, like BOOTSTRAP_PROMPT) is shown in bright yellow where there is colour.
envcolor() {
  if [ -n "$yb" ]; then
    printf '%s' "$*" | sed -E "s/(^|[^A-Za-z0-9_-])([A-Z][A-Z0-9]*(_[A-Z0-9]+)+)/\1${yb}\2${z}/g; s/(^|[^A-Za-z0-9_-])([A-Z][A-Z0-9]*(_[A-Z0-9]+)+)/\1${yb}\2${z}/g"
  else printf '%s' "$*"; fi
}
say() { printf '%s\n' "$(envcolor "$*")"; command -v logf >/dev/null 2>&1 && logf "$*"; return 0; }
warn() { printf '%s%s%s %s\n' "$y" "$warnmark" "$z" "$(envcolor "$*")" >&2; command -v logf >/dev/null 2>&1 && logf "WARNING: $*"; return 0; }
cur_phase=""; phase_bad=0
# A phase is a group of steps shown as ONE line when it is done (a tick, or a warning when something needs attention), so the screen stays calm.
phase_close() {
  [ -n "$cur_phase" ] || return 0
  if [ "$dry" = 1 ]; then cur_phase=""; return 0; fi
  if [ "$phase_bad" = 1 ]; then printf '%s%s%s %s %s(something needs attention, see below)%s\n' "$y" "$warnmark" "$z" "$cur_phase" "$d" "$z"
  else printf '%s%s%s %s\n' "$g" "$tick" "$z" "$cur_phase"; fi
  cur_phase=""; phase_bad=0
}
phase() {
  phase_close
  cur_phase=$1
  [ "$dry" = 1 ] && printf '\n%s%s%s\n' "$b" "$1" "$z"
  return 0
}
heading() { phase_close; printf '\n%s%s%s\n' "$b" "$*" "$z"; }
would() { printf '  %swould%s %s\n' "$d" "$z" "$*"; }

need() {
  logf "cannot continue: $1 (fix: $2)"
  say "${r}${b}${e_stop}The computer cannot be set up yet:${z} $1" >&2
  say "Fix: $2" >&2
  exit 3
}

# ---- working files and where things live --------------------------------------------------------------------------------------------------------

abs_or() {  # abs_or VALUE DEFAULT: VALUE if it is an absolute path, else DEFAULT (the XDG rule)
  case ${1:-} in /*) printf '%s' "$1" ;; *) printf '%s' "$2" ;; esac
}
data=$(abs_or "${XDG_DATA_HOME:-}" "$HOME/.local/share")/workspaces-host
state=$(abs_or "${XDG_STATE_HOME:-}" "$HOME/.local/state")/workspaces-host
cache=$(abs_or "${XDG_CACHE_HOME:-}" "$HOME/.cache")/workspaces-host
cfgdir=$(abs_or "${XDG_CONFIG_HOME:-}" "$HOME/.config")
cfg_file=$cfgdir/workspaces-host/ws-host.env
bin=$HOME/.local/bin
tools=$data/tools
store=$data/mise/data/installs

work=$(mktemp -d "${TMPDIR:-/tmp}/bootstrap-archon.XXXXXX")
problems=$work/problems     # one line for each thing that did not work, shown at the end
: >"$problems"
ka_pid=""
cleanup() {
  [ -n "$ka_pid" ] && kill "$ka_pid" 2>/dev/null
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

problem() { printf '%s\n' "$*" >>"$problems"; logf "problem: $*"; }

# ---- the log: everything this does is written to ~/.archon-bootstrap/log/, so a problem can be looked into (and shown to the support team) later ----
log_dir=${BOOTSTRAP_LOG_DIR:-$HOME/.archon-bootstrap/log}
stamp=$(date +%Y%m%d-%H%M%S)
logfile=$log_dir/bootstrap-$stamp.log
support_file=$log_dir/support-$stamp.txt
log_ok=0
if [ "$dry" = 0 ] && mkdir -p "$log_dir" 2>/dev/null && : >"$logfile" 2>/dev/null; then log_ok=1; fi
logf() {  # logf TEXT: one timestamped line in the log, without colour codes
  [ "$log_ok" = 1 ] || return 0
  printf '%s %s\n' "$(date +%H:%M:%S)" "$(printf '%s' "$*" | sed 's/\x1b\[[0-9;]*m//g')" >>"$logfile" 2>/dev/null || true
}
short_path() { case $1 in "$HOME"/*) printf '~/%s' "${1#"$HOME"/}" ;; *) printf '%s' "$1" ;; esac; }

# Where this script is, when it is a file; the data files beside it are used then, else they are fetched from raw_url.
script_dir=""
case $0 in
  *bootstrap-archon.sh) [ -f "$0" ] && script_dir=$(cd "$(dirname "$0")" && pwd -P) ;;
esac

# A terminal to ask on, even when standard input is the script (a pipe).
if ( : </dev/tty ) 2>/dev/null; then has_tty=1; else has_tty=0; fi
[ -t 2 ] && [ "${TERM:-dumb}" != dumb ] && tty_ui=1 || tty_ui=0

# How wide the terminal is, so a progress line never wraps (a wrapped line cannot be redrawn, and each redraw would leave another copy behind).
cols=80
if [ "$tty_ui" = 1 ]; then
  w=$(stty size 2>/dev/null </dev/tty | awk '{print $2}')
  case $w in '' | *[!0-9]*) w=$(tput cols 2>/dev/null || true) ;; esac
  case $w in '' | *[!0-9]*) ;; *) [ "$w" -ge 40 ] && cols=$w ;; esac
fi
clip() { awk -v n="$1" -v s="$2" 'BEGIN { if (length(s) > n) s = substr(s, 1, n - 1) "..."; print s }'; }

# ask QUESTION: yes or no, on the terminal; the default is yes. Without a terminal the answer is no.
ask() {
  [ "$has_tty" = 1 ] || return 1
  [ "${BOOTSTRAP_YES:-}" = 1 ] && return 0
  printf '%s%s%s [Y/n] ' "$b" "$1" "$z" >/dev/tty
  ans=""
  read -r ans </dev/tty || ans=""
  case $ans in "" | [Yy]*) return 0 ;; *) return 1 ;; esac
}

# ---- configuration: the environment, then ~/.config/workspaces-host/ws-host.env (the file ws-host reads), then the default -------------------------

cfg() {  # cfg NAME DEFAULT
  if eval "[ \"\${$1+x}\" = x ]"; then eval "printf '%s' \"\${$1}\""; return 0; fi
  if [ -r "$cfg_file" ] && grep -q "^[[:space:]]*$1=" "$cfg_file"; then
    v=$(sed -n "s/^[[:space:]]*$1=[[:space:]]*//p" "$cfg_file" | tail -n 1)
    v=${v%\"}; v=${v#\"}; v=${v%\'}; v=${v#\'}
    printf '%s' "$v"
    return 0
  fi
  printf '%s' "$2"
}

# ---- steps: one line with a spinner, the output kept for when it fails ------------------------------------------------------------------------------

step_no=0
keep_going=${BOOTSTRAP_KEEP_GOING:-0}
# A step may count its own progress: count_re is a pattern for the lines its output prints as each piece is done, count_total how many to expect (empty: unknown).
count_re=""; count_total=""
# step LABEL COMMAND...: run COMMAND quietly with a one-line spinner (a terminal, after half a second). Shows its output only if it fails; returns its
# status. With --dry-run it only says what it would do. COMMAND runs in a subshell, so what it sets is not seen afterwards: it writes files instead.
step() {
  label=$1; shift
  if [ "$dry" = 1 ]; then printf '  - %s\n' "$label"; return 0; fi
  log=$(mktemp "$work/step.XXXXXX")
  step_no=$((step_no + 1))
  slabel=$(clip $((cols - 16)) "$label")
  [ "$tty_ui" = 1 ] || printf '%s...\n' "$label" >&2
  "$@" >"$log" 2>&1 </dev/null &
  pid=$!
  trap 'kill "$pid" 2>/dev/null; exit 130' INT TERM
  shown=0; ticks=0; start=$(date +%s)
  # shellcheck disable=SC2086
  set -- $frames; nframes=$#
  if [ "$tty_ui" = 1 ]; then
    while kill -0 "$pid" 2>/dev/null; do
      ticks=$((ticks + 1))
      if [ "$ticks" -ge 5 ]; then   # about half a second in: a quick step shows nothing at all
        shown=1
        n=$(( ticks % nframes )); f=""; i=0
        for f in $frames; do [ "$i" = "$n" ] && break; i=$((i + 1)); done
        cnt=""
        if [ -n "$count_re" ]; then
          n=$(grep -c "$count_re" "$log" 2>/dev/null || true)
          cnt=": ${b}${n}${z}"
          [ -n "$count_total" ] && cnt="$cnt of $count_total"
        fi
        printf '\r\033[K%s%s%s %s%s %s(%ss)%s' "$c" "$f" "$z" "$slabel" "$cnt" "$d" "$(( $(date +%s) - start ))" "$z" >&2
      fi
      sleep 0.1
    done
  fi
  rc=0
  wait "$pid" || rc=$?
  trap 'exit 130' INT TERM
  [ "$shown" = 1 ] && printf '\r\033[K' >&2
  # Everything a step printed goes into the log, whether it worked or not.
  if [ "$log_ok" = 1 ]; then
    log_from=$(( $(wc -l <"$logfile") + 1 ))
    { printf '\n==== STEP %s: %s (exit %s)\n' "$step_no" "$label" "$rc"; cat "$log"; } >>"$logfile" 2>/dev/null || true
  fi
  if [ "$rc" != 0 ]; then
    phase_bad=1
    cp "$log" "$work/last.log"
    if [ "$soft_ok" = 1 ] || [ "$keep_going" = 1 ]; then
      printf '%s%s%s %s\n' "$r" "$cross" "$z" "$label" >&2
      tail -n 8 "$log" >&2
    else
      stop_here "$label" "$log" "${log_from:-0}"
    fi
  elif [ "${BOOTSTRAP_VERBOSE:-}" = 1 ] && [ "$shown" = 1 ]; then
    printf '%s%s%s %s\n' "$g" "$tick" "$z" "$label" >&2   # a step that worked leaves no line behind unless asked: the phase it belongs to says it is done
  fi
  rm -f "$log"
  return "$rc"
}

soft_ok=0
step_soft() { soft_ok=1; step "$@"; rc_soft=$?; soft_ok=0; return "$rc_soft"; }   # a step whose failure the caller explains and handles itself

# ---- parallel downloads: tools that do not touch each other are fetched at the same time ------------------------------------------------------------
# Each job runs in the background with a work folder of its own (so no two share a temporary file), writes only to its own folder under $tools and to
# its own link in ~/.local/bin, and never touches apt. The caller waits for all of them with one progress line, then stops if any failed.
# How many at once: the work waits mostly on the network, so cores are not the limit (bandwidth and the servers' own limits are, which is why 6 is the ceiling), but unpacking is
# some work for the processor, so a small computer gets fewer: twice its processors, at least 2 and at most 6. BOOTSTRAP_JOBS sets it.
cpus=$(nproc 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)
case $cpus in '' | *[!0-9]*) cpus=2 ;; esac
par_default=$((cpus * 2)); [ "$par_default" -lt 2 ] && par_default=2; [ "$par_default" -gt 6 ] && par_default=6
par=${BOOTSTRAP_JOBS:-$par_default}
pool_n=0; pool_started=0; pool_title=""; pool_total=""; pool_start=0; ticks=0
pool_begin() { pool_title=$1; pool_n=0; pool_started=0; pool_total=0; pool_start=$(date +%s); ticks=0;
  # shellcheck disable=SC2086
  set -- $frames; nframes=$#; pool_dir=$work/pool$$-$1; rm -rf "$pool_dir"; mkdir -p "$pool_dir"; }
pool_done() { n=0; for f in "$pool_dir"/*.rc; do [ -e "$f" ] && n=$((n + 1)); done; printf '%s' "$n"; }
pool_draw() {  # one progress line: how many of the programs started so far are done, and for how long
  [ "$tty_ui" = 1 ] || return 0
  ticks=$((ticks + 1))
  [ "$ticks" -ge 2 ] || return 0
  n=$(( ticks % nframes )); f=""; i=0
  for f in $frames; do [ "$i" = "$n" ] && break; i=$((i + 1)); done
  printf '\r\033[K%s%s%s %s: %s%s%s of %s %s(%ss)%s' "$c" "$f" "$z" "$pool_title" "$b" "$(pool_done)" "$z" "$pool_total" "$d" "$(( $(date +%s) - pool_start ))" "$z" >&2
}
pstep() {  # pstep LABEL COMMAND...
  label=$1; shift
  if [ "$dry" = 1 ]; then printf '  - %s\n' "$label"; return 0; fi
  [ "$par" -ge 1 ] 2>/dev/null || par=1
  while [ $((pool_started - $(pool_done))) -ge "$par" ]; do pool_draw; sleep 0.1; done
  pool_n=$((pool_n + 1)); pool_started=$((pool_started + 1)); pool_total=$pool_started; j=$pool_dir/$pool_n
  printf '%s' "$label" >"$j.label"
  (
    work=$j.work; mkdir -p "$work"
    rc=0; "$@" >"$j.log" 2>&1 </dev/null || rc=$?
    echo "$rc" >"$j.rc.tmp"; mv "$j.rc.tmp" "$j.rc"
  ) &
}
pool_end() {
  [ "$dry" = 1 ] && return 0
  [ "$pool_started" -gt 0 ] || return 0
  pool_total=$pool_started
  while [ "$(pool_done)" -lt "$pool_started" ]; do pool_draw; sleep 0.1; done
  [ "$tty_ui" = 1 ] && printf '\r\033[K' >&2
  wait 2>/dev/null || true
  failed_label=""; failed_log=""; failed_from=0
  i=1
  while [ "$i" -le "$pool_n" ]; do
    j=$pool_dir/$i; rc=$(cat "$j.rc" 2>/dev/null || echo 1); lab=$(cat "$j.label")
    step_no=$((step_no + 1))
    if [ "$log_ok" = 1 ]; then
      log_from=$(( $(wc -l <"$logfile") + 1 ))
      { printf '\n==== STEP %s: %s (exit %s)\n' "$step_no" "$lab" "$rc"; cat "$j.log"; } >>"$logfile" 2>/dev/null || true
    fi
    if [ "$rc" != 0 ] && [ -z "$failed_label" ]; then failed_label=$lab; failed_log=$j.log; failed_from=${log_from:-0}; cp "$j.log" "$work/last.log"; fi
    i=$((i + 1))
  done
  pool_started=0
  if [ -n "$failed_label" ]; then
    phase_bad=1
    if [ "$keep_going" = 1 ]; then warn "$failed_label did not install"; else stop_here "$failed_label" "$failed_log" "$failed_from"; fi
  fi
  return 0
}

# The one way setup ends when something went wrong: stop, say what failed in plain words with colour and emoji, say where to look (a path
# relative to your home folder), and say how to ask for help. A support file with what the team needs (and no secrets) is written beside the log.
support_who=${BOOTSTRAP_SUPPORT:-the Intellectual Frontiers support team}
stop_here() {  # stop_here LABEL STEPLOG LOGLINE
  trap - INT TERM
  [ -n "$ka_pid" ] && kill "$ka_pid" 2>/dev/null
  phase_close_quiet
  say ""
  say "${r}${b}${e_stop}Setup stopped: something went wrong${z}"
  say "${d}Nothing is half-installed in a way that matters; it is safe to run the setup again once this is fixed.${z}"
  say ""
  say "${y}${e_what}What failed:${z}  ${b}$1${z}"
  say "${y}${e_why}What it said:${z}"
  tail -n 6 "$2" 2>/dev/null | cut -c1-$((cols - 6)) | sed 's/^/     /'
  say ""
  if [ "$log_ok" = 1 ]; then
    write_support_file "$1" "$2" "$3"
    say "${c}${e_log}Where to look:${z}   ${b}$(short_path "$logfile")${z}  ${d}(the problem starts at line $3)${z}"
    say "${c}${e_pack}Support file:${z}    ${b}$(short_path "$support_file")${z}  ${d}(everything the team needs, with no passwords)${z}"
  else
    say "${d}The log could not be written (is your disk full?). Free some space and run the setup again.${z}"
  fi
  say ""
  say "${g}${b}${e_help}Not sure what to do? That is fine. Here is how to get help:${z}"
  say "   ${c}1.${z} Copy the support file path above."
  say "   ${c}2.${z} Send that one file to ${b}${support_who}${z}, and say what you were doing"
  say "      ${d}(for example: \"I ran the Debian setup on Windows and it stopped at ${1}\").${z}"
  say "   ${c}3.${z} You can see the file any time with:  ${b}cat $(short_path "$support_file")${z}"
  say ""
  exit 4
}
phase_close_quiet() { cur_phase=""; phase_bad=0; }
write_support_file() {  # write_support_file LABEL STEPLOG LOGLINE
  {
    printf 'Intellectual Frontiers bootstrap: support file\n'
    printf 'When:        %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"
    printf 'Failed step: %s (step %s, log line %s)\n' "$1" "$step_no" "$3"
    printf 'Computer:    %s, %s%s\n' "${d_pretty:-unknown}" "${arch:-unknown}" "${wsl_txt:-}"
    printf 'User:        %s (id %s)   Shell: %s\n' "$(id -un)" "$(id -u)" "${SHELL:-unknown}"
    printf 'Disk free:   %s\n' "$(df -h "$HOME" 2>/dev/null | awk 'NR==2 {print $4" of "$2}')"
    printf 'Network:     %s\n' "$(curl -fsS -o /dev/null -m 6 -w 'github.com answers (%{http_code})' https://github.com 2>&1 | tail -n 1)"
    printf 'Log file:    %s\n\n' "$(short_path "$logfile")"
    printf -- '--- what the failed step printed (last 60 lines) ---\n'
    tail -n 60 "$2" 2>/dev/null
    printf '\n--- the setup log, last 120 lines ---\n'
    tail -n 120 "$logfile" 2>/dev/null
  } 2>/dev/null | sed -E 's/(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/\1[removed]/g; s/(token|password|secret|key)=[^ ]+/\1=[removed]/Ig' >"$support_file" 2>/dev/null || true
}

# ---- the machine ---------------------------------------------------------------------------------------------------------------------------------

detect_platform() {
  os=$(uname -s)
  [ "$os" = Linux ] || need "this is $os, and the bootstrap sets up Debian under WSL 2 or in a virtual machine." "open your Debian window (or start the virtual machine) and run it there"
  case $(uname -m) in
    x86_64 | amd64) arch=x86_64; goarch=amd64; miseArch=x64 ;;
    aarch64 | arm64) arch=aarch64; goarch=arm64; miseArch=arm64 ;;
    *) need "there are no programs for $(uname -m) here." "use a computer or virtual machine with an amd64 or arm64 processor" ;;
  esac
  osr=${BOOTSTRAP_OS_RELEASE:-/etc/os-release}
  d_id=unknown; d_like=""; d_version=""; d_codename=""; d_pretty=Linux
  if [ -r "$osr" ]; then
    osval() { sed -n "s/^$1=//p" "$osr" | head -n 1 | tr -d "\"'"; }
    d_id=$(osval ID); d_like=$(osval ID_LIKE); d_version=$(osval VERSION_ID); d_codename=$(osval VERSION_CODENAME); d_pretty=$(osval PRETTY_NAME)
    : "${d_id:=unknown}" "${d_pretty:=Linux}"
  fi
  case " $d_id $d_like " in
    *" debian "* | *" ubuntu "*) ;;
    *) need "this is $d_pretty, and the bootstrap sets up Debian." "use Debian 12 or 13 (from the Microsoft Store under WSL 2, or in a virtual machine)" ;;
  esac
  wsl=0; wsl_txt=""
  if grep -qi microsoft /proc/version 2>/dev/null || [ -n "${WSL_DISTRO_NAME:-}" ]; then wsl=1; wsl_txt=", under WSL"; fi
  is_debian=0; [ "$d_id" = debian ] && is_debian=1
  tested=0
  case "$d_id:$d_version" in debian:12 | debian:12.* | debian:13 | debian:13.*) tested=1 ;; esac
}

# ---- configuration of this run -----------------------------------------------------------------------------------------------------------------

load_config() {
  kits=$(cfg BOOTSTRAP_KIT "$(cfg WS_HOST_KIT 'base shell embedded-sql')")
  kits=$(printf '%s' "$kits" | tr ',' ' ')
  p=$(cfg WS_HOST_PROMPT pretty)
  reset_prompt=0
  if [ -n "${BOOTSTRAP_PROMPT:-}" ]; then p=$BOOTSTRAP_PROMPT; reset_prompt=1; fi
  case $(printf '%s' "$p" | tr '[:upper:]' '[:lower:]') in
    plain) prompt=plain ;;
    no | false | 0 | off | none | "") prompt=no ;;
    *) prompt=pretty ;;
  esac
  case $(printf '%s' "$(cfg WS_HOST_MODERN yes)" | tr '[:upper:]' '[:lower:]') in
    no | false | 0 | off | none) modern=0 ;;
    *) modern=1 ;;
  esac
  root=$(cfg WS_HOST_HOME "$(cfg WS_HOST_WORKSPACES "$HOME/workspaces")")
  # shellcheck disable=SC2088  # a literal ~ is expanded here, by hand
  case $root in "~") root=$HOME ;; "~/"*) root=$HOME/${root#"~/"} ;; esac
  target=$root/github.com/intellectual-frontiers/archon
  no_apt=0; { [ "${BOOTSTRAP_NO_APT:-}" = 1 ] || [ "${WS_HOST_NO_APT:-}" = 1 ]; } && no_apt=1
  command -v apt-get >/dev/null 2>&1 || no_apt=1
}

kit_on() {  # kit_on NAME
  case " $kits " in *" $1 "*) return 0 ;; *) return 1 ;; esac
}

# ---- packages (apt) --------------------------------------------------------------------------------------------------------------------------

pkg_installed() {  # pkg_installed "a|b": any alternative installed
  for alt in $(printf '%s' "$1" | tr '|' ' '); do
    dpkg-query -W -f='${Status}' "$alt" 2>/dev/null | grep -q 'install ok installed' && return 0
  done
  return 1
}

pkg_candidate() {  # pkg_candidate NAME: the version apt would install, empty when none
  v=$(apt-cache policy "$1" 2>/dev/null | sed -n 's/^ *Candidate: *//p' | head -n 1)
  [ "$v" = "(none)" ] && v=""
  printf '%s' "$v"
}

# The packages the kits name for Debian (ws-host's base.py and shell.py), plus what this script itself needs to fetch and unpack.
wanted_packages() {
  echo "git ca-certificates curl wget tar xz-utils unzip jq gh"
  if kit_on base; then
    echo "coreutils sed findutils diffutils patch gzip zip bzip2 file less debianutils procps hostname ncurses-bin rsync bc grep gawk"
    echo "ripgrep fd-find bash-completion python3 nodejs npm imagemagick webp sqlite3 shellcheck"
    echo "libmagickcore-7.q16-10-extra|libmagickcore-6.q16-7-extra|libmagickcore-6.q16-6-extra"
    [ "$is_debian" = 1 ] && echo "chromium"
    if [ "$is_debian" = 1 ]; then case $d_codename in bookworm | bullseye | "") ;; *) echo "glab" ;; esac; fi
  fi
  return 0
}

fish_major() {  # the major version of the fish program given, or 0
  m=$("$1" --version 2>/dev/null | awk '{print $NF}' | sed 's/\..*//')
  case $m in '' | *[!0-9]*) m=0 ;; esac
  printf '%s' "$m"
}

cand_major() {  # the major version of an apt candidate such as 1:4.0.2-3
  m=${1#*:}; m=${m%%.*}
  case $m in '' | *[!0-9]*) m=0 ;; esac
  printf '%s' "$m"
}

have_fish4() {
  for f in "$bin/fish" "$(command -v fish 2>/dev/null || true)"; do
    [ -n "$f" ] && [ -x "$f" ] && [ "$(fish_major "$f")" -ge 4 ] && return 0
  done
  return 1
}

sudo_cmd=""
sudo_ready=0
sudo_for() {  # sudo_for WHY: administrator rights, once, with the reason first
  [ "$sudo_ready" = 1 ] && return 0
  if [ "$(id -u)" = 0 ]; then sudo_ready=1; return 0; fi
  command -v sudo >/dev/null 2>&1 || return 1
  sudo_cmd=sudo
  say "${b}${e_key}I need administrator rights to $1.${z}"
  say "${d}Type your Linux password when asked, once. Nothing shows while you type: that is normal.${z}"
  if [ "$has_tty" = 1 ]; then
    # shellcheck disable=SC2024  # the terminal is for sudo to read the password from
    sudo -v </dev/tty || return 1
  elif ! sudo -n true 2>/dev/null; then
    return 1
  fi
  sudo_ready=1
  # keep the password alive for the length of the run, so it is not asked again
  ( while :; do sleep 50; sudo -n true 2>/dev/null || exit 0; done ) >/dev/null 2>&1 </dev/null &
  ka_pid=$!
  return 0
}

apt_install() { $sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq -o DPkg::Lock::Timeout=180 "$@"; }
apt_update() { $sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get update -qq -o DPkg::Lock::Timeout=180; }

# Whether apt can give fish 4 on this distribution: its candidate says so; with no package lists yet (a fresh image), its release does.
fish_from_apt() {
  cand=$(pkg_candidate fish)
  if [ -n "$cand" ]; then [ "$(cand_major "$cand")" -ge 4 ]; return; fi
  case $d_codename in bookworm | bullseye | buster | focal | jammy | noble) return 1 ;; *) return 0 ;; esac
}

install_packages() {
  phase "${e_pkg}Setting up Debian's everyday programs"
  if [ "$tested" = 0 ]; then
    warn "This is $d_pretty. The bootstrap is made for Debian 12 and 13; I will go on, and say what does not work."
  fi
  missing=""
  for spec in $(wanted_packages); do
    pkg_installed "$spec" 2>/dev/null || missing="$missing $spec"
  done
  if kit_on shell && ! have_fish4 && fish_from_apt; then missing="$missing fish"; fi
  if [ -z "$missing" ]; then
    say "Everything the packages give is here."
    return 0
  fi
  if [ "$no_apt" = 1 ]; then
    for cmd in git curl; do
      command -v "$cmd" >/dev/null 2>&1 || need "this computer lacks $cmd and I may not install packages." "sudo apt install$missing"
    done
    warn "Not installed, because packages are off here:$missing"
    problem "packages not installed:$missing"
    return 0
  fi
  if [ "$dry" = 1 ]; then
    [ "$(id -u)" = 0 ] || would "say why administrator rights are needed and ask for your password, once"
    would "refresh the package list, then install with apt:$missing"
    return 0
  fi
  if [ "$(id -u)" = 0 ]; then say "Installing:$missing."; fi
  sudo_for "install Debian's everyday programs (git, curl, jq and others)" || need "I could not get administrator rights (no sudo, or the password was not accepted)." "run this again and type your Linux password, or ask an administrator to run: apt install$missing"
  step "${e_list}Checking what is new in Debian" apt_update || need "the package list could not be refreshed." "check your network, then run this again"
  # Resolve each alternative (a|b) to the first the distribution has; a package it lacks is reported, not fatal.
  chosen=""; lacking=""
  for spec in $missing; do
    pick=""
    for alt in $(printf '%s' "$spec" | tr '|' ' '); do
      if [ -n "$(pkg_candidate "$alt")" ]; then pick=$alt; break; fi
    done
    if [ "$pick" = fish ] && [ "$(cand_major "$(pkg_candidate fish)")" -lt 4 ]; then pick=""; fi   # fish 3 is not the shell this sets up; the pinned release is
    if [ -n "$pick" ]; then chosen="$chosen $pick"; elif [ "$spec" != fish ]; then lacking="$lacking $spec"; fi
  done
  if [ -n "$lacking" ]; then warn "This distribution has no package for:$lacking"; problem "no package for:$lacking"; fi
  if [ -n "$chosen" ]; then
    # The few programs the rest of this setup itself needs (to download, unpack, sign in) are installed first, in front of you. The rest are installed in the
    # background while you sign in to GitHub and while the tools download: apt and those downloads touch different files, so they cannot get in each other's way.
    first=""; rest=""
    for pkg in $chosen; do
      case $pkg in git | ca-certificates | curl | wget | tar | xz-utils | unzip | jq | gh | fish) first="$first $pkg" ;; *) rest="$rest $pkg" ;; esac
    done
    if [ -n "$first" ]; then
      count_re='^Setting up '
      count_total=$($sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get install -s -y $first 2>/dev/null | grep -c '^Inst ' || true)
      [ "${count_total:-0}" -gt 0 ] 2>/dev/null || count_total=""
      step "${e_pkg}Installing programs" apt_install $first || need "the packages could not be installed." "run: sudo apt install$first"
      count_re=""; count_total=""
    fi
    if [ -n "$rest" ]; then bg_apt_start $rest; fi
  fi
  return 0
}

# ---- the rest of the packages, installed in the background -----------------------------------------------------------------------------------------
bgapt_on=0; bgapt_total=""
bg_apt_start() {
  bgapt_total=$($sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get install -s -y "$@" 2>/dev/null | grep -c '^Inst ' || true)
  [ "${bgapt_total:-0}" -gt 0 ] 2>/dev/null || bgapt_total=""
  rm -f "$work/bgapt.rc" "$work/bgapt.log"
  ( rc=0; apt_install "$@" >"$work/bgapt.log" 2>&1 </dev/null || rc=$?; echo "$rc" >"$work/bgapt.rc.tmp"; mv "$work/bgapt.rc.tmp" "$work/bgapt.rc" ) &
  bgapt_on=1; bgapt_list="$*"
  logf "started installing in the background:$bgapt_list"
}
bg_apt_wait() {  # waits for the background install, with the same progress line as any install, and stops if it failed
  [ "$bgapt_on" = 1 ] || return 0
  start=$(date +%s); ticks=0
  # shellcheck disable=SC2086
  set -- $frames; nframes=$#
  while [ ! -f "$work/bgapt.rc" ]; do
    if [ "$tty_ui" = 1 ]; then
      ticks=$((ticks + 1))
      if [ "$ticks" -ge 5 ]; then
        n=$(( ticks % nframes )); f=""; i=0
        for f in $frames; do [ "$i" = "$n" ] && break; i=$((i + 1)); done
        done_n=$(grep -c '^Setting up ' "$work/bgapt.log" 2>/dev/null || true)
        of=""; [ -n "$bgapt_total" ] && of=" of $bgapt_total"
        printf '\r\033[K%s%s%s %sFinishing the programs: %s%s%s%s %s(%ss)%s' "$c" "$f" "$z" "$e_pkg" "$b" "$done_n" "$z" "$of" "$d" "$(( $(date +%s) - start ))" "$z" >&2
      fi
    fi
    sleep 0.1
  done
  [ "$tty_ui" = 1 ] && printf '\r\033[K' >&2
  bgapt_on=0
  rc=$(cat "$work/bgapt.rc" 2>/dev/null || echo 1)
  step_no=$((step_no + 1))
  log_from=0
  if [ "$log_ok" = 1 ]; then
    log_from=$(( $(wc -l <"$logfile") + 1 ))
    { printf '\n==== STEP %s: Installing the rest of the programs (exit %s)\n' "$step_no" "$rc"; cat "$work/bgapt.log"; } >>"$logfile" 2>/dev/null || true
  fi
  if [ "$rc" != 0 ]; then
    phase_bad=1
    cp "$work/bgapt.log" "$work/last.log"
    if [ "$keep_going" = 1 ]; then warn "the rest of the programs did not install"; else stop_here "Installing the rest of the programs" "$work/bgapt.log" "$log_from"; fi
  fi
  return 0
}

# Debian calls the fd program fdfind; link the plain name when nothing else holds it
link_fd() {
  mkdir -p "$bin"
  if ! command -v fd >/dev/null 2>&1 && command -v fdfind >/dev/null 2>&1; then ln -s "$(command -v fdfind)" "$bin/fd" 2>/dev/null || true; fi
  return 0
}

# ---- fetching and verifying -------------------------------------------------------------------------------------------------------------------------

sha_of() { sha256sum "$1" | cut -d' ' -f1; }

fetch_to() {  # fetch_to URL DEST
  if command -v curl >/dev/null 2>&1; then curl -fsSL --retry 3 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$1"
  else echo "neither curl nor wget is installed" >&2; return 1; fi
}

# download_verified URL SHA256: the file in the cache, fetched if it is not there, and only if its SHA-256 is the one given. Prints the file's path.
download_verified() {
  mkdir -p "$cache/downloads"
  f=$cache/downloads/$2
  if [ -f "$f" ] && [ "$(sha_of "$f")" = "$2" ]; then printf '%s\n' "$f"; return 0; fi
  part=$f.part.$$
  if ! fetch_to "$1" "$part"; then rm -f "$part"; echo "could not fetch $1" >&2; return 1; fi
  got=$(sha_of "$part")
  if [ "$got" != "$2" ]; then
    rm -f "$part"
    echo "the file at $1 is not the one expected (its SHA-256 is $got, expected $2); nothing was installed" >&2
    return 1
  fi
  mv "$part" "$f"
  printf '%s\n' "$f"
}

# link_into DIR LINKS: link each "name=path" (path inside DIR) into ~/.local/bin, replacing the link atomically.
link_into() {
  dir=$1; shift
  mkdir -p "$bin"
  for item in "$@"; do
    name=${item%%=*}; rel=${item#*=}
    ln -sfn "$dir/$rel" "$bin/.$name.new" && mv -Tf "$bin/.$name.new" "$bin/$name"
  done
}

links_present() {  # links_present LINKS...: every program is linked
  for item in "$@"; do [ -e "$bin/${item%%=*}" ] || [ -L "$bin/${item%%=*}" ] || return 1; done
  return 0
}

set_current() {  # set_current ROOT VERSION
  ln -sfn "$2" "$1/current.new" && mv -Tf "$1/current.new" "$1/current"
}

# unpack FILE KIND DEST STRIP FIRSTNAME: tar (any tarball), zip, or raw (one program, kept as FIRSTNAME)
unpack() {
  case $2 in
    tar) tar -xf "$1" -C "$3" --strip-components="$4" ;;
    zip) unzip -q -o "$1" -d "$3" ;;
    raw) cp "$1" "$3/$5" && chmod 755 "$3/$5" ;;
    *) echo "unknown kind $2" >&2; return 1 ;;
  esac
}

# install_pinned NAME VERSION URL SHA KIND STRIP LINKS...: fetched, verified, unpacked into tools/NAME/VERSION, `current` pointed at it, programs linked.
install_pinned() {
  name=$1; ver=$2; url=$3; sha=$4; kind=$5; strip=$6; shift 6
  troot=$tools/$name
  if [ -L "$troot/current" ] && [ "$(readlink "$troot/current")" = "$ver" ] && [ -d "$troot/$ver" ] && links_present "$@"; then return 0; fi
  if [ ! -d "$troot/$ver" ]; then
    file=$(download_verified "$url" "$sha") || return 1
    mkdir -p "$troot"
    rm -rf "$troot/$ver.partial"; mkdir -p "$troot/$ver.partial"
    first=${1%%=*}
    if ! unpack "$file" "$kind" "$troot/$ver.partial" "$strip" "$first"; then rm -rf "$troot/$ver.partial"; return 1; fi
    mv "$troot/$ver.partial" "$troot/$ver"
  fi
  set_current "$troot" "$ver"
  link_into "$troot/current" "$@"
}

arch_sha() {  # arch_sha PREFIX: the pinned SHA-256 for this architecture, from PREFIX_SHA256_X86_64 / _AARCH64
  case $arch in x86_64) eval "printf '%s' \"\$${1}_SHA256_X86_64\"" ;; *) eval "printf '%s' \"\$${1}_SHA256_AARCH64\"" ;; esac
}

# ---- tools that follow their newest release ----------------------------------------------------------------------------------------------------

gh_token() {
  t=${GH_TOKEN:-${GITHUB_TOKEN:-}}
  if [ -z "$t" ] && command -v gh >/dev/null 2>&1; then t=$(gh auth token 2>/dev/null </dev/null || true); fi
  printf '%s' "$t"
}

api_get() {  # api_get URL DEST: GitHub's answer, with the person's token when there is one (it lifts the hourly limit); never sent elsewhere
  tok=$(gh_token)
  if [ -n "$tok" ]; then curl -fsSL --retry 2 -H "Authorization: Bearer $tok" -H "Accept: application/vnd.github+json" -o "$2" "$1"
  else curl -fsSL --retry 2 -H "Accept: application/vnd.github+json" -o "$2" "$1"; fi
}

# The release file for Linux on this architecture, chosen by its name (ws-host's pick_asset): the one that says linux and the architecture, is not for
# another system, a package or a signature, and, of the rest, is a static (musl) build if there is one, then an archive. With a pattern, the first file
# whose name matches it. Reads a release's JSON; prints the asset's name and download address, tab-separated, and its stated digest.
# shellcheck disable=SC2016  # a jq program: its $variables are jq's
PICK_JQ='
def anyin($l; $xs): any($xs[]; . as $s | $l | contains($s));
def endsany($l; $xs): any($xs[]; . as $s | $l | endswith($s));
def wrongfile: ["darwin","macos","apple","windows","win32","win64",".exe","freebsd","netbsd","openbsd","android",".deb",".rpm",".apk",".msi",".pkg",".dmg",".sig",".asc",".pem",".sbom",".sha",".md5","checksum","sha256",".json",".txt",".sh",".intoto",".sigstore",".bundle","source","src.","debug","-symbols"];
def wrongarch: ["armv","arm32","i686","i386","riscv","s390","ppc","mips","loong","386","x86.","-32bit"];
def archives: [".tar.gz",".tgz",".tar.xz",".txz",".tar.bz2",".tbz",".tbz2",".zip"];
( {x86_64: ["x86_64","amd64","x64"], aarch64: ["aarch64","arm64"]}[$arch] ) as $w
| ( {x86_64: ["aarch64","arm64"], aarch64: ["x86_64","amd64","x64"]}[$arch] ) as $o
| (if $pat != "" then
    [ .assets | to_entries[] | select(.value.name | test($pat)) ] | first // empty | .value
  else
    [ .assets | to_entries[]
      | .key as $i | .value as $a | ($a.name | ascii_downcase) as $l
      | select($l | contains("linux"))
      | select(anyin($l; $w))
      | select(anyin($l; $o) | not)
      | select(anyin($l; wrongfile) | not)
      | select(anyin($l; wrongarch) | not)
      | (endsany($l; archives)) as $arc
      | select($arc or (endsany($l; [".gz",".xz",".bz2",".zst",".7z"]) | not))
      | {i: $i, a: $a,
         score: ((if ($l | contains("musl")) then 4 elif ($l | contains("static")) then 2 else 0 end)
               + (if ($l | contains("gnueabi")) then 0 else 1 end) + (if $arc then 1 else 0 end))}
    ] | sort_by([-.score, .i]) | first // empty | .a
  end)
| select(. != null)
| [.name, .browser_download_url, ((.digest // "") | if startswith("sha256:") then sub("^sha256:"; "") else "" end)] | @tsv
'

# candidate RELEASE.json PATTERN: prints "name<TAB>url<TAB>sha256<TAB>tag" for the file to take, with the checksum GitHub states for it or the one in a
# checksum file beside it; returns 1 (and says why in $work/why) when the release has no such file or no checksum.
candidate() {
  c_rel=$1; c_pat=$2
  c_line=$(jq -r --arg arch "$arch" --arg pat "$c_pat" "$PICK_JQ" "$c_rel") || c_line=""
  if [ -z "$c_line" ]; then echo "the release has no Linux file for $arch that I can choose by its name" >"$work/why"; return 1; fi
  c_name=$(printf '%s' "$c_line" | cut -f1); c_url=$(printf '%s' "$c_line" | cut -f2); c_sha=$(printf '%s' "$c_line" | cut -f3)
  c_tag=$(jq -r '.tag_name // ""' "$c_rel")
  if [ -z "$c_sha" ]; then
    # an older release: a checksum file the publisher put beside it
    for c_sums in $(jq -r '.assets[] | select(.name | test("(checksums?|sha256sums?)(\\.txt)?$|\\.sha256(sum)?$"; "i")) | .browser_download_url' "$c_rel"); do
      curl -fsSL --retry 2 -o "$work/sums" "$c_sums" 2>/dev/null || continue
      c_base=${c_sums##*/}
      c_found=$(awk -v n="$c_name" -v b="$c_base" 'tolower(b) ~ /\.sha256(sum)?$/ && index(tolower(b), tolower(n)) == 1 && length($1) == 64 && $1 ~ /^[0-9a-f]+$/ {print $1; exit}
                                                 length($1) == 64 && $1 ~ /^[0-9a-f]+$/ && index($0, n) {print $1; exit}' "$work/sums")
      if [ -n "$c_found" ]; then c_sha=$c_found; break; fi
    done
  fi
  if [ -z "$c_sha" ]; then echo "the publisher stated no checksum for $c_name" >"$work/why"; return 1; fi
  printf '%s\t%s\t%s\t%s\n' "$c_name" "$c_url" "$c_sha" "$c_tag"
}

# resolve REPO PATTERN: into $work/pick (name, url, sha, tag): the newest release with a Linux file and a checksum, or, when the newest has none, the
# newest before it that has both (up to fifteen back).
resolve() {
  r_api=$github_api/repos/$1/releases
  api_get "$r_api/latest" "$work/rel.json" || { echo "could not ask $r_api/latest" >&2; return 1; }
  if candidate "$work/rel.json" "$2" >"$work/pick" 2>/dev/null; then return 0; fi
  r_why=$(cat "$work/why" 2>/dev/null || true)
  r_new=$(jq -r '.tag_name // ""' "$work/rel.json")
  api_get "$r_api?per_page=15" "$work/rels.json" 2>/dev/null || { echo "$1: $r_why, so I will not install it" >&2; return 1; }
  jq -c --arg t "$r_new" '.[] | select((.draft | not) and (.prerelease | not) and .tag_name != $t)' "$work/rels.json" >"$work/rels.ndjson"
  while IFS= read -r r_one; do
    printf '%s' "$r_one" >"$work/one.json"
    if candidate "$work/one.json" "$2" >"$work/pick" 2>/dev/null; then return 0; fi
  done <"$work/rels.ndjson"
  echo "I found no release of $1 with a Linux file for $arch and a checksum from its publisher ($r_why), so I will not install it" >&2
  return 1
}

version_of_tag() {
  v=$(printf '%s' "$1" | grep -oE '[0-9]+(\.[0-9]+)+' | head -n 1)
  [ -n "$v" ] || v=${1#v}
  printf '%s' "$v"
}

# locate DIR NAMES: the shallowest executable file in DIR with one of the names (a|b|c), relative to DIR; empty when none
locate() {
  idx=0; out=""
  for n in $(printf '%s' "$2" | tr '|' ' '); do
    idx=$((idx + 1))
    out="$out$(find "$1" -type f -name "$n" -perm -100 -printf "%d $idx %P\n" 2>/dev/null)
"
  done
  printf '%s' "$out" | grep -v '^$' | sort -k1,1n -k2,2n | head -n 1 | cut -d' ' -f3-
}

tool_present() {  # tool_present NAME LINKS...: installed, and every program linked
  n=$1; shift
  [ -L "$tools/$n/current" ] && [ -d "$tools/$n/$(readlink "$tools/$n/current")" ] && links_present "$@"
}

# install_release NAME REPO PATTERN LINKS...: the newest release of a GitHub repository, verified, unpacked into tools/NAME/VERSION. LINKS are
# link=name|name, the file names the program may have; each is found wherever the archive put it.
install_release() {
  name=$1; repo=$2; pat=$3; shift 3
  if tool_present "$name" "$@" && [ "${BOOTSTRAP_FRESH:-}" != 1 ]; then return 0; fi
  resolve "$repo" "$pat" || return 1
  asset=$(cut -f1 "$work/pick"); url=$(cut -f2 "$work/pick"); sha=$(cut -f3 "$work/pick"); tag=$(cut -f4 "$work/pick")
  ver=$(version_of_tag "$tag")
  troot=$tools/$name
  if [ -L "$troot/current" ] && [ "$(readlink "$troot/current")" = "$ver" ] && links_present "$@"; then return 0; fi
  if [ ! -d "$troot/$ver" ]; then
    file=$(download_verified "$url" "$sha") || return 1
    case $(printf '%s' "$asset" | tr '[:upper:]' '[:lower:]') in
      *.zip) kind=zip ;;
      *.tar.gz | *.tgz | *.tar.xz | *.txz | *.tar.bz2 | *.tbz | *.tbz2) kind=tar ;;
      *) kind=raw ;;
    esac
    mkdir -p "$troot"
    rm -rf "$troot/$ver.partial"; mkdir -p "$troot/$ver.partial"
    first=${1%%=*}
    if ! unpack "$file" "$kind" "$troot/$ver.partial" 0 "$first"; then rm -rf "$troot/$ver.partial"; return 1; fi
    mv "$troot/$ver.partial" "$troot/$ver"
  fi
  linked=""
  for item in "$@"; do
    link=${item%%=*}; cands=${item#*=}
    rel=$(locate "$troot/$ver" "$cands")
    if [ -z "$rel" ]; then echo "$link is not in what the release holds, so I installed nothing" >&2; rm -rf "${troot:?}/$ver"; return 1; fi
    linked="$linked $link=$ver/$rel"
  done
  set_current "$troot" "$ver"
  # shellcheck disable=SC2086
  link_into "$troot" $linked
  # keep this version and the one before it
  find "$troot" -mindepth 1 -maxdepth 1 -type d ! -name '*.partial' -printf '%T@ %f\n' | sort -rn | tail -n +3 | cut -d' ' -f2- |
    while read -r old; do [ "$old" = "$ver" ] || rm -rf "${troot:?}/$old"; done
  return 0
}

# install_sqlite_org: SQLite's own command line tools (sqlite.org lists the newest version and its SHA3-256); x86-64 only, as sqlite.org builds them
install_sqlite_org() {
  [ "$arch" = x86_64 ] || return 0
  tool_present sqlite3 sqlite3=sqlite3 sqldiff=sqldiff sqlite3_analyzer=sqlite3_analyzer && [ "${BOOTSTRAP_FRESH:-}" != 1 ] && return 0
  site=${BOOTSTRAP_SQLITE_URL:-${WS_HOST_SQLITE_URL:-https://www.sqlite.org}}
  fetch_to "$site/download.html" "$work/sqlite.html" || { echo "could not ask $site" >&2; return 1; }
  row=$(awk -F, '$1 == "PRODUCT" && $3 ~ /sqlite-tools-linux-x64-[0-9]+\.zip$/ && length($5) >= 64 {print $2 "," $3 "," $5; exit}' "$work/sqlite.html" | tr -d '\r')
  [ -n "$row" ] || { echo "sqlite.org publishes no command line tools for $arch" >&2; return 1; }
  ver=${row%%,*}; rest=${row#*,}; path=${rest%%,*}; sha3=${rest#*,}
  troot=$tools/sqlite3
  if [ -L "$troot/current" ] && [ "$(readlink "$troot/current")" = "$ver" ]; then return 0; fi
  fetch_to "$site/$path" "$work/sqlite.zip" || return 1
  got=$(openssl dgst -sha3-256 "$work/sqlite.zip" 2>/dev/null | sed 's/.*= *//')
  [ -n "$got" ] || got=$(python3 -c 'import hashlib,sys;print(hashlib.sha3_256(open(sys.argv[1],"rb").read()).hexdigest())' "$work/sqlite.zip" 2>/dev/null || true)
  [ "$got" = "$sha3" ] || { echo "the file at $site/$path is not the one sqlite.org lists (its SHA3-256 differs); nothing was installed" >&2; return 1; }
  mkdir -p "$troot/$ver"
  unzip -q -o "$work/sqlite.zip" -d "$troot/$ver"
  sub=$(find "$troot/$ver" -name sqlite3 -type f -printf '%P\n' | head -n 1)
  set_current "$troot" "$ver"
  link_into "$troot" "sqlite3=$ver/$sub" "sqldiff=$ver/${sub%sqlite3}sqldiff" "sqlite3_analyzer=$ver/${sub%sqlite3}sqlite3_analyzer"
}

# install_pypi NAME PACKAGE LINKS...: the newest version on PyPI in a virtual environment of its own, tools/NAME/VERSION
install_pypi() {
  name=$1; pkg=$2; shift 2
  if tool_present "$name" "$@" && [ "${BOOTSTRAP_FRESH:-}" != 1 ]; then return 0; fi
  command -v uv >/dev/null 2>&1 || { echo "uv is not here, so $pkg cannot be installed" >&2; return 1; }
  fetch_to "$pypi_url/pypi/$pkg/json" "$work/pypi.json" || { echo "could not ask PyPI about $pkg" >&2; return 1; }
  ver=$(jq -r '.info.version' "$work/pypi.json")
  troot=$tools/$name
  if [ -L "$troot/current" ] && [ "$(readlink "$troot/current")" = "$ver" ] && links_present "$@"; then return 0; fi
  rm -rf "${troot:?}/$ver"; mkdir -p "$troot"
  # a Python of uv's own stays put when the machine's moves on; failing that, any Python that is new enough
  if ! uv venv --python 3.12 --managed-python --quiet "$troot/$ver"; then
    rm -rf "${troot:?}/$ver"
    uv venv --python '>=3.10' --quiet "$troot/$ver" || { rm -rf "${troot:?}/$ver"; return 1; }
  fi
  uv pip install --quiet --python "$troot/$ver/bin/python" "$pkg==$ver" || { rm -rf "${troot:?}/$ver"; return 1; }
  linked=""
  for item in "$@"; do linked="$linked ${item%%=*}=$ver/${item#*=}"; done
  set_current "$troot" "$ver"
  # shellcheck disable=SC2086
  link_into "$troot" $linked
}

# each_tool LIST FUNCTION: calls FUNCTION name repo links... for each line of LIST
each_tool() {
  list=$1; fn=$2
  oldifs=$IFS
  IFS='
'
  for line in $list; do
    IFS=$oldifs
    [ -n "$line" ] || continue
    # shellcheck disable=SC2086
    set -- $line
    "$fn" "$@"
    IFS='
'
  done
  IFS=$oldifs
}

# release_step NAME REPO LINKS...: one tool, one step; a tool that cannot be installed is listed at the end and does not stop the run
release_step() {
  n=$1; repo=$2; shift 2
  if tool_present "$n" "$@" && [ "${BOOTSTRAP_FRESH:-}" != 1 ]; then return 0; fi
  pstep "${e_dl}Installing $n (the newest release)" install_release "$n" "$repo" "" "$@"
  return 0
}

pypi_step() {
  n=$1; pkg=$2; shift 2
  if tool_present "$n" "$@" && [ "${BOOTSTRAP_FRESH:-}" != 1 ]; then return 0; fi
  pstep "${e_py}Installing $n (the newest version)" install_pypi "$n" "$pkg" "$@"
  return 0
}

# ---- ws-host's own runtime: the pinned mise, and through it Python and uv -------------------------------------------------------------------------

runtime_ready() {
  [ -x "$store/python/$PYTHON_VERSION/bin/python3" ] && { [ -x "$store/uv/$UV_VERSION/.mise-bins/uv" ] || [ -x "$store/uv/$UV_VERSION/uv" ]; }
}

install_runtime() {
  sum=$(arch_sha MISE)
  mise=${BOOTSTRAP_MISE:-$data/tools/mise/$MISE_VERSION/bin/mise}
  if [ ! -x "$mise" ]; then
    url=${BOOTSTRAP_MISE_URL:-${WS_HOST_MISE_URL:-https://mise.jdx.dev/v$MISE_VERSION/mise-v$MISE_VERSION-linux-$miseArch.tar.xz}}
    file=$(download_verified "$url" "$sum") || return 1
    tmp=$data/tools/mise/.unpack.$$
    rm -rf "$tmp"; mkdir -p "$tmp"
    tar -xJf "$file" -C "$tmp" --strip-components=1 || { rm -rf "$tmp"; echo "mise could not be unpacked (is xz-utils installed?)" >&2; return 1; }
    rm -rf "$data/tools/mise/$MISE_VERSION"
    mv "$tmp" "$data/tools/mise/$MISE_VERSION"
  fi
  mkdir -p "$data/mise/data" "$state/mise/config"
  for v in $(env | sed -n 's/^\(MISE_[A-Z_]*\)=.*/\1/p'); do unset "$v"; done
  MISE_DATA_DIR=$data/mise/data MISE_CACHE_DIR=$cache/mise MISE_STATE_DIR=$state/mise/state MISE_CONFIG_DIR=$state/mise/config \
    MISE_SAFE=1 MISE_YES=1 NO_COLOR=1 MISE_QUIET=1 "$mise" install "python@$PYTHON_VERSION" "uv@$UV_VERSION"
}

# uv is the one prerequisite of a repository's launcher: put the one of this runtime where a PATH has it, and never replace a uv it did not link
link_uv() {
  mkdir -p "$bin"
  for t in uv uvx; do
    src=$store/uv/$UV_VERSION/.mise-bins/$t
    [ -x "$src" ] || src=$store/uv/$UV_VERSION/$t
    [ -x "$src" ] || continue
    dst=$bin/$t
    if [ ! -e "$dst" ] && [ ! -L "$dst" ]; then ln -s "$src" "$dst"
    elif [ -L "$dst" ]; then
      case $(readlink "$dst") in "$store"/uv/*) [ "$(readlink "$dst")" = "$src" ] || ln -sfn "$src" "$dst" ;; esac
    fi
  done
  return 0
}

setup_runtime() {
  phase "${e_py}Getting Python ready"
  if [ "${BOOTSTRAP_NO_DOWNLOAD:-}" = 1 ]; then say "Skipped (BOOTSTRAP_NO_DOWNLOAD=1)."; return 0; fi
  if [ "${BOOTSTRAP_NO_RUNTIME:-}" = 1 ]; then say "Skipped (BOOTSTRAP_NO_RUNTIME=1)."; return 0; fi
  if ! runtime_ready; then
    step "${e_py}Installing Python and uv" install_runtime || { problem "Python and uv could not be installed"; return 0; }
  fi
  [ "$dry" = 1 ] || link_uv
  return 0
}

# ---- data files: beside the script in a checkout, from BOOTSTRAP_URL in a pipe ----------------------------------------------------------------------

data_file() {  # data_file NAME DEST
  mkdir -p "$(dirname "$2")"
  if [ -n "$script_dir" ] && [ -f "$script_dir/bootstrap/$1" ]; then cp "$script_dir/bootstrap/$1" "$2.new"
  else fetch_to "$raw_url/bin/bootstrap/$1" "$2.new" || { rm -f "$2.new"; echo "could not fetch $raw_url/bin/bootstrap/$1" >&2; return 1; }
  fi
  mv "$2.new" "$2"
}

# ---- the tools of the kits -----------------------------------------------------------------------------------------------------------------------

setup_tools() {
  if [ "${BOOTSTRAP_NO_DOWNLOAD:-}" = 1 ]; then phase "${e_dl}Handy tools"; say "Skipped (BOOTSTRAP_NO_DOWNLOAD=1)."; return 0; fi
  [ "$dry" = 1 ] || mkdir -p "$bin" "$tools"
  if kit_on base; then
    phase "${e_dl}Installing handy command-line tools"
    pool_begin "Installing tools"
    # glab: Debian 13 and Ubuntu carry it as a package (installed above); where the archive has none, the pinned release
    if ! have_cmd glab && ! tool_present glab glab=bin/glab; then
      pstep "${e_dl}Installing glab $GLAB_VERSION" install_pinned glab "$GLAB_VERSION" \
        "https://gitlab.com/gitlab-org/cli/-/releases/v$GLAB_VERSION/downloads/glab_${GLAB_VERSION}_linux_$goarch.tar.gz" "$(arch_sha GLAB)" tar 0 glab=bin/glab
    fi
    if ! tool_present duckdb duckdb=duckdb || [ "${BOOTSTRAP_FRESH:-}" = 1 ]; then
      case $arch in x86_64) dpat='^duckdb_cli-linux-amd64\.zip$' ;; *) dpat='^duckdb_cli-linux-(arm64|aarch64)\.zip$' ;; esac
      pstep "${e_dl}Installing duckdb (the newest release)" install_release duckdb duckdb/duckdb "$dpat" duckdb=duckdb
    fi
    if [ "$arch" = x86_64 ] && { ! tool_present sqlite3 sqlite3=sqlite3 sqldiff=sqldiff sqlite3_analyzer=sqlite3_analyzer || [ "${BOOTSTRAP_FRESH:-}" = 1 ]; }; then
      pstep "${e_dl}Installing the SQLite command line tools (sqlite.org)" install_sqlite_org
    fi
    each_tool "$MODERN_TOOLS" release_step
    pool_end
  fi
  if kit_on embedded-sql; then
    phase "${e_dl}Installing tools for working with data"
    pool_begin "Installing data tools"
    each_tool "$SQL_TOOLS" release_step
    each_tool "$PY_TOOLS" pypi_step
    pool_end
  fi
  return 0
}

# ---- the shell kit: fish 4 and Oh My Posh with ws-host's themes ----------------------------------------------------------------------------------

posh_url() { printf 'https://cdn.ohmyposh.dev/releases/v%s/posh-linux-%s' "$POSH_VERSION" "$goarch"; }
fish_url() { printf 'https://github.com/fish-shell/fish-shell/releases/download/%s/fish-%s-linux-%s.tar.xz' "$FISH_VERSION" "$FISH_VERSION" "$arch"; }

install_themes() {
  mkdir -p "$data/themes"
  for t in ws-host-pretty ws-host-plain; do
    data_file "themes/$t.omp.json" "$work/$t.json" || return 1
    dest=$data/themes/$t.omp.json
    if [ -f "$dest" ] && ! cmp -s "$work/$t.json" "$dest"; then
      mkdir -p "$state/backups"; cp "$dest" "$state/backups/$t.omp.json.$(date +%Y%m%d-%H%M%S)"
    fi
    cmp -s "$work/$t.json" "$dest" 2>/dev/null || cp "$work/$t.json" "$dest"
  done
}

setup_shell_kit() {
  kit_on shell || return 0
  phase "${e_shell}Installing a friendlier shell and prompt"
  if [ "${BOOTSTRAP_NO_DOWNLOAD:-}" = 1 ]; then say "Skipped (BOOTSTRAP_NO_DOWNLOAD=1)."; return 0; fi
  if ! tool_present oh-my-posh oh-my-posh=oh-my-posh; then
    step "${e_dl}Installing Oh My Posh $POSH_VERSION" install_pinned oh-my-posh "$POSH_VERSION" "$(posh_url)" "$(arch_sha POSH)" raw 0 oh-my-posh=oh-my-posh ||
      problem "Oh My Posh could not be installed"
  fi
  # fish 4 came from apt where the distribution has it (installed with the packages); anywhere it does not, the fish project's own release
  if ! have_fish4; then
    if [ "$dry" = 1 ] && fish_from_apt; then :   # listed with the packages above
    else
      step "${e_dl}Installing fish $FISH_VERSION" install_pinned fish "$FISH_VERSION" "$(fish_url)" "$(arch_sha FISH)" tar 0 fish=fish ||
        problem "fish 4 could not be installed"
    fi
  fi
  step "${e_paint}Putting the prompt themes in place" install_themes || problem "the prompt themes could not be put in place"
  return 0
}

# ---- chezmoi and the files it manages --------------------------------------------------------------------------------------------------------------

chezmoi_bin() {
  for f in "$bin/chezmoi" "$(command -v chezmoi 2>/dev/null || true)"; do
    [ -n "$f" ] && [ -x "$f" ] && { printf '%s' "$f"; return 0; }
  done
  return 1
}

run_chezmoi() {  # run_chezmoi ARGS...: ws-host's own configuration, state and source on every call; a person's own chezmoi is never read
  "$chezmoi" --source "$cm_source" --destination "$HOME" --config "$state/chezmoi/chezmoi.toml" --persistent-state "$state/chezmoi/state.boltdb" \
    --cache "$cache/chezmoi" --no-tty --no-pager --force "$@"
}

# render_source: the source state, rewritten at every run: a `modify_` script for each managed file, which runs managed.sh on the file's text.
# source_name REL: chezmoi's name for the modify script of REL: dot_ for a leading dot in every part, and modify_ on the file.
source_name() {
  out=""; rest=$1
  while :; do
    part=${rest%%/*}
    case $part in .*) part=dot_${part#.} ;; esac
    case $rest in
      */*) out=$out$part/; rest=${rest#*/} ;;
      *) out=$out"modify_"$part; break ;;
    esac
  done
  printf '%s' "$out"
}

add_script() {  # add_script REL ARGS...: the modify script for the file REL (relative to the home folder) that applies managed.sh with ARGS
  rel=$1; shift
  f=$cm_source/$(source_name "$rel")
  mkdir -p "$(dirname "$f")"
  {
    printf '#!/bin/sh\n# Written by bootstrap-archon.sh; chezmoi runs it on the file'"'"'s text. Do not edit: the next run rewrites it.\n'
    printf "exec sh '%s'" "$managed"
    for a in "$@"; do printf " '%s'" "$a"; done
    printf '\n'
  } >"$f"
  chmod 755 "$f"
}

# home_rel PATH: PATH relative to the home folder, following a symbolic link (the file it points to is the one that changes); empty, with a
# note, when the file is outside the home folder, which is chezmoi's destination
home_rel() {
  p=$1
  [ -L "$p" ] && p=$(readlink -f "$p")
  case $p in
    "$HOME"/*) printf '%s' "${p#"$HOME"/}" ;;
    *) warn "$1 is outside your home folder, so I left it alone."; printf '' ;;
  esac
}

# managed_differs PATH: whether chezmoi would change the file (0), or not (1); a file it cannot work out counts as different
managed_differs() {
  after=$(run_chezmoi cat "$1" 2>/dev/null) || return 0
  [ -e "$1" ] && [ "$after" = "$(cat "$1")" ] && return 1
  return 0
}

apply_managed() {  # apply_managed PATH: chezmoi writes the file, after a copy of it is kept
  tgt=$1
  if [ -e "$tgt" ]; then
    mkdir -p "$state/backups"
    cp -p "$tgt" "$state/backups/$(basename "$tgt").$(date +%Y%m%d-%H%M%S)"
  fi
  mkdir -p "$(dirname "$tgt")"
  run_chezmoi apply "$tgt"
}

# plan_file PATH KIND THEME ICONS: the blocks for one startup file (KIND is bash or fish, or git for ~/.gitconfig), as managed.sh arguments
plan_file() {
  rel=$(home_rel "$1")
  [ -n "$rel" ] || return 0
  kind=$2; theme_arg=$3; icons_arg=$4
  set --
  if [ "$kind" != git ] && [ "$prompt" != no ]; then set -- "$kind" "$theme_arg"; fi
  if [ "$modern" = 1 ] && [ "$modern_ok" = 1 ]; then set -- "$@" "modern-$kind" "$icons_arg"; fi
  if [ "$#" -gt 0 ]; then
    add_script "$rel" "$@"
    targets="$targets $HOME/$rel"
  fi
  return 0
}

configure_dotfiles() {
  phase "${e_paint}Making your terminal look good"
  if [ "${BOOTSTRAP_NO_DOTFILES:-}" = 1 ]; then say "Skipped (BOOTSTRAP_NO_DOTFILES=1)."; return 0; fi
  if [ "${BOOTSTRAP_NO_DOWNLOAD:-}" = 1 ] && ! chezmoi_bin >/dev/null; then say "Skipped: chezmoi is not here and downloads are off."; return 0; fi
  if [ "$prompt" = no ] && [ "$modern" = 0 ]; then say "Your prompt and commands stay yours (WS_HOST_PROMPT=no, WS_HOST_MODERN=no)."; return 0; fi
  if ! tool_present chezmoi chezmoi=chezmoi; then
    step "${e_dl}Installing chezmoi $CHEZMOI_VERSION" install_pinned chezmoi "$CHEZMOI_VERSION" \
      "https://github.com/twpayne/chezmoi/releases/download/v$CHEZMOI_VERSION/chezmoi_${CHEZMOI_VERSION}_linux_$goarch.tar.gz" "$(arch_sha CHEZMOI)" tar 0 chezmoi=chezmoi ||
      { problem "chezmoi could not be installed, so your terminal was not set up"; return 0; }
  fi
  if [ "$dry" = 1 ]; then
    [ "$prompt" = no ] || would "give ~/.bashrc (and fish's config.fish when fish is there) the Oh My Posh prompt, in a marked block, after a copy is kept"
    [ "$modern" = 0 ] || would "make bash, fish and git use the modern tools (eza, bat, zoxide, fzf, delta, btop), in marked blocks"
    return 0
  fi
  chezmoi=$(chezmoi_bin) || { problem "chezmoi is not here, so your terminal was not set up"; return 0; }
  data_file managed.sh "$data/bootstrap/managed.sh" || { problem "the helper that edits your shell files could not be put in place"; return 0; }
  managed=$data/bootstrap/managed.sh
  kit_on shell || step "${e_paint}Putting the prompt themes in place" install_themes || { problem "the prompt themes could not be put in place"; return 0; }
  cm_source=$data/chezmoi/source
  mkdir -p "$state/chezmoi" "$cache/chezmoi"
  [ -f "$state/chezmoi/chezmoi.toml" ] || printf "# ws-host's own chezmoi configuration: empty on purpose.\n" >"$state/chezmoi/chezmoi.toml"
  for v in $(env | sed -n 's/^\(CHEZMOI[A-Za-z_]*\)=.*/\1/p'); do unset "$v"; done

  theme=ws-host-pretty; icons=icons
  if [ "$prompt" = plain ]; then theme=ws-host-plain; icons=plain; fi
  case $data in
    "$HOME"/*) themeref=\$HOME/${data#"$HOME"/}/themes/$theme.omp.json ;;
    *) themeref=$data/themes/$theme.omp.json ;;
  esac
  fish_here=0; { [ -x "$bin/fish" ] || command -v fish >/dev/null 2>&1; } && fish_here=1
  modern_ok=0; { [ -x "$bin/eza" ] || command -v eza >/dev/null 2>&1; } && modern_ok=1

  rm -rf "$cm_source"; mkdir -p "$cm_source"
  targets=""
  plan_file "$HOME/.bashrc" bash "$themeref" "$icons"
  if [ "$fish_here" = 1 ]; then
    plan_file "$(abs_or "${XDG_CONFIG_HOME:-}" "$HOME/.config")/fish/config.fish" fish "$themeref" "$icons"
  fi
  # git's pager block needs delta, so it is added only where delta is
  if [ "$modern" = 1 ] && { [ -x "$bin/delta" ] || command -v delta >/dev/null 2>&1; }; then
    plan_file "$HOME/.gitconfig" git "$themeref" "$icons"
  fi
  if [ "$modern" = 1 ] && [ "$modern_ok" = 0 ]; then say "The modern tools are not installed yet, so your terminal keeps its old commands."; fi
  # a prompt block a person edited is kept, unless they name a prompt on the command line
  if [ "$reset_prompt" = 1 ]; then BOOTSTRAP_KEEP_BLOCK=0; else BOOTSTRAP_KEEP_BLOCK=1; fi
  export BOOTSTRAP_KEEP_BLOCK
  changed=0
  for t in $targets; do
    if managed_differs "$t"; then
      changed=1
      step "${e_paint}Setting up $t" apply_managed "$t" || problem "$t could not be set up (a copy of what was there is in $state/backups)"
    fi
  done
  return 0
}

# ---- what was installed ---------------------------------------------------------------------------------------------------------------------------

have_cmd() { command -v "$1" >/dev/null 2>&1 || [ -x "$bin/$1" ]; }

verify_install() {
  phase "${e_ok}Checking that everything works"
  if [ "$dry" = 1 ]; then would "check that each program the kits install is here, that fish is version 4 or later, and that Oh My Posh draws its prompts"; return 0; fi
  absent=""
  if kit_on base; then
    for p in git gh jq rg fd curl wget python3 uv node sqlite3 shellcheck eza zoxide fzf bat delta btop just; do have_cmd "$p" || absent="$absent $p"; done
    have_cmd magick || have_cmd convert || absent="$absent ImageMagick"
    have_cmd duckdb || absent="$absent duckdb"
    have_cmd chromium || [ "$is_debian" = 0 ] || absent="$absent chromium"
  fi
  if kit_on shell; then
    have_cmd fish || absent="$absent fish"
    have_cmd oh-my-posh || absent="$absent oh-my-posh"
  fi
  if kit_on embedded-sql; then
    for p in turso usql litestream sqruff dbmate sqlite-utils datasette harlequin vd; do have_cmd "$p" || absent="$absent $p"; done
  fi
  if [ -n "$absent" ]; then warn "Not here:$absent"; problem "not installed:$absent"; fi
  if kit_on shell && have_cmd fish; then
    fp=$(command -v fish 2>/dev/null || printf '%s' "$bin/fish")
    if [ "$(fish_major "$fp")" -ge 4 ]; then :
    else warn "fish is older than version 4."; problem "fish is older than version 4"; fi
    "$fp" -c 'echo (math 1 + 2)' </dev/null 2>/dev/null | grep -q 3 || { warn "fish did not run a command."; problem "fish did not run a command"; }
  fi
  if kit_on shell && have_cmd oh-my-posh && [ -f "$data/themes/ws-host-pretty.omp.json" ]; then
    oh-my-posh print primary --config "$data/themes/ws-host-pretty.omp.json" --shell bash </dev/null >/dev/null 2>&1 ||
      { warn "Oh My Posh did not print a prompt."; problem "Oh My Posh did not print a prompt"; }
  fi
  return 0
}

# ---- GitHub, git and the clone -------------------------------------------------------------------------------------------------------------

sign_in_stop() {  # not signed in: the one stop that is not an error, so it asks for nothing but a second try
  say ""
  say "${y}${b}${e_key}The GitHub sign-in did not finish, so setup paused here.${z}"
  say "${d}Nothing is wrong with your computer. The sign-in is needed because archon is private.${z}"
  say ""
  say "${c}${e_one}1.${z} Type:  ${b}gh auth login --hostname github.com --web --skip-browser --git-protocol https${z}"
  say "${c}${e_two}2.${z} Copy the code, open ${b}https://github.com/login/device${z} in your normal browser, type it, click ${g}${b}Authorize${z}."
  say "${c}${e_three}3.${z} Run this setup again: it picks up where it left off."
  say "${d}Still stuck? The log is $(short_path "$logfile") ; send it to ${support_who:-the support team}.${z}"
  say ""
  exit 5
}
signed_in() { command -v gh >/dev/null 2>&1 && gh auth status --hostname github.com >/dev/null 2>&1 </dev/null; }

sign_in() {
  heading "${e_key}Signing in to GitHub ${d}(the one thing that needs you)${z}"
  if [ "${BOOTSTRAP_NO_AUTH:-}" = 1 ]; then say "Skipped (BOOTSTRAP_NO_AUTH=1)."; return 0; fi
  if [ "$dry" = 1 ]; then
    would "check that you are signed in to GitHub; if not, run: gh auth login --hostname github.com --web --skip-browser --git-protocol https (a code to type into your own browser)"
    would "make gh git's credential helper for github.com, and set the name and email on your commits where git has none"
    return 0
  fi
  have_cmd gh || { warn "gh, the tool that signs you in to GitHub, is not installed."; problem "gh is not installed"; return 0; }
  if signed_in; then
    say "${g}${e_ok}You are signed in to GitHub.${z}"
  elif [ "$has_tty" = 1 ]; then
    say ""
    say "${d}GitHub is the website where this organization keeps its work."
    say "archon, the project this setup copies, is ${b}private${z}${d}: only people the"
    say "owner has added can open it. Need access? Press Ctrl+C, ask the"
    say "owner, then run this setup again.${z}"
    say ""
    say "${c}${e_one}1.${z} GitHub asks ${b}Authenticate Git with your GitHub credentials?${z}"
    say "   Press ${b}Enter${z} (that means yes)."
    say "${c}${e_two}2.${z} A ${b}one-time code${z} appears here, like ${b}ABCD-1234${z}. ${b}Copy it${z}."
    say "${c}${e_three}3.${z} In your normal web browser (Chrome, Edge, Safari, on this computer or"
    say "   your phone), open ${b}https://github.com/login/device${z} ${d}(this setup does not open it for you)${z}."
    say "   Type the code, sign in if asked, click ${g}${b}Authorize${z}."
    say "${c}${e_four}4.${z} Come back here. ${g}${b}Everything after this is automatic.${z} ${e_rocket}"
    say "${d}No password, token or SSH key is typed in this window.${z}"
    say ""
    BROWSER=true gh auth login --hostname github.com --web --skip-browser --git-protocol https </dev/tty || true
    signed_in || sign_in_stop
  else
    sign_in_stop
  fi
  gh auth setup-git --hostname github.com </dev/null >/dev/null 2>&1 || warn "gh could not be made git's credential helper; run: gh auth setup-git"
  return 0
}

identity() {
  [ "${BOOTSTRAP_NO_AUTH:-}" = 1 ] && return 0
  [ "$dry" = 1 ] && return 0
  have_cmd git || return 0
  cur_name=$(git config --global --get user.name 2>/dev/null || true)
  cur_email=$(git config --global --get user.email 2>/dev/null || true)
  ask_name=${BOOTSTRAP_GIT_NAME:-$(cfg WS_HOST_GIT_NAME '')}
  ask_email=${BOOTSTRAP_GIT_EMAIL:-$(cfg WS_HOST_GIT_EMAIL '')}
  prof_name=""; prof_email=""
  if signed_in && { [ -z "$cur_name" ] || [ -z "$cur_email" ] || [ -z "$ask_name" ] || [ -z "$ask_email" ]; }; then
    gh api user </dev/null >"$work/profile.json" 2>/dev/null || : >"$work/profile.json"
    if jq -e '.login' "$work/profile.json" >/dev/null 2>&1; then
      prof_name=$(jq -r '.name // empty' "$work/profile.json")
      # GitHub's private address: it links the commits to the account, and a push that carries it is never refused for exposing an email
      prof_email=$(jq -r 'if .id then "\(.id)+\(.login)@users.noreply.github.com" else "\(.login)@users.noreply.github.com" end' "$work/profile.json")
    fi
  fi
  want_name=$ask_name; [ -n "$want_name" ] || { [ -n "$cur_name" ] || want_name=$prof_name; }
  want_email=$ask_email; [ -n "$want_email" ] || { [ -n "$cur_email" ] || want_email=$prof_email; }
  if [ -z "$want_name" ] && [ -z "$cur_name" ] && [ "$has_tty" = 1 ]; then
    printf '%sWhat name should go on your commits?%s (for example Ada Lovelace; Enter to skip) ' "$b" "$z" >/dev/tty
    read -r want_name </dev/tty || want_name=""
  fi
  [ -n "$want_name" ] && [ "$want_name" != "$cur_name" ] && { git config --global user.name "$want_name"; cur_name=$want_name; say "Commits will carry the name $want_name."; }
  [ -n "$want_email" ] && [ "$want_email" != "$cur_email" ] && { git config --global user.email "$want_email"; cur_email=$want_email; say "Commits will carry the email $want_email."; }
  if [ -z "$cur_name" ]; then
    warn "Git has no name for your commits yet. Run: git config --global user.name \"Your Name\""
  else
    say "Commits will be made as $cur_name${cur_email:+ <$cur_email>}."
  fi
  return 0
}

clone_step() { GIT_TERMINAL_PROMPT=0 git clone --quiet "$archon_url" "$target"; }
fetch_step() { GIT_TERMINAL_PROMPT=0 git -C "$target" fetch --quiet origin; }

workspace_and_clone() {
  heading "${e_dir}Your workspace"
  if [ "$dry" = 1 ]; then
    would "create $root/github.com/intellectual-frontiers"
    [ "${BOOTSTRAP_NO_CLONE:-}" = 1 ] || {
      if [ -d "$target/.git" ]; then would "update $target by fast-forward only"; else would "copy $archon_url to $target"; fi
    }
    return 0
  fi
  mkdir -p "$root/github.com/intellectual-frontiers"
  say "Your workspaces folder is $root."
  [ "${BOOTSTRAP_NO_CLONE:-}" = 1 ] && { cloned=0; say "Skipped the copy of archon (BOOTSTRAP_NO_CLONE=1)."; return 0; }
  have_cmd git || { problem "git is not installed, so archon was not copied"; cloned=0; return 0; }
  if [ "${signin_needed:-0}" = 1 ]; then
    cloned=0
    say ""
    say "${b}${e_key}Sign in to GitHub first${z}; the archon repository (the project's folder on GitHub) is private. In a terminal, type:"
    say ""
    say "    ${c}gh auth login --hostname github.com --web --skip-browser --git-protocol https${z}"
    say ""
    say "Copy the code it shows, open ${b}https://github.com/login/device${z} in your normal browser, type the code, click ${g}${b}Authorize${z}, then run this setup again ${e_next}it picks up where it left off."
    return 0
  fi
  if [ -d "$target/.git" ]; then
    if step_soft "${e_sync}Checking archon for news" fetch_step; then
      git -C "$target" merge --ff-only --quiet '@{upstream}' >/dev/null 2>&1 </dev/null ||
        say "Your copy of archon was left exactly as it was; your work is safe."
      cloned=1
    else
      say "Could not reach $archon_url, so your copy was left as it was; your work is safe."
      cloned=1
    fi
    return 0
  fi
  mkdir -p "$(dirname "$target")"
  if step_soft "${e_dir}Copying archon" clone_step; then
    cloned=1
  else
    cloned=0
    if grep -qiE 'could not read Username|could not read Password|Authentication failed|terminal prompts disabled|Invalid username or password' "$work/last.log" 2>/dev/null; then
      say "GitHub did not accept a login for $archon_url. Sign in with: gh auth login --hostname github.com --web --skip-browser --git-protocol https, then run this again."
    elif grep -qiE 'not found|Repository not found' "$work/last.log" 2>/dev/null; then
      say "GitHub says $archon_url does not exist for your account. Your GitHub login (signed in as $(gh api user --jq .login </dev/null 2>/dev/null || echo unknown)) may not have access to the repository: ask an administrator of the intellectual-frontiers organization to add you, then run this again."
    else
      say "Could not copy $archon_url. Check your network, then run this again."
    fi
    problem "archon was not copied"
  fi
  return 0
}

# ---- the login shell -------------------------------------------------------------------------------------------------------------------------------

login_shell() { getent passwd "$(id -un)" 2>/dev/null | cut -d: -f7; }

offer_fish() {
  kit_on shell || return 0
  [ "${BOOTSTRAP_NO_CHSH:-}" = 1 ] && return 0
  heading "${e_shell}Your login shell"
  fp=$(command -v fish 2>/dev/null || true); [ -n "$fp" ] || fp=$bin/fish
  if [ "$dry" = 1 ]; then
    would "make fish your login shell (the program that starts in each new terminal): chsh -s fish; bash keeps working"
    return 0
  fi
  if [ ! -x "$fp" ] || [ "$(fish_major "$fp")" -lt 4 ]; then say "fish 4 is not installed, so your login shell stays as it is."; return 0; fi
  case $(login_shell) in */fish) say "fish is already your login shell."; return 0 ;; esac
  case $(cfg BOOTSTRAP_CHSH yes) in
    no | NO | false | 0) say "Your login shell stays as it is. To use fish: chsh -s $fp"; return 0 ;;
  esac
  say "${e_shell}Making fish your login shell. ${d}bash keeps working: type bash any time.${z}"
  # chsh accepts only a shell listed in /etc/shells
  if ! grep -qx "$fp" /etc/shells 2>/dev/null; then
    if sudo_for "add fish to the list of login shells (/etc/shells)"; then
      printf '%s\n' "$fp" | $sudo_cmd tee -a /etc/shells >/dev/null || { warn "Could not add $fp to /etc/shells."; return 0; }
    else
      warn "I could not get administrator rights to list fish as a login shell. Run: command -v fish | sudo tee -a /etc/shells; chsh -s $fp"
      return 0
    fi
  fi
  me=$(id -un)
  if [ "$(id -u)" = 0 ]; then
    chsh -s "$fp" "$me" </dev/null || warn "chsh failed. Run: chsh -s $fp"
  elif [ "$sudo_ready" = 1 ] && [ -n "$sudo_cmd" ] && $sudo_cmd -n true 2>/dev/null; then
    # the administrator rights asked for at the start are still good, so the change needs no second password
    $sudo_cmd chsh -s "$fp" "$me" </dev/null || warn "chsh failed. Run: chsh -s $fp"
  elif [ "$has_tty" = 1 ]; then
    say "${b}${e_key}One password, once more.${z} Debian is about to ask for ${b}Password:${z}."
    say "That is ${b}the Linux password for ${me}${z}, the same one you typed when this setup first asked for administrator rights."
    say "${d}Nothing shows while you type: that is normal. Press Enter when done.${z}"
    chsh -s "$fp" </dev/tty || warn "chsh did not change your shell. Run: chsh -s $fp"
  else warn "chsh needs the Linux password of $me and there is no terminal. Run: chsh -s $fp"; fi
  case $(login_shell) in */fish) say "fish is now your login shell; it starts in each new terminal window." ;; esac
  return 0
}

# ---- archon -----------------------------------------------------------------------------------------------------------------------------------

link_archon() {
  mkdir -p "$bin"
  w=$bin/archon
  if [ ! -e "$w" ] || grep -q 'bootstrap-archon wrapper' "$w" 2>/dev/null; then
    printf '#!/bin/sh\n# bootstrap-archon wrapper: runs the clone'"'"'s launcher, so archon works from any folder\nexec "%s/archon" "$@"\n' "$target" >"$w"
    chmod 755 "$w"
  else
    warn "$w exists and is not mine, so I left it; run archon as $target/archon"
  fi
}

# in_archon_quiet COMMAND...: the same, for a step: every question is answered yes, and the progress lines archon draws for a person are off.
in_archon_quiet() {
  ( cd "$target" && ARCHON_ASSUME_YES=1 ARCHON_PROGRESS=never "$@" </dev/null )
}
in_archon() {  # in_archon COMMAND...: run in the clone, showing its output; asking nothing of standard input unless there is a terminal
  if [ "$has_tty" = 1 ]; then ( cd "$target" && "$@" </dev/tty ); else ( cd "$target" && "$@" </dev/null ); fi
}

run_archon() {
  heading "${e_rocket}archon"
  if [ "$dry" = 1 ]; then
    [ "${BOOTSTRAP_NO_CLONE:-}" = 1 ] || [ "${BOOTSTRAP_NO_ARCHON:-}" = 1 ] || {
      would "link ~/.local/bin/archon to the clone's launcher"
      would "run in the clone: ./archon doctor"
      would "run in the clone: ./archon toolchain ensure (every entry of ./archon toolchain list that is not ready and not optional)"
      would "run in the clone: ./archon check"
    }
    return 0
  fi
  if [ "${cloned:-0}" != 1 ] || [ ! -x "$target/archon" ]; then say "archon is not here yet, so I ran none of its commands."; archon_ran=0; return 0; fi
  link_archon
  if [ "${BOOTSTRAP_NO_ARCHON:-}" = 1 ]; then say "Skipped archon's commands (BOOTSTRAP_NO_ARCHON=1)."; archon_ran=0; return 0; fi
  have_cmd uv || { warn "uv is not here, so archon cannot start (its launcher needs only uv)."; problem "archon was not run: uv is missing"; archon_ran=0; return 0; }
  archon_ran=1
  status_doctor=0; status_tool=0; status_check=0
  names=""
  case $(cfg BOOTSTRAP_TOOLCHAIN '') in
    none) ;;
    all) names=$( ( cd "$target" && ./archon toolchain list --json </dev/null 2>/dev/null ) | jq -r '.data.entries[].name' 2>/dev/null || true) ;;
    "") names=$( ( cd "$target" && ./archon toolchain list --json </dev/null 2>/dev/null ) |
           jq -r '.data.entries[] | select(.ready | not) | select((.summary | ascii_downcase | contains("optional")) | not) | .name' 2>/dev/null || true) ;;
    *) names=$(cfg BOOTSTRAP_TOOLCHAIN '') ;;
  esac
  names=$(printf '%s' "$names" | tr '\n' ' ' | sed 's/ *$//')
  phase "${e_rocket}Getting archon ready ${d}(the first time takes a few minutes)${z}"
  # Every question archon could ask (install a program with apt?) is answered yes; sudo's password was asked once, above, and is kept alive.
  if [ -n "$names" ]; then
    # shellcheck disable=SC2086
    step "${e_pkg}Installing the programs archon uses" in_archon_quiet ./archon toolchain ensure $names || status_tool=$?
  fi
  step_soft "${e_ok}Checking that this computer is ready" in_archon_quiet ./archon doctor || status_doctor=$?
  step_soft "${e_ok}Checking that archon is healthy" in_archon_quiet ./archon check || status_check=$?
  phase_close
  if [ "$status_check" != 0 ] && [ -f "$work/last.log" ]; then
    say "${y}${warnmark}archon's own checks found things to look at (setup itself is fine):${z}"
    grep -E '❎|\[[a-z-]+\]' "$work/last.log" 2>/dev/null | grep -v 'not observable' | head -12 | sed 's/^/   /' || true
    say "${d}   Run ${b}archon check${z}${d} any time to see them all.${z}"
  fi
  return 0
}

# ---- the end ---------------------------------------------------------------------------------------------------------------------------------

finish() {
  [ "$dry" = 1 ] && { say ""; say "That was a dry run: nothing was changed, fetched or asked."; return 0; }
  heading "Summary"
  failed=0
  if [ "${archon_ran:-0}" = 1 ]; then
    for pair in "doctor:$status_doctor" "toolchain ensure:$status_tool" "check:$status_check"; do
      n=${pair%%:*}; s=${pair##*:}
      if [ "$s" = 0 ]; then say "  ${g}${tick}${z} ./archon $n"; else say "  ${r}${cross}${z} ./archon $n (exit status $s)"; failed=1; fi
    done
  fi
  if [ -s "$problems" ]; then
    say ""
    say "${b}These did not work, and nothing else depended on them:${z}"
    sed 's/^/  - /' "$problems"
    say "Run this again to retry; what is installed stays."
  fi
  if [ "$prompt" = pretty ] && kit_on shell && [ "${BOOTSTRAP_NO_DOTFILES:-}" != 1 ]; then
    font_where="in the program that shows your terminal window (not inside Debian)"
    [ "$wsl" = 1 ] && font_where="in Windows (not in Debian)"
    say ""
    say "${b}${e_font}One thing for the prompt: a Nerd Font${z}"
    say "Your prompt draws small icons from a Nerd Font, a font that carries"
    say "icon characters. Until one is chosen in your terminal you will see"
    say "boxes instead. It takes two minutes, once, $font_where:"
    say "  ${c}1.${z} Download CaskaydiaCove Nerd Font and unzip it:"
    say "     ${b}https://www.nerdfonts.com/font-downloads${z}"
    say "  ${c}2.${z} Select the font files, right-click, \"Install for all users\"."
    say "  ${c}3.${z} In Windows Terminal: Settings, Profiles, Debian, Appearance,"
    say "     set Font face to ${b}CaskaydiaCove Nerd Font${z}."
    say "${d}No font wanted? Run this again with BOOTSTRAP_PROMPT=plain: the same${z}"
    say "${d}prompt made of emoji and lines.${z}"
  fi
  case ":$orig_path:" in
    *":$bin:"*) ;;
    *)
      sh_name=bash
      kit_on shell && have_cmd fish && sh_name=fish   # fish is the shell this sets up, so it is the one to start
      say ""
      say "${b}${e_sync}One last thing:${z} this window does not know your new shell yet."
      say "Type the line below, or close this window and open a new one."
      say ""
      say "    ${c}exec $sh_name -l${z}"
      ;;
  esac
  say ""
  if [ "${cloned:-0}" = 1 ]; then
    say "${b}${e_next}Next${z}"
    say ""
    say "    ${c}archon orch status${z}    see the state of the harness"
    say "    ${c}archon orch dev${z}       then run the development site, with the Console"
    say ""
    say "Run them from any folder (${bin}/archon runs the clone's launcher), or in ${target}."
  elif [ "${signin_needed:-0}" = 1 ]; then
    say "${b}${e_next}Next${z}: sign in to GitHub (above), then run this setup again."
  fi
  [ "$failed" = 0 ] || return 1
  return 0
}

# ---- the plan, and the run ------------------------------------------------------------------------------------------------------------------

main() {
  detect_platform
  load_config
  PATH=$bin:$PATH
  export PATH
  if [ "$dry" = 0 ]; then mkdir -p "$bin" "$data" "$state" "$cache"; fi

  say "${b}${e_rocket}Setting up this computer${z} (${d_pretty}, $arch$wsl_txt) for the Intellectual Frontiers harness."
  [ "$dry" = 1 ] && say "${d}Dry run: this lists the steps and changes nothing.${z}"

  signin_needed=0; cloned=0; archon_ran=0
  # Two things need a person, once each and up front: the Linux password (to install programs) and the GitHub sign-in. Then it all runs by itself.
  install_packages
  sign_in
  identity
  setup_runtime
  setup_tools
  setup_shell_kit
  configure_dotfiles
  bg_apt_wait
  [ "$dry" = 1 ] || link_fd
  verify_install
  workspace_and_clone
  offer_fish
  run_archon
  finish
}

# BOOTSTRAP_SOURCE_ONLY=1 loads the functions and runs nothing, so a test can call one
[ "${BOOTSTRAP_SOURCE_ONLY:-}" = 1 ] || main "$@"
