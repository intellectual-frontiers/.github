/**
 * What the tests share: small runbooks made of typed constructors and a runbook as plain data, so that a test of the logic needs no program. Every name is synthetic.
 *
 * @module
 */
import { authored, type Effect, parseCite, type Runbook, runbookId, type Step, stepId, storeRef, verbId } from "@intellectual-frontiers/runbooks/governance";

export const sid = (t: string) => authored(stepId(t));
export const store = (t: string) => ({ kind: "store", store: authored(storeRef(t)) }) as const;
export const effect = (s: string, class_: Effect["class"], mode: Effect["mode"], reversible = true): Effect => ({ store: authored(storeRef(s)), class: class_, mode, reversible });
export const cite = authored(parseCite("0003-runbooks-effects FR-001"));

/** A verb step with the least a step needs. */
export const verb = (id: string, v: string, e: Effect, inputs: Extract<Step, { kind: "verb" }>["inputs"] = {}, extra: Partial<Extract<Step, { kind: "verb" }>> = {}): Step => ({ id: sid(id), title: id, spec: [cite], kind: "verb", verb: authored(verbId(v)), inputs, effect: e, ...extra });

/** A runbook of the steps, with the stores of the tests declared. */
export const runbook = (steps: readonly Step[], over: Partial<Runbook> = {}): Runbook => ({
  id: authored(runbookId("synthetic-runbook")),
  title: "A synthetic runbook",
  version: "0.1.0",
  summary: "Used by the tests",
  given: [],
  needs: [],
  inputs: [],
  stores: [
    { ref: authored(storeRef("synthetic-db-01")), class: "transactional", needs: ["read"] },
    { ref: authored(storeRef("synthetic-vault-01")), class: "durable", needs: ["read", "write"] },
    { ref: authored(storeRef("synthetic-scratch-01")), class: "ephemeral", needs: ["read", "write"] },
    { ref: authored(storeRef("synthetic-ledger-01")), class: "external", needs: ["read"] },
    { ref: authored(storeRef("synthetic-repo-01")), class: "git", needs: ["read", "append"] },
  ],
  steps,
  ...over,
});

/** A runbook as plain data, as a file would give it. */
export const plain = {
  id: "synthetic-runbook",
  title: "A synthetic runbook",
  version: "0.1.0",
  summary: "Used by the tests",
  given: [],
  needs: [{ kind: "program", id: "sqlite3", name: "sqlite3", summary: "sqlite3 runs" }],
  inputs: [],
  stores: [{ ref: "synthetic-db-01", class: "transactional", needs: ["read"] }],
  steps: [
    { kind: "verb", id: "claim", title: "Claim", spec: ["0003-runbooks-effects FR-001"], controls: ["urn:grc:nist-800-53:5.2.0:CP-9", { framework: "soc2-tsc", version: "2017", control: "A1.3" }], verb: "work.claim", inputs: {}, effect: { store: "synthetic-db-01", class: "transactional", mode: "read", reversible: true } },
    { kind: "judge", id: "think", title: "Think", spec: ["0003-runbooks-effects FR-001"], question: "What now?", output: { answer: { kind: "text" } } },
  ],
};
