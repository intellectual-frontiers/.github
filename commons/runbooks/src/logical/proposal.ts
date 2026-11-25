// Spec: 0005-runbooks-runners FR-002
/**
 * The proposal of a judge: what an agent answered, decoded into the type the `judge` step declares or refused. The fields are exactly the declared ones, each of its type; a field that is not declared and a field that is
 * missing are refused, so that nothing outside the declared type is ever recorded. Pure.
 *
 * @example
 * ```ts
 * import { decodeProposal } from "./proposal.ts";
 * decodeProposal({ a: { kind: "text" } }, { a: "x" }).kind; // "ok"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { OutputSchema } from "@intellectual-frontiers/runbooks/governance";
import type { ProposedValue } from "./events.ts";

/** A proposal in the type a step declared, or every reason the answer is not that type. */
export function decodeProposal(schema: OutputSchema, raw: unknown): Result<Readonly<Record<string, ProposedValue>>, readonly string[]> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return err(["the answer is an object with the declared fields"]);
  const problems: string[] = [];
  const out: Record<string, ProposedValue> = {};
  for (const key of Object.keys(raw)) if (!Object.hasOwn(schema, key)) problems.push(`${key} is not a declared field`);
  for (const [name, type] of Object.entries(schema)) {
    const v: unknown = Reflect.get(raw, name);
    if (v === undefined) {
      problems.push(`${name} is missing`);
      continue;
    }
    switch (type.kind) {
      case "text":
        if (typeof v === "string") out[name] = v;
        else problems.push(`${name} is text`);
        break;
      case "integer":
        if (typeof v === "number" && Number.isInteger(v)) out[name] = v;
        else problems.push(`${name} is an integer`);
        break;
      case "flag":
        if (typeof v === "boolean") out[name] = v;
        else problems.push(`${name} is a flag`);
        break;
      case "choice":
        if (typeof v === "string" && type.of.includes(v)) out[name] = v;
        else problems.push(`${name} is one of ${type.of.join(", ")}`);
        break;
      case "texts":
        if (Array.isArray(v) && v.every((x): x is string => typeof x === "string")) out[name] = v;
        else problems.push(`${name} is a list of text`);
        break;
      default:
        return absurd(type);
    }
  }
  return problems.length === 0 ? ok(out) : err(problems);
}
