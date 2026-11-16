/**
 * `terminal-writers` (commons 0005-typescript-runtime FR-061): nothing writes to the terminal (`process.stdout`, `process.stderr`,
 * `console.*`, and the vendors' own streams) outside the files of the option `allow`, each with its reason; everything else emits a
 * signal, or writes through the one module a harness lists. A named import of `stdout` or `stderr` from `node:process` is refused too.
 *
 * Options: `writers` (`[{ object, property }]`, `property` `*` for any member; the list above by default) and `allow` (`[{ files,
 * reason }]`).
 *
 * @module
 */
import { array, object, string } from "../../kernel/decode.ts";
import { allowedFor, allowList, defineRule, fileOf, isIdentifier, isNode, nameOf, type Rule, stringOf } from "../rule.ts";

/** A writer: a global's member (`process.stdout`), or any of its members (`console.*`). */
export type Writer = { readonly object: string; readonly property: string };

/** The writers the rule refuses where none are given. */
export const TERMINAL_WRITERS: readonly Writer[] = [
  { object: "process", property: "stdout" },
  { object: "process", property: "stderr" },
  { object: "console", property: "*" },
  { object: "Bun", property: "stdout" },
  { object: "Bun", property: "stderr" },
];

/** The rule. */
export const terminalWriters: Rule = defineRule(
  {
    description: "no write to the terminal outside the files listed with their reasons",
    options: { writers: array(object({ object: string, property: string })), allow: allowList },
  },
  (context, options) => {
    if (allowedFor(options.allow, fileOf(context)) !== undefined) return {};
    const writers = options.writers ?? TERMINAL_WRITERS;
    const writes = (o: string, p: string): boolean => writers.some((w) => w.object === o && (w.property === "*" || w.property === p));
    const message = (what: string): string =>
      `${what} writes to the terminal: emit a signal or write through the module listed for it, or list this file with its reason in allow`;
    return {
      MemberExpression: (node) => {
        const name = nameOf(node);
        if (name !== undefined && writes(name[0], name[1])) context.report({ node, message: message(`${name[0]}.${name[1]}`) });
      },
      ImportDeclaration: (node) => {
        const source = stringOf(node.source);
        if (source !== "node:process" && source !== "process") return;
        for (const s of node.specifiers) {
          if (s.type !== "ImportSpecifier" || !("imported" in s)) continue;
          const imported: unknown = s.imported;
          const text = isNode(imported) ? (isIdentifier(imported) ? imported.name : stringOf(imported)) : undefined;
          if (text !== undefined && writes("process", text)) context.report({ node: s, message: message(`process.${text}`) });
        }
      },
    };
  },
);
