// Spec: 0002-runbooks-algebra FR-003, FR-004, FR-005
/**
 * The decoder of a runbook: a value that came from outside (a file, a message) is made into a runbook or into every reason it is not one, with no cast outside the decoders of core. A judge that carries an effect is
 * refused with its own code; a need is read by the workbench's own decoder of a contribution; a control is the reference of grc, as an object or as its URN.
 *
 * @example
 * ```ts
 * import { decodeRunbook } from "./decode.ts";
 * decodeRunbook({}).kind; // "err"
 * ```
 *
 * @module
 */
import {
  array,
  boolean,
  type DecodeError,
  type Decoder,
  describe,
  err,
  formatDecodeError,
  integer,
  literal,
  mapDecoder,
  object,
  ok,
  record,
  type Result,
  string,
  tagged,
} from "@intellectual-frontiers/core";
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import { isCapability } from "@intellectual-frontiers/anyfs/governance";
import { type ControlRef, parseControlUrn } from "@intellectual-frontiers/grc/governance";
import { AUTONOMY, decodeContribution, type Requirement } from "@intellectual-frontiers/workbench/governance";
import { type Finding, finding } from "./catalog.ts";
import { defineRunbook } from "./define.ts";
import { parseCite, runbookId, type SpecCite, stepId, storeRef, verbId } from "./ids.ts";
import type { FieldType, InputValue, OutputSchema, Runbook, Step } from "./step.ts";
import { EACH_KINDS, EVIDENCE_KINDS, GATE_ACTIONS, MODES, STORE_CLASSES } from "./terms.ts";
import { INPUT_TYPES, type InputSpec } from "./verbs.ts";
import type { StoreDecl } from "./effect.ts";

const fail = (path: string, expected: string, input: unknown): Result<never, DecodeError> => err({ kind: "decode", path, expected, found: describe(input) });

const viaId = <T>(make: (t: unknown) => Result<T, string>): Decoder<T> => (input, path = "$") => {
  const r = make(input);
  return r.kind === "ok" ? r : fail(path, r.error, input);
};

const cite: Decoder<SpecCite> = (input, path = "$") => {
  const text = typeof input === "object" && input !== null ? `${String(Reflect.get(input, "spec"))} ${String(Reflect.get(input, "requirement"))}` : input;
  if (typeof text !== "string") return fail(path, "a citation such as 0003-runbooks-effects FR-001", input);
  const r = parseCite(text);
  return r.kind === "ok" ? r : fail(path, r.error, input);
};

const control: Decoder<ControlRef> = (input, path = "$") => {
  if (typeof input === "string") {
    const r = parseControlUrn(input);
    return r.kind === "ok" ? r : fail(path, r.error, input);
  }
  return object({ framework: string, version: string, control: string })(input, path);
};

const needs: Decoder<readonly Requirement[]> = (input, path = "$") => {
  const r = decodeContribution("runbook", { requirements: input });
  return r.kind === "ok" ? ok(r.value.requirements) : fail(path, `requirements of the workbench (${r.error.join("; ")})`, input);
};

const capability: Decoder<Capability> = (input, path = "$") => (typeof input === "string" && isCapability(input) ? ok(input) : fail(path, "a capability of AnyFS", input));

const literalValue: Decoder<string | number | boolean> = (input, path = "$") => (typeof input === "string" || typeof input === "number" || typeof input === "boolean" ? ok(input) : fail(path, "a string, a number or a boolean", input));

const inputValue: Decoder<InputValue> = tagged({
  literal: object({ kind: literal("literal"), value: literalValue }),
  store: object({ kind: literal("store"), store: viaId(storeRef) }),
  output: object({ kind: literal("output"), step: viaId(stepId), name: string }),
  input: object({ kind: literal("input"), name: string }),
});

const inputs = record(inputValue);

const effect = object({ store: viaId(storeRef), class: literal(...STORE_CLASSES), mode: literal(...MODES), reversible: boolean }, { compensation: viaId(stepId), idempotencyKey: string });

const field: Decoder<FieldType> = tagged({
  text: object({ kind: literal("text") }),
  integer: object({ kind: literal("integer") }),
  flag: object({ kind: literal("flag") }),
  choice: object({ kind: literal("choice"), of: array(string) }),
  texts: object({ kind: literal("texts") }),
});
const output: Decoder<OutputSchema> = record(field);

const common = { id: viaId(stepId), title: string, spec: array(cite) } as const;
const opt = { controls: array(control), needs } as const;

const hasEffect: Decoder<unknown> = (input, path = "$") =>
  typeof input === "object" && input !== null && Reflect.has(input, "effect") ? fail(path, "no effect: a judge only proposes (E-RB-JUDGE-EFFECT)", "an effect") : ok(input);

const judge: Decoder<Step> = (input, path = "$") => {
  const e = hasEffect(input, path);
  return e.kind === "err" ? e : object({ ...common, kind: literal("judge"), question: string, output }, opt)(input, path);
};

const step: Decoder<Step> = (input, path = "$") => stepOf(input, path);
const steps = array(step);
const stepOf: Decoder<Step> = tagged({
  verb: object({ ...common, kind: literal("verb"), verb: viaId(verbId), inputs, effect }, opt),
  check: object({ ...common, kind: literal("check"), asserts: string, using: viaId(verbId), inputs, evidence: literal(...EVIDENCE_KINDS) }, opt),
  ask: object({ ...common, kind: literal("ask"), question: string, approver: string, deadlineHours: integer }, opt),
  judge,
  branch: object({ ...common, kind: literal("branch"), on: viaId(stepId), output: string, equals: literalValue, then: steps, otherwise: steps }, opt),
  each: object({ ...common, kind: literal("each"), over: literal(...EACH_KINDS), source: inputValue, body: steps }, opt),
  gate: object({ ...common, kind: literal("gate"), action: literal(...GATE_ACTIONS), approver: string, demands: literal(...AUTONOMY), guards: array(viaId(stepId)) }, opt),
  undo: object({ ...common, kind: literal("undo"), compensates: viaId(stepId), verb: viaId(verbId), inputs, effect }, opt),
});

const inputSpec: Decoder<InputSpec> = object({ name: string, type: literal(...INPUT_TYPES), required: boolean });
const storeDecl: Decoder<StoreDecl> = object({ ref: viaId(storeRef), class: literal(...STORE_CLASSES), needs: array(capability) });

const runbook: Decoder<Runbook> = mapDecoder(
  object({ id: viaId(runbookId), title: string, version: string, summary: string, given: array(string), needs, inputs: array(inputSpec), stores: array(storeDecl), steps }),
  (r): Runbook => r,
);

const toFinding = (e: DecodeError): Finding => finding(e.expected.includes("E-RB-JUDGE-EFFECT") ? "E-RB-JUDGE-EFFECT" : "E-RB-RUNBOOK-MALFORMED", e.path, formatDecodeError(e), { step: e.path });

/** A runbook from a value that came from outside, or every reason it is not one. */
export function decodeRunbook(input: unknown): Result<Runbook, readonly Finding[]> {
  const r = runbook(input);
  if (r.kind === "err") return err([toFinding(r.error)]);
  return defineRunbook(r.value);
}
