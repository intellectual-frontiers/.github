// Spec: 0046-arcactl FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-010
/**
 * `arcactl doctor` (commons data 0046-arcactl): a read-only look at a PostgreSQL database against the arca models a configuration names. Each check says pass, warn, fail or that it could not check
 * (a check that lacks a privilege never passes by default), what it found, and what to do. It writes nothing: the only statement that is not a `SELECT` sets the session's search path.
 *
 * @module
 */
import { operation, vocabularies } from "@intellectual-frontiers/data/governance";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { propose, settingsOf as convergence } from "@intellectual-frontiers/data/sql/extensions/convergence";
import { invariants, placed } from "@intellectual-frontiers/data/sql/extensions/invariants";
import { type Implementation, operations, verifyAuditChain } from "@intellectual-frontiers/data/sql/extensions/operations";
import { type Driver, readLedger, stateHash, verifyChain } from "@intellectual-frontiers/data/sql/lifecycle";
import { carriedOf, type LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import type { Arca } from "./config.ts";
import { redact } from "./redact.ts";

/** What a check found. */
export type Status = "pass" | "warn" | "fail" | "unknown";

/** The result of one check. */
export interface CheckResult {
  readonly id: string;
  readonly title: string;
  readonly status: Status;
  readonly detail: string;
  /** What to do, where there is something. */
  readonly next?: string;
}

/** The report of a run. */
export interface Report {
  readonly results: readonly CheckResult[];
  readonly summary: Readonly<Record<Status, number>>;
  /** 0 where every check passed, 1 where any warned, failed or could not be made. */
  readonly code: 0 | 1;
}

/** What a check is given. */
interface Context {
  readonly driver: Driver;
  readonly config: Arca;
  readonly schema: LogicalSchema;
  readonly secrets: readonly string[];
}

const lit = (s: string): string => postgres.literal(s);
const rows = (c: Context, sql: string) => c.driver.query(sql);
/** What the models are called in a message: their names, or, for a project that gave a module of its own, that. */
const modelsOf = (c: Context): string => (c.config.models.length === 0 ? "the project's models" : c.config.models.join(", "));
const num = (v: unknown): number => Number(v ?? 0);
const names = (xs: readonly string[], max = 8): string => (xs.length <= max ? xs.join(", ") : `${xs.slice(0, max).join(", ")} and ${xs.length - max} more`);

type Check = { readonly id: string; readonly title: string; readonly run: (c: Context) => Promise<Omit<CheckResult, "id" | "title">> };


/** The statements the project's own bind makes, to know what the database is meant to hold. */
function bound(c: Context) {
  const sources = c.config.invariants ? [invariants({ ...(c.config.guard ? {} : { guard: false }) })] : [];
  const b = bind(c.schema, { dialect: postgres, schema: c.config.schema, sources });
  return b.kind === "ok" ? b.value : undefined;
}

const expectedTriggers = (c: Context): readonly { readonly name: string; readonly table: string }[] => {
  const b = bound(c);
  if (b === undefined) return [];
  return b.statements.flatMap((s) => {
    const m = /^CREATE TRIGGER "([^"]+)"[^\n]* ON (?:"[^"]+"\.)?"([^"]+)"/.exec(s.sql);
    return m === null ? [] : [{ name: m[1] as string, table: m[2] as string }];
  });
};

const checks: readonly Check[] = [
  {
    id: "ARCA-D001",
    title: "connection and server",
    async run(c) {
      const r = (await rows(c, `SELECT version() AS v, current_user AS u, current_setting('server_version_num')::int AS n, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS su`))[0];
      const n = num(r?.["n"]);
      const su = r?.["su"] === true;
      const note = su ? "a superuser" : "not a superuser, so it cannot install the DDL guard (event triggers)";
      return n < 140000
        ? { status: "warn", detail: `${String(r?.["v"])} as ${String(r?.["u"])}, ${note}; the models are tested on PostgreSQL 14 and later`, next: "use PostgreSQL 14 or later" }
        : { status: "pass", detail: `${String(r?.["v"]).split(" on ")[0]} as ${String(r?.["u"])}, ${note}` };
    },
  },
  {
    id: "ARCA-D002",
    title: "initialised",
    async run(c) {
      const have = await rows(c, `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ${lit(c.config.schema)}`);
      if (have.length === 0)
        return { status: "fail", detail: `nothing is in the schema ${c.config.schema}: this database has not been initialised for ${modelsOf(c)}`, next: "initialise it (arcactl init), or apply the models' DDL to this schema" };
      const there = new Set(have.map((r) => String(r["t"])));
      const b = bound(c);
      const wanted = b === undefined ? [] : [...new Set(b.statements.flatMap((s) => (s.group === "table" ? [/^CREATE TABLE IF NOT EXISTS (?:"[^"]+"\.)?"([^"]+)"/.exec(s.sql)?.[1] ?? ""] : [])))].filter((x) => x !== "");
      const missing = wanted.filter((t) => !there.has(t));
      return missing.length > 0
        ? { status: "fail", detail: `${missing.length} of ${wanted.length} tables are missing: ${names(missing)}`, next: "bring the database to the model (arcactl init), after reviewing what drift (ARCA-D003) says" }
        : { status: "pass", detail: `all ${wanted.length} tables of ${modelsOf(c)} are in ${c.config.schema}` };
    },
  },
  {
    id: "ARCA-D003",
    title: "drift from the model",
    async run(c) {
      const exists = (await rows(c, `SELECT 1 AS x FROM information_schema.schemata WHERE schema_name = ${lit(c.config.schema)}`)).length > 0;
      if (!exists) return { status: "unknown", detail: "the schema is not there, so there is nothing to compare", next: "see ARCA-D002" };
      const r = await propose(c.driver, c.schema, { dialect: postgres, schema: c.config.schema }, { allow: { destructive: true }, ignore: convergence({ unmanaged: c.config.unmanaged, ledgerTable: c.config.ledgerTable }).ignore, ledgerTable: c.config.ledgerTable });
      if (r.kind === "err") return { status: "unknown", detail: `the database could not be read against the model: ${redact(JSON.stringify(r.error).slice(0, 300), c.secrets)}` };
      const steps = r.value.plan.steps.map((s) => s.name);
      const held = r.value.proposal.held ?? [];
      if (steps.length > 0)
        return { status: "fail", detail: `${steps.length} change${steps.length === 1 ? "" : "s"} would bring the database to the model: ${names(steps)}`, next: "review the plan (arcactl plan, or propose in the library) before anything is applied" };
      return held.length > 0
        ? { status: "warn", detail: `the database is as the model says; held outside it: ${names(held)}`, next: "name them in the model or remove them" }
        : { status: "pass", detail: `the database is as the model says (${stateHash(r.value.live).slice(0, 12)})` };
    },
  },
  {
    id: "ARCA-D004",
    title: "ledger",
    async run(c) {
      const there = (await rows(c, `SELECT 1 AS x FROM information_schema.tables WHERE table_schema = ${lit(c.config.schema)} AND table_name = ${lit(c.config.ledgerTable)}`)).length > 0;
      if (!there) return { status: "warn", detail: `there is no ledger (${c.config.ledgerTable}) in ${c.config.schema}: the tables were not made through the lifecycle, so what was applied is not recorded`, next: "initialise through arcactl so that each change is recorded" };
      await c.driver.exec(`SET search_path TO ${postgres.quote(c.config.schema)}, public`);
      const entries = await readLedger(c.driver, postgres, c.config.ledgerTable);
      const broken = verifyChain(entries);
      return broken === undefined
        ? { status: "pass", detail: `${entries.length} entr${entries.length === 1 ? "y" : "ies"}, in order, each chained to the one before` }
        : { status: "fail", detail: `the ledger is broken at entry ${broken.seq} (${broken.why === "seq" ? "out of order or missing" : "its hash does not follow from the one before"})`, next: "an entry was changed or removed: restore the ledger from a backup" };
    },
  },
  {
    id: "ARCA-D005",
    title: "invariants in the database",
    async run(c) {
      if (!c.config.invariants) return { status: "pass", detail: "not expected (invariants: false); the operations runtime enforces them" };
      const want = expectedTriggers(c);
      if (want.length === 0) return { status: "pass", detail: "these models declare no invariants" };
      const have = await rows(c, `SELECT t.tgname AS n, r.relname AS t, t.tgenabled AS e FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid JOIN pg_namespace s ON s.oid = r.relnamespace WHERE s.nspname = ${lit(c.config.schema)} AND NOT t.tgisinternal`);
      const by = new Map(have.map((r) => [`${String(r["t"])}/${String(r["n"])}`, String(r["e"])]));
      const missing = want.filter((w) => !by.has(`${w.table}/${w.name}`)).map((w) => `${w.name} on ${w.table}`);
      const off = want.filter((w) => by.has(`${w.table}/${w.name}`) && by.get(`${w.table}/${w.name}`) !== "O").map((w) => `${w.name} on ${w.table}`);
      if (missing.length + off.length === 0) return { status: "pass", detail: `all ${want.length} triggers of the invariants are there and enabled` };
      return {
        status: "fail",
        detail: `${missing.length > 0 ? `missing: ${names(missing)}. ` : ""}${off.length > 0 ? `disabled: ${names(off)}.` : ""} The database no longer refuses what governance says must never happen.`,
        next: off.length > 0 && missing.length === 0 ? "ALTER TABLE … ENABLE TRIGGER … for each, then find out who disabled it" : "apply the invariants again (arcactl init); find out who dropped them",
      };
    },
  },
  {
    id: "ARCA-D006",
    title: "guard against weakening the invariants",
    async run(c) {
      if (!c.config.invariants || expectedTriggers(c).length === 0) return { status: "pass", detail: "there are no invariants to guard" };
      if (!c.config.guard) return { status: "pass", detail: "not expected (guard: false): the owner of a table can drop the triggers of its invariants" };
      const have = await rows(c, `SELECT evtname AS n, evtenabled AS e FROM pg_event_trigger WHERE evtname LIKE 'inv\\_guard\\_%'`);
      const by = new Map(have.map((r) => [String(r["n"]), String(r["e"])]));
      const want = ["inv_guard_drop", "inv_guard_end", "inv_guard_start"];
      const missing = want.filter((n) => !by.has(n));
      const off = want.filter((n) => by.has(n) && by.get(n) !== "O");
      return missing.length + off.length === 0
        ? { status: "pass", detail: "the event triggers that refuse to drop, disable, rename or replace an invariant are there and enabled" }
        : { status: "fail", detail: `${missing.length > 0 ? `missing: ${missing.join(", ")}. ` : ""}${off.length > 0 ? `disabled: ${off.join(", ")}.` : ""} The owner of a table can weaken its invariants.`, next: "install the guard as a superuser (arcactl init), or say guard: false if it is not wanted" };
    },
  },
  {
    id: "ARCA-D007",
    title: "row security and the seal",
    async run(c) {
      const scoped = c.schema.tables.filter((t) => t.columns.some((col) => carriedOf(col, vocabularies.security.scope).length > 0));
      const sealed = (await rows(c, `SELECT 1 AS x FROM pg_namespace WHERE nspname = 'ifc_seal'`)).length > 0;
      if (scoped.length === 0 && !sealed && !c.config.seal) return { status: "pass", detail: "these models have no scoped tables: row security is not in play" };
      const problems: string[] = [];
      for (const t of scoped) {
        const name = t.name.join("_");
        const r = (await rows(c, `SELECT c.relrowsecurity AS on_, c.relforcerowsecurity AS forced FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = ${lit(c.config.schema)} AND c.relname = ${lit(name)}`))[0];
        if (r === undefined) continue;
        if (r["on_"] !== true) problems.push(`row security is off on ${name}`);
        else if (r["forced"] !== true && sealed) problems.push(`row security is not forced on ${name}: its owner sees every row`);
      }
      if (c.config.seal && !sealed) problems.push("the scope is meant to be sealed and there is no seal (schema ifc_seal)");
      if (sealed) {
        const open = await rows(c, `SELECT 'table ' || c.relname AS x FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'ifc_seal' AND c.relkind = 'r' AND c.relacl IS NOT NULL AND EXISTS (SELECT 1 FROM aclexplode(c.relacl) a WHERE a.grantee = 0) UNION ALL SELECT 'function ' || p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'ifc_seal' AND p.proname = 'mac' AND (p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0))`);
        for (const r of open) problems.push(`every role can use the seal's ${String(r["x"])}: a session could read the key or make a mark`);
        const guards = await rows(c, `SELECT evtname AS n FROM pg_event_trigger WHERE evtname LIKE 'ifc\\_seal\\_guard\\_%' AND evtenabled = 'O'`);
        if (guards.length < 2) problems.push("the guard of the seal (event triggers) is missing or disabled");
      } else if (scoped.length > 0) {
        problems.push(`the scope of ${names(scoped.map((t) => t.name.join("_")))} is not sealed: a session can set it to another tenant's itself`);
      }
      if (problems.length === 0) return { status: "pass", detail: `${scoped.length} scoped table${scoped.length === 1 ? "" : "s"}: row security on, the seal in place, its key and its mark function closed to application roles` };
      const hard = problems.some((p) => !p.includes("is not sealed") || c.config.seal);
      return { status: hard ? "fail" : "warn", detail: problems.join("; "), next: sealed ? "apply the access source again with its seal (accessSource({ seal }))" : "seal the scope: accessSource({ seal: { key } }) and set seal: true" };
    },
  },
  {
    id: "ARCA-D008",
    title: "audit chain",
    async run(c) {
      const there = (await rows(c, `SELECT 1 AS x FROM information_schema.tables WHERE table_schema = ${lit(c.config.schema)} AND table_name = 'audit_event'`)).length > 0;
      if (!there) return { status: "pass", detail: "these models have no audit trail" };
      const check = operation("doctorAuditChain", { definition: "Verifies the audit chain", kind: "query", input: {}, reads: ["auditEvent"], public: true, runsAs: "service", idempotent: true });
      const impl: Implementation = async (tx) => {
        const r = await verifyAuditChain(tx);
        return { status: "checked", length: r.length, problems: r.problems.map((p) => `${p.kind} at ${p.at}`) };
      };
      const rt = operations(c.schema, postgres, c.driver, [check], { doctorAuditChain: impl }, { schema: c.config.schema });
      if (rt.kind === "err") return { status: "unknown", detail: `the chain could not be read: ${JSON.stringify(rt.error).slice(0, 200)}` };
      const out = await rt.value.run("doctorAuditChain", {});
      if (out.kind === "err") return { status: "unknown", detail: `the chain could not be read: ${redact(JSON.stringify(out.error).slice(0, 200), c.secrets)}` };
      const problems = out.value["problems"] as readonly string[];
      return problems.length === 0
        ? { status: "pass", detail: `${String(out.value["length"])} events, in sequence, each naming the hash of the one before and holding the hash of its own fields` }
        : { status: "fail", detail: `the audit trail was changed: ${names(problems)}`, next: "treat it as an incident: compare with a backup and find who had write access" };
    },
  },
  {
    id: "ARCA-D009",
    title: "what the database enforces",
    async run(c) {
      const all = placed(c.schema.tables, postgres);
      if (all.length === 0) return { status: "pass", detail: "these models declare no invariants" };
      const db = all.filter((p) => p.by === "database").length;
      return { status: "pass", detail: `PostgreSQL can enforce all of the ${all.length} invariants of these models in the database (${db} by triggers); the application's runtime enforces ${all.length - db}` };
    },
  },
];

/** The checks, by id. */
export const checkIds: readonly string[] = checks.map((c) => c.id);

/**
 * Runs the checks.
 *
 * @param driver - the database
 * @param config - the configuration, with defaults
 * @param schema - the logical schema of the models
 * @param options - the secrets to keep out of what is said, and the checks to run (all by default)
 * @returns the report
 */
export async function doctor(driver: Driver, config: Arca, schema: LogicalSchema, options: { readonly secrets?: readonly string[]; readonly only?: readonly string[] } = {}): Promise<Report> {
  const context: Context = { driver, config, schema, secrets: options.secrets ?? [] };
  const results: CheckResult[] = [];
  for (const check of checks) {
    if (options.only !== undefined && !options.only.includes(check.id)) continue;
    try {
      results.push({ id: check.id, title: check.title, ...(await check.run(context)) });
    } catch (thrown) {
      const why = redact(thrown instanceof Error ? thrown.message : String(thrown), context.secrets);
      results.push({ id: check.id, title: check.title, status: "unknown", detail: `could not check: ${why}`, next: /permission denied|must be (owner|superuser)/i.test(why) ? "run it as a role that may read the catalogs" : undefined } as CheckResult);
    }
  }
  const summary: Record<Status, number> = { pass: 0, warn: 0, fail: 0, unknown: 0 };
  for (const r of results) summary[r.status]++;
  return { results, summary, code: summary.warn + summary.fail + summary.unknown === 0 ? 0 : 1 };
}

const MARK: Readonly<Record<Status, string>> = { pass: "PASS", warn: "WARN", fail: "FAIL", unknown: "?   " };

/** The report as text. */
export function renderReport(r: Report): string {
  const lines = r.results.flatMap((x) => [`${MARK[x.status]}  ${x.id}  ${x.title}`, `      ${x.detail}`, ...(x.next === undefined ? [] : [`      next: ${x.next}`])]);
  const s = r.summary;
  return [...lines, "", `${s.pass} passed, ${s.warn} warned, ${s.fail} failed, ${s.unknown} could not be checked`].join("\n");
}
