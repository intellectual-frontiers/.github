// Spec: 0002-guide FR-001
/**
 * The step of a guided flow, as a type and as a decoder (commons terminal 0002-guide FR-001). A guided flow is a deterministic machine that
 * emits ONE typed step at a time; this is the shape of that step, the same for a person at a terminal, for a pipe, for a tool and for a
 * test. It is generic: what a verb is and what it does is the caller's.
 *
 * `decodeStep` takes `unknown` (what a machine or a JSON document gave) and returns a `Result`: a field that is not declared for the kind
 * is refused, never dropped, so that a machine that grows a field the renderer does not know is told at once.
 *
 * @example
 * ```ts
 * import { decodeStep } from "./guide-model.ts";
 * decodeStep({ id: "s1", kind: "done", summary: "All set", say: "Nothing more to do." }); // { kind: "ok", value: { ... } }
 * decodeStep({ id: "s1", kind: "done", summary: "All set", say: "", colour: "red" }); // { kind: "err", error: { path: "$.colour", ... } }
 * ```
 *
 * @module
 */
import { type DecodeError, err, ok, type Result } from "@intellectual-frontiers/core";

/** The kinds of step. */
export type GuideKind = "question" | "run" | "human" | "wait" | "done";

/** Every kind, in a fixed order. */
export const GUIDE_KINDS: readonly GuideKind[] = ["question", "run", "human", "wait", "done"];

/** One thing the person is asked: the name of the answer, what to say to ask it and a hint of what a good answer looks like. */
export type AskField = {
  readonly field: string;
  readonly prompt: string;
  readonly hint: string;
  /** True for a token or a password: the guide refuses such a field (`E-GUIDE-SECRET-FIELD`); it is never read. */
  readonly secret?: boolean;
};

/** The call of a verb the caller knows by its id, with its inputs. */
export type GuideVerb = { readonly id: string; readonly inputs: Readonly<Record<string, unknown>> };

/** Who must act at a human step: always the person. */
export type GuideGate = { readonly who: "person" };

type Common = {
  readonly id: string;
  readonly summary: string;
  readonly say: string;
  /** References that back the step: a path, an identifier, an address. */
  readonly evidence?: readonly string[];
};

/** A step that asks the person for values. */
export type QuestionStep = Common & { readonly kind: "question"; readonly ask: readonly [AskField, ...AskField[]] };
/** A step that runs a verb of the caller. */
export type RunStep = Common & { readonly kind: "run"; readonly verb: GuideVerb };
/** A step that only the person can do; the guide waits for the person and never confirms for them. */
export type HumanStep = Common & { readonly kind: "human"; readonly gate: GuideGate; readonly ask?: readonly AskField[] };
/** A step that waits for something outside, and is asked for again. */
export type WaitStep = Common & { readonly kind: "wait" };
/** The end. */
export type DoneStep = Common & { readonly kind: "done" };

/** One step of a guided flow. */
export type GuideStep = QuestionStep | RunStep | HumanStep | WaitStep | DoneStep;

type Fail = Result<never, DecodeError>;

const fail = (path: string, expected: string, found: string): Fail => err({ kind: "decode", path, expected, found });

const describe = (v: unknown): string => {
  if (v === null) return "null";
  if (v === undefined) return "nothing";
  if (Array.isArray(v)) return "an array";
  if (typeof v === "string") return `the string ${JSON.stringify(v).slice(0, 60)}`;
  if (typeof v === "object") return "an object";
  return `${typeof v} ${String(v)}`;
};

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The first key of `o` that is not in `allowed`, as a failure. */
function unknownField(o: Readonly<Record<string, unknown>>, allowed: readonly string[], path: string): Fail | undefined {
  for (const key of Object.keys(o)) if (!allowed.includes(key)) return fail(`${path}.${key}`, `no such field (the fields are ${allowed.join(", ")})`, describe(o[key]));
  return undefined;
}

function text(o: Readonly<Record<string, unknown>>, key: string, path: string, nonEmpty: boolean): Result<string, DecodeError> {
  const v = o[key];
  if (typeof v !== "string") return fail(`${path}.${key}`, "a string", describe(v));
  if (nonEmpty && v.trim() === "") return fail(`${path}.${key}`, "a non-empty string", "an empty string");
  return ok(v);
}

function decodeField(input: unknown, path: string): Result<AskField, DecodeError> {
  if (!isRecord(input)) return fail(path, "an object", describe(input));
  const extra = unknownField(input, ["field", "prompt", "hint", "secret"], path);
  if (extra) return extra;
  const field = text(input, "field", path, true);
  if (field.kind === "err") return field;
  const prompt = text(input, "prompt", path, true);
  if (prompt.kind === "err") return prompt;
  const hint = text(input, "hint", path, false);
  if (hint.kind === "err") return hint;
  if (input["secret"] !== undefined && typeof input["secret"] !== "boolean") return fail(`${path}.secret`, "a boolean", describe(input["secret"]));
  return ok({
    field: field.value,
    prompt: prompt.value,
    hint: hint.value,
    ...(input["secret"] === undefined ? {} : { secret: input["secret"] }),
  });
}

function decodeAsk(input: unknown, path: string, nonEmpty: boolean): Result<readonly AskField[], DecodeError> {
  if (!Array.isArray(input)) return fail(path, "an array of fields", describe(input));
  if (nonEmpty && input.length === 0) return fail(path, "at least one field", "an empty array");
  const out: AskField[] = [];
  const seen = new Set<string>();
  for (const [i, item] of input.entries()) {
    const f = decodeField(item, `${path}[${i}]`);
    if (f.kind === "err") return f;
    if (seen.has(f.value.field)) return fail(`${path}[${i}].field`, "a field name used once", describe(f.value.field));
    seen.add(f.value.field);
    out.push(f.value);
  }
  return ok(out);
}

function decodeVerb(input: unknown, path: string): Result<GuideVerb, DecodeError> {
  if (!isRecord(input)) return fail(path, "an object", describe(input));
  const extra = unknownField(input, ["id", "inputs"], path);
  if (extra) return extra;
  const id = text(input, "id", path, true);
  if (id.kind === "err") return id;
  const inputs = input["inputs"];
  if (!isRecord(inputs)) return fail(`${path}.inputs`, "an object", describe(inputs));
  return ok({ id: id.value, inputs });
}

const COMMON = ["id", "kind", "summary", "say", "evidence"] as const;

/**
 * A step decoded from `unknown`: its `kind` decides which fields it has (a `question` has `ask`, a `run` has `verb`, a `human` has `gate` and
 * may have `ask`, a `wait` and a `done` have none of them), and a field that is not declared for the kind, a missing field and a field of the
 * wrong type are refused with the path of the field.
 */
export function decodeStep(input: unknown, path = "$"): Result<GuideStep, DecodeError> {
  if (!isRecord(input)) return fail(path, "an object", describe(input));
  const kind = input["kind"];
  if (typeof kind !== "string" || !GUIDE_KINDS.includes(kind as GuideKind)) return fail(`${path}.kind`, `one of ${GUIDE_KINDS.join(", ")}`, describe(kind));
  const k = kind as GuideKind;
  const allowed: readonly string[] =
    k === "question" ? [...COMMON, "ask"] : k === "run" ? [...COMMON, "verb"] : k === "human" ? [...COMMON, "gate", "ask"] : COMMON;
  const extra = unknownField(input, allowed, path);
  if (extra) return extra;
  const id = text(input, "id", path, true);
  if (id.kind === "err") return id;
  const summary = text(input, "summary", path, true);
  if (summary.kind === "err") return summary;
  const say = text(input, "say", path, false);
  if (say.kind === "err") return say;
  let evidence: readonly string[] | undefined;
  if (input["evidence"] !== undefined) {
    const e = input["evidence"];
    if (!Array.isArray(e)) return fail(`${path}.evidence`, "an array of strings", describe(e));
    for (const [i, item] of e.entries()) if (typeof item !== "string") return fail(`${path}.evidence[${i}]`, "a string", describe(item));
    evidence = e as readonly string[];
  }
  const common = { id: id.value, summary: summary.value, say: say.value, ...(evidence === undefined ? {} : { evidence }) };
  switch (k) {
    case "question": {
      if (input["ask"] === undefined) return fail(`${path}.ask`, "an array of fields", "nothing");
      const ask = decodeAsk(input["ask"], `${path}.ask`, true);
      if (ask.kind === "err") return ask;
      return ok({ ...common, kind: "question", ask: ask.value as QuestionStep["ask"] });
    }
    case "run": {
      if (input["verb"] === undefined) return fail(`${path}.verb`, "an object", "nothing");
      const verb = decodeVerb(input["verb"], `${path}.verb`);
      if (verb.kind === "err") return verb;
      return ok({ ...common, kind: "run", verb: verb.value });
    }
    case "human": {
      const gate = input["gate"];
      if (gate === undefined) return fail(`${path}.gate`, "an object", "nothing");
      if (!isRecord(gate)) return fail(`${path}.gate`, "an object", describe(gate));
      const extraGate = unknownField(gate, ["who"], `${path}.gate`);
      if (extraGate) return extraGate;
      if (gate["who"] !== "person") return fail(`${path}.gate.who`, "person", describe(gate["who"]));
      if (input["ask"] === undefined) return ok({ ...common, kind: "human", gate: { who: "person" } });
      const ask = decodeAsk(input["ask"], `${path}.ask`, false);
      if (ask.kind === "err") return ask;
      return ok({ ...common, kind: "human", gate: { who: "person" }, ask: ask.value });
    }
    case "wait":
      return ok({ ...common, kind: "wait" });
    case "done":
      return ok({ ...common, kind: "done" });
  }
}
