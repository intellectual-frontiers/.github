// Spec: 0044-issues FR-001
/** Capabilities of dbt that the library does not have yet */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 11,
  slug: "dbt-parity",
  title: "Capabilities of dbt that the library does not have yet",
  summary:
    "Held: models with order and lineage, view/table/incremental/ephemeral (0023), generic and singular data tests with severity, thresholds, where, limit, failCalc, stored failures, tags and selection (0052), docs generation (documentation extension). Missing, in the order of their value: sources with freshness checks; seeds (typed CSV loads, with column types and quoting); snapshots (type-2 history by `check` or `timestamp` strategy; the history extension is not this); unit tests of models with given rows and expected rows; incremental strategies beyond append (merge, delete+insert, insert_overwrite, microbatch); model contracts and constraints checked at build; exposures, groups, access and versions of models; run hooks (pre/post, on-run-start/end); analyses; state-based selection and defer (`state:modified+`); a macro and package mechanism (here: TypeScript modules, so a package is an npm package of generic tests and models, which needs a documented convention); a run results artifact (`run_results.json`, `manifest.json`) and the semantic layer. Each is to be taken as a spec of its own.",
  severity: "medium",
  priority: "P2",
  goals: ["G1", "G2"],
  appliesTo: { engines: "all" },
  status: { kind: "open" },
  size: "xl",
  cites: ["0023-sql-transforms FR-001", "0052-sql-quality FR-001"],
  links: [{ kind: "relates", to: 10 }],
  raised: "2026-11-19",
});
