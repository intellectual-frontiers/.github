// Spec: 0001-system FR-019
/**
 * Standard input, output and error for what a program reads (commons 0001-system FR-019): JSON, a protocol on standard input
 * and output, bytes passed along a pipe. The names are plain (`read`, `readable`, `write`,
 * `writeSync`, `writable`). This file and `runtime/console.ts` are the only files of the runtime that write to
 * standard output or standard error: what a person reads goes through the console (0006-signals FR-026), what a program reads through here.
 *
 * Writes: `write` waits until the bytes are handed to the system and gives their length; `writeSync` writes them all to the file
 * descriptor before it returns (retrying while a non-blocking pipe is full), so it suits the last words of a process that is about to
 * exit. Both write the whole of what they are given. A closed pipe (`EPIPE`) rejects `write` and throws from `writeSync` as the runtime's
 * error; it never ends the process as an uncaught error.
 *
 * @example
 * ```ts
 * import { stdin, stdout } from "./stdio.ts";
 * const request = JSON.parse(await stdin.text());
 * await stdout.write(`${JSON.stringify({ ok: true, request })}\n`);
 * ```
 *
 * @module
 */
import { writeSync as fdWriteSync } from "node:fs";
import process from "node:process";
import { Readable, type Writable } from "node:stream";
import { mapError } from "./errors.ts";

// ---------------------------------------------------------------------------------------------------------------------------------
// Standard input
// ---------------------------------------------------------------------------------------------------------------------------------

/** Standard input. */
export type Stdin = {
  /** The whole of standard input as a web stream; made once, on first use. Bytes `read` took but did not give come first. */
  readonly readable: ReadableStream<Uint8Array>;
  /** Reads into `buffer` and gives how many bytes it read, or null at the end of the input. */
  read(buffer: Uint8Array): Promise<number | null>;
  /** The rest of standard input, to its end, as bytes. */
  bytes(): Promise<Uint8Array>;
  /** The rest of standard input, to its end, as text (UTF-8). */
  text(): Promise<string>;
};

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
 * Standard input over a source stream, made on first use: `read` keeps what did not fit in its buffer for the next `read`, and `readable`
 * gives that first. Exported so a test can drive it with a stream of its own.
 */
export function stdinOf(source: () => ReadableStream<Uint8Array>): Stdin {
  let base: ReadableStream<Uint8Array> | undefined;
  let whole: ReadableStream<Uint8Array> | undefined;
  let left: Uint8Array = new Uint8Array(0);
  const opened = (): ReadableStream<Uint8Array> => (base ??= source());
  const read = async (buffer: Uint8Array): Promise<number | null> => {
    if (buffer.length === 0) return 0;
    if (left.length === 0) {
      const reader = opened().getReader();
      try {
        const r = await reader.read();
        if (r.done) return null;
        left = r.value;
      } finally {
        reader.releaseLock();
      }
    }
    const n = Math.min(buffer.length, left.length);
    buffer.set(left.subarray(0, n));
    left = left.subarray(n);
    return n;
  };
  const readable = (): ReadableStream<Uint8Array> => {
    if (whole !== undefined) return whole;
    const reader = opened().getReader();
    whole = new ReadableStream<Uint8Array>({
      pull: async (controller): Promise<void> => {
        if (left.length > 0) {
          controller.enqueue(left);
          left = new Uint8Array(0);
          return;
        }
        const r = await reader.read();
        if (r.done) controller.close();
        else controller.enqueue(r.value);
      },
      cancel: async (reason: unknown): Promise<void> => reader.cancel(reason),
    });
    return whole;
  };
  const bytes = async (): Promise<Uint8Array> => {
    const parts: Uint8Array[] = [];
    const reader = readable().getReader();
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
  };
  return {
    get readable(): ReadableStream<Uint8Array> {
      return readable();
    },
    read,
    bytes,
    text: async (): Promise<string> => new TextDecoder().decode(await bytes()),
  };
}

/** This process's standard input. */
export const stdin: Stdin = stdinOf(
  // Node's stream becomes a web stream; its type is `node:stream/web`'s, which is the same class as the global one.
  () => Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
);

// ---------------------------------------------------------------------------------------------------------------------------------
// Standard output and standard error
// ---------------------------------------------------------------------------------------------------------------------------------

/** Standard output or standard error, for output a program reads. */
export type Stdout = {
  /** Writes bytes, or text as UTF-8, and gives how many bytes were written, once they are handed to the system. */
  write(data: Uint8Array | string): Promise<number>;
  /** Writes bytes, or text as UTF-8, all of them, before it returns; gives how many bytes were written. */
  writeSync(data: Uint8Array | string): number;
  /** A web stream onto it; closing the stream leaves the file descriptor open, as other writers may still use it. */
  readonly writable: WritableStream<Uint8Array>;
};

const encoder = new TextEncoder();
const bytesOf = (data: Uint8Array | string): Uint8Array => (typeof data === "string" ? encoder.encode(data) : data);

/** Waits about a millisecond without giving way to the event loop, while a non-blocking pipe is full. */
function pause(): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
}

/** Where a writer writes: a file descriptor for `writeSync`, a Node stream for `write`. */
type Sink = {
  readonly fd: number;
  readonly stream: () => Writable;
};

function stdoutOf(sink: Sink): Stdout {
  let guarded = false;
  const stream = (): Writable => {
    const s = sink.stream();
    if (!guarded) {
      guarded = true;
      // A closed pipe is reported to the writer that wrote, not as an uncaught error that ends the process.
      s.on("error", () => undefined);
    }
    return s;
  };
  const write = (data: Uint8Array | string): Promise<number> => {
    const bytes = bytesOf(data);
    return new Promise<number>((resolve, reject) => {
      stream().write(bytes, (e?: Error | null) => (e === undefined || e === null ? resolve(bytes.length) : reject(mapError(e))));
    });
  };
  const writeSync = (data: Uint8Array | string): number => {
    const bytes = bytesOf(data);
    let at = 0;
    while (at < bytes.length) {
      try {
        at += fdWriteSync(sink.fd, bytes, at, bytes.length - at);
      } catch (e) {
        if (typeof e === "object" && e !== null && "code" in e && e.code === "EAGAIN") pause();
        else throw mapError(e);
      }
    }
    return bytes.length;
  };
  let writable: WritableStream<Uint8Array> | undefined;
  return {
    write,
    writeSync,
    get writable(): WritableStream<Uint8Array> {
      return (writable ??= new WritableStream<Uint8Array>({
        write: async (chunk): Promise<void> => {
          await write(chunk);
        },
      }));
    },
  };
}

/** This process's standard output, for what a program reads. */
export const stdout: Stdout = stdoutOf({ fd: 1, stream: () => process.stdout });

/** This process's standard error, for what a program reads (a person's messages go through `runtime/console.ts`). */
export const stderr: Stdout = stdoutOf({ fd: 2, stream: () => process.stderr });
