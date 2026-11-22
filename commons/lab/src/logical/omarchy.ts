// Spec: 0003-lab-arch-family FR-008, FR-009, FR-010
/**
 * The virtual machine of Omarchy, as pure data and text: the manifest the project publishes read and checked (`latest.json`: the image's address, its SHA-256, the folder of the unpacked kernel and initrd), the sums of those files read,
 * the differences from what was fetched named, the credential that hands a key in through the firmware tables, and the argument vector of the emulator (hardware acceleration where there is `/dev/kvm`, software emulation where not).
 * Nothing here runs anything.
 *
 * @example
 * ```ts
 * import { qemuArgv } from "./omarchy.ts";
 * qemuArgv({ accel: "tcg", cpus: 4, memory: "6G", dir: "/c", overlay: "/s/run.qcow2", cmdline: "root=x", credential: "e30=", port: 22022, qmp: "/s/qmp.sock", pidfile: "/s/qemu.pid", uuid: "u", serial: "/s/serial.log" })[0]; // "qemu-system-x86_64"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The address of the manifest of the stable channel. */
export const OMARCHY_MANIFEST_URL = "https://nightly.omarchy.org/stable/latest.json";

/** The files of the unpacked folder that the machine needs, each with its sum in `SHA256SUMS`. */
export const UNPACKED_FILES = ["vmlinuz", "initrd", "cmdline"] as const;

/** What the manifest says of the virtual machine image of a release. */
export type OmarchyImage = {
  readonly version: string;
  readonly url: string;
  readonly sha256: string;
  readonly size: number;
  /** The folder (with a final slash) the kernel, the initrd and the command line are in, with `SHA256SUMS`. */
  readonly unpacked: string;
  readonly user: string;
  /** The password of the published image for `sudo` (the manifest says it; SSH takes keys only), or nothing. */
  readonly password: string | undefined;
};

const HEX64 = /^[0-9a-f]{64}$/;
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** The image of a manifest, or every reason it is not one of the form Lab knows (a change of form is a finding, FR-008). */
export function readOmarchyManifest(input: unknown): Result<OmarchyImage, readonly string[]> {
  const problems: string[] = [];
  const m = isRecord(input) ? input : {};
  const vm = isRecord(m["vm"]) ? m["vm"] : {};
  const version = m["version"];
  if (typeof version !== "string" || version === "") problems.push("the manifest has no version");
  const url = vm["url"];
  if (typeof url !== "string" || !/^(https:\/\/|file:\/\/)/.test(url)) problems.push("vm.url is an https address");
  const sha256 = vm["sha256"];
  if (typeof sha256 !== "string" || !HEX64.test(sha256)) problems.push("vm.sha256 is 64 hexadecimal digits");
  const size = vm["size"];
  if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) problems.push("vm.size is a number of bytes");
  const unpacked = vm["unpacked"];
  if (typeof unpacked !== "string" || !/^(https:\/\/|file:\/\/).*\/$/.test(unpacked)) problems.push("vm.unpacked is an address that ends in a slash");
  const files = vm["unpacked_files"];
  for (const f of [...UNPACKED_FILES, "SHA256SUMS"]) if (!Array.isArray(files) || !files.includes(f)) problems.push(`vm.unpacked_files names ${f}`);
  const user = vm["user"];
  if (typeof user !== "string" || !/^[a-z][a-z0-9_-]*$/.test(user)) problems.push("vm.user is a user name");
  const password = vm["password"];
  if (password !== undefined && (typeof password !== "string" || password === "" || /[\n\r]/.test(password))) problems.push("vm.password is a word");
  if (problems.length > 0) return err(problems);
  return ok({ version: version as string, url: url as string, sha256: sha256 as string, size: size as number, unpacked: unpacked as string, user: user as string, password: password as string | undefined });
}

/** The sums of a `SHA256SUMS` file: file name to its digest. */
export function readSums(text: string): ReadonlyMap<string, string> {
  const sums = new Map<string, string>();
  for (const line of text.split("\n")) {
    const m = /^([0-9a-f]{64})\s+\*?(\S+)$/.exec(line.trim());
    if (m?.[1] !== undefined && m[2] !== undefined) sums.set(m[2], m[1]);
  }
  return sums;
}

/** A file that was fetched, with the digest it should have and the one it has. */
export type Checked = { readonly name: string; readonly expected: string | undefined; readonly actual: string };

/** One sentence naming each file whose digest differs (or has no expected one), or nothing where all agree: the whole machine is refused on any (FR-008). */
export function digestDifferences(files: readonly Checked[]): string | undefined {
  const bad = files.filter((f) => f.expected === undefined || f.expected !== f.actual).map((f) => (f.expected === undefined ? `${f.name} has no digest to check against` : `${f.name} is ${f.actual} where ${f.expected} is expected`));
  return bad.length === 0 ? undefined : `nothing was booted: ${bad.join("; ")}`;
}

/** The systemd credential that makes the home's `.ssh` folder and `authorized_keys` with the public key of this boot, base64 as the firmware tables take it (`tmpfiles.extra`, as Omarchy's `vm-boot` does); the public key may hold no new line. */
export function keyCredential(user: string, publicKey: string): Result<string, string> {
  if (!/^[a-z][a-z0-9_-]*$/.test(user)) return err(`${JSON.stringify(user)} is not a user name`);
  if (!/^ssh-ed25519 [A-Za-z0-9+/=]+( [^\n\r]*)?$/.test(publicKey)) return err("the public key is one line of an ed25519 key");
  const text = `d /home/${user}/.ssh 0700 ${user} ${user} -\nf+ /home/${user}/.ssh/authorized_keys 0600 ${user} ${user} - ${publicKey}\n`;
  return ok(btoa(text));
}

/** How the emulator is accelerated: the hardware's (`kvm`) or software (`tcg`). */
export type Accel = "kvm" | "tcg";

/** The time to wait for SSH, in seconds: 300 with acceleration and 2400 with emulation (FR-010). */
export function sshBoundSeconds(accel: Accel): number {
  return accel === "kvm" ? 300 : 2400;
}

/** What the emulator is started with. */
export type QemuPlan = {
  readonly accel: Accel;
  readonly cpus: number;
  readonly memory: string;
  /** The folder of `vmlinuz` and `initrd`. */
  readonly dir: string;
  readonly overlay: string;
  readonly cmdline: string;
  readonly credential: string;
  readonly port: number;
  readonly qmp: string;
  readonly pidfile: string;
  readonly uuid: string;
  /** The file the machine's serial console is written to: what it had printed, for an error. */
  readonly serial: string;
};

/** The emulator's argument vector, as Omarchy's `vm-boot` makes it, with the acceleration the plan says; the machine's SSH port is forwarded to `127.0.0.1` only, and nothing is shown. */
export function qemuArgv(p: QemuPlan): readonly string[] {
  return [
    "qemu-system-x86_64",
    ...(p.accel === "kvm" ? ["-cpu", "host", "-enable-kvm", "-machine", "q35,accel=kvm"] : ["-cpu", "max", "-machine", "q35,accel=tcg"]),
    "-smp", String(p.cpus), "-m", p.memory,
    "-kernel", `${p.dir}/vmlinuz`, "-initrd", `${p.dir}/initrd`, "-append", p.cmdline,
    "-uuid", p.uuid,
    "-drive", `file=${p.overlay},format=qcow2,if=none,id=d0`, "-device", "virtio-blk-pci,drive=d0",
    "-smbios", `type=11,value=io.systemd.credential.binary:tmpfiles.extra=${p.credential}`,
    "-device", "virtio-vga", "-device", "virtio-rng-pci", "-display", "none",
    "-netdev", `user,id=n0,hostfwd=tcp:127.0.0.1:${p.port}-:22`, "-device", "virtio-net-pci,netdev=n0",
    "-serial", `file:${p.serial}`, "-qmp", `unix:${p.qmp},server,nowait`, "-pidfile", p.pidfile, "-daemonize",
  ];
}
