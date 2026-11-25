// Spec: 0002-cloud-init-dialect FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The unattended install of one machine, as Ubuntu's installer reads it: the autoinstall configuration (a `#cloud-config` document, JSON being valid YAML), its meta-data, the blank-disk guard that runs before any disk is touched, and the
 * first-boot script that hands the machine to its signed repository. The secret an install needs (the hash of the administrator's password) is never in what is rendered: a placeholder stands for it, and the boot server puts it in when it serves the file. What the machine
 * does after it first boots is the pull of the approved tip: it clones the fleet repository, runs nothing unless the tip is signed by one of the fleet's signers, and converges itself with the playbook the repository holds (the Ansible dialect's render).
 *
 * @example
 * ```ts
 * import { metaData } from "./install.ts";
 * metaData({ hostname: "synthetic-server-01" }); // "instance-id: archon-synthetic-server-01\nlocal-hostname: synthetic-server-01\n"
 * ```
 *
 * @module
 */

/** What stands for the administrator's password hash in a rendered file; the boot server replaces it when it serves the file. */
export const PASSWORD_PLACEHOLDER = "@archon:password-hash@";

/** The disk an install writes to: the largest one, or the one at a path, with the layout of the installer. */
export type DiskSpec = { readonly match: "largest" | string; readonly layout: "lvm" | "direct" | "zfs" };

/** Everything the install of one machine is made from. */
export type InstallSpec = {
  readonly hostname: string;
  readonly fleet: string;
  readonly admin: { readonly user: string; readonly realname: string; readonly sshKeys: readonly string[] };
  readonly locale: string;
  readonly keyboard: string;
  readonly timezone: string;
  readonly disk?: DiskSpec;
  /** The MAC of the network port to use; every wired port where none is given. */
  readonly mac?: string;
  /** Packages the installer adds. */
  readonly packages?: readonly string[];
  /** Where the machine's signed repository is, which branch, and the folder of the repository that holds its rendered playbook. */
  readonly repository: { readonly url: string; readonly branch: string; readonly renderPath: string };
  /** The signers the machine trusts from its first boot, as the text of an `allowed_signers` file. */
  readonly allowedSigners: string;
  /** The boot server's URL for this install, ending in a slash. */
  readonly base: string;
  readonly proxy?: string;
};

const DEFAULT_DISK: DiskSpec = { match: "largest", layout: "lvm" };

/** The cloud-init meta-data. */
export function metaData(spec: Pick<InstallSpec, "hostname">): string {
  return `instance-id: archon-${spec.hostname}\nlocal-hostname: ${spec.hostname}\n`;
}

/**
 * The script that converges the machine from its signed repository, run at first boot and then on a timer: it gets the repository at its branch, runs nothing unless the tip is signed by one of the signers in `/etc/archon/allowed_signers`, and runs
 * the playbook the repository holds for this machine. Shell, because nothing else is on the machine yet; it needs only git, ssh-keygen and ansible-core, which first boot installs from Ubuntu's archive.
 */
export function convergeScript(spec: Pick<InstallSpec, "repository" | "base">): string {
  const r = spec.repository;
  return `#!/bin/sh
# archon: converge this machine from its signed repository (rendered by archon; never edit by hand).
set -eu
mkdir -p /var/log
exec >>/var/log/archon-converge.log 2>&1
echo "== archon converge $(date -Is)"
say() { [ -f /etc/archon/boot-events ] && curl -fsS --noproxy "*" -m 5 -X POST -H 'content-type: application/json' -d "{\\"origin\\":\\"archon\\",\\"phase\\":\\"Converge\\",\\"level\\":\\"$1\\",\\"summary\\":\\"$2\\"}" "$(cat /etc/archon/boot-events)" >/dev/null 2>&1 || true; }
export DEBIAN_FRONTEND=noninteractive
[ -f /etc/archon/proxy.env ] && . /etc/archon/proxy.env
need=""
for c in git ssh-keygen ansible-playbook; do command -v "$c" >/dev/null 2>&1 || need=1; done
if [ -n "$need" ]; then say info "installing git, openssh-client and ansible-core"; apt-get update -q && apt-get install -y -q git openssh-client ansible-core; fi
REPO=/srv/archon
if [ ! -d "$REPO/.git" ]; then
  git clone -q -b ${sh(r.branch)} ${sh(r.url)} "$REPO"
else
  git -C "$REPO" fetch -q origin ${sh(r.branch)} && git -C "$REPO" reset -q --hard FETCH_HEAD
fi
if ! git -C "$REPO" -c gpg.format=ssh -c gpg.ssh.program=ssh-keygen -c gpg.ssh.allowedSignersFile=/etc/archon/allowed_signers verify-commit HEAD >/dev/null 2>&1; then
  say fail "the repository tip is not signed by a fleet signer: nothing was run"
  echo "archon: $REPO HEAD is not signed by a fleet signer; refusing to run it" >&2
  exit 1
fi
D="$REPO/${r.renderPath}"
[ -f "$D/playbook.yml" ] || { say fail "the signed tip has no rendered playbook at ${r.renderPath}"; echo "archon: no playbook at $D" >&2; exit 1; }
say info "converging from the signed tip $(git -C "$REPO" rev-parse --short HEAD)"
ANSIBLE_CONFIG="$D/ansible.cfg" ansible-playbook -i "$D/inventory.yml" "$D/playbook.yml"
say ok "converged"
`;
}

/** A word of a shell script, quoted so that nothing in it is read as anything but text. */
function sh(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

const FIRST_BOOT_SERVICE = (): string => `[Unit]
Description=Archon: converge this machine from its signed repository
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/archon-converge
`;

const FIRST_BOOT_TIMER = (): string => `[Unit]
Description=Archon: converge every fifteen minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=15min
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
`;

/** The `user-data` of the installed system: the files the first boot needs, and the first boot. */
function userDataOf(spec: InstallSpec): Record<string, unknown> {
  const files: Array<Record<string, string>> = [
    { path: "/etc/archon/host", content: `${spec.hostname}\n`, permissions: "0644" },
    { path: "/etc/archon/fleet", content: `${spec.fleet}\n`, permissions: "0644" },
    { path: "/etc/archon/allowed_signers", content: spec.allowedSigners.endsWith("\n") ? spec.allowedSigners : `${spec.allowedSigners}\n`, permissions: "0644" },
    { path: "/etc/archon/boot-events", content: `${spec.base}event\n`, permissions: "0644" },
    { path: "/usr/local/sbin/archon-converge", content: convergeScript(spec), permissions: "0755" },
    { path: "/etc/systemd/system/archon-converge.service", content: FIRST_BOOT_SERVICE(), permissions: "0644" },
    { path: "/etc/systemd/system/archon-converge.timer", content: FIRST_BOOT_TIMER(), permissions: "0644" },
  ];
  if (spec.proxy !== undefined) files.push({ path: "/etc/archon/proxy.env", content: `export http_proxy=${spec.proxy} https_proxy=${spec.proxy} HTTP_PROXY=${spec.proxy} HTTPS_PROXY=${spec.proxy}\n`, permissions: "0644" });
  return {
    write_files: files,
    runcmd: [["/usr/local/sbin/archon-converge"], ["systemctl", "daemon-reload"], ["systemctl", "enable", "--now", "archon-converge.timer"]],
  };
}

/** The autoinstall configuration of a machine, as a `#cloud-config` document. The password hash is the placeholder unless it is given (by the boot server, at the moment it serves the file). */
export function autoinstall(spec: InstallSpec, passwordHash: string = PASSWORD_PLACEHOLDER): string {
  const disk = spec.disk ?? DEFAULT_DISK;
  const config = {
    autoinstall: {
      version: 1,
      "early-commands": [`curl -fsS --noproxy "*" -m 30 -o /tmp/archon-guard.sh ${spec.base}guard.sh && sh /tmp/archon-guard.sh ${spec.base} || { echo "archon: the blank-disk guard could not run: nothing was erased" | tee /dev/console; sleep 30; poweroff -f; }`],
      locale: spec.locale,
      keyboard: { layout: spec.keyboard },
      timezone: spec.timezone,
      ...(spec.proxy === undefined ? {} : { proxy: spec.proxy }),
      network: { version: 2, ethernets: { uplink: { match: spec.mac === undefined ? { name: "en*" } : { macaddress: spec.mac }, dhcp4: true, dhcp6: true } } },
      identity: { hostname: spec.hostname, username: spec.admin.user, realname: spec.admin.realname, password: passwordHash },
      ssh: { "install-server": true, "allow-pw": false, "authorized-keys": [...spec.admin.sshKeys] },
      ...(spec.packages === undefined || spec.packages.length === 0 ? {} : { packages: [...spec.packages] }),
      storage: { layout: { name: disk.layout, match: disk.match === "largest" ? { size: "largest" } : { path: disk.match } } },
      updates: "security",
      shutdown: "reboot",
      reporting: { archon: { type: "webhook", endpoint: `${spec.base}event` } },
      "late-commands": [`curl -fsS --noproxy "*" -X POST ${spec.base}done || true`],
      "user-data": userDataOf(spec),
    },
  };
  return `#cloud-config\n${JSON.stringify(config, null, 2)}\n`;
}
