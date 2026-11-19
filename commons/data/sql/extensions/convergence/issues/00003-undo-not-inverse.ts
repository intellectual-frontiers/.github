// Spec: 0044-issues FR-001
/** The undo statements of some steps are not exact inverses */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 3,
  slug: "undo-not-inverse",
  title: "The undo statements of some steps are not exact inverses",
  summary:
    "A table made again loses the triggers it had, which includes the triggers of the invariants on SQLite. The step now says the number of triggers must be the same after as before, so it fails and rolls back instead of losing them silently (0017-sql-rewrite FR-009). Still to do: make the triggers again, which needs the triggers in the state, and the undo of a step that rebuilds an index the model did not name.",
  severity: "medium",
  priority: "P2",
  goals: ["G1"],
  appliesTo: { engines: "all" },
  status: { kind: "in-progress", by: "claude" },
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
