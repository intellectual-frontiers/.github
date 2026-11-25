// Spec: 0008-form-runbook FR-003, FR-005
/**
 * The decoder of a runbook: a value that came from outside (a file, a message) is made into a runbook or into every reason it is not one, with no cast outside the decoders of core. A judge that carries an effect is
 * refused with its own code; a need is read by the workbench's own decoder of a contribution; a control is the reference of grc, as an object or as its URN. It is made of the decoders every form shares and of the
 * eight kinds of step of this form.
 *
 * @example
 * ```ts
 * import { decodeRunbook } from "./decode.ts";
 * decodeRunbook({}).kind; // "err"
 * ```
 *
 * @module
 */
import { array, type DecodeError, type Decoder, err, formatDecodeError, integer, literal, object, type Result, string, tagged } from "@intellectual-frontiers/core";
import { AUTONOMY } from "@intellectual-frontiers/workbench/governance";
import { effect, GATE_ACTIONS, EVIDENCE_KINDS, hasEffect, inputs, inputValue, literalValue, nodeHead, nodeOptional, outputSchema, verbId, viaId, workloadHead, workloadOptional, type Finding, finding, nodeId } from "@intellectual-frontiers/workload/governance";
import { runbookFinding } from "./catalog.ts";
import { defineRunbook } from "./define.ts";
import type { Runbook, Step } from "./step.ts";
import { EACH_KINDS } from "./terms.ts";

const judge: Decoder<Step> = (input, path = "$") => {
  const e = hasEffect(input, path);
  return e.kind === "err" ? e : object({ ...nodeHead, kind: literal("judge"), question: string, output: outputSchema }, nodeOptional)(input, path);
};

const step: Decoder<Step> = (input, path = "$") => stepOf(input, path);
const steps = array(step);
const stepOf: Decoder<Step> = tagged({
  verb: object({ ...nodeHead, kind: literal("verb"), verb: viaId(verbId), inputs, effect }, nodeOptional),
  check: object({ ...nodeHead, kind: literal("check"), asserts: string, using: viaId(verbId), inputs, evidence: literal(...EVIDENCE_KINDS) }, nodeOptional),
  ask: object({ ...nodeHead, kind: literal("ask"), question: string, approver: string, deadlineHours: integer }, nodeOptional),
  judge,
  branch: object({ ...nodeHead, kind: literal("branch"), on: viaId(nodeId), output: string, equals: literalValue, then: steps, otherwise: steps }, nodeOptional),
  each: object({ ...nodeHead, kind: literal("each"), over: literal(...EACH_KINDS), source: inputValue, body: steps }, nodeOptional),
  gate: object({ ...nodeHead, kind: literal("gate"), action: literal(...GATE_ACTIONS), approver: string, demands: literal(...AUTONOMY), guards: array(viaId(nodeId)) }, nodeOptional),
  undo: object({ ...nodeHead, kind: literal("undo"), compensates: viaId(nodeId), verb: viaId(verbId), inputs, effect }, nodeOptional),
});

const runbook: Decoder<Runbook> = object({ ...workloadHead, form: literal("runbook"), steps }, workloadOptional);

const toFinding = (e: DecodeError): Finding => (e.expected.includes("E-WL-JUDGE-EFFECT") ? finding("E-WL-JUDGE-EFFECT", e.path, formatDecodeError(e)) : runbookFinding("E-RB-RUNBOOK-MALFORMED", e.path, formatDecodeError(e), { node: e.path }));

/** A runbook from a value that came from outside, or every reason it is not one. */
export function decodeRunbook(input: unknown): Result<Runbook, readonly Finding[]> {
  const r = runbook(input);
  if (r.kind === "err") return err([toFinding(r.error)]);
  return defineRunbook(r.value);
}
