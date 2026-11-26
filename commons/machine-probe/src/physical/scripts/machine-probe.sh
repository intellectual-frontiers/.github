#!/bin/sh
# machine-probe 1: read-only facts for the fleet (commons machine-probe 0002-machine-probe-contract).
# Installed for a machine the fleet adopts, and run only by the fleet's probe key (the key line in
# authorized_keys forces it). It changes nothing, listens on nothing and needs no root. Remove it
# with the probe key's line when the machine is released. POSIX sh; BusyBox (NAS devices) too.
set -u
LC_ALL=C; export LC_ALL
PATH="$PATH:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin"
req=${SSH_ORIGINAL_COMMAND:-${1:-facts}}
kv() { printf '%s=%s\n' "$1" "$(printf '%s' "$2" | tr '\n' ' ' | sed 's/[[:space:]]*$//')"; }
has() { command -v "$1" >/dev/null 2>&1; }
os=$(uname -s 2>/dev/null || echo unknown)

facts() {
  echo "@probe"; kv version 1; kv at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "@os"
  kv kernel "$os"; kv release "$(uname -r)"; kv arch "$(uname -m)"; kv hostname "$(hostname 2>/dev/null || uname -n)"
  if [ "$os" = Darwin ]; then
    kv family macos; kv name "$(sw_vers -productName 2>/dev/null)"; kv version "$(sw_vers -productVersion 2>/dev/null)"
    kv serial "$(ioreg -c IOPlatformExpertDevice -d 2 2>/dev/null | awk -F'"' '/IOPlatformSerialNumber/{print $4}')"
    kv model "$(sysctl -n hw.model 2>/dev/null)"
  elif [ -r /etc/os-release ]; then
    . /etc/os-release
    fam=${ID:-linux}; case "${ID_LIKE:-}" in *arch*) [ "$fam" = arch ] || fam="$fam (arch)";; esac
    kv family "$fam"; kv name "${PRETTY_NAME:-$fam}"; kv version "${VERSION_ID:-rolling}"
    [ -d "$HOME/.local/share/omarchy" ] && kv flavor omarchy
    [ -n "${WSL_DISTRO_NAME:-}" ] || grep -qi microsoft /proc/version 2>/dev/null && kv wsl yes
    kv model "$(cat /sys/class/dmi/id/product_name 2>/dev/null)"
  else
    kv family unknown
  fi
  echo "@hardware"
  if [ "$os" = Darwin ]; then
    kv cpus "$(sysctl -n hw.ncpu 2>/dev/null)"; kv memory_mb "$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1048576 ))"
  else
    kv cpus "$(getconf _NPROCESSORS_ONLN 2>/dev/null)"; kv memory_mb "$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo 2>/dev/null)"; kv clk_tck "$(getconf CLK_TCK 2>/dev/null)"
  fi
  df -Pk / 2>/dev/null | awk 'NR==2{printf "disk_total_gb=%d\ndisk_used_pct=%s\n", $2/1048576, $5}' | tr -d '%'
  echo "@security"
  if [ "$os" = Darwin ]; then
    fdesetup status 2>/dev/null | grep -q "FileVault is On" && kv disk_encryption on || kv disk_encryption off
    /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep -qi enabled && kv firewall on || kv firewall off
    au=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates 2>/dev/null)
    [ "$au" = 1 ] && kv auto_updates on || kv auto_updates off
    kv admins "$(dscl . -read /Groups/admin GroupMembership 2>/dev/null | sed 's/GroupMembership: //')"
  else
    if lsblk -rno TYPE 2>/dev/null | grep -qx crypt; then kv disk_encryption on; else kv disk_encryption off; fi
    fw=off; for u in ufw firewalld nftables; do systemctl is-active -q "$u" 2>/dev/null && fw=on; done; kv firewall "$fw"
    if systemctl is-enabled -q unattended-upgrades 2>/dev/null || systemctl is-enabled -q dnf-automatic.timer 2>/dev/null; then kv auto_updates on
    elif has pacman; then kv auto_updates manual; else kv auto_updates off; fi
    if has getent; then grp() { getent group "$1"; }; else grp() { grep "^$1:" /etc/group; }; fi
    kv admins "$( (grp sudo; grp wheel; grp admin; grp administrators) 2>/dev/null | cut -d: -f4 | tr ',' ' ')"
  fi
  if [ -r /etc/ssh/sshd_config ]; then
    pa=$(grep -hiE '^[[:space:]]*PasswordAuthentication' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | head -1 | awk '{print tolower($2)}')
    kv ssh_password_auth "${pa:-default}"
  fi
  echo "@software"
  if has dpkg-query; then kv manager apt; kv packages "$(dpkg-query -f '.\n' -W 2>/dev/null | wc -l)"
    kv pending_updates "$(apt list --upgradable 2>/dev/null | grep -c upgradable)"
  elif has pacman; then kv manager pacman; kv packages "$(pacman -Q 2>/dev/null | wc -l)"
    has checkupdates && kv pending_updates "$(checkupdates 2>/dev/null | wc -l)"
  elif has rpm; then kv manager rpm; kv packages "$(rpm -qa 2>/dev/null | wc -l)"
  fi
  has brew && kv brew_packages "$(brew list 2>/dev/null | wc -l)"
  has osqueryi && kv osquery "$(osqueryi --version 2>/dev/null | awk '{print $NF}')"
  echo "@listening"
  if has ss; then ss -Hltn 2>/dev/null | awk '{print $4}' | sed 's/.*://' | sort -un | tr '\n' ' ' | sed 's/^/ports=/;s/ *$//'; echo
  elif has lsof; then lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $9}' | sed 's/.*://' | sort -un | tr '\n' ' ' | sed 's/^/ports=/;s/ *$//'; echo
  elif has netstat; then netstat -ltn 2>/dev/null | awk 'NR>2{print $4}' | sed 's/.*://' | sort -un | tr '\n' ' ' | sed 's/^/ports=/;s/ *$//'; echo
  fi
  agent_facts
}

# The facts of a machine on which a coding harness works (commons machine-probe 0008-machine-probe-agent-workspace). The section is
# written only where a harness is found. A harness is a program on the PATH that is not a mise shim
# (a shim starts an install over the network when run, so it is looked for and never run). Only the NAMES of the variables that look
# like secrets are given, never a value.
agent_facts() {
  harnesses=""
  for h in claude:claude-code codex:codex herdr:herdr; do
    bin=${h%%:*}; name=${h#*:}
    p=$(command -v "$bin" 2>/dev/null)
    case "$p" in ""|*/mise/shims/*) ls -d "${HOME:-/nonexistent}"/.local/share/mise/installs/*"$bin"* >/dev/null 2>&1 && harnesses="$harnesses $name";; *) harnesses="$harnesses $name";; esac
  done
  harnesses=$(printf '%s\n' $harnesses | sort -u | tr '\n' ' ' | sed 's/ *$//')
  if [ -z "$harnesses" ]; then return 0; fi
  echo "@agent"
  kv harnesses "$harnesses"
  names=$( {
    env | sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p'
    for f in "${HOME:-/nonexistent}/.profile" "${HOME:-/nonexistent}/.bash_profile" "${HOME:-/nonexistent}/.bashrc" "${HOME:-/nonexistent}/.zshenv" /etc/environment; do
      [ -r "$f" ] && sed -n 's/^[[:space:]]*\(export[[:space:]][[:space:]]*\)\{0,1\}\([A-Za-z_][A-Za-z0-9_]*\)=.*/\2/p' "$f"
    done
    for f in "${HOME:-/nonexistent}"/.config/environment.d/*.conf; do [ -r "$f" ] && sed -n 's/^[[:space:]]*\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$f"; done
  } 2>/dev/null | grep -E 'TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY' | grep -vE '_(FILE|PATH)$|TOKENS$' | sort -u | tr '\n' ' ' | sed 's/ *$//')
  kv ambient-secret-names "$names"
  kv uid "$(id -u 2>/dev/null)"
  if has systemd-detect-virt; then
    v=$(systemd-detect-virt 2>/dev/null); [ -n "$v" ] || v=none
    if systemd-detect-virt -q --container 2>/dev/null; then iso=container; elif systemd-detect-virt -q --vm 2>/dev/null; then iso=vm; else iso=physical; fi
  else v=unknown; iso=unknown; fi
  kv virt "$v"; kv isolation "$iso"
}

case "$req" in
  facts) facts ;;
  version) echo 1 ;;
  osquery\ *)
    has osqueryi || { echo "osquery is not installed here" >&2; exit 3; }
    sql=$(printf '%s' "${req#osquery }" | base64 -d 2>/dev/null) || { echo "not base64" >&2; exit 2; }
    case "$(printf '%s' "$sql" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//')" in
      select*|with*) ;; *) echo "only SELECT" >&2; exit 2 ;;
    esac
    sql=$(printf '%s' "$sql" | sed 's/[[:space:];]*$//')
    case "$sql" in *\;*) echo "one statement" >&2; exit 2 ;; esac
    exec osqueryi --json "$sql" ;;
  *) echo "machine-probe: unknown probe: $req (facts, osquery, version)" >&2; exit 2 ;;
esac
