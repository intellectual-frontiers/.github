// Spec: 0044-issues FR-001
/** Rows in operations are untyped */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 6,
  slug: "typed-rows",
  title: "Rows in operations are untyped",
  summary: "tx.insert, update and select take loose records; a wrong column or type is found when it runs, not when it compiles.",
  severity: "medium",
  priority: "P3",
  goals: ["G1", "G3"],
  appliesTo: { engines: "all" },
  status: {
    "kind": "open"
  },
  size: "l",
  cites: [
    "0031-operations FR-004"
  ],
  evidence: [
    {
      "kind": "file",
      "path": "sql/extensions/operations/tx.ts"
    }
  ],
  links: [],
  raised: "2026-11-19",
});
