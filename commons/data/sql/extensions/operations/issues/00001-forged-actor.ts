// Spec: 0044-issues FR-001
/** The actor was whatever the input said */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 1,
  slug: "forged-actor",
  title: "The actor was whatever the input said",
  summary: "An agent operation took the delegator, decider or killer from its input, so a caller could act as another principal.",
  severity: "critical",
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
        "name": "the identity of the actor is the caller's and never what an input says"
      }
    ]
  },
  size: "m",
  cites: [
    "0042-identity-agent-operations FR-007"
  ],
  evidence: [],
  links: [],
  raised: "2026-11-19",
});
