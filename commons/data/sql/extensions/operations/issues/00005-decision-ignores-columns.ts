// Spec: 0044-issues FR-001
/** The decision engine does not honour every column */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 5,
  slug: "decision-ignores-columns",
  title: "The decision engine does not honour every column",
  summary:
    "Columns of the access models that say who or when were stored but not read: the kinds a role or a permission is for, and the caveat of a relationship tuple. They are read now (a caveat that is not evaluated never allows). An entitlement's limit is a quota for metering, not a decision input, and stays out.",
  severity: "high",
  priority: "P2",
  goals: ["G1", "G2"],
  appliesTo: { engines: "all" },
  status: {
    kind: "fixed",
    proof: [
      { kind: "test", file: "suite/identity-operations.test.ts", name: "a permission is for people, machines and groups unless it names the kinds it is for" },
      { kind: "spec", id: "0041-identity-authorize" },
    ],
  },
  size: "l",
  cites: [
    "0041-identity-authorize FR-001"
  ],
  evidence: [
    {
      "kind": "file",
      "path": "sql/extensions/operations/identity/decide.ts"
    }
  ],
  links: [],
  raised: "2026-11-19",
});
