/**
 * `import-boundary` (commons 0005-typescript-runtime FR-061): a relative import that leaves its package is refused; another package is
 * imported by its name. The packages are the option `roots`, folders relative to the linter's working folder, each a glob of whole
 * segments (`kernel`, `packages/*`, `lib/ts/*`); a file's package is the longest root it is in, and a file in none is not checked.
 *
 * Options: `roots` (the package and member folders) and `allow` (`[{ files, reason }]`).
 *
 * @module
 */
import { posix } from "node:path";
import { array, string } from "@intellectual-frontiers/core";
import { globToRegExp } from "@intellectual-frontiers/formats/glob";
import { allowedFor, allowList, defineRule, fileOf, isIdentifier, type Node, type Rule, stringOf } from "../rule.ts";

/** The folder of `file` that is its package: the longest of `roots` whose segments match its leading folders; undefined where none does. */
export function packageOf(file: string, roots: readonly string[]): string | undefined {
  const folders = file.split("/").slice(0, -1);
  let best: string | undefined;
  for (const root of roots) {
    const n = root.split("/").filter((s) => s !== "" && s !== ".").length;
    if (n === 0 || n > folders.length) continue;
    const head = folders.slice(0, n).join("/");
    const re = globToRegExp(root);
    if (re.kind === "ok" && re.value.test(head) && (best === undefined || head.length > best.length)) best = head;
  }
  return best;
}

/** Where a relative specifier lands from `file`, as a `/` path relative to the same folder as `file` (`../` where it leaves it). */
export function landing(file: string, specifier: string): string {
  return posix.normalize(posix.join(posix.dirname(file), specifier));
}

/** The rule. */
export const importBoundary: Rule = defineRule(
  {
    description: "a relative import stays in its package: import another package by its name",
    options: { roots: array(string), allow: allowList },
  },
  (context, options) => {
    const file = fileOf(context);
    const own = packageOf(file, options.roots ?? []);
    if (own === undefined || allowedFor(options.allow, file) !== undefined) return {};
    const check = (node: Node, source: Node | null | undefined): void => {
      const specifier = stringOf(source);
      if (specifier === undefined || !(specifier.startsWith("./") || specifier.startsWith("../"))) return;
      const target = landing(file, specifier);
      if (target.startsWith(`${own}/`)) return;
      context.report({ node, message: `"${specifier}" leaves the package ${own}/: import the other package by its name` });
    };
    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
      TSImportType: (node) => check(node, node.source ?? node.argument),
      CallExpression: (node) => {
        if (isIdentifier(node.callee, "require")) check(node, node.arguments[0]);
      },
    };
  },
);
