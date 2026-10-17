#!/bin/sh
# Set up one account (Linux, or a Mac with Apple silicon) for the Intellectual Frontiers harness, without administrator rights (0136-machine-bootstrap, the setup). Run it in the account that
# will use `archon`: everything it writes is inside that account's home folder, so deleting the account and its home folder removes all of it. A person who has
# a computer already makes a user for archon (any name: `sudo adduser NAME`), logs in as it and runs this there; deleting that user removes everything. `archon-bootstrap.sh`
# installs the programs on a blank computer (a new WSL or virtual machine) and runs this one for the account that runs it.
#
#   curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/archon-setup.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/archon-setup.sh | sh -s -- --dry-run
#
# It never uses sudo or a package manager. It needs these programs from the computer, which `archon-bootstrap.sh` installs (a bare Debian or Arch has none of them):
#   git curl tar xz unzip jq gh  (a missing one is named, with the one command a person with administrator rights runs: apt-get on the Debian family, pacman on the Arch family)
# A Mac needs only the Command Line Tools (`xcode-select --install`, which opens a window a person answers): macOS carries curl, tar and unzip, and this fetches jq and gh itself,
# pinned and checked by SHA-256, into ~/.local/share. fish and SQLite's own tools are left out on a Mac, and the shell it sets up is zsh.
#
# It is a self-contained port of what ws-host (workspaces-host) installs for its default kits and does for git and the workspaces folder. It never calls,
# clones or needs ws-host. It:
#
#   1. Git and GitHub: signs you in to GitHub (a code and a browser), sets the name and email on your commits where git has none. From here on the
#      token (GH_TOKEN, GITHUB_TOKEN or gh's own) is exported, so mise and archon use it and are not held to GitHub's hourly limit for no sign-in;
#      with no token at all, everything that comes from GitHub is skipped and listed in the summary, to be done by running this again after sign-in,
#   2. Python and tools: gets the pinned mise, and through it Python and uv, then the AI assistants for the terminal (Claude Code, Codex, OpenCode and
#      Aider; the `agents` kit), each checked against the checksum its publisher lists; with --comfort, also fish 4, the modern command line tools,
#      DuckDB, the SQLite tools and the embedded-SQL tools, each checked against a checksum,
#   3. Workspace and clone: copies the private archon repository to ~/workspaces/github.com/intellectual-frontiers/archon (or updates it by
#      fast-forward only),
#   4. Editor: makes `code` open VS Code (under WSL the Windows VS Code, installed with winget where it is missing),
#   5. First checks: runs, in the clone, ./archon shell ensure (the startup files of bash, zsh and fish: archon keeps them, with chezmoi),
#      ./archon doctor, ./archon toolchain ensure and ./archon check --quick (seconds; the full `archon check` takes minutes and is yours to run), and says what to do next.
#
# It writes no startup file itself: `archon shell` does (0138-shell). Safe to run again: what is already in place changes nothing, and a clone with your
# work in it is left exactly as it is. Long steps show one line with a spinner (at a terminal only); what a step printed is kept in a log and shown only if
# the step fails.
#
# Options (after `sh -s --` when piped):  --dry-run   list every step it would take, change nothing, fetch nothing, ask for nothing
#                                          --comfort   also install what no archon command needs (fish, the modern command line tools, the data tools)
#                                          -h, --help  this text
#
# Environment, so it can be tested (a "1" switches it on):
#   ARCHON_POSTHOG_KEY     optional: your PostHog project API key, set (export ARCHON_POSTHOG_KEY=...) before starting so the archon commands the setup runs are
#                          recorded in PostHog, and the setup itself reports its steps, timings and failures (environment "bootstrap", a device id made from the machine, the host name and Linux user name, the kind of computer; no password, token or file) (ARCHON_POSTHOG_HOST names a PostHog other than the default). Without it nothing breaks; no telemetry is recorded.
#   GH_TOKEN               optional: a GitHub token (GITHUB_TOKEN too) with access to archon; with it no interactive `gh auth login` is needed, and no sign-in is asked for. It is the way to get the tools that come from GitHub where no browser is
#                          (without a token or a sign-in they are skipped, and listed at the end)
#   BOOTSTRAP_URL          where the bootstrap fetches this script from when it is piped (default: raw.githubusercontent.com/intellectual-frontiers/.github/main)
#   ARCHON_URL             where to clone archon from (default: https://github.com/intellectual-frontiers/archon)
#   BOOTSTRAP_NO_DOWNLOAD=1  fetch no program (mise, fish, the modern tools)
#   BOOTSTRAP_NO_RUNTIME=1 do not install Python and uv with mise (the uv already on the PATH is used)
#   BOOTSTRAP_NO_DOTFILES=1   do not run `archon shell ensure` (so no startup file is touched)
#   BOOTSTRAP_NO_AUTH=1    do not sign in to GitHub or set git's name and email (a GH_TOKEN, or a gh already signed in, is still used; without either, what comes from GitHub is skipped)
#   BOOTSTRAP_NO_CLONE=1   do not copy or update archon (and so run nothing in it)
#   BOOTSTRAP_NO_ARCHON=1  copy archon but run none of its commands
#   BOOTSTRAP_KIT          the kits to install, space-separated (default: agents; with --comfort: agents base shell embedded-sql; WS_HOST_KIT is read too)
#   BOOTSTRAP_NO_COMFORT=1 never install the comfort kits, even when --comfort is given
#   BOOTSTRAP_NO_AGENTS=1  leave the AI assistants (claude, codex, opencode, aider) out of the kits
#   BOOTSTRAP_NO_EDITOR=1  do not put `code` on the PATH (under WSL it is VS Code on Windows, installed with winget where missing) (BOOTSTRAP_WINDOWS_ROOT: Windows' C: drive, default /mnt/c)
#   BOOTSTRAP_PROMPT       pretty (default; needs a Nerd Font), plain, or no: the prompt `archon shell set prompt` is told to draw
#   BOOTSTRAP_TOOLCHAIN    the names for `archon toolchain ensure` (default: every entry not ready and not marked optional; none; all)
#   BOOTSTRAP_GIT_NAME, BOOTSTRAP_GIT_EMAIL   the name and email to put on your commits (set over what git has)
#   BOOTSTRAP_FRESH=1      look for a newer release of each tool that follows its newest release, even when one is installed
#   BOOTSTRAP_YES=1        answer yes to the questions that default to yes
# ws-host's own names are honoured where it has them: WS_HOST_HOME (the workspaces folder, default ~/workspaces), WS_HOST_WORKSPACES, WS_HOST_KIT,
# WS_HOST_PROMPT, WS_HOST_MODERN, WS_HOST_GIT_NAME, WS_HOST_GIT_EMAIL, in the environment or in ~/.config/workspaces-host/ws-host.env.
#
# Exit status: 0 done, 1 archon's own doctor or check found something to look at, 2 usage, 3 the computer cannot be set up yet (a program it needs is missing),
# 4 a step failed (setup stops, and says where the log and the support file are), 5 the GitHub sign-in did not finish.
# Everything is logged to ~/.archon-bootstrap/log/ (BOOTSTRAP_LOG_DIR changes it); BOOTSTRAP_SUPPORT names who to send the support file to; BOOTSTRAP_KEEP_GOING=1 does not stop at a failed step.
# What was skipped for want of a GitHub token is not a failed step: it is listed in the summary and the exit status stays 0.
# shellcheck disable=SC2034  # the pinned checksums are read by arch_sha, through eval
set -eu

# ---- the table of package managers and system families, generated from commons' ontology (commons 0002-packaging); the block is rewritten by commons/tools/generate-packaging.py, never by hand ----
# >>> packaging.auto >>>
# AUTO-GENERATED by commons/tools/generate-packaging.py from commons/ontology/supply-chain/packaging/*.ttl (commons 0002-packaging). Do not edit: change the ontology.
# shellcheck disable=SC2034  # read by the script this is part of
pm_schema=1
pm_source_sha256='b8da763a0359890d6cd8c44bfff0b5b15f9dc2d037794ee9bf4dcfd1941cfe6b'

pm_family_of() {  # pm_family_of WORDS: the family a computer's os-release ID and ID_LIKE words name, or nothing
  for pm_w in $1; do
    case $pm_w in
      alpine|postmarket) printf '%s' 'alpine'; return 0 ;;
      antergos|arch|arcolinux|endeavouros|garuda|kaos|manjaro) printf '%s' 'arch'; return 0 ;;
      crux) printf '%s' 'crux'; return 0 ;;
      antix|aosc|bodhi|debian|deepin|devuan|elementary|kali|linuxmint|lxle|pop|raspbian|sparky|ubuntu|zorin) printf '%s' 'debian'; return 0 ;;
      freebsd|ghostbsd) printf '%s' 'freebsd'; return 0 ;;
      funtoo|gentoo) printf '%s' 'gentoo'; return 0 ;;
      mageia) printf '%s' 'mageia'; return 0 ;;
      nixos) printf '%s' 'nixos'; return 0 ;;
      nutyx) printf '%s' 'nutyx'; return 0 ;;
      openwrt) printf '%s' 'openwrt'; return 0 ;;
      almalinux|amzn|centos|eurolinux|fedora|ol|qubes|redhat|rhel|rocky) printf '%s' 'redhat'; return 0 ;;
      slackware) printf '%s' 'slackware'; return 0 ;;
      solus) printf '%s' 'solus'; return 0 ;;
      opensuse|opensuse-leap|opensuse-tumbleweed) printf '%s' 'suse'; return 0 ;;
      void) printf '%s' 'void'; return 0 ;;
    esac
  done
  return 0
}

pm_family_of_uname() {  # pm_family_of_uname NAME: the family `uname -s` names on a platform without os-release, or nothing
  case ${1:-} in
    Android) printf '%s' 'android' ;;
    FreeBSD) printf '%s' 'freebsd' ;;
    Haiku) printf '%s' 'haiku' ;;
    Darwin) printf '%s' 'macos' ;;
  esac
}

pm_label() {  # pm_label FAMILY
  case ${1:-} in
    alpine) printf '%s' 'Alpine family' ;;
    android) printf '%s' 'Android (Termux)' ;;
    any) printf '%s' 'Any other computer' ;;
    arch) printf '%s' 'Arch family' ;;
    crux) printf '%s' 'CRUX' ;;
    debian) printf '%s' 'Debian family' ;;
    freebsd) printf '%s' 'FreeBSD family' ;;
    gentoo) printf '%s' 'Gentoo family' ;;
    haiku) printf '%s' 'Haiku' ;;
    macos) printf '%s' 'macOS' ;;
    mageia) printf '%s' 'Mageia' ;;
    msys2) printf '%s' 'Windows (MSYS2)' ;;
    nixos) printf '%s' 'NixOS' ;;
    nutyx) printf '%s' 'NuTyX' ;;
    openwrt) printf '%s' 'OpenWrt' ;;
    redhat) printf '%s' 'Red Hat family' ;;
    slackware) printf '%s' 'Slackware' ;;
    solus) printf '%s' 'Solus' ;;
    suse) printf '%s' 'SUSE family' ;;
    void) printf '%s' 'Void Linux' ;;
    windows) printf '%s' 'Windows' ;;
    *) printf '%s' '' ;;
  esac
}

pm_status() {  # pm_status FAMILY
  case ${1:-} in
    alpine) printf '%s' 'catalogued' ;;
    android) printf '%s' 'catalogued' ;;
    any) printf '%s' 'catalogued' ;;
    arch) printf '%s' 'supported' ;;
    crux) printf '%s' 'catalogued' ;;
    debian) printf '%s' 'supported' ;;
    freebsd) printf '%s' 'catalogued' ;;
    gentoo) printf '%s' 'catalogued' ;;
    haiku) printf '%s' 'catalogued' ;;
    macos) printf '%s' 'supported' ;;
    mageia) printf '%s' 'catalogued' ;;
    msys2) printf '%s' 'catalogued' ;;
    nixos) printf '%s' 'catalogued' ;;
    nutyx) printf '%s' 'catalogued' ;;
    openwrt) printf '%s' 'catalogued' ;;
    redhat) printf '%s' 'catalogued' ;;
    slackware) printf '%s' 'catalogued' ;;
    solus) printf '%s' 'catalogued' ;;
    suse) printf '%s' 'catalogued' ;;
    void) printf '%s' 'catalogued' ;;
    windows) printf '%s' 'catalogued' ;;
    *) printf '%s' '' ;;
  esac
}

pm_assurance() {  # pm_assurance FAMILY
  case ${1:-} in
    alpine) printf '%s' 'none' ;;
    android) printf '%s' 'none' ;;
    any) printf '%s' 'none' ;;
    arch) printf '%s' 'stand-in' ;;
    crux) printf '%s' 'none' ;;
    debian) printf '%s' 'verified' ;;
    freebsd) printf '%s' 'none' ;;
    gentoo) printf '%s' 'none' ;;
    haiku) printf '%s' 'none' ;;
    macos) printf '%s' 'untested' ;;
    mageia) printf '%s' 'none' ;;
    msys2) printf '%s' 'none' ;;
    nixos) printf '%s' 'none' ;;
    nutyx) printf '%s' 'none' ;;
    openwrt) printf '%s' 'none' ;;
    redhat) printf '%s' 'none' ;;
    slackware) printf '%s' 'none' ;;
    solus) printf '%s' 'none' ;;
    suse) printf '%s' 'none' ;;
    void) printf '%s' 'none' ;;
    windows) printf '%s' 'none' ;;
    *) printf '%s' '' ;;
  esac
}

pm_manager() {  # pm_manager FAMILY
  case ${1:-} in
    alpine) printf '%s' 'apk' ;;
    android) printf '%s' 'termux-pkg' ;;
    any) printf '%s' 'apt' ;;
    arch) printf '%s' 'pacman' ;;
    crux) printf '%s' 'prt-get' ;;
    debian) printf '%s' 'apt' ;;
    freebsd) printf '%s' 'freebsd-pkg' ;;
    gentoo) printf '%s' 'emerge' ;;
    haiku) printf '%s' 'pkgman' ;;
    macos) printf '%s' '' ;;
    mageia) printf '%s' 'urpm' ;;
    msys2) printf '%s' 'pacman' ;;
    nixos) printf '%s' 'nix-env' ;;
    nutyx) printf '%s' 'cards' ;;
    openwrt) printf '%s' 'opkg' ;;
    redhat) printf '%s' 'dnf' ;;
    slackware) printf '%s' 'slackpkg' ;;
    solus) printf '%s' 'eopkg' ;;
    suse) printf '%s' 'zypper' ;;
    void) printf '%s' 'xbps' ;;
    windows) printf '%s' 'scoop' ;;
    *) printf '%s' '' ;;
  esac
}

pm_installs_packages() {  # pm_installs_packages FAMILY
  case ${1:-} in
    arch) printf '%s' 'yes' ;;
    debian) printf '%s' 'yes' ;;
    macos) printf '%s' 'no' ;;
    *) printf '%s' '' ;;
  esac
}

pm_removal_hint() {  # pm_removal_hint FAMILY
  case ${1:-} in
    arch) printf '%s' 'sudo userdel -r NAME' ;;
    debian) printf '%s' 'sudo deluser --remove-home NAME' ;;
    macos) printf '%s' 'delete the user in System Settings, Users & Groups, with its home folder' ;;
    *) printf '%s' '' ;;
  esac
}

pm_note() {  # pm_note FAMILY
  case ${1:-} in
    alpine) printf '%s' 'archon'\''s runtime can use apk to install the libraries a program links against, untested; no script acts on this family.' ;;
    arch) printf '%s' 'Arch Linux is exercised in a container with stand-ins for pacman; Omarchy (ID_LIKE=arch) is untested (0136-machine-bootstrap OQ-6).' ;;
    debian) printf '%s' 'Debian is verified on Debian 13 under WSL 2. Ubuntu and Debian 12 are exercised by the container tests only.' ;;
    macos) printf '%s' 'Written against stand-ins on Linux; no run on a Mac yet (0136-machine-bootstrap OQ-7).' ;;
    redhat) printf '%s' 'archon'\''s runtime can use dnf to install the libraries a program links against, untested; no script acts on this family.' ;;
    *) printf '%s' '' ;;
  esac
}

pm_install_words() {  # pm_install_words FAMILY
  case ${1:-} in
    arch) printf '%s' 'pacman -S --needed --noconfirm' ;;
    debian) printf '%s' 'apt-get install -y' ;;
    *) printf '%s' '' ;;
  esac
}

pm_refresh_words() {  # pm_refresh_words FAMILY
  case ${1:-} in
    arch) printf '%s' '' ;;
    debian) printf '%s' 'apt-get update' ;;
    *) printf '%s' '' ;;
  esac
}

pm_query_installed_words() {  # pm_query_installed_words FAMILY
  case ${1:-} in
    arch) printf '%s' 'pacman -Qi' ;;
    debian) printf '%s' 'dpkg-query -W -f=${Status}' ;;
    *) printf '%s' '' ;;
  esac
}

pm_query_candidate_words() {  # pm_query_candidate_words FAMILY
  case ${1:-} in
    arch) printf '%s' 'pacman -Si' ;;
    debian) printf '%s' 'apt-cache policy' ;;
    *) printf '%s' '' ;;
  esac
}

pm_environment() {  # pm_environment FAMILY
  case ${1:-} in
    debian) printf '%s' 'DEBIAN_FRONTEND=noninteractive' ;;
    *) printf '%s' '' ;;
  esac
}

pm_admin_install() {  # pm_admin_install FAMILY
  case ${1:-} in
    alpine) printf '%s' 'apk add {packages}' ;;
    android) printf '%s' 'pkg install {packages}' ;;
    arch) printf '%s' 'pacman -S --needed {packages}' ;;
    crux) printf '%s' 'prt-get install {packages}' ;;
    debian) printf '%s' 'apt-get install -y {packages}' ;;
    freebsd) printf '%s' 'pkg install {packages}' ;;
    gentoo) printf '%s' 'emerge {packages}' ;;
    haiku) printf '%s' 'pkgman install {packages}' ;;
    mageia) printf '%s' 'urpmi {packages}' ;;
    msys2) printf '%s' 'pacman -S {packages}' ;;
    nixos) printf '%s' 'nix-env --install {packages}' ;;
    nutyx) printf '%s' 'cards install {packages}' ;;
    openwrt) printf '%s' 'opkg install {packages}' ;;
    redhat) printf '%s' 'dnf install {packages}' ;;
    slackware) printf '%s' 'slackpkg install {packages}' ;;
    solus) printf '%s' 'eopkg install {packages}' ;;
    suse) printf '%s' 'zypper install {packages}' ;;
    void) printf '%s' 'xbps-install {packages}' ;;
    windows) printf '%s' 'scoop install {packages}' ;;
    *) printf '%s' '' ;;
  esac
}

pm_package() {  # pm_package FAMILY PROGRAM: what the family calls the package, or nothing
  case ${1:-}:${2:-} in
    arch:bash-completion) printf '%s' 'bash-completion' ;;
    debian:bash-completion) printf '%s' 'bash-completion' ;;
    arch:bc) printf '%s' 'bc' ;;
    debian:bc) printf '%s' 'bc' ;;
    arch:bzip2) printf '%s' 'bzip2' ;;
    debian:bzip2) printf '%s' 'bzip2' ;;
    arch:ca-certificates) printf '%s' 'ca-certificates' ;;
    debian:ca-certificates) printf '%s' 'ca-certificates' ;;
    arch:coreutils) printf '%s' 'coreutils' ;;
    debian:coreutils) printf '%s' 'coreutils' ;;
    arch:curl) printf '%s' 'curl' ;;
    debian:curl) printf '%s' 'curl' ;;
    debian:debianutils) printf '%s' 'debianutils' ;;
    arch:diffutils) printf '%s' 'diffutils' ;;
    debian:diffutils) printf '%s' 'diffutils' ;;
    arch:fd) printf '%s' 'fd' ;;
    debian:fd) printf '%s' 'fd-find' ;;
    arch:file) printf '%s' 'file' ;;
    debian:file) printf '%s' 'file' ;;
    arch:findutils) printf '%s' 'findutils' ;;
    debian:findutils) printf '%s' 'findutils' ;;
    arch:gawk) printf '%s' 'gawk' ;;
    debian:gawk) printf '%s' 'gawk' ;;
    arch:gh) printf '%s' 'github-cli' ;;
    debian:gh) printf '%s' 'gh' ;;
    arch:git) printf '%s' 'git' ;;
    debian:git) printf '%s' 'git' ;;
    arch:glab) printf '%s' 'glab' ;;
    debian:glab) printf '%s' 'glab' ;;
    arch:grep) printf '%s' 'grep' ;;
    debian:grep) printf '%s' 'grep' ;;
    arch:gzip) printf '%s' 'gzip' ;;
    debian:gzip) printf '%s' 'gzip' ;;
    arch:hostname) printf '%s' 'inetutils' ;;
    debian:hostname) printf '%s' 'hostname' ;;
    arch:imagemagick) printf '%s' 'imagemagick' ;;
    debian:imagemagick) printf '%s' 'imagemagick' ;;
    debian:imagemagick-codecs) printf '%s' 'libmagickcore-7.q16-10-extra|libmagickcore-6.q16-7-extra|libmagickcore-6.q16-6-extra' ;;
    arch:jq) printf '%s' 'jq' ;;
    debian:jq) printf '%s' 'jq' ;;
    arch:less) printf '%s' 'less' ;;
    debian:less) printf '%s' 'less' ;;
    arch:ncurses) printf '%s' 'ncurses' ;;
    debian:ncurses) printf '%s' 'ncurses-bin' ;;
    arch:patch) printf '%s' 'patch' ;;
    debian:patch) printf '%s' 'patch' ;;
    arch:procps) printf '%s' 'procps-ng' ;;
    debian:procps) printf '%s' 'procps' ;;
    arch:python) printf '%s' 'python' ;;
    debian:python) printf '%s' 'python3' ;;
    arch:ripgrep) printf '%s' 'ripgrep' ;;
    debian:ripgrep) printf '%s' 'ripgrep' ;;
    arch:rsync) printf '%s' 'rsync' ;;
    debian:rsync) printf '%s' 'rsync' ;;
    arch:sed) printf '%s' 'sed' ;;
    debian:sed) printf '%s' 'sed' ;;
    arch:shellcheck) printf '%s' 'shellcheck' ;;
    debian:shellcheck) printf '%s' 'shellcheck' ;;
    arch:sqlite) printf '%s' 'sqlite' ;;
    debian:sqlite) printf '%s' 'sqlite3' ;;
    arch:tar) printf '%s' 'tar' ;;
    debian:tar) printf '%s' 'tar' ;;
    arch:unzip) printf '%s' 'unzip' ;;
    debian:unzip) printf '%s' 'unzip' ;;
    arch:webp) printf '%s' 'libwebp' ;;
    debian:webp) printf '%s' 'webp' ;;
    arch:wget) printf '%s' 'wget' ;;
    debian:wget) printf '%s' 'wget' ;;
    arch:xz) printf '%s' 'xz' ;;
    debian:xz) printf '%s' 'xz-utils' ;;
    arch:zip) printf '%s' 'zip' ;;
    debian:zip) printf '%s' 'zip' ;;
  esac
}

pm_programs() {  # pm_programs TIER: the programs of the tier (required or comfort), one word each, in order
  case ${1:-} in
    required) printf '%s\n' 'git' 'ca-certificates' 'curl' 'wget' 'tar' 'xz' 'unzip' 'jq' 'gh' ;;
    comfort) printf '%s\n' 'coreutils' 'sed' 'findutils' 'diffutils' 'patch' 'gzip' 'zip' 'bzip2' 'file' 'less' 'debianutils' 'procps' 'hostname' 'ncurses' 'rsync' 'bc' 'grep' 'gawk' 'ripgrep' 'fd' 'bash-completion' 'python' 'imagemagick' 'webp' 'sqlite' 'shellcheck' 'imagemagick-codecs' 'glab' ;;
  esac
}
# <<< packaging.auto <<<

# ---- what is pinned (each is checked by SHA-256 before it is unpacked; chezmoi and Oh My Posh are pinned by archon, in toolchain/) ------------------

# >>> pins.auto >>>
# AUTO-GENERATED by commons/tools/generate-packaging.py from commons/ontology/supply-chain/packaging/pins.ttl (commons 0002-packaging FR-014). Do not edit: change the ontology.
# shellcheck disable=SC2034  # read by the script this is part of

# fish 4 for a distribution whose own fish is older (Debian 12 has 3.6): The fish project's own static release runs on any Linux; its Ubuntu package needs a newer C library than Debian 12 has.
FISH_VERSION=4.9.3
FISH_SHA256_AARCH64=57349f0111728c64b703a84e611aa97ff4d1fa8466385d64e67bd5bc3ffa49fc
FISH_SHA256_X86_64=8f643d10ad1abb0ef7072764c01ceb5cf61b2d373fda400cf60f0bad69b7e095

# gh on a Mac, which has none: The publisher's own release for Apple silicon, put in the account's own folder (0136-machine-bootstrap FR-057).
GH_VERSION=2.102.0
GH_SHA256_MACOS_ARM64=da922c20d1792e5b2cbf375593d7a658acf034c12c84e007e71c76ef959c337e

# glab for a Debian whose archive has none (Debian 12)
GLAB_VERSION=1.120.0
GLAB_SHA256_AARCH64=c60ebb4cb36f276714847a118845b9b4e69f46a8080c68b21ca63f158722cdea
GLAB_SHA256_MACOS_ARM64=8769650c49bb5d5ac52156d46e448e87f5570a868fe4e7bfcbd8cc66693c7afb
GLAB_SHA256_X86_64=4e6c59de9f7ed2f304bf93aad01ea8f8a69584f0450ce90ad696ef81f69c69aa

# jq on a Mac, which has none: The publisher's own release for Apple silicon, put in the account's own folder (0136-machine-bootstrap FR-057).
JQ_VERSION=1.8.2
JQ_SHA256_MACOS_ARM64=2d75340ba57a4b4b4c8708a21c2dc8e958a48aaa8bba13b27f77f6e4c0eca07e

# mise, the one program archon installs everything else with: Read before any Python exists.
MISE_VERSION=2026.10.3
MISE_SHA256_AARCH64=a5141f834d883239c2542b9a2136e75428779b2040206537399714d8c534d91f
MISE_SHA256_MACOS_ARM64=5372494c3027260ddf8efa79504c4d968bbe671a58248ec575f57e1472e5d9c2
MISE_SHA256_X86_64=ff0870ddad7f8c5ba673ceb3e7659f0353da8263eabe8b82220f5816a772c786

# the Python archon runs on
PYTHON_VERSION=3.14.8

# uv, the launcher archon starts Python with
UV_VERSION=0.12.23
# <<< pins.auto <<<

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
yq mikefarah/yq yq=yq_linux_amd64|yq_linux_arm64|yq_darwin_arm64|yq
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
dbmate amacneil/dbmate dbmate=dbmate-linux-amd64|dbmate-linux-arm64|dbmate-macos-arm64|dbmate
'
# Python tools, each in a virtual environment of its own: name, PyPI package, then link=path inside it
PY_TOOLS='
sqlite-utils sqlite-utils sqlite-utils=bin/sqlite-utils
datasette datasette datasette=bin/datasette
harlequin harlequin harlequin=bin/harlequin
visidata visidata vd=bin/vd visidata=bin/visidata
'

# The AI assistants for the terminal, so that a person who has never installed one can type `claude`, `codex`, `opencode` or `aider` the day the computer is set up.
# Each of the first three is one program that its publisher ships inside a per-platform npm package, so no Node.js is needed to run it; the newest version is
# taken, and only with the SHA-512 that npm's registry lists for the file. Fields: name, the npm package that names the newest version, the per-platform package
# ({os} is linux or darwin, {arch} is x64 or arm64, {ver} the newest version), then the file to link.
AGENT_TOOLS='
claude @anthropic-ai/claude-code @anthropic-ai/claude-code-{os}-{arch}@{ver} claude
codex @openai/codex @openai/codex@{ver}-{os}-{arch} codex
opencode opencode-ai opencode-{os}-{arch}@{ver} opencode
'
# Aider is a Python program: name, PyPI package, then link=path inside its virtual environment
AGENT_PY_TOOLS='
aider aider-chat aider=bin/aider
'

# ---- settings ----------------------------------------------------------------------------------------------------------------------------------

raw_url=${BOOTSTRAP_URL:-https://raw.githubusercontent.com/intellectual-frontiers/.github/main}
archon_url=${ARCHON_URL:-https://github.com/intellectual-frontiers/archon}
github_api=${BOOTSTRAP_GITHUB_API:-${WS_HOST_GITHUB_API:-https://api.github.com}}
pypi_url=${BOOTSTRAP_PYPI:-${WS_HOST_PYPI:-https://pypi.org}}
npm_url=${BOOTSTRAP_NPM:-https://registry.npmjs.org}

dry=0
comfort=0
orig_path=$PATH
goos=linux; miseOs=linux   # detect_platform sets them
esc=$(printf '\033')   # BSD sed has no \x1b, so the escape character is put in by name

usage() {
  sed -n '2,/^# shellcheck disable=SC2034/p' "$0" 2>/dev/null | sed '$d' | sed 's/^# \{0,1\}//' || true
}

for arg in "$@"; do
  case $arg in
    --dry-run | -n) dry=1 ;;
    --comfort) comfort=1 ;;
    -h | --help)
      case $0 in *archon-setup.sh) usage ;; *) echo "Usage: curl -fsSL URL | sh -s -- [--dry-run] [--comfort]   (see the header of archon-setup.sh)" ;; esac
      exit 0 ;;
    *) echo "archon-setup: unknown option $arg (try --help)" >&2; exit 2 ;;
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
     e_one='1️⃣ '; e_two='2️⃣ '; e_three='3️⃣ '; e_four='4️⃣ '; e_ok='✅ '; e_stop='🛑 '; e_what='❓ '; e_why='💬 '; e_log='📄 '; e_pack='🎁 '; e_help='🤝 '; e_key='🔐 '; e_dir='📂 '; e_sync='🔄 '; e_paint='🎨 '; e_shell='🐟 '; e_next='👉 '; e_code='🧑‍💻 ' ;;
  *) frames='| / - \'; tick='ok'; cross='x'; warnmark='!'; e_rocket=''; e_pkg=''; e_dl=''; e_list=''; e_py=''; e_font=''
     e_one=''; e_two=''; e_three=''; e_four=''; e_ok=''; e_stop=''; e_what=''; e_why=''; e_log=''; e_pack=''; e_help=''; e_key=''; e_dir=''; e_sync=''; e_paint=''; e_shell=''; e_next='-> '; e_code='' ;;
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

work=$(mktemp -d "${TMPDIR:-/tmp}/archon-setup.XXXXXX")
problems=$work/problems     # one line for each thing that did not work, shown at the end
: >"$problems"
ka_pid=""; rem_pid=""
cleanup() {
  ec=$?
  [ -n "$rem_pid" ] && kill "$rem_pid" 2>/dev/null
  if [ "$dry" = 0 ] && command -v ph_event >/dev/null 2>&1; then
    case $ec in 0) oc=finished ;; 4) oc=stopped ;; 5) oc=sign-in-pending ;; 130) oc=interrupted ;; *) oc=failed ;; esac
    ph_event bootstrap_finished "s:outcome=$oc" "n:exit_code=$ec" "n:duration_ms=$(( ($(date +%s) - ph_started) * 1000 ))" "n:steps=${step_no:-0}" "n:problems=$(wc -l <"$problems" 2>/dev/null | tr -d ' ')" "s:log_file=$(short_path "${logfile:-}")"
    ph_wait
  fi
  [ -n "$ka_pid" ] && kill "$ka_pid" 2>/dev/null
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

skipped=$work/skipped       # one line for each thing left for a GitHub sign-in (not a failure), shown at the end
: >"$skipped"
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
  printf '%s %s\n' "$(date +%H:%M:%S)" "$(printf '%s' "$*" | sed "s/${esc}\[[0-9;]*m//g")" >>"$logfile" 2>/dev/null || true
}
# shellcheck disable=SC2088  # the tilde is meant literally: it is how a path in the home folder is shown to a person
short_path() { case $1 in "$HOME"/*) printf '~/%s' "${1#"$HOME"/}" ;; *) printf '%s' "$1" ;; esac; }

# ---- telemetry: optional, to PostHog, only with ARCHON_POSTHOG_KEY (0136 FR-038) ----------------------------------------------------------------------
# With the key set, the setup sends a few events (it started, each step with its time and outcome, where a failure's log is, how it ended) so we can see how long
# things take and where people get stuck: environment `bootstrap`, a device id made from the machine (never its name), and the kind of computer. No name, host name,
# password, token or file content is sent. Without the key, or with DO_NOT_TRACK=1 or ARCHON_OBSERVE=off, nothing is sent and nothing else changes: it is an aid, never a gate.
# The settings a person kept earlier (`archon secrets`, 0136 FR-041) count where this terminal did not load them.
secrets_file=$cfgdir/archon/secrets.env
sf_get() {  # sf_get NAME: the value kept in the file, or nothing
  [ -r "$secrets_file" ] || return 0
  sed -n "s/^$1='\\(.*\\)'\$/\\1/p" "$secrets_file" | tail -n 1
}
ph_key=${ARCHON_POSTHOG_KEY:-$(sf_get ARCHON_POSTHOG_KEY)}
ph_host=${ARCHON_POSTHOG_HOST:-$(sf_get ARCHON_POSTHOG_HOST)}
ph_host=${ph_host:-https://us.i.posthog.com}
ph_host=${ph_host%/}
ph_pids=""
ph_on=0
if [ -n "$ph_key" ] && [ "$dry" = 0 ] && command -v curl >/dev/null 2>&1; then
  case $(printf '%s' "${ARCHON_OBSERVE:-}" | tr 'A-Z' 'a-z') in off | 0 | false | no) ;; *)
    case $(printf '%s' "${DO_NOT_TRACK:-}" | tr 'A-Z' 'a-z') in 1 | true | yes) ;; *) ph_on=1 ;; esac ;;
  esac
fi
ph_started=$(date +%s)
ph_run=$stamp-$$

ph_str() { printf '%s' "$1" | tr -d '\000-\037' | sed 's/\\/\\\\/g; s/"/\\"/g' | cut -c1-400; }   # one JSON string's text

# the device id: the same on every run on this machine or distro, made from its machine id (hashed, so the id itself is never sent), else a random one kept in a file
ph_device() {
  f=${ARCHON_DEVICE_ID_FILE:-$HOME/.archon-bootstrap/device-id}
  if [ -s "$f" ]; then cat "$f"; return 0; fi
  mid=$(cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id 2>/dev/null || ioreg -rd1 -c IOPlatformExpertDevice 2>/dev/null | awk -F'"' '/IOPlatformUUID/ {print $4}' || true)
  if [ -n "$mid" ]; then id=dev-$(printf 'archon-device\0%s' "$mid" | sha256_stdin | cut -c1-16)
  else id=dev-$(cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d - | cut -c1-16); fi
  [ "$id" = dev- ] && id=dev-$(date +%s)$$
  mkdir -p "$(dirname "$f")" 2>/dev/null && printf '%s\n' "$id" >"$f" 2>/dev/null || true
  printf '%s' "$id"
}

# what kind of computer: WSL, a container, a virtual machine, or a machine (real hardware, or a Mac)
host_kind() {
  kind=machine
  if grep -qi microsoft /proc/version 2>/dev/null || [ -n "${WSL_DISTRO_NAME:-}" ]; then kind=wsl
  elif [ -f /.dockerenv ] || grep -qaE 'docker|containerd|lxc|kubepods' /proc/1/cgroup 2>/dev/null; then kind=container
  elif v=$(systemd-detect-virt 2>/dev/null) && [ "$v" != none ]; then kind=vm-$v
  elif grep -qw hypervisor /proc/cpuinfo 2>/dev/null; then kind=vm
  elif [ "$(sysctl -n kern.hv_vmm_present 2>/dev/null || true)" = 1 ]; then kind=vm; fi
  printf '%s' "$kind"
}

# what kind of computer, and no more: WSL or a virtual machine or a container or real hardware, the system, the processors, memory and free disk
ph_machine() {
  kind=$(host_kind)
  wslv=""; case $(cat /proc/version 2>/dev/null) in *WSL2*) wslv=2 ;; *[Mm]icrosoft*) wslv=1 ;; esac
  os_id=""; os_ver=""
  if [ -r /etc/os-release ]; then
    os_id=$(sed -n 's/^ID=//p' /etc/os-release | tr -d '"' | head -n 1); os_ver=$(sed -n 's/^VERSION_ID=//p' /etc/os-release | tr -d '"' | head -n 1)
  fi
  if [ "${goos:-linux}" = darwin ]; then
    os_id=macos; os_ver=$(sw_vers -productVersion 2>/dev/null || true)
    mem=$(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%d", $1/1073741824}' || true)
  else
    mem=$(awk '/^MemTotal:/ {printf "%d", $2/1048576}' /proc/meminfo 2>/dev/null || true)
  fi
  free=$(df -k "$HOME" 2>/dev/null | awk 'NR==2 {printf "%d", $4/1048576}')
  printf '"hostname":"%s","os_user":"%s","host_kind":"%s","wsl_version":"%s","os_id":"%s","os_version":"%s","kernel":"%s","arch":"%s","cpus":%s,"memory_gb":%s,"disk_free_gb":%s' \
    "$(ph_str "$(hostname 2>/dev/null || uname -n)")" "$(ph_str "$(id -un 2>/dev/null)")" "$(ph_str "$kind")" "$wslv" "$(ph_str "$os_id")" "$(ph_str "$os_ver")" "$(ph_str "$(uname -r)")" "$(uname -m)" "${cpus:-0}" "${mem:-0}" "${free:-0}"
}

# ph_event NAME [s:key=text | n:key=number]...  sends one event in the background (curl, three seconds at most); it never fails the setup
ph_event() {
  [ "$ph_on" = 1 ] || return 0
  [ -n "${ph_machine_json:-}" ] || ph_machine_json=$(ph_machine 2>/dev/null || true)
  [ -n "${ph_dev:-}" ] || ph_dev=$(ph_device 2>/dev/null || echo dev-unknown)
  pe_name=$1; shift
  pe_props=""
  for pe_a in "$@"; do
    pe_k=${pe_a%%=*}; pe_v=${pe_a#*=}; pe_t=${pe_k%%:*}; pe_k=${pe_k#*:}
    case $pe_t in
      n) case $pe_v in '' | *[!0-9.]*) pe_v=0 ;; esac; pe_props="$pe_props,\"$pe_k\":$pe_v" ;;
      *) pe_props="$pe_props,\"$pe_k\":\"$(ph_str "$pe_v")\"" ;;
    esac
  done
  pe_who=${ARCHON_PERSON:-$(sf_get ARCHON_PERSON)}; pe_who=${pe_who:-$ph_dev}
  pe_body=$(printf '{"api_key":"%s","batch":[{"event":"%s","distinct_id":"%s","timestamp":"%s","properties":{"$lib":"archon-bootstrap","$process_person_profile":false,"environment":"bootstrap","device_id":"%s","bootstrap_run":"%s",%s%s}}]}' \
    "$ph_key" "$pe_name" "$(ph_str "$pe_who")" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ph_dev" "$ph_run" "$ph_machine_json" "$pe_props")
  # the journal `archon observe` reads: the event, PostHog's answer and every property, never the key
  pe_journal=$(printf '{"at":"%s","source":"bootstrap","event":"%s","host":"%s","status":STATUS,"error":null,"properties":{"environment":"bootstrap","device_id":"%s","bootstrap_run":"%s",%s%s}}' \
    "$(date -u +%Y-%m-%dT%H:%M:%S)" "$pe_name" "$ph_host" "$ph_dev" "$ph_run" "$ph_machine_json" "$pe_props")
  ( code=$(printf '%s' "$pe_body" | curl -sS -m 3 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' --data-binary @- "$ph_host/batch/" 2>/dev/null || true)
    case $code in '' | *[!0-9]*) code=0 ;; esac
    jd=${ARCHON_HOME:-$HOME/.archon}/telemetry
    if mkdir -p "$jd" 2>/dev/null; then
      [ -f "$jd/README.txt" ] || printf '%s\n' "This folder is archon's own record of what it reports to PostHog: sent.jsonl has one line for each event sent, with PostHog's answer and every property; the project key is never written here. Read it with: archon observe" >"$jd/README.txt" 2>/dev/null
      printf '%s\n' "$pe_journal" | sed "s/\"status\":STATUS/\"status\":$code/" >>"$jd/sent.jsonl" 2>/dev/null
    fi ) &
  ph_pids="$ph_pids $!"
  return 0
}
ph_wait() {  # wait (a few seconds at most) for what is still being sent
  [ -n "$ph_pids" ] || return 0
  for pw_p in $ph_pids; do wait "$pw_p" 2>/dev/null || true; done
  ph_pids=""
}
ph_home() { printf '%s' "$1" | sed "s#$HOME#~#g"; }   # a path or an error line without the person's user name in it

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
  ph_event bootstrap_step "s:step=$label" "s:phase=$cur_phase" "s:outcome=$([ "$rc" = 0 ] && echo ok || echo failed)" "n:exit_code=$rc" "n:duration_ms=$(( ($(date +%s) - start) * 1000 ))" "n:step_no=$step_no"
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
# its own link in ~/.local/bin, and never uses a package manager. The caller waits for all of them with one progress line, then stops if any failed.
# How many at once: the work waits mostly on the network, so cores are not the limit (bandwidth and the servers' own limits are, which is why 6 is the ceiling), but unpacking is
# some work for the processor, so a small computer gets fewer: twice its processors, at least 2 and at most 6. BOOTSTRAP_JOBS sets it.
cpus=$(nproc 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)
case $cpus in '' | *[!0-9]*) cpus=2 ;; esac
par_default=$((cpus * 2)); [ "$par_default" -lt 2 ] && par_default=2; [ "$par_default" -gt 6 ] && par_default=6
par=${BOOTSTRAP_JOBS:-$par_default}
pool_n=0; pool_started=0; pool_title=""; pool_total=""; pool_start=0; ticks=0; pool_pids=""
nframes=$(printf '%s\n' "$frames" | awk '{print NF}')
pool_begin() { pool_title=$1; pool_n=0; pool_started=0; pool_total=0; pool_start=$(date +%s); ticks=0; pool_pids=""; pool_dir=$work/pool$$-$1; rm -rf "$pool_dir"; mkdir -p "$pool_dir"; }
pool_done() { n=0; for f in "$pool_dir"/*.rc; do [ -e "$f" ] && n=$((n + 1)); done; printf '%s' "$n"; }
pool_draw() {  # one progress line: how many of the programs started so far are done, and for how long
  [ "$tty_ui" = 1 ] || return 0
  ticks=$((ticks + 1))
  [ "$ticks" -ge 2 ] || return 0
  n=$(( ticks % nframes )); f=""; i=0
  for f in $frames; do [ "$i" = "$n" ] && break; i=$((i + 1)); done
  busy=""; k=1
  while [ "$k" -le "$pool_n" ]; do
    if [ ! -e "$pool_dir/$k.rc" ]; then busy=$(sed 's/^[^ ]* //; s/^Installing //' "$pool_dir/$k.label"); break; fi
    k=$((k + 1))
  done
  pdraw=$(printf '%s: %s of %s (%ss) %s' "$pool_title" "$(pool_done)" "$pool_total" "$(( $(date +%s) - pool_start ))" "$busy")
  printf '\r\033[K%s%s%s %s' "$c" "$f" "$z" "$(clip $((cols - 4)) "$pdraw")" >&2
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
    t0=$(date +%s); rc=0; "$@" >"$j.log" 2>&1 </dev/null || rc=$?
    echo $(( $(date +%s) - t0 )) >"$j.secs"
    echo "$rc" >"$j.rc.tmp"; mv "$j.rc.tmp" "$j.rc"
  ) &
  pool_pids="$pool_pids $!"
}
pool_end() {
  [ "$dry" = 1 ] && return 0
  [ "$pool_started" -gt 0 ] || return 0
  pool_total=$pool_started
  while [ "$(pool_done)" -lt "$pool_started" ]; do pool_draw; sleep 0.1; done
  [ "$tty_ui" = 1 ] && printf '\r\033[K' >&2
  for wp in $pool_pids; do wait "$wp" 2>/dev/null || true; done   # these jobs only: a bare `wait` would also wait for any other job of this shell, with nothing on the screen
  pool_pids=""
  failed_label=""; failed_log=""; failed_from=0
  i=1
  while [ "$i" -le "$pool_n" ]; do
    j=$pool_dir/$i; rc=$(cat "$j.rc" 2>/dev/null || echo 1); lab=$(cat "$j.label")
    step_no=$((step_no + 1))
    ph_event bootstrap_step "s:step=$lab" "s:phase=$cur_phase" "s:outcome=$([ "$rc" = 0 ] && echo ok || echo failed)" "n:exit_code=$rc" "n:duration_ms=$(( $(cat "$j.secs" 2>/dev/null || echo 0) * 1000 ))" "n:step_no=$step_no" "s:parallel=yes"
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
  ph_event bootstrap_failed "s:step=$1" "n:step_no=$step_no" "n:log_line=${3:-0}" "s:log_file=$(short_path "$logfile")" "s:support_file=$(short_path "$support_file")" \
    "s:error_tail=$(tail -n 3 "$2" 2>/dev/null | tr '\n' ' ' | sed "s/${esc}\[[0-9;]*m//g" | sed -E 's/(gh[pousr]_|github_pat_|ph[cx]_)[A-Za-z0-9_]+/[removed]/g' | sed "s#$HOME#~#g")"
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
  } 2>/dev/null | sed -E 's/(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/\1[removed]/g; s/([Tt][Oo][Kk][Ee][Nn]|[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Kk][Ee][Yy])=[^ ]+/\1=[removed]/g' >"$support_file" 2>/dev/null || true
}

# ---- the machine ---------------------------------------------------------------------------------------------------------------------------------

# what to say of a computer whose family the table knows but this setup does not act on: " (the Red Hat family: it uses dnf, and this setup does not support it yet)", or nothing
known_family_note() {  # known_family_note FAMILY
  [ -n "${1:-}" ] || return 0
  printf ' (%s: it uses %s, and this setup does not support it yet)' "$(pm_label "$1")" "$(pm_manager "$1")"
}

detect_platform() {
  os=$(uname -s)
  goos=linux; miseOs=linux
  case $os in
    Linux) ;;
    Darwin) goos=darwin; miseOs=macos ;;
    *) need "this is $os, and the setup is made for Linux (Debian-family or Arch-family) and for a Mac with Apple silicon." "use Linux under WSL 2 or in a virtual machine, or a Mac with Apple silicon" ;;
  esac
  case $(uname -m) in
    x86_64 | amd64) arch=x86_64; goarch=amd64; miseArch=x64 ;;
    aarch64 | arm64) arch=aarch64; goarch=arm64; miseArch=arm64 ;;
    *) need "there are no programs for $(uname -m) here." "use a computer or virtual machine with an amd64 or arm64 processor" ;;
  esac
  if [ "$goos" = darwin ]; then
    # a terminal run under Rosetta says x86_64 on Apple silicon: the hardware is what counts, and the programs fetched are for it
    if [ "$arch" = x86_64 ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null || true)" = 1 ]; then arch=aarch64; goarch=arm64; miseArch=arm64; fi
    [ "$arch" = aarch64 ] || need "this Mac has an Intel processor, and the setup is made for Macs with Apple silicon (M1 and later)." "run the setup in a Linux virtual machine on this Mac, or on a Mac with Apple silicon"
    family=$(pm_family_of_uname Darwin)
    mac_ver=$(sw_vers -productVersion 2>/dev/null || echo 0)
    d_id=macos; d_like=""; d_version=$mac_ver; d_codename=""; d_pretty="macOS $mac_ver"
    case ${mac_ver%%.*} in '' | *[!0-9]*) mac_major=0 ;; *) mac_major=${mac_ver%%.*} ;; esac
    [ "$mac_major" -ge 13 ] || need "this is macOS $mac_ver, and the setup needs macOS 13 (Ventura) or later." "update macOS in System Settings, then run it again"
    wsl=0; wsl_txt=""; is_debian=0; tested=1
    return 0
  fi
  osr=${BOOTSTRAP_OS_RELEASE:-/etc/os-release}
  d_id=unknown; d_like=""; d_version=""; d_codename=""; d_pretty=Linux
  if [ -r "$osr" ]; then
    osval() { sed -n "s/^$1=//p" "$osr" | head -n 1 | tr -d "\"'"; }
    d_id=$(osval ID); d_like=$(osval ID_LIKE); d_version=$(osval VERSION_ID); d_codename=$(osval VERSION_CODENAME); d_pretty=$(osval PRETTY_NAME)
    : "${d_id:=unknown}" "${d_pretty:=Linux}"
  fi
  # the family: what differs between distributions (the package manager and the names of its packages) is chosen from it, by the table commons generates
  # (0136-machine-bootstrap FR-052; commons 0002-packaging). A family the table knows but no script acts on is named, with its package manager.
  family=$(pm_family_of "$d_id $d_like")
  case "$family:$(pm_status "$family")" in
    debian:supported | arch:supported) ;;
    *) need "this is $d_pretty$(known_family_note "$family"), and the setup is made for the Debian family (Debian, Ubuntu), the Arch family (Arch Linux, Omarchy) and Macs with Apple silicon." "use Debian 12 or 13, or an Arch-based distribution (from the Microsoft Store under WSL 2, or in a virtual machine)" ;;
  esac
  wsl=0; wsl_txt=""
  if grep -qi microsoft /proc/version 2>/dev/null || [ -n "${WSL_DISTRO_NAME:-}" ]; then wsl=1; wsl_txt=", under WSL"; fi
  is_debian=0; [ "$d_id" = debian ] && is_debian=1
  tested=0
  case "$d_id:$d_version" in debian:12 | debian:12.* | debian:13 | debian:13.*) tested=1 ;; esac
  if [ "$family" = arch ]; then tested=1; fi   # a rolling release: the current one
}

# ---- what the computer must already have (the setup installs no package: archon-bootstrap.sh does) -------------------------------------------------------

# the package a program comes in, on this family (the table's; a name it has no entry for is its own package)
pkg_of() {
  pk_n=$(pm_package "$family" "$1")
  printf '%s' "${pk_n:-$1}"
}

# the one command a person with administrator rights runs to install packages, on this family, from the table (0136-machine-bootstrap FR-055)
admin_install_names() {  # admin_install_names PACKAGES...: the command with these package names
  pk_t=$(pm_admin_install "$family")
  printf 'sudo %s%s' "${pk_t%%\{packages\}*}" "$*"
}

# the same for programs, which the table names for the family
admin_install_cmd() {  # admin_install_cmd PROGRAMS...
  pk=""
  for prog in "$@"; do pk="$pk $(pkg_of "$prog")"; done
  admin_install_names ${pk# }
}

# On a Mac: the Command Line Tools (git and the compiler's helpers) are Apple's, and installing them asks for a person at the screen, so the setup says so and stops
# (0136-machine-bootstrap FR-057); jq and gh are not Apple's, so the publishers' releases are put in the account's own folder.
mac_need_clt() {
  if ! xcode-select -p >/dev/null 2>&1 || ! [ -x /usr/bin/git ]; then
    need "this Mac has no Command Line Tools, Apple's own set of programs (git among them), and installing them needs a person at the screen." \
      "run  xcode-select --install  in a terminal, click Install in the window that opens, wait for it to finish, then run this setup again"
  fi
  command -v curl >/dev/null 2>&1 || need "this Mac has no curl, which macOS always carries." "repair macOS, or run the setup from a Mac that has it"
}

mac_prereqs() {
  mac_need_clt
  if ! command -v jq >/dev/null 2>&1 && ! [ -x "$bin/jq" ]; then
    step "${e_dl}Getting jq $JQ_VERSION" install_pinned jq "$JQ_VERSION" "https://github.com/jqlang/jq/releases/download/jq-$JQ_VERSION/jq-macos-arm64" "$JQ_SHA256_MACOS_ARM64" raw 0 jq=jq ||
      problem "jq could not be installed"
  fi
  if ! command -v gh >/dev/null 2>&1 && ! [ -x "$bin/gh" ]; then
    step "${e_dl}Getting gh $GH_VERSION" install_pinned gh "$GH_VERSION" "https://github.com/cli/cli/releases/download/v$GH_VERSION/gh_${GH_VERSION}_macOS_arm64.zip" "$GH_SHA256_MACOS_ARM64" zip 0 "gh=gh_${GH_VERSION}_macOS_arm64/bin/gh" ||
      problem "gh could not be installed"
  fi
  return 0
}

check_prereqs() {
  if [ "$family" = macos ]; then mac_prereqs; return 0; fi
  for cmd in git curl; do
    command -v "$cmd" >/dev/null 2>&1 || need "this account has no $cmd, and the setup installs no package (it never uses administrator rights)." \
      "from an account that has them, run:  $(admin_install_cmd "$cmd")   (or run archon-bootstrap.sh, which installs what is needed and then runs this setup)"
  done
  missing=""
  for cmd in tar xz unzip jq gh; do
    command -v "$cmd" >/dev/null 2>&1 || missing="$missing $cmd"
  done
  [ -z "$missing" ] && return 0
  # shellcheck disable=SC2086  # a list of program names
  cmd=$(admin_install_cmd $missing)
  warn "This account has no$missing, which the setup needs for some steps, and it installs no package."
  problem "missing programs:$missing (from an account with administrator rights: $cmd)"
}

# ---- configuration of this run -----------------------------------------------------------------------------------------------------------------

load_config() {
  [ "${BOOTSTRAP_NO_COMFORT:-}" = 1 ] && comfort=0
  default_kits=agents
  [ "$comfort" = 1 ] && default_kits='agents base shell embedded-sql'
  kits=$(cfg BOOTSTRAP_KIT "$(cfg WS_HOST_KIT "$default_kits")")
  kits=$(printf '%s' "$kits" | tr ',' ' ')
  if [ "${BOOTSTRAP_NO_AGENTS:-}" = 1 ]; then kits=$(printf ' %s ' "$kits" | sed 's/ agents / /g'); fi
  p=$(cfg WS_HOST_PROMPT pretty)
  prompt_given=0
  if [ -n "${BOOTSTRAP_PROMPT:-}" ]; then p=$BOOTSTRAP_PROMPT; prompt_given=1; fi
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
}

kit_on() {  # kit_on NAME
  case " $kits " in *" $1 "*) return 0 ;; *) return 1 ;; esac
}

# ---- fish ------------------------------------------------------------------------------------------------------------------------------------------

fish_major() {  # the major version of the fish program given, or 0
  m=$("$1" --version 2>/dev/null | awk '{print $NF}' | sed 's/\..*//')
  case $m in '' | *[!0-9]*) m=0 ;; esac
  printf '%s' "$m"
}

have_fish4() {
  for f in "$bin/fish" "$(command -v fish 2>/dev/null || true)"; do
    [ -n "$f" ] && [ -x "$f" ] && [ "$(fish_major "$f")" -ge 4 ] && return 0
  done
  return 1
}

# Debian calls the fd program fdfind; link the plain name when nothing else holds it
link_fd() {
  mkdir -p "$bin"
  if ! command -v fd >/dev/null 2>&1 && command -v fdfind >/dev/null 2>&1; then ln -s "$(command -v fdfind)" "$bin/fd" 2>/dev/null || true; fi
  return 0
}

# ---- fetching and verifying -------------------------------------------------------------------------------------------------------------------------

# A download that stalls must fail, not wait for ever: no answer in 20 seconds, or under 1 KB a second for 60 seconds, ends it (and curl retries).
net="--connect-timeout 20 --speed-limit 1024 --speed-time 60"
# SHA-256 and SHA-512 of a file (Linux has sha256sum; macOS has shasum): the digest alone
if command -v sha256sum >/dev/null 2>&1; then
  sha_of() { sha256sum "$1" | cut -d' ' -f1; }
  sha256_stdin() { sha256sum; }
  sha512_of() { sha512sum "$1" | cut -d' ' -f1; }
else
  sha_of() { shasum -a 256 "$1" | cut -d' ' -f1; }
  sha256_stdin() { shasum -a 256; }
  sha512_of() { shasum -a 512 "$1" | cut -d' ' -f1; }
fi
b64_decode() { base64 -d 2>/dev/null || base64 -D; }   # GNU and BSD spell it differently

fetch_to() {  # fetch_to URL DEST
  if command -v curl >/dev/null 2>&1; then curl -fsSL $net --retry 3 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then wget -q -T 30 -O "$2" "$1"
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

# swap_link NEW DEST: put the link NEW where DEST is, in one step where the system can (GNU mv -T), else by removing DEST first (BSD mv has no -T, and would move NEW into the folder DEST points to)
swap_link() {
  if [ "$goos" = linux ]; then mv -Tf "$1" "$2"; else rm -f "$2" && mv "$1" "$2"; fi
}

# link_into DIR LINKS: link each "name=path" (path inside DIR) into ~/.local/bin, replacing the link atomically.
link_into() {
  dir=$1; shift
  mkdir -p "$bin"
  for item in "$@"; do
    name=${item%%=*}; rel=${item#*=}
    ln -sfn "$dir/$rel" "$bin/.$name.new" && swap_link "$bin/.$name.new" "$bin/$name"
  done
}

links_present() {  # links_present LINKS...: every program is linked
  for item in "$@"; do [ -e "$bin/${item%%=*}" ] || [ -L "$bin/${item%%=*}" ] || return 1; done
  return 0
}

set_current() {  # set_current ROOT VERSION
  ln -sfn "$2" "$1/current.new" && swap_link "$1/current.new" "$1/current"
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
  case $goos:$arch in
    darwin:*) eval "printf '%s' \"\$${1}_SHA256_MACOS_ARM64\"" ;;
    *:x86_64) eval "printf '%s' \"\$${1}_SHA256_X86_64\"" ;;
    *) eval "printf '%s' \"\$${1}_SHA256_AARCH64\"" ;;
  esac
}

# ---- tools that follow their newest release ----------------------------------------------------------------------------------------------------

gh_token() {
  t=${GH_TOKEN:-${GITHUB_TOKEN:-}}
  if [ -z "$t" ] && command -v gh >/dev/null 2>&1; then t=$(gh auth token 2>/dev/null </dev/null || true); fi
  printf '%s' "$t"
}

# Everything that talks to GitHub (the release lookups, mise's downloads, fish, archon's toolchain and shell) waits for github_init, which main runs right after
# sign_in. It exports the token to the programs started from here on (mise, archon, gh) and records whether there is one. Without one, those installs are
# skipped and listed, not tried: unauthenticated, GitHub answers 403 and 429 after a few dozen requests, and a failed step list helps nobody.
have_github=0
github_init() {
  [ "$dry" = 1 ] && return 0
  gi_tok=$(gh_token)
  if [ -n "$gi_tok" ]; then
    [ -n "${GH_TOKEN:-}" ] || GH_TOKEN=$gi_tok
    [ -n "${GITHUB_TOKEN:-}" ] || GITHUB_TOKEN=$gi_tok
    export GH_TOKEN GITHUB_TOKEN
    have_github=1
  else
    warn "There is no GitHub sign-in or token, so what is downloaded from GitHub is left until there is one (Python and uv, most tools, fish, chezmoi, archon's programs). To get them: gh auth login, or export GH_TOKEN=<a token>, then run this again."
  fi
  gi_tok=""
  return 0
}
github_ready() { [ "$dry" = 1 ] || [ "$have_github" = 1 ]; }
skip_github() {  # skip_github WHAT: left for a GitHub sign-in; says so, and the summary lists it
  printf '%s\n' "$1" >>"$skipped"; phase_bad=1; logf "left until a GitHub sign-in: $1"
}

api_get() {  # api_get URL DEST: GitHub's answer, with the person's token when there is one (it lifts the hourly limit); never sent elsewhere
  tok=$(gh_token)
  if [ -n "$tok" ]; then curl -fsSL $net --retry 2 -H "Authorization: Bearer $tok" -H "Accept: application/vnd.github+json" -o "$2" "$1"
  else curl -fsSL $net --retry 2 -H "Accept: application/vnd.github+json" -o "$2" "$1"; fi
}

# The release file for this system (Linux or macOS) on this architecture, chosen by its name (ws-host's pick_asset): the one that says linux and the architecture, is not for
# another system, a package or a signature, and, of the rest, is a static (musl) build if there is one, then an archive. With a pattern, the first file
# whose name matches it. Reads a release's JSON; prints the asset's name and download address, tab-separated, and its stated digest.
# shellcheck disable=SC2016  # a jq program: its $variables are jq's
PICK_JQ='
def anyin($l; $xs): any($xs[]; . as $s | $l | contains($s));
def endsany($l; $xs): any($xs[]; . as $s | $l | endswith($s));
def oswords: if $os == "darwin" then ["darwin","macos","apple","osx"] else ["linux"] end;
def otheros: if $os == "darwin" then ["linux"] else ["darwin","macos","apple","osx"] end;
def wrongfile: ["windows","win32","win64",".exe","freebsd","netbsd","openbsd","android",".deb",".rpm",".apk",".msi",".pkg",".dmg",".sig",".asc",".pem",".sbom",".sha",".md5","checksum","sha256",".json",".txt",".sh",".intoto",".sigstore",".bundle","source","src.","debug","-symbols"] + otheros;
def wrongarch: ["armv","arm32","i686","i386","riscv","s390","ppc","mips","loong","386","x86.","-32bit"];
def archives: [".tar.gz",".tgz",".tar.xz",".txz",".tar.bz2",".tbz",".tbz2",".zip"];
( {x86_64: ["x86_64","amd64","x64"], aarch64: (["aarch64","arm64"] + (if $os == "darwin" then ["universal"] else [] end))}[$arch] ) as $w
| ( {x86_64: ["aarch64","arm64"], aarch64: ["x86_64","amd64","x64"]}[$arch] ) as $o
| (if $pat != "" then
    [ .assets | to_entries[] | select(.value.name | test($pat)) ] | first // empty | .value
  else
    [ .assets | to_entries[]
      | .key as $i | .value as $a | ($a.name | ascii_downcase) as $l
      | select(anyin($l; oswords))
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
  c_line=$(jq -r --arg arch "$arch" --arg os "$goos" --arg pat "$c_pat" "$PICK_JQ" "$c_rel") || c_line=""
  if [ -z "$c_line" ]; then echo "the release has no $goos file for $arch that I can choose by its name" >"$work/why"; return 1; fi
  c_name=$(printf '%s' "$c_line" | cut -f1); c_url=$(printf '%s' "$c_line" | cut -f2); c_sha=$(printf '%s' "$c_line" | cut -f3)
  c_tag=$(jq -r '.tag_name // ""' "$c_rel")
  if [ -z "$c_sha" ]; then
    # an older release: a checksum file the publisher put beside it
    for c_sums in $(jq -r '.assets[] | select(.name | test("(checksums?|sha256sums?)(\\.txt)?$|\\.sha256(sum)?$"; "i")) | .browser_download_url' "$c_rel"); do
      curl -fsSL $net --retry 2 -o "$work/sums" "$c_sums" 2>/dev/null || continue
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
  echo "I found no release of $1 with a $goos file for $arch and a checksum from its publisher ($r_why), so I will not install it" >&2
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
    out="$out$(find "$1" -type f -name "$n" -perm -100 2>/dev/null | while IFS= read -r lp; do
      lr=${lp#"$1"/}; printf '%s %s %s\n' "$(printf '%s' "$lr" | awk -F/ '{print NF}')" "$idx" "$lr"
    done)
"
  done
  printf '%s' "$out" | grep -v '^$' | sort -k1,1n -k2,2n | head -n 1 | cut -d' ' -f3-
}

tool_present() {  # tool_present NAME LINKS...: installed, and every program linked
  n=$1; shift
  [ -L "$tools/$n/current" ] && [ -d "$tools/$n/$(readlink "$tools/$n/current")" ] && links_present "$@"
}

# prune_old TROOT VERSION: keep this version and the one before it (the newest two folders, which are not links or unfinished); no find -printf, which BSD has not
prune_old() {
  ls -t "$1" 2>/dev/null | while IFS= read -r po_n; do
    [ -d "$1/$po_n" ] && [ ! -L "$1/$po_n" ] || continue
    case $po_n in *.partial) continue ;; esac
    printf '%s\n' "$po_n"
  done | tail -n +3 | while IFS= read -r po_old; do [ "$po_old" = "$2" ] || rm -rf "${1:?}/$po_old"; done
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
  prune_old "$troot" "$ver"
  return 0
}

# install_sqlite_org: SQLite's own command line tools (sqlite.org lists the newest version and its SHA3-256); x86-64 only, as sqlite.org builds them
install_sqlite_org() {
  [ "$goos" = linux ] && [ "$arch" = x86_64 ] || return 0   # macOS carries sqlite3 itself
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
  sub=$(find "$troot/$ver" -name sqlite3 -type f | head -n 1); sub=${sub#"$troot/$ver"/}
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

# install_npm_native NAME PACKAGE TEMPLATE FILE: a program that its publisher ships as one file inside a per-platform npm package (Claude Code, Codex, OpenCode).
# The newest version of PACKAGE is asked of the npm registry, the platform package TEMPLATE names is fetched, and it is kept only if its SHA-512 is the one the
# registry lists for it; the file is unpacked into tools/NAME/VERSION, run once with --version, and linked into ~/.local/bin as NAME.
install_npm_native() {
  name=$1; pkg=$2; tmpl=$3; file=$4
  if tool_present "$name" "$name=$file" && [ "${BOOTSTRAP_FRESH:-}" != 1 ]; then return 0; fi
  command -v jq >/dev/null 2>&1 || { echo "jq is not here, so $name cannot be installed" >&2; return 1; }
  fetch_to "$npm_url/$pkg/latest" "$work/npm-latest.json" || { echo "could not ask npm about $pkg" >&2; return 1; }
  ver=$(jq -r '.version // ""' "$work/npm-latest.json")
  [ -n "$ver" ] || { echo "npm named no version of $pkg" >&2; return 1; }
  troot=$tools/$name
  if [ -L "$troot/current" ] && [ "$(readlink "$troot/current")" = "$ver" ] && links_present "$name=$file"; then return 0; fi
  case $arch in x86_64) npm_arch=x64 ;; *) npm_arch=arm64 ;; esac
  spec=$(printf '%s' "$tmpl" | sed "s/{os}/$goos/; s/{arch}/$npm_arch/; s/{ver}/$ver/")
  fetch_to "$npm_url/${spec%@*}/${spec##*@}" "$work/npm-platform.json" || { echo "npm has no $spec for this computer" >&2; return 1; }
  tarball=$(jq -r '.dist.tarball // ""' "$work/npm-platform.json"); integrity=$(jq -r '.dist.integrity // ""' "$work/npm-platform.json")
  case $integrity in sha512-*) ;; *) echo "npm lists no SHA-512 for $spec, so I will not install it" >&2; return 1 ;; esac
  want=$(printf '%s' "${integrity#sha512-}" | b64_decode | od -An -vtx1 | tr -d ' \n')
  [ "${#want}" = 128 ] || { echo "the checksum npm lists for $spec cannot be read, so I will not install it" >&2; return 1; }
  [ -n "$tarball" ] || { echo "npm lists no file for $spec" >&2; return 1; }
  fetch_to "$tarball" "$work/$name.tgz" || { echo "could not fetch $tarball" >&2; return 1; }
  got=$(sha512_of "$work/$name.tgz")
  [ "$got" = "$want" ] || { rm -f "$work/$name.tgz"; echo "the file at $tarball is not the one npm lists (its SHA-512 differs); nothing was installed" >&2; return 1; }
  mkdir -p "$troot"
  rm -rf "$troot/$ver.partial"; mkdir -p "$troot/$ver.partial"
  tar -xzf "$work/$name.tgz" -C "$troot/$ver.partial" --strip-components=1 || { rm -rf "$troot/$ver.partial"; return 1; }
  rm -f "$work/$name.tgz"
  rel=$(locate "$troot/$ver.partial" "$file")
  if [ -z "$rel" ]; then echo "$file is not in what $spec holds, so I installed nothing" >&2; rm -rf "$troot/$ver.partial"; return 1; fi
  chmod 755 "$troot/$ver.partial/$rel"
  if ! "$troot/$ver.partial/$rel" --version </dev/null >/dev/null 2>&1; then echo "$name $ver did not run on this computer, so I installed nothing" >&2; rm -rf "$troot/$ver.partial"; return 1; fi
  rm -rf "${troot:?}/$ver"; mv "$troot/$ver.partial" "$troot/$ver"
  set_current "$troot" "$ver"
  link_into "$troot" "$name=$ver/$rel"
  prune_old "$troot" "$ver"
  return 0
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
  if ! github_ready; then skip_github "$n"; return 0; fi
  pstep "${e_dl}Installing $n (the newest release)" install_release "$n" "$repo" "" "$@"
  return 0
}

# npm_step NAME PACKAGE TEMPLATE FILE: one AI assistant, one step; one that cannot be installed is listed at the end and does not stop the run
npm_step() {
  n=$1
  if tool_present "$n" "$n=$4" && [ "${BOOTSTRAP_FRESH:-}" != 1 ]; then return 0; fi
  pstep "${e_dl}Installing $n (the newest version)" install_npm_native "$@"
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
    url=${BOOTSTRAP_MISE_URL:-${WS_HOST_MISE_URL:-https://mise.jdx.dev/v$MISE_VERSION/mise-v$MISE_VERSION-$miseOs-$miseArch.tar.xz}}
    file=$(download_verified "$url" "$sum") || return 1
    tmp=$data/tools/mise/.unpack.$$
    rm -rf "$tmp"; mkdir -p "$tmp"
    tar -xf "$file" -C "$tmp" --strip-components=1 || { rm -rf "$tmp"; echo "mise could not be unpacked (on Linux, is xz installed?)" >&2; return 1; }
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
    if ! github_ready; then say "Left until you sign in to GitHub: Python and uv (mise gets them from GitHub)."; skip_github "Python and uv"; return 0; fi
    step "${e_py}Installing Python and uv" install_runtime || { problem "Python and uv could not be installed"; return 0; }
  fi
  [ "$dry" = 1 ] || link_uv
  return 0
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
        "https://gitlab.com/gitlab-org/cli/-/releases/v$GLAB_VERSION/downloads/glab_${GLAB_VERSION}_${goos}_$goarch.tar.gz" "$(arch_sha GLAB)" tar 0 glab=bin/glab
    fi
    if ! github_ready; then
      say "Left until you sign in to GitHub: duckdb and the tools that come from GitHub releases."
      tool_present duckdb duckdb=duckdb || skip_github duckdb
    fi
    if github_ready && { ! tool_present duckdb duckdb=duckdb || [ "${BOOTSTRAP_FRESH:-}" = 1 ]; }; then
      case $goos:$arch in
        darwin:*) dpat='^duckdb_cli-osx-(universal|arm64)\.zip$' ;;
        *:x86_64) dpat='^duckdb_cli-linux-amd64\.zip$' ;;
        *) dpat='^duckdb_cli-linux-(arm64|aarch64)\.zip$' ;;
      esac
      pstep "${e_dl}Installing duckdb (the newest release)" install_release duckdb duckdb/duckdb "$dpat" duckdb=duckdb
    fi
    if [ "$goos" = linux ] && [ "$arch" = x86_64 ] && { ! tool_present sqlite3 sqlite3=sqlite3 sqldiff=sqldiff sqlite3_analyzer=sqlite3_analyzer || [ "${BOOTSTRAP_FRESH:-}" = 1 ]; }; then
      pstep "${e_dl}Installing the SQLite command line tools (sqlite.org)" install_sqlite_org
    fi
    if [ "$goos" = darwin ]; then MODERN_TOOLS=$(printf '%s\n' "$MODERN_TOOLS" | grep -v '^btop '); fi   # btop publishes no build for a Mac
    [ "$modern" = 0 ] || each_tool "$MODERN_TOOLS" release_step
    pool_end
  fi
  if kit_on embedded-sql; then
    phase "${e_dl}Installing tools for working with data"
    pool_begin "Installing data tools"
    github_ready || say "Left until you sign in to GitHub: the data tools that come from GitHub releases."
    each_tool "$SQL_TOOLS" release_step
    each_tool "$PY_TOOLS" pypi_step
    pool_end
  fi
  if kit_on agents; then
    phase "${e_dl}Installing the AI assistants (Claude Code, Codex, OpenCode, Aider)"
    pool_begin "Installing AI assistants"
    each_tool "$AGENT_TOOLS" npm_step
    each_tool "$AGENT_PY_TOOLS" pypi_step
    pool_end
  fi
  return 0
}

# ---- the shell kit: fish 4 and Oh My Posh with ws-host's themes ----------------------------------------------------------------------------------

fish_url() { printf 'https://github.com/fish-shell/fish-shell/releases/download/%s/fish-%s-linux-%s.tar.xz' "$FISH_VERSION" "$FISH_VERSION" "$arch"; }

setup_shell_kit() {
  kit_on shell || return 0
  phase "${e_shell}Installing fish, a friendlier shell"
  if [ "$goos" = darwin ]; then say "Skipped on a Mac: zsh, which macOS starts, is set up instead (fish publishes no build for a Mac that the setup can check)."; return 0; fi
  if [ "${BOOTSTRAP_NO_DOWNLOAD:-}" = 1 ]; then say "Skipped (BOOTSTRAP_NO_DOWNLOAD=1)."; return 0; fi
  # fish 4 is the system's where the distribution has it (installed by archon-bootstrap.sh); anywhere it does not, the fish project's own release
  if ! have_fish4; then
    if ! github_ready; then say "Left until you sign in to GitHub: fish $FISH_VERSION (it comes from the fish project's GitHub release)."; skip_github "fish $FISH_VERSION"
    else
      step "${e_dl}Installing fish $FISH_VERSION" install_pinned fish "$FISH_VERSION" "$(fish_url)" "$(arch_sha FISH)" tar 0 fish=fish ||
        problem "fish 4 could not be installed"
    fi
  fi
  return 0
}

# ---- what was installed ---------------------------------------------------------------------------------------------------------------------------

have_cmd() { command -v "$1" >/dev/null 2>&1 || [ -x "$bin/$1" ]; }

verify_install() {
  phase "${e_ok}Checking that everything works"
  if [ "$dry" = 1 ]; then would "check that each program the kits install is here, and that fish is version 4 or later where it was asked for"; return 0; fi
  absent=""
  if kit_on base; then
    for p in uv eza zoxide fzf bat delta just; do have_cmd "$p" || absent="$absent $p"; done
    [ "$goos" = linux ] && { have_cmd btop || absent="$absent btop"; }
    have_cmd duckdb || absent="$absent duckdb"
  fi
  if kit_on agents; then
    for p in claude codex opencode aider; do have_cmd "$p" || absent="$absent $p"; done
  fi
  if kit_on shell && [ "$goos" = linux ]; then
    have_cmd fish || absent="$absent fish"
  fi
  if kit_on embedded-sql; then
    for p in turso usql litestream sqruff dbmate sqlite-utils datasette harlequin vd; do have_cmd "$p" || absent="$absent $p"; done
  fi
  if [ -n "$absent" ]; then warn "Not here:$absent"; problem "not installed:$absent"; fi
  if kit_on shell && [ "$goos" = linux ] && have_cmd fish; then
    fp=$(command -v fish 2>/dev/null || printf '%s' "$bin/fish")
    if [ "$(fish_major "$fp")" -ge 4 ]; then :
    else warn "fish is older than version 4."; problem "fish is older than version 4"; fi
    "$fp" -c 'echo (math 1 + 2)' </dev/null 2>/dev/null | grep -q 3 || { warn "fish did not run a command."; problem "fish did not run a command"; }
  fi
  return 0
}

# ---- GitHub, git and the clone -------------------------------------------------------------------------------------------------------------

sign_in_stop() {  # not signed in: the one stop that is not an error, so it asks for nothing but a second try
  say ""
  say "${y}${b}${e_key}The GitHub sign-in did not finish, so setup paused here.${z}"
  say "${d}Nothing is wrong with your computer. The sign-in is needed because archon is private.${z}"
  say ""
  say "${c}${e_one}1.${z} Type:  ${b}GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https${z}"
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
    would "check that you are signed in to GitHub; if not, run: GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https (a code to type into your own browser)"
    would "make gh git's credential helper for github.com, and set the name and email on your commits where git has none"
    would "export the GitHub token (GH_TOKEN) to mise and archon; with none, skip what comes from GitHub and list it at the end"
    return 0
  fi
  have_cmd gh || { warn "gh, the tool that signs you in to GitHub, is not installed."; problem "gh is not installed"; return 0; }
  token_var=""
  if [ -n "${GH_TOKEN:-}" ]; then token_var=GH_TOKEN; elif [ -n "${GITHUB_TOKEN:-}" ]; then token_var=GITHUB_TOKEN; fi
  if [ -n "$token_var" ] && signed_in; then
    say "${g}${e_ok}Using the GitHub token in ${z}${b}$token_var${z}${g}: no sign-in is needed.${z}"
  elif [ -n "$token_var" ]; then
    say "${r}${b}${e_stop}GitHub did not accept the token in${z} ${b}$token_var${z}${r}.${z}"
    say "Fix it (it needs the ${b}repo${z} scope, and access to archon), or unset it: ${b}unset $token_var${z}, to sign in by hand instead. Then run this setup again."
    problem "the token in $token_var was not accepted by GitHub"
    exit 5
  elif signed_in; then
    say "${g}${e_ok}You are signed in to GitHub.${z}"
  elif [ "$has_tty" = 1 ]; then
    say ""
    say "${d}GitHub is where this organization keeps its work. archon is ${z}${b}private${z}${d}: only people the owner added can open it."
    say "Need access? Press Ctrl+C, ask the owner, then run this setup again.${z}"
    say ""
    say "${c}${e_key}Next, GitHub gives you a one-time code to type in your browser.${z} ${g}${b}After that, everything is automatic.${z} ${e_rocket}"
    si0=$(date +%s)
    gh_out=$work/gh-login.out; gh_rc=$work/gh-login.rc; rm -f "$gh_out" "$gh_rc"
    # gh runs without a terminal, so it asks nothing (it answers yes to its own questions), opens no browser, and prints the code; the code is shown here, and repeated now and then
    ( GH_BROWSER=true BROWSER=true gh auth login --hostname github.com --web --git-protocol https </dev/null >"$gh_out" 2>&1; echo $? >"$gh_rc" ) &
    rem_pid=$!
    shown=""; waited=0
    while [ ! -f "$gh_rc" ]; do
      code=$(grep -oE '[A-Z0-9]{4}-[A-Z0-9]{4}' "$gh_out" 2>/dev/null | head -n 1)
      if [ -n "$code" ] && { [ -z "$shown" ] || [ $((waited % 30)) = 0 ]; }; then
        say ""
        say "${y}${b}⏳ Waiting for you:${z} open ${b}https://github.com/login/device${z} in your browser and type this code: ${y}${b}$code${z}"
        shown=$code
      fi
      waited=$((waited + 1)); sleep 1
    done
    wait "$rem_pid" 2>/dev/null || true; rem_pid=""
    logf "gh auth login said: $(sed "s/${esc}\[[0-9;]*m//g" "$gh_out" | tr '\n' ' ' | sed -E 's/[A-Z0-9]{4}-[A-Z0-9]{4}/<code>/')"
    if signed_in; then si_ok=ok; else si_ok=unfinished; fi
    ph_event bootstrap_step "s:step=GitHub sign-in" "s:phase=sign-in" "s:outcome=$si_ok" "n:duration_ms=$(( ($(date +%s) - si0) * 1000 ))" "s:attended=yes"
    if [ "$si_ok" != ok ]; then
      [ -n "$shown" ] || { say ""; say "${d}GitHub's tool said:${z}"; sed "s/${esc}\[[0-9;]*m//g" "$gh_out" | tail -n 5 | cut -c1-$((cols - 6)) | sed 's/^/     /'; }
      sign_in_stop
    fi
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
    say "    ${c}GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https${z}"
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
      say "GitHub did not accept a login for $archon_url. Sign in with: GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https, then run this again."
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

# ---- archon -----------------------------------------------------------------------------------------------------------------------------------

link_archon() {
  mkdir -p "$bin"
  w=$bin/archon
  if [ ! -e "$w" ] || grep -qE 'archon-setup wrapper|bootstrap-archon wrapper' "$w" 2>/dev/null; then
    printf '#!/bin/sh\n# archon-setup wrapper: runs the clone'"'"'s launcher, so archon works from any folder\nexec "%s/archon" "$@"\n' "$target" >"$w"
    chmod 755 "$w"
  else
    warn "$w exists and is not mine, so I left it; run archon as $target/archon"
  fi
}

# in_archon_quiet COMMAND...: the same, for a step: every question is answered yes, and the progress lines archon draws for a person are off.
in_archon_quiet() {
  ( cd "$target" && ARCHON_ASSUME_YES=1 ARCHON_NO_ADMIN=1 ARCHON_ENVIRONMENT=bootstrap ARCHON_PROGRESS=never "$@" </dev/null )
}
in_archon() {  # in_archon COMMAND...: run in the clone, showing its output; asking nothing of standard input unless there is a terminal
  if [ "$has_tty" = 1 ]; then ( cd "$target" && ARCHON_NO_ADMIN=1 "$@" </dev/tty ); else ( cd "$target" && ARCHON_NO_ADMIN=1 "$@" </dev/null ); fi
}

# The system libraries archon's own programs link against (the C compiler for Rust, the browser's libraries), which only administrator rights can install. archon says which this
# computer lacks, from its own declarations, so this script holds no second list (0136-machine-bootstrap FR-063). The bootstrap, which has those rights, installs them (it defines
# bootstrap_install_libraries); the setup alone names the one command for a person who has them, and goes on.
system_libraries() {
  sl_json=$( ( cd "$target" && ./archon toolchain list --json </dev/null 2>/dev/null ) ) || return 0
  sl_pk=$(printf '%s' "$sl_json" | jq -r '.data.system_packages // [] | join(" ")' 2>/dev/null) || return 0
  [ -n "$sl_pk" ] || return 0
  sl_cmd=$(printf '%s' "$sl_json" | jq -r '.data.system_command // ""' 2>/dev/null)
  if command -v bootstrap_install_libraries >/dev/null 2>&1; then
    bootstrap_install_libraries "$sl_pk" && return 0
  fi
  warn "archon's programs need these system libraries, which only an account with administrator rights can install: $sl_pk. From such an account run: sudo $sl_cmd"
  problem "system libraries are missing: $sl_pk (from an account with administrator rights: sudo $sl_cmd)"
  return 0
}

run_archon() {
  heading "${e_rocket}archon"
  if [ "$dry" = 1 ]; then
    [ "${BOOTSTRAP_NO_CLONE:-}" = 1 ] || [ "${BOOTSTRAP_NO_ARCHON:-}" = 1 ] || {
      would "link ~/.local/bin/archon to the clone's launcher"
      [ "${BOOTSTRAP_NO_DOTFILES:-}" = 1 ] || would "run in the clone: ./archon shell ensure (the startup files of bash, zsh and fish, kept with chezmoi)"
      [ "${BOOTSTRAP_NO_DOTFILES:-}" = 1 ] || [ "$prompt_given" = 0 ] || would "run in the clone: ./archon shell set prompt $([ "$prompt" = no ] && echo none || echo "$prompt")"
      would "run in the clone: ./archon doctor"
      would "ask archon which system libraries its programs need that this computer lacks (./archon toolchain list); the bootstrap installs them with the package manager, the setup alone names the one command for an administrator"
      would "run in the clone: ./archon toolchain ensure (every entry of ./archon toolchain list that is not ready and not optional)"
      would "run in the clone: ./archon check --quick (a few sections, in seconds; the full ./archon check takes minutes and is left to you)"
    }
    return 0
  fi
  if [ "${cloned:-0}" != 1 ] || [ ! -x "$target/archon" ]; then say "archon is not here yet, so I ran none of its commands."; archon_ran=0; return 0; fi
  link_archon
  if [ "${BOOTSTRAP_NO_ARCHON:-}" = 1 ]; then say "Skipped archon's commands (BOOTSTRAP_NO_ARCHON=1)."; archon_ran=0; return 0; fi
  have_cmd uv || { warn "uv is not here, so archon cannot start (its launcher needs only uv)."; problem "archon was not run: uv is missing"; archon_ran=0; return 0; }
  archon_ran=1
  status_doctor=0; status_tool=0; status_check=0; status_shell=0; shell_ran=0; shell_skipped=0
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
  # Every question archon could ask is answered yes, and none may use administrator rights (ARCHON_NO_ADMIN=1): a package only they can install is named, with the command to run.
  tool_skipped=0
  if [ -n "$names" ] && ! github_ready; then
    tool_skipped=1
    say "Left until you sign in to GitHub: ./archon toolchain ensure ($names)."
    skip_github "archon toolchain ensure: $names"
  elif [ -n "$names" ]; then
    system_libraries
    # shellcheck disable=SC2086
    step "${e_pkg}Installing the programs archon uses" in_archon_quiet ./archon toolchain ensure $names || status_tool=$?
  fi
  # The shells of this account: archon keeps their startup files, with chezmoi (0138-shell)
  if [ "${BOOTSTRAP_NO_DOTFILES:-}" != 1 ]; then
    if ! github_ready; then
      shell_skipped=1
      say "Left until you sign in to GitHub: ./archon shell ensure (chezmoi and Oh My Posh come from GitHub)."
      skip_github "archon shell ensure (your shells' startup files)"
    else
      shell_ran=1
      step_soft "${e_paint}Setting up your shells (bash, zsh, fish)" in_archon_quiet ./archon shell ensure || status_shell=$?
      if [ "$status_shell" = 0 ] && [ "$prompt_given" = 1 ]; then
        pchoice=$prompt; [ "$prompt" = no ] && pchoice=none
        step_soft "${e_paint}Choosing the $pchoice prompt" in_archon_quiet ./archon shell set prompt "$pchoice" || status_shell=$?
      fi
      [ "$status_shell" = 0 ] || problem "archon shell ensure did not finish (run ./archon shell status in $target to see why)"
    fi
  fi
  step_soft "${e_ok}Checking that this computer is ready" in_archon_quiet ./archon doctor || status_doctor=$?
  step_soft "${e_ok}Checking that archon is healthy (a quick check)" in_archon_quiet ./archon check --quick || status_check=$?
  phase_close
  if [ "$status_check" != 0 ] && [ -f "$work/last.log" ]; then
    say "${y}${warnmark}archon's own checks found things to look at (setup itself is fine):${z}"
    grep -E '❎|\[[a-z-]+\]' "$work/last.log" 2>/dev/null | grep -v 'not observable' | head -12 | sed 's/^/   /' || true
    say "${d}   Run ${b}archon check${z}${d} any time for the full check (a few minutes).${z}"
  fi
  return 0
}

# ---- the end ---------------------------------------------------------------------------------------------------------------------------------

finish() {
  [ "$dry" = 1 ] && { say ""; say "That was a dry run: nothing was changed, fetched or asked."; return 0; }
  heading "Summary"
  failed=0
  if [ "${archon_ran:-0}" = 1 ]; then
    for pair in "shell ensure:$status_shell" "doctor:$status_doctor" "toolchain ensure:$status_tool" "check --quick:$status_check"; do
      n=${pair%%:*}; s=${pair##*:}
      if [ "$n" = "shell ensure" ] && [ "${shell_ran:-0}" = 0 ]; then
        [ "${shell_skipped:-0}" = 1 ] && say "  ${y}-${z} ./archon $n (left until you sign in to GitHub)"
        continue
      fi
      if [ "$n" = "toolchain ensure" ] && [ "${tool_skipped:-0}" = 1 ]; then say "  ${y}-${z} ./archon $n (left until you sign in to GitHub)"
      elif [ "$s" = 0 ]; then say "  ${g}${tick}${z} ./archon $n"; else say "  ${r}${cross}${z} ./archon $n (exit status $s)"; failed=1; fi
    done
  fi
  if [ -s "$problems" ]; then
    say ""
    say "${b}These did not work, and nothing else depended on them:${z}"
    sed 's/^/  - /' "$problems"
    say "Run this again to retry; what is installed stays."
  fi
  if [ -s "$skipped" ]; then
    say ""
    say "${y}${b}${e_key}Left until you sign in to GitHub${z} (not a failure):"
    say "  $(paste -sd, "$skipped" | sed 's/,/, /g')"
    say "Sign in with ${b}GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https${z}, or export ${b}GH_TOKEN${z}, then run this again: it installs just these."
  fi
  if [ "$prompt" = pretty ] && [ "${BOOTSTRAP_NO_DOTFILES:-}" != 1 ] && [ "${shell_ran:-0}" = 1 ]; then
    font_where="in the settings of your terminal program"
    [ "$wsl" = 1 ] && font_where="in Windows (not in Debian)"
    [ "$goos" = darwin ] && font_where="on this Mac"
    say ""
    say "${b}${e_font}One thing for the prompt: a Nerd Font${z}"
    say "Your prompt draws small icons from a Nerd Font, a font that carries"
    say "icon characters. Until one is chosen in your terminal you will see"
    say "boxes instead. It takes two minutes, once, $font_where:"
    say "  ${c}1.${z} Download CaskaydiaCove Nerd Font and unzip it:"
    say "     ${b}https://www.nerdfonts.com/font-downloads${z}"
    if [ "$goos" = darwin ]; then
      say "  ${c}2.${z} Open the font files and click Install Font in Font Book."
      say "  ${c}3.${z} In Terminal: Settings, Profiles, Text, Change, choose"
      say "     ${b}CaskaydiaCove Nerd Font${z} (iTerm2 and VS Code have a font setting too)."
    elif [ "$wsl" = 1 ]; then
      say "  ${c}2.${z} Select the font files, right-click, \"Install for all users\"."
      say "  ${c}3.${z} In Windows Terminal: Settings, Profiles, Debian, Appearance,"
      say "     set Font face to ${b}CaskaydiaCove Nerd Font${z}."
    else
      say "  ${c}2.${z} Copy the font files into ${b}~/.local/share/fonts${z}, then run ${b}fc-cache -f${z}."
      say "  ${c}3.${z} In your terminal program's settings, set the font to ${b}CaskaydiaCove Nerd Font${z}."
    fi
    say "${d}No font wanted? Run ${z}${b}archon shell set prompt plain${z}${d}: the same${z}"
    say "${d}prompt made of emoji and lines.${z}"
  fi
  if [ "${editor_linked:-0}" = 1 ]; then
    say ""
    say "${b}${e_code}VS Code${z}: ${c}code .${z} in a folder opens it there.$([ "$wsl" = 1 ] && printf ' Under WSL it opens VS Code on Windows, which installs its WSL extension the first time.')"
  fi
  case ":$orig_path:" in
    *":$bin:"*) ;;
    *)
      sh_name=bash
      [ "$goos" = darwin ] && sh_name=zsh
      kit_on shell && [ "$goos" = linux ] && have_cmd fish && sh_name=fish   # fish is the shell this sets up, so it is the one to start
      say ""
      say "${b}${e_sync}One last thing:${z} this window does not know your new shell yet."
      say "Type the line below, or close this window and open a new one."
      say ""
      say "    ${c}exec $sh_name -l${z}"
      ;;
  esac
  if [ "$comfort" = 0 ] && [ "${BOOTSTRAP_NO_COMFORT:-}" != 1 ]; then
    say ""
    no_fish="fish,"; [ "$goos" = darwin ] && no_fish="fish (there is none for a Mac),"
    say "${d}Not installed, because no archon command needs them: $no_fish the modern command line tools (eza, bat, zoxide, fzf, delta, btop) and the data tools (DuckDB, the SQLite tools).${z}"
    say "${d}To add them, run this setup again with ${z}${b}--comfort${z}${d} (archon-bootstrap.sh does by default).${z}"
  fi
  if kit_on agents && { have_cmd claude || have_cmd codex || have_cmd opencode || have_cmd aider; }; then
    say ""
    say "${b}${e_what}AI assistants are installed${z} (they work in the folder you start them in, and ask before they change anything):"
    have_cmd claude && say "  ${c}claude${z}     Claude Code, from Anthropic. The first time it opens a browser page to sign in with your Claude account."
    have_cmd codex && say "  ${c}codex${z}      Codex, from OpenAI. The first time, choose \"Sign in with ChatGPT\"."
    have_cmd opencode && say "  ${c}opencode${z}   OpenCode, which works with many providers (${c}opencode auth login${z} adds one)."
    have_cmd aider && say "  ${c}aider${z}      Aider, which needs a key from the provider you choose (${c}aider --help${z} says how)."
    say "${d}Start one in a project folder, for example: cd ${target} && claude${z}"
  fi
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

# ---- the editor: `code` opens VS Code (0136-machine-bootstrap FR-044) --------------------------------------------------------------------------
# Under WSL VS Code runs on Windows and reaches Debian through its WSL extension; its `code` command is a script in its Windows folder, on the PATH
# only while WSL appends Windows' PATH. So `code` is a small script in ~/.local/bin that runs it, which every shell has; where VS Code is not on
# Windows, winget (Windows' own package manager) installs it for this Windows user. Elsewhere VS Code is Microsoft's Debian package, which
# archon-bootstrap.sh installs (it needs administrator rights); a machine without a desktop is opened from VS Code on another computer (Remote - SSH).
editor_mark='# made by archon-setup.sh: VS Code on Windows, opened from WSL (0136-machine-bootstrap FR-044)'
editor_mark_old='# made by bootstrap-archon.sh: VS Code on Windows, opened from WSL (0136-machine-bootstrap FR-044)'
win_root=${BOOTSTRAP_WINDOWS_ROOT:-/mnt/c}

windows_code() {  # the `code` script of VS Code on Windows: this Windows user's own install first, then one for all users, then any user's
  if command -v cmd.exe >/dev/null 2>&1 && command -v wslpath >/dev/null 2>&1; then
    la=$(cmd.exe /c 'echo %LOCALAPPDATA%' 2>/dev/null </dev/null | tr -d '\r') || la=""
    case $la in *:\\*) c="$(wslpath -u "$la" 2>/dev/null)/Programs/Microsoft VS Code/bin/code"; [ -f "$c" ] && { printf '%s' "$c"; return 0; } ;; esac
  fi
  for c in "$win_root/Program Files/Microsoft VS Code/bin/code" "$win_root"/Users/*/AppData/Local/Programs/"Microsoft VS Code"/bin/code; do
    [ -f "$c" ] && { printf '%s' "$c"; return 0; }
  done
  return 1
}

winget_exe() {  # Windows' winget, through the PATH WSL appends or in this Windows user's WindowsApps folder
  command -v winget.exe 2>/dev/null && return 0
  for w in "$win_root"/Users/*/AppData/Local/Microsoft/WindowsApps/winget.exe; do [ -f "$w" ] && { printf '%s' "$w"; return 0; }; done
  return 1
}

editor_mark_mac='# made by archon-setup.sh: VS Code on a Mac, opened from the command line (0136-machine-bootstrap FR-044)'
ours_or_free() { [ ! -e "$bin/code" ] || grep -qF "$editor_mark" "$bin/code" 2>/dev/null || grep -qF "$editor_mark_old" "$bin/code" 2>/dev/null || grep -qF "$editor_mark_mac" "$bin/code" 2>/dev/null; }   # ~/.local/bin/code is absent or this script's own

link_windows_code() {  # link_windows_code PATH: ~/.local/bin/code runs it
  mkdir -p "$bin"
  printf '#!/bin/sh\n%s\nexec "%s" "$@"\n' "$editor_mark" "$1" >"$bin/code.$$" && chmod 755 "$bin/code.$$" && mv "$bin/code.$$" "$bin/code"
}

# VS Code on a Mac is an app; its `code` command is inside it, and a Mac adds it to the PATH only when a person asks from VS Code's own command palette
mac_code() {
  for c in "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" "$HOME/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"; do
    [ -x "$c" ] && { printf '%s' "$c"; return 0; }
  done
  return 1
}

winget_code() { "$(winget_exe)" install --id Microsoft.VisualStudioCode --exact --scope user --silent --accept-package-agreements --accept-source-agreements --disable-interactivity; }

setup_editor() {
  [ "${BOOTSTRAP_NO_EDITOR:-}" = 1 ] && return 0
  phase "${e_code}Making ${c}code${z} open VS Code"
  if [ "$goos" = darwin ]; then
    if [ "$dry" = 1 ]; then would "make ~/.local/bin/code run VS Code where the app is (it is a Mac app: from code.visualstudio.com, which this setup does not install)"; return 0; fi
    command -v code >/dev/null 2>&1 && { editor_linked=1; return 0; }
    if mc_path=$(mac_code); then
      ours_or_free || { say "$(short_path "$bin/code") is already there and not this setup's; it is left as it is."; return 0; }
      printf '#!/bin/sh\n%s\nexec "%s" "$@"\n' "$editor_mark_mac" "$mc_path" >"$bin/code.$$" && chmod 755 "$bin/code.$$" && mv "$bin/code.$$" "$bin/code" && editor_linked=1 ||
        problem "$(short_path "$bin/code") could not be written"
    else
      say "VS Code is not on this Mac. It is an app: download it from ${b}https://code.visualstudio.com${z}, drag it to Applications, then run this setup again to make ${c}code${z} open it."
    fi
    return 0
  fi
  if [ "$wsl" = 1 ]; then
    if [ "$dry" = 1 ]; then would "make ~/.local/bin/code run VS Code on Windows, installing it with winget for this Windows user where it is not there"; return 0; fi
    if ! ours_or_free; then say "$(short_path "$bin/code") is already there and not this setup's; it is left as it is."; return 0; fi
    if ! wc_path=$(windows_code); then
      if [ "${BOOTSTRAP_NO_DOWNLOAD:-}" = 1 ]; then say "VS Code is not on Windows; skipped installing it (BOOTSTRAP_NO_DOWNLOAD=1)."; return 0; fi
      if ! winget_exe >/dev/null; then
        warn "VS Code is not on Windows, and winget cannot be reached from here to install it."
        problem "VS Code: install it on Windows (in PowerShell: winget install -e --id Microsoft.VisualStudioCode, or from https://code.visualstudio.com), then run this again"
        return 0
      fi
      step "${e_dl}Installing VS Code on Windows, for this Windows user (winget)" winget_code || { problem "VS Code could not be installed on Windows with winget"; return 0; }
      wc_path=$(windows_code) || { problem "VS Code was installed with winget but its code command was not found; open a new terminal and run this again"; return 0; }
    fi
    if link_windows_code "$wc_path"; then editor_linked=1; else problem "$(short_path "$bin/code") could not be written"; fi
    return 0
  fi
  if command -v code >/dev/null 2>&1; then editor_linked=1; return 0; fi
  if [ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    say "This machine has no desktop: open it from VS Code on your own computer (its Remote - SSH extension), and ${c}code${z} works in VS Code's terminal."
    return 0
  fi
  # a desktop with no VS Code: a package needs administrator rights, which this setup never uses
  if [ "$family" = arch ]; then
    say "VS Code is not installed here. From an account with administrator rights, ${b}sudo pacman -S code${z} installs Code - OSS from the extra repository (Microsoft's own build is in the AUR as visual-studio-code-bin)."
  else
    say "VS Code is not installed here. To install it, run archon-bootstrap.sh from an account with administrator rights (it adds Microsoft's apt repository)."
  fi
  return 0
}

# ---- how this copy was installed (0136-machine-bootstrap FR-060) ----------------------------------------------------------------------------------
# One small file, ~/.config/archon/install.toml, says how this account was set up, so that `archon doctor`, `archon update` and `archon orch status` can say it and warn when the
# computer no longer matches it. The first method is kept (`bootstrap` for a computer set up whole, `setup` for a user made for archon on a machine in use); a later run only
# refreshes the date and adds the comfort kits.
install_method=${install_method:-setup}
install_file=$cfgdir/archon/install.toml
record_install() {
  if [ "$dry" = 1 ]; then would "record how this account was set up in ~/.config/archon/install.toml ($install_method), which the commands that say how things stand show"; return 0; fi
  ri_method=$install_method; ri_first=$(date +%Y-%m-%d); ri_comfort=$comfort
  if [ -r "$install_file" ]; then
    ri_old=$(sed -n 's/^method = "\(.*\)"$/\1/p' "$install_file" | head -n 1); [ -z "$ri_old" ] || ri_method=$ri_old
    ri_o=$(sed -n 's/^installed = "\(.*\)"$/\1/p' "$install_file" | head -n 1); [ -z "$ri_o" ] || ri_first=$ri_o
    grep -q '^comfort = true' "$install_file" && ri_comfort=1
  fi
  [ "$ri_comfort" = 1 ] && ri_c=true || ri_c=false
  ri_dir=$(dirname "$install_file")
  mkdir -p "$ri_dir" || return 0
  ri_tmp=$(mktemp "$ri_dir/.install.XXXXXX") || return 0
  {
    printf '%s\n' '# Written by archon-setup.sh: how this account was set up. Read by archon doctor, archon update and archon orch status; safe to delete (they then say it is not recorded yet).'
    printf 'method = "%s"\n' "$ri_method"
    printf 'family = "%s"\n' "$family"
    printf 'host = "%s"\n' "$(host_kind | sed 's/^vm-.*/vm/')"
    printf 'distro = "%s"\n' "$(printf '%s' "$d_pretty" | tr -d '"\\')"
    printf 'arch = "%s"\n' "$arch"
    printf 'comfort = %s\n' "$ri_c"
    printf 'installed = "%s"\n' "$ri_first"
    printf 'refreshed = "%s"\n' "$(date +%Y-%m-%d)"
  } >"$ri_tmp" && chmod 644 "$ri_tmp" && mv "$ri_tmp" "$install_file" || rm -f "$ri_tmp"
  logf "recorded the installation: $ri_method, $family, comfort $ri_c"
}

# ---- before anything is fetched: what would make a long run fail late (0136-machine-bootstrap FR-061) -----------------------------------------------------------
preflight() {
  [ "$dry" = 1 ] && return 0
  if [ "$(id -u)" = 0 ]; then
    warn "This runs as root. It works, but everything is then kept in root's home folder; a user of your own (any name) is the usual choice."
  fi
  if [ "$wsl" = 1 ]; then
    case $(cat /proc/version 2>/dev/null) in *WSL2*) ;; *) warn "This looks like WSL 1, which lacks what some programs need. Move it to WSL 2 in PowerShell: wsl --set-version <distribution> 2" ;; esac
  fi
  pf_free=$(df -k "$HOME" 2>/dev/null | awk 'NR==2 {printf "%d", $4/1048576}')
  case $pf_free in '' | *[!0-9]*) ;; *) if [ "$pf_free" -lt 10 ]; then warn "Only ${pf_free} GB are free in your home folder, and everything archon uses (the typesetter, the test browser, Java and more) needs about 10 GB. It may stop for want of room; free some space first."; fi ;; esac
  return 0
}

# the private archon repository is read with the person's sign-in: say now, before the long installs, that this account cannot open it (0136-machine-bootstrap FR-061)
check_access() {
  if [ "$dry" = 1 ]; then [ "${BOOTSTRAP_NO_CLONE:-}" = 1 ] || would "check, before installing anything, that this GitHub sign-in can open the private archon repository"; return 0; fi
  [ "${BOOTSTRAP_NO_CLONE:-}" = 1 ] && return 0
  [ "$have_github" = 1 ] || return 0
  ca_out=$(GIT_TERMINAL_PROMPT=0 git ls-remote "$archon_url" HEAD 2>&1 </dev/null) && return 0
  case $ca_out in
    *"not found"* | *"Not Found"* | *"Authentication failed"* | *"could not read"* | *"denied"* | *"403"*)
      logf "no access to $archon_url: $ca_out"
      say "${r}${b}${e_stop}GitHub does not let this account open archon.${z} archon is a private repository: only people the owner added can open it."
      say "Ask the owner of the intellectual-frontiers organization on GitHub to add the GitHub user you signed in as ($(gh api user --jq .login </dev/null 2>/dev/null || echo unknown)), then run this again. Nothing has been installed."
      exit 5 ;;
  esac
  logf "could not check access to $archon_url (a network problem?): $ca_out"
  return 0
}

# ---- the plan, and the run ------------------------------------------------------------------------------------------------------------------

main() {
  detect_platform
  load_config
  PATH=$bin:$PATH
  export PATH
  if [ "$dry" = 0 ]; then mkdir -p "$bin" "$data" "$state" "$cache"; fi

  say "${b}${e_rocket}Setting up this account${z} (${d_pretty}, $arch$wsl_txt, user $(id -un)) for the Intellectual Frontiers harness."
  [ "$dry" = 1 ] && say "${d}Dry run: this lists the steps and changes nothing.${z}"
  if [ -n "${ARCHON_POSTHOG_KEY:-}" ]; then
    say "${g}📡 Telemetry is on:${z} ${b}ARCHON_POSTHOG_KEY${z} is set, so this setup reports to PostHog how long each step takes, and where a failure's log is."
    say "${d}   It sends a device id made from this computer, the kind of computer (WSL, virtual machine) and the system. Also this computer's name and your Linux user name, as archon's own telemetry does. Never a password, a token or a file.${z}"
  else
    say "${d}📡 Telemetry is off (optional). To record this setup in PostHog, press Ctrl+C, run ${z}${b}export ARCHON_POSTHOG_KEY=<your project key>${z}${d}, then start again; the setup keeps it for every new terminal."
    say "   Without the key nothing breaks; there is just no telemetry.${z}"
  fi

  ph_event bootstrap_started "s:method=$install_method" "s:tty=$([ "$has_tty" = 1 ] && echo yes || echo no)" "s:distro=${d_id:-}" "s:distro_version=${d_version:-}" "s:comfort=$([ "$comfort" = 1 ] && echo yes || echo no)"
  signin_needed=0; cloned=0; archon_ran=0
  if [ "$dry" = 1 ]; then
    heading "${e_pkg}What this computer must already have"
    if [ "$family" = macos ]; then
      would "check that the Command Line Tools are here (git); if not, stop and say to run: xcode-select --install"
      would "get jq $JQ_VERSION and gh $GH_VERSION from their publishers' releases (checked by SHA-256) into ~/.local/share, where this Mac has neither"
    else
      would "check that git and curl are here (and tar, xz, unzip, jq and gh, which some steps need); this setup installs no package"
    fi
  else
    check_prereqs
  fi
  # The one thing that needs a person, up front: the GitHub sign-in. Then it all runs by itself. Everything that downloads from GitHub waits for github_init.
  preflight
  sign_in
  github_init
  check_access
  identity
  keep_settings
  setup_runtime
  setup_tools
  setup_shell_kit
  [ "$dry" = 1 ] || ! kit_on base || link_fd
  setup_editor
  verify_install
  record_install
  workspace_and_clone
  run_archon
  finish
}

# ---- keep the PostHog settings for every new terminal (0136 FR-041; the same file and blocks as `archon secrets`, archon's 0074-secrets) --------------------------
# The key a person gave this setup in the environment is lost when the terminal closes, so it is kept in a file only they can read; `archon shell ensure` tells the shells to read it.
sf_put() {  # sf_put NAME VALUE: one line of the file, replaced where it is, else added; written privately and atomically
  pv_dir=$(dirname "$secrets_file")
  mkdir -p "$pv_dir" && chmod 700 "$pv_dir" || return 1
  pv_tmp=$(umask 077; mktemp "$pv_dir/.secrets.XXXXXX") || return 1
  if [ -f "$secrets_file" ]; then cat "$secrets_file" >"$pv_tmp"; else printf '%s\n' "# Private to you (mode 600). Written by \`archon secrets\`; bash and fish read it when a terminal starts." >"$pv_tmp"; fi
  if grep -q "^$1=" "$pv_tmp"; then
    awk -v n="$1" -v v="$2" 'index($0, n "=") == 1 { print n "='"'"'" v "'"'"'"; next } { print }' "$pv_tmp" >"$pv_tmp.2" && mv "$pv_tmp.2" "$pv_tmp"
  else
    printf "%s='%s'\n" "$1" "$2" >>"$pv_tmp"
  fi
  chmod 600 "$pv_tmp" && mv "$pv_tmp" "$secrets_file"
}
keep_settings() {
  ks_names=""
  for ks_n in ARCHON_POSTHOG_KEY ARCHON_POSTHOG_HOST ARCHON_PERSON; do
    eval "ks_v=\${$ks_n:-}"
    [ -n "$ks_v" ] && ks_names="$ks_names $ks_n"
  done
  if [ -n "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ] && [ "$dry" = 0 ]; then
    say "${d}🔑 Your GitHub token was used for this setup only and is not saved. To keep it for every terminal: archon secrets set GH_TOKEN${z}"
  fi
  [ -n "$ks_names" ] || return 0
  phase "${e_key}Keeping your PostHog settings for new terminals ${d}($(short_path "$secrets_file"), private to you)${z}"
  if [ "$dry" = 1 ]; then
    would "keep $(printf '%s' "$ks_names" | sed 's/^ //; s/ /, /g') in $(short_path "$secrets_file") (mode 600); archon shell ensure makes your shells read it in every new terminal"
    return 0
  fi
  for ks_n in $ks_names; do
    eval "ks_v=\${$ks_n}"
    case $ks_v in *"'"* | *"
"*) warn "$ks_n holds a quote or a line break, which the file cannot keep, so it was not saved."; problem "$ks_n was not saved"; continue ;; esac
    sf_put "$ks_n" "$ks_v" || { warn "$ks_n could not be saved in $(short_path "$secrets_file")."; problem "$ks_n was not saved"; continue; }
    logf "kept $ks_n in $secrets_file"
  done
  return 0
}

# BOOTSTRAP_SOURCE_ONLY=1 loads the functions and runs nothing, so a test can call one
[ "${BOOTSTRAP_SOURCE_ONLY:-}" = 1 ] || main "$@"
