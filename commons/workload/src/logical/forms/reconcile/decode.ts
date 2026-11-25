// Spec: 0009-form-reconcile FR-001, FR-002
/**
 * The decoder of a reconcile: a value that came from outside is made into a loop or into every reason it is not one, with no cast outside the decoders of core. It is made of the decoders every form shares and of the six
 * kinds of node of this form.
 *
 * @example
 * ```ts
 * import { decodeReconcile } from "./decode.ts";
 * decodeReconcile({}).kind; // "err"
 * ```
 *
 * @module
 */
import { array, type DecodeError, type Decoder, err, formatDecodeError, literal, object, string, tagged, type Result } from "@intellectual-frontiers/core";
import { AUTONOMY } from "@intellectual-frontiers/workbench/governance";
import { effect, EVIDENCE_KINDS, type Finding, inputs, nodeHead, nodeId, nodeOptional, verbId, viaId, workloadHead, workloadOptional } from "@intellectual-frontiers/workload/governance";
import { reconcileFinding } from "./catalog.ts";
import { defineReconcile } from "./define.ts";
import type { Reconcile, ReconcileNode } from "./node.ts";
import { OBSERVATIONS } from "./terms.ts";

const node: Decoder<ReconcileNode> = tagged({
  observe: object({ ...nodeHead, kind: literal("observe"), of: literal(...OBSERVATIONS), using: viaId(verbId), inputs, evidence: literal(...EVIDENCE_KINDS) }, nodeOptional),
  diff: object({ ...nodeHead, kind: literal("diff"), actual: viaId(nodeId), desired: viaId(nodeId) }, nodeOptional),
  plan: object({ ...nodeHead, kind: literal("plan"), from: viaId(nodeId) }, nodeOptional),
  approve: object({ ...nodeHead, kind: literal("approve"), plan: viaId(nodeId), approver: string, demands: literal(...AUTONOMY), guards: array(viaId(nodeId)) }, nodeOptional),
  apply: object({ ...nodeHead, kind: literal("apply"), plan: viaId(nodeId), verb: viaId(verbId), inputs, effect }, nodeOptional),
  verify: object({ ...nodeHead, kind: literal("verify"), asserts: string, using: viaId(verbId), inputs, evidence: literal(...EVIDENCE_KINDS) }, nodeOptional),
});

const reconcile: Decoder<Reconcile> = object({ ...workloadHead, form: literal("reconcile"), nodes: array(node) }, workloadOptional);

const toFinding = (e: DecodeError): Finding => reconcileFinding("E-RC-LOOP-MALFORMED", e.path, formatDecodeError(e), { node: e.path });

/** A reconcile from a value that came from outside, or every reason it is not one. */
export function decodeReconcile(input: unknown): Result<Reconcile, readonly Finding[]> {
  const r = reconcile(input);
  if (r.kind === "err") return err([toFinding(r.error)]);
  return defineReconcile(r.value);
}
