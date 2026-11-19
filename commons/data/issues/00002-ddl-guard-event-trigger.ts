// Spec: 0044-issues FR-001
/** A table owner can drop the invariant triggers */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 2,
  slug: "ddl-guard-event-trigger",
  title: "A table owner can drop the invariant triggers",
  summary: "The triggers refuse every client but not one who owns the table and drops them. On PostgreSQL an event trigger with a sealed marker can refuse DDL that weakens an invariant.",
  severity: "high",
  priority: "P1",
  goals: ["G1", "G2"],
  appliesTo: { engines: ["postgres"] },
  status: {
    kind: "fixed",
    proof: [
      { kind: "test", file: "suite/identity-operations.test.ts", name: "on PostgreSQL the owner of a table cannot weaken the invariants" },
      { kind: "file", path: "sql/extensions/invariants/mod.ts" },
    ],
  },
  size: "m",
  cites: [
    "0043-sql-invariants FR-002"
  ],
  evidence: [
    {
      "kind": "file",
      "path": "sql/extensions/invariants/mod.ts"
    }
  ],
  links: [
    {
      "kind": "caused-by",
      "to": 1
    }
  ],
  raised: "2026-11-19",
});
