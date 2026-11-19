// Spec: 0044-issues FR-001
/** The reader loses defaults and check text */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 1,
  slug: "defaults-and-check-text",
  title: "The reader loses defaults and check text",
  summary:
    "Column defaults are now read and compared (a changed default is drift, the model's own defaults are not), on all three engines. Still not read: the text of a check, which is compared by name only, so a check changed by hand with the same name is not seen.",
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
