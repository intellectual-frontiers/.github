// Spec: 0004-kickstart-dialect FR-001, FR-002, FR-003, FR-004
/**
 * The unattended install of one machine, as the installer of the Red Hat family (Anaconda) reads it: a Kickstart file made from the same facts as the Ubuntu autoinstall and the Debian preseed (`InstallSpec`). The secret is never in what is rendered: a placeholder stands for the hash of the
 * administrator's password, and the boot server puts it in when it serves the file. After the install the machine is handed to its signed repository exactly as the others are: the same files, the same converge script and the same timer are written to the new system.
 *
 * Anaconda's environment has neither `curl` nor `lsblk`, so the blank-disk guard cannot run in it: the install erases the disk it picks.
 *
 * @example
 * ```ts
 * import { kickstart } from "./kickstart.ts";
 * // kickstart(spec).includes("rootpw --lock"); // true for any spec
 * ```
 *
 * @module
 */
import { PASSWORD_PLACEHOLDER, type InstallSpec } from "./install.ts";
import { firstBootFiles } from "./preseed.ts";

/** The `%pre` section that picks the disk, and the line that includes its answer: the largest disk, or the one at a path. */
function diskPick(spec: InstallSpec): { readonly pre: string; readonly include: string } {
  const d = spec.disk?.match ?? "largest";
  const name = d === "largest" ? "" : d.replace(/^\/dev\//, "");
  const pre = d === "largest"
    ? `%pre --interpreter=/bin/sh
# the largest disk, by size in sectors
d=$(for b in /sys/block/*; do n=\${b##*/}; case $n in loop*|ram*|zram*|sr*|dm-*|md*) continue ;; esac; echo "$(cat $b/size) $n"; done | sort -rn | head -n 1 | cut -d' ' -f2)
echo "ignoredisk --only-use=$d" > /tmp/archon-disk.ks
echo "clearpart --all --initlabel --drives=$d" >> /tmp/archon-disk.ks
%end`
    : `%pre --interpreter=/bin/sh
echo "ignoredisk --only-use=${name}" > /tmp/archon-disk.ks
echo "clearpart --all --initlabel --drives=${name}" >> /tmp/archon-disk.ks
%end`;
  return { pre, include: "%include /tmp/archon-disk.ks" };
}

/**
 * The Kickstart of a machine. The password hash is the placeholder unless it is given (by the boot server, at the moment it serves the file). `lvm` is Anaconda's logical volumes, `direct` plain partitions; ZFS is not an option of the installer.
 * `repository` is where the installer finds its packages, as the profile's command line says it.
 */
export function kickstart(spec: InstallSpec, passwordHash: string = PASSWORD_PLACEHOLDER, repository = "https://download.rockylinux.org/pub/rocky/9/BaseOS/x86_64/os/"): string {
  const layout = spec.disk?.layout ?? "lvm";
  const pick = diskPick(spec);
  const home = spec.admin.user;
  const post = [
    ...firstBootFiles(spec).flatMap((f) => [`mkdir -p ${f.path.slice(0, f.path.lastIndexOf("/"))}`, `echo ${Buffer.from(f.content).toString("base64")} | base64 -d > ${f.path}`, `chmod ${f.mode} ${f.path}`]),
    "mkdir -p /etc/ssh/sshd_config.d",
    "echo 'PasswordAuthentication no' > /etc/ssh/sshd_config.d/10-archon.conf",
    "systemctl enable archon-converge.timer",
    `curl -fsS -X POST ${spec.base}done || true`,
  ];
  return [
    "text",
    "reboot",
    `lang ${spec.locale}`,
    `keyboard --vckeymap=${spec.keyboard} --xlayouts='${spec.keyboard}'`,
    `timezone ${spec.timezone} --utc`,
    `network --bootproto=dhcp --hostname=${spec.hostname} --activate`,
    "rootpw --lock",
    `user --name=${home} --gecos="${spec.admin.realname.replace(/"/g, "")}" --groups=wheel --iscrypted --password=${passwordHash}`,
    ...spec.admin.sshKeys.map((k) => `sshkey --username=${home} "${k}"`),
    `url --url=${repository}${spec.proxy === undefined ? "" : ` --proxy=${spec.proxy}`}`,
    `repo --name=AppStream --baseurl=${repository.replace("/BaseOS/", "/AppStream/")}${spec.proxy === undefined ? "" : ` --proxy=${spec.proxy}`}`,
    "zerombr",
    pick.include,
    "bootloader --location=mbr",
    layout === "lvm" ? "autopart --type=lvm" : "autopart --type=plain",
    "firewall --enabled --ssh",
    "selinux --enforcing",
    "services --enabled=sshd",
    "",
    pick.pre,
    "",
    "%packages",
    "@^minimal-environment",
    ...["curl", "git", "openssh-server", "openssh-clients", "ansible-core", ...(spec.packages ?? [])],
    "%end",
    "",
    "%post --log=/root/archon-ks-post.log",
    ...post,
    "%end",
    "",
  ].join("\n");
}
