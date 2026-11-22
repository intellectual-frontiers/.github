// Spec: 0003-lab-arch-family FR-008, FR-009, FR-010, FR-011, FR-012, FR-013
/**
 * The virtual machine of Omarchy: the published image fetched and checked against its SHA-256 and cached by that digest, booted on a copy-on-write overlay under QEMU (hardware acceleration where `/dev/kvm` is usable, software
 * emulation where not), a key made for this boot and handed in through the firmware tables, the SSH port forwarded to `127.0.0.1` only, the host key pinned, and an executor of Headless (the ssh executor) that runs a program in it as
 * the same `Executor` a container gives. `stop` ends the emulator and removes the overlay and the keys whatever happened; the image is never written. A host that cannot run it says why (`vmUsable`) and a test is skipped, never passed.
 *
 * @example
 * ```ts
 * import { vmUsable } from "./vm.ts";
 * // const reason = await vmUsable(); // undefined where a virtual machine can be run, else why not
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { target, type Executor } from "@intellectual-frontiers/headless/logical";
import { sshExecutor } from "@intellectual-frontiers/headless/targets/ssh";
import { listen } from "@intellectual-frontiers/net/tcp";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { digestDifferences, keyCredential, OMARCHY_MANIFEST_URL, qemuArgv, readOmarchyManifest, readSums, sshBoundSeconds, UNPACKED_FILES, type Accel, type OmarchyImage } from "@intellectual-frontiers/lab/logical";

/** What a virtual machine is started with. Every field has a default; the pins are for a caller that wants the release it has verified and no other. */
export type VmOptions = {
  /** The manifest's address (the stable channel's by default). */
  readonly manifestUrl?: string;
  /** Where images are kept, by digest (`LAB_VM_CACHE`, else `~/.cache/lab/omarchy`). */
  readonly cacheDir?: string;
  /** The SHA-256 the image must have: a manifest that names another is refused before anything is fetched. */
  readonly pin?: string;
  /** The SHA-256 each unpacked file must have, by name (`vmlinuz`, `initrd`, `cmdline`): the sums file of the origin is checked against them too. */
  readonly pinFiles?: Readonly<Record<string, string>>;
  readonly cpus?: number;
  readonly memory?: string;
  /** Overrides the choice of acceleration (a host with `/dev/kvm` that wants emulation). */
  readonly accel?: Accel;
  /** Overrides the seconds to wait for SSH (`sshBoundSeconds` of the acceleration by default). */
  readonly sshSeconds?: number;
  /** Called with each step as it happens (the download is long). */
  readonly onStep?: (line: string) => void;
};

/** A running virtual machine. */
export type VirtualMachine = {
  readonly kind: "vm";
  readonly image: OmarchyImage;
  /** The acceleration used: said, not hidden (FR-010). */
  readonly accel: Accel;
  readonly user: string;
  /** The password of the image for `sudo`, as its manifest publishes it (SSH takes only the key of this boot). */
  readonly sudoPassword: string | undefined;
  /** The port forwarded to the machine's SSH port, on 127.0.0.1. */
  readonly port: number;
  /** The private key made for this boot; the image holds no key. */
  readonly identityFile: string;
  /** The host key of the machine, pinned: the file a client checks the machine against. */
  readonly knownHostsFile: string;
  /** The image on disk (never written) and its overlay (deleted by `stop`). */
  readonly imageFile: string;
  readonly overlay: string;
  /** Whole seconds from the emulator's start to the first answer of SSH. */
  readonly secondsToSsh: number;
  /** Runs a program in the machine as its user, with no shell of ours between: the same `Executor` as a container's. */
  readonly executor: Executor;
  /** Ends the emulator and removes the overlay and the keys; safe to run twice. */
  stop(): Promise<void>;
};

const GIB = 1024 * 1024 * 1024;

/** The folder images are kept in. */
export function defaultCacheDir(): string {
  const set = process.env["LAB_VM_CACHE"];
  return set !== undefined && set !== "" ? set : path.join(process.env["XDG_CACHE_HOME"] ?? path.join(proc.homeDir(), ".cache"), "lab", "omarchy");
}

async function freeBytes(folder: string): Promise<number | undefined> {
  await fs.mkdir(folder, { recursive: true });
  const r = await proc.run(["df", "-Pk", folder]);
  const cols = r.stdout.trim().split("\n").at(-1)?.split(/\s+/);
  const k = cols === undefined ? NaN : Number(cols[3]);
  return Number.isFinite(k) ? k * 1024 : undefined;
}

/** Why a virtual machine cannot be run here, or nothing where one can (FR-011): the programs it needs, and room for the overlay (and for the image where it is not cached yet). */
export async function vmUsable(): Promise<string | undefined> {
  for (const program of ["qemu-system-x86_64", "qemu-img", "ssh", "ssh-keygen", "ssh-keyscan", "curl"]) if (proc.which(program) === undefined) return `${program} is not installed`;
  const state = process.env["VM_STATE_DIR"] ?? "/var/tmp";
  const room = await freeBytes(state);
  if (room !== undefined && room < 2 * GIB) return `${state} has ${(room / GIB).toFixed(1)} GiB free and the overlay of a virtual machine needs 2 GiB`;
  return undefined;
}

/** Whether the host has a usable `/dev/kvm`. */
export async function kvmUsable(): Promise<boolean> {
  return await fs.open("/dev/kvm", { read: true, write: true }).then(
    (f) => {
      f.close();
      return true;
    },
    () => false,
  );
}

const caFile = async (): Promise<string | undefined> => {
  const f = process.env["LAB_CA_BUNDLE"];
  return f !== undefined && f !== "" && (await fs.stat(f).then(() => true, () => false)) ? f : undefined;
};

async function curl(url: string, to: string, resume = false): Promise<string | undefined> {
  const ca = await caFile();
  const r = await proc.run(["curl", "-fsSL", "--retry", "5", "--retry-delay", "3", ...(resume ? ["-C", "-"] : []), ...(ca === undefined ? [] : ["--cacert", ca]), "-o", to, url]);
  return r.success ? undefined : `${url} was not fetched: ${r.stderr.trim().split("\n").at(-1) ?? ""}`;
}

async function freePort(): Promise<number> {
  await using listener = await listen({ port: 0, hostname: "127.0.0.1" });
  return listener.addr.port;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** The image and its files, fetched and checked, in the folder named by the image's digest: the whole machine is refused where any digest differs, naming each. Returns the folder and the image. */
export async function fetchOmarchy(options: VmOptions = {}): Promise<Result<{ readonly image: OmarchyImage; readonly dir: string; readonly imageFile: string }, string>> {
  const step = options.onStep ?? (() => undefined);
  const cache = options.cacheDir ?? defaultCacheDir();
  await fs.mkdir(cache, { recursive: true });
  const scratch = await fs.makeTempDir({ dir: cache, prefix: ".fetch-" });
  try {
    const manifestFile = path.join(scratch, "latest.json");
    const failed = await curl(options.manifestUrl ?? OMARCHY_MANIFEST_URL, manifestFile);
    if (failed !== undefined) return err(failed);
    const manifest = readOmarchyManifest(JSON.parse(await fs.readTextFile(manifestFile)) as unknown);
    if (manifest.kind === "err") return err(`the manifest is not of the form Lab knows: ${manifest.error.join("; ")}`);
    const image = manifest.value;
    if (options.pin !== undefined && options.pin !== image.sha256) return err(`nothing was booted: the manifest names an image of ${image.sha256} where ${options.pin} is pinned`);
    const dir = path.join(cache, image.sha256);
    await fs.mkdir(dir, { recursive: true });
    const imageFile = path.join(dir, "disk.qcow2");
    if (!(await fs.exists(imageFile))) {
      const room = await freeBytes(cache);
      if (room !== undefined && room < image.size + 2 * GIB) return err(`${cache} has ${(room / GIB).toFixed(1)} GiB free and the image needs ${(image.size / GIB).toFixed(1)} GiB and 2 more`);
      step(`fetching ${image.url} (${(image.size / GIB).toFixed(1)} GiB)`);
      const part = `${imageFile}.part`;
      const got = await curl(image.url, part, true);
      if (got !== undefined) return err(got);
      step("checking the SHA-256 of the image");
      const actual = await fs.sha256File(part);
      const bad = digestDifferences([{ name: "the image", expected: image.sha256, actual }]);
      if (bad !== undefined) {
        await fs.remove(part).catch(() => undefined);
        return err(bad);
      }
      await fs.rename(part, imageFile);
    }
    const sumsFile = path.join(scratch, "SHA256SUMS");
    const sumsFailed = await curl(`${image.unpacked}SHA256SUMS`, sumsFile);
    if (sumsFailed !== undefined) return err(sumsFailed);
    const sums = readSums(await fs.readTextFile(sumsFile));
    const checked: { name: string; expected: string | undefined; actual: string }[] = [];
    for (const name of UNPACKED_FILES) {
      const file = path.join(dir, name);
      const expected = sums.get(name);
      const pinned = options.pinFiles?.[name];
      if (pinned !== undefined && pinned !== expected) {
        checked.push({ name, expected: pinned, actual: expected ?? "no digest in SHA256SUMS" });
        continue;
      }
      let actual = (await fs.exists(file)) ? await fs.sha256File(file) : undefined;
      if (actual === undefined || actual !== expected) {
        const got = await curl(`${image.unpacked}${name}`, `${file}.part`);
        if (got !== undefined) return err(got);
        actual = await fs.sha256File(`${file}.part`);
        if (actual === expected) await fs.rename(`${file}.part`, file);
        else await fs.remove(`${file}.part`).catch(() => undefined);
      }
      checked.push({ name, expected, actual });
    }
    const bad = digestDifferences(checked);
    if (bad !== undefined) return err(bad);
    return ok({ image, dir, imageFile });
  } finally {
    await fs.remove(scratch, { recursive: true }).catch(() => undefined);
  }
}

/** Starts a virtual machine from the published image of Omarchy, or says why it could not be. */
export async function startVm(options: VmOptions = {}): Promise<Result<VirtualMachine, string>> {
  const why = await vmUsable();
  if (why !== undefined) return err(why);
  const fetched = await fetchOmarchy(options);
  if (fetched.kind === "err") return fetched;
  const state = await fs.makeTempDir({ dir: process.env["VM_STATE_DIR"] ?? "/var/tmp", prefix: "lab-vm-" });
  const pidfile = path.join(state, "qemu.pid");
  const stop = async (): Promise<void> => {
    const pid = Number((await fs.readTextOr(pidfile, "")).trim());
    if (Number.isInteger(pid) && pid > 1) {
      const alive = (): boolean => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      };
      if (alive()) process.kill(pid, "SIGTERM");
      for (let i = 0; i < 50 && alive(); i++) await sleep(100);
      if (alive()) process.kill(pid, "SIGKILL");
    }
    await fs.remove(state, { recursive: true }).catch(() => undefined);
  };
  let result: Result<VirtualMachine, string>;
  try {
    result = await boot(options, fetched.value.image, fetched.value.dir, fetched.value.imageFile, state, pidfile, stop);
  } catch (e) {
    result = err(e instanceof Error ? e.message : String(e));
  }
  if (result.kind === "err") await stop();
  return result;
}

async function boot(options: VmOptions, image: OmarchyImage, dir: string, imageFile: string, state: string, pidfile: string, stop: () => Promise<void>): Promise<Result<VirtualMachine, string>> {
  const step = options.onStep ?? (() => undefined);
  const key = path.join(state, "id_ed25519");
  const made = await proc.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "lab-vm", "-f", key]);
  if (!made.success) return err(`a key was not made: ${made.stderr.trim()}`);
  const credential = keyCredential(image.user, (await fs.readTextFile(`${key}.pub`)).trim());
  if (credential.kind === "err") return credential;
  const overlay = path.join(state, "run.qcow2");
  const o = await proc.run(["qemu-img", "create", "-qf", "qcow2", "-b", imageFile, "-F", "qcow2", overlay]);
  if (!o.success) return err(`the overlay was not made in ${state}: ${o.stderr.trim()}`);
  const accel: Accel = options.accel ?? ((await kvmUsable()) ? "kvm" : "tcg");
  const port = await freePort();
  const serial = path.join(state, "serial.log");
  const argv = qemuArgv({ accel, cpus: options.cpus ?? 4, memory: options.memory ?? (accel === "kvm" ? "4G" : "6G"), dir, overlay, cmdline: (await fs.readTextFile(path.join(dir, "cmdline"))).trim(), credential: credential.value, port, qmp: path.join(state, "qmp.sock"), pidfile, uuid: crypto.randomUUID(), serial });
  const t0 = Date.now();
  step(`starting QEMU with ${accel === "kvm" ? "hardware acceleration (kvm)" : "software emulation (tcg), which is slow"}`);
  const started = await proc.run(argv);
  if (!started.success) return err(`QEMU did not start: ${started.stderr.trim().split("\n").slice(-3).join(" | ")}`);
  const t = target({ id: "lab-vm", class: "server", address: "127.0.0.1", user: image.user, port, credential: "lab-vm" });
  if (t.kind === "err") return err(t.error);
  const knownHostsFile = path.join(state, "known_hosts");
  const executor = sshExecutor(t.value, [t.value], { family: "pinned", knownHostsRepository: knownHostsFile, knownHostsUser: knownHostsFile, connectTimeoutSec: 10, identityFor: () => key });
  const bound = options.sshSeconds ?? sshBoundSeconds(accel);
  const alive = async (): Promise<boolean> => (await proc.run(["kill", "-0", (await fs.readTextOr(pidfile, "")).trim() || "0"])).success;
  let pinned = false;
  for (;;) {
    const seconds = (Date.now() - t0) / 1000;
    if (seconds > bound) {
      const printed = (await fs.readTextOr(serial, "")).trim().split("\n").slice(-5).join(" | ");
      return err(`the virtual machine did not answer SSH within ${bound} seconds (${accel}); it had printed: ${printed === "" ? "nothing" : printed}`);
    }
    if (!(await alive())) return err(`QEMU ended before SSH answered; it had printed: ${(await fs.readTextOr(serial, "")).trim().split("\n").slice(-5).join(" | ") || "nothing"}`);
    if (!pinned) {
      const scanned = (await proc.run(["ssh-keyscan", "-T", "3", "-t", "ed25519", "-p", String(port), "127.0.0.1"])).stdout;
      if (scanned !== "") {
        await fs.writeTextFile(knownHostsFile, scanned);
        pinned = true;
      }
    }
    if (pinned && (await executor.exec(["true"])).success) break;
    await sleep(2000);
  }
  const secondsToSsh = Math.round((Date.now() - t0) / 1000);
  step(`SSH answered after ${secondsToSsh} seconds`);
  const ca = await caFile();
  if (ca !== undefined) {
    const put = await executor.exec(["sh", "-c", "cat > /tmp/lab-ca.pem"], { input: await fs.readTextFile(ca) });
    if (!put.success) return err(`the builder's CA was not copied to the machine: ${new TextDecoder().decode(put.stderr).trim()}`);
    // The published image's sudo takes the password its manifest names; it is read from the standard input.
    const sudo = (argv: readonly string[]) => executor.exec(["sudo", "-S", "-p", "", ...argv], { input: `${image.password ?? ""}\n` });
    // Into the anchors folder, as on the container path: `trust anchor --store` refuses a bundle that holds a certificate the system has already.
    const trusted = await sudo(["install", "-m", "0644", "/tmp/lab-ca.pem", "/etc/ca-certificates/trust-source/anchors/lab-ca.crt"]);
    const extracted = trusted.success ? await sudo(["update-ca-trust"]) : trusted;
    await executor.exec(["rm", "-f", "/tmp/lab-ca.pem"]);
    if (!extracted.success) return err(`the builder's CA was not trusted in the machine: ${new TextDecoder().decode(extracted.stderr).trim()}`);
  }
  return ok({ kind: "vm", image, accel, user: image.user, sudoPassword: image.password, port, identityFile: key, knownHostsFile, imageFile, overlay, secondsToSsh, executor, stop });
}
