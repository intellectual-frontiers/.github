#!/bin/sh
# Set up a computer for the Intellectual Frontiers harness (0136-machine-bootstrap, the bootstrap): the one script that may use administrator rights. A blank Debian 12
# or 13 (amd64 or arm64), under WSL 2 or in a virtual machine, gets the programs the setup needs and, if you ask, an account made for `archon`; then it runs
# `archon-setup.sh` as that account, which does the rest without administrator rights and writes only inside the account's home folder.
#
#   cd && sudo apt update && sudo apt install -y curl wget      (a bare Debian has neither)
#   curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/archon-bootstrap.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/archon-bootstrap.sh | sh -s -- --dedicated
#   curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/archon-bootstrap.sh | sh -s -- --dry-run
#
#   1. Packages: installs what is missing with apt (it says why it needs administrator rights and asks for your password once, first): git, curl, gh, jq and the
#      other programs the setup needs and, unless BOOTSTRAP_NO_COMFORT=1, the everyday programs (ripgrep, ImageMagick, sqlite3 and the rest),
#   2. Editor: on a machine with a desktop that is not under WSL, Microsoft's package for VS Code from Microsoft's apt repository (its key checked against a pinned SHA-256),
#   3. Account: with --user NAME (or --dedicated, which is --user archon) creates that Linux account if it does not exist, with a home folder and no administrator rights,
#   4. Setup: runs archon-setup.sh as that account (or as you, without --user) with --comfort, so the comfort kits are installed (BOOTSTRAP_NO_COMFORT=1 leaves them out),
#      and --dedicated for an account made for archon,
#   5. Login shell: offers to make fish that account's login shell (chsh), where fish is installed as a package.
#
# Safe to run again. Options (after `sh -s --` when piped):
#   --dry-run          list every step it would take, change nothing, fetch nothing, ask for nothing
#   --user NAME        the account to set up: created if it is not there; without it, the account that runs this
#   --dedicated        the account is for archon alone (--user archon unless --user names another): archon keeps its startup files whole, and deleting the account removes everything
#   -h, --help         this text
#
# Environment (a "1" switches it on): BOOTSTRAP_NO_APT=1 (install no package), BOOTSTRAP_NO_COMFORT=1, BOOTSTRAP_NO_EDITOR=1, BOOTSTRAP_NO_CHSH=1 / BOOTSTRAP_CHSH=no, BOOTSTRAP_URL (where
# archon-setup.sh is fetched from when this is piped), BOOTSTRAP_SETUP (a file to run as the setup), and every variable archon-setup.sh reads, which are passed on to the account.
# Exit status: 0 done, 1 archon's own checks found something to look at, 2 usage, 3 the computer cannot be set up yet, 4 a step failed, 5 the GitHub sign-in did not finish.
# shellcheck disable=SC2034,SC2154  # the variables the setup sets and the functions it defines are this script's, since it is loaded without being run
set -eu

boot_dry=0; boot_user=""; boot_dedicated=0
boot_source_only=${BOOTSTRAP_SOURCE_ONLY:-}   # 1: load the functions and run nothing, so a test can call one
while [ "$#" -gt 0 ]; do
  case $1 in
    --dry-run | -n) boot_dry=1 ;;
    --dedicated) boot_dedicated=1 ;;
    --user) shift; [ "$#" -gt 0 ] || { echo "archon-bootstrap: --user needs a name (try --help)" >&2; exit 2; }; boot_user=$1 ;;
    --user=*) boot_user=${1#--user=} ;;
    -h | --help)
      case $0 in *archon-bootstrap.sh) sed -n '2,/^# shellcheck disable=SC2034/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//' ;; *) echo "Usage: curl -fsSL URL | sh -s -- [--dry-run] [--user NAME] [--dedicated]   (see the header of archon-bootstrap.sh)" ;; esac
      exit 0 ;;
    *) echo "archon-bootstrap: unknown option $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done
[ "$boot_dedicated" = 1 ] && [ -z "$boot_user" ] && boot_user=archon
case $boot_user in
  "" | [a-z_][a-z0-9_-]*) ;;
  *) echo "archon-bootstrap: '$boot_user' is not a name a Linux account can have (lower-case letters, digits, - and _)" >&2; exit 2 ;;
esac

# ---- the setup: beside this script in a checkout, fetched from BOOTSTRAP_URL when this is piped. Its functions (the log, the steps, the support file, the
# telemetry) are this script's too, so it is loaded without running it; the account it sets up runs the same file.
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
  else echo "archon-bootstrap: neither curl nor wget is installed. Run: cd && sudo apt update && sudo apt install -y curl wget" >&2; exit 3; fi
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

cand_major() {  # the major version of an apt candidate such as 1:4.0.2-3
  m=${1#*:}; m=${m%%.*}
  case $m in '' | *[!0-9]*) m=0 ;; esac
  printf '%s' "$m"
}

# The packages the setup needs from the computer (it installs none itself), then the everyday programs of the comfort kits (ws-host's base.py).
wanted_packages() {
  echo "git ca-certificates curl wget tar xz-utils unzip jq gh"
  if kit_on base; then
    echo "coreutils sed findutils diffutils patch gzip zip bzip2 file less debianutils procps hostname ncurses-bin rsync bc grep gawk"
    echo "ripgrep fd-find bash-completion python3 imagemagick webp sqlite3 shellcheck"
    echo "libmagickcore-7.q16-10-extra|libmagickcore-6.q16-7-extra|libmagickcore-6.q16-6-extra"
    if [ "$is_debian" = 1 ]; then case $d_codename in bookworm | bullseye | "") ;; *) echo "glab" ;; esac; fi
  fi
  return 0
}

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

install_packages() {
  phase "${e_pkg}Setting up Debian's everyday programs"
  if [ "$tested" = 0 ]; then
    warn "This is $d_pretty. The bootstrap is made for Debian 12 and 13; I will go on, and say what does not work."
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
  if [ "${BOOTSTRAP_NO_APT:-}" = 1 ] || [ "${WS_HOST_NO_APT:-}" = 1 ] || ! command -v apt-get >/dev/null 2>&1; then
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
  sudo_for "install Debian's everyday programs (git, curl, jq and others)" || need "I could not get administrator rights (no sudo, or the password was not accepted)." "run this again and type your Linux password, or ask an administrator to run: sudo apt install$missing"
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
  if [ -n "$chosen" ]; then
    count_re='^Setting up '
    count_total=$($sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get install -s -y $chosen 2>/dev/null | grep -c '^Inst ' || true)
    [ "${count_total:-0}" -gt 0 ] 2>/dev/null || count_total=""
    # shellcheck disable=SC2086
    step "${e_pkg}Installing programs" apt_install $chosen || need "the packages could not be installed." "run: sudo apt install$chosen"
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
  command -v code >/dev/null 2>&1 && return 0
  [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] || return 0
  phase "${e_code}Installing VS Code"
  if [ "$dry" = 1 ]; then would "install VS Code from Microsoft's apt repository (its signing key checked against its pinned SHA-256)"; return 0; fi
  if [ "${BOOTSTRAP_NO_APT:-}" = 1 ]; then say "Skipped installing VS Code (BOOTSTRAP_NO_APT=1)."; return 0; fi
  sudo_for "install VS Code from Microsoft's apt repository" || { problem "VS Code: no administrator rights to install it"; return 0; }
  step "${e_dl}Installing VS Code from Microsoft's apt repository" apt_code || problem "VS Code could not be installed from Microsoft's apt repository"
  return 0
}

# ---- the account --------------------------------------------------------------------------------------------------------------------------------------

account_home=""
make_account() {
  [ -n "$boot_user" ] || return 0
  heading "${e_dir}The account ${boot_user}"
  if getent passwd "$boot_user" >/dev/null 2>&1; then
    say "The account $boot_user is already there; I change nothing about it."
  else
    if [ "$dry" = 1 ]; then would "create the Linux account $boot_user with a home folder and no administrator rights (adduser)"; account_home=/home/$boot_user; return 0; fi
    sudo_for "create the Linux account $boot_user" || need "I could not get administrator rights, so I cannot create the account $boot_user." "ask an administrator to run: sudo adduser $boot_user"
    command -v adduser >/dev/null 2>&1 || need "this computer has no adduser." "run: sudo useradd -m -s /bin/bash $boot_user"
    step "${e_dir}Creating the account $boot_user" $sudo_cmd adduser --disabled-password --gecos "" "$boot_user" || need "the account $boot_user could not be created." "run: sudo adduser $boot_user"
  fi
  account_home=$(getent passwd "$boot_user" 2>/dev/null | cut -d: -f6 || true)
  [ -n "$account_home" ] || account_home=/home/$boot_user
  say "To work in it later: ${b}sudo -iu $boot_user${z}   (or ${b}su - $boot_user${z} once you have given it a password with ${b}sudo passwd $boot_user${z}). To remove it with everything archon wrote: ${b}sudo deluser --remove-home $boot_user${z}."
  return 0
}

# ---- the setup, run as the account -------------------------------------------------------------------------------------------------------------------

setup_args() {
  [ "$boot_dry" = 1 ] && printf '%s\n' --dry-run
  [ "$boot_dedicated" = 1 ] && printf '%s\n' --dedicated
  [ "$comfort" = 1 ] && [ "${BOOTSTRAP_NO_COMFORT:-}" != 1 ] && printf '%s\n' --comfort
  return 0
}

run_setup() {
  heading "${e_rocket}Setting up archon in $([ -n "$boot_user" ] && echo "the account $boot_user" || echo "this account")"
  if [ -z "$boot_user" ]; then
    # this account: the setup's own steps, in this process, which is already set up with the log, the steps and the telemetry (it uses no administrator rights)
    dedicated=0
    main || return $?
    return 0
  fi
  sargs=$(setup_args | tr '\n' ' ')
  if [ "$dry" = 1 ]; then
    would "run archon-setup.sh as $boot_user: $sargs(every GH_TOKEN, ARCHON_*, BOOTSTRAP_* and WS_HOST_* variable you set is passed on)"
    return 0
  fi
  # the variables the setup reads are passed to the account by name and value; its own home folder and a plain PATH are its own
  set -- env -i HOME="$account_home" USER="$boot_user" LOGNAME="$boot_user" PATH=/usr/local/bin:/usr/bin:/bin
  for v in $(env | sed -n 's/^\(\(ARCHON\|BOOTSTRAP\|WS_HOST\)_[A-Z0-9_]*\|GH_TOKEN\|GITHUB_TOKEN\|DO_NOT_TRACK\|NO_COLOR\|TERM\|LANG\|LC_ALL\)=.*/\1/p'); do
    case $v in BOOTSTRAP_SOURCE_ONLY | BOOTSTRAP_SETUP) continue ;; esac
    eval "set -- \"\$@\" \"$v=\${$v}\""
  done
  phase_close
  tty_in=/dev/null; [ "$has_tty" = 1 ] && tty_in=/dev/tty
  if [ "$(id -u)" = 0 ]; then runas="runuser -u $boot_user --"; else runas="sudo -H -u $boot_user"; fi
  # shellcheck disable=SC2086  # $runas and $sargs are words on purpose
  $runas "$@" sh "$setup_file" $sargs <"$tty_in" || return $?
  return 0
}

# ---- the login shell of the account -----------------------------------------------------------------------------------------------------------------------

offer_fish() {
  kit_on shell || return 0
  [ "${BOOTSTRAP_NO_CHSH:-}" = 1 ] && return 0
  fp=$(command -v fish 2>/dev/null || true)
  who=${boot_user:-$(id -un)}
  heading "${e_shell}The login shell of $who"
  if [ "$dry" = 1 ]; then
    would "make fish the login shell of $who (the program that starts in each new terminal): chsh -s fish; bash keeps working"
    return 0
  fi
  if [ -z "$fp" ] || [ ! -x "$fp" ] || [ "$(fish_major "$fp")" -lt 4 ]; then say "fish 4 is not installed as a package, so the login shell stays as it is."; return 0; fi
  case $(getent passwd "$who" | cut -d: -f7) in */fish) say "fish is already the login shell of $who."; return 0 ;; esac
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
  case $(getent passwd "$who" | cut -d: -f7) in */fish) say "fish is now the login shell of $who; it starts in each new terminal window." ;; esac
  return 0
}

# ---- the run ------------------------------------------------------------------------------------------------------------------------------------------

main_bootstrap() {
  detect_platform
  load_config
  say "${b}${e_rocket}Setting up this computer${z} (${d_pretty}, $arch$wsl_txt) for the Intellectual Frontiers harness."
  [ "$dry" = 1 ] && say "${d}Dry run: this lists the steps and changes nothing.${z}"
  ph_event bootstrap_started "s:tty=$([ "$has_tty" = 1 ] && echo yes || echo no)" "s:distro=${d_id:-}" "s:distro_version=${d_version:-}" "s:script=bootstrap" "s:user=$([ -n "$boot_user" ] && echo dedicated || echo self)"
  install_packages
  install_code_package
  make_account
  setup_rc=0
  run_setup || setup_rc=$?
  offer_fish
  phase_close
  [ "$dry" = 1 ] && { say ""; say "That was a dry run: nothing was changed, fetched or asked."; return 0; }
  return "$setup_rc"
}

[ "$boot_source_only" = 1 ] || main_bootstrap
