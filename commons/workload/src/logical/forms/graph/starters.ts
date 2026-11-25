// Spec: 0013-form-graph FR-014
/**
 * The starter graphs and the fixtures of the form, every name synthetic. `synthetic-graph-01` is a graph that a schedule starts and GitHub Actions carries: it reads the state of a store, records it, fans out over a fixed list of
 * hosts, and publishes the result to a store that a person approves through a gate. `synthetic-graph-02` is the smallest graph (two jobs) with a weekly schedule and no gate, which every integration runner can carry.
 *
 * @example
 * ```ts
 * import { STARTERS } from "./starters.ts";
 * STARTERS.map((g) => g.id);
 * ```
 *
 * @module
 */
import type { ControlRef } from "@intellectual-frontiers/grc/governance";
import { authored, type Effect, type InputValue, type NodeHead as Common, nodeId, parseCite, type SpecCite, storeRef, verbId, workloadId } from "@intellectual-frontiers/workload/governance";
import type { Graph, GraphNode } from "./node.ts";
import type { FanOut } from "./terms.ts";

const nid = (t: string) => authored(nodeId(t));
const cite = (t: string): SpecCite => authored(parseCite(t));
const control = (framework: string, version: string, id: string): ControlRef => ({ framework, version, control: id });
const store = (t: string): InputValue => ({ kind: "store", store: authored(storeRef(t)) });
const BASELINE = control("nist-800-53", "5.2.0", "CM-2");

const EVIDENCE = "synthetic-evidence-01";
const RESULT = "synthetic-result-01";
const effect = (ref: string, class_: Effect["class"], mode: Effect["mode"]): Effect => ({ store: authored(storeRef(ref)), class: class_, mode, reversible: true });
const head = (id: string, title: string, spec: string, controls: readonly ControlRef[] = []): Common => ({ id: nid(id), title, spec: [cite(spec)], ...(controls.length === 0 ? {} : { controls }) });

/** The name of the fixed list of hosts the graph fans out over: a literal, which a caller binds to its members. */
export const GRAPH_LIST = "synthetic-graph-hosts";

/** The members of the list: two hosts. */
export const GRAPH_HOSTS: readonly string[] = ["synthetic-host-01", "synthetic-host-02"];

/** The fixed list of the fixture for a fan out: the members of the one list it names, and none for another. */
export const graphFleet = (over: FanOut, source: string): readonly string[] | undefined => (over === "hosts" && source === GRAPH_LIST ? GRAPH_HOSTS : undefined);

/** A graph that a schedule starts and GitHub Actions carries: read, record, fan out, and publish behind a gate. */
export const SYNTHETIC_GRAPH_01: Graph = {
  id: authored(workloadId("synthetic-graph-01")),
  form: "graph",
  title: "Synthetic nightly proof",
  version: "0.1.0",
  summary: "Read the state of a store, record it as evidence, record the order on each host of a fixed list, and publish the result to a store once a person has approved it.",
  given: [],
  needs: [{ id: "synthetic-token-01", kind: "credential", concept: "workbench", task: "run", safety: false, summary: "The token the verb command reads from its environment", name: "SYNTHETIC_TOKEN_01" }],
  trigger: { kind: "schedule", cadence: "daily", at: { minute: 43, hour: 3 } },
  inputs: [{ name: "order", type: "text", required: false }],
  stores: [
    { ref: authored(storeRef("synthetic-live-01")), class: "external", needs: ["read"] },
    { ref: authored(storeRef(EVIDENCE)), class: "durable", needs: ["read", "append"] },
    { ref: authored(storeRef(RESULT)), class: "external", needs: ["read", "append"] },
  ],
  limit: "append",
  results: [nid("publish-result")],
  nodes: [
    { ...head("observe-state", "Read the state of the live store", "0013-form-graph FR-002", [BASELINE]), kind: "check", after: [], asserts: "the live store answers", using: authored(verbId("state.observe")), inputs: { store: store("synthetic-live-01") }, evidence: "digest" },
    { ...head("record-state", "Record the state as evidence", "0013-form-graph FR-003"), kind: "verb", after: [nid("observe-state")], verb: authored(verbId("work.record")), inputs: { order: { kind: "input", name: "order" } }, effect: effect(EVIDENCE, "durable", "append"), timeoutMinutes: 10 },
    {
      ...head("record-hosts", "Record the order on each host", "0013-form-graph FR-003"),
      kind: "each",
      after: [nid("observe-state")],
      over: "hosts",
      source: { kind: "literal", value: GRAPH_LIST },
      body: [{ ...head("record-host", "Record the order on the host", "0013-form-graph FR-003"), kind: "verb", verb: authored(verbId("work.record")), inputs: { order: { kind: "input", name: "order" } }, effect: effect(EVIDENCE, "durable", "append") }],
    },
    { ...head("approve-publish", "A person approves the publication", "0013-form-graph FR-007"), kind: "gate", action: "approve", approver: "synthetic-approver-01", demands: "human-only", guards: [nid("publish-result")] },
    {
      ...head("publish-result", "Publish the result to the store of results", "0013-form-graph FR-003"),
      kind: "verb",
      after: [nid("record-state"), nid("record-hosts")],
      verb: authored(verbId("external.apply")),
      inputs: { store: store(RESULT), key: { kind: "input", name: "order" } },
      effect: { ...effect(RESULT, "external", "append"), idempotencyKey: "key" },
      permissions: { contents: "read", "pull-requests": "write" },
    },
  ] satisfies readonly GraphNode[],
};

/** The smallest graph: a read, and a record after it. */
export const SYNTHETIC_GRAPH_02: Graph = {
  id: authored(workloadId("synthetic-graph-02")),
  form: "graph",
  title: "Synthetic two jobs",
  version: "0.1.0",
  summary: "Read the state of a store and record the order after it, every week.",
  given: [],
  needs: [],
  trigger: { kind: "schedule", cadence: "weekly" },
  inputs: [{ name: "order", type: "text", required: false }],
  stores: [{ ref: authored(storeRef(EVIDENCE)), class: "durable", needs: ["read", "append"] }],
  limit: "append",
  results: [nid("record-order")],
  nodes: [
    { ...head("read-state", "Read the workbench", "0013-form-graph FR-002"), kind: "check", after: [], asserts: "the workbench has what the run needs", using: authored(verbId("workbench.ready")), inputs: { task: { kind: "literal", value: "run" } }, evidence: "record" },
    { ...head("record-order", "Record the order", "0013-form-graph FR-003"), kind: "verb", after: [nid("read-state")], verb: authored(verbId("work.record")), inputs: { order: { kind: "input", name: "order" } }, effect: effect(EVIDENCE, "durable", "append") },
  ],
};

/** The starter graphs by id. */
export const STARTERS: readonly Graph[] = [SYNTHETIC_GRAPH_01, SYNTHETIC_GRAPH_02];

/** The fixtures of the graph form by id. */
export const FIXTURES: readonly Graph[] = STARTERS;
