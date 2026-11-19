// Spec: 0044-issues FR-001
/** Objects a database administrator made are dropped, not held */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 2,
  slug: "held-not-dropped",
  title: "Objects a database administrator made are dropped, not held",
  summary:
    "`unmanaged: hold` now leaves a table, column, index or constraint that a person made alone and names it in the proposal. The default is still `drop` (with approval, into quarantine), because the model cannot tell what a person made from what the model once made without the ledger holding the last state; make hold the default once it does.",
  severity: "high",
  priority: "P2",
  goals: ["G1", "G2"],
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
