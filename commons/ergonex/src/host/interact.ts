// Spec: 0003-host FR-019
/**
 * Asking a person a question (commons 0003-host FR-019): `ergonex shell --install` shows a diff and asks before it writes a start-up file. A question is asked only where standard input and standard
 * error are a terminal; the answer is one line of standard input, read a byte at a time so that nothing after the line is taken from a pipe.
 *
 * @module
 */
import { stdin, stderr } from "../platform/r-stdio.ts";
import { isTerminal } from "../platform/r-tty.ts";
import type { Interact } from "../modules/types.ts";

/** One line of standard input, or undefined at its end. */
async function readLine(): Promise<string | undefined> {
  const bytes: number[] = [];
  const one = new Uint8Array(1);
  for (;;) {
    const n = await stdin.read(one);
    if (n === null || n === 0) return bytes.length === 0 ? undefined : new TextDecoder().decode(new Uint8Array(bytes));
    const b = one[0] ?? 10;
    if (b === 10) return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\r$/, "");
    bytes.push(b);
  }
}

/** This process's terminal: it asks on standard error and reads standard input. */
export function terminalInteract(): Interact {
  return {
    terminal: isTerminal("stdin") && isTerminal("stderr"),
    ask: async (question) => {
      stderr.writeSync(question);
      return await readLine();
    },
  };
}
