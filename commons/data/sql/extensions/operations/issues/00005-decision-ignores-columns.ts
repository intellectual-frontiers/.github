// Spec: 0044-issues FR-001
/** The decision engine does not honour every column */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 5,
  slug: "decision-ignores-columns",
  title: "The decision engine does not honour every column",
  summary: "Columns of the access models (conditions, time windows, entitlement limits) are stored but not all are read by the decision, so a stored rule can be silently ignored.",
  severity: "high",
  priority: "P2",
  goals: ["G1", "G2"],
  appliesTo: { engines: "all" },
  status: {
    "kind": "open"
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
