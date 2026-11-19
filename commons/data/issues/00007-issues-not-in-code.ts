// Spec: 0044-issues FR-001
/** An issue is not kept in the code */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 7,
  slug: "issues-not-in-code",
  title: "An issue is not kept in the code",
  summary: "Known weaknesses lived in documents and could be dropped without a trace.",
  severity: "medium",
  priority: "P2",
  goals: ["G5", "G6"],
  appliesTo: { engines: "all" },
  status: {
    "kind": "fixed",
    "proof": [
      {
        "kind": "spec",
        "id": "0044-issues"
      },
      {
        "kind": "test",
        "file": "suite/issues.test.ts",
        "name": "issues are typed values"
      }
    ]
  },
  size: "m",
  cites: [
    "0044-issues FR-001"
  ],
  evidence: [],
  links: [],
  raised: "2026-11-19",
});
