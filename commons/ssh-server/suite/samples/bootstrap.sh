#!/bin/sh
# Synth enrollment bootstrap, for POSIX sh. Read it before you run it: ssh -p 2222 s-enroll@synth-host bootstrap > enroll.sh
# It reports facts about this machine, waits for a person to approve, asks you before it installs anything, and runs only the typed steps of the plan.
# It holds no secret. It never evaluates what the server sends: it reads fields of a small alphabet and runs argument vectors without a shell.
set -eu

SESSION='en-abcdefghijklmnop'
HOST=${SYNTH_HOST:-'synth-host'}
PORT=${SYNTH_PORT:-'2222'}
WAIT_MAX=${SYNTH_WAIT_MAX:-1800}
POLL=${SYNTH_POLL:-10}
DIR=${SYNTH_DIR:-'/etc/synth'}
HKALGO='ssh-ed25519'
HKB64='AAAAC3NzaC1lZDI1NTE5AAAAIPlaceholderPlaceholderPlaceholderPlace'
PAIR_KIND='digits'
PAIR_LEN='6'
ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ'
COMMIT_TAG='ifc-enroll-commit-v1'
SAS_TAG='ifc-enroll-sas-v1'

say() { printf '%s\n' "$*"; }
die() { printf 'enroll: %s\n' "$*" >&2; exit 1; }

# the one door: a fixed program, a fixed account, the key made on this machine, and the host key of the controller checked against what this script holds
ssh_s() {
  # shellcheck disable=SC2086
  ssh -p "$PORT" -i "$KEY" -o IdentitiesOnly=yes -o PubkeyAuthentication=yes -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no -o ConnectTimeout=15 \
    -o UserKnownHostsFile="$KH" -o StrictHostKeyChecking="$STRICT" -o HashKnownHosts=no ${SYNTH_SSH_OPTS:-} "s-enroll@$HOST" "$@"
}

have() { command -v "$1" >/dev/null 2>&1; }
num() { case "$1" in ''|*[!0-9]*) echo 0 ;; *) echo "$1" ;; esac; }
js() { printf '%s' "$1" | tr -d '\000-\037\177' | sed 's/\\/\\\\/g; s/"/\\"/g'; }
safe() { case "$1" in ''|*[!A-Za-z0-9._:/@=+,%\ -]*) die "a field of the plan is outside the safe alphabet" ;; esac; }
as_root() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo "$@"; fi; }
osr() { sed -n "s/^$1=//p" /etc/os-release 2>/dev/null | head -n 1 | tr -d "\"'"; }

announce() {
  say "This script will:"
  say "  0. make a new key pair on this machine (the private key never leaves it) and pair with the controller: you will read a short code here and a person types it there"
  say "  1. read facts about this machine from a fixed list of probes (os, kernel, hostname, machine id, cpu, memory, disks, network interfaces, ssh host keys, admin users, package manager, sudo state, init system)"
  say "  2. send them to $HOST port $PORT, session $SESSION"
  say "  3. wait until a person approves this machine"
  say "  4. ask you, here, before it installs anything, and only then run the steps of the approved plan"
  say "A plan may install, from a pinned address with a verified SHA-256:"
  case "$(uname -s)" in
  Linux)
    echo "  osquery 5.24.1"
    ;;
  Darwin)
    echo "  osquery 5.24.1"
    ;;
  *)
    echo "  nothing is offered for this system"
    ;;
  esac
}

facts_json() {
  kernel_name=$(uname -s)
  arch=$(uname -m)
  case "$kernel_name" in
  Linux) family=linux; os_name=$(osr NAME); os_version=$(osr VERSION_ID) ;;
  Darwin) family=macos; os_name=$(sw_vers -productName 2>/dev/null || echo macOS); os_version=$(sw_vers -productVersion 2>/dev/null || echo unknown) ;;
  *BSD) family=bsd; os_name=$kernel_name; os_version=$(uname -r) ;;
  *) family=other; os_name=$kernel_name; os_version=$(uname -r) ;;
  esac
  [ -n "$os_name" ] || os_name=$kernel_name
  [ -n "$os_version" ] || os_version=unknown
  kernel=$(uname -sr)
  host=$(hostname 2>/dev/null || uname -n)
  machine_id=
  for f in /etc/machine-id /var/lib/dbus/machine-id; do
    if [ -r "$f" ]; then machine_id=$(head -n 1 "$f"); break; fi
  done
  serial=
  if [ -r /sys/class/dmi/id/product_serial ]; then serial=$(head -n 1 /sys/class/dmi/id/product_serial 2>/dev/null || true); fi
  if [ "$family" = macos ] && have ioreg; then
    machine_id=$(ioreg -rd1 -c IOPlatformExpertDevice 2>/dev/null | awk -F'"' '/IOPlatformUUID/ {print $4}')
    serial=$(ioreg -rd1 -c IOPlatformExpertDevice 2>/dev/null | awk -F'"' '/IOPlatformSerialNumber/ {print $4}')
  fi
  [ -n "$machine_id" ] || machine_id=unknown
  cpus=$(nproc 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 0)
  mem=0
  if [ -r /proc/meminfo ]; then mem=$(awk '/^MemTotal:/ {print $2 * 1024}' /proc/meminfo); elif have sysctl; then mem=$(sysctl -n hw.memsize 2>/dev/null || echo 0); fi

  disks=
  if have lsblk; then
    disks=$(lsblk -dbn -o NAME,SIZE,TYPE 2>/dev/null | awk '$3 == "disk" {printf "%s{\"name\":\"%s\",\"sizeBytes\":%s}", (n++ ? "," : ""), $1, $2}' || true)
  fi
  if [ -z "$disks" ] && have df; then
    disks=$(df -Pk / 2>/dev/null | awk 'NR == 2 {printf "{\"name\":\"root\",\"sizeBytes\":%s}", $2 * 1024}' || true)
  fi

  nics=
  if [ -d /sys/class/net ]; then
    for d in /sys/class/net/*; do
      n=$(basename "$d")
      mac=$(tr 'A-F' 'a-f' < "$d/address" 2>/dev/null || true)
      case "$mac" in ''|00:00:00:00:00:00) continue ;; esac
      addrs=
      if have ip; then
        for a in $(ip -o addr show dev "$n" 2>/dev/null | awk '{print $4}'); do addrs="$addrs${addrs:+,}\"$(js "$a")\""; done
      fi
      nics="$nics${nics:+,}{\"name\":\"$(js "$n")\",\"mac\":\"$(js "$mac")\",\"addresses\":[$addrs]}"
    done
  elif have ifconfig; then
    for n in $(ifconfig -l 2>/dev/null); do
      mac=$(ifconfig "$n" 2>/dev/null | awk '/ether/ {print $2; exit}')
      [ -n "$mac" ] || continue
      addrs=
      for a in $(ifconfig "$n" 2>/dev/null | awk '/inet6? / {print $2}'); do addrs="$addrs${addrs:+,}\"$(js "$a")\""; done
      nics="$nics${nics:+,}{\"name\":\"$(js "$n")\",\"mac\":\"$(js "$mac")\",\"addresses\":[$addrs]}"
    done
  fi

  keys=
  if have ssh-keygen; then
    for f in /etc/ssh/ssh_host_*_key.pub; do
      [ -r "$f" ] || continue
      algo=$(awk '{print $1; exit}' "$f")
      fp=$(ssh-keygen -lf "$f" 2>/dev/null | awk '{print $2; exit}')
      case "$fp" in SHA256:*) keys="$keys${keys:+,}{\"algo\":\"$(js "$algo")\",\"fingerprint\":\"$(js "$fp")\"}" ;; esac
    done
  fi

  admins=
  for g in sudo wheel admin; do
    if have getent; then
      for u in $(getent group "$g" 2>/dev/null | cut -d: -f4 | tr ',' ' '); do admins="$admins${admins:+,}\"$(js "$u")\""; done
    fi
  done
  admins="${admins:+$admins,}\"root\""

  pm=none
  for c in apt-get:apt dnf:dnf yum:yum zypper:zypper apk:apk pacman:pacman brew:brew; do
    if have "${c%%:*}"; then pm=${c##*:}; break; fi
  done

  if [ "$(id -u)" = 0 ]; then sudo_state=root
  elif have sudo && sudo -n true >/dev/null 2>&1; then sudo_state=passwordless
  elif have sudo; then sudo_state=password
  else sudo_state=none; fi

  if [ -d /run/systemd/system ]; then init=systemd
  elif have rc-service; then init=openrc
  elif [ "$family" = macos ]; then init=launchd
  else init=other; fi

  serial_field=
  if [ -n "$serial" ]; then serial_field=",\"serial\":\"$(js "$serial")\""; fi
  printf '{"type":"facts","facts":{"os":{"family":"%s","name":"%s","version":"%s","arch":"%s"},"kernel":"%s","hostname":"%s","machineId":"%s"%s,"cpus":%s,"memoryBytes":%s,"disks":[%s],"nics":[%s],"hostKeys":[%s],"adminUsers":[%s],"packageManager":"%s","sudo":"%s","init":"%s"}}\n' \
    "$family" "$(js "$os_name")" "$(js "$os_version")" "$(js "$arch")" "$(js "$kernel")" "$(js "$host")" "$(js "$machine_id")" "$serial_field" \
    "$(num "$cpus")" "$(num "$mem")" "$disks" "$nics" "$keys" "$admins" "$pm" "$sudo_state" "$init"
}

ask_consent() {
  if [ "${SYNTH_CONSENT:-}" = yes ]; then say "consent given by SYNTH_CONSENT=yes"; return 0; fi
  if [ ! -r /dev/tty ]; then say "no terminal to ask you on: set SYNTH_CONSENT=yes to consent without one"; return 1; fi
  printf 'Run the steps above on this machine? Type yes to agree: ' > /dev/tty
  read -r answer < /dev/tty || answer=no
  [ "$answer" = yes ]
}

sha_text() {
  if have sha256sum; then sha256sum | awk '{print $1}'
  elif have shasum; then shasum -a 256 | awk '{print $1}'
  elif have openssl; then openssl dgst -sha256 | awk '{print $NF}'
  else die "no program to compute a SHA-256"; fi
}

# the short authentication string from the first 8 hex characters of a hash: digits, or letters of the alphabet without look-alikes
code_of() {
  n=$((0x$(printf '%s' "$1" | cut -c1-8)))
  if [ "$PAIR_KIND" = digits ]; then
    mod=1; i=0
    while [ "$i" -lt "$PAIR_LEN" ]; do mod=$((mod * 10)); i=$((i + 1)); done
    # shellcheck disable=SC2059
    printf "%0${PAIR_LEN}d\n" $((n % mod))
  else
    out=; i=0; size=$(printf '%s' "$ALPHABET" | wc -c | tr -d ' ')
    while [ "$i" -lt "$PAIR_LEN" ]; do
      out="$out$(printf '%s' "$ALPHABET" | cut -c$((n % size + 1)))"
      n=$((n / size)); i=$((i + 1))
    done
    printf '%s\n' "$out"
  fi
}

sha_of() {
  if have sha256sum; then sha256sum "$1" | awk '{print $1}'
  elif have shasum; then shasum -a 256 "$1" | awk '{print $1}'
  elif have openssl; then openssl dgst -sha256 "$1" | awk '{print $NF}'
  else die "no program to compute a SHA-256"; fi
}

fetch() {
  if have curl; then curl -fsSL -o "$2" "$1"
  elif have wget; then wget -q -O "$2" "$1"
  else die "no curl or wget to download with"; fi
}

step_install_package() {
  installer=$1; name=$2; version=$3; url=$4; want=$5
  case "$url" in https://*) ;; *) die "a download is over https only" ;; esac
  dir=$(mktemp -d)
  file="$dir/$(basename "$url")"
  say "  download $name $version"
  fetch "$url" "$file"
  got=$(sha_of "$file")
  if [ "$got" != "$want" ]; then rm -rf "$dir"; die "the SHA-256 of $name does not match the plan: wanted $want, got $got"; fi
  say "  sha256 verified"
  case "$installer" in
  deb) as_root dpkg -i "$file" ;;
  rpm) as_root rpm -U --quiet "$file" ;;
  pkg) as_root installer -pkg "$file" -target / ;;
  *) rm -rf "$dir"; die "the installer $installer is not run by sh" ;;
  esac
  rm -rf "$dir"
}

step_authorize_key() {
  account=$1; algo=$2; blob=$3
  home=$(getent passwd "$account" 2>/dev/null | cut -d: -f6 || true)
  [ -n "$home" ] || die "no home directory for $account"
  as_root install -d -m 700 -o "$account" "$home/.ssh"
  as_root touch "$home/.ssh/authorized_keys"
  entry="$algo $blob"
  if ! as_root grep -qxF "$entry" "$home/.ssh/authorized_keys"; then
    printf '%s\n' "$entry" | as_root tee -a "$home/.ssh/authorized_keys" >/dev/null
  fi
  as_root chown "$account" "$home/.ssh/authorized_keys"
  as_root chmod 600 "$home/.ssh/authorized_keys"
}

step_ensure_account() {
  name=$1; sudo_wanted=$2
  if ! id "$name" >/dev/null 2>&1; then as_root useradd -m -s /bin/sh "$name"; fi
  if [ "$sudo_wanted" = sudo ]; then
    if getent group sudo >/dev/null 2>&1; then as_root usermod -aG sudo "$name"; else as_root usermod -aG wheel "$name"; fi
  fi
}

step_pin_controller() {
  host=$1; port=$2; algo=$3; blob=$4
  as_root install -d -m 755 "$DIR"
  if [ "$port" = 22 ]; then entry="$host $algo $blob"; else entry="[$host]:$port $algo $blob"; fi
  if ! as_root grep -qxF "$entry" "$DIR/known_hosts" 2>/dev/null; then
    printf '%s\n' "$entry" | as_root tee -a "$DIR/known_hosts" >/dev/null
  fi
}

keep_device_key() {
  as_root install -d -m 755 "$DIR"
  as_root install -m 600 "$KEY" "$DIR/device_key"
  as_root install -m 644 "$KEY.pub" "$DIR/device_key.pub"
}

step_run() {
  as=$1; expect=$2; argv=$3
  oldifs=$IFS
  set -f
  IFS=' '
  # shellcheck disable=SC2086
  set -- $argv
  IFS=$oldifs
  set +f
  rc=0
  if [ "$as" = root ]; then as_root "$@" || rc=$?; else "$@" || rc=$?; fi
  case ",$expect," in *",$rc,"*) return 0 ;; esac
  return 1
}

main() {
  tab=$(printf '\t')
  announce
  say ""
  have ssh-keygen || die "ssh-keygen is needed to make this machine's key"
  WORK=$(mktemp -d)
  trap 'rm -rf "$WORK"' EXIT
  KH="$WORK/known_hosts"
  KEY="$WORK/device_key"
  if [ -n "$HKALGO" ]; then
    if [ "$PORT" = 22 ]; then printf '%s %s %s\n' "$HOST" "$HKALGO" "$HKB64" > "$KH"; else printf '[%s]:%s %s %s\n' "$HOST" "$PORT" "$HKALGO" "$HKB64" > "$KH"; fi
    STRICT=yes
  else
    : > "$KH"
    STRICT=accept-new
    say "warning: this script holds no host key of the controller, so the first connection trusts what answers (trust on first use). On a network you do not trust, use the one-liner the controller prints."
  fi
  ssh-keygen -q -t ed25519 -N '' -C 'synth-device' -f "$KEY"
  devpub=$(awk '{print $1 " " $2}' "$KEY.pub")
  ssh_s status "$SESSION" < /dev/null > /dev/null
  observed=$(awk 'NR == 1 {print $2 " " $3}' "$KH")
  [ -n "$observed" ] || die "no host key was seen"
  nd=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
  cd=$(printf '%s\n%s\n%s\n%s' "$COMMIT_TAG" "$nd" "$devpub" "$observed" | sha_text)
  say "pairing: sending the commitment"
  reply=$(printf '{"type":"pair-commit","commit":"%s"}\n' "$cd" | ssh_s pair-commit "$SESSION")
  [ "${reply%%"$tab"*}" = COMMIT ] || die "the pairing was refused: $reply"
  cc=${reply#*"$tab"}
  reply=$(printf '{"type":"pair-reveal","nonce":"%s","devicePub":"%s","hostKey":"%s"}\n' "$nd" "$(js "$devpub")" "$(js "$observed")" | ssh_s pair-reveal "$SESSION") || die "the pairing was burned: a person must start again ($reply)"
  [ "${reply%%"$tab"*}" = REVEAL ] || die "the pairing was refused: $reply"
  rest=${reply#*"$tab"}
  nc=${rest%%"$tab"*}
  hk=${rest#*"$tab"}
  check=$(printf '%s\n%s\n%s' "$COMMIT_TAG" "$nc" "$hk" | sha_text)
  if [ "$check" != "$cc" ] || [ "$hk" != "$observed" ]; then die "the controller's answer does not match its commitment or the host key seen: a possible interception, stop here"; fi
  code=$(code_of "$(printf '%s\n%s\n%s\n%s\n%s' "$SAS_TAG" "$observed" "$devpub" "$nc" "$nd" | sha_text)")
  facts=$(facts_json)
  say "sending facts to $HOST:$PORT"
  printf '%s\n' "$facts" | ssh_s report "$SESSION" > /dev/null
  say ""
  say "Your pairing code is: $code"
  say "A person types it into the controller to approve this machine: synth enroll approve $SESSION --code $code"
  say "If the code the controller expects is another, stop: someone is between this machine and the controller."
  say ""
  say "waiting for a person to approve this machine (session $SESSION)"
  waited=0
  plan=$(mktemp)
  while :; do
    ssh_s next "$SESSION" < /dev/null > "$plan"
    head=$(head -n 1 "$plan")
    tag=${head%%"$tab"*}
    case "$tag" in
    PLAN) break ;;
    WAIT)
      [ "$waited" -lt "$WAIT_MAX" ] || { rm -f "$plan"; die "no decision within $WAIT_MAX seconds"; }
      sleep "$POLL"; waited=$((waited + POLL)) ;;
    REFUSED|EXPIRED|ENROLLED) say "the server says: $head"; rm -f "$plan"; exit 0 ;;
    *) rm -f "$plan"; die "an answer this script does not know: $tag" ;;
    esac
  done
  say "approved. The plan:"
  while IFS=$tab read -r tag kind f1 f2 f3 f4 f5; do
    [ "$tag" = STEP ] || continue
    for v in "$kind" "$f1" "$f2" "$f3" "$f4" "$f5"; do [ -z "$v" ] || safe "$v"; done
    case "$kind" in
    install-package) say "  install $f2 $f3 ($f1) from $f4" ;;
    authorize-key) say "  authorize a $f2 key for the account $f1" ;;
    ensure-account) say "  make sure the account $f1 exists ($f2)" ;;
    run) say "  run as $f1: $f3" ;;
    pin-controller) say "  remember the host key of the controller $f1:$f2" ;;
    *) die "a step this script does not know: $kind" ;;
    esac
  done < "$plan"
  if ask_consent; then
    printf '{"type":"consent","granted":true}\n' | ssh_s report "$SESSION" > /dev/null
  else
    printf '{"type":"consent","granted":false}\n' | ssh_s report "$SESSION" > /dev/null
    rm -f "$plan"
    say "declined: nothing was installed"
    exit 0
  fi
  results=
  index=0
  failed=false
  while IFS=$tab read -r tag kind f1 f2 f3 f4 f5; do
    [ "$tag" = STEP ] || continue
    say "step $index: $kind"
    ok=true
    case "$kind" in
    install-package) (step_install_package "$f1" "$f2" "$f3" "$f4" "$f5") || ok=false ;;
    authorize-key) (step_authorize_key "$f1" "$f2" "$f3") || ok=false ;;
    ensure-account) (step_ensure_account "$f1" "$f2") || ok=false ;;
    run) (step_run "$f1" "$f2" "$f3") || ok=false ;;
    pin-controller) (step_pin_controller "$f1" "$f2" "$f3" "$f4") || ok=false ;;
    esac
    [ "$ok" = true ] || failed=true
    results="$results${results:+,}{\"index\":$index,\"ok\":$ok,\"detail\":\"$kind\"}"
    index=$((index + 1))
    [ "$failed" = false ] || break
  done < "$plan"
  rm -f "$plan"
  if [ "$failed" = false ]; then (keep_device_key) || failed=true; fi
  if [ "$failed" = true ]; then okjson=false; else okjson=true; fi
  printf '{"type":"result","ok":%s,"steps":[%s]}\n' "$okjson" "$results" | ssh_s "done" "$SESSION" > /dev/null
  if [ "$failed" = true ]; then die "a step failed: see above"; fi
  say "done: this machine is enrolled"
}

main "$@"
