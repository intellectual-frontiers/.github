// Spec: 0044-issues FR-001
/** The migration flag of the protected layer is a setting any session can set */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 8,
  slug: "migration-flag-is-forgeable",
  title: "The migration flag of the protected layer is a setting any session can set",
  summary:
    "The guard of the protected-access layer lets a session alter or drop a table of the tables' schema when `lifecycle.migrating` is `on`, and any session can set that. A project can now seal the flag with `migratingSecret`; what is left is that sealing is not the default, because a default secret would be one everybody knows. Refuse `enforced` without one.",
  severity: "high",
  priority: "P2",
  goals: ["G1", "G2"],
  appliesTo: { engines: ["postgres"] },
  status: { kind: "open" },
  size: "xs",
  cites: ["0014-sql-protected-access FR-007"],
  evidence: [{ kind: "file", path: "sql/extensions/protected-access/guard.ts" }],
  links: [{ kind: "relates", to: 2 }, { kind: "relates", to: 3 }],
  raised: "2026-11-19",
});
