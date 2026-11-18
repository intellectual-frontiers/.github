// Spec: 0007-physical FR-012
/**
 * What the database holds (commons data 0007-physical FR-012): for each of the three dialects, the statements `bind` makes for Arca's party model are loaded into a real engine, in memory
 * (SQLite, DuckDB, PostgreSQL by PGlite), and the engine is read back: the tables, columns, nullability, primary keys and indexes are the logical schema's; the engine refuses what the
 * constraints forbid; and the reference data loaded twice leaves the same rows. Each engine is opened for the test and closed after it.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { bind, type Physical } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, type Engine, load, openEngine, refuses, structure, type Structure } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { arcaSchema, snake } from "./logical-fixture.ts";

const physicalFor = (dialect: (typeof DIALECTS)[number]["dialect"]): Physical => {
  const r = bind(arcaSchema(), { dialect });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

/** What the logical schema says an engine should hold. */
const expected = (): Structure => {
  const s = arcaSchema();
  return {
    tables: Object.fromEntries(
      s.tables.map((t) => [
        snake(t.name),
        { columns: Object.fromEntries(t.columns.map((c) => [snake(c.name), c.nullable])), primaryKey: t.primaryKey.map(snake).sort() },
      ]),
    ),
    indexes: s.tables.flatMap((t) => t.indexes.map((i) => snake(i.name))).sort(),
  };
};

const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};

for (const { name, dialect } of DIALECTS) {
  proves(
    ["0007-physical FR-012"],
    `${name}: the statements load, and the engine holds the tables, columns, nullability, primary keys and indexes of the logical schema`,
    async () => {
      await withEngine(name, async (e) => {
        await load(e, physicalFor(dialect));
        const held = await structure(e);
        same(Object.keys(held.tables).sort(), Object.keys(expected().tables).sort());
        for (const [table, want] of Object.entries(expected().tables)) same(held.tables[table], want, table);
        same(held.indexes, expected().indexes);
      });
    },
  );

  proves(["0007-physical FR-012"], `${name}: the engine refuses what the constraints forbid and accepts what they allow`, async () => {
    await withEngine(name, async (e) => {
      await load(e, physicalFor(dialect));
      const ok = async (sql: string): Promise<void> => {
        await e.run(sql);
      };
      await ok(`INSERT INTO "party" ("party_id", "party_kind_code", "display_name") VALUES ('p1', 'person', 'Ada')`);
      await ok(`INSERT INTO "party" ("party_id", "party_kind_code", "display_name") VALUES ('p2', 'organization', 'Engines Ltd')`);
      await ok(`INSERT INTO "person" ("party_id", "given_name", "family_name") VALUES ('p1', 'Ada', 'Lovelace')`);
      // a foreign key: a kind that is not a code of its list, and a person with no party
      assert(
        await refuses(e, `INSERT INTO "party" ("party_id", "party_kind_code", "display_name") VALUES ('p3', 'robot', 'X')`),
        "an unknown kind",
      );
      assert(
        await refuses(e, `INSERT INTO "person" ("party_id", "given_name", "family_name") VALUES ('nobody', 'A', 'B')`),
        "a person with no party",
      );
      // a primary key
      assert(
        await refuses(e, `INSERT INTO "party" ("party_id", "party_kind_code", "display_name") VALUES ('p1', 'person', 'Again')`),
        "a key twice",
      );
      // a unique constraint: a party holds one identifier of a kind
      await ok(
        `INSERT INTO "party_identifier" ("party_identifier_id", "party_id", "party_identifier_kind_code", "identifier") VALUES ('i1', 'p1', 'tax_number', 'GB123')`,
      );
      assert(
        await refuses(
          e,
          `INSERT INTO "party_identifier" ("party_identifier_id", "party_id", "party_identifier_kind_code", "identifier") VALUES ('i2', 'p1', 'tax_number', 'GB999')`,
        ),
        "two identifiers of a kind",
      );
      await ok(
        `INSERT INTO "party_identifier" ("party_identifier_id", "party_id", "party_identifier_kind_code", "identifier") VALUES ('i3', 'p1', 'passport_number', 'P1')`,
      );
      // a check across two columns: a party is not related to itself
      assert(
        await refuses(
          e,
          `INSERT INTO "party_relation" ("party_relation_id", "party_relation_kind_code", "valid_from", "from_party_id", "to_party_id") VALUES ('r1', 'employed_by', '2026-01-01', 'p1', 'p1')`,
        ),
        "a party related to itself",
      );
      await ok(
        `INSERT INTO "party_relation" ("party_relation_id", "party_relation_kind_code", "valid_from", "from_party_id", "to_party_id") VALUES ('r2', 'employed_by', '2026-01-01', 'p1', 'p2')`,
      );
      // a check of a closed list
      assert(
        await refuses(
          e,
          `INSERT INTO "electronic_contact" ("electronic_contact_id", "party_id", "medium", "address") VALUES ('c1', 'p1', 'fax', '1')`,
        ),
        "a medium that is not in the list",
      );
      await ok(
        `INSERT INTO "electronic_contact" ("electronic_contact_id", "party_id", "medium", "address") VALUES ('c2', 'p1', 'email', 'ada@example.com')`,
      );
      // defaults: a boolean that is false, and the moment of the insert
      const row = (await e.rows(`SELECT "is_primary" p, "created_at" c FROM "electronic_contact" WHERE "electronic_contact_id" = 'c2'`))[0];
      assert(row !== undefined && row["c"] !== null && row["c"] !== undefined, "created_at has a default");
      assert(row?.["p"] === false || row?.["p"] === 0, `is_primary defaults to false, was ${String(row?.["p"])}`);
      // a not null column
      assert(
        await refuses(e, `INSERT INTO "organization" ("party_id", "founded_on") VALUES ('p2', '2000-01-01')`),
        "a name that is required",
      );
    });
  });

  proves(
    ["0007-physical FR-012", "0007-physical FR-008"],
    `${name}: the reference data is loaded, in the codes of the model it replaces, and loaded twice leaves the same rows`,
    async () => {
      await withEngine(name, async (e) => {
        const p = physicalFor(dialect);
        await load(e, p);
        const rows = async (): Promise<unknown[]> => {
          const out: unknown[] = [];
          for (const t of ["party_kind", "party_role_kind", "party_relation_kind", "party_identifier_kind"])
            out.push(await e.rows(`SELECT "code", "label", "description" FROM "${t}" ORDER BY "code"`));
          return out;
        };
        const first = await rows();
        same(first[0], [
          { code: "organization", label: "Organization", description: "A company, agency, club or any other body" },
          { code: "person", label: "Person", description: "A human being" },
        ]);
        same(
          (first[2] as { code: string }[]).map((r) => r.code),
          ["employed_by", "member_of", "subsidiary_of"],
        );
        same(
          (first[3] as { code: string }[]).map((r) => r.code),
          ["company_registration", "passport_number", "tax_number"],
        );
        await load(e, p, ["data"]);
        same(await rows(), first);
        await e.run(`UPDATE "party_kind" SET "label" = 'Changed' WHERE "code" = 'person'`);
        await load(e, p, ["data"]);
        same(await rows(), first, "a load restores what it says");
        await load(e, p, ["table", "index"]);
        same(await rows(), first, "the tables made again change nothing");
      });
    },
  );
}
