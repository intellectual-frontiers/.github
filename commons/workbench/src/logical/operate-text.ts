// Spec: 0007-workbench-operate FR-002
/**
 * The helpers of the operate renderers: a template tag that writes `$@{` as `${` (so that the shell text of a script can hold `${x}` where the renderer interpolates with `${x}` too), and the quoting of the words a plan holds, which
 * `defineOperate` already confined to a safe alphabet. Pure.
 *
 * @example
 * ```ts
 * import { shq, text } from "./operate-text.ts";
 * text`echo $@{HOME} ${shq("a")}`; // "echo ${HOME} 'a'"
 * ```
 *
 * @module
 */

/** Join a template as written (raw), turning `$@{` into `${`. */
export function text(strings: TemplateStringsArray, ...values: readonly string[]): string {
  let out = "";
  for (const [i, s] of strings.raw.entries()) out += s.replaceAll("$@{", "${") + (values[i] ?? "");
  return out;
}

/** A word between single quotes: a word of a plan holds no quote (the decoder refuses one), and this refuses it again. */
export function shq(word: string): string {
  if (word.includes("'") || /[\u0000-\u001f\u007f-￿]/u.test(word)) throw new Error(`a word of a script holds a character it must not: ${JSON.stringify(word.slice(0, 24))}`);
  return `'${word}'`;
}

/** The words of a command, each quoted, joined by a space. */
export const shWords = (argv: readonly string[]): string => argv.map(shq).join(" ");

/** The name of a function of a script for a step id (a hyphen is an underscore). */
export const fnOf = (id: string): string => `step_${id.replaceAll("-", "_")}`;
