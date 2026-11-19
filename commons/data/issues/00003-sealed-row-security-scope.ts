// Spec: 0044-issues FR-001
/** Row security is not a sealed scope */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 3,
  slug: "sealed-row-security-scope",
  title: "Row security is not a sealed scope",
  summary: "Tenant isolation by row-level security is set by the same role that can turn it off. PostgreSQL can seal the scope so that only a marked session sets it.",
  severity: "high",
  priority: "P1",
  goals: ["G1", "G2"],
  appliesTo: { engines: ["postgres"] },
  status: {
    kind: "fixed",
    proof: [
      { kind: "test", file: "suite/features.test.ts", name: "a sealed scope is trusted only with the mark of the issuer that holds the key" },
      { kind: "spec", id: "0009-sql-features" },
    ],
  },
  size: "m",
  cites: [],
  evidence: [
    {
      "kind": "review",
      "source": "review-a..d, 2026-11-19"
    }
  ],
  links: [
    {
      "kind": "relates",
      "to": 2
    }
  ],
  raised: "2026-11-19",
});
