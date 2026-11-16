#!/bin/sh
# agora-install.sh: the one command that installs agora on Linux and macOS. You install Git and GitHub CLI; this does everything else: it signs
# GitHub CLI in if it is not (a code and a browser), copies the `.github` and `erga` repositories to ~/workspaces/github.com/intellectual-frontiers/<repo> (or
# says they are there and brings them up to date) and runs the installer in erga, which gets Bun at its pin, installs agora's packages and runs the doctor. Safe to run again.
#
#   d=$(mktemp -d) && git clone --depth 1 https://github.com/intellectual-frontiers/.github "$d" && sh "$d/bin/agora-install.sh"
#
# ERGA_WORKSPACES is the folder the two repositories go in, instead of the one above.
# Spec: erga 274-agora FR-096
set -eu
say() { printf '%s\n' "$*"; }
stop() { printf '%s\n' "❌ $1" >&2; [ -z "${2:-}" ] || printf '%s\n' "   $2" >&2; exit 3; }

how() { # the line that installs Git and GitHub CLI here
  case "$(uname -s)" in
    Darwin) echo "brew install git gh" ;;
    *)
      if [ -r /etc/os-release ]; then . /etc/os-release; fi
      case " ${ID:-} ${ID_LIKE:-} " in
        *" arch "*) echo "sudo pacman -S --needed git github-cli" ;;
        *" fedora "*|*" rhel "*) echo "sudo dnf install -y git gh" ;;
        *) echo "sudo apt-get update && sudo apt-get install -y git gh" ;;
      esac ;;
  esac
}
command -v git >/dev/null 2>&1 || stop "Git is not installed" "install Git and GitHub CLI, then run this again: $(how)"
command -v gh >/dev/null 2>&1 || stop "GitHub CLI is not installed" "install Git and GitHub CLI, then run this again: $(how)"

if ! gh auth status >/dev/null 2>&1; then
  say "⏳ signing in to GitHub (a code and a browser)"
  gh auth login --hostname github.com --git-protocol https --web
fi
gh auth setup-git >/dev/null 2>&1 || true

# Both repositories live side by side in the workspace: ~/workspaces/github.com/intellectual-frontiers/<repo>. One that is there is said so and brought
# up to date by a fast-forward (a copy that cannot be is left as it is, and said); one that is not is copied.
base="${ERGA_WORKSPACES:-$HOME/workspaces/github.com/intellectual-frontiers}"
sync_repo() {
  repo=$1
  dest="$base/$repo"
  if [ -d "$dest/.git" ]; then
    say "✅ $repo is already in $dest; bringing it up to date"
    git -C "$dest" pull --ff-only || say "⚠️ $repo could not be fast-forwarded, so it is left as it is (commit or set aside what you changed there)"
  else
    say "⏳ copying $repo to $dest"
    mkdir -p "$base"
    gh repo clone "intellectual-frontiers/$repo" "$dest"
  fi
}
sync_repo .github
sync_repo erga
dest="$base/erga"
exec sh "$dest/bin/install.sh"
