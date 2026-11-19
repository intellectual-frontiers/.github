// Spec: 0044-issues FR-001
/** Convergence is the default strategy */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 2,
  slug: "convergence-is-default",
  title: "Convergence is the default strategy",
  summary: "The presets listed team migrations first.",
  severity: "medium",
  priority: "P2",
  goals: ["G6"],
  appliesTo: { engines: "all" },
  status: {
    "kind": "fixed",
    "proof": [
      {
        "kind": "commit",
        "sha": "470b3e5"
      },
      {
        "kind": "file",
        "path": "sql/presets/mod.ts"
      }
    ]
  },
  size: "xs",
  cites: [],
  evidence: [],
  links: [],
  raised: "2026-11-19",
});
