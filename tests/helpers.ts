// What the tests of the machine setup share: a temporary home folder, stand-ins for programs on the PATH, the setup run as a program (as the bootstrap runs it),
// and a context to call one part of it in this process. Nothing here needs root, apt, a terminal or the network.
import process from "node:process";
import { Retries } from "../commons/ts/runtime/net.ts";
import type { Look } from "../commons/ts/runtime/tty.ts";
import { type Ctx, RunState } from "../bin/setup/context.ts";
import { type Env, type Options, parseOptions } from "../bin/setup/options.ts";
import { startSignals } from "../bin/setup/signals.ts";
import { Log, Ui } from "../bin/setup/ui.ts";
import type { AbsPath } from "../bin/setup/stop.ts";

export const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
export const MAIN = `${ROOT}/bin/setup/main.ts`;
export const BOOT_SH = `${ROOT}/bin/erga-bootstrap.sh`;
export const BOOT_PS1 = `${ROOT}/bin/erga-bootstrap.ps1`;
export const DENO = Deno.execPath();
/** The permissions the bootstraps give the setup. */
export const PERMISSIONS = ["--allow-env", "--allow-read", "--allow-write", "--allow-net", "--allow-run", "--allow-sys"];
const SYSTEM_PATH = Deno.env.get("PATH") ?? "/usr/bin:/bin";
/** Deno's own cache, outside every test's home folder, so that a dry run's home stays as it was. */
const DENO_DIR = Deno.env.get("DENO_DIR") || `${Deno.env.get("TMPDIR") || "/tmp"}/erga-setup-tests-deno-dir`;

export const DEBIAN13 = 'ID=debian\nPRETTY_NAME="Debian GNU/Linux 13 (trixie)"\nVERSION_ID=13\nVERSION_CODENAME=trixie\n';
export const ARCH = 'ID=arch\nPRETTY_NAME="Arch Linux"\n';
export const OMARCHY = 'ID=omarchy\nID_LIKE=arch\nPRETTY_NAME="Omarchy"\n';
export const FEDORA = 'ID=fedora\nPRETTY_NAME="Fedora Linux 40"\nVERSION_ID=40\n';

/** Every switch that stops an installation, so that a run changes nothing but the workspaces folder and its own folders (FR-068). */
export const OFF: Readonly<Record<string, string>> = {
  BOOTSTRAP_NO_APT: "1",
  BOOTSTRAP_NO_DOWNLOAD: "1",
  BOOTSTRAP_NO_DOTFILES: "1",
  BOOTSTRAP_NO_AUTH: "1",
  BOOTSTRAP_NO_CHSH: "1",
  BOOTSTRAP_NO_CLONE: "1",
  BOOTSTRAP_NO_ERGA: "1",
  BOOTSTRAP_NO_RUNTIME: "1",
};
export const without = (r: Readonly<Record<string, string>>, ...keys: string[]): Record<string, string> => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k)));

export type Out = { readonly code: number; readonly stdout: string; readonly stderr: string };

export async function sh(argv: readonly string[], env: Readonly<Record<string, string>>, opts: { cwd?: string; stdin?: string } = {}): Promise<Out> {
  const [cmd, ...args] = argv;
  if (cmd === undefined) throw new Error("nothing to run");
  const child = new Deno.Command(cmd, {
    args,
    env: env as Record<string, string>,
    clearEnv: true,
    ...(opts.cwd === undefined ? {} : { cwd: opts.cwd }),
    stdin: opts.stdin === undefined ? "null" : "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  if (opts.stdin !== undefined) {
    const w = child.stdin.getWriter();
    await w.write(new TextEncoder().encode(opts.stdin));
    await w.close();
  }
  const o = await child.output();
  const dec = new TextDecoder();
  return { code: o.code, stdout: dec.decode(o.stdout), stderr: dec.decode(o.stderr) };
}

export async function git(cwd: string, ...argv: string[]): Promise<string> {
  const r = await sh(["git", ...argv], {
    PATH: SYSTEM_PATH,
    HOME: cwd,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.com",
    GIT_CONFIG_NOSYSTEM: "1",
  }, { cwd });
  if (r.code !== 0) throw new Error(`git ${argv.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

/** Every path under a folder, relative to it, sorted. */
export async function tree(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (d: string, rel: string) => {
    for await (const e of Deno.readDir(d)) {
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      out.push(r);
      if (e.isDirectory) await walk(`${d}/${e.name}`, r);
    }
  };
  await walk(root, "").catch(() => {});
  return out.sort();
}

export const exists = (p: string): boolean => {
  try {
    Deno.lstatSync(p);
    return true;
  } catch {
    return false;
  }
};

/** A temporary home folder and the environment a run needs. */
export class Fx {
  readonly home: string;
  readonly bin: string;
  constructor(readonly tmp: string) {
    this.home = `${tmp}/home`;
    this.bin = `${tmp}/stubs`;
    Deno.mkdirSync(this.home);
    Deno.mkdirSync(this.bin);
    Deno.mkdirSync(DENO_DIR, { recursive: true });
  }
  static async make(): Promise<Fx> {
    return new Fx(await Deno.realPath(await Deno.makeTempDir({ prefix: "erga-setup-test." })));
  }
  async [Symbol.asyncDispose](): Promise<void> {
    await Deno.remove(this.tmp, { recursive: true }).catch(() => {});
  }
  get path(): string {
    return `${this.bin}:${SYSTEM_PATH}`;
  }
  env(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
    return {
      PATH: SYSTEM_PATH,
      HOME: this.home,
      TERM: "dumb",
      LANG: "C",
      TMPDIR: this.tmp,
      DENO_DIR,
      BOOTSTRAP_NO_NETCHECK: "1",
      BOOTSTRAP_OS_RELEASE: this.osr(DEBIAN13),
      ...extra,
    };
  }
  /** A stand-in program on the PATH. */
  stub(name: string, body = "exit 0"): string {
    const f = `${this.bin}/${name}`;
    Deno.writeTextFileSync(f, `#!/bin/sh\n${body}\n`);
    Deno.chmodSync(f, 0o755);
    return f;
  }
  osr(text: string): string {
    const f = `${this.tmp}/os-release-${Math.abs(hash(text))}`;
    Deno.writeTextFileSync(f, text);
    return f;
  }
  /** The setup alone (what erga-setup.sh was): --setup. */
  setup(args: readonly string[] = [], extra: Readonly<Record<string, string>> = {}): Promise<Out> {
    return sh([DENO, "run", "-q", "--no-config", "--no-prompt", ...PERMISSIONS, MAIN, "--setup", ...args], this.env(extra));
  }
  /** The bootstrap, as erga-bootstrap.sh hands over to it. */
  boot(args: readonly string[] = [], extra: Readonly<Record<string, string>> = {}): Promise<Out> {
    return sh([DENO, "run", "-q", "--no-config", "--no-prompt", ...PERMISSIONS, MAIN, ...args], this.env(extra));
  }
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

type Write = typeof process.stdout.write;

/** What a part of the setup printed, in this process: what its consoles wrote to standard output and error. */
export class Captured {
  out = "";
  err = "";
  readonly #out: Write = process.stdout.write;
  readonly #err: Write = process.stderr.write;
  constructor() {
    const into = (put: (t: string) => void): Write => {
      const w = (chunk: unknown, ...rest: unknown[]): boolean => {
        put(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk instanceof Uint8Array ? chunk : new Uint8Array()));
        const done = rest.find((r) => typeof r === "function");
        if (typeof done === "function") done();
        return true;
      };
      // a stand-in for the stream's write, which takes the same arguments: what it was given is kept, and its callback called
      return w as Write;
    };
    process.stdout.write = into((t) => (this.out += t));
    process.stderr.write = into((t) => (this.err += t));
  }
  [Symbol.dispose](): void {
    process.stdout.write = this.#out;
    process.stderr.write = this.#err;
  }
  get all(): string {
    return this.out + this.err;
  }
}

/** A context to call one part of the setup in this process, with the options the environment gives. */
export function context(
  fx: Fx,
  extra: Readonly<Record<string, string>> = {},
  argv: readonly string[] = [],
  more: { hasTty?: boolean; logPath?: string | null; look?: Look } = {},
): Ctx {
  const env: Env = fx.env(extra);
  const parsed = parseOptions(argv, env, fx.home as AbsPath, "", () => undefined, 2);
  if (parsed.kind === "err") throw new Error(parsed.error);
  const opts: Options = parsed.value;
  const logPath = more.logPath === undefined ? null : more.logPath;
  const ui = new Ui(
    more.look ?? { colour: false, emoji: false, tty: false, columns: 100 },
    new Log(logPath, logPath === null ? null : logPath.replace(/bootstrap-([^/]*)\.log$/, "support-$1.txt")),
    opts.dryRun,
    opts.switches.verbose,
  );
  const st = new RunState();
  const retries = new Retries(opts.retry, (l) => ui.retry(l), () => 0, () => Promise.resolve());
  const signals = startSignals({ settings: { kind: "off" }, resource: {}, journalDir: `${fx.home}/.local/state/erga/telemetry`, ui });
  Deno.mkdirSync(`${fx.tmp}/work`, { recursive: true });
  return { opts, env, ui, retries, signals, st, work: `${fx.tmp}/work`, hasTty: more.hasTty ?? false };
}

/** Run with PATH set in this process (a part of the setup that looks a program up). */
export async function withPath<T>(path: string, f: () => Promise<T>): Promise<T> {
  const before = Deno.env.get("PATH") ?? "";
  Deno.env.set("PATH", path);
  try {
    return await f();
  } finally {
    Deno.env.set("PATH", before);
  }
}

/** A local HTTP server for a test; handler answers each request. */
export function serve(handler: (req: Request) => Response | Promise<Response>): { readonly url: string; readonly close: () => Promise<void> } {
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen: () => {} }, handler);
  const addr = server.addr as Deno.NetAddr;
  return { url: `http://127.0.0.1:${addr.port}`, close: () => server.shutdown() };
}

export const sha256Hex = async (data: Uint8Array<ArrayBuffer> | string): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", typeof data === "string" ? new TextEncoder().encode(data) : data))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** An address where nothing listens: a port that was free a moment ago. */
export function deadUrl(): string {
  const l = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (l.addr as Deno.NetAddr).port;
  l.close();
  return `http://127.0.0.1:${port}`;
}

/** Copies a folder, recursively, leaving out the entries named in `skip`. */
export function copyTree(from: string, to: string, skip: readonly string[] = []): void {
  Deno.mkdirSync(to, { recursive: true });
  for (const e of Deno.readDirSync(from)) {
    if (skip.includes(e.name)) continue;
    if (e.isDirectory) copyTree(`${from}/${e.name}`, `${to}/${e.name}`, skip);
    else Deno.copyFileSync(`${from}/${e.name}`, `${to}/${e.name}`);
  }
}

/** A zip archive of `files`, stored (not compressed), each file executable, as a release's .zip is: what `unzip` reads, made without any other program. */
export function zipBytes(files: Readonly<Record<string, string>>): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (b: Uint8Array): number => {
    let c = 0xffffffff;
    for (const x of b) c = (crcTable[(c ^ x) & 0xff] ?? 0) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const enc = new TextEncoder();
  const local: number[] = [], central: number[] = [];
  const u16 = (out: number[], v: number) => out.push(v & 0xff, (v >>> 8) & 0xff);
  const u32 = (out: number[], v: number) => out.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  let count = 0;
  for (const [name, body] of Object.entries(files)) {
    const n = enc.encode(name), data = enc.encode(body), crc = crc32(data), offset = local.length;
    // local header: version 2.0, no flags, stored, 1980-01-01 00:00
    u32(local, 0x04034b50), u16(local, 20), u16(local, 0), u16(local, 0), u16(local, 0), u16(local, 33);
    u32(local, crc), u32(local, data.length), u32(local, data.length), u16(local, n.length), u16(local, 0);
    local.push(...n, ...data);
    // central header: made on Unix, so that the mode in the upper half of the external attributes (0755) is read
    u32(central, 0x02014b50), u16(central, (3 << 8) | 20), u16(central, 20), u16(central, 0), u16(central, 0), u16(central, 0), u16(central, 33);
    u32(central, crc), u32(central, data.length), u32(central, data.length), u16(central, n.length), u16(central, 0), u16(central, 0), u16(central, 0), u16(central, 0);
    u32(central, (0o100755 << 16) >>> 0), u32(central, offset);
    central.push(...n);
    count++;
  }
  const end: number[] = [];
  u32(end, 0x06054b50), u16(end, 0), u16(end, 0), u16(end, count), u16(end, count), u32(end, central.length), u32(end, local.length), u16(end, 0);
  return new Uint8Array([...local, ...central, ...end]);
}
