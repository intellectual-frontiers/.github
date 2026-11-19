// Spec: 0044-issues FR-001
/** The trace gate is inert */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 4,
  slug: "trace-gate-inert",
  title: "The trace gate is inert",
  summary: "Every specification is Draft, so the check that ties code and tests to requirements finds nothing to hold. Arm it: move specs that are in force out of Draft.",
  severity: "high",
  priority: "P2",
  goals: ["G1", "G5"],
  appliesTo: { engines: "all" },
  status: {
    kind: "fixed",
    proof: [
      { kind: "test", file: "suite/enforcement-notes.test.ts", name: "every specification of the library is in force" },
      { kind: "file", path: "tools/check.ts" },
    ],
  },
  size: "m",
  cites: [
    "0024-spec-format FR-011"
  ],
  evidence: [
    {
      "kind": "review",
      "source": "review-d, 2026-11-19"
    }
  ],
  links: [],
  raised: "2026-11-19",
});
