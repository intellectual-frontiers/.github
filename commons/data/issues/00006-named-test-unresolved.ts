// Spec: 0044-issues FR-001
/** A test named by a specification need not exist */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 6,
  slug: "named-test-unresolved",
  title: "A test named by a specification need not exist",
  summary: "The enforcement table names a test by file and title, and nothing resolves the name: a renamed test leaves a requirement that points at nothing.",
  severity: "medium",
  priority: "P2",
  goals: ["G1", "G5"],
  appliesTo: { engines: "all" },
  status: {
    "kind": "open"
  },
  size: "s",
  cites: [
    "0024-spec-format FR-013"
  ],
  evidence: [],
  links: [
    {
      "kind": "relates",
      "to": 4
    }
  ],
  raised: "2026-11-19",
});
