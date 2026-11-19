// Spec: 0046-arcactl FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010
/**
 * `arcactl doctor` (commons data 0046-arcactl), run on PGlite, the PostgreSQL that runs in process: the configuration and the models, the exit codes, and each check against a database that is as it
 * should be and one with a fault planted in it. Not shown here: the connection to a server over the network (the Bun and `pg` clients are reached only to see that a failure to connect is said
 * and keeps the password out of what is printed).
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { invariants } from "@intellectual-frontiers/data/sql/extensions/invariants";
import { GENESIS } from "@intellectual-frontiers/data/sql/extensions/operations";
import { type LedgerEntry, nextEntry } from "@intellectual-frontiers/data/sql/lifecycle";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { checkIds, connect, defineArca, doctor, type Io, main, modelNames, passwordOf, redact, schemaOf, settingsOf, USAGE } from "@intellectual-frontiers/data/sql/cli";
import { load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf } from "./lifecycle-fixture.ts";

const config = (() => {
  const c = settingsOf({ models: ["identityAgent"] });
  if (c.kind === "err") throw new Error(JSON.stringify(c.error));
  return c.value;
})();
const schema = (() => {
  const s = schemaOf(config);
  if (s.kind === "err") throw new Error(JSON.stringify(s.error));
  return s.value.schema;
})();

/** A database as `arcactl` expects it: the tables, the invariants and their guard. */
const world = async (sources = [invariants()]): Promise<Engine> => {
  const e = await openEngine("postgres");
  const b = bind(schema, { dialect: postgres, schema: "arca", sources });
  assert(b.kind === "ok", JSON.stringify(b));
  if (b.kind === "ok") await load(e, b.value);
  return e;
};
const io = (e: Engine, log: string[] = []): Io => ({
  env: {},
  cwd: "/nowhere",
  connect: async () => ({ kind: "custom", driver: { exec: (q) => (log.push(q), driverOf(e).exec(q)), query: (q) => (log.push(q), driverOf(e).query(q)) }, close: async () => undefined }),
});
const run = async (e: Engine, ...args: string[]) => main(["doctor", "--models", "identityAgent", "--json", ...args], io(e));
type Parsed = { code: number; results: { id: string; status: string; detail: string; next?: string }[]; summary: Record<string, number> };
const report = async (e: Engine, ...args: string[]): Promise<Parsed> => {
  const r = await run(e, ...args);
  return { ...(JSON.parse(r.out) as Parsed), code: r.code };
};
const status = (p: Parsed, id: string): string => p.results.find((x) => x.id === id)?.status ?? "missing";
const ids = Object.fromEntries(checkIds.map((id, i) => [`D00${i + 1}`, id])) as Record<string, string>;

proves(
  ["0046-arcactl FR-002"],
  "the configuration is typed data with defaults, names the models of the arca family (and the issues model), brings what they require with them, and refuses a model, a schema or a list that is not one",
  () => {
    same(settingsOf({ models: ["identityAgent"] }).kind, "ok");
    same(config, { schema: "arca", models: ["identityAgent"], invariants: true, guard: true, seal: false, unmanaged: "drop", ledgerTable: "lifecycle_ledger" });
    assert(Object.isFrozen(defineArca({ models: ["arcaParty"] })));
    assert(modelNames.includes("arcaParty") && modelNames.includes("identityAgent") && modelNames.includes("issues"));
    const tables = schema.tables.map((t) => t.name.join("_"));
    assert(["party_kind", "tenant", "principal", "agent", "delegation"].every((t) => tables.includes(t)), "identityAgent brings the party, tenancy, identity, access and delegation models with it");
    const bad = (m: string[], schemaName?: string) => {
      const r = settingsOf({ models: m as never, ...(schemaName === undefined ? {} : { schema: schemaName }) });
      return r.kind === "err" ? r.error.map((x) => x.kind) : "ok";
    };
    same(bad(["nope"]), ["model"]);
    same(bad([]), ["model"]);
    same(bad(["identity"], "Bad Name"), ["schema"]);
    same(settingsOf({ models: ["issues"] }).kind, "ok");
  },
);

proves(
  ["0046-arcactl FR-003"],
  "doctor is read-only, gives a result for each check with an exit code of 0 where all pass and 1 where any does not, in text or JSON, and a command that is wrong or a database that cannot be reached is 2",
  async () => {
    const e = await world();
    try {
      const log: string[] = [];
      const r = await main(["doctor", "--models", "identityAgent", "--json"], io(e, log));
      const p = JSON.parse(r.out) as Parsed;
      same(p.results.map((x) => x.id), checkIds);
      same([status(p, ids["D001"] as string), status(p, ids["D002"] as string), status(p, ids["D003"] as string), status(p, ids["D005"] as string), status(p, ids["D006"] as string), status(p, ids["D008"] as string)], ["pass", "pass", "pass", "pass", "pass", "pass"]);
      same(status(p, ids["D004"] as string), "warn", "made by DDL, so there is no ledger");
      same(r.code, 1, "a warning is not a pass");
      assert(log.length > 5 && log.every((q) => /^\s*(SELECT|WITH|SET search_path|BEGIN|ROLLBACK)/i.test(q)), `only reads: ${log.filter((q) => !/^\s*SELECT/i.test(q)).join(" | ").slice(0, 300)}`);
      const text = await main(["doctor", "--models", "identityAgent"], io(e));
      assert(text.out.includes("PASS  ARCA-D001") && text.out.includes("WARN  ARCA-D004") && text.out.includes("next:") && /\d+ passed, 1 warned, 0 failed/.test(text.out));
      same((await main(["doctor", "--models", "identityAgent", "--check", "ARCA-D001,ARCA-D005"], io(e))).code, 0, "a run of the checks that pass is 0");
      for (const args of [["frobnicate"], ["doctor", "--models", "nope"], ["doctor", "--models", "identity", "--check", "ARCA-D999"], ["doctor"], []]) {
        const bad = await main(args, io(e));
        assert(bad.code === 2 && bad.err !== "" && bad.out === "", `${args.join(" ")}: ${bad.code}`);
      }
      same((await main(["--help"], io(e))).out, USAGE);
    } finally {
      await e.close();
    }
  },
);

proves(
  ["0046-arcactl FR-004", "0046-arcactl FR-005"],
  "doctor says a database is not initialised, finds a missing table, a stray table and column as drift (or as held where the project holds them), and reads the ledger's chain",
  async () => {
    const empty = await openEngine("postgres");
    try {
      const p = await report(empty);
      same([status(p, ids["D002"] as string), status(p, ids["D003"] as string), p.code], ["fail", "unknown", 1]);
      assert(p.results.find((x) => x.id === ids["D002"])?.detail.includes("has not been initialised"));
    } finally {
      await empty.close();
    }
    const e = await world();
    try {
      await e.run(`DROP TABLE "arca"."party_kind" CASCADE`);
      const missing = await report(e);
      same(status(missing, ids["D002"] as string), "fail");
      assert(missing.results.find((x) => x.id === ids["D002"])?.detail.includes("party_kind"));
      assert(status(missing, ids["D003"] as string) === "fail" && missing.results.find((x) => x.id === ids["D003"])?.detail.includes("create table"), "and it is a change to make");
    } finally {
      await e.close();
    }
    const f = await world();
    try {
      await f.run(`CREATE TABLE "arca"."scratch" ("id" TEXT NOT NULL PRIMARY KEY)`);
      await f.run(`ALTER TABLE "arca"."tenant" ADD COLUMN "nickname" TEXT`);
      const drift = await report(f);
      same(status(drift, ids["D003"] as string), "fail");
      const d = drift.results.find((x) => x.id === ids["D003"])?.detail ?? "";
      assert(d.includes("scratch") && d.includes("nickname"), d);
      const held = await doctor(driverOf(f), settingsOfHold(), schema);
      same(held.results.find((x) => x.id === ids["D003"])?.status, "warn");
      assert(held.results.find((x) => x.id === ids["D003"])?.detail.includes("table scratch"));
      // a ledger: whole, then changed
      await f.run(`CREATE TABLE "arca"."lifecycle_ledger" ("seq" INTEGER PRIMARY KEY, "kind" TEXT, "key" TEXT, "name" TEXT, "from_state" TEXT, "to_state" TEXT, "hash" TEXT, "chain" TEXT, "applied_at" TEXT, "applied_by" TEXT)`);
      const entries: LedgerEntry[] = [];
      for (const n of ["one", "two", "three"]) entries.push(nextEntry(entries, { kind: "step", key: `k${n}`, name: n, from: "a", to: "b", hash: `h${n}`, appliedAt: "2026-01-01", appliedBy: "x" }));
      for (const en of entries)
        await f.run(`INSERT INTO "arca"."lifecycle_ledger" VALUES (${en.seq}, '${en.kind}', '${en.key}', '${en.name}', '${en.from}', '${en.to}', '${en.hash}', '${en.chain}', '${en.appliedAt}', '${en.appliedBy}')`);
      same(status(await report(f), ids["D004"] as string), "pass");
      await f.run(`UPDATE "arca"."lifecycle_ledger" SET "name" = 'changed' WHERE "seq" = 2`);
      const changed = (await report(f)).results.find((x) => x.id === ids["D004"]);
      assert(changed?.status === "fail" && changed.detail.includes("entry 2"), JSON.stringify(changed));
      await f.run(`UPDATE "arca"."lifecycle_ledger" SET "name" = 'two' WHERE "seq" = 2`);
      await f.run(`DELETE FROM "arca"."lifecycle_ledger" WHERE "seq" = 2`);
      assert((await report(f)).results.find((x) => x.id === ids["D004"])?.detail.includes("entry 3"), "an entry taken out is found");
    } finally {
      await f.close();
    }
  },
);
const settingsOfHold = () => {
  const c = settingsOf({ models: ["identityAgent"], unmanaged: "hold" });
  if (c.kind === "err") throw new Error("config");
  return c.value;
};

proves(
  ["0046-arcactl FR-006"],
  "doctor finds the invariants weakened: a trigger dropped or disabled, and the guard's event triggers missing or disabled, and does not ask for what the project says it does not want",
  async () => {
    const e = await world();
    try {
      same([status(await report(e), ids["D005"] as string), status(await report(e), ids["D006"] as string)], ["pass", "pass"]);
      // the guard refuses a table's owner, so a superuser has to step it aside first
      await e.run(`ALTER EVENT TRIGGER inv_guard_end DISABLE`);
      const off = (await report(e)).results.find((x) => x.id === ids["D006"]);
      assert(off?.status === "fail" && off.detail.includes("disabled: inv_guard_end") && off.next !== undefined, JSON.stringify(off));
      await e.run(`DROP EVENT TRIGGER inv_guard_drop`);
      assert((await report(e)).results.find((x) => x.id === ids["D006"])?.detail.includes("missing: inv_guard_drop"));
      await e.run(`ALTER TABLE "arca"."audit_event" DISABLE TRIGGER "inv_audit_event_append_only"`);
      const disabled = (await report(e)).results.find((x) => x.id === ids["D005"]);
      assert(disabled?.status === "fail" && disabled.detail.includes("disabled: inv_audit_event_append_only on audit_event"), JSON.stringify(disabled));
      await e.run(`DROP TRIGGER "inv_audit_event_append_only" ON "arca"."audit_event"`);
      assert((await report(e)).results.find((x) => x.id === ids["D005"])?.detail.includes("missing: inv_audit_event_append_only on audit_event"));
      const p = await report(e);
      same(p.code, 1);
      const quiet = settingsOf({ models: ["identityAgent"], guard: false });
      assert(quiet.kind === "ok" && (await doctor(driverOf(e), quiet.value, schema)).results.find((x) => x.id === ids["D006"])?.status === "pass", "guard: false is not asked for");
      const none = settingsOf({ models: ["identityAgent"], invariants: false });
      assert(none.kind === "ok" && (await doctor(driverOf(e), none.value, schema)).results.find((x) => x.id === ids["D005"])?.detail.includes("not expected"));
    } finally {
      await e.close();
    }
  },
);

proves(
  ["0046-arcactl FR-007"],
  "doctor finds a seal that an application role could use (the key's table or the mark function open to PUBLIC, the seal's guard missing) and a seal that is wanted and not there",
  async () => {
    const e = await world();
    try {
      same(status(await report(e), ids["D007"] as string), "pass", "no scoped tables, nothing sealed");
      const wanted = settingsOf({ models: ["identityAgent"], seal: true });
      assert(wanted.kind === "ok");
      const w = wanted.kind === "ok" ? (await doctor(driverOf(e), wanted.value, schema)).results.find((x) => x.id === ids["D007"]) : undefined;
      assert(w?.status === "fail" && w.detail.includes("there is no seal"), JSON.stringify(w));
      await e.run(`CREATE SCHEMA ifc_seal; CREATE TABLE ifc_seal.key (id boolean PRIMARY KEY, secret text); CREATE FUNCTION ifc_seal.mac(msg text) RETURNS text LANGUAGE sql AS $$ SELECT 'x' $$`);
      const open = (await report(e)).results.find((x) => x.id === ids["D007"]);
      assert(open?.status === "fail" && open.detail.includes("function mac") && open.detail.includes("guard of the seal"), JSON.stringify(open));
      await e.run(`GRANT SELECT ON ifc_seal.key TO PUBLIC`);
      assert((await report(e)).results.find((x) => x.id === ids["D007"])?.detail.includes("table key"), "the key's table too");
      await e.run(`REVOKE ALL ON ifc_seal.key FROM PUBLIC; REVOKE ALL ON FUNCTION ifc_seal.mac(text) FROM PUBLIC`);
      const closed = (await report(e)).results.find((x) => x.id === ids["D007"]);
      assert(closed?.status === "fail" && !closed.detail.includes("every role") && closed.detail.includes("guard of the seal"), "closed, but nothing guards it");
    } finally {
      await e.close();
    }
  },
);

proves(
  ["0046-arcactl FR-008"],
  "doctor verifies the audit chain by recomputing it and finds an event whose hash is not its own, and says there is no trail where the models have none",
  async () => {
    const e = await world();
    try {
      same(status(await report(e), ids["D008"] as string), "pass");
      await e.run(
        `INSERT INTO "arca"."audit_event" ("audit_event_id", "sequence", "occurred_at", "actor_kind", "action", "outcome", "previous_hash", "event_hash") VALUES ('e1', 1, '2026-01-01T00:00:00Z', 'system', 'x.y', 'success', '${GENESIS}', 'not-the-hash-of-its-fields')`,
      );
      const r = (await report(e)).results.find((x) => x.id === ids["D008"]);
      assert(r?.status === "fail" && r.detail.includes("hash-mismatch at e1") && r.next !== undefined, JSON.stringify(r));
    } finally {
      await e.close();
    }
    const party = settingsOf({ models: ["arcaParty"] });
    assert(party.kind === "ok");
    const s = party.kind === "ok" ? schemaOf(party.value) : undefined;
    assert(s?.kind === "ok");
    const e2 = await openEngine("postgres");
    try {
      const b = s?.kind === "ok" ? bind(s.value.schema, { dialect: postgres, schema: "arca" }) : undefined;
      assert(b?.kind === "ok");
      if (b?.kind === "ok") await load(e2, b.value);
      const p = party.kind === "ok" && s?.kind === "ok" ? await doctor(driverOf(e2), party.value, s.value.schema) : undefined;
      same(p?.results.find((x) => x.id === ids["D008"])?.detail, "these models have no audit trail");
      same(p?.results.find((x) => x.id === ids["D005"])?.detail, "these models declare no invariants");
      same(p?.results.find((x) => x.id === ids["D006"])?.status, "pass");
    } finally {
      await e2.close();
    }
  },
);

proves(
  ["0046-arcactl FR-009", "0046-arcactl FR-001"],
  "a password is never printed: it is taken out of any URL or setting in what is said, including the error of a driver, and a failure to connect (to a port nothing listens on) is said with exit code 2",
  async () => {
    same(redact("connect postgres://app:s3cretpw@db.example:5432/arca failed"), "connect postgres://app:***@db.example:5432/arca failed");
    same(redact("password=hunter22 host=x"), "password=*** host=x");
    same(redact("the value tops3cret was refused", ["tops3cret"]), "the value *** was refused");
    same(passwordOf("postgres://u:p%40ss@h/db"), "p@ss");
    same(passwordOf("postgres://u@h/db"), undefined);
    const url = "postgres://app:s3cretpw@127.0.0.1:1/arca";
    const r = await main(["doctor", "--models", "identity", "--url", url], { env: {}, cwd: "/nowhere" });
    assert(r.code === 2 && r.err.includes("could not connect") && !r.err.includes("s3cretpw") && !r.out.includes("s3cretpw"), r.err);
    const viaEnv = await main(["doctor", "--models", "identity"], { env: { ARCA_DATABASE_URL: url }, cwd: "/nowhere" });
    assert(viaEnv.code === 2 && !viaEnv.err.includes("s3cretpw"));
    let threw = "";
    try {
      await connect({ url, connectTimeout: 2 });
    } catch (thrown) {
      threw = String(thrown);
    }
    assert(threw !== "", "the real client does not connect to nothing");
    // a driver whose error quotes the URL: the check says it could not be made, without the password
    const e = await world();
    try {
      const leaky: Io = {
        env: { ARCA_DATABASE_URL: "postgres://app:leakedpw@h/db" },
        cwd: "/nowhere",
        connect: async () => ({ kind: "custom", close: async () => undefined, driver: { exec: driverOf(e).exec, query: async (q) => { if (q.includes("pg_event_trigger WHERE evtname LIKE 'inv")) throw new Error("permission denied at postgres://app:leakedpw@h/db"); return driverOf(e).query(q); } } }),
      };
      const out = await main(["doctor", "--models", "identityAgent"], leaky);
      assert(!out.out.includes("leakedpw") && /\?\s+ARCA-D006/.test(out.out) && out.out.includes("could not check") && out.code === 1, out.out);
      assert(out.out.includes("run it as a role that may read the catalogs"));
    } finally {
      await e.close();
    }
  },
);

proves(
  ["0046-arcactl FR-010"],
  "doctor says what PostgreSQL enforces in the database for the models' invariants, and what the application's runtime enforces",
  async () => {
    const e = await world();
    try {
      const d = (await report(e)).results.find((x) => x.id === ids["D009"]);
      assert(d?.status === "pass" && /can enforce all of the \d+ invariants of these models in the database \(\d+ by triggers\); the application's runtime enforces 0/.test(d.detail), JSON.stringify(d));
    } finally {
      await e.close();
    }
  },
);
