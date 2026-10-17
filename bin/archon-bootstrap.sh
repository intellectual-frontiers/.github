#!/bin/sh
# Set up a computer for the Intellectual Frontiers harness (0136-machine-bootstrap, the bootstrap): the one script that may use administrator rights. A blank Debian 12
# or 13, or an Arch-based Linux such as Omarchy (amd64 or arm64), under WSL 2 or in a virtual machine, gets the programs the setup needs, and then `archon-setup.sh` runs
# for the account that runs this, which does the rest without administrator rights and writes only inside that account's home folder. The account is whichever user you
# start this as (it can be called anything); this script makes no account. To undo it all, delete the WSL distribution or the virtual machine. On a computer you already use,
# make a user for archon yourself, log in as it and run archon-setup.sh there; deleting that user removes everything. A Mac with Apple silicon gets no package (the setup
# fetches what it needs into the account's own folder): the bootstrap only checks the Command Line Tools and runs the setup.
#
#   cd && sudo apt update && sudo apt install -y curl wget      (a bare Debian has neither)
#   curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/archon-bootstrap.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/archon-bootstrap.sh | sh -s -- --dry-run
#
#   1. Packages: installs what is missing with apt or pacman (it says why it needs administrator rights and asks for your password once, first): git, curl, gh, jq and the
#      other programs the setup needs and, unless BOOTSTRAP_NO_COMFORT=1, the everyday programs (ripgrep, ImageMagick, sqlite3 and the rest),
#   2. Editor: on a machine with a desktop that is not under WSL, Microsoft's package for VS Code from Microsoft's apt repository (its key checked against a pinned SHA-256),
#   3. Setup: runs archon-setup.sh as you with --comfort, so the comfort kits are installed (BOOTSTRAP_NO_COMFORT=1 leaves them out),
#   4. Login shell: offers to make fish your login shell (chsh), where fish is installed as a package (not on a Mac, where zsh stays).
#
# Safe to run again. Options (after `sh -s --` when piped):
#   --dry-run          list every step it would take, change nothing, fetch nothing, ask for nothing
#   -h, --help         this text
#
# Environment (a "1" switches it on): BOOTSTRAP_NO_PACKAGES=1 or BOOTSTRAP_NO_APT=1 (install no package), BOOTSTRAP_NO_COMFORT=1, BOOTSTRAP_NO_EDITOR=1, BOOTSTRAP_NO_CHSH=1 / BOOTSTRAP_CHSH=no, BOOTSTRAP_URL (where
# archon-setup.sh is fetched from when this is piped), BOOTSTRAP_SETUP (a file to run as the setup), and every variable archon-setup.sh reads.
# Exit status: 0 done, 1 archon's own checks found something to look at, 2 usage, 3 the computer cannot be set up yet, 4 a step failed, 5 the GitHub sign-in did not finish.
# shellcheck disable=SC2034,SC2154  # the variables the setup sets and the functions it defines are this script's, since it is loaded without being run
set -eu

boot_dry=0
boot_source_only=${BOOTSTRAP_SOURCE_ONLY:-}   # 1: load the functions and run nothing, so a test can call one
while [ "$#" -gt 0 ]; do
  case $1 in
    --dry-run | -n) boot_dry=1 ;;
    -h | --help)
      case $0 in *archon-bootstrap.sh) sed -n '2,/^# shellcheck disable=SC2034/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//' ;; *) echo "Usage: curl -fsSL URL | sh -s -- [--dry-run]   (see the header of archon-bootstrap.sh)" ;; esac
      exit 0 ;;
    *) echo "archon-bootstrap: unknown option $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

# ---- the setup: beside this script in a checkout, fetched from BOOTSTRAP_URL when this is piped. Its functions (the log, the steps, the support file, the
# telemetry) are this script's too, so it is loaded without running it; this account runs the same file.
boot_dir=""
case $0 in */archon-bootstrap.sh | archon-bootstrap.sh) [ -f "$0" ] && boot_dir=$(cd "$(dirname "$0")" && pwd -P) ;; esac
setup_file=${BOOTSTRAP_SETUP:-}
if [ -z "$setup_file" ] && [ -n "$boot_dir" ] && [ -f "$boot_dir/archon-setup.sh" ]; then setup_file=$boot_dir/archon-setup.sh; fi
if [ -z "$setup_file" ]; then
  setup_dir=$(mktemp -d "${TMPDIR:-/tmp}/archon-bootstrap.XXXXXX") && chmod 755 "$setup_dir"
  setup_file=$setup_dir/archon-setup.sh
  raw=${BOOTSTRAP_URL:-https://raw.githubusercontent.com/intellectual-frontiers/.github/main}
  if command -v curl >/dev/null 2>&1; then curl -fsSL --connect-timeout 20 --retry 3 -o "$setup_file" "$raw/bin/archon-setup.sh" || { echo "archon-bootstrap: could not fetch $raw/bin/archon-setup.sh" >&2; exit 3; }
  elif command -v wget >/dev/null 2>&1; then wget -q -T 30 -O "$setup_file" "$raw/bin/archon-setup.sh" || { echo "archon-bootstrap: could not fetch $raw/bin/archon-setup.sh" >&2; exit 3; }
  else echo "archon-bootstrap: neither curl nor wget is installed. Install them with your package manager first (Debian: sudo apt update && sudo apt install -y curl wget; Arch: sudo pacman -S --needed curl wget)" >&2; exit 3; fi
  chmod 644 "$setup_file"
fi
[ -r "$setup_file" ] || { echo "archon-bootstrap: $setup_file cannot be read" >&2; exit 3; }

BOOTSTRAP_SOURCE_ONLY=1
export BOOTSTRAP_SOURCE_ONLY
if [ "$boot_dry" = 1 ]; then set -- --dry-run; else set --; fi
# shellcheck source=archon-setup.sh
. "$setup_file"
BOOTSTRAP_SOURCE_ONLY=$boot_source_only
export BOOTSTRAP_SOURCE_ONLY
dry=$boot_dry
comfort=1   # the bootstrap is opinionated: the comfort kits are on unless BOOTSTRAP_NO_COMFORT=1 (load_config reads it)


# Microsoft's apt signing key (fingerprint BC52 8686 B50D 79E3 39D3 721C EB3E 94AD BE12 29CF), for VS Code on a Debian machine that is not under WSL
MS_KEY_URL=https://packages.microsoft.com/keys/microsoft.asc
MS_KEY_SHA256=2fa9c05d591a1582a9aba276272478c262e95ad00acf60eaee1644d93941e3c6

sudo_cmd=""
sudo_ready=0

# ---- packages (apt): what the setup needs, and the everyday programs ------------------------------------------------------------------------------------

# The commands are the table's (commons 0002-packaging); what each prints is read here, because it differs by manager.
pkg_installed() {  # pkg_installed "a|b": any alternative installed
  pi_cmd=$(pm_query_installed_words "$family")
  [ -n "$pi_cmd" ] || return 1
  for alt in $(printf '%s' "$1" | tr '|' ' '); do
    # shellcheck disable=SC2086  # the table's words
    pi_out=$($pi_cmd "$alt" 2>/dev/null) || continue
    case $family in debian) printf '%s' "$pi_out" | grep -q 'install ok installed' || continue ;; esac
    return 0
  done
  return 1
}

pkg_candidate() {  # pkg_candidate NAME: the version the package manager would install, empty when none
  pc_cmd=$(pm_query_candidate_words "$family")
  # shellcheck disable=SC2086  # the table's words
  pc_out=$([ -n "$pc_cmd" ] && $pc_cmd "$1" 2>/dev/null || true)
  case $family in
    arch) v=$(printf '%s\n' "$pc_out" | sed -n 's/^Version *: *//p' | head -n 1) ;;
    *) v=$(printf '%s\n' "$pc_out" | sed -n 's/^ *Candidate: *//p' | head -n 1) ;;
  esac
  [ "$v" = "(none)" ] && v=""
  printf '%s' "$v"
}

cand_major() {  # the major version of an apt candidate such as 1:4.0.2-3
  m=${1#*:}; m=${m%%.*}
  case $m in '' | *[!0-9]*) m=0 ;; esac
  printf '%s' "$m"
}

# The packages the setup needs from the computer (it installs none itself), then the everyday programs of the comfort kits (ws-host's base.py).
# The names are the table's, by family (commons 0002-packaging); only what depends on the release is decided here.
wanted_packages() {
  wp_line=""
  for wp_prog in $(pm_programs required); do wp_n=$(pm_package "$family" "$wp_prog"); [ -z "$wp_n" ] || wp_line="$wp_line $wp_n"; done
  echo "${wp_line# }"
  kit_on base || return 0
  wp_line=""
  for wp_prog in $(pm_programs comfort); do
    if [ "$wp_prog" = glab ] && [ "$family" = debian ]; then   # Debian 12 has no package (the setup fetches the release); Ubuntu is left to it too
      [ "$is_debian" = 1 ] || continue
      case $d_codename in bookworm | bullseye | "") continue ;; esac
    fi
    wp_n=$(pm_package "$family" "$wp_prog"); [ -z "$wp_n" ] || wp_line="$wp_line $wp_n"
  done
  echo "${wp_line# }"
  return 0
}

sudo_for() {  # sudo_for WHY: administrator rights, once, with the reason first
  [ "$sudo_ready" = 1 ] && return 0
  if [ "$(id -u)" = 0 ]; then sudo_ready=1; return 0; fi
  command -v sudo >/dev/null 2>&1 || return 1
  sudo_cmd=sudo
  say "${b}${e_key}I need administrator rights to $1.${z}"
  say "${d}Type your $([ "$family" = macos ] && echo Mac || echo Linux) password when asked, once. Nothing shows while you type: that is normal.${z}"
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

# The words are the table's: what is installed stays (--needed), and never -Sy on Arch, which refreshes the list alone and leaves a rolling release partly upgraded (0136-machine-bootstrap FR-053;
# commons 0002-packaging FR-005). apt's quiet flag and lock wait are this script's own.
pm_run() {  # pm_run FAMILY WORDS ARGS...: the family's command, as administrator, with the environment it asks for
  pr_fam=$1; pr_words=$2; shift 2
  pr_env=$(pm_environment "$pr_fam")
  case $pr_fam in debian) pr_extra="-qq -o DPkg::Lock::Timeout=180" ;; *) pr_extra="" ;; esac
  # shellcheck disable=SC2086  # the table's words
  if [ -n "$pr_env" ]; then $sudo_cmd env "$pr_env" $pr_words $pr_extra "$@"; else $sudo_cmd $pr_words $pr_extra "$@"; fi
}
pm_install() { pm_run "$family" "$(pm_install_words "$family")" "$@"; }
apt_install() { pm_run debian "$(pm_install_words debian)" "$@"; }
apt_update() { pm_run debian "$(pm_refresh_words debian)"; }

# Whether apt can give fish 4 on this distribution: its candidate says so; with no package lists yet (a fresh image), its release does.
fish_from_apt() {   # whether the package manager can give fish 4 on this distribution
  [ "$family" = arch ] && return 0
  cand=$(pkg_candidate fish)
  if [ -n "$cand" ]; then [ "$(cand_major "$cand")" -ge 4 ]; return; fi
  case $d_codename in bookworm | bullseye | buster | focal | jammy | noble) return 1 ;; *) return 0 ;; esac
}

# the account database: getent on Linux, dscl on a Mac
acct_field() {  # acct_field NAME home|shell
  if [ "$family" = macos ]; then
    case $2 in home) f=NFSHomeDirectory ;; *) f=UserShell ;; esac
    dscl . -read "/Users/$1" "$f" 2>/dev/null | sed "s/^$f: *//"
  else
    case $2 in home) n=6 ;; *) n=7 ;; esac
    getent passwd "$1" 2>/dev/null | cut -d: -f"$n"
  fi
}
login_shell() { acct_field "$(id -un)" shell; }

# A Mac: no package manager and no package (0136-machine-bootstrap FR-058). The Command Line Tools are Apple's and need a person at the screen; the setup fetches jq and gh itself.
mac_packages() {
  phase "${e_pkg}Checking this Mac"
  if [ "$dry" = 1 ]; then
    would "check that the Command Line Tools are here (git); if not, stop and say to run: xcode-select --install"
    would "install no package: macOS has curl, tar and unzip, and the setup gets jq and gh itself"
    return 0
  fi
  mac_need_clt
  say "A Mac needs no package from this script: the setup fetches jq and gh itself, into the account's own folder."
}

install_packages() {
  if [ "$family" = macos ]; then mac_packages; return 0; fi
  phase "${e_pkg}Setting up the everyday programs ($family family)"
  if [ "$tested" = 0 ]; then
    warn "This is $d_pretty. The bootstrap is made for Debian 12 and 13 and for Arch; I will go on, and say what does not work."
  fi
  missing=""
  for spec in $(wanted_packages); do
    pkg_installed "$spec" 2>/dev/null || missing="$missing $spec"
  done
  if kit_on shell && fish_from_apt && ! pkg_installed fish 2>/dev/null; then missing="$missing fish"; fi
  if [ -z "$missing" ]; then
    say "Everything the packages give is here."
    return 0
  fi
  if [ "${BOOTSTRAP_NO_APT:-}" = 1 ] || [ "${BOOTSTRAP_NO_PACKAGES:-}" = 1 ] || [ "${WS_HOST_NO_APT:-}" = 1 ] || ! command -v "$(pm_install_words "$family" | cut -d' ' -f1)" >/dev/null 2>&1; then
    for cmd in git curl; do
      command -v "$cmd" >/dev/null 2>&1 || need "this computer lacks $cmd and I may not install packages." "$(admin_install_names $missing)"
    done
    warn "Not installed, because packages are off here:$missing"
    problem "packages not installed:$missing"
    return 0
  fi
  if [ "$dry" = 1 ]; then
    [ "$(id -u)" = 0 ] || would "say why administrator rights are needed and ask for your password, once"
    if [ -z "$(pm_refresh_words "$family")" ]; then would "install with $(pm_manager "$family") (--needed, never refreshing the package list alone):$missing"
    else would "refresh the package list, then install with $(pm_manager "$family"):$missing"; fi
    return 0
  fi
  if [ "$(id -u)" = 0 ]; then say "Installing:$missing."; fi
  sudo_for "install the everyday programs (git, curl, jq and others)" || need "I could not get administrator rights (no sudo, or the password was not accepted)." "run this again and type your Linux password, or ask an administrator to install:$missing"
  if [ -z "$(pm_refresh_words "$family")" ]; then
    # the table has no refresh for the family (Arch: never -Sy), and the names are its own and unique, so the manager decides what it has: a package it cannot find means a package list older than the repositories
    chosen=$missing
  else
    step "${e_list}Checking what is new in Debian" apt_update || need "the package list could not be refreshed." "check your network, then run this again"
    # Resolve each alternative (a|b) to the first the distribution has; a package it lacks is reported, not fatal.
    chosen=""; lacking=""
    for spec in $missing; do
      pick=""
      for alt in $(printf '%s' "$spec" | tr '|' ' '); do
        if [ -n "$(pkg_candidate "$alt")" ]; then pick=$alt; break; fi
      done
      if [ "$pick" = fish ] && [ "$(cand_major "$(pkg_candidate fish)")" -lt 4 ]; then pick=""; fi   # fish 3 is not the shell this sets up; the setup's pinned release is
      if [ -n "$pick" ]; then chosen="$chosen $pick"; elif [ "$spec" != fish ]; then lacking="$lacking $spec"; fi
    done
    if [ -n "$lacking" ]; then warn "This distribution has no package for:$lacking"; problem "no package for:$lacking"; fi
  fi
  if [ -n "$chosen" ]; then
    if [ "$family" = debian ]; then
      count_re='^Setting up '
      count_total=$($sudo_cmd env "$(pm_environment debian)" apt-get install -s -y $chosen 2>/dev/null | grep -c '^Inst ' || true)
      [ "${count_total:-0}" -gt 0 ] 2>/dev/null || count_total=""
    fi
    # shellcheck disable=SC2086
    if ! step_soft "${e_pkg}Installing programs" pm_install $chosen; then
      if [ "$family" = arch ] && grep -qiE 'target not found|failed retrieving file|could not find' "$work/last.log" 2>/dev/null; then
        need "pacman could not find a package, so its package list is probably older than the repositories (it was not refreshed here: that alone would leave the system partly upgraded)." "run: sudo pacman -Syu   then run this again"
      fi
      need "the packages could not be installed." "run: $(admin_install_names $chosen)"
    fi
    count_re=""; count_total=""
  fi
  return 0
}

apt_code() {  # Microsoft's repository, signed by its pinned key, then the package
  key=$(download_verified "$MS_KEY_URL" "$MS_KEY_SHA256") || return 1
  $sudo_cmd install -D -m 644 "$key" /usr/share/keyrings/microsoft.asc || return 1
  printf 'Types: deb\nURIs: https://packages.microsoft.com/repos/code\nSuites: stable\nComponents: main\nArchitectures: amd64 arm64\nSigned-By: /usr/share/keyrings/microsoft.asc\n' |
    $sudo_cmd tee /etc/apt/sources.list.d/vscode.sources >/dev/null || return 1
  apt_update && apt_install code
}

# VS Code's Microsoft package, on a machine with a desktop that is not under WSL (under WSL the setup makes `code` run VS Code on Windows)
install_code_package() {
  [ "${BOOTSTRAP_NO_EDITOR:-}" = 1 ] && return 0
  [ "$wsl" = 1 ] && return 0
  [ "$family" = debian ] || return 0   # Arch has no Microsoft repository to add; the setup says what to run
  command -v code >/dev/null 2>&1 && return 0
  [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] || return 0
  phase "${e_code}Installing VS Code"
  if [ "$dry" = 1 ]; then would "install VS Code from Microsoft's apt repository (its signing key checked against its pinned SHA-256)"; return 0; fi
  if [ "${BOOTSTRAP_NO_APT:-}" = 1 ]; then say "Skipped installing VS Code (BOOTSTRAP_NO_APT=1)."; return 0; fi
  sudo_for "install VS Code from Microsoft's apt repository" || { problem "VS Code: no administrator rights to install it"; return 0; }
  step "${e_dl}Installing VS Code from Microsoft's apt repository" apt_code || problem "VS Code could not be installed from Microsoft's apt repository"
  return 0
}

# The setup asks archon which system libraries its programs need (0136-machine-bootstrap FR-063) and calls this to install them: the bootstrap has the administrator rights, once, already.
bootstrap_install_libraries() {  # bootstrap_install_libraries "package package ..."
  if [ "${BOOTSTRAP_NO_APT:-}" = 1 ] || [ "${BOOTSTRAP_NO_PACKAGES:-}" = 1 ]; then return 1; fi
  sudo_for "install the system libraries archon's programs link against ($1)" || return 1
  # shellcheck disable=SC2086  # a list of package names
  step_soft "${e_pkg}Installing system libraries for archon's programs" pm_install $1
}

# ---- the setup, run as this account -------------------------------------------------------------------------------------------------------------------

run_setup() {
  heading "${e_rocket}Setting up archon in this account"
  install_method=bootstrap   # what archon-setup.sh records (0136-machine-bootstrap FR-060)
  # the setup's own steps, in this process, which is already set up with the log, the steps and the telemetry (it uses no administrator rights)
  main || return $?
  return 0
}

# ---- the login shell -----------------------------------------------------------------------------------------------------------------------

offer_fish() {
  kit_on shell || return 0
  [ "${BOOTSTRAP_NO_CHSH:-}" = 1 ] && return 0
  [ "$family" = macos ] && return 0   # fish is not set up on a Mac: zsh stays the login shell
  fp=$(command -v fish 2>/dev/null || true)
  who=$(id -un)
  heading "${e_shell}The login shell of $who"
  if [ "$dry" = 1 ]; then
    would "make fish the login shell of $who (the program that starts in each new terminal): chsh -s fish; bash keeps working"
    return 0
  fi
  if [ -z "$fp" ] || [ ! -x "$fp" ] || [ "$(fish_major "$fp")" -lt 4 ]; then say "fish 4 is not installed as a package, so the login shell stays as it is."; return 0; fi
  case $(acct_field "$who" shell) in */fish) say "fish is already the login shell of $who."; return 0 ;; esac
  case $(cfg BOOTSTRAP_CHSH yes) in
    no | NO | false | 0) say "The login shell stays as it is. To use fish: sudo chsh -s $fp $who"; return 0 ;;
  esac
  if ! grep -qx "$fp" /etc/shells 2>/dev/null; then
    if sudo_for "add fish to the list of login shells (/etc/shells)"; then
      printf '%s\n' "$fp" | $sudo_cmd tee -a /etc/shells >/dev/null || { warn "Could not add $fp to /etc/shells."; return 0; }
    else
      warn "I could not get administrator rights to list fish as a login shell. Run: command -v fish | sudo tee -a /etc/shells; sudo chsh -s $fp $who"
      return 0
    fi
  fi
  if sudo_for "change the login shell of $who"; then
    $sudo_cmd chsh -s "$fp" "$who" </dev/null || warn "chsh failed. Run: sudo chsh -s $fp $who"
  else warn "chsh needs administrator rights. Run: sudo chsh -s $fp $who"; fi
  case $(acct_field "$who" shell) in */fish) say "fish is now the login shell of $who; it starts in each new terminal window." ;; esac
  return 0
}

# ---- the run ------------------------------------------------------------------------------------------------------------------------------------------

main_bootstrap() {
  detect_platform
  load_config
  say "${b}${e_rocket}Setting up this computer${z} (${d_pretty}, $arch$wsl_txt) for the Intellectual Frontiers harness."
  [ "$dry" = 1 ] && say "${d}Dry run: this lists the steps and changes nothing.${z}"
  ph_event bootstrap_started "s:tty=$([ "$has_tty" = 1 ] && echo yes || echo no)" "s:distro=${d_id:-}" "s:distro_version=${d_version:-}" "s:script=bootstrap"
  install_packages
  install_code_package
  setup_rc=0
  run_setup || setup_rc=$?
  offer_fish
  phase_close
  [ "$dry" = 1 ] && { say ""; say "That was a dry run: nothing was changed, fetched or asked."; return 0; }
  return "$setup_rc"
}

[ "$boot_source_only" = 1 ] || main_bootstrap
