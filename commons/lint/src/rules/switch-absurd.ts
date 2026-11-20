/**
 * `switch-absurd` (commons lint 0001-lint FR-007): a `switch` over a union, on its discriminant (`x.kind` by default), ends in
 * a `default` that calls `absurd` (`default: return absurd(x)`), so that an alternative added to the union and left out does not
 * compile. A JavaScript rule has no types, so a switch over a union is a switch on a member named as one of the option `discriminants`;
 * with `every`, every switch is held to it.
 *
 * Options: `discriminants` (`["kind"]` by default), `functions` (the names of the exhaustive end, `["absurd"]` by default), `every` and
 * `allow` (`[{ files, reason }]`).
 *
 * Spec: 0001-lint FR-007
 *
 * @module
 */
import { array, boolean, string } from "@intellectual-frontiers/core";
import { allowedFor, allowList, defineRule, fileOf, isIdentifier, isMember, isNode, type Node, propertyOf, type Rule } from "../rule.ts";

/** Whether a statement of a `default` calls one of the functions: `f(x);`, `return f(x);`, `throw f(x);`, or in a block. */
export function callsOneOf(node: Node | null | undefined, functions: readonly string[]): boolean {
  if (node === null || node === undefined) return false;
  const child = (key: string): unknown => (key in node ? Reflect.get(node, key) : undefined);
  switch (node.type) {
    case "ReturnStatement":
    case "ThrowStatement": {
      const argument = child("argument");
      return isNode(argument) && callsOneOf(argument, functions);
    }
    case "ExpressionStatement": {
      const expression = child("expression");
      return isNode(expression) && callsOneOf(expression, functions);
    }
    case "BlockStatement": {
      const body = child("body");
      return Array.isArray(body) && body.some((s: unknown) => isNode(s) && callsOneOf(s, functions));
    }
    case "CallExpression": {
      const callee = child("callee");
      if (!isNode(callee)) return false;
      if (isIdentifier(callee)) return functions.includes(callee.name);
      const name = isMember(callee) ? propertyOf(callee) : undefined;
      return name !== undefined && functions.includes(name);
    }
    default:
      return false;
  }
}

/** The rule. */
export const switchAbsurd: Rule = defineRule(
  {
    description: "a switch over a union ends in a default that calls absurd",
    options: { discriminants: array(string), functions: array(string), every: boolean, allow: allowList },
  },
  (context, options) => {
    if (allowedFor(options.allow, fileOf(context)) !== undefined) return {};
    const discriminants = options.discriminants ?? ["kind"];
    const functions = options.functions ?? ["absurd"];
    return {
      SwitchStatement: (node) => {
        const d = node.discriminant;
        const property = isMember(d) ? propertyOf(d) : undefined;
        if (options.every !== true && (property === undefined || !discriminants.includes(property))) return;
        const last = node.cases.at(-1);
        if (last !== undefined && last.test === null && last.consequent.some((s) => callsOneOf(s, functions))) return;
        context.report({
          node,
          message: `end this switch in \`default: return ${functions[0] ?? "absurd"}(value)\`, so that an alternative left out does not compile`,
        });
      },
    };
  },
);
