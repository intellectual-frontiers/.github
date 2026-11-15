/**
 * The process and the programs it runs (commons 0005-typescript-runtime FR-022), on `node:process`, `node:child_process` and `node:os`.
 * The names follow the `Deno` calls in use (`env.get`, `args`, `exit`, `cwd`, `build.os`, `Command(...).output()`) so a conversion is a
 * rename. A program is always run by its argument vector, never through a shell; one that cannot be found throws `NotFound`, and a non-zero
 * exit is an outcome, not an error. Taken from erga's `lib/ts/process`, Stolos's `src/archon/core/exec.ts` and the setup's `proc.ts`.
 *
 * @example
 * ```ts
 * import { run } from "./proc.ts";
 * const r = await run(["git", "--version"]);
 * if (r.success) console.log(r.stdout.trim());
 * ```
 *
 * @module
 */
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import * as os from "node:os";
import { delimiter, join } from "node:path";
import process from "node:process";
import type { Readable } from "node:stream";
import { InvalidData, mapError } from "./errors.ts";

/** The process's environment, by `Deno.env`'s names. */
export const env = {
  /** A variable's value, or undefined where it is not set. */
  get(key: string): string | undefined {
    return process.env[key];
  },
  /** A variable set for this process and the programs it runs. */
  set(key: string, value: string): void {
    process.env[key] = value;
  },
  /** A variable removed. */
  delete(key: string): void {
    Reflect.deleteProperty(process.env, key);
  },
  /** Whether a variable is set. */
  has(key: string): boolean {
    return process.env[key] !== undefined;
  },
  /** Every variable that is set, as a plain object. */
  toObject(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) out[k] = v;
    return out;
  },
} as const;

/** The arguments the program was given, after the runtime's own and the script's path. */
export const args: readonly string[] = Object.freeze(process.argv.slice(2));

/** The process ends now with `code` (0 by default). */
export function exit(code = 0): never {
  process.exit(code);
}

/** The process's working folder. */
export function cwd(): string {
  return process.cwd();
}

/** The process's working folder changed. */
export function chdir(path: string): void {
  try {
    process.chdir(path);
  } catch (e) {
    throw mapError(e, path);
  }
}

/** The process's id. */
export const pid: number = process.pid;

/** The path of the runtime's executable (deno, node or bun). */
export function execPath(): string {
  return process.execPath;
}

/** The computer's name. */
export function hostname(): string {
  return os.hostname();
}

/** The account's home folder. */
export function homeDir(): string {
  return os.homedir();
}

/** The account's user id, or undefined on Windows. */
export function uid(): number | undefined {
  return typeof process.getuid === "function" ? process.getuid() : undefined;
}

/** Whether the process runs as root (never on Windows). */
export function isRoot(): boolean {
  return uid() === 0;
}

/** An operating system, by `Deno.build.os`'s names. */
export type Os = "linux" | "darwin" | "windows" | "freebsd" | "netbsd" | "openbsd" | "solaris" | "aix" | "android" | "other";
/** A processor, by `Deno.build.arch`'s names. */
export type Arch = "x86_64" | "aarch64" | "arm" | "riscv64" | "s390x" | "ppc64" | "other";

/** The operating system's name for `node:process`'s `platform`. */
export function osOf(platform: string): Os {
  switch (platform) {
    case "linux":
    case "darwin":
    case "freebsd":
    case "netbsd":
    case "openbsd":
    case "aix":
    case "android":
      return platform;
    case "win32":
      return "windows";
    case "sunos":
      return "solaris";
    default:
      return "other";
  }
}

/** The processor's name for `node:process`'s `arch`. */
export function archOf(arch: string): Arch {
  switch (arch) {
    case "x64":
      return "x86_64";
    case "arm64":
      return "aarch64";
    case "arm":
    case "riscv64":
    case "s390x":
    case "ppc64":
      return arch;
    default:
      return "other";
  }
}

/** The platform this process runs on, by `Deno.build`'s names. */
export const build: { readonly os: Os; readonly arch: Arch } = Object.freeze({ os: osOf(process.platform), arch: archOf(process.arch) });

/** Which runtime runs this code. */
export type RuntimeName = "deno" | "bun" | "node";

/** Which runtime runs this code, from `process.versions`, which each of them fills. */
export function runtimeName(): RuntimeName {
  const v: Readonly<Record<string, string | undefined>> = process.versions;
  if (v["deno"] !== undefined) return "deno";
  if (v["bun"] !== undefined) return "bun";
  return "node";
}

/** The version of the runtime that runs this code. */
export function runtimeVersion(): string {
  const v: Readonly<Record<string, string | undefined>> = process.versions;
  return v[runtimeName()] ?? process.version.replace(/^v/, "");
}

/** Whether a path is a file this account may run (on Windows, any file). */
export function isExecutable(path: string): boolean {
  try {
    const s = statSync(path);
    return s.isFile() && (process.platform === "win32" || (s.mode & 0o111) !== 0);
  } catch {
    return false;
  }
}

/** The program `name` on `PATH` (or the path itself where `name` has a separator), as `command -v` finds it; undefined where there is none. */
export function which(name: string, path: string = env.get("PATH") ?? ""): string | undefined {
  const windows = process.platform === "win32";
  const exts = windows ? ["", ...(env.get("PATHEXT") ?? ".EXE;.CMD;.BAT;.COM").split(";")] : [""];
  const candidates = name.includes("/") || (windows && name.includes("\\"))
    ? [name]
    : path.split(delimiter).filter((d) => d !== "").flatMap((d) => exts.map((e) => join(d, `${name}${e}`)));
  return candidates.find(isExecutable);
}

/** Where a stream of a program goes: kept (`piped`), shared with this process (`inherit`) or thrown away (`null`). */
export type Stdio = "piped" | "inherit" | "null";

/** How to run a program. */
export type RunOptions = {
  /** Its working folder. */
  readonly cwd?: string;
  /** Variables added to its environment (or its whole environment, with `clearEnv`). */
  readonly env?: Readonly<Record<string, string>>;
  /** Start it with no variable but those of `env`. */
  readonly clearEnv?: boolean;
  /** Its standard input: text or bytes to read, this process's own (`inherit`), or none (`null`, the default). */
  readonly stdin?: string | Uint8Array | "inherit" | "null";
  /** Its standard output: kept (the default), shared, or thrown away. */
  readonly stdout?: Stdio;
  /** Its standard error: kept (the default), shared, or thrown away. */
  readonly stderr?: Stdio;
  /** Each line it writes, as it writes it, without its line ending; the output is kept as well. */
  readonly onLine?: (stream: "stdout" | "stderr", line: string) => void;
  /** Stopping it: SIGTERM when the signal aborts, then SIGKILL after `killAfterMs`. */
  readonly signal?: AbortSignal;
  /** How long a program stopped by `signal` has between SIGTERM and SIGKILL (5000 ms by default). */
  readonly killAfterMs?: number;
};

/** What a program did, with its output as bytes (`Deno.CommandOutput`). */
export type Output = {
  /** Its exit status; 128 plus the signal's number where a signal ended it, as a shell reports it. */
  readonly code: number;
  /** Whether its exit status was 0. */
  readonly success: boolean;
  /** The signal that ended it (`SIGTERM`), or null. */
  readonly signal: string | null;
  /** What it wrote to standard output, where it was kept. */
  readonly stdout: Uint8Array;
  /** What it wrote to standard error, where it was kept. */
  readonly stderr: Uint8Array;
};

/** What a program did, with its output as text. */
export type TextOutput = Omit<Output, "stdout" | "stderr"> & { readonly stdout: string; readonly stderr: string };

const SIGNALS: Readonly<Record<string, number>> = { SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGABRT: 6, SIGKILL: 9, SIGPIPE: 13, SIGALRM: 14, SIGTERM: 15 };

/** The number of a signal by its name (1 for one it does not know). */
export function signalNumber(name: string): number {
  return SIGNALS[name] ?? os.constants.signals[name as keyof typeof os.constants.signals] ?? 1;
}

const stdio = (s: Stdio | undefined): "pipe" | "inherit" | "ignore" => (s === "inherit" ? "inherit" : s === "null" ? "ignore" : "pipe");

/** A program run to its end, by its argument vector and never through a shell, with what it did. `NotFound` where there is no such program. */
export function output(argv: readonly string[], options: RunOptions = {}): Promise<Output> {
  const [cmd, ...rest] = argv;
  if (cmd === undefined || cmd === "") return Promise.reject(new InvalidData("nothing to run: the argument vector is empty", "EINVAL"));
  const input = options.stdin;
  const feeds = typeof input === "string" || input instanceof Uint8Array;
  return new Promise<Output>((resolve, reject) => {
    let settled = false;
    const child = spawn(cmd, rest, {
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      env: options.clearEnv === true ? { ...options.env } : { ...process.env, ...options.env },
      stdio: [feeds ? "pipe" : input === "inherit" ? "inherit" : "ignore", stdio(options.stdout), stdio(options.stderr)],
      windowsHide: true,
    });
    const kept = { stdout: [] as Uint8Array[], stderr: [] as Uint8Array[] };
    const collect = (name: "stdout" | "stderr", stream: Readable | null): void => {
      if (stream === null) return;
      const dec = new TextDecoder();
      let rest = "";
      stream.on("data", (chunk: Uint8Array) => {
        kept[name].push(chunk);
        if (options.onLine === undefined) return;
        rest += dec.decode(chunk, { stream: true });
        const lines = rest.split("\n");
        rest = lines.pop() ?? "";
        for (const l of lines) options.onLine(name, l.replace(/\r$/, ""));
      });
      stream.on("end", () => {
        rest += dec.decode();
        if (options.onLine !== undefined && rest !== "") options.onLine(name, rest.replace(/\r$/, ""));
      });
    };
    collect("stdout", child.stdout);
    collect("stderr", child.stderr);
    let killer: ReturnType<typeof setTimeout> | undefined;
    const stop = (): void => {
      child.kill("SIGTERM");
      killer = setTimeout(() => child.kill("SIGKILL"), options.killAfterMs ?? 5000);
    };
    options.signal?.addEventListener("abort", stop, { once: true });
    if (options.signal?.aborted === true) stop();
    child.on("error", (e) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", stop);
      if (killer !== undefined) clearTimeout(killer);
      reject(mapError(e, cmd));
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", stop);
      if (killer !== undefined) clearTimeout(killer);
      const joined = (parts: readonly Uint8Array[]): Uint8Array => {
        const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let at = 0;
        for (const p of parts) {
          out.set(p, at);
          at += p.length;
        }
        return out;
      };
      const status = signal !== null ? 128 + signalNumber(signal) : (code ?? 1);
      resolve({ code: status, success: status === 0, signal, stdout: joined(kept.stdout), stderr: joined(kept.stderr) });
    });
    if (feeds && child.stdin !== null) {
      child.stdin.on("error", () => {/* the program closed its input early; what it did is still reported */});
      child.stdin.end(typeof input === "string" ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength));
    }
  });
}

/** A program run to its end, with its output as text (UTF-8). `NotFound` where there is no such program. */
export async function run(argv: readonly string[], options: RunOptions = {}): Promise<TextOutput> {
  const r = await output(argv, options);
  const dec = new TextDecoder();
  return { code: r.code, success: r.success, signal: r.signal, stdout: dec.decode(r.stdout), stderr: dec.decode(r.stderr) };
}

/** A program's standard output, where it succeeds; an `Error` naming the program, its status and what it said, where it does not. */
export async function must(argv: readonly string[], options: RunOptions = {}): Promise<string> {
  const r = await run(argv, options);
  if (!r.success) throw new Error(`${argv.join(" ")} failed (${r.code}): ${r.stderr.trim() || r.stdout.trim()}`);
  return r.stdout;
}

/** The first line a program prints, trimmed; `""` where it fails or cannot be found. */
export async function firstLine(argv: readonly string[], options: RunOptions = {}): Promise<string> {
  try {
    const r = await run(argv, options);
    return r.success ? (r.stdout.split("\n")[0] ?? "").trim() : "";
  } catch {
    return "";
  }
}

/** A signal this process can listen for. */
export type Signal = "SIGINT" | "SIGTERM" | "SIGHUP" | "SIGQUIT" | "SIGUSR1" | "SIGUSR2" | "SIGWINCH" | "SIGBREAK";

/** A function called when the process receives the signal. */
export function addSignalListener(signal: Signal, handler: () => void): void {
  process.on(signal, handler);
}

/** A function no longer called for the signal. */
export function removeSignalListener(signal: Signal, handler: () => void): void {
  process.off(signal, handler);
}

/** A promise that settles after `ms` milliseconds; an aborted `signal` rejects it early with the signal's reason. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason);
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
