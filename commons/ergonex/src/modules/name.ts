// Spec: 0001-ergonex FR-005
/**
 * The name of a module (commons 0001-ergonex FR-005, FR-006): lower-case letters, digits and hyphens, beginning with a letter, at most 32 characters. A name with a path separator, a space, a dot or
 * any other character is refused before it is looked for and is never passed to a shell; a name no module has is answered with the nearest names.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/commons/ts/kernel";
import type { Brand } from "@intellectual-frontiers/commons/ts/kernel";
import { editDistance } from "../platform/k-args.ts";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";

/** The name of a module: `ergonex <name>` runs the module `ergonex-<name>`. */
export type ModuleName = Brand<string, "ModuleName">;

/** The longest name of a module. */
export const MAX_MODULE_NAME = 32;

/** Why a text is not a module name. */
export type NameError =
  | { readonly kind: "empty" }
  | { readonly kind: "too-long"; readonly length: number }
  | { readonly kind: "bad-start"; readonly text: string }
  | {
      readonly kind: "bad-character";
      readonly text: string;
      readonly character: string;
    };

/** A refusal as one sentence. */
export function describeNameError(e: NameError): string {
  switch (e.kind) {
    case "empty":
      return "a module name is not empty";
    case "too-long":
      return `a module name has at most ${MAX_MODULE_NAME} characters, not ${e.length}`;
    case "bad-start":
      return `${JSON.stringify(e.text)} does not begin with a lower-case letter, as a module name must`;
    case "bad-character":
      return `${JSON.stringify(e.text)} holds ${JSON.stringify(e.character)}, and a module name is lower-case letters, digits and hyphens`;
    default:
      return absurd(e);
  }
}

/** A module name from text, or why it is refused. The text is judged as it is: no trimming and no case folding. */
export function moduleName(text: string): Result<ModuleName, NameError> {
  if (text === "") return err({ kind: "empty" });
  if (text.length > MAX_MODULE_NAME) return err({ kind: "too-long", length: text.length });
  if (!/^[a-z]/.test(text)) return err({ kind: "bad-start", text });
  const bad = /[^a-z0-9-]/u.exec(text);
  if (bad !== null) return err({ kind: "bad-character", text, character: bad[0] });
  return ok(text as ModuleName);
}

/** The modules nearest a name nobody has: up to three, within an edit distance of two, the nearest first and, among equals, in alphabetical order. */
export function nearestNames(word: string, names: readonly string[]): readonly string[] {
  return names
    .map((n) => ({ n, d: editDistance(word, n) }))
    .filter((x) => x.d <= 2)
    .sort((a, b) => a.d - b.d || (a.n < b.n ? -1 : a.n > b.n ? 1 : 0))
    .slice(0, 3)
    .map((x) => x.n);
}
