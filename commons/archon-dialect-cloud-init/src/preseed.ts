// Spec: 0003-preseed-dialect FR-001, FR-002, FR-003, FR-004
/**
 * The unattended install of one machine, as Debian's installer reads it: a preseed file made from the same facts as the Ubuntu autoinstall (`InstallSpec`), so that a requirement states an install once and each installer gets its own words. The secret is never in
 * what is rendered: a placeholder stands for the hash of the administrator's password, and the boot server puts it in when it serves the file. After the install the machine is handed to its signed repository exactly as an Ubuntu one is: the same files, the same converge script and the
 * same timer are written to the new system.
 *
 * The installer's own environment has neither `curl` nor `lsblk`, so the blank-disk guard cannot run in it: a Debian install erases the disk it picks (the largest one, or the one named), which the boot command says when it arms the asset.
 *
 * @example
 * ```ts
 * import { preseed } from "./preseed.ts";
 * // preseed(spec).includes("d-i passwd/root-login boolean false"); // true for any spec
 * ```
 *
 * @module
 */
import { convergeScript, PASSWORD_PLACEHOLDER, type InstallSpec } from "./install.ts";

const SERVICE = `[Unit]
Description=Archon: converge this machine from its signed repository
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/archon-converge
`;

const TIMER = `[Unit]
Description=Archon: converge every fifteen minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=15min
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
`;

/** The files the first boot needs, by path, with their mode. The same as the Ubuntu install writes. */
export function firstBootFiles(spec: InstallSpec): ReadonlyArray<{ readonly path: string; readonly content: string; readonly mode: string }> {
  const files = [
    { path: "/etc/archon/host", content: `${spec.hostname}\n`, mode: "0644" },
    { path: "/etc/archon/fleet", content: `${spec.fleet}\n`, mode: "0644" },
    { path: "/etc/archon/allowed_signers", content: spec.allowedSigners.endsWith("\n") ? spec.allowedSigners : `${spec.allowedSigners}\n`, mode: "0644" },
    { path: "/etc/archon/boot-events", content: `${spec.base}event\n`, mode: "0644" },
    { path: "/usr/local/sbin/archon-converge", content: convergeScript(spec), mode: "0755" },
    { path: "/etc/systemd/system/archon-converge.service", content: SERVICE, mode: "0644" },
    { path: "/etc/systemd/system/archon-converge.timer", content: TIMER, mode: "0644" },
  ];
  if (spec.proxy !== undefined) files.push({ path: "/etc/archon/proxy.env", content: `export http_proxy=${spec.proxy} https_proxy=${spec.proxy} HTTP_PROXY=${spec.proxy} HTTPS_PROXY=${spec.proxy}\n`, mode: "0644" });
  return files;
}

/** The late command that writes the files into the new system and enables the timer: base64 carries the content past the preseed's line syntax. */
function lateCommand(spec: InstallSpec): string {
  const steps = firstBootFiles(spec).map((f) => `mkdir -p /target${f.path.slice(0, f.path.lastIndexOf("/"))}; echo ${Buffer.from(f.content).toString("base64")} | base64 -d > /target${f.path}; chmod ${f.mode} /target${f.path}`);
  steps.push(`wget -q -O /dev/null --post-data= ${spec.base}done || true`);
  steps.push("in-target systemctl enable archon-converge.timer");
  return steps.join("; ");
}

/** The partition command that picks the disk: the largest, or the one at a path. */
function diskCommand(spec: InstallSpec): string {
  const d = spec.disk?.match ?? "largest";
  if (d !== "largest") return `debconf-set partman-auto/disk ${d}`;
  return `d=$(list-devices disk | while read p; do s=$(cat /sys/block/\${p##*/}/size 2>/dev/null || echo 0); echo "$s $p"; done | sort -rn | head -n 1 | cut -d' ' -f2); debconf-set partman-auto/disk "$d"`;
}

/**
 * The preseed of a machine. The password hash is the placeholder unless it is given (by the boot server, at the moment it serves the file).
 * `direct` is the plain layout, `lvm` puts the system on logical volumes; ZFS is not an option of Debian's installer and is refused by the dialect.
 */
export function preseed(spec: InstallSpec, passwordHash: string = PASSWORD_PLACEHOLDER): string {
  const layout = spec.disk?.layout ?? "lvm";
  const lines = [
    `d-i debian-installer/locale string ${spec.locale}`,
    `d-i keyboard-configuration/xkb-keymap select ${spec.keyboard}`,
    "d-i netcfg/choose_interface select auto",
    `d-i netcfg/get_hostname string ${spec.hostname}`,
    "d-i netcfg/get_domain string",
    "d-i mirror/country string manual",
    "d-i mirror/protocol string https",
    "d-i mirror/https/hostname string deb.debian.org",
    "d-i mirror/https/directory string /debian",
    `d-i mirror/https/proxy string ${spec.proxy ?? ""}`,
    "d-i passwd/root-login boolean false",
    `d-i passwd/user-fullname string ${spec.admin.realname}`,
    `d-i passwd/username string ${spec.admin.user}`,
    `d-i passwd/user-password-crypted password ${passwordHash}`,
    "d-i clock-setup/utc boolean true",
    `d-i time/zone string ${spec.timezone}`,
    `d-i partman/early_command string ${diskCommand(spec)}`,
    `d-i partman-auto/method string ${layout === "lvm" ? "lvm" : "regular"}`,
    ...(layout === "lvm" ? ["d-i partman-lvm/device_remove_lvm boolean true", "d-i partman-lvm/confirm boolean true", "d-i partman-lvm/confirm_nooverwrite boolean true", "d-i partman-auto-lvm/guided_size string max"] : []),
    "d-i partman-md/device_remove_md boolean true",
    "d-i partman-auto/choose_recipe select atomic",
    "d-i partman-partitioning/confirm_write_new_label boolean true",
    "d-i partman/choose_partition select finish",
    "d-i partman/confirm boolean true",
    "d-i partman/confirm_nooverwrite boolean true",
    "tasksel tasksel/first multiselect standard, ssh-server",
    `d-i pkgsel/include string ${["curl", "git", "openssh-server", "openssh-client", "ansible-core", ...(spec.packages ?? [])].join(" ")}`,
    "d-i pkgsel/upgrade select safe-upgrade",
    "popularity-contest popularity-contest/participate boolean false",
    "d-i grub-installer/only_debian boolean true",
    "d-i grub-installer/with_other_os boolean false",
    "d-i grub-installer/bootdev string default",
    `d-i preseed/late_command string ${keyCommands(spec)}; ${lateCommand(spec)}`,
    "d-i finish-install/reboot_in_progress note",
  ];
  return `${lines.join("\n")}\n`;
}

/** The late commands that give the administrator the keys and turn password sign-in off, which the preseed has no question for. */
export function keyCommands(spec: InstallSpec): string {
  const keys = Buffer.from(`${spec.admin.sshKeys.join("\n")}\n`).toString("base64");
  const home = `/target/home/${spec.admin.user}`;
  return `mkdir -p ${home}/.ssh; echo ${keys} | base64 -d > ${home}/.ssh/authorized_keys; chmod 700 ${home}/.ssh; chmod 600 ${home}/.ssh/authorized_keys; in-target chown -R ${spec.admin.user}:${spec.admin.user} /home/${spec.admin.user}/.ssh; mkdir -p /target/etc/ssh/sshd_config.d; echo 'PasswordAuthentication no' > /target/etc/ssh/sshd_config.d/10-archon.conf`;
}
