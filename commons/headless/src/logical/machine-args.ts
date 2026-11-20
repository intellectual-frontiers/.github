// Spec: 0013-mcp-surface FR-001, FR-005
// Spec: 0014-rest-surface FR-001
/**
 * What a machine surface offers of a command and how it turns the arguments of a call into a command line (commons headless 0013-mcp-surface FR-001, FR-005 and 0014-rest-surface FR-001): the options a
 * caller may give (the command's own, but not those that only a person may give, and `--dry-run` and `--check` where the command has them), the JSON Schema of each, and the argument vector that a call's
 * arguments make. Shared by the tool server and the REST interface, so that the two take the same arguments in the same way. Pure.
 *
 * @remarks
 * An operand that starts with a dash is refused, so that an argument can never become a flag; a value option is written `--name=value`, so that a value that starts with a dash is still its value.
 *
 * @example
 * ```ts
 * import { flagOf } from "./machine-args.ts";
 * flagOf("dryRun"); // "--dry-run"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Option } from "@intellectual-frontiers/terminal/args";
import { standardOptions, type Placed } from "./model.ts";

/** The JSON Schema of one argument: the few forms the options of a command line need. */
export type ArgSchema =
  | { readonly type: "boolean"; readonly description: string }
  | { readonly type: "string"; readonly description: string }
  | { readonly type: "array"; readonly items: { readonly type: "string" }; readonly description: string };

/** The camelCase key as an option is written (`dryRun` is `--dry-run`). */
export function flagOf(key: string): string {
  return `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** The option keys of the command line that a tool offers: `dryRun` and `check`, where the command has them. */
const OFFERED: readonly string[] = ["dryRun", "check"];

/** The options of a command a client may give, by key: the command's own except those only a person may give, and `dryRun` and `check` where it has them. */
export function offeredOptions(p: Placed): Readonly<Record<string, Option>> {
  const own = Object.entries(p.command.options).filter(([k]) => !p.facts.humanOnly.includes(k));
  const standard = Object.entries(standardOptions(p.facts, p.reach)).filter(([k]) => OFFERED.includes(k));
  return Object.fromEntries([...own, ...standard]);
}

/** The JSON Schema of one option. */
export function schemaOfOption(o: Option): ArgSchema {
  switch (o.kind) {
    case "flag":
      return { type: "boolean", description: o.help };
    case "value":
      return { type: "string", description: o.help };
    case "many":
      return { type: "array", items: { type: "string" }, description: o.help };
    default:
      return absurd(o);
  }
}

/** Why arguments are not a command line. */
export type ArgError =
  | { readonly kind: "not-an-object" }
  | { readonly kind: "unknown-argument"; readonly name: string }
  | { readonly kind: "wrong-type"; readonly name: string; readonly expected: "boolean" | "string" | "array of strings" }
  | { readonly kind: "missing-argument"; readonly name: string }
  | { readonly kind: "looks-like-an-option"; readonly name: string };

/** The one sentence of an argument error. */
export function argErrorMessage(e: ArgError): string {
  switch (e.kind) {
    case "not-an-object":
      return "the arguments are an object";
    case "unknown-argument":
      return `${e.name} is not an argument of this tool`;
    case "wrong-type":
      return `${e.name} is a ${e.expected}`;
    case "missing-argument":
      return `${e.name} is required`;
    case "looks-like-an-option":
      return `${e.name} starts with a dash: an operand cannot be given as an option`;
    default:
      return absurd(e);
  }
}

const isText = (v: unknown): v is string => typeof v === "string";

/** The command line a call's arguments make: the words of the command, its options and operands; the operands are not options, whatever they hold. */
export function argvOf(p: Placed, args: unknown): Result<readonly string[], ArgError> {
  if (typeof args !== "object" || args === null || Array.isArray(args)) return err({ kind: "not-an-object" });
  const given = new Map(Object.entries(args).filter(([, v]) => v !== undefined && v !== null));
  const options = offeredOptions(p);
  const operands = p.command.operands;
  for (const name of given.keys()) if (!(name in options) && !operands.some((o) => o.name === name)) return err({ kind: "unknown-argument", name });
  const out: string[] = [...p.path];
  for (const [key, o] of Object.entries(options)) {
    const v = given.get(key);
    if (v === undefined) {
      if (o.kind === "value" && o.fallback.kind === "required") return err({ kind: "missing-argument", name: key });
      continue;
    }
    switch (o.kind) {
      case "flag":
        if (typeof v !== "boolean") return err({ kind: "wrong-type", name: key, expected: "boolean" });
        if (v) out.push(flagOf(key));
        break;
      case "value":
        if (!isText(v)) return err({ kind: "wrong-type", name: key, expected: "string" });
        out.push(`${flagOf(key)}=${v}`);
        break;
      case "many":
        if (!Array.isArray(v) || !v.every(isText)) return err({ kind: "wrong-type", name: key, expected: "array of strings" });
        for (const item of v) out.push(`${flagOf(key)}=${item}`);
        break;
      default:
        return absurd(o);
    }
  }
  for (const operand of operands) {
    const v = given.get(operand.name);
    if (v === undefined) {
      if (operand.arity === "one" || operand.arity === "many") return err({ kind: "missing-argument", name: operand.name });
      continue;
    }
    const words = operand.arity === "many" ? v : [v];
    if (!Array.isArray(words) || !words.every(isText)) return err({ kind: "wrong-type", name: operand.name, expected: operand.arity === "many" ? "array of strings" : "string" });
    if (words.some((w) => w.startsWith("-"))) return err({ kind: "looks-like-an-option", name: operand.name });
    out.push(...words);
  }
  return ok(out);
}
