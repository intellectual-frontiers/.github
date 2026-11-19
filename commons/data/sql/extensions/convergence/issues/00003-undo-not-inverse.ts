// Spec: 0044-issues FR-001
/** The undo statements of some steps are not exact inverses */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 3,
  slug: "undo-not-inverse",
  title: "The undo statements of some steps are not exact inverses",
  summary: "Undo SQL of a step that rebuilds a table does not rebuild the triggers and indexes that were read before it.",
  severity: "medium",
  priority: "P2",
  goals: ["G1"],
  appliesTo: { engines: "all" },
  status: {
    "kind": "open"
  },
  size: "m",
  cites: [],
  evidence: [
    {
      "kind": "review",
      "source": "review-a..d, 2026-11-19"
    }
  ],
  links: [],
  raised: "2026-11-19",
});
