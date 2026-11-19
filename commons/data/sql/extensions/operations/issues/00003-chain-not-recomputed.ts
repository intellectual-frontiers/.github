// Spec: 0044-issues FR-001
/** The audit chain was checked by its links only */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 3,
  slug: "chain-not-recomputed",
  title: "The audit chain was checked by its links only",
  summary: "verifyAuditChain did not recompute each event's hash, so an event with changed fields and intact links passed.",
  severity: "high",
  priority: "P1",
  goals: ["G1", "G2"],
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
        "name": "an event whose fields were changed shows in the chain"
      }
    ]
  },
  size: "s",
  cites: [
    "0042-identity-agent-operations FR-005"
  ],
  evidence: [],
  links: [],
  raised: "2026-11-19",
});
