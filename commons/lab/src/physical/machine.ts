// Spec: 0002-lab-machine FR-004, FR-005
// Spec: 0003-lab-arch-family FR-002, FR-004, FR-005
/**
 * A disposable machine on a container runtime: the image made from the machine's Containerfile (kept by the hash of its text), the container run with systemd as its first process and the host's network, a key pair made for this
 * run and thrown away with it, sshd set to a free port that only the machine's own address answers, the host key pinned in a file of known hosts, and an executor of Headless that runs a program in it. `stop` removes the container and the
 * folder of keys whatever happened, and a test that cannot have a runtime says why and is skipped, never passed.
 *
 * @example
 * ```ts
 * import { runtimeUsable } from "./machine.ts";
 * // const reason = await runtimeUsable("docker"); // undefined where containers can be run, else why not
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Executor } from "@intellectual-frontiers/headless/logical";
import { containerExecutor, type Runtime } from "@intellectual-frontiers/headless/targets/container";
import { listen } from "@intellectual-frontiers/net/tcp";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { ARCH_NONE_COMMAND, containerfile, imageTag } from "@intellectual-frontiers/lab/logical";
import { imageFamily, type ImageFamily, type MachineSpec } from "@intellectual-frontiers/lab/governance";

export type { Runtime };

/** A running disposable machine. */
export type Machine = {
  readonly spec: MachineSpec;
  readonly container: string;
  /** The port sshd listens on, on 127.0.0.1. */
  readonly port: number;
  /** The private key made for this run, which every user of the machine accepts. */
  readonly identityFile: string;
  /** The host key of the machine, pinned: the file a client checks the machine against. */
  readonly knownHostsFile: string;
  /** Runs a program in the machine as root, with no shell between. */
  readonly executor: Executor;
  /** Removes the container and the folder of keys; safe to run twice. */
  stop(): Promise<void>;
};

/** The file whose presence says the kernel has cgroup v2 (the unified hierarchy). */
export const CGROUP2_MARKER = "/sys/fs/cgroup/cgroup.controllers";

/** Why containers cannot be run here, or nothing where they can; with the description of the machine to be run, also why that machine cannot: a machine of the family `arch` with systemd cannot run where the kernel has no cgroup v2 (the systemd of Arch has no support for cgroup v1 and exits at once with status 255 and no message), and one with `init: "none"` is not refused for it (0003-lab-arch-family FR-005). */
export async function runtimeUsable(runtime: Runtime = "docker", spec?: MachineSpec, cgroupMarker: string = CGROUP2_MARKER): Promise<string | undefined> {
  if (proc.which(runtime) === undefined) return `${runtime} is not installed`;
  if (proc.which("ssh") === undefined || proc.which("ssh-keygen") === undefined || proc.which("ssh-keyscan") === undefined) return "the ssh client is not installed";
  const r = await proc.run([runtime, "info", "--format", "{{.ServerVersion}}"]);
  if (!r.success) return `the ${runtime} daemon does not answer (start it, with network if images are to be built: pacman, apt and dnf need it)`;
  if (spec !== undefined && imageFamily(spec.image) === "arch" && (spec.init ?? "systemd") === "systemd" && !(await fs.exists(cgroupMarker))) {
    return "the kernel has no cgroup v2 (no /sys/fs/cgroup/cgroup.controllers) and the systemd that Arch ships has no support for cgroup v1: it exits at once with status 255 and no message; use init: none here";
  }
  return undefined;
}

/** The name of the SSH server's unit by family. */
function sshdUnit(family: ImageFamily): string {
  switch (family) {
    case "debian":
      return "ssh";
    case "rhel":
    case "arch":
      return "sshd";
    default:
      return absurd(family);
  }
}

function absurd(x: never): never {
  throw new Error(`a family with no SSH unit: ${String(x)}`);
}

/** The digest of the image a name stands for now (the registry's where it has one, else its id), after asking the registry for a newer one: a base that cannot be pulled is used from where it is if it is there (0003-lab-arch-family FR-002). */
async function baseDigest(runtime: Runtime, image: string): Promise<Result<string, string>> {
  const pulled = await proc.run([runtime, "pull", "-q", image]);
  const inspected = await proc.run([runtime, "image", "inspect", "--format", "{{range .RepoDigests}}{{.}} {{end}}{{.Id}}", image]);
  const first = inspected.stdout.trim().split(/\s+/)[0];
  if (!inspected.success || first === undefined || first === "") return err(`the base image ${image} is not here and was not pulled: ${pulled.stderr.trim().split("\n").slice(-2).join(" | ")}`);
  return ok(first);
}

async function freePort(): Promise<number> {
  await using listener = await listen({ port: 0, hostname: "127.0.0.1" });
  const addr = listener.addr;
  return addr.port;
}

/** Starts a machine, or says why it could not be: the image is built, the container run, systemd waited for until it is running (or degraded, as a container's usually is), the key and sshd set up and the host key pinned. */
export async function startMachine(spec: MachineSpec, runtime: Runtime = "docker"): Promise<Result<Machine, string>> {
  const dir = await fs.makeTempDir({ prefix: "lab-" });
  const container = `lab-${spec.name}-${crypto.randomUUID().slice(0, 8)}`;
  const stop = async (): Promise<void> => {
    await proc.run([runtime, "rm", "-f", container]);
    await fs.remove(dir, { recursive: true }).catch(() => undefined);
  };
  let result: Result<Machine, string>;
  try {
    result = await bringUp(spec, runtime, dir, container, stop);
  } catch (e) {
    result = err(e instanceof Error ? e.message : String(e));
  }
  if (result.kind === "err") await stop();
  return result;
}

async function bringUp(spec: MachineSpec, runtime: Runtime, dir: string, container: string, stop: () => Promise<void>): Promise<Result<Machine, string>> {
  const text = containerfile(spec);
  const family = imageFamily(spec.image);
  const base = family === "arch" ? await baseDigest(runtime, spec.image) : undefined;
  if (base?.kind === "err") return base;
  const tag = await imageTag(spec, text, base?.value);
  const none = family === "arch" && spec.init === "none";
  {
    const exists = await proc.run([runtime, "image", "inspect", tag]);
    if (!exists.success) {
      const empty = path.join(dir, "context");
      await fs.mkdir(empty, { recursive: true });
      // On a network that inspects TLS the builder may be given the certificate to trust for the install: a build secret, in no layer of the image (LAB_CA_BUNDLE names the file).
      const caFile = process.env["LAB_CA_BUNDLE"];
      const secret = caFile !== undefined && caFile !== "" && (await fs.stat(caFile).then(() => true, () => false)) ? ["--secret", `id=ca,src=${caFile}`] : [];
      const built = await proc.run([runtime, "build", "--network=host", ...secret, "-t", tag, "-f", "-", empty], { input: text });
      if (!built.success) return err(`the image of ${spec.name} was not built: ${built.stderr.trim().split("\n").slice(-3).join(" | ")}`);
    }
    const key = path.join(dir, "id_ed25519");
    const made = await proc.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", `lab-${spec.name}`, "-f", key]);
    if (!made.success) return err(`a key was not made: ${made.stderr.trim()}`);
    const port = await freePort();
    const sshdFlags = ["-p", String(port), "-o", "ListenAddress=127.0.0.1", "-o", "PasswordAuthentication=no", "-o", "KbdInteractiveAuthentication=no", "-o", "PermitRootLogin=no"];
    const run = none
      ? await proc.run([runtime, "run", "-d", "--name", container, "--label", "lab=machine", "--network=host", tag, ...ARCH_NONE_COMMAND, ...sshdFlags])
      : await proc.run([runtime, "run", "-d", "--name", container, "--label", "lab=machine", "--privileged", "--cgroupns=host", "--network=host", "-v", "/sys/fs/cgroup:/sys/fs/cgroup:rw", tag, "/sbin/init"]);
    if (!run.success) return err(`the container of ${spec.name} did not start: ${run.stderr.trim()}`);
    const executor = containerExecutor(runtime, container);
    let state = "";
    for (let i = 0; i < 120 && !none; i++) {
      const s = await executor.exec(["systemctl", "is-system-running"]);
      state = new TextDecoder().decode(s.stdout).trim();
      if (state === "running" || state === "degraded") break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!none && state !== "running" && state !== "degraded") return err(`systemd of ${spec.name} did not come up (${state || "no answer"})`);
    const pub = (await fs.readTextFile(`${key}.pub`)).trim();
    for (const u of spec.users) {
      const home = `/home/${u.name}`;
      for (const argv of [["install", "-d", "-m", "700", "-o", u.name, "-g", u.name, `${home}/.ssh`], ["sh", "-c", `cat > ${home}/.ssh/authorized_keys && chown ${u.name}:${u.name} ${home}/.ssh/authorized_keys && chmod 600 ${home}/.ssh/authorized_keys`]]) {
        const r = await executor.exec(argv, argv[0] === "sh" ? { input: `${pub}\n` } : {});
        if (!r.success) return err(`the key of ${u.name} was not put in: ${new TextDecoder().decode(r.stderr).trim()}`);
      }
    }
    const conf = [`Port ${port}`, "ListenAddress 127.0.0.1", "PasswordAuthentication no", "KbdInteractiveAuthentication no", "PermitRootLogin no", ""].join("\n");
    if (!none) {
      const wrote = await executor.exec(["sh", "-c", `cat > /etc/ssh/sshd_config.d/10-lab.conf && systemctl restart ${sshdUnit(family)}`], { input: conf });
      if (!wrote.success) return err(`sshd was not set up: ${new TextDecoder().decode(wrote.stderr).trim()}`);
    }
    let scanned = "";
    for (let i = 0; i < 40 && scanned === ""; i++) {
      scanned = (await proc.run(["ssh-keyscan", "-T", "2", "-t", "ed25519", "-p", String(port), "127.0.0.1"])).stdout;
      if (scanned === "") await new Promise((r) => setTimeout(r, 250));
    }
    if (scanned === "") return err(`sshd of ${spec.name} did not answer on port ${port}`);
    const knownHostsFile = path.join(dir, "known_hosts");
    await fs.writeTextFile(knownHostsFile, scanned);
    return ok({ spec, container, port, identityFile: key, knownHostsFile, executor, stop });
  }
}
