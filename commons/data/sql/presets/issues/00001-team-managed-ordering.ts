// Spec: 0044-issues FR-001
/** The team-managed strategy orders migrations by hand */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 1,
  slug: "team-managed-ordering",
  title: "The team-managed strategy orders migrations by hand",
  summary: "Numbered migrations can drift from the model and from each other. Convergence is the default and primary strategy, so these weaknesses are kept low: a team that chooses this strategy accepts them.",
  severity: "low",
  priority: "P3",
  goals: ["G1"],
  appliesTo: { engines: "all" },
  status: {
    "kind": "deferred",
    "reason": "convergence is the default strategy (reviewed-convergence); team-managed is the choice of a team that accepts this"
  },
  size: "l",
  cites: [],
  evidence: [
    {
      "kind": "file",
      "path": "sql/presets/mod.ts"
    }
  ],
  links: [],
  raised: "2026-11-19",
});
