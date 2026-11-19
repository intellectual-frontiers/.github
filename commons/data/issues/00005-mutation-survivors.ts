// Spec: 0044-issues FR-001
/** A third of the mutations survive the tests */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 5,
  slug: "mutation-survivors",
  title: "A third of the mutations survive the tests",
  summary: "Of 91 mutations of the sources 31 survived: the tests do not notice a changed condition or a dropped branch. Kill the survivors that matter first.",
  severity: "high",
  priority: "P2",
  goals: ["G1", "G5"],
  appliesTo: { engines: "all" },
  status: {
    "kind": "open"
  },
  size: "l",
  cites: [],
  evidence: [
    {
      "kind": "review",
      "source": "review-d, 2026-11-19"
    }
  ],
  links: [],
  raised: "2026-11-19",
});
