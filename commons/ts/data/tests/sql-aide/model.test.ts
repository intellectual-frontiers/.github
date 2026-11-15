/**
 * The model as a whole: the order entities are defined in, the examples `netspective-labs/sql-aide` began with rendered for three
 * dialects, lint, the documentation map and TAP (commons 0006-sql-aide FR-005, FR-009, FR-017, FR-025 to FR-027, FR-031).
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, assertThrows, proves } from "../../../runtime/test.ts";
import {
  context,
  definitions,
  docsModule,
  docsOf,
  duckdb,
  extractDocs,
  failed,
  fk,
  fromLines,
  integer,
  lint,
  type LintRule,
  ordered,
  parseComment,
  pass,
  pd,
  pk,
  postgres,
  render,
  self,
  skipped,
  sqlite,
  table,
  tally,
  tapText,
  text,
} from "../../sql-aide/mod.ts";
import { golden } from "../helpers.ts";

const withoutPk = table("synthetic_table_without_pk", {
  text: text(),
  text_nullable: text().nullable(),
  int: integer(),
  int_nullable: integer().nullable(),
});
const autoInc = table("synthetic_table_with_auto_inc_pk", {
  auto_inc_primary_key: pk.autoInc(),
  text: text(),
  text_nullable: text().nullable(),
  int: integer(),
  int_nullable: integer().nullable(),
});
const withFk = table("synthetic_table_with_foreign_keys", {
  auto_inc_primary_key: pk.autoInc(),
  fk_int_primary_key: fk(autoInc.c.auto_inc_primary_key),
  fk_int_primary_key_nullable: fk(autoInc.c.auto_inc_primary_key).nullable(),
  parent: self("auto_inc_primary_key").nullable(),
});

proves(["0006-sql-aide FR-009"], "entities are defined in the order of their references, whatever order they are written in", () => {
  const sorted = ordered([withFk, withoutPk, autoInc]);
  assert(sorted.kind === "ok");
  const names = sorted.value.map((e) => e.name);
  assert(names.indexOf("synthetic_table_with_auto_inc_pk") < names.indexOf("synthetic_table_with_foreign_keys"));
  assertEquals(names.length, 3);
  // a table that refers to itself is not a circle
  assertEquals(
    withFk.dependsOn().map((d) => d.name),
    ["synthetic_table_with_auto_inc_pk", "synthetic_table_with_auto_inc_pk"],
  );
  const a = { entity: "table", name: "a", schema: undefined, ddl: withoutPk.ddl, dependsOn: () => [{ name: "b", schema: undefined }] };
  const b = { entity: "table", name: "b", schema: undefined, ddl: withoutPk.ddl, dependsOn: () => [{ name: "a", schema: undefined }] };
  const circle = ordered([a, b]);
  assert(circle.kind === "err" && circle.error.kind === "cycle");
  assertThrows(() => render(definitions([a, b]), context({ dialect: postgres() })));
});

for (const dialect of [postgres(), sqlite(), duckdb()]) {
  proves(
    ["0006-sql-aide FR-015", "0006-sql-aide FR-017"],
    `the first examples of sql-aide are what is committed, for ${dialect.name}`,
    async () => {
      const text = render(definitions([withFk, withoutPk, autoInc]), context({ dialect }));
      await golden(new URL(`./golden/getting-started.${dialect.name}.sql`, import.meta.url), `${text}\n`);
    },
  );
}

proves(
  ["0006-sql-aide FR-025", "0006-sql-aide FR-026", "0006-sql-aide FR-027"],
  "lint finds what a governed table lacks, as data, and a plugin may add a rule",
  () => {
    const bare = table("Bare", { Name: text().personal(), email: text().personal("EmailAddress") });
    const ctx = context({ dialect: postgres() });
    const found = lint([bare], ctx)
      .map((f) => `${f.rule}:${f.column ?? ""}`)
      .sort();
    assertEquals(found, [
      "description:",
      "description:Name",
      "description:email",
      "naming:",
      "naming:Name",
      "owner:",
      "personal-data:Name",
      "primary-key:",
    ]);
    const good = table(
      "party",
      { party_id: pk.ulid().doc("The key"), email: text().doc("Where to write").personal("EmailAddress") },
      { doc: "A party", owner: "data" },
    );
    assertEquals(lint([good], ctx), []);
    assertEquals([good.spec.columns[1]?.[1].personal, good.spec.columns[1]?.[1].category], ["PersonalData", "EmailAddress"]);
    assertEquals(
      table("t", { r: text().personal("Religion") }).spec.columns[0]?.[1].personal,
      "SpecialCategoryPersonalData",
      "the class is the vocabulary's",
    );
    assertEquals(pd.Religion.kind, "SpecialCategoryPersonalData");
    const never: LintRule = { id: "never", check: ({ spec }) => [{ rule: "never", table: spec.name, message: "is not allowed" }] };
    const plugged = context({ dialect: postgres(), plugins: [{ name: "strict", version: "1.0.0", hooks: { lint: [never] } }] });
    assertEquals(
      lint([good], plugged).map((f) => f.rule),
      ["never"],
    );
  },
);

const SOURCE = `
/**
 * A person or an organization.
 *
 * @remarks Everything else hangs from a party.
 * @deprecated use party2
 */
export const party = table("party", {
  /** The party's key. */
  party_id: pk.ulid(),
  /**
   * What the party is called
   * in everyday use.
   */
  name: text(),
  undocumented: text(),
});

/**
 * People born since a date.
 * @param since - the earliest birth date
 */
export const bornSince = fn("born_since", { args: { since: date() } });

export const nothing = 1;
`;

proves(
  ["0006-sql-aide FR-005", "0006-sql-aide FR-025"],
  "the TSDoc comments of a module become its documentation map, and the map documents what is emitted",
  () => {
    assertEquals(parseComment("/** One.\n * Two.\n * @param a - first\n * @remarks More. */"), {
      summary: "One. Two.",
      params: { a: "first" },
      remarks: "More.",
    });
    const docs = extractDocs(SOURCE);
    assertEquals(Object.keys(docs).sort(), ["bornSince", "party"]);
    assertEquals(docs["party"], {
      summary: "A person or an organization.",
      remarks: "Everything else hangs from a party.",
      deprecated: "use party2",
      members: { party_id: "The party's key.", name: "What the party is called in everyday use." },
    });
    assertEquals(docs["bornSince"]?.members, { since: "the earliest birth date" });
    const moduleText = docsModule(docs, "arca/party.ts");
    assertEquals(moduleText, docsModule(extractDocs(SOURCE), "arca/party.ts"), "the same bytes from the same source");
    assertStringIncludes(moduleText, "AUTO-GENERATED from the TSDoc comments of arca/party.ts");
    assertStringIncludes(moduleText, `name: "What the party is called in everyday use.",`);

    const party = table("party", { party_id: pk.ulid(), name: text(), undocumented: text() });
    const bound = docsOf({ party, nothing: 1 }, docs);
    const sql = render(party.ddl, context({ dialect: postgres(), docs: [bound] }));
    assertStringIncludes(sql, `COMMENT ON TABLE "party" IS 'A person or an organization.';`);
    assertStringIncludes(sql, `COMMENT ON COLUMN "party"."name" IS 'What the party is called in everyday use.';`);
    assert(!sql.includes(`"party"."undocumented" IS`));
    const inSqlite = render(party.ddl, context({ dialect: sqlite(), docs: [bound] }));
    assertStringIncludes(inSqlite, "-- A person or an organization.\nCREATE TABLE");
    assertStringIncludes(inSqlite, `    -- The party's key.\n    "party_id" TEXT NOT NULL PRIMARY KEY,`);
    assertEquals(
      lint([party], context({ dialect: postgres(), docs: [bound] }))
        .filter((f) => f.rule === "description")
        .map((f) => f.column),
      ["undocumented"],
    );
  },
);

proves(
  ["0006-sql-aide FR-031"],
  "results are written as TAP version 14, with subtests, directives and diagnostics, and read back from lines",
  () => {
    const nodes = [
      pass("party exists", [pass("it has 3 columns"), failed("it has an owner", { found: null, wanted: "data" })]),
      failed("person # has a key", { columns: ["a", "b"], nested: { n: 1 } }),
      skipped("lifecycle", "no PostgreSQL server was given"),
      { kind: "comment", text: "done" } as const,
    ];
    assertEquals(
      tapText(nodes),
      [
        "TAP version 14",
        "# Subtest: party exists",
        "    ok 1 - it has 3 columns",
        "    not ok 2 - it has an owner",
        "      ---",
        "      found: null",
        '      wanted: "data"',
        "      ...",
        "    1..2",
        "ok 1 - party exists",
        "not ok 2 - person \\# has a key",
        "  ---",
        "  columns:",
        '    - "a"',
        '    - "b"',
        "  nested:",
        "    n: 1",
        "  ...",
        "ok 3 - lifecycle # SKIP no PostgreSQL server was given",
        "# done",
        "1..3",
        "",
      ].join("\n"),
    );
    assertEquals(tally(nodes), { passed: 1, failed: 1, skipped: 1 });
    const read = fromLines([
      "TAP version 14",
      "ok 1 - party exists",
      "not ok 2 - person has a key",
      "ok 3 - later # SKIP not yet",
      "1..3",
      "# a note",
    ]);
    assertEquals(tally(read), { passed: 1, failed: 1, skipped: 1 });
    assertEquals(
      read.map((n) => (n.kind === "test" ? n.description : n.kind)),
      ["party exists", "person has a key", "later", "comment"],
    );
  },
);
