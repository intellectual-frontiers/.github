// Spec: 0002-enrollment-protocol FR-006
/**
 * What a device says about itself (the Facts schema), and its decoder. The decoder is strict: unknown fields are dropped, every text is bounded and a list has a maximum, because the facts come from a machine that is not yet trusted.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Result } from "@intellectual-frontiers/core";
import { isKeyAlgo, parseFingerprint } from "./keys.ts";
import type { Fingerprint } from "./keys.ts";

/** The family of an operating system. */
export type OsFamily = "linux" | "windows" | "macos" | "bsd" | "other";
/** The package manager found on the device. */
export type PackageManager = "apt" | "dnf" | "yum" | "zypper" | "apk" | "pacman" | "brew" | "winget" | "choco" | "none";
/** The state of administrative rights of the account that ran the script. */
export type SudoState = "root" | "passwordless" | "password" | "none" | "administrator";
/** The init system. */
export type InitSystem = "systemd" | "openrc" | "sysv" | "launchd" | "windows-service" | "other";

/** A disk. */
export type DiskFact = { readonly name: string; readonly sizeBytes: number };
/** A network interface with its hardware address and its addresses. */
export type NicFact = { readonly name: string; readonly mac: string; readonly addresses: readonly string[] };
/** A host public key of the device. */
export type HostKeyFact = { readonly algo: string; readonly fingerprint: Fingerprint };

/** The facts of a device. */
export type Facts = {
  readonly os: { readonly family: OsFamily; readonly name: string; readonly version: string; readonly arch: string };
  readonly kernel: string;
  readonly hostname: string;
  readonly machineId: string;
  readonly serial?: string;
  readonly cpus: number;
  readonly memoryBytes: number;
  readonly disks: readonly DiskFact[];
  readonly nics: readonly NicFact[];
  readonly hostKeys: readonly HostKeyFact[];
  readonly adminUsers: readonly string[];
  readonly packageManager: PackageManager;
  readonly sudo: SudoState;
  readonly init: InitSystem;
};

const FAMILIES = ["linux", "windows", "macos", "bsd", "other"] as const;
const MANAGERS = ["apt", "dnf", "yum", "zypper", "apk", "pacman", "brew", "winget", "choco", "none"] as const;
const SUDOS = ["root", "passwordless", "password", "none", "administrator"] as const;
const INITS = ["systemd", "openrc", "sysv", "launchd", "windows-service", "other"] as const;
const MAC = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/;
/** The most items of a list of facts. */
export const MAX_ITEMS = 64;

function record(x: unknown, path: string): Result<Record<string, unknown>, string> {
  return typeof x === "object" && x !== null && !Array.isArray(x) ? ok(x as Record<string, unknown>) : err(`${path}: an object`);
}
function text(x: unknown, path: string, max = 128): Result<string, string> {
  if (typeof x !== "string") return err(`${path}: a string`);
  if (x.length > max) return err(`${path}: at most ${max} characters`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(x)) return err(`${path}: no control characters`);
  return ok(x);
}
function count(x: unknown, path: string, max: number): Result<number, string> {
  return typeof x === "number" && Number.isFinite(x) && Number.isInteger(x) && x >= 0 && x <= max ? ok(x) : err(`${path}: an integer from 0 to ${max}`);
}
function oneOf<T extends string>(x: unknown, path: string, set: readonly T[]): Result<T, string> {
  return typeof x === "string" && (set as readonly string[]).includes(x) ? ok(x as T) : err(`${path}: one of ${set.join(", ")}`);
}
function list<T>(x: unknown, path: string, one: (item: unknown, at: string) => Result<T, string>): Result<readonly T[], string> {
  if (!Array.isArray(x)) return err(`${path}: a list`);
  if (x.length > MAX_ITEMS) return err(`${path}: at most ${MAX_ITEMS} items`);
  const out: T[] = [];
  for (const [i, item] of x.entries()) {
    const r = one(item, `${path}[${i}]`);
    if (r.kind === "err") return r;
    out.push(r.value);
  }
  return ok(out);
}

/** Read the facts a device sent, or say the first thing wrong. */
export function decodeFacts(input: unknown): Result<Facts, string> {
  const o = record(input, "facts");
  if (o.kind === "err") return o;
  const f = o.value;
  const os = record(f["os"], "os");
  if (os.kind === "err") return os;
  const family = oneOf(os.value["family"], "os.family", FAMILIES);
  if (family.kind === "err") return family;
  const osName = text(os.value["name"], "os.name");
  if (osName.kind === "err") return osName;
  const osVersion = text(os.value["version"], "os.version", 64);
  if (osVersion.kind === "err") return osVersion;
  const arch = text(os.value["arch"], "os.arch", 32);
  if (arch.kind === "err") return arch;
  const kernel = text(f["kernel"], "kernel", 128);
  if (kernel.kind === "err") return kernel;
  const hostname = text(f["hostname"], "hostname", 253);
  if (hostname.kind === "err") return hostname;
  const machineId = text(f["machineId"], "machineId", 64);
  if (machineId.kind === "err") return machineId;
  let serial: string | undefined;
  if (f["serial"] !== undefined && f["serial"] !== "") {
    const s = text(f["serial"], "serial", 64);
    if (s.kind === "err") return s;
    serial = s.value;
  }
  const cpus = count(f["cpus"], "cpus", 100000);
  if (cpus.kind === "err") return cpus;
  const memoryBytes = count(f["memoryBytes"], "memoryBytes", 2 ** 50);
  if (memoryBytes.kind === "err") return memoryBytes;
  const disks = list<DiskFact>(f["disks"], "disks", (d, at) => {
    const r = record(d, at);
    if (r.kind === "err") return r;
    const name = text(r.value["name"], `${at}.name`, 64);
    if (name.kind === "err") return name;
    const size = count(r.value["sizeBytes"], `${at}.sizeBytes`, 2 ** 60);
    if (size.kind === "err") return size;
    return ok({ name: name.value, sizeBytes: size.value });
  });
  if (disks.kind === "err") return disks;
  const nics = list<NicFact>(f["nics"], "nics", (n, at) => {
    const r = record(n, at);
    if (r.kind === "err") return r;
    const name = text(r.value["name"], `${at}.name`, 64);
    if (name.kind === "err") return name;
    const mac = text(r.value["mac"], `${at}.mac`, 17);
    if (mac.kind === "err") return mac;
    const lower = mac.value.toLowerCase();
    if (!MAC.test(lower)) return err(`${at}.mac: aa:bb:cc:dd:ee:ff`);
    const addresses = list<string>(r.value["addresses"], `${at}.addresses`, (a, p) => text(a, p, 64));
    if (addresses.kind === "err") return addresses;
    return ok({ name: name.value, mac: lower, addresses: addresses.value });
  });
  if (nics.kind === "err") return nics;
  const hostKeys = list<HostKeyFact>(f["hostKeys"], "hostKeys", (k, at) => {
    const r = record(k, at);
    if (r.kind === "err") return r;
    const algo = r.value["algo"];
    if (!isKeyAlgo(algo)) return err(`${at}.algo: a known key algorithm`);
    const fp = parseFingerprint(r.value["fingerprint"]);
    if (fp.kind === "err") return err(`${at}.fingerprint: ${fp.error}`);
    return ok({ algo, fingerprint: fp.value });
  });
  if (hostKeys.kind === "err") return hostKeys;
  const adminUsers = list<string>(f["adminUsers"], "adminUsers", (u, at) => text(u, at, 64));
  if (adminUsers.kind === "err") return adminUsers;
  const packageManager = oneOf(f["packageManager"], "packageManager", MANAGERS);
  if (packageManager.kind === "err") return packageManager;
  const sudo = oneOf(f["sudo"], "sudo", SUDOS);
  if (sudo.kind === "err") return sudo;
  const init = oneOf(f["init"], "init", INITS);
  if (init.kind === "err") return init;
  return ok({
    os: { family: family.value, name: osName.value, version: osVersion.value, arch: arch.value },
    kernel: kernel.value,
    hostname: hostname.value,
    machineId: machineId.value,
    ...(serial === undefined ? {} : { serial }),
    cpus: cpus.value,
    memoryBytes: memoryBytes.value,
    disks: disks.value,
    nics: nics.value,
    hostKeys: hostKeys.value,
    adminUsers: adminUsers.value,
    packageManager: packageManager.value,
    sudo: sudo.value,
    init: init.value,
  });
}
