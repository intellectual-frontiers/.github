// Spec: 0031-operations FR-001, FR-002
/**
 * Operations (commons data 0031-operations): the business operations of a model as contracts. A contract says what an operation is for, what it takes, what it reads and writes (concepts of the
 * domain), what permission it needs, what it records in the audit trail and whether it runs as its caller or as the service; it holds no SQL and names no database. A lint holds contracts to the
 * domain they are for. How an operation is done, and run, is an extension's (`sql/extensions/operations`).
 *
 * @module
 */
import { annotationsOf } from "./annotation.ts";
import { domainId } from "./id.ts";
import type { Domain } from "./model.ts";
import { type Finding, finding } from "./vocabulary.ts";
import { classification } from "./vocabularies/security.ts";

/** The type of an input of an operation. */
export type InputType = "text" | "integer" | "number" | "boolean" | "instant" | "textList";

/** An input: its type, and whether it may be left out. */
export interface Input {
  readonly type: InputType;
  readonly optional?: boolean;
}

/** What a project says of an operation. */
export interface OperationSpec {
  readonly definition: string;
  /** A `command` changes the database; a `query` only reads it. */
  readonly kind: "command" | "query";
  readonly input: Readonly<Record<string, InputType | Input>>;
  /** The concepts it reads, by name. */
  readonly reads: readonly string[];
  /** The concepts it writes, by name; a query writes none. */
  readonly writes?: readonly string[];
  /** The permission the caller must hold, as `resource:action`. */
  readonly requires?: string;
  /** Says that anyone may call it, with no permission. */
  readonly public?: boolean;
  /** Says what its implementation checks to decide who may call it, where that is more than a permission (for example, that the caller is the one the input names): in words. A contract has exactly one of `requires`, `public` and `checkedBy` (0031-operations FR-009). */
  readonly checkedBy?: string;
  /** The input that holds the tenant the permission is held in. */
  readonly scope?: string;
  /** What it records in the audit trail, each as `subject.verb`; a command that records none says so by leaving this empty. */
  readonly emits?: readonly string[];
  /** Whether it runs as the caller, with the caller's rights, or as the service, with its own. */
  readonly runsAs: "caller" | "service";
  /** Whether doing it twice with the same input leaves the same state. */
  readonly idempotent: boolean;
  /** The requirement it serves, as text. */
  readonly serves?: string;
}

/** An operation. */
export interface Operation {
  readonly kind: "operation";
  readonly name: string;
  readonly spec: Required<Omit<OperationSpec, "requires" | "scope" | "serves" | "public" | "checkedBy">> & Pick<OperationSpec, "requires" | "scope" | "serves" | "public" | "checkedBy">;
  /** Its inputs, each with its type and whether it is optional. */
  readonly input: Readonly<Record<string, Required<Input>>>;
}

/**
 * An operation.
 *
 * @param name - its name, in lower camel case
 * @param spec - its contract
 * @returns the operation, frozen
 */
export function operation(name: string, spec: OperationSpec): Operation {
  const input = Object.fromEntries(
    Object.entries(spec.input).map(([k, v]) => [k, Object.freeze(typeof v === "string" ? { type: v, optional: false } : { type: v.type, optional: v.optional ?? false })]),
  );
  return Object.freeze({
    kind: "operation",
    name,
    spec: Object.freeze({ ...spec, writes: spec.writes ?? [], emits: spec.emits ?? [] }),
    input: Object.freeze(input),
  });
}

/** What the lint holds an operation to. */
export type OperationRule = "operation/unknown-concept" | "operation/query-writes" | "operation/permission-form" | "operation/emit-form" | "operation/restricted-as-caller" | "operation/duplicate" | "operation/scope-unknown" | "operation/command-silent" | "operation/no-permission" | "operation/access-ambiguous";

const PERMISSION = /^[a-z][A-Za-z0-9]*:[a-z][A-Za-z0-9.]*$/;
const ACTION = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;

/**
 * The findings of operations against the domain they are for.
 *
 * @param d - the domain
 * @param operations - the operations
 * @returns the findings: a concept that is not there, a query that writes, a permission or an audit action that is not of its form, a command that writes a restricted concept and runs as its caller, a
 * scope that is not an input, a duplicate name, and a command that writes and records nothing
 */
export function lintOperations(d: Domain, operations: readonly Operation[]): readonly Finding[] {
  const out: Finding[] = [];
  const concepts = new Map(d.concepts.map((c) => [c.name, c]));
  const seen = new Set<string>();
  for (const o of operations) {
    const id = domainId(d.name);
    if (seen.has(o.name)) out.push(finding("operation/duplicate", id, `the operation ${o.name} is there twice`, "error"));
    seen.add(o.name);
    for (const n of [...o.spec.reads, ...o.spec.writes]) if (!concepts.has(n)) out.push(finding("operation/unknown-concept", id, `${o.name} names the concept ${n}, which the domain does not have`, "error"));
    if (o.spec.kind === "query" && o.spec.writes.length > 0) out.push(finding("operation/query-writes", id, `the query ${o.name} says it writes ${o.spec.writes.join(", ")}`, "error"));
    if (o.spec.requires !== undefined && !PERMISSION.test(o.spec.requires)) out.push(finding("operation/permission-form", id, `${o.name} requires ${o.spec.requires}, which is not \`resource:action\``, "error"));
    const ways = [o.spec.requires !== undefined, o.spec.public === true, o.spec.checkedBy !== undefined].filter(Boolean).length;
    if (ways === 0) out.push(finding("operation/no-permission", id, `${o.name} requires no permission and is not said to be public or checked by its implementation: name the permission, say \`public: true\`, or say what \`checkedBy\` it`, "error"));
    if (ways > 1) out.push(finding("operation/access-ambiguous", id, `${o.name} says more than one of requires, public and checkedBy: it is one of them`, "error"));
    for (const a of o.spec.emits) if (!ACTION.test(a)) out.push(finding("operation/emit-form", id, `${o.name} emits ${a}, which is not \`subject.verb\``, "error"));
    if (o.spec.scope !== undefined && !(o.spec.scope in o.input)) out.push(finding("operation/scope-unknown", id, `${o.name} is scoped by ${o.spec.scope}, which is not one of its inputs`, "error"));
    if (o.spec.kind === "command" && o.spec.writes.length > 0 && o.spec.emits.length === 0) out.push(finding("operation/command-silent", id, `the command ${o.name} writes and records nothing in the audit trail`, "warning"));
    if (o.spec.runsAs === "caller")
      for (const n of o.spec.writes) {
        const c = concepts.get(n);
        if (c !== undefined && annotationsOf(c, classification).includes("restricted")) out.push(finding("operation/restricted-as-caller", id, `${o.name} writes ${n}, which is restricted, and runs as its caller: it must run as the service`, "error"));
      }
  }
  return out;
}
