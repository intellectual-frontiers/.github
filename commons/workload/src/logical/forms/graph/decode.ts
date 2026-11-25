// Spec: 0013-form-graph FR-002, FR-003
/**
 * The decoder of a graph: a value that came from outside (a file, a message) is made into a graph or into every reason it is not one, with no cast outside the decoders of core. It is made of the decoders every form shares and of
 * the four kinds of node of this form; a value that is no edge or no permission scope is refused where it is read, and the structure (ids, edges, cycles, results) is then checked by `defineGraph`.
 *
 * @example
 * ```ts
 * import { decodeGraph } from "./decode.ts";
 * decodeGraph({}).kind; // "err"
 * ```
 *
 * @module
 */
import { array, type DecodeError, type Decoder, err, formatDecodeError, integer, literal, object, record, string, tagged, type Result } from "@intellectual-frontiers/core";
import { AUTONOMY } from "@intellectual-frontiers/workbench/governance";
import { effect, EVIDENCE_KINDS, type Finding, GATE_ACTIONS, inputs, inputValue, MODES, nodeHead, nodeId, nodeOptional, verbId, viaId, workloadHead, workloadOptional } from "@intellectual-frontiers/workload/governance";
import { graphFinding } from "./catalog.ts";
import { defineGraph } from "./define.ts";
import type { BodyNode, Graph, GraphNode, GraphPermissions } from "./node.ts";
import { FAN_OUTS, PERMISSION_SCOPES } from "./terms.ts";

const level: Decoder<"read" | "write"> = literal("read", "write");
const permissions: Decoder<GraphPermissions> = (input, path = "$") => {
  const r = record(level)(input, path);
  if (r.kind === "err") return r;
  const unknown = Object.keys(r.value).find((k) => !(PERMISSION_SCOPES as readonly string[]).includes(k));
  if (unknown !== undefined) return err({ kind: "decode", path: `${path}.${unknown}`, expected: `a scope of permissions: ${PERMISSION_SCOPES.join(", ")}`, found: unknown });
  return r;
};

const edges = { after: array(viaId(nodeId)) } as const;
const edgesOptional = { ...nodeOptional, permissions, timeoutMinutes: integer } as const;

const body: Decoder<BodyNode> = tagged({
  verb: object({ ...nodeHead, kind: literal("verb"), verb: viaId(verbId), inputs, effect }, nodeOptional),
  check: object({ ...nodeHead, kind: literal("check"), asserts: string, using: viaId(verbId), inputs, evidence: literal(...EVIDENCE_KINDS) }, nodeOptional),
});

const node: Decoder<GraphNode> = tagged({
  verb: object({ ...nodeHead, ...edges, kind: literal("verb"), verb: viaId(verbId), inputs, effect }, edgesOptional),
  check: object({ ...nodeHead, ...edges, kind: literal("check"), asserts: string, using: viaId(verbId), inputs, evidence: literal(...EVIDENCE_KINDS) }, edgesOptional),
  each: object({ ...nodeHead, ...edges, kind: literal("each"), over: literal(...FAN_OUTS), source: inputValue, body: array(body) }, edgesOptional),
  gate: object({ ...nodeHead, kind: literal("gate"), action: literal(...GATE_ACTIONS), approver: string, demands: literal(...AUTONOMY), guards: array(viaId(nodeId)) }, nodeOptional),
});

const graph: Decoder<Graph> = object({ ...workloadHead, form: literal("graph"), limit: literal(...MODES), results: array(viaId(nodeId)), nodes: array(node) }, workloadOptional);

const toFinding = (e: DecodeError): Finding => graphFinding("E-GR-GRAPH-MALFORMED", e.path, formatDecodeError(e), { node: e.path });

/** A graph from a value that came from outside, or every reason it is not one. */
export function decodeGraph(input: unknown): Result<Graph, readonly Finding[]> {
  const r = graph(input);
  if (r.kind === "err") return err([toFinding(r.error)]);
  return defineGraph(r.value);
}
