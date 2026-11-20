/**
 * `no-registry-import` (commons lint 0001-lint FR-004): no module specifier that names a registry or a URL (`npm:`, `jsr:`,
 * `http:`, `https:` by default), in an import, an export, a dynamic `import()`, a type's `import()`, `import x = require()` or
 * `require()`; a package is installed and imported by its bare name.
 *
 * Options: `prefixes` (the refused beginnings of a specifier) and `allow` (`[{ files, reason }]`).
 *
 * Spec: 0001-lint FR-004
 *
 * @module
 */
import { array, string } from "@intellectual-frontiers/core";
import { allowedFor, allowList, defineRule, fileOf, isIdentifier, type Node, type Rule, stringOf } from "../rule.ts";

/** The beginnings of a specifier the rule refuses where none are given. */
export const REGISTRY_PREFIXES: readonly string[] = ["npm", "jsr", "http", "https"].map((scheme) => `${scheme}:`);

/** The rule. */
export const noRegistryImport: Rule = defineRule(
  {
    description: "no npm:, jsr: or URL module specifier: install the package and import it by its bare name",
    options: { prefixes: array(string), allow: allowList },
  },
  (context, options) => {
    if (allowedFor(options.allow, fileOf(context)) !== undefined) return {};
    const prefixes = options.prefixes ?? REGISTRY_PREFIXES;
    const check = (node: Node, source: Node | null | undefined): void => {
      const specifier = stringOf(source);
      const prefix = specifier === undefined ? undefined : prefixes.find((p) => specifier.toLowerCase().startsWith(p));
      if (specifier === undefined || prefix === undefined) return;
      context.report({
        node,
        message: `"${specifier}" names a registry or a URL (${prefix}): install the package and import it by its bare name`,
      });
    };
    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportAllDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
      TSImportType: (node) => check(node, node.source ?? node.argument),
      TSExternalModuleReference: (node) => check(node, node.expression),
      CallExpression: (node) => {
        if (isIdentifier(node.callee, "require")) check(node, node.arguments[0]);
      },
    };
  },
);
