// Spec: 0044-issues FR-001
/** An operation need not require a permission */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 4,
  slug: "requires-or-public",
  title: "An operation need not require a permission",
  summary: "A command may declare no permission and still be callable, and nothing tells a public operation from a forgotten one. Add a `requires` or an explicit public flag and have lint refuse neither.",
  severity: "high",
  priority: "P1",
  goals: ["G1", "G2"],
  appliesTo: { engines: "all" },
  status: {
    "kind": "open"
  },
  size: "s",
  cites: [
    "0031-operations FR-002"
  ],
  evidence: [
    {
      "kind": "file",
      "path": "governance/operation.ts"
    }
  ],
  links: [],
  raised: "2026-11-19",
});
