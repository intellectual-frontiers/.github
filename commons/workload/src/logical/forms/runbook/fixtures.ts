// Spec: 0010-workload-runners FR-017
/**
 * The fixtures of the runbook form: runbooks that are not starters (no skill and no page is made from them) and that the tests and the generator of artifacts use. `synthetic-bootstrap-01` is the first consumer of the
 * integration runners (0010-workload-runners FR-017): an install check, one verb and one `each` over a fixed list of hosts, and nothing a script could not carry. Every name is synthetic.
 *
 * @example
 * ```ts
 * import { BOOTSTRAP_HOSTS, SYNTHETIC_BOOTSTRAP_01 } from "./fixtures.ts";
 * SYNTHETIC_BOOTSTRAP_01.id; // "synthetic-bootstrap-01"
 * BOOTSTRAP_HOSTS; // ["synthetic-host-01", "synthetic-host-02"]
 * ```
 *
 * @module
 */
import { authored, type Effect, nodeId, parseCite, storeRef, verbId, workloadId } from "@intellectual-frontiers/workload/governance";
import type { EachKind } from "./terms.ts";
import type { Runbook, Step } from "./step.ts";

const PLAN = "synthetic-plan-01";
const effect = (class_: Effect["class"], mode: Effect["mode"]): Effect => ({ store: authored(storeRef(PLAN)), class: class_, mode, reversible: true });
const head = (id: string, title: string, spec: string) => ({ id: authored(nodeId(id)), title, spec: [authored(parseCite(spec))] });

/** The name of the fixed list of hosts the bootstrap fans out over: a literal, which a caller binds to its members. */
export const BOOTSTRAP_LIST = "synthetic-bootstrap-hosts";

/** The members of the list: two hosts. */
export const BOOTSTRAP_HOSTS: readonly string[] = ["synthetic-host-01", "synthetic-host-02"];

/** The fixed list of the fixture for a fan out: the members of the one list it names, and none for another. */
export const bootstrapFleet = (over: EachKind, source: string): readonly string[] | undefined => (over === "hosts" && source === BOOTSTRAP_LIST ? BOOTSTRAP_HOSTS : undefined);

const recordHost: Step = { ...head("record-host", "Record the order on the host", "0010-workload-runners FR-011"), kind: "verb", verb: authored(verbId("work.record")), inputs: { order: { kind: "input", name: "order" } }, effect: effect("durable", "append") };

/** An install check, one verb and one `each`: the first consumer of the integration runners. */
export const SYNTHETIC_BOOTSTRAP_01: Runbook = {
  id: authored(workloadId("synthetic-bootstrap-01")),
  form: "runbook",
  title: "Synthetic bootstrap",
  version: "0.1.0",
  summary: "Check that the workbench has what the run needs, claim the work order and record it on each host of a fixed list.",
  given: [],
  needs: [{ id: "synthetic-token-01", kind: "credential", concept: "workbench", task: "run", safety: false, summary: "The token the verb command reads from its environment", name: "SYNTHETIC_TOKEN_01" }],
  trigger: { kind: "manual" },
  inputs: [{ name: "order", type: "text", required: true }],
  stores: [{ ref: authored(storeRef(PLAN)), class: "durable", needs: ["read", "append"] }],
  steps: [
    { ...head("install-check", "The workbench has what the run needs", "0010-workload-runners FR-017"), kind: "check", asserts: "the workbench has what the run needs", using: authored(verbId("workbench.ready")), inputs: { task: { kind: "literal", value: "run" } }, evidence: "record" },
    { ...head("claim-order", "Claim the work order", "0005-workload-runs FR-001"), kind: "verb", verb: authored(verbId("work.claim")), inputs: { order: { kind: "input", name: "order" } }, effect: effect("durable", "append") },
    { ...head("record-hosts", "Record the order on each host", "0010-workload-runners FR-011"), kind: "each", over: "hosts", source: { kind: "literal", value: BOOTSTRAP_LIST }, body: [recordHost] },
  ],
};

/** The fixtures of the runbook form by id. */
export const FIXTURES: readonly Runbook[] = [SYNTHETIC_BOOTSTRAP_01];
