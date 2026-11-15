/**
 * osquery ATC, as the third acceptance test of IFC SQL Aide (commons 0009-sql-aide FR-056, FR-057): entries whose columns the compiler
 * checks against their tables, the configuration osquery reads and the SQL of the database behind it committed, both the same bytes
 * every time and on both runtimes, and a database built through a driver that answers the configuration's queries.
 *
 * @module
 */
import { fs, path } from "../../../runtime/mod.ts";
import { assert, assertEquals, assertThrows, proves } from "../../../runtime/test.ts";
import {
  atcConfig,
  atcJson,
  atcTable,
  catalogAtc,
  catalogData,
  catalogDocs,
  catalogTables,
  policySetting,
  POSIX_PATH,
  WINDOWS_PATH,
} from "../../osquery-atc/mod.ts";
import { apply, buildSql, context, inspect, lint, pk, plan, shadow, sqlite, sqliteDriver, table, text } from "../../sql-aide/mod.ts";
import { docsAreCurrent } from "../../sql-aide/runtime/docs.ts";
import { materialize, staleFiles } from "../../sql-aide/runtime/build.ts";
import { golden, sqliteEngine } from "../helpers.ts";

const ephemeral = context({ dialect: sqlite(), durability: "ephemeral", docs: [catalogDocs] });
const build = { module: "osquery-atc/catalog.ts", entities: catalogTables, data: catalogData } as const;

proves(
  ["0009-sql-aide FR-056", "0009-sql-aide FR-008"],
  "an ATC entry names columns of its table, never path, on a platform osquery names",
  () => {
    // the control: columns of the table, on a platform osquery documents
    const fine = atcTable("settings", policySetting, { path: "/x.db", columns: ["setting_key", "value"], platform: "linux" });
    assertEquals(fine.query, `SELECT "setting_key", "value" FROM "policy_setting"`);
    // @ts-expect-error a setting has no column owner
    const noColumn = (): unknown => atcTable("s", policySetting, { path: "/x.db", columns: ["setting_key", "owner"] });
    const withPath = table("file_seen", { file_id: pk.text(), path: text(), Path: text() });
    // @ts-expect-error osquery adds a path column of its own and refuses one named so
    const pathColumn = (): unknown => atcTable("f", withPath, { path: "/x.db", columns: ["file_id", "path"] });
    // @ts-expect-error in any case
    const pathCase = (): unknown => atcTable("f", withPath, { path: "/x.db", columns: ["Path"] });
    // @ts-expect-error macos is not a platform osquery names: darwin is
    const platform = (): unknown => atcTable("s", policySetting, { path: "/x.db", columns: ["value"], platform: "macos" });
    assertEquals(
      [noColumn, pathColumn, pathCase, platform].map((f) => typeof f),
      ["function", "function", "function", "function"],
    );
    assertThrows(() => atcTable("Bad-Name", policySetting, { path: "/x.db", columns: ["value"] }), Error, "not a name osquery gives");
    assertThrows(() => atcConfig([fine, fine]), Error, "named twice");
  },
);

proves(
  ["0009-sql-aide FR-056", "0009-sql-aide FR-057", "0009-sql-aide FR-053", "0009-sql-aide FR-015"],
  "the configuration and the database's SQL are what is committed, the same bytes every time, in the format osquery documents",
  async () => {
    const json = atcJson(catalogAtc);
    assertEquals(atcJson(catalogAtc), json);
    await golden(new URL("./golden/catalog.auto.json", import.meta.url), json);
    const sql = await buildSql(build, ephemeral);
    assertEquals(await buildSql(build, ephemeral), sql);
    await golden(new URL("./golden/catalog.auto.sql", import.meta.url), sql);
    // the text is the configuration: what osquery parses is atcConfig, keyed as osquery's documentation keys it
    const parsed: unknown = JSON.parse(json);
    assertEquals(parsed, atcConfig(catalogAtc));
    assertEquals(atcConfig(catalogAtc).auto_table_construction["managed_applications"], {
      query: `SELECT "application_id", "display_name", "publisher" FROM "allowed_application"`,
      path: WINDOWS_PATH,
      columns: ["application_id", "display_name", "publisher"],
      platform: "windows",
    });
    // a Windows path's backslashes are escaped in the JSON, as the documentation says they must be
    assert(json.includes(String.raw`"C:\\ProgramData\\osquery\\atc\\managed.auto.sqlite.db"`));
    assertEquals(atcConfig(catalogAtc).auto_table_construction["managed_settings"]?.path, POSIX_PATH);
  },
);

proves(
  ["0009-sql-aide FR-057", "0009-sql-aide FR-054", "0009-sql-aide FR-005"],
  "the database is built through a driver and answers each entry's query with its rows",
  async () => {
    const dir = await fs.makeTempDir({ prefix: "ifcsql-atc-" });
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const database = path.join(dir, "managed.auto.sqlite.db");
      const made = await materialize(await buildSql(build, ephemeral), database, (p) => {
        const db = new DatabaseSync(p);
        const d = sqliteDriver(db, ephemeral);
        return Promise.resolve({ exec: d.runner.exec, close: () => Promise.resolve(db.close()) });
      });
      assertEquals(made, { kind: "ok", value: undefined });
      const db = new DatabaseSync(database, { readOnly: true });
      try {
        for (const entry of catalogAtc) {
          const rows = db.prepare(entry.query).all();
          assert(rows.length > 0, entry.name);
          for (const r of rows) assertEquals(Object.keys(r), [...entry.columns], entry.name);
          // osquery reads every column as text; these are the source's rows, so read
          const source = catalogData.find((d) => d.spec.name === entry.table.spec.name);
          const asText = (v: unknown): string | null => (v === null ? null : typeof v === "boolean" ? (v ? "1" : "0") : String(v));
          const want = (source?.rows ?? []).map((r) => entry.columns.map((c) => asText(r[c] ?? null)).join("|")).sort();
          assertEquals(rows.map((r) => entry.columns.map((c) => asText(r[c] ?? null)).join("|")).sort(), want, entry.name);
        }
      } finally {
        db.close();
      }
    } finally {
      await fs.remove(dir, { recursive: true });
    }
    assertEquals(lint(catalogTables, ephemeral), []);
    assert(
      await docsAreCurrent(new URL("../../osquery-atc/catalog.ts", import.meta.url).pathname),
      "osquery-atc/catalog.docs.auto.ts is current",
    );
  },
);

proves(
  ["0009-sql-aide FR-055", "0009-sql-aide FR-057"],
  "a committed configuration or SQL that is not what the source makes is found",
  async () => {
    const json = new URL("./golden/catalog.auto.json", import.meta.url).pathname;
    const sql = new URL("./golden/catalog.auto.sql", import.meta.url).pathname;
    assertEquals(
      await staleFiles([
        { path: json, text: atcJson(catalogAtc) },
        { path: sql, text: await buildSql(build, ephemeral) },
      ]),
      [],
    );
    const other = atcTable("other", policySetting, { path: "/other.db", columns: ["value"] });
    assertEquals(await staleFiles([{ path: json, text: atcJson([...catalogAtc, other]) }]), [json]);
  },
);

proves(
  ["0009-sql-aide FR-035", "0009-sql-aide FR-057"],
  "the tables behind osquery's ATC, applied to a SQLite file kept as durable, plan nothing against a shadow",
  async () => {
    // the database ATC reads is ephemeral where it is shipped; kept as a durable SQLite database, ISLM holds it to the model as any other
    const durable = context({ dialect: sqlite(), docs: [catalogDocs] });
    const live = await sqliteEngine();
    const empty = await sqliteEngine();
    try {
      const sh = await shadow(catalogTables, empty, durable);
      const first = await inspect(live, durable);
      assert(first.kind === "ok");
      assert(
        (await apply(await plan({ entities: catalogTables }, first.value, durable, { shadow: sh }), live, durable, { actor: "atc" }))
          .kind === "ok",
      );
      const again = await inspect(live, durable);
      assert(again.kind === "ok");
      const p = await plan({ entities: catalogTables }, again.value, durable, { shadow: sh });
      assertEquals([p.changes, p.unplanned], [[], []]);
    } finally {
      await live.close();
      await empty.close();
    }
  },
);
