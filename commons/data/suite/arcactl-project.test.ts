// Spec: 0051-project-cli FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The project commands of `arcactl` (commons data 0051-project-cli): `sql`, `lint`, `generate` and `list`, for the arca models and for a module of a project's own; what `sql` writes is run on real engines.
 *
 * @module
 */
import { PGlite } from "@electric-sql/pglite";
import { join } from "node:path";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { main } from "@intellectual-frontiers/data/sql/cli";
import { DIALECTS, openEngine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";

const ROOT = join(import.meta.dirname ?? ".", "..");
const run = (args: string[], cwd = ROOT) => main(args, { env: {}, cwd });

proves(
  ["0051-project-cli FR-001", "0051-project-cli FR-002"],
  "sql writes the DDL of the models for a dialect, which PostgreSQL, SQLite and DuckDB each run, with the triggers of the invariants unless they are left out, and for a module of a project's own",
  async () => {
    const pg = await run(["sql", "--models", "identityAgent"]);
    same(pg.code, 0, pg.err);
    assert(pg.out.includes('CREATE TABLE IF NOT EXISTS "arca"."principal"') && pg.out.includes("inv_audit_event_append_only") && pg.out.split("CREATE TABLE").length > 70, pg.out.slice(0, 300));
    const db = await PGlite.create();
    try {
      await db.exec(pg.out);
      same(Number((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'arca'`)).rows[0]?.n) > 70, true);
    } finally {
      await db.close();
    }
    const plain = await run(["sql", "--models", "identityAgent", "--no-invariants"]);
    assert(!plain.out.includes("TRIGGER") && plain.out.includes("CREATE TABLE"));
    for (const name of ["sqlite", "duckdb"] as const) {
      const out = await run(["sql", "--models", "identity", "--dialect", name]);
      same(out.code, 0, out.err);
      const e = await openEngine(name);
      try {
        const statements = out.out.split(/;\n\n/).map((s, i, all) => (i < all.length - 1 ? `${s};` : s.trim())).filter((s) => s !== "");
        for (const s of statements) await e.run(s);
      } finally {
        await e.close();
      }
    }
    const mine = await run(["sql", "--module", "suite/project-model-fixture.ts", "--dialect", "sqlite"]);
    same(mine.code, 0, mine.err);
    assert(mine.out.includes('CREATE TABLE IF NOT EXISTS "note"') && mine.out.includes('"body" TEXT NOT NULL'), mine.out);
    assert(DIALECTS.length === 3);
  },
);

proves(
  ["0051-project-cli FR-003"],
  "lint holds the models and the operations to governance's rules: errors fail it, warnings do not unless it is strict, and a module of a project's own is held to them too",
  async () => {
    const clean = await run(["lint", "--models", "identityAgent"]);
    assert(clean.code === 0 && /^0 errors, \d+ warnings$/m.test(clean.out), clean.out.slice(-200));
    same((await run(["lint", "--models", "issues", "--strict"])).code, 1, "warnings fail where it is strict");
    const bad = await run(["lint", "--module", "suite/project-model-bad-fixture.ts"]);
    assert(bad.code === 1 && bad.out.includes("error  ") && /1 error/.test(bad.out), bad.out);
    same((await run(["lint", "--module", "suite/project-model-fixture.ts"])).code, 0);
  },
);

proves(
  ["0051-project-cli FR-004"],
  "generate writes what a generator makes for the models, names the generators where it is not given one, and list says what there is",
  async () => {
    const m = await run(["generate", "sql.generate.erd-mermaid", "--models", "arcaParty"]);
    assert(m.code === 0 && m.out.includes("erDiagram") && m.out.includes("party_kind"), m.out.slice(0, 200));
    const zod = await run(["generate", "sql.generate.zod", "--module", "suite/project-model-fixture.ts"]);
    assert(zod.code === 0 && /note/i.test(zod.out), zod.out.slice(0, 200));
    const none = await run(["generate", "--models", "arcaParty"]);
    assert(none.code === 2 && none.err.includes("sql.generate.dictionary"), none.err);
    const lists = await Promise.all([run(["list"]), run(["list", "models"]), run(["list", "dialects"]), run(["list", "tables", "--models", "arcaParty"]), run(["list", "codes", "--models", "arcaParty"]), run(["list", "invariants", "--models", "identityAgent"]), run(["list", "operations", "--models", "identityAgent"])]);
    assert(lists.every((l) => l.code === 0), lists.map((l) => l.err).join(""));
    assert(lists[0]?.out.includes("sql.generate.zod") && lists[1]?.out.includes("identityAgent"));
    same(lists[2]?.out, "postgres\nsqlite\nduckdb\n");
    assert(lists[3]?.out.includes("party_kind") && lists[4]?.out.includes("codes") && lists[5]?.out.includes("append-only") && lists[6]?.out.includes("recordToolCall"));
  },
);

proves(
  ["0051-project-cli FR-005"],
  "a command that is wrong is refused with exit code 2 before anything is made: no project, both kinds of project, a model that is not one, a dialect that is not one, a module that is not a project, a thing to list that is not one",
  async () => {
    const bad: [string[], string][] = [
      [["sql"], "name the models"],
      [["sql", "--models", "identity", "--module", "suite/project-model-fixture.ts"], "not both"],
      [["sql", "--models", "nope"], "not one of"],
      [["sql", "--models", "identity", "--dialect", "oracle"], "oracle"],
      [["lint", "--module", "suite/nowhere.ts"], "could not be read"],
      [["lint", "--module", "suite/net-fixtures.ts"], "not a domain"],
      [["list", "colours"], "list what"],
      [["generate", "sql.generate.nothing", "--models", "identity"], "generate what"],
    ];
    for (const [args, text] of bad) {
      const r = await run(args);
      assert(r.code === 2 && r.err.toLowerCase().includes(text.toLowerCase()) && r.out === "", `${args.join(" ")}: ${r.code} ${r.err}`);
    }
  },
);
