// Spec: 0002-lab-machine FR-002, FR-003
/**
 * A machine description read, and the Containerfile made from it: a release of Ubuntu with systemd as the first process, sshd as a service (not socket-activated, so that its port is the one it is given), the users with their
 * home folders, the time zone, and the packages from the release's own archive. No key and no secret is in the file: keys are made for each run and put in when the machine starts.
 *
 * @example
 * ```ts
 * import { containerfile, readMachineSpec } from "./containerfile.ts";
 * const spec = readMachineSpec({ name: "athens", image: "ubuntu:24.04", users: [{ name: "admin", sudo: true }], packages: [] });
 * spec.kind === "ok" && containerfile(spec.value).startsWith("FROM ubuntu:24.04"); // true
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { MachineSpec } from "@intellectual-frontiers/lab/governance";

const NAME = /^[a-z][a-z0-9-]{0,29}$/;
const USER = /^[a-z][a-z0-9_-]{0,31}$/;
const PACKAGE = /^[a-z0-9][a-z0-9+.-]*$/;
const ZONE = /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z_+-]+){1,2})$/;

/** A machine description from data, or every reason it is not one: names that are lower case words, a base image there is, users that are account names, packages that are names of the archive, a time zone of the form area/location. */
export function readMachineSpec(input: unknown): Result<MachineSpec, readonly string[]> {
  const problems: string[] = [];
  const o = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const name = o["name"];
  if (typeof name !== "string" || !NAME.test(name)) problems.push("the name is a lower case letter then lower case letters, digits and hyphens, at most 30");
  const image = o["image"];
  if (image !== "ubuntu:24.04" && image !== "ubuntu:26.04") problems.push("the image is ubuntu:24.04 or ubuntu:26.04");
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
  if (problems.length > 0) return err(problems);
  return ok({
    name: name as string,
    image: image as MachineSpec["image"],
    users: parsedUsers.flatMap((u) => (u === undefined ? [] : [u])),
    packages: packages as string[],
    ...(timezone === undefined ? {} : { timezone: timezone as string }),
  });
}

/** The Containerfile of a machine: the same text for the same description, so that an image is made once and found again by the hash of its text. */
export function containerfile(spec: MachineSpec): string {
  const packages = ["systemd", "systemd-sysv", "dbus", "openssh-server", "sudo", "tzdata", "locales", "ca-certificates", "iproute2", ...spec.packages];
  const lines = [
    `FROM ${spec.image}`,
    "ENV DEBIAN_FRONTEND=noninteractive",
    `RUN apt-get update && apt-get install -y --no-install-recommends ${[...new Set(packages)].sort().join(" ")} && rm -rf /var/lib/apt/lists/*`,
    "RUN ssh-keygen -A && mkdir -p /run/sshd && systemctl disable ssh.socket 2>/dev/null; systemctl enable ssh.service",
    ...(spec.timezone === undefined ? [] : [`RUN ln -sf /usr/share/zoneinfo/${spec.timezone} /etc/localtime && echo ${spec.timezone} > /etc/timezone`]),
  ];
  for (const u of spec.users) {
    lines.push(`RUN (id ${u.name} >/dev/null 2>&1 || useradd -m -s /bin/bash ${u.name})${u.sudo ? ` && echo '${u.name} ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/90-${u.name} && chmod 0440 /etc/sudoers.d/90-${u.name}` : ""}`);
  }
  lines.push("STOPSIGNAL SIGRTMIN+3", 'CMD ["/sbin/init"]', "");
  return lines.join("\n");
}
