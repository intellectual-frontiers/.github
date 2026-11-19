// Spec: 0044-issues FR-001
/** A second column drop overwrote the quarantine of the first */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 4,
  slug: "quarantine-overwrite",
  title: "A second column drop overwrote the quarantine of the first",
  summary: "The values quarantined by the first drop were lost when a second drop used the same quarantine column.",
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
        "file": "suite/quarantine-reuse.test.ts",
        "name": "a column dropped a second time does not lose its new values"
      }
    ]
  },
  size: "m",
  cites: [
    "0015-sql-safety FR-004"
  ],
  evidence: [],
  links: [],
  raised: "2026-11-19",
});
