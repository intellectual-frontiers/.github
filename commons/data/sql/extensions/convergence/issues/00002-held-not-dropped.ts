// Spec: 0044-issues FR-001
/** Objects a database administrator made are dropped, not held */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 2,
  slug: "held-not-dropped",
  title: "Objects a database administrator made are dropped, not held",
  summary: "Convergence plans to drop what the model does not name, including objects made by hand; they should be held and reported.",
  severity: "high",
  priority: "P2",
  goals: ["G1", "G2"],
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
