# @intellectual-frontiers/data

Governance (what a business domain is and what must be true of its data), a logical schema made from it, and a physical schema for PostgreSQL, SQLite or DuckDB made from that, with extensions to each, and the lifecycle that changes a database from one physical schema to the next. It is an independent library of commons with its own specifications (`spec-kit/`, 0001 to 0023).

**Full documentation: [README.html](https://htmlpreview.github.io/?https://github.com/intellectual-frontiers/.github/blob/main/commons/data/README.html)** (diagrams, every extension with an example, strategies, presets, limits and roadmap).

## Example

```ts
import { attribute, concept, domain, identifier, text } from "@intellectual-frontiers/data/governance";
import { projectDomain } from "@intellectual-frontiers/data/sql/logical";
import { bind, render } from "@intellectual-frontiers/data/sql/physical";
import { dialect } from "@intellectual-frontiers/data/sql/dialects/sqlite";
const book = concept("book", { definition: "A written work", identifiedBy: ["id"], attributes: {
  id: attribute(identifier(), { definition: "What identifies it" }), title: attribute(text(), { definition: "What it is called" }) } });
const d = domain("library", { definition: "Books", concepts: [book] });
const p = d.kind === "ok" ? projectDomain(d.value) : undefined;
const sql = p?.kind === "ok" ? bind(p.value.schema, { dialect }) : undefined;
if (sql?.kind === "ok") console.log(render(sql.value)); // CREATE TABLE IF NOT EXISTS "book" (...)
```

## Layers

Each layer imports only the layers below it and the engine; a check of the library holds every import to that table.

- `engine/`: the extension host (contribution points, manifests, `compose`, lazy activation).
- `governance/`: domains, code lists, annotations, the vocabularies (documentation, requirements, privacy, security, ownership, quality, usage, lifecycle), lint, the trace graph; Arca's party model is in `models/arca`.
- `sql/logical/`: tables, columns and keys made from governance by a projection.
- `sql/physical/`: a logical schema bound to a dialect and a case style, as statements.
- `sql/lifecycle/`: state and hash, diff and plan, the hash-chained ledger, `execute`.
- `sql/dialects/`: PostgreSQL, SQLite and DuckDB.
- `sql/extensions/`: documentation, views, access, routines, partitions, generators, idempotency, protected-access, safety, plan-report, rewrite, history, convergence, rollout, integrations (rows, CSV, an attached database or an adapter, loaded by append, upsert, replace or snapshot in one transaction, with a ledger), transforms (models built in order, each with its tests in one transaction, published only if they pass).
- `sql/presets/`: team-managed, dba-managed, reviewed-convergence and autonomous-convergence.
- `sql/cli/`: the command line; in the layers table, not yet built.

## Verify

```sh
cd commons/data && bun run verify
```

This runs the TypeScript compiler, the specification checker and the rules on `spec-kit/`, the layers and trace check, and the tests, which run on real SQLite, DuckDB and PGlite engines.
