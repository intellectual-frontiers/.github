/**
 * `no-vendor-api` (commons 0005-typescript-runtime FR-061): no member of a vendor's global (`Deno.*`, `Bun.*` by default), in code or in
 * a type, outside the files of the option `allow`, each with its reason; a harness keeps its own list.
 *
 * Options: `globals` (the vendor globals, `["Deno", "Bun"]` by default) and `allow` (`[{ files, reason }]`, globs relative to the
 * linter's working folder).
 *
 * @module
 */
import { array, string } from "@intellectual-frontiers/core";
import { allowedFor, allowList, defineRule, fileOf, isIdentifier, isMember, nameOf, type Node, propertyOf, type Rule } from "../rule.ts";

/** The vendor globals the rule refuses where none are given. */
export const VENDOR_GLOBALS: readonly string[] = ["Deno", "Bun"];

/** The rule. */
export const noVendorApi: Rule = defineRule(
  {
    description: "no member of a vendor's global (Deno, Bun) outside the files listed with their reasons",
    options: { globals: array(string), allow: allowList },
  },
  (context, options) => {
    if (allowedFor(options.allow, fileOf(context)) !== undefined) return {};
    const globals = options.globals ?? VENDOR_GLOBALS;
    const refuse = (node: Node, what: string, vendor: string): void =>
      context.report({
        node,
        message: `${what} is ${vendor}'s own API: use a node: builtin or the runtime, or list this file with its reason in allow`,
      });
    return {
      MemberExpression: (node) => {
        const name = nameOf(node);
        if (name !== undefined && globals.includes(name[0])) {
          refuse(node, `${name[0]}.${name[1]}`, name[0]);
          return;
        }
        // `globalThis.Deno` itself, not as the object of a member (which the outer expression reports).
        const vendor = isIdentifier(node.object, "globalThis") ? propertyOf(node) : undefined;
        const outer = node.parent !== undefined && isMember(node.parent) && node.parent.object === node;
        if (vendor !== undefined && globals.includes(vendor) && !outer) refuse(node, `globalThis.${vendor}`, vendor);
      },
      TSQualifiedName: (node) => {
        if (isIdentifier(node.left) && globals.includes(node.left.name) && isIdentifier(node.right))
          refuse(node, `${node.left.name}.${node.right.name}`, node.left.name);
      },
    };
  },
);
