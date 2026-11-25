// Spec: 0003-workload-forms FR-001
/**
 * The decoders every form shares, with no cast outside the decoders of core: the id decoders, a control as an object or as its URN, the needs read by the workbench's own decoder of a contribution, the effect, the inputs of a
 * node, the type of a judge's output, the head of a node and the head of a workload with its trigger. A form's own decoder is made of these and of its own closed sum of nodes.
 *
 * @example
 * ```ts
 * import { trigger } from "./decode.ts";
 * trigger({ kind: "schedule", cadence: "monthly" }).kind; // "ok"
 * trigger({ kind: "cron" }).kind; // "err"
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
  integer,
  literal,
  object,
  ok,
  record,
  type Result,
  string,
  tagged,
} from "@intellectual-frontiers/core";
import { type Capability, isCapability } from "@intellectual-frontiers/anyfs/governance";
import { type ControlRef, parseControlUrn } from "@intellectual-frontiers/grc/governance";
import { decodeContribution, type Requirement } from "@intellectual-frontiers/workbench/governance";
import type { StoreDecl } from "./effect.ts";
import { nodeId, parseCite, type SpecCite, storeRef, workloadId } from "./ids.ts";
import type { Effect } from "./effect.ts";
import type { Expectation, FieldType, InputValue, Inputs, OutputSchema, ScheduleSlot, Trigger } from "./node.ts";
import { CADENCES, MODES, OUTCOMES, STORE_CLASSES } from "./terms.ts";
import { INPUT_TYPES, type InputSpec } from "./verbs.ts";

/** A decode failure at a path. */
export const fail = (path: string, expected: string, input: unknown): Result<never, DecodeError> => err({ kind: "decode", path, expected, found: describe(input) });

/** A decoder made of a smart constructor of an id. */
export const viaId = <T>(make: (t: unknown) => Result<T, string>): Decoder<T> => (input, path = "$") => {
  const r = make(input);
  return r.kind === "ok" ? r : fail(path, r.error, input);
};

/** A citation of a spec: `0002-workload-effects FR-001`. */
export const cite: Decoder<SpecCite> = (input, path = "$") => {
  const text = typeof input === "object" && input !== null ? `${String(Reflect.get(input, "spec"))} ${String(Reflect.get(input, "requirement"))}` : input;
  if (typeof text !== "string") return fail(path, "a citation such as 0002-workload-effects FR-001", input);
  const r = parseCite(text);
  return r.kind === "ok" ? r : fail(path, r.error, input);
};

/** A control of a catalog: the reference of grc as an object or as its URN. */
export const control: Decoder<ControlRef> = (input, path = "$") => {
  if (typeof input === "string") {
    const r = parseControlUrn(input);
    return r.kind === "ok" ? r : fail(path, r.error, input);
  }
  return object({ framework: string, version: string, control: string })(input, path);
};

/** What a workload or a node needs, as requirements of the workbench, read by the workbench's own decoder. */
export const needs: Decoder<readonly Requirement[]> = (input, path = "$") => {
  const r = decodeContribution("workload", { requirements: input });
  return r.kind === "ok" ? ok(r.value.requirements) : fail(path, `requirements of the workbench (${r.error.join("; ")})`, input);
};

/** A capability of AnyFS. */
export const capability: Decoder<Capability> = (input, path = "$") => (typeof input === "string" && isCapability(input) ? ok(input) : fail(path, "a capability of AnyFS", input));

/** A literal: a string, a number or a boolean. */
export const literalValue: Decoder<string | number | boolean> = (input, path = "$") => (typeof input === "string" || typeof input === "number" || typeof input === "boolean" ? ok(input) : fail(path, "a string, a number or a boolean", input));

/** The value of an input of a verb node. */
export const inputValue: Decoder<InputValue> = tagged({
  literal: object({ kind: literal("literal"), value: literalValue }),
  store: object({ kind: literal("store"), store: viaId(storeRef) }),
  output: object({ kind: literal("output"), step: viaId(nodeId), name: string }),
  input: object({ kind: literal("input"), name: string }),
});

/** The inputs of a node by name. */
export const inputs: Decoder<Inputs> = record(inputValue);

/** An effect. */
export const effect: Decoder<Effect> = object({ store: viaId(storeRef), class: literal(...STORE_CLASSES), mode: literal(...MODES), reversible: boolean }, { compensation: viaId(nodeId), idempotencyKey: string });

const field: Decoder<FieldType> = tagged({
  text: object({ kind: literal("text") }),
  integer: object({ kind: literal("integer") }),
  flag: object({ kind: literal("flag") }),
  choice: object({ kind: literal("choice"), of: array(string) }),
  texts: object({ kind: literal("texts") }),
});

/** The type a judge's output decodes into. */
export const outputSchema: Decoder<OutputSchema> = record(field);

/** The head every node has: its id, title and citations. */
export const nodeHead = { id: viaId(nodeId), title: string, spec: array(cite) } as const;

/** What a node may have besides: controls and needs. */
export const nodeOptional = { controls: array(control), needs } as const;

/** The slot of a schedule: the minute and the fields of the cadence that has them, integers whose range is checked against the cadence by the schedule. */
export const slot: Decoder<ScheduleSlot> = object({ minute: integer }, { hour: integer, weekday: integer, day: integer, month: integer });

/** The trigger of a workload: a closed sum. */
export const trigger: Decoder<Trigger> = tagged({
  manual: object({ kind: literal("manual") }),
  schedule: object({ kind: literal("schedule"), cadence: literal(...CADENCES) }, { at: slot }),
  event: object({ kind: literal("event"), name: string }),
  alert: object({ kind: literal("alert"), name: string }),
});

/** The outcome a run is expected to have. */
export const expectation: Decoder<Expectation> = object({ outcome: literal(...OUTCOMES) });

/** One input of a workload. */
export const inputSpec: Decoder<InputSpec> = object({ name: string, type: literal(...INPUT_TYPES), required: boolean });

/** One store of a workload. */
export const storeDecl: Decoder<StoreDecl> = object({ ref: viaId(storeRef), class: literal(...STORE_CLASSES), needs: array(capability) });

/** The fields every workload has, as a form's own decoder takes them, and the one it may have besides. */
export const workloadHead = { id: viaId(workloadId), title: string, version: string, summary: string, given: array(string), needs, inputs: array(inputSpec), stores: array(storeDecl), trigger } as const;

/** The optional fields of the head of a workload. */
export const workloadOptional = { expect: expectation } as const;

/** Whether an input names a judge with an effect: a judge is refused with its own code. */
export const hasEffect: Decoder<unknown> = (input, path = "$") =>
  typeof input === "object" && input !== null && Reflect.has(input, "effect") ? fail(path, "no effect: a judge only proposes (E-WL-JUDGE-EFFECT)", "an effect") : ok(input);
