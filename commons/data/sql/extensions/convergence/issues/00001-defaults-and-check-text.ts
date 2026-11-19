// Spec: 0044-issues FR-001
/** The reader loses defaults and check text */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 1,
  slug: "defaults-and-check-text",
  title: "The reader loses defaults and check text",
  summary: "Reading a live database back drops column defaults and the text of checks, so a convergence plan can see a difference that is not there or miss one that is.",
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
