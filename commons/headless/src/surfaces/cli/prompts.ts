// Spec: 0004-headless-cli FR-006
/**
 * Questions to the person (commons headless 0004-headless-cli FR-006): `ask` and `confirm` write the question to the person and read one line. With no
 * terminal on both ends (a pipe, a timer, a service), or when the run was told never to ask, they ask no one and answer `undefined`, so that the
 * caller falls back on the governance's decision (`decide`) instead of waiting on input that will never come. A confirmation is `true` only for a
 * plain yes; anything else, including nothing, is no.
 *
 * @example
 * ```ts
 * import { promptOf } from "./prompts.ts";
 * const p = promptOf({ interactive: false, readLine: async () => "y", write: () => {} });
 * await p.confirm("Delete?"); // undefined: there is no one to ask
 * ```
 *
 * @module
 */
import { NO_PROMPT, type Prompt } from "@intellectual-frontiers/headless/logical";

/** What a prompt needs: whether a person can be asked, where the question is written (the error stream, so that a report on standard output stays clean), and the input. */
export type PromptPorts = {
  readonly interactive: boolean;
  readonly readLine: () => Promise<string | undefined>;
  readonly write: (text: string) => void;
};

/** Whether a line is a yes. */
export function isYes(line: string): boolean {
  return /^\s*(y|yes)\s*$/i.test(line);
}

/** The prompt of a run. */
export function promptOf(p: PromptPorts): Prompt {
  if (!p.interactive) return NO_PROMPT;
  const ask = async (question: string): Promise<string | undefined> => {
    p.write(`${question} `);
    return await p.readLine();
  };
  return {
    ask,
    confirm: async (question) => {
      const answer = await ask(`${question} [y/N]`);
      return answer === undefined ? undefined : isYes(answer);
    },
  };
}
