// Spec: 0001-system FR-009
/**
 * The process and the programs it runs (commons 0005-typescript-runtime FR-022, FR-052, FR-053), on `node:process`, `node:child_process`
 * and `node:os`, the same on Bun and on Node 26. The names are short and plain (`env.get`, `args`, `exit`, `cwd`, `build.os`, `build.target`,
 * `ppid`, `output`, `spawn`, `unrefTimer`); `selfCommand` gives the argument vector for a program that runs itself again, from a script or
 * from a compiled binary. A program is always run by its argument
 * vector, never through a shell; one that cannot be found throws `NotFound`, and a non-zero exit is an outcome, not an error. Taken
 * from erga's `lib/ts/process`, Stolos's `src/archon/core/exec.ts` and the setup's `proc.ts`.
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
import { spawn as spawn_ } from "node:child_process";
import { statSync } from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import { basename, delimiter, join, resolve as resolvePath } from "node:path";
import process from "node:process";
import { Readable, Writable } from "node:stream";
import { setTimeout as nodeSetTimeout } from "node:timers";
import { absurd } from "@intellectual-frontiers/core";
import { InvalidData, mapError, NotFound, toError } from "./errors.ts";

/**
 * What runs a program inside a trace: it is given the program's argument vector and a function that runs it with the environment to add (`TRACEPARENT` and `TRACESTATE`), and gives that
 * function's outcome. The telemetry of commons installs one when its module is loaded (commons 0032-lifting-libraries: this library does not import the telemetry); with none installed a
 * program is run with nothing added.
 */
export type ProcessTracer = <T extends { readonly code: number }>(
  argv: readonly string[],
  run: (env: Readonly<Record<string, string>>) => Promise<T>,
) => Promise<T>;

let tracer: ProcessTracer | undefined;

/** Installs the function that traces the programs this module runs (or, with `undefined`, removes it): a program is a `process` span where one is installed (0006-signals FR-018). */
export function setProcessTracer(t: ProcessTracer | undefined): void {
  tracer = t;
}

function traceProcess<T extends { readonly code: number }>(
  argv: readonly string[],
  run: (env: Readonly<Record<string, string>>) => Promise<T>,
): Promise<T> {
  return tracer === undefined ? run({}) : tracer(argv, run);
}

/** The process's environment. */
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

/** The id of the process's parent (FR-053); a function, as the parent changes where the first one ends. */
export function ppid(): number {
  return process.ppid;
}

/** The path of the runtime's executable (bun or node). */
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

/** An operating system, by the names `build.os` gives. */
export type Os = "linux" | "darwin" | "windows" | "freebsd" | "netbsd" | "openbsd" | "solaris" | "aix" | "android" | "other";
/** A processor, by the names `build.arch` gives. */
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

/**
 * The target triple (as Rust and Bun name it) for an operating system and a processor (FR-053): `x86_64-unknown-linux-gnu`, `aarch64-apple-darwin`,
 * `x86_64-pc-windows-msvc`, `aarch64-linux-android`, and `<arch>-unknown-<os>` for the rest.
 */
export function tripleOf(os: Os, arch: Arch): string {
  switch (os) {
    case "linux":
      return `${arch}-unknown-linux-gnu`;
    case "darwin":
      return `${arch}-apple-darwin`;
    case "windows":
      return `${arch}-pc-windows-msvc`;
    case "android":
      return `${arch}-linux-android`;
    case "freebsd":
    case "netbsd":
    case "openbsd":
    case "solaris":
    case "aix":
    case "other":
      return `${arch}-unknown-${os}`;
    default:
      return absurd(os);
  }
}

/** The platform this process runs on, with the target triple (FR-053). */
export const build: { readonly os: Os; readonly arch: Arch; readonly target: string } = Object.freeze({
  os: osOf(process.platform),
  arch: archOf(process.arch),
  target: tripleOf(osOf(process.platform), archOf(process.arch)),
});

/** Which runtime runs this code. */
export type RuntimeName = "bun" | "node";

/** Which runtime runs this code, from `process.versions`, which each of them fills: Bun, the default, or Node 26, the backup. */
export function runtimeName(): RuntimeName {
  const v: Readonly<Record<string, string | undefined>> = process.versions;
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
  const candidates =
    name.includes("/") || (windows && name.includes("\\"))
      ? [name]
      : path
          .split(delimiter)
          .filter((d) => d !== "")
          .flatMap((d) => exts.map((e) => join(d, `${name}${e}`)));
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
  /** Text or bytes it reads as its standard input; without it, `stdin` says what it gets. */
  readonly input?: string | Uint8Array;
  /** Its standard input where there is no `input`: this process's own (`inherit`), or none (`null`, the default). */
  readonly stdin?: "inherit" | "null";
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

/** How a program ended. */
export type Status = {
  /** Its exit status; 128 plus the signal's number where a signal ended it, as a shell reports it. */
  readonly code: number;
  /** Whether its exit status was 0. */
  readonly success: boolean;
  /** The signal that ended it (`SIGTERM`), or null. */
  readonly signal: string | null;
};

/** What a program did, with its output as bytes. */
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

const SIGNALS: Readonly<Record<string, number>> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGABRT: 6,
  SIGKILL: 9,
  SIGPIPE: 13,
  SIGALRM: 14,
  SIGTERM: 15,
};

/** The number of a signal by its name (1 for one it does not know). */
export function signalNumber(name: string): number {
  return SIGNALS[name] ?? os.constants.signals[name as keyof typeof os.constants.signals] ?? 1;
}

const stdio = (s: Stdio | undefined): "pipe" | "inherit" | "ignore" => (s === "inherit" ? "inherit" : s === "null" ? "ignore" : "pipe");

/** The environment a program is given: this process's with `env` added, or `env` alone with `clearEnv`. */
const childEnv = (options: {
  readonly env?: Readonly<Record<string, string>>;
  readonly clearEnv?: boolean;
}): Record<string, string | undefined> => (options.clearEnv === true ? { ...options.env } : { ...process.env, ...options.env });

/** An exit status as a shell reports it: 128 plus the signal's number where a signal ended the program. */
function exitStatus(code: number | null, signal: string | null): Status {
  const status = signal !== null ? 128 + signalNumber(signal) : (code ?? 1);
  return { code: status, success: status === 0, signal };
}

/** Byte arrays joined into one. */
function joined(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * A program run to its end, by its argument vector and never through a shell, with what it did. `NotFound` where there is no such program.
 * Where a telemetry pipeline is installed, the run is a `process` span and the program is given its `TRACEPARENT` (0006-signals FR-018).
 */
export function output(argv: readonly string[], options: RunOptions = {}): Promise<Output> {
  const [cmd, ...rest] = argv;
  if (cmd === undefined || cmd === "") return Promise.reject(new InvalidData("nothing to run: the argument vector is empty", "EINVAL"));
  return traceProcess(argv, (trace) =>
    spawnOutput(cmd, rest, Object.keys(trace).length === 0 ? options : { ...options, env: { ...trace, ...options.env } }),
  );
}

function spawnOutput(cmd: string, rest: readonly string[], options: RunOptions): Promise<Output> {
  const input = options.input;
  const feeds = input !== undefined;
  return new Promise<Output>((resolve, reject) => {
    let settled = false;
    const child = spawn_(cmd, rest, {
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      env: childEnv(options),
      stdio: [feeds ? "pipe" : options.stdin === "inherit" ? "inherit" : "ignore", stdio(options.stdout), stdio(options.stderr)],
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
      resolve({ ...exitStatus(code, signal), stdout: joined(kept.stdout), stderr: joined(kept.stderr) });
    });
    if (input !== undefined && child.stdin !== null) {
      child.stdin.on("error", () => {
        /* the program closed its input early; what it did is still reported */
      });
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

// ---------------------------------------------------------------------------------------------------------------------------------
// A program that runs beside this one (FR-052)
// ---------------------------------------------------------------------------------------------------------------------------------

/** A signal a program can be sent. */
export type KillSignal = Signal | "SIGKILL" | "SIGABRT" | "SIGALRM" | "SIGSTOP" | "SIGCONT" | "SIGPIPE";

/** How to start a program that runs beside this one; each stream is this process's own (`inherit`) unless asked. */
export type SpawnOptions = {
  /** Its working folder. */
  readonly cwd?: string;
  /** Variables added to its environment (or its whole environment, with `clearEnv`). */
  readonly env?: Readonly<Record<string, string>>;
  /** Start it with no variable but those of `env`. */
  readonly clearEnv?: boolean;
  /** Its standard input: a `WritableStream` (`piped`), this process's own (the default), or none. */
  readonly stdin?: Stdio;
  /** Its standard output: a `ReadableStream` (`piped`), this process's own (the default), or thrown away. */
  readonly stdout?: Stdio;
  /** Its standard error: a `ReadableStream` (`piped`), this process's own (the default), or thrown away. */
  readonly stderr?: Stdio;
  /** Stopping it: SIGTERM when the signal aborts, then SIGKILL after `killAfterMs`. */
  readonly signal?: AbortSignal;
  /** How long a program being stopped has between SIGTERM and SIGKILL (5000 ms by default), by `signal` or by `await using`. */
  readonly killAfterMs?: number;
};

/** A program while it runs `await using` stops it (SIGTERM, then SIGKILL) where it still runs, and waits for it. */
export type Child = AsyncDisposable & {
  /** Its process id. */
  readonly pid: number;
  /** Its standard input, where it is piped; closing the stream closes its input. */
  readonly stdin: WritableStream<Uint8Array> | null;
  /** Its standard output, where it is piped. */
  readonly stdout: ReadableStream<Uint8Array> | null;
  /** Its standard error, where it is piped. */
  readonly stderr: ReadableStream<Uint8Array> | null;
  /** How it ended, once it ends; rejected with the runtime's error where it could not be started. */
  readonly status: Promise<Status>;
  /** Sends it a signal (SIGTERM by default); nothing where it has already ended. */
  kill(signal?: KillSignal): void;
  /** Its whole output and error, read from the piped streams (empty where not piped), and its status, once it ends. */
  output(): Promise<Output>;
  /** It keeps this process alive until it ends (the default). */
  ref(): void;
  /** It no longer keeps this process alive; nor do its pipes. */
  unref(): void;
};

/** The value of `PATH` in an environment, whatever its case on Windows. */
function pathIn(environment: Readonly<Record<string, string | undefined>>): string {
  const direct = environment["PATH"];
  if (direct !== undefined) return direct;
  const key = Object.keys(environment).find((k) => k.toUpperCase() === "PATH");
  return key === undefined ? "" : (environment[key] ?? "");
}

/** Whether a program exists to run: a path (from `cwd`) that is executable, or a name found on the environment's `PATH`. */
function findable(cmd: string, environment: Readonly<Record<string, string | undefined>>, cwd: string | undefined): boolean {
  const pathLike = cmd.includes("/") || (process.platform === "win32" && cmd.includes("\\"));
  return pathLike ? isExecutable(resolvePath(cwd ?? process.cwd(), cmd)) : which(cmd, pathIn(environment)) !== undefined;
}

/** A Node stream that may be referenced and unreferenced (a pipe's socket). */
type Refable = { ref?: () => unknown; unref?: () => unknown };

/** Bytes to read to the end, joined; nothing where there is no stream. */
async function readAll(stream: ReadableStream<Uint8Array> | null): Promise<Uint8Array> {
  if (stream === null) return new Uint8Array(0);
  const parts: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      parts.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  return joined(parts);
}

/**
 * Starts a program by its argument vector, never through a shell, and gives its handle while it runs (FR-052). A program that cannot be found throws `NotFound` at once: a path that is not an executable file, or a name not
 * on the `PATH` of the environment it is given. Where a telemetry pipeline is installed, the run is a `process` span that ends when the
 * program does, and the program is given its `TRACEPARENT` (0006-signals FR-018), as for `output`.
 *
 * @example
 * ```ts
 * import { spawn } from "./proc.ts";
 * await using child = spawn(["gzip", "-dc"], { stdin: "piped", stdout: "piped" });
 * ```
 */
export function spawn(argv: readonly string[], options: SpawnOptions = {}): Child {
  const [cmd, ...rest] = argv;
  if (cmd === undefined || cmd === "") throw new InvalidData("nothing to run: the argument vector is empty", "EINVAL");
  if (!findable(cmd, childEnv(options), options.cwd)) throw new NotFound(`no such program: ${cmd}`, "ENOENT", cmd);
  const box: { started?: Started } = {};
  const status = traceProcess(argv, (trace) => {
    const started = startChild(cmd, rest, Object.keys(trace).length === 0 ? options : { ...options, env: { ...trace, ...options.env } });
    box.started = started;
    return started.exited;
  });
  // A program that could not be started rejects `status`; that is the caller's to see, never an unhandled rejection of its own.
  status.catch(() => undefined);
  const started = box.started;
  // The span's function runs at once (kernel/signals.ts `span`), so the handle is there; this guards against a change to that.
  if (started === undefined) throw new Error("the program's handle was not made");
  const { pipes } = started;
  return {
    ...pipes,
    status,
    output: async (): Promise<Output> => {
      const [stdout, stderr, st] = await Promise.all([readAll(pipes.stdout), readAll(pipes.stderr), status]);
      return { ...st, stdout, stderr };
    },
    kill: started.kill,
    ref: started.ref,
    unref: started.unref,
    [Symbol.asyncDispose]: started.dispose,
  };
}

/** A started program, before its status is traced. */
type Started = {
  readonly pipes: Pick<Child, "pid" | "stdin" | "stdout" | "stderr">;
  readonly exited: Promise<Status>;
  readonly kill: Child["kill"];
  readonly ref: () => void;
  readonly unref: () => void;
  readonly dispose: () => Promise<void>;
};

function startChild(cmd: string, rest: readonly string[], options: SpawnOptions): Started {
  const node = spawn_(cmd, rest, {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    env: childEnv(options),
    stdio: [stdio(options.stdin ?? "inherit"), stdio(options.stdout ?? "inherit"), stdio(options.stderr ?? "inherit")],
    windowsHide: true,
  });
  let ended = false;
  let killer: ReturnType<typeof setTimeout> | undefined;
  const stop = (): void => {
    if (ended) return;
    node.kill("SIGTERM");
    killer ??= setTimeout(() => {
      if (!ended) node.kill("SIGKILL");
    }, options.killAfterMs ?? 5000);
  };
  const exited = new Promise<Status>((resolve, reject) => {
    const done = (): void => {
      ended = true;
      options.signal?.removeEventListener("abort", stop);
      if (killer !== undefined) clearTimeout(killer);
    };
    node.once("error", (e) => {
      if (ended) return;
      done();
      reject(mapError(e, cmd));
    });
    node.once("exit", (code, signal) => {
      if (ended) return;
      done();
      resolve(exitStatus(code, signal));
    });
  });
  options.signal?.addEventListener("abort", stop, { once: true });
  if (options.signal?.aborted === true) stop();
  node.stdin?.on("error", () => {
    /* the program closed its input early; the writer sees the error, and the program's status says what it did */
  });
  // Node's streams become web streams; their types are `node:stream/web`'s, which are the same classes as the global ones.
  const stdin = node.stdin === null ? null : (Writable.toWeb(node.stdin) as WritableStream<Uint8Array>);
  const stdout = node.stdout === null ? null : (Readable.toWeb(node.stdout) as ReadableStream<Uint8Array>);
  const stderr = node.stderr === null ? null : (Readable.toWeb(node.stderr) as ReadableStream<Uint8Array>);
  // A pipe is a `net.Socket`, which can be unreferenced; the stream types do not say so.
  const pipes = (): Refable[] => [node.stdin, node.stdout, node.stderr].flatMap((s): Refable[] => (s === null ? [] : [s as Refable]));
  return {
    pipes: { pid: node.pid ?? 0, stdin, stdout, stderr },
    exited,
    kill: (signal: KillSignal = "SIGTERM"): void => {
      if (!ended) node.kill(signal);
    },
    ref: (): void => {
      node.ref();
      for (const p of pipes()) p.ref?.();
    },
    unref: (): void => {
      node.unref();
      for (const p of pipes()) p.unref?.();
    },
    dispose: async (): Promise<void> => {
      stop();
      await exited.catch(() => undefined);
      for (const p of [node.stdin, node.stdout, node.stderr]) p?.destroy();
    },
  };
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
      reject(toError(signal.reason, "aborted"));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      reject(toError(signal?.reason, "aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Timers that never keep the process alive, and the program running itself again (FR-053)
// ---------------------------------------------------------------------------------------------------------------------------------

/** A timer that can be cleared, by call or by `using`. */
export type Timer = Disposable & {
  /** The timer cleared: its function is not called. */
  clear(): void;
};

/**
 * Calls `callback` after `ms` milliseconds, with a timer that never keeps the process alive (FR-053): where nothing
 * else is left to do, the process ends without waiting for it. It is made on `node:timers`, whose timers can be unreferenced on each
 * runtime.
 */
export function unrefTimer(callback: () => void, ms: number): Timer {
  const t = nodeSetTimeout(callback, ms);
  t.unref();
  const clear = (): void => clearTimeout(t);
  return { clear, [Symbol.dispose]: clear };
}

/** What `selfCommand` reads of the running process: `process.execPath`, `process.argv` and `process.execArgv`, and the runtime. */
export type SelfFacts = {
  readonly runtime: RuntimeName;
  readonly execPath: string;
  readonly argv: readonly string[];
  readonly execArgv: readonly string[];
};

/** The facts of this process, for `selfCommandOf`. */
export function selfFacts(): SelfFacts {
  return { runtime: runtimeName(), execPath: process.execPath, argv: [...process.argv], execArgv: [...process.execArgv] };
}

/** The names a runtime's own executable starts with (`bun`, `bun-debug`, `node`, `nodejs`, `node26`, `node.exe`, ...). */
const RUNTIME_EXECUTABLE = /^(?:bun|node)(?:[-._\d]|js|$)/i;

/**
 * Whether the running program is a binary that holds its own code (FR-053), so that running it again needs no script. Either is enough:
 * - Bun's own mark of a binary it compiled: the script's path, `process.argv[1]`, is in Bun's embedded file system (`/$bunfs/...`, or
 *   `B:\~BUN\...` on Windows), where it keeps the code it compiled in;
 * - the executable, `process.execPath`, is not named as a runtime is (`bun`, `node`, with any version or `.exe`): the binaries
 *   that `bun build --compile` and Node's single executable applications make are named after the program.
 */
export function isCompiled(facts: SelfFacts): boolean {
  const script = facts.argv[1] ?? "";
  if (script.startsWith("/$bunfs/") || /^[A-Za-z]:[\\/]~BUN[\\/]/.test(script)) return true;
  return !RUNTIME_EXECUTABLE.test(basename(facts.execPath.replace(/\\/g, "/")));
}

/**
 * The argument vector that runs the program again with `args` (FR-053): from a compiled binary,
 * the binary alone; on Bun and Node, the runtime with its own options (`process.execArgv`) and the script. With no script (code given on the command line), the runtime alone.
 */
export function selfCommandOf(facts: SelfFacts, args: readonly string[] = []): readonly string[] {
  if (isCompiled(facts)) return [facts.execPath, ...args];
  const script = facts.argv[1];
  const scriptArgs = script === undefined ? [] : [script];
  switch (facts.runtime) {
    case "bun":
    case "node":
      return [facts.execPath, ...facts.execArgv, ...scriptArgs, ...args];
    default:
      return absurd(facts.runtime);
  }
}

/** The argument vector that runs this program again with `args`, on Bun and Node and from a binary Bun compiled (FR-053). */
export function selfCommand(args: readonly string[] = []): readonly string[] {
  return selfCommandOf(selfFacts(), args);
}

/** One address of one network interface. */
export type NetworkInterfaceInfo = {
  /** The interface's name (`lo`, `eth0`, `en0`, `Ethernet`). */
  readonly name: string;
  /** The address's family. */
  readonly family: "IPv4" | "IPv6";
  /** The address. */
  readonly address: string;
  /** Its netmask. */
  readonly netmask: string;
  /** The address with its prefix length (`127.0.0.1/8`), where known. */
  readonly cidr: string | null;
  /** The IPv6 scope, where there is one. */
  readonly scopeid: number | null;
  /** The hardware address (`00:00:00:00:00:00` where there is none). */
  readonly mac: string;
  /** Whether it is internal (a loopback), not reachable from outside. */
  readonly internal: boolean;
};

/** Every address of every network interface of this computer (0005-typescript-runtime FR-056). */
export function networkInterfaces(): readonly NetworkInterfaceInfo[] {
  const out: NetworkInterfaceInfo[] = [];
  for (const [name, infos] of Object.entries(os.networkInterfaces())) {
    for (const i of infos ?? []) {
      out.push({
        name,
        family: net.isIPv6(i.address) ? "IPv6" : "IPv4",
        address: i.address,
        netmask: i.netmask,
        cidr: i.cidr,
        scopeid: i.family === "IPv6" ? i.scopeid : null,
        mac: i.mac,
        internal: i.internal,
      });
    }
  }
  return out;
}
