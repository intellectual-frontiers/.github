// Spec: 0044-issues FR-001
/** A refused tool call could burn an approval or spend a budget */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 2,
  slug: "refused-call-spends",
  title: "A refused tool call could burn an approval or spend a budget",
  summary: "An approval was consumed and budgets partly spent before a later budget refused the call.",
  severity: "high",
  priority: "P1",
  goals: ["G1"],
  appliesTo: { engines: "all" },
  status: {
    "kind": "fixed",
    "proof": [
      {
        "kind": "commit",
        "sha": "470b3e5"
      },
      {
        "kind": "test",
        "file": "suite/identity-operations.test.ts",
        "name": "a refused call uses nothing up"
      }
    ]
  },
  size: "s",
  cites: [
    "0042-identity-agent-operations FR-003"
  ],
  evidence: [],
  links: [],
  raised: "2026-11-19",
});
