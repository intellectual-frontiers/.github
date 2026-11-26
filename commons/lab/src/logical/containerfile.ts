// Spec: 0002-lab-machine FR-002, FR-003
// Spec: 0003-lab-arch-family FR-002, FR-003, FR-004
/**
 * A machine description read, and the Containerfile made from it: a release of Ubuntu with systemd as the first process, sshd as a service (not socket-activated, so that its port is the one it is given), the users with their
 * home folders, the time zone, and the packages from the release's own archive. No key and no secret is in the file: keys are made for each run and put in when the machine starts.
 *
 * @example
 * ```ts
 * import { containerfile, readMachineSpec } from "./containerfile.ts";
 * const spec = readMachineSpec({ name: "synthetic-server-02", image: "ubuntu:24.04", users: [{ name: "admin", sudo: true }], packages: [] });
 * spec.kind === "ok" && containerfile(spec.value).startsWith("FROM ubuntu:24.04"); // true
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { BASE_IMAGES, imageFamily, type InitMode, type MachineSpec } from "@intellectual-frontiers/lab/governance";

const NAME = /^[a-z][a-z0-9-]{0,29}$/;
const USER = /^[a-z][a-z0-9_-]{0,31}$/;
const PACKAGE = /^[a-z0-9][a-z0-9+.-]*$/;
const ZONE = /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z_+-]+){1,2})$/;

/** A machine description from data, or every reason it is not one: names of a lower case letter then lower case letters, digits and hyphens, a base image there is, users that are account names, packages that are names of the archive, a time zone of the form area/location. */
export function readMachineSpec(input: unknown): Result<MachineSpec, readonly string[]> {
  const problems: string[] = [];
  const o = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const name = o["name"];
  if (typeof name !== "string" || !NAME.test(name)) problems.push("the name is a lower case letter then lower case letters, digits and hyphens, at most 30");
  const image = o["image"];
  if (!(BASE_IMAGES as readonly unknown[]).includes(image)) problems.push(`the image is one of ${BASE_IMAGES.join(", ")}`);
  const users = Array.isArray(o["users"]) ? o["users"] : undefined;
  if (users === undefined || users.length === 0) problems.push("a machine has at least one user");
  const parsedUsers = (users ?? []).map((u: unknown) => {
    const r = typeof u === "object" && u !== null ? (u as Record<string, unknown>) : {};
    if (typeof r["name"] !== "string" || !USER.test(r["name"]) || r["name"] === "root" || typeof r["sudo"] !== "boolean") {
      problems.push(`${JSON.stringify(u)} is not a user: a name that is not root, and whether it has sudo`);
      return undefined;
    }
    return { name: r["name"], sudo: r["sudo"] };
  });
  const names = parsedUsers.flatMap((u) => (u === undefined ? [] : [u.name]));
  if (new Set(names).size !== names.length) problems.push("a user is named once");
  const packages = Array.isArray(o["packages"]) ? o["packages"] : [];
  for (const p of packages) if (typeof p !== "string" || !PACKAGE.test(p)) problems.push(`${JSON.stringify(p)} is not the name of a package`);
  const timezone = o["timezone"];
  if (timezone !== undefined && (typeof timezone !== "string" || !ZONE.test(timezone))) problems.push("the time zone is UTC or of the form area/location");
  const init = o["init"];
  if (init !== undefined && init !== "systemd" && init !== "none") problems.push("init is systemd or none");
  if (init !== undefined && (BASE_IMAGES as readonly unknown[]).includes(image) && imageFamily(image as MachineSpec["image"]) !== "arch") problems.push("init is said only for the family arch");
  if (problems.length > 0) return err(problems);
  return ok({
    name: name as string,
    image: image as MachineSpec["image"],
    users: parsedUsers.flatMap((u) => (u === undefined ? [] : [u])),
    packages: packages as string[],
    ...(timezone === undefined ? {} : { timezone: timezone as string }),
    ...(init === undefined ? {} : { init: init as InitMode }),
  });
}

/** The line that installs the packages with dnf: where the builder gives a secret `ca`, the install trusts it too, and the file is removed in the same layer; the status of the install is the status of the line, so that a failed install fails the build there and not at a later step. */
const RHEL_INSTALL = (packages: string): string =>
  "RUN --mount=type=secret,id=ca,required=false sh -c 'O=\"\"; if [ -r /run/secrets/ca ]; then cat /etc/pki/tls/certs/ca-bundle.crt /run/secrets/ca > /tmp/ca.pem; O=\"--setopt=sslcacert=/tmp/ca.pem\"; fi; dnf -y $O install --setopt=install_weak_deps=False " + packages + " && dnf clean all; R=$?; rm -f /tmp/ca.pem; exit $R'";

/** The line that installs the packages with pacman (0003-lab-arch-family FR-003): where the builder gives a secret `ca` it is trusted for the install through the system's own anchors and removed, and trust made again, in the same layer; `--disable-sandbox` only where the builder's kernel lists no Landlock. */
const ARCH_INSTALL = (packages: string): string =>
  "RUN --mount=type=secret,id=ca,required=false sh -c 'A=/etc/ca-certificates/trust-source/anchors/lab-ca.crt; if [ -r /run/secrets/ca ]; then cp /run/secrets/ca $A && update-ca-trust; fi; S=\"\"; grep -qw landlock /sys/kernel/security/lsm 2>/dev/null || S=--disable-sandbox; pacman $S -Syu --noconfirm --needed " + packages + "; R=$?; rm -f $A; update-ca-trust; exit $R'";

/** The tag of an image: its name and the hash of the text; for the family `arch` also the digest of the base image it was made on, because the tag `latest` moves (0003-lab-arch-family FR-002). */
export async function imageTag(spec: MachineSpec, text: string, baseDigest?: string): Promise<string> {
  const identity = imageFamily(spec.image) === "arch" ? `${text}\nbase ${baseDigest ?? ""}` : text;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return `lab-${spec.name}:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16)}`;
}

/** The program that is the main process of a machine of the family `arch` with `init: "none"`: the SSH server in the foreground, logging to the standard error. */
export const ARCH_NONE_COMMAND: readonly string[] = ["/usr/bin/sshd", "-D", "-e"];

/** The Containerfile of a machine: the same text for the same description, so that an image is made once and found again by the hash of its text. The RHEL family installs through a build secret `ca` where the builder has one (a network that inspects TLS: the certificate is read for the install and is in no layer). The lines differ by the family of the image (apt and `ssh` on Debian and Ubuntu, dnf and `sshd` on the RHEL family); the rest is the same. */
export function containerfile(spec: MachineSpec): string {
  const family = imageFamily(spec.image);
  const rhel = family === "rhel";
  const base =
    family === "arch"
      ? ["systemd", "openssh", "sudo", "iproute2", "tzdata", "ca-certificates"]
      : rhel
        ? ["systemd", "dbus-daemon", "openssh-server", "sudo", "tzdata", "glibc-langpack-en", "ca-certificates", "iproute", "python3", "shadow-utils"]
        : ["systemd", "systemd-sysv", "dbus", "openssh-server", "sudo", "tzdata", "locales", "ca-certificates", "iproute2"];
  const packages = [...new Set([...base, ...spec.packages])].sort().join(" ");
  const head =
    family === "arch"
      ? [`FROM ${spec.image}`, ARCH_INSTALL(packages), "RUN ssh-keygen -A && systemctl enable sshd.service"]
      : rhel
        ? [`FROM ${spec.image}`, RHEL_INSTALL(packages), "RUN ssh-keygen -A && systemctl disable sshd.socket 2>/dev/null; systemctl enable sshd.service"]
        : [`FROM ${spec.image}`, "ENV DEBIAN_FRONTEND=noninteractive", `RUN apt-get update && apt-get install -y --no-install-recommends ${packages} && rm -rf /var/lib/apt/lists/*`, "RUN ssh-keygen -A && mkdir -p /run/sshd && systemctl disable ssh.socket 2>/dev/null; systemctl enable ssh.service"];
  const lines = [...head];
  if (spec.timezone !== undefined) lines.push(`RUN ln -sf /usr/share/zoneinfo/${spec.timezone} /etc/localtime && echo ${spec.timezone} > /etc/timezone`);
  for (const u of spec.users) {
    lines.push(`RUN (id ${u.name} >/dev/null 2>&1 || useradd -m -s /bin/bash ${u.name})${u.sudo ? ` && echo '${u.name} ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/90-${u.name} && chmod 0440 /etc/sudoers.d/90-${u.name}` : ""}`);
  }
  if (family === "arch" && spec.init === "none") lines.push(`CMD ${JSON.stringify(ARCH_NONE_COMMAND)}`, "");
  else lines.push("STOPSIGNAL SIGRTMIN+3", rhel ? 'CMD ["/usr/sbin/init"]' : 'CMD ["/sbin/init"]', "");
  return lines.join("\n");
}
