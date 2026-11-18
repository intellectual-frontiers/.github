// Spec: 0027-sql-osquery-atc FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * osquery ATC (commons data 0027-sql-osquery-atc): the configuration made from a logical schema, with what osquery refuses refused first, the same bytes every time, and every entry's query run on a
 * SQLite database built from the same source, where it gives the columns the entry says.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { atc, type AtcEntry, POSIX_PATH, WINDOWS_PATH } from "@intellectual-frontiers/data/sql/extensions/osquery-atc";
import { materialize, targetBuild } from "@intellectual-frontiers/data/sql/extensions/target";
import { openEngine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const schema = libraryAt(2);
const entry = (over: Partial<AtcEntry> = {}): AtcEntry => ({ name: "managed_authors", table: "author", columns: ["id", "name"], path: "/var/osquery/atc/managed.sqlite.db", platform: "posix", ...over });
const bare = (over: Partial<AtcEntry> = {}): AtcEntry => {
  const { platform: _platform, ...rest } = entry(over);
  return rest;
};
const bad = (e: AtcEntry[], dialect = sqlite): string[] => {
  const r = atc(schema, e, { dialect });
  return r.kind === "err" ? r.error.map((x) => x.kind) : ["ok"];
};

proves(
  ["0027-sql-osquery-atc FR-001", "0027-sql-osquery-atc FR-002"],
  "the configuration has an entry for each table in the order of their names, whose query selects its columns, written by the dialect, from its table, and it is the same bytes every time",
  () => {
    const r = atc(schema, [entry({ name: "zeta", table: "genre", columns: ["code", "label"] }), bare({ columns: ["name", "id"] })], { dialect: sqlite });
    assert(r.kind === "ok");
    if (r.kind !== "ok") return;
    same(Object.keys(r.value.config.auto_table_construction), ["managed_authors", "zeta"], "in the order of their names");
    same(r.value.config.auto_table_construction["managed_authors"], { query: 'SELECT "name", "id" FROM "author"', path: "/var/osquery/atc/managed.sqlite.db", columns: ["name", "id"] });
    same(r.value.config.auto_table_construction["zeta"]?.platform, "posix");
    same(r.value.json, `${JSON.stringify(r.value.config, null, 2)}\n`);
    const again = atc(schema, [bare({ columns: ["name", "id"] }), entry({ name: "zeta", table: "genre", columns: ["code", "label"] })], { dialect: sqlite });
    assert(again.kind === "ok" && again.value.json === r.value.json, "whatever order the entries are given in");
    const prefixed = atc(schema, [entry()], { dialect: sqlite, schema: "data" });
    assert(prefixed.kind === "ok" && prefixed.value.config.auto_table_construction["managed_authors"]?.query === 'SELECT "id", "name" FROM "data_author"', "the schema's words first");
  },
);

proves(
  ["0027-sql-osquery-atc FR-001", "0027-sql-osquery-atc FR-003", "0027-sql-osquery-atc FR-004"],
  "what osquery refuses is an error as a value: another dialect, an unknown table or column, a name, a duplicate, a column called path, no columns, a platform and a path that does not fit its platform",
  () => {
    same(bad([entry()], postgres), ["unsupported"]);
    same(bad([entry({ table: "nope" })]), ["unknown-table"]);
    same(bad([entry({ columns: ["id", "shoe"] })]), ["unknown-column"]);
    same(bad([entry({ name: "Bad-Name" })]), ["name"]);
    same(bad([entry({ name: "1abc" })]), ["name"]);
    same(bad([entry(), entry()]), ["duplicate"]);
    same(bad([entry({ columns: [] })]), ["no-columns"]);
    same(bad([entry({ platform: "plan9" as never })]), ["platform"]);
    same(bad([entry({ path: "relative/db" })]), ["path"]);
    same(bad([entry({ platform: "windows" })]), ["path"], "a POSIX path for Windows");
    same(bad([entry({ platform: "windows", path: "C:\\ProgramData\\osquery\\managed.db" })]), ["ok"]);
    same(bad([entry({ platform: "any", path: "/Users/%/Library/x.db" })]), ["ok"], "% for any one directory");
    assert(POSIX_PATH.test("/a") && !POSIX_PATH.test("a") && WINDOWS_PATH.test("\\\\host\\share\\x") && !WINDOWS_PATH.test("/a"));
  },
);

proves(
  ["0027-sql-osquery-atc FR-003"],
  "a column that is written as path, in any case, is refused because osquery adds a path column of its own",
  async () => {
    // a table with a column called path: made as a logical schema from governance
    const { attribute, concept, domain, identifier, text } = await import("@intellectual-frontiers/data/governance");
    const { projected } = await import("./logical-fixture.ts");
    const file = concept("seenFile", { definition: "A file that was seen", attributes: { id: attribute(identifier(), { definition: "What identifies it" }), path: attribute(text(), { definition: "Where it is" }) }, identifiedBy: ["id"] });
    const d = domain("files", { definition: "Files", concepts: [file] });
    assert(d.kind === "ok");
    if (d.kind !== "ok") return;
    const s = projected(d.value).schema;
    const r = atc(s, [{ name: "seen", table: "seen file", columns: ["id", "path"], path: "/x.db" }], { dialect: sqlite });
    assert(r.kind === "err" && r.error.some((e) => e.kind === "path-column" && e.column === "path"));
    assert(atc(s, [{ name: "seen", table: "seen file", columns: ["id"], path: "/x.db" }], { dialect: sqlite }).kind === "ok");
  },
);

proves(
  ["0027-sql-osquery-atc FR-005"],
  "every entry's query runs on a SQLite database built from the same schema and rows and gives the columns the entry says",
  async () => {
    const rows = { author: [{ id: "a1", name: "Ann", born: "1990-01-02" }, { id: "a2", name: "Bo" }], genre: [] };
    const build = targetBuild(schema, { dialect: sqlite, rows: { author: rows.author } });
    assert(build.kind === "ok");
    if (build.kind !== "ok") return;
    const e = await openEngine("sqlite");
    try {
      assert((await materialize(driverOf(e), build.value)).kind === "ok");
      const r = atc(schema, [entry(), entry({ name: "born_only", columns: ["born"], platform: "linux" }), entry({ name: "genres", table: "genre", columns: ["code", "label"] })], { dialect: sqlite });
      assert(r.kind === "ok");
      if (r.kind !== "ok") return;
      for (const [name, c] of Object.entries(r.value.config.auto_table_construction)) {
        const got = await e.rows(c.query);
        assert(got.length > 0, `${name}: the query gives rows`);
        same(Object.keys(got[0] ?? {}), [...c.columns], `${name}: it gives the columns the entry says`);
      }
    } finally {
      await e.close();
    }
  },
);
