// What the tests of the machine setup share: a temporary home folder, stand-ins for programs on the PATH, the setup run as a program (as the bootstrap runs it),
// and a context to call one part of it in this process. Nothing here needs root, apt, a terminal or the network.
import { type Ctx, RunState } from "../bin/setup/context.ts";
import { type Env, type Options, parseOptions } from "../bin/setup/options.ts";
import { Retries } from "../bin/setup/net.ts";
import { Signals } from "../bin/setup/telemetry.ts";
import { Log, screen, Ui } from "../bin/setup/ui.ts";
import type { AbsPath } from "../bin/setup/result.ts";

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
    cwd: opts.cwd,
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

/** What a part of the setup printed, in this process. */
export class Captured {
  out = "";
  err = "";
  readonly #before = screen.write;
  constructor() {
    screen.write = (s, t) => {
      if (s === "out") this.out += t;
      else this.err += t;
    };
  }
  [Symbol.dispose](): void {
    screen.write = this.#before;
  }
  get all(): string {
    return this.out + this.err;
  }
}

/** A context to call one part of the setup in this process, with the options the environment gives. */
export function context(fx: Fx, extra: Readonly<Record<string, string>> = {}, argv: readonly string[] = [], more: { hasTty?: boolean; logPath?: string | null } = {}): Ctx {
  const env: Env = fx.env(extra);
  const parsed = parseOptions(argv, env, fx.home as AbsPath, "", () => undefined, 2);
  if (!parsed.ok) throw new Error(parsed.error);
  const opts: Options = parsed.value;
  const logPath = more.logPath === undefined ? null : more.logPath;
  const ui = new Ui(
    { colour: false, utf: false, tty: false, cols: 100 },
    new Log(logPath, logPath === null ? null : logPath.replace(/bootstrap-([^/]*)\.log$/, "support-$1.txt")),
    opts.dryRun,
  );
  const st = new RunState();
  const retries = new Retries(opts.retry, (l) => screen.write("err", `  ~ ${l}\n`), () => 0, () => Promise.resolve());
  const signals = new Signals({ kind: "off" }, `${fx.home}/.local/state/erga/telemetry`, () => Promise.resolve("dev-test"), () => Promise.resolve({}), () => "");
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
