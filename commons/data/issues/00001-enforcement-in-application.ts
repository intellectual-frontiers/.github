// Spec: 0044-issues FR-001
/** Enforcement is in the application, not in the database */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 1,
  slug: "enforcement-in-application",
  title: "Enforcement is in the application, not in the database",
  summary: "What must always be true of the records (append-only audit chain, status moves, budget caps) was kept only by the operations runtime, so any other client or a hand-typed statement could break it.",
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
        "name": "with the invariants in the database, a statement typed by hand is refused what governance forbids"
      },
      {
        "kind": "spec",
        "id": "0043-sql-invariants"
      }
    ]
  },
  size: "l",
  cites: [
    "0043-sql-invariants FR-002"
  ],
  evidence: [
    {
      "kind": "review",
      "source": "review-a..d, 2026-11-19"
    }
  ],
  links: [],
  raised: "2026-11-19",
});
