// Spec: 0011-credential-prompt FR-007, FR-008
/**
 * The terminal of this process as a `TtyPort` (commons headless 0011-credential-prompt FR-007): it reads the standard input where that is a terminal and draws on the standard error, with the
 * echo turned off by the system's own means: on Linux and macOS by the program `stty` run on the terminal, on Windows by the console's input mode (raw mode), both behind the one port.
 * Where the standard input is not a terminal there is none to give, and the answer is `no-terminal`, never a read of something that is not a person.
 *
 * @remarks
 * Untested against a real terminal: a test has no terminal to read, so the real-process tests of this library stop at the port (`readerStep`, the adapter and the helper are tested with a port that
 * a test drives), and the echo is checked by hand on a terminal of each system. Reading the controlling terminal when the standard input is not one (`/dev/tty`, `CONIN$`) needs a read of a file with
 * no position, which the system's `FsFile` does not have yet: that is Planned (0011 Out of scope).
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { proc, stdio, tty } from "@intellectual-frontiers/system";
import { readerStep, START, ttyDevicesOf, type NoTerminal, type TtyHandle, type TtyPort } from "./terminal.ts";

type Os = "linux" | "darwin" | "windows";

/** The terminal of this process on a system. */
export function systemTty(os: Os): TtyPort {
  const devices = ttyDevicesOf(os);
  return {
    open: async (): Promise<Result<TtyHandle, NoTerminal>> => {
      if (!tty.isTerminal("stdin")) return err({ kind: "no-terminal", why: `standard input is not a terminal (${devices.input} is not read here)` });
      const decoder = new TextDecoder();
      const setEcho = async (on: boolean): Promise<boolean> => {
        switch (devices.echo) {
          case "stty": {
            const out = await proc.output(["stty", on ? "echo" : "-echo"], { stdin: "inherit", stdout: "null", stderr: "null" });
            return out.success;
          }
          case "console-mode":
            try {
              tty.setRaw(!on);
              return true;
            } catch {
              return false;
            }
        }
      };
      let hidden = false;
      const handle: TtyHandle = {
        write: (text) => void stdio.stderr.writeSync(text),
        readLine: async (echo, signal) => {
          if (!echo) {
            hidden = await setEcho(false);
            if (!hidden) return undefined;
          }
          const one = new Uint8Array(256);
          let state = START;
          // on Windows the console is in raw mode, so every key is read as typed; where `stty` turned the echo off the terminal still gives a line at a time, which the same reader reads whole
          while (!signal.aborted) {
            const n = await stdio.stdin.read(one);
            if (n === null) return undefined;
            const step = readerStep(state, decoder.decode(one.subarray(0, n), { stream: true }));
            if (step.kind === "line") return step.line;
            if (step.kind === "ended") return undefined;
            state = step.state;
          }
          return undefined;
        },
        close: () => {
          if (hidden) void setEcho(true);
          hidden = false;
        },
      };
      return ok(handle);
    },
  };
}
