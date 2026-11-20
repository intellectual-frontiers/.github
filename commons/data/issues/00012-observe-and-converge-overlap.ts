// Spec: 0044-issues FR-001
/** Two readers of a database's catalog: convergence's and the dialects' observe */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 12,
  slug: "observe-and-converge-overlap",
  title: "Two readers of a database's catalog: convergence's `catalog` and the dialects' `observe`",
  summary:
    "0019-sql-convergence reads a live catalog through `Dialect.catalog` (tables, columns, primary keys, index names; foreign keys on PostgreSQL only) and compares it with a state; 0055-sql-introspect reads the whole structure through `Dialect.observe` (foreign keys over many columns, uniques, indexes by column) and compares it with a schema, and can adopt it. They answer nearly the same question twice. Make `observe` the one reader, have convergence's `read` built from it, keep convergence's tests as the oracle, and drop `catalog`.",
  severity: "low",
  priority: "P3",
  goals: ["G1"],
  appliesTo: { engines: "all" },
  status: { kind: "open" },
  size: "m",
  cites: ["0019-sql-convergence FR-001", "0055-sql-introspect FR-001"],
  evidence: [{ kind: "file", path: "sql/extensions/convergence/read.ts" }, { kind: "file", path: "sql/lifecycle/introspect.ts" }],
  raised: "2026-11-20",
});
