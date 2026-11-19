// Spec: 0046-arcactl FR-001
/**
 * The two clients of `arcactl` on a real socket (commons data 0046-arcactl FR-001): Bun's own (`Bun.SQL`) and `pg` each connect to PGlite served on a TCP port and give the same report as the in-process
 * PGlite, find a fault planted in the database, send a password to a server that asks for one, and say a failure to connect with the password kept out.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { invariants } from "@intellectual-frontiers/data/sql/extensions/invariants";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { connect, main, schemaOf, settingsOf } from "@intellectual-frontiers/data/sql/cli";
import { freePort, onBun, passwordServer, pgliteServer } from "./net-fixtures.ts";
import { same } from "./governance-fixture.ts";

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const schema = must(schemaOf(must(settingsOf({ models: ["identityAgent"] })))).schema;
const statements = must(bind(schema, { dialect: postgres, schema: "arca", sources: [invariants()] })).statements.map((s) => s.sql);
// Bun's own client is there only on Bun; the suite also runs on Node, where `pg` is the one client
const DRIVERS = onBun() ? (["bun", "pg"] as const) : (["pg"] as const);
type Parsed = { code: number; results: { id: string; status: string; detail: string }[]; summary: Record<string, number> };

const doctor = async (port: number, driver: (typeof DRIVERS)[number], ...more: string[]): Promise<Parsed & { err: string }> => {
  const r = await main(["doctor", "--models", "identityAgent", "--driver", driver, "--url", `postgres://postgres@127.0.0.1:${port}/postgres?sslmode=disable`, "--json", ...more], { env: {}, cwd: "/nowhere" });
  return { ...(r.out === "" ? { results: [], summary: {} } : (JSON.parse(r.out) as Parsed)), code: r.code, err: r.err };
};

proves(
  ["0046-arcactl FR-001"],
  "both clients, Bun's own and pg, connect over a socket and give the report the in-process database gives, and find what is planted in the database through the same connection",
  async () => {
    const server = await pgliteServer(statements);
    try {
      const results: Record<string, Parsed & { err: string }> = {};
      for (const d of DRIVERS) {
        results[d] = await doctor(server.port, d);
        same(results[d]?.err, "", `${d}`);
        same(results[d]?.summary, { pass: 8, warn: 1, fail: 0, unknown: 0 }, `${d}: as the in-process database is (no ledger is the one warning)`);
        same(results[d]?.results.find((x) => x.status === "warn")?.id, "ARCA-D004");
      }
      if (onBun()) same(results["bun"]?.results.map((r) => [r.id, r.status, r.detail]), results["pg"]?.results.map((r) => [r.id, r.status, r.detail]), "the two clients say the same");
      // a fault planted by another connection is found by each
      await server.db.exec(`ALTER EVENT TRIGGER inv_guard_end DISABLE`);
      await server.db.exec(`ALTER TABLE "arca"."audit_event" DISABLE TRIGGER "inv_audit_event_append_only"`);
      for (const d of DRIVERS) {
        const p = await doctor(server.port, d);
        const status = (id: string): string | undefined => p.results.find((x) => x.id === id)?.status;
        same([status("ARCA-D005"), status("ARCA-D006"), p.code], ["fail", "fail", 1], d);
        assert(p.results.find((x) => x.id === "ARCA-D005")?.detail.includes("disabled: inv_audit_event_append_only on audit_event"), d);
      }
      // the clients' own names
      for (const d of DRIVERS) {
        const c = await connect({ url: `postgres://postgres@127.0.0.1:${server.port}/postgres?sslmode=disable`, driver: d });
        same(c.kind, d);
        same((await c.driver.query("SELECT 41 + 1 AS n"))[0]?.["n"], 42);
        await c.close();
      }
    } finally {
      await server.close();
    }
  },
);

proves(
  ["0046-arcactl FR-001", "0046-arcactl FR-009"],
  "each client sends the password of the URL to a server that asks for one and no other, and a connection that fails is said with exit code 2 and without the password",
  async () => {
    const asks = await passwordServer();
    try {
      for (const d of DRIVERS) {
        asks.seen.length = 0;
        let conn: Awaited<ReturnType<typeof connect>> | undefined;
        try {
          conn = await connect({ url: `postgres://app:the-url-pw@127.0.0.1:${asks.port}/db?sslmode=disable`, driver: d, connectTimeout: 5 });
        } catch {
          // a server that only asks for a password may end the session after it: the password was still sent
        }
        await conn?.close().catch(() => undefined);
        same(asks.seen.at(-1)?.password, "the-url-pw", `${d}: ${JSON.stringify(asks.seen)}`);
        same([asks.seen.at(-1)?.user, asks.seen.at(-1)?.database], ["app", "db"], d);
      }
    } finally {
      await asks.close();
    }
    const dead = await freePort();
    for (const d of DRIVERS) {
      const r = await main(["doctor", "--models", "identityAgent", "--driver", d, "--url", `postgres://app:never-shown@127.0.0.1:${dead}/db?sslmode=disable`], { env: {}, cwd: "/nowhere" });
      assert(r.code === 2 && r.err.includes("could not connect") && !r.err.includes("never-shown") && r.out === "", `${d}: ${r.code} ${r.err}`);
    }
    const bad = await main(["doctor", "--models", "identityAgent", "--driver", "odbc", "--url", "postgres://x@h/d"], { env: {}, cwd: "/nowhere" });
    assert(bad.code === 2 && bad.err.includes("bun or pg"));
    const fromEnv = await main(["doctor", "--models", "identityAgent", "--url", `postgres://app:never-shown@127.0.0.1:${dead}/db`], { env: { ARCA_DRIVER: "pg" }, cwd: "/nowhere" });
    assert(fromEnv.code === 2 && !fromEnv.err.includes("never-shown"));
  },
);
