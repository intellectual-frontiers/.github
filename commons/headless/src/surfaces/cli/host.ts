// Spec: 0004-headless-cli FR-011, FR-013
/**
 * The one place the command line touches a process (commons headless 0004-headless-cli FR-011, FR-013): it binds `Io` to this process's environment,
 * streams, clock, signals and files, and `launch` runs a program with it, making the check of its start first where it has one. Everything else in
 * the surface is a function of the `Io` it is given.
 *
 * @example
 * ```ts
 * import { launch } from "./host.ts";
 * // process.exitCode = await launch(program);
 * ```
 *
 * @module
 */
import { fs, path, proc, stdio, tty } from "@intellectual-frontiers/system";
import type { Program } from "@intellectual-frontiers/headless/logical";
import type { Io, RunObserver, SignalPort, TimerPort } from "./io.ts";
import { formatStartupFailure, startupExit, type StartupFailure } from "./launcher.ts";
import { run } from "./run.ts";
import type { StateStore, StoredFile } from "./state.ts";

/** The files of the state, on this system's file system: each operation is best effort. */
export function fsStore(): StateStore {
  return {
    readText(file) {
      try {
        return fs.readTextFileSync(file);
      } catch {
        return undefined;
      }
    },
    writeText(file, text) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeTextFileSync(file, text);
      } catch {
        /* a hint shown twice is harmless */
      }
    },
    appendText(file, text) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeTextFileSync(file, text, { append: true });
      } catch {
        /* a lost log line is not a failure of the run */
      }
    },
    list(dir) {
      try {
        return fs.readDirSync(dir).flatMap((e): readonly StoredFile[] => {
          if (!e.isFile) return [];
          try {
            return [{ name: e.name, mtimeMs: fs.statSync(path.join(dir, e.name)).mtime?.getTime() }];
          } catch {
            return [{ name: e.name, mtimeMs: undefined }];
          }
        });
      } catch {
        return [];
      }
    },
    remove(file) {
      try {
        fs.removeSync(file);
      } catch {
        /* it stays */
      }
    },
  };
}

/** The process's signals. */
export const processSignals: SignalPort = {
  on(signal, handler) {
    proc.addSignalListener(signal, handler);
    return () => proc.removeSignalListener(signal, handler);
  },
};

/** The timer of the process. */
export const processTimer: TimerPort = {
  every(ms, fn) {
    const h = setInterval(fn, ms);
    if (typeof h === "object" && "unref" in h) h.unref();
    return () => clearInterval(h);
  },
};

/** One line from standard input, without its line ending; `undefined` where the input ends first. */
export async function readStdinLine(): Promise<string | undefined> {
  const dec = new TextDecoder();
  const one = new Uint8Array(1);
  let line = "";
  for (;;) {
    const n = await stdio.stdin.read(one);
    if (n === null) return line === "" ? undefined : line;
    const ch = dec.decode(one.subarray(0, n), { stream: true });
    if (ch === "\n") return line.replace(/\r$/, "");
    line += ch;
  }
}

/** The `Io` of this process; its output is written as it comes. */
export function hostIo(options: { readonly observer?: RunObserver } = {}): Io {
  const size = tty.consoleSize();
  return {
    env: (name) => {
      const v = proc.env.get(name);
      return v === "" ? undefined : v;
    },
    os: proc.build.os === "windows" ? "windows" : proc.build.os === "darwin" ? "darwin" : "linux",
    terminal: { stdin: tty.isTerminal("stdin"), stdout: tty.isTerminal("stdout"), stderr: tty.isTerminal("stderr") },
    columns: size?.columns,
    now: () => Date.now(),
    pid: proc.pid,
    readLine: readStdinLine,
    state: fsStore(),
    signals: processSignals,
    timer: processTimer,
    ...(options.observer === undefined ? {} : { observer: options.observer }),
    sink: { out: (t) => void stdio.stdout.writeSync(t), err: (t) => void stdio.stderr.writeSync(t) },
  };
}

/** What a launch can be given. */
export type LaunchOptions = {
  /** The arguments, after the program's name; the process's own by default. */
  readonly argv?: readonly string[];
  /** Checks that the program can start (its configuration, a file it needs): a failure ends it with the status of its kind and writes one line. */
  readonly ready?: () => Promise<StartupFailure | undefined> | StartupFailure | undefined;
  readonly observer?: RunObserver;
};

/** Runs the program in this process and gives its status; the caller sets `process.exitCode` to it. */
export async function launch(program: Program, options: LaunchOptions = {}): Promise<number> {
  const io = hostIo(options.observer === undefined ? {} : { observer: options.observer });
  if (options.ready !== undefined) {
    let failure: StartupFailure | undefined;
    try {
      failure = await options.ready();
    } catch (e) {
      failure = { kind: "software", message: e instanceof Error ? e.message : String(e) };
    }
    if (failure !== undefined) {
      io.sink?.err(formatStartupFailure(program.name, failure));
      return startupExit(failure);
    }
  }
  return (await run(program, options.argv ?? proc.args, io)).code;
}
