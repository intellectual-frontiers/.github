// Spec: 0007-physical FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * Binding (commons data 0007-physical): the statements `bind` makes for a logical schema and a dialect, as text. The DDL of a small domain is written out for each dialect so that a reader sees
 * what is made; the order, the names, the codes, the errors (a pattern SQLite cannot say, a name too long, names alike, a cycle) and what an extension adds are held; and the same input gives
 * the same text. What the engines do with the text is `physical-engines.test.ts`.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { compose, contribute, defineExtension, extensionId } from "@intellectual-frontiers/data/engine";
import {
  annotate,
  type AnyConcept,
  attribute,
  boolean,
  codeOf,
  concept,
  date,
  decimal,
  identifier,
  instant,
  integer,
  relationship,
  structured,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import { dialect as duckdb, extension as duckdbExtension } from "@intellectual-frontiers/data/sql/dialects/duckdb";
import { dialect as postgres, extension as postgresExtension } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite, extension as sqliteExtension } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { projectDomain, type LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import {
  bind,
  camel,
  type Dialect,
  dialectsFrom,
  GROUPS,
  naming,
  type Physical,
  type PhysicalError,
  render,
  sourcesFrom,
  statementsPoint,
  type StatementSource,
  snake,
} from "@intellectual-frontiers/data/sql/physical";
import { same } from "./governance-fixture.ts";
import { arcaSchema, openKinds, world } from "./logical-fixture.ts";

const { quality } = vocabularies;

const schemaOf = (concepts: readonly AnyConcept[], lists = [openKinds]): LogicalSchema => {
  const r = projectDomain(world(concepts, lists));
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value.schema;
};
const bound = (s: LogicalSchema, dialect: Dialect, options: { naming?: ReturnType<typeof naming> } = {}): Physical => {
  const r = bind(s, { dialect, ...options });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const errorsOf = (s: LogicalSchema, dialect: Dialect): readonly PhysicalError[] => {
  const r = bind(s, { dialect });
  if (r.kind === "ok") throw new Error("bind did not fail");
  return r.error;
};

/** A concept of every shape a table has: a text of a length, an optional date, a default, a closed list, a unique pair, a key of two, a lookup. */
const sample = (): LogicalSchema => {
  const owner = concept("owner", {
    definition: "o",
    attributes: { a: attribute(identifier(), { definition: "a" }), b: attribute(integer(), { definition: "b" }) },
    identifiedBy: ["a", "b"],
  });
  const item = concept("item", {
    definition: "i",
    attributes: {
      itemId: attribute(identifier(), { definition: "i" }),
      code: attribute(text({ max: 4 }), { definition: "c" }),
      since: attribute(date(), { definition: "s", multiplicity: "optional" }),
      live: attribute(boolean(), { definition: "l", annotations: [annotate(quality.defaultValue, false)] }),
      seen: attribute(instant(), { definition: "s" }),
      price: attribute(decimal({ precision: 9, scale: 2 }), { definition: "p" }),
      extra: attribute(structured(), { definition: "e" }),
      kind: attribute(codeOf(openKinds), { definition: "k", annotations: [annotate(quality.defaultValue, "betaGamma")] }),
    },
    identifiedBy: ["itemId"],
    relationships: { owner: relationship(owner, { cardinality: "one", definition: "o" }) },
    annotations: [annotate(quality.unique, { members: ["owner", "code"] })],
  });
  return schemaOf([owner, item]);
};

proves(
  ["0007-physical FR-004", "0007-physical FR-007"],
  "the DDL of a small domain, written out for each dialect, with the types of each engine",
  () => {
    const s = sample();
    same(render(bound(s, sqlite)).split("\n\n").slice(2, 3), [
      [
        'CREATE TABLE IF NOT EXISTS "item" (',
        '    "item_id" TEXT NOT NULL PRIMARY KEY,',
        '    "code" TEXT NOT NULL,',
        '    "since" TEXT,',
        '    "live" INTEGER NOT NULL DEFAULT FALSE,',
        '    "seen" TEXT NOT NULL,',
        '    "price" NUMERIC NOT NULL,',
        '    "extra" TEXT NOT NULL,',
        "    \"kinds_code\" TEXT NOT NULL DEFAULT 'beta_gamma',",
        '    "owner_a" TEXT NOT NULL,',
        '    "owner_b" INTEGER NOT NULL,',
        '    CONSTRAINT "item_kinds_code_fk" FOREIGN KEY ("kinds_code") REFERENCES "kinds" ("code"),',
        '    CONSTRAINT "item_owner_a_owner_b_fk" FOREIGN KEY ("owner_a", "owner_b") REFERENCES "owner" ("a", "b"),',
        '    CONSTRAINT "item_owner_a_owner_b_code_uq" UNIQUE ("owner_a", "owner_b", "code")',
        ");",
      ].join("\n"),
    ]);
    const columns = (d: Dialect): string[] =>
      (
        render(bound(s, d))
          .split("\n\n")
          .find((x) => x.startsWith('CREATE TABLE IF NOT EXISTS "item"')) ?? ""
      )
        .split("\n")
        .filter((l) => /^ {4}"(code|since|live|seen|price|extra)" /.test(l))
        .map((l) => l.trim().replace(/,$/, ""));
    same(columns(postgres), [
      '"code" VARCHAR(4) NOT NULL',
      '"since" DATE',
      '"live" BOOLEAN NOT NULL DEFAULT FALSE',
      '"seen" TIMESTAMPTZ NOT NULL',
      '"price" NUMERIC(9, 2) NOT NULL',
      '"extra" JSONB NOT NULL',
    ]);
    same(columns(duckdb), [
      '"code" VARCHAR NOT NULL',
      '"since" DATE',
      '"live" BOOLEAN NOT NULL DEFAULT FALSE',
      '"seen" TIMESTAMPTZ NOT NULL',
      '"price" DECIMAL(9, 2) NOT NULL',
      '"extra" JSON NOT NULL',
    ]);
    same(columns(sqlite), [
      '"code" TEXT NOT NULL',
      '"since" TEXT',
      '"live" INTEGER NOT NULL DEFAULT FALSE',
      '"seen" TEXT NOT NULL',
      '"price" NUMERIC NOT NULL',
      '"extra" TEXT NOT NULL',
    ]);
  },
);

proves(["0007-physical FR-004"], "the three dialects are extensions that contribute themselves through the engine", () => {
  const all = [sqliteExtension, duckdbExtension, postgresExtension].flatMap((e) => (e.kind === "ok" ? [e.value] : []));
  same(
    all.map((e) => e.id),
    ["sql.dialect.sqlite", "sql.dialect.duckdb", "sql.dialect.postgres"],
  );
  const c = compose(all);
  assert(c.kind === "ok");
  if (c.kind === "ok")
    same(
      dialectsFrom(c.value).map((d) => d.name),
      ["sqlite", "duckdb", "postgres"],
    );
  same(
    [sqlite.features, duckdb.features, postgres.features],
    [
      ["instead-of-triggers", "triggers"],
      ["comment-on", "regex-check", "or-replace-view", "alter-column", "schemas"],
      [
        "comment-on",
        "regex-check",
        "add-constraint",
        "or-replace-view",
        "row-security",
        "grants",
        "routines",
        "partitions",
        "alter-column",
        "schemas",
        "updatable-views",
        "triggers",
        "event-triggers",
      ],
    ],
  );
  same(
    [sqlite.quote('a"b'), postgres.literal("it's"), postgres.literal(true), duckdb.literal(null), sqlite.literal(3)],
    ['"a""b"', "'it''s'", "TRUE", "NULL", "3"],
  );
});

proves(
  ["0007-physical FR-006", "0007-physical FR-007"],
  "a table follows the tables its foreign keys refer to, indexes follow tables, data follows both, and the groups are in their order",
  () => {
    const s = arcaSchema();
    const p = bound(s, sqlite);
    same(p.statements.length, 22);
    same([...new Set(p.statements.map((x) => x.group))], ["table", "index", "data"]);
    const position = (name: string): number => p.statements.findIndex((x) => x.sql.startsWith(`CREATE TABLE IF NOT EXISTS "${name}" (`));
    for (const t of s.tables)
      for (const f of t.foreignKeys)
        assert(
          position(f.references.table.join("_")) <= position(t.name.join("_")),
          `${t.name.join("_")} before ${f.references.table.join("_")}`,
        );
    const groups = p.statements.map((x) => GROUPS.indexOf(x.group));
    same(
      groups,
      [...groups].sort((a, b) => a - b),
    );
    assert(p.statements.filter((x) => x.group === "table").every((x) => x.sql.startsWith("CREATE TABLE IF NOT EXISTS")));
    assert(p.statements.filter((x) => x.group === "index").every((x) => x.sql.startsWith("CREATE INDEX IF NOT EXISTS")));
    assert(p.statements.every((x) => x.sql.endsWith(";")));
    const selfRef: AnyConcept = concept("node", {
      definition: "n",
      attributes: { id: attribute(identifier(), { definition: "i" }) },
      identifiedBy: ["id"],
      relationships: { parent: relationship(() => selfRef, { cardinality: "optional", definition: "p" }) },
    });
    const one = bound(schemaOf([selfRef], []), sqlite);
    same(one.statements.length, 1);
    assert(one.statements[0]?.sql.includes('FOREIGN KEY ("parent_node_id") REFERENCES "node" ("id")'));
  },
);

proves(["0007-physical FR-009", "0001-layers FR-006"], "every statement carries the logical elements it was made from", () => {
  const s = arcaSchema();
  const ids = new Set<string>();
  for (const t of s.tables) {
    ids.add(t.id);
    for (const c of t.columns) ids.add(c.id);
    for (const x of [...t.foreignKeys, ...t.uniques, ...t.checks, ...t.indexes]) ids.add(x.id);
  }
  const p = bound(s, postgres);
  for (const x of p.statements) {
    assert(x.of.length > 0, x.sql);
    for (const id of x.of) assert(ids.has(id), `${id} is not in the schema`);
  }
  const person = p.statements.find((x) => x.sql.startsWith('CREATE TABLE IF NOT EXISTS "person" ('));
  assert(
    person?.of.includes("table:person" as never) &&
      person.of.includes("column:person/given.name" as never) &&
      person.of.includes("fk:person.party.id.fk" as never),
  );
  same(p.statements.find((x) => x.group === "index" && x.sql.includes("person_family_name_given_name_idx"))?.of, [
    "ix:person.family.name.given.name.idx",
  ]);
});

proves(["0007-physical FR-001", "0007-physical FR-007", "0005-naming FR-004", "0001-layers FR-012"], "the case style writes every name, and a snake case schema is the default", () => {
  const s = arcaSchema();
  const defaults = render(bound(s, sqlite));
  const snakeCase = render(bound(s, sqlite, { naming: naming(snake) }));
  same(defaults, snakeCase);
  assert(
    defaults.includes('"party_kind_code"') && defaults.includes('"person_family_name_given_name_idx"') && defaults.includes('"created_at"'),
  );
  const camelCase = render(bound(s, sqlite, { naming: naming(camel) }));
  assert(
    camelCase.includes('CREATE TABLE IF NOT EXISTS "partyRole" (') &&
      camelCase.includes('"partyKindCode"') &&
      camelCase.includes('"fromPartyId"') &&
      camelCase.includes('CONSTRAINT "partyRelationPartiesDifferCk"'),
  );
  assert(!camelCase.includes("party_"));
});

proves(
  ["0007-physical FR-002", "0007-physical FR-008"],
  "reference rows are upserts with the codes written by the style of the codes, in snake case, by another style, or as their names",
  () => {
    const s = arcaSchema();
    const data = (n?: ReturnType<typeof naming>): string[] =>
      bound(s, postgres, n === undefined ? {} : { naming: n })
        .statements.filter((x) => x.group === "data")
        .map((x) => x.sql);
    const d = data();
    same(d.length, 4);
    assert(d[2]?.startsWith('INSERT INTO "party_relation_kind" ("code", "label", "description") VALUES\n'));
    assert(
      d[2]?.includes("('employed_by', 'Employed by', 'A person works for an organization')") &&
        d[2].endsWith('ON CONFLICT ("code") DO UPDATE SET "label" = excluded."label", "description" = excluded."description";'),
    );
    assert(data(naming(snake, "name"))[2]?.includes("('employedBy', 'Employed by'"));
    assert(
      data(naming(camel))[2]?.includes("('employedBy', 'Employed by'") &&
        data(naming(camel))[2]?.startsWith('INSERT INTO "partyRelationKind" ("code", "label", "description")'),
    );
    assert(d[0]?.includes("('person', 'Person', 'A human being')"));
    const closed = render(bound(s, sqlite, { naming: naming(snake, camel) }));
    assert(closed.includes("IN ('email', 'telephone', 'web')"));
  },
);

proves(
  ["0007-physical FR-005"],
  "a pattern is a check where the engine has a regular expression, and an error value naming the check where it has none",
  () => {
    const c = concept("coded", {
      definition: "c",
      attributes: {
        id: attribute(identifier(), { definition: "i" }),
        code: attribute(text(), { definition: "c", annotations: [annotate(quality.pattern, "^[A-Z]+$")] }),
      },
      identifiedBy: ["id"],
    });
    const s = schemaOf([c], []);
    same(errorsOf(s, sqlite), [
      { kind: "unsupported", element: "ck:coded.code.pattern.ck", why: "sqlite has no regular expression to check a pattern with" },
    ]);
    assert(render(bound(s, postgres)).includes(`CONSTRAINT "coded_code_pattern_ck" CHECK ("code" ~ '^[A-Z]+$')`));
    assert(render(bound(s, duckdb)).includes(`CONSTRAINT "coded_code_pattern_ck" CHECK (regexp_matches("code", '^[A-Z]+$'))`));
  },
);

proves(
  ["0007-physical FR-003"],
  "a name that is too long, and two names that are alike once written, are error values with the elements that clash",
  () => {
    const long = "a".repeat(55);
    const big = concept(`${long}One`, {
      definition: "b",
      attributes: { id: attribute(identifier(), { definition: "i" }), x: attribute(text(), { definition: "x" }) },
      identifiedBy: ["id"],
      annotations: [annotate(vocabularies.usage.lookup, { members: ["x"] })],
    });
    const s = schemaOf([big], []);
    const errors = errorsOf(s, postgres);
    assert(
      errors.some((e) => e.kind === "length" && e.max === 63 && e.name.endsWith("_x_idx")),
      JSON.stringify(errors),
    );
    assert(bind(s, { dialect: sqlite }).kind === "ok", "SQLite has no such limit");
    const same2 = { name: "same", write: () => "x" };
    const clash = bind(arcaSchema(), { dialect: sqlite, naming: naming(same2) });
    assert(clash.kind === "err");
    if (clash.kind === "err") {
      assert(clash.error.some((e) => e.kind === "collision" && e.name === "x" && e.table === undefined));
      assert(clash.error.some((e) => e.kind === "collision" && e.table === "x"));
    }
  },
);

proves(
  ["0007-physical FR-006"],
  "a cycle of foreign keys is added afterwards where the engine can add a constraint, and is an error value where it cannot",
  () => {
    const a: AnyConcept = concept("alpha", {
      definition: "a",
      attributes: { id: attribute(identifier(), { definition: "i" }) },
      identifiedBy: ["id"],
      relationships: { beta: relationship(() => b, { cardinality: "optional", definition: "b" }) },
    });
    const b: AnyConcept = concept("beta", {
      definition: "b",
      attributes: { id: attribute(identifier(), { definition: "i" }) },
      identifiedBy: ["id"],
      relationships: { alpha: relationship(() => a, { cardinality: "optional", definition: "a" }) },
    });
    const s = schemaOf([a, b], []);
    const p = bound(s, postgres);
    same(
      p.statements.map((x) => x.group),
      ["table", "table", "constraint", "constraint"],
    );
    const alters = p.statements.filter((x) => x.group === "constraint").map((x) => x.sql);
    same(alters.sort(), [
      'ALTER TABLE "alpha" ADD CONSTRAINT "alpha_beta_id_fk" FOREIGN KEY ("beta_id") REFERENCES "beta" ("id");',
      'ALTER TABLE "beta" ADD CONSTRAINT "beta_alpha_id_fk" FOREIGN KEY ("alpha_id") REFERENCES "alpha" ("id");',
    ]);
    assert(p.statements.filter((x) => x.group === "table").every((x) => !x.sql.includes("FOREIGN KEY")));
    same(
      errorsOf(s, sqlite).map((e) => e.kind),
      ["cycle"],
    );
    same(
      errorsOf(s, duckdb).map((e) => e.kind),
      ["cycle"],
    );
  },
);

proves(
  ["0007-physical FR-010", "0007-physical FR-011"],
  "the same input gives the same text, and an extension adds statements by group, being given the written names",
  () => {
    const s = arcaSchema();
    same(render(bound(s, duckdb)), render(bound(s, duckdb)));
    const doc: StatementSource = (ctx) => {
      const person = ctx.schema.tables.find((t) => t.name.join("_") === "person");
      const name = person === undefined ? undefined : ctx.written.table(person.id);
      const given = person?.columns.find((c) => c.name.join("_") === "given_name");
      return {
        kind: "ok",
        value: [
          {
            group: "documentation",
            sql: `COMMENT ON COLUMN ${ctx.dialect.quote(name ?? "?")}.${ctx.dialect.quote(given === undefined ? "?" : (ctx.written.column(given.id) ?? "?"))} IS 'x';`,
            of: given === undefined ? [] : [given.id],
          },
        ],
      };
    };
    const late: StatementSource = () => ({ kind: "ok", value: [{ group: "table", sql: "-- a table of an extension;", of: [] }] });
    const id = extensionId("sql.docs");
    assert(id.kind === "ok");
    if (id.kind !== "ok") return;
    const c = compose([
      defineExtension({
        id: id.value,
        version: "1.0.0",
        contributes: [contribute(statementsPoint, doc), contribute(statementsPoint, late)],
      }),
    ]);
    assert(c.kind === "ok");
    if (c.kind !== "ok") return;
    const p = bind(s, { dialect: postgres, naming: naming(camel), sources: sourcesFrom(c.value) });
    assert(p.kind === "ok");
    if (p.kind !== "ok") return;
    same(p.value.statements.slice(-1)[0]?.sql, `COMMENT ON COLUMN "person"."givenName" IS 'x';`);
    same(p.value.statements.filter((x) => x.group === "table").slice(-1)[0]?.sql, "-- a table of an extension;");
    const groups = p.value.statements.map((x) => GROUPS.indexOf(x.group));
    same(
      groups,
      [...groups].sort((a, b) => a - b),
    );
    const failing: StatementSource = () => ({ kind: "err", error: [{ kind: "unsupported", element: "x" as never, why: "no" }] });
    const f = bind(s, { dialect: postgres, sources: [failing] });
    same(f.kind === "err" ? f.error.map((e) => e.kind) : [], ["unsupported"]);
  },
);
