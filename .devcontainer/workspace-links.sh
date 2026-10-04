#!/bin/sh
# Puts the checkout a devcontainer opened into the ~/workspaces layout that ws-repos manages
# (0026-workspaces FR-014, FR-015 in the public root). Codespaces and a Dev Container cloned into a volume always
# open the repository at /workspaces/<repo>, outside that layout, so:
#   1. ~/workspaces/<host>/<org>/<repo> becomes a link to this checkout, so `ws-repos ensure` pulls it instead of
#      cloning a second copy;
#   2. every other repository in .devcontainer/ws-repos.json gets a link beside this checkout to where
#      `ws-repos ensure` clones it under ~/workspaces, so ../.github and ../eidolon resolve as on any other host.
# It links and clones nothing else, installs nothing, and is safe to run again. Where the checkout already lives in
# ~/workspaces it does nothing. It goes once workspaces-host-v3's ws-start does the same.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd -P)
home="${WORKSPACES_HOME:-$HOME/workspaces}"
list="$here/.devcontainer/ws-repos.json"

# github.com/<org>/<repo> from the origin URL, whether https (with or without credentials) or ssh. Shell
# expansion only: the workspace image need not carry sed.
url=$(git -C "$here" remote get-url origin)
url=${url%.git}
case "$url" in
  *://*) url=${url#*://}; case "$url" in *@*/*) url=${url#*@} ;; esac ;;
  *@*:*) url=${url#*@}; url="${url%%:*}/${url#*:}" ;;
esac
self=$url
canonical="$home/$self"

if [ "$(cd "$(dirname "$canonical")" 2>/dev/null && pwd -P)/$(basename "$canonical")" = "$here" ]; then
  exit 0
fi
mkdir -p "$(dirname "$canonical")"
[ -e "$canonical" ] || [ -L "$canonical" ] || { ln -s "$here" "$canonical"; echo "workspace-links: $canonical -> $here"; }

for repo in $(jq -r '.repos[].repo' "$list"); do
  [ "$repo" = "$self" ] && continue
  beside="$(dirname "$here")/${repo##*/}"
  [ -e "$beside" ] || [ -L "$beside" ] || { ln -s "$home/$repo" "$beside"; echo "workspace-links: $beside -> $home/$repo"; }
done
