// Spec: 0044-issues FR-001
/** History findings of the review are minor */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 1,
  slug: "history-minor",
  title: "History findings of the review are minor",
  summary: "The review found small gaps in the history extension; none breaks a promise.",
  severity: "low",
  priority: "P3",
  goals: ["G6"],
  appliesTo: { engines: "all" },
  status: {
    "kind": "open"
  },
  size: "s",
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
