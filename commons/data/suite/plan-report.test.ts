// Spec: 0016-sql-plan-report FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010
/**
 * The plan report (commons data 0016-sql-plan-report): what a plan does in the words of governance, for a person and for a program, the same every time, and recorded in the database.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { annotate, attribute, concept, domain, identifier, text, vocabularies } from "@intellectual-frontiers/data/governance";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { idempotency } from "@intellectual-frontiers/data/sql/extensions/idempotency";
import {
  recordStatements,
  reportArtifacts,
  reportData,
  reportMarkdown,
  settingsOf,
} from "@intellectual-frontiers/data/sql/extensions/plan-report";
import { safety } from "@intellectual-frontiers/data/sql/extensions/safety";
import { plan, snapshotOf, type Plan, type State } from "@intellectual-frontiers/data/sql/lifecycle";
import { camel, type Dialect, naming } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { libraryAt } from "./lifecycle-fixture.ts";
import { projected } from "./logical-fixture.ts";

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const s = safety();
const stateOf = (v: 1 | 2 | 3, d: Dialect, governed = true): State => must(snapshotOf(libraryAt(v, true, false, governed), { dialect: d }));
const planOf = (d: Dialect, from: State | undefined, v: 1 | 2 | 3): Plan =>
  must(plan(from, libraryAt(v, true, false, true), { dialect: d }, { transforms: [...s.transforms, idempotency()] }));
const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};

const v2 = libraryAt(2, true, false, true);
const v3 = libraryAt(3, true, false, true);
const drop = (): ReturnType<typeof reportData> =>
  reportData({ plan: planOf(postgres, stateOf(2, postgres), 3), before: v2, after: v3, dialect: postgres });

proves(
  ["0016-sql-plan-report FR-001", "0016-sql-plan-report FR-002"],
  "the report gives the dialect, the states, the counts by class, reversibility and idempotency, and for each step its class, reversibility, idempotency and an estimate of the lock",
  () => {
    const d = drop();
    same([d.domain, d.dialect, d.counts.steps], ["library", "postgres", d.steps.length]);
    assert(/^[0-9a-f]{64}$/.test(d.from) && /^[0-9a-f]{64}$/.test(d.to));
    same(d.counts.byClass, { "data-dependent": 1, safe: 1 });
    same(d.counts.byReversibility, { lossless: 1, quarantine: 1 });
    assert(Object.values(d.counts.byIdempotency).reduce((a, b) => a + b, 0) === d.steps.length);
    const rename = d.steps.find((x) => x.kind === "renameColumn");
    const dropColumn = d.steps.find((x) => x.kind === "dropColumn");
    assert(
      rename?.lock === "ACCESS EXCLUSIVE, held briefly (estimate)" && dropColumn?.lock.endsWith("(estimate)"),
      "an estimate, and marked as one",
    );
    assert(
      dropColumn?.class === "data-dependent" &&
        dropColumn.reversibility === "quarantine" &&
        dropColumn.why?.includes("author_born_quarantine"),
    );
    const lite = reportData({ plan: planOf(sqlite, stateOf(2, sqlite), 3), before: v2, after: v3, dialect: sqlite });
    assert(lite.steps.every((x) => x.lock === "the engine allows one writer; no table lock of its own (estimate)"));
    const made = reportData({
      plan: planOf(postgres, stateOf(1, postgres), 2),
      before: libraryAt(1, true, false, true),
      after: v2,
      dialect: postgres,
    });
    assert(made.steps.find((x) => x.kind === "createTable")?.lock.startsWith("none on a table that exists"));
    const none = reportData({ plan: planOf(postgres, stateOf(3, postgres), 3), before: v3, after: v3, dialect: postgres });
    same(none.counts.steps, 0);
    assert(reportMarkdown(none).includes("The plan has no step"));
  },
);

proves(
  ["0016-sql-plan-report FR-003", "0016-sql-plan-report FR-005"],
  "for what a step removes the report says what governance said of it, and who has to approve: the steward, the role for personal data, for a restricted element and for a destructive or hand-written step, each with the reason",
  () => {
    const d = drop();
    const step = d.steps.find((x) => x.kind === "dropColumn");
    const born = step?.elements.find((e) => e.element === "author.born");
    same(born?.personal, { category: "BirthDate", class: "PersonalData", purposes: ["catalogue"] });
    same([born?.classification, born?.retentionDays], ["restricted", 365]);
    same(step?.approvers.map((a) => a.role).sort(), ["librarian", "privacy", "security"]);
    assert(step?.approvers.find((a) => a.role === "privacy")?.because.includes("author.born holds personal data (BirthDate)"));
    assert(step?.approvers.find((a) => a.role === "librarian")?.because === "it answers for author");
    const author = d.steps.find((x) => x.kind === "renameColumn")?.elements;
    assert(author !== undefined);
    // a destructive step and a step a person wrote
    const noQuarantine = must(
      plan(
        stateOf(2, postgres),
        v3,
        { dialect: postgres },
        { transforms: safety({ quarantine: "off" }).transforms, allow: { destructive: true } },
      ),
    );
    const destroyed = reportData({ plan: noQuarantine, before: v2, after: v3, dialect: postgres });
    assert(
      destroyed.steps.find((x) => x.kind === "dropColumn")?.approvers.some((a) => a.role === "owner" && a.because === "it destroys data"),
    );
    const written = must(
      plan(
        {
          ...stateOf(1, postgres),
          tables: stateOf(1, postgres).tables.map((t) =>
            t.name === "book" ? { ...t, columns: t.columns.map((c) => (c.name === "title" ? { ...c, type: "VARCHAR(10)" } : c)) } : t,
          ),
        },
        libraryAt(1, true, false, true),
        { dialect: postgres },
        {
          manual: [
            { resolves: "alterType:book.title", name: "widen the title", up: ['ALTER TABLE "book" ALTER COLUMN "title" TYPE TEXT'] },
          ],
        },
      ),
    );
    const manual = reportData({
      plan: written,
      before: libraryAt(1, true, false, true),
      after: libraryAt(1, true, false, true),
      dialect: postgres,
    });
    assert(manual.steps[0]?.approvers.some((a) => a.role === "owner" && a.because === "a person wrote this step"));
    // settings change the roles and the routing
    const tuned = reportData({
      plan: planOf(postgres, stateOf(2, postgres), 3),
      before: v2,
      after: v3,
      dialect: postgres,
      settings: { personalRole: "dpo", restrictedRole: "ciso", steward: "off" },
    });
    same(
      tuned.steps
        .find((x) => x.kind === "dropColumn")
        ?.approvers.map((a) => a.role)
        .sort(),
      ["ciso", "dpo"],
    );
    same(settingsOf(), {
      personalRole: "privacy",
      restrictedRole: "security",
      destructiveRole: "owner",
      steward: true,
      table: "governance_migration",
    });
    same(
      d.approvals.map((a) => a.role),
      ["librarian", "privacy", "security"],
    );
    same(d.approvals.find((a) => a.role === "privacy")?.steps, [d.steps.find((x) => x.kind === "dropColumn")?.number]);
    // an owner is routed to where there is no steward
    const owned = concept("thing", {
      definition: "A thing",
      attributes: { id: attribute(identifier(), { definition: "i" }) },
      identifiedBy: ["id"],
      annotations: [annotate(vocabularies.ownership.owner, "boss")],
    });
    const dom = must(domain("things", { definition: "Things", concepts: [owned] }));
    const sch = projected(dom).schema;
    const r = reportData({ plan: must(plan(undefined, sch, { dialect: postgres })), after: sch, dialect: postgres });
    assert(r.steps[0]?.approvers.some((a) => a.role === "boss"));
  },
);

proves(
  ["0016-sql-plan-report FR-004", "0016-sql-plan-report FR-008"],
  "the report says what governance itself changes between the schemas, and where the schema before is not given says it does not know",
  () => {
    const d = drop();
    assert(
      d.governanceChanges !== null &&
        d.governanceChanges.some((c) => c.element === "author.born" && c.annotation === "privacy.personal" && c.change === "removed"),
    );
    assert(
      d.governanceChanges?.some(
        (c) => c.element === "author.born" && c.annotation === "quality.retention" && c.before !== undefined && c.after === undefined,
      ),
    );
    const same3 = reportData({ plan: planOf(postgres, stateOf(3, postgres), 3), before: v3, after: v3, dialect: postgres });
    same(same3.governanceChanges, []);
    const noBefore = reportData({ plan: planOf(postgres, stateOf(2, postgres), 3), after: v3, dialect: postgres });
    same(noBefore.governanceChanges, null);
    assert(reportMarkdown(noBefore).includes("was not given, so what governance changes"), "it does not guess");
    assert(
      noBefore.steps.find((x) => x.kind === "dropColumn")?.elements.length === 0 ||
        noBefore.steps.find((x) => x.kind === "dropColumn")?.elements.every((e) => e.personal === undefined),
    );
    const changed = reportData({
      plan: planOf(postgres, stateOf(2, postgres), 2),
      before: v2,
      after: libraryAt(2, true, false, false),
      dialect: postgres,
    });
    assert(changed.governanceChanges?.some((c) => c.annotation === "ownership.steward" && c.change === "removed"));
  },
);

proves(
  ["0016-sql-plan-report FR-006"],
  "the report says what is new, with the description governance gave each new table and column",
  () => {
    const d = reportData({
      plan: planOf(postgres, stateOf(1, postgres), 2),
      before: libraryAt(1, true, false, true),
      after: v2,
      dialect: postgres,
    });
    same(d.added.map((a) => [a.element, a.description]).sort(), [
      ["author.born", "The day it was born"],
      ["book.pages", "How long it is"],
      ["publisher", "Who prints"],
    ]);
    assert(reportMarkdown(d).includes("- `publisher`: Who prints"));
  },
);

proves(
  ["0016-sql-plan-report FR-007"],
  "the report is Markdown and JSON with the same content, the same every time, escaped, and given as files",
  () => {
    const input = { plan: planOf(postgres, stateOf(2, postgres), 3), before: v2, after: v3, dialect: postgres };
    const files = reportArtifacts(input);
    same(
      files.map((f) => f.path),
      ["library.plan.md", "library.plan.json"],
    );
    same(reportArtifacts(input), files, "the same every time");
    assert(files.every((f) => f.text.endsWith("\n") && !f.text.endsWith("\n\n")));
    const json = JSON.parse(files[1]?.text ?? "") as ReturnType<typeof reportData>;
    same(json, JSON.parse(JSON.stringify(reportData(input))), "the JSON is the data");
    const md = files[0]?.text ?? "";
    for (const part of [
      "# Plan: library",
      "## Summary",
      "## Steps",
      "| # | Step | Class | Reversibility | Idempotency | Lock |",
      "## What governance says of each step",
      "## What governance changes",
      "## Approvals",
      "## What is new",
    ])
      assert(md.includes(part), part);
    assert(
      md.includes("`author.born`: personal data BirthDate (PersonalData), held for catalogue; classification restricted; kept 365 days"),
    );
    assert(
      md.includes(
        "Approvals: librarian (it answers for author); privacy (author.born holds personal data (BirthDate)); security (author.born is restricted).",
      ),
    );
    assert(reportArtifacts({ ...input, naming: naming(camel) })[0]?.path === "library.plan.md");
    // a text of governance is escaped for the table it is written into
    const awkward = concept("odd", {
      definition: "A | thing\nover two lines",
      attributes: { id: attribute(identifier(), { definition: "i | x" }), note: attribute(text(), { definition: "n" }) },
      identifiedBy: ["id"],
    });
    const sch = projected(must(domain("oddities", { definition: "d", concepts: [awkward] }))).schema;
    const out = reportArtifacts({ plan: must(plan(undefined, sch, { dialect: postgres })), after: sch, dialect: postgres })[0]?.text ?? "";
    assert(out.includes("- `odd`: A | thing over two lines") && !out.includes("\nover two lines"), "one line");
    assert(!out.split("\n").some((l) => l.startsWith("| ") && /[^\\]\|[^ ]/.test(l.replace(/ \| /g, " ").replace(/^\| |\|$/g, ""))));
  },
);

proves(["0016-sql-plan-report FR-009"], "the settings are typed, each has a default, and a project can change each", () => {
  same(settingsOf({ personalRole: "a", restrictedRole: "b", destructiveRole: "c", steward: "off", table: "migration_log" }), {
    personalRole: "a",
    restrictedRole: "b",
    destructiveRole: "c",
    steward: false,
    table: "migration_log",
  });
});

proves(
  ["0016-sql-plan-report FR-010"],
  "the report is recorded in a table of the database, one row for each step, loaded twice with the same rows, on three engines",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const d = reportData({ plan: planOf(dialect, stateOf(2, dialect), 3), before: v2, after: v3, dialect });
        const stmts = recordStatements(d, dialect);
        assert(
          stmts[0]?.group === "table" &&
            stmts[0].sql.includes('CREATE TABLE IF NOT EXISTS "governance_migration"') &&
            stmts[1]?.group === "data" &&
            stmts[1].sql.includes("ON CONFLICT"),
          name,
        );
        for (const x of [...stmts, ...stmts]) await e.run(x.sql);
        const rows = await e.rows(`SELECT "seq", "name", "class", "reversibility" FROM "governance_migration" ORDER BY "seq"`);
        same(
          rows.map((r) => [r["seq"], r["class"]]),
          d.steps.map((x) => [x.number, x.class]),
          `${name}: one row for each step, once`,
        );
        const approvers = await e.rows(`SELECT "approvers" FROM "governance_migration" WHERE "name" LIKE 'drop column%'`);
        const json = approvers[0]?.["approvers"];
        assert(
          JSON.parse(typeof json === "string" ? json : JSON.stringify(json)).some((a: { role: string }) => a.role === "privacy"),
          `${name}: the approvers are in the row`,
        );
      });
    }
    const qualified = recordStatements(drop(), postgres, { qualifier: "data" });
    assert(
      qualified[0]?.sql.includes('"data"."governance_migration"') &&
        qualified[1]?.sql.includes('INSERT INTO "data"."governance_migration"'),
    );
    const prefixed = recordStatements(drop(), sqlite, { tableName: "data_governance_migration" });
    assert(prefixed[0]?.sql.includes('"data_governance_migration"'));
    same(
      recordStatements(reportData({ plan: planOf(postgres, stateOf(3, postgres), 3), before: v3, after: v3, dialect: postgres }), postgres)
        .length,
      1,
      "a plan with no step has the table and no rows",
    );
  },
);
