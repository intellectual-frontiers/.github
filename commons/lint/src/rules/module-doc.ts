/**
 * `module-doc` (commons lint 0001-lint FR-006): a file begins with its module's documentation, a JSDoc block (`/** ... *\/`)
 * that says `@module`, before any code and before any other comment (a shebang may come first).
 *
 * Options: `tag` (`@module` by default) and `allow` (`[{ files, reason }]`).
 *
 * Spec: 0001-lint FR-006
 *
 * @module
 */
import { string } from "@intellectual-frontiers/core";
import { allowedFor, allowList, defineRule, fileOf, type Rule } from "../rule.ts";

/** The rule. */
export const moduleDoc: Rule = defineRule(
  {
    description: "a file begins with a JSDoc block that says @module",
    type: "suggestion",
    options: { tag: string, allow: allowList },
  },
  (context, options) => {
    if (allowedFor(options.allow, fileOf(context)) !== undefined) return {};
    const tag = options.tag ?? "@module";
    return {
      Program: (node) => {
        const first = context.sourceCode.getAllComments().find((c) => c.type !== "Shebang");
        const code = node.body[0]?.range?.[0] ?? Number.POSITIVE_INFINITY;
        const documented =
          first !== undefined &&
          first.type === "Block" &&
          first.value.startsWith("*") &&
          first.value.includes(tag) &&
          first.range[1] <= code;
        if (!documented) {
          context.report({
            loc: { line: 1, column: 0 },
            message: `begin the file with its module's documentation: a /** ... */ block that says ${tag}, before any code or other comment`,
          });
        }
      },
    };
  },
);
