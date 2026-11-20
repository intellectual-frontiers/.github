// Spec: 0011-credential-prompt FR-007, FR-008
/**
 * The terminal adapter of the credential port (commons headless 0011-credential-prompt FR-007): it draws a prompt on a terminal, reads the answer with no echo and gives it as a `Secret`, and is
 * the same for every system because the terminal is a port of its own (`TtyPort`): what differs between Linux, macOS and Windows is how echo is turned off and which device is read, which is the
 * port's, not the adapter's. Also here, the pure reader that turns the bytes of a terminal into a line (`readerStep`): backspace, enter, Ctrl-C and Ctrl-D.
 *
 * @remarks
 * The adapter never writes the value anywhere: the prompt goes to the terminal, the answer is read into a string held by the `Secret`, and a visible answer (`confirm`) is echoed by the terminal's own
 * rules, not written by the adapter. A person who ends the input (Ctrl-C, Ctrl-D, the end of the stream) has cancelled, and so has an aborted signal.
 *
 * @example
 * ```ts
 * import { readerStep, START } from "./terminal.ts";
 * readerStep(readerStep(START, "a").state, "\r").kind; // "line"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { secretOf, type CredentialPort, type CredentialRefusal, type CredentialRequest, type Secret } from "@intellectual-frontiers/headless/logical";

/** What a terminal is, for the adapter: draw text, read an answer (with the echo on or off), and let go. */
export type TtyHandle = {
  /** Writes text to the terminal (the prompt, and the line break after an answer that was not echoed). */
  readonly write: (text: string) => void;
  /** Reads one line, with the echo off for a secret; `undefined` where the person ended the input or the signal was aborted. */
  readonly readLine: (echo: boolean, signal: AbortSignal) => Promise<string | undefined>;
  /** Gives the terminal back (the echo on again). */
  readonly close: () => void;
};

/** Why a terminal could not be had. */
export type NoTerminal = { readonly kind: "no-terminal"; readonly why: string };

/** The terminal as a port: opened when a prompt is to be drawn. */
export type TtyPort = { readonly open: () => Promise<Result<TtyHandle, NoTerminal>> };

/** The state of the reader: what has been typed. */
export type ReaderState = { readonly typed: string };

/** The start of a line. */
export const START: ReaderState = { typed: "" };

/** What one chunk of bytes did to the line: still reading, a whole line, or the end of the input. */
export type ReaderStep =
  | { readonly kind: "reading"; readonly state: ReaderState }
  | { readonly kind: "line"; readonly line: string }
  | { readonly kind: "ended" };

/**
 * The line of a terminal that sends characters as they are typed (raw mode, where the echo is off because nobody writes it): a character is added, backspace (`\b`, DEL) takes one away, enter (`\r`,
 * `\n`) ends the line, and Ctrl-C and Ctrl-D end the input. Pure: the same state and chunk give the same step.
 */
export function readerStep(state: ReaderState, chunk: string): ReaderStep {
  let typed = state.typed;
  for (const ch of chunk) {
    if (ch === "\r" || ch === "\n") return { kind: "line", line: typed };
    if (ch === "\u0003" || ch === "\u0004") return { kind: "ended" };
    if (ch === "\b" || ch === "\u007f") typed = typed.slice(0, -1);
    else if (ch >= " ") typed += ch;
  }
  return { kind: "reading", state: { typed } };
}

/** What the adapter writes for a request: the words, and a space after them where they do not end in one. */
export function drawPrompt(request: CredentialRequest): string {
  return request.prompt.endsWith(" ") ? request.prompt : `${request.prompt} `;
}

/** The credential port of a terminal. */
export function terminalCredentials(tty: TtyPort): CredentialPort {
  return {
    ask: async (request, limits): Promise<Result<Secret, CredentialRefusal>> => {
      if (limits.signal.aborted) return err({ kind: "cancelled" });
      const opened = await tty.open();
      if (opened.kind === "err") return err({ kind: "unavailable", why: opened.error.why });
      const handle = opened.value;
      try {
        handle.write(drawPrompt(request));
        const secret = request.kind !== "confirm";
        const line = await handle.readLine(!secret, limits.signal);
        if (secret) handle.write("\n");
        if (line === undefined) return err({ kind: "cancelled" });
        return ok(secretOf(line));
      } finally {
        handle.close();
      }
    },
  };
}

/** The devices of a system's terminal and how its echo is turned off: data the system adapter reads, so that the Windows variant is a row and not a branch of the adapter. */
export type TtyDevices = {
  /** What is read from when standard input is not a terminal (the controlling terminal). */
  readonly input: string;
  readonly output: string;
  /** How the echo is turned off: by the program `stty` run on the terminal, or by the console's own input mode. */
  readonly echo: "stty" | "console-mode";
};

/** The terminal of a system: `/dev/tty` where there is a controlling terminal, `CONIN$` and `CONOUT$` on Windows. */
export function ttyDevicesOf(os: "linux" | "darwin" | "windows"): TtyDevices {
  switch (os) {
    case "linux":
    case "darwin":
      return { input: "/dev/tty", output: "/dev/tty", echo: "stty" };
    case "windows":
      return { input: "CONIN$", output: "CONOUT$", echo: "console-mode" };
    default:
      return absurd(os);
  }
}
