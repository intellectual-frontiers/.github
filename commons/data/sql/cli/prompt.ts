// Spec: 0047-arcactl-init FR-013
/**
 * Asking a person (commons data 0047-arcactl-init FR-013): the questions `arcactl init` may ask at a terminal, as an interface, so that a test answers them and the server model (where nothing is
 * asked) has none. The terminal's own reads a line, and reads a secret with what is typed not shown.
 *
 * @module
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

/** Questions a person is asked. */
export interface Prompter {
  readonly interactive: boolean;
  /** A line, or the fallback where nothing is typed; none where nobody can answer. */
  ask(question: string, fallback?: string): Promise<string | undefined>;
  /** A line with what is typed not shown. */
  secret(question: string): Promise<string | undefined>;
  confirm(question: string): Promise<boolean>;
}

/** Where nothing can be asked: every question has no answer. */
export const silent: Prompter = { interactive: false, ask: async () => undefined, secret: async () => undefined, confirm: async () => false };

/** The prompter of a terminal. */
export function terminalPrompter(): Prompter {
  const line = (question: string, hide: boolean): Promise<string | undefined> =>
    new Promise((resolve) => {
      let muted = false;
      const output = new Writable({
        write(chunk, enc, cb) {
          if (!muted) process.stderr.write(chunk, enc);
          cb();
        },
      });
      const rl = createInterface({ input: process.stdin, output, terminal: true });
      rl.question(question, (answer) => {
        rl.close();
        if (hide) process.stderr.write("\n");
        resolve(answer);
      });
      muted = hide;
      rl.on("close", () => resolve(undefined));
    });
  return {
    interactive: true,
    ask: async (q, fallback) => {
      const a = await line(fallback === undefined ? `${q} ` : `${q} [${fallback}] `, false);
      return a === undefined ? undefined : a.trim() === "" ? fallback : a.trim();
    },
    secret: (q) => line(`${q} `, true),
    confirm: async (q) => /^y(es)?$/i.test((await line(`${q} [y/N] `, false))?.trim() ?? ""),
  };
}
