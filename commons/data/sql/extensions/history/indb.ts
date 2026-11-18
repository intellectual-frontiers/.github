// Spec: 0018-sql-history FR-009
/**
 * The runner inside the database (commons data 0018-sql-history FR-009): an installer that makes a schema, a ledger (each entry chained to the one before it by hash) and a procedure `migrate` that
 * takes a lock, checks the chain, finds where the database is, refuses one that is not where the next step starts, runs each step not yet applied with its guards and its verification, writes its
 * entry and applies what extensions add. Run again it does nothing; a ledger entry that was changed makes it refuse.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Repeatable, StepStatement } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import type { Artifact } from "./deps.ts";
import type { FrozenStep } from "./format.ts";
import type { History } from "./settings.ts";

/** What is wrong with an installer. */
export type InstallerError = { readonly kind: "unsupported"; readonly why: string };

const TAG = "$ifc_run$";
const GENESIS = "0".repeat(64);

/**
 * The installer of the runner.
 *
 * @param history - the steps and the objects that are applied again
 * @param dialect - the dialect
 * @param settings - the settings
 * @param options - the hash of the state of an empty database and what is run at the start of each step
 * @returns the installer, or why the dialect cannot hold one
 */
export function installer(
  history: { readonly from: string; readonly steps: readonly FrozenStep[]; readonly repeatable: readonly Repeatable[] },
  dialect: Dialect,
  settings: History,
  options: { readonly before?: readonly string[] } = {},
): Result<readonly Artifact[], readonly InstallerError[]> {
  if (!dialect.features.includes("routines"))
    return err([{ kind: "unsupported", why: `${dialect.name} has no procedures to hold a runner` }]);
  const q = dialect.quote;
  const L = dialect.literal;
  const schema = q(settings.runnerSchema);
  const table = `${schema}.${q("migration")}`;
  const hashOf = (prev: string, id: string, from: string, to: string): string =>
    `encode(sha256(convert_to(${prev} || '|' || ${id} || '|' || ${from} || '|' || ${to}, 'UTF8')), 'hex')`;
  const run = (s: StepStatement): string[] =>
    s.sql.includes(TAG)
      ? [`RAISE EXCEPTION 'a statement holds ${TAG}';`]
      : s.guard === undefined
        ? [`EXECUTE ${L(s.sql)};`]
        : [`IF ${s.guard.skipWhen === "rows" ? "NOT " : ""}EXISTS (${s.guard.query}) THEN`, `    EXECUTE ${L(s.sql)};`, "END IF;"];
  const before = (options.before ?? []).map((b) => `EXECUTE ${L(b)};`);
  const record = (id: string, name: string, from: string, to: string): string[] => [
    `seqn := seqn + 1;`,
    `prev := ${hashOf("prev", L(id), L(from), L(to))};`,
    `INSERT INTO ${table} (seq, step_id, name, from_state, to_state, chain) VALUES (seqn, ${L(id)}, ${L(name)}, ${L(from)}, ${L(to)}, prev) ON CONFLICT (step_id) DO NOTHING;`,
  ];
  const repeatable = (r: Repeatable, headExpr: string): string[] => {
    const id = `repeatable:${r.key}:${r.hash}`;
    return [
      `IF NOT EXISTS (SELECT 1 FROM ${table} WHERE step_id = ${L(id)}) OR touched && ARRAY[${r.of.map((x) => L(x)).join(", ")}]::text[] THEN`,
      ...r.statements.flatMap(run).map((x) => `    ${x}`),
      ...record(id, r.key, "head", "head").map((x) => `    ${x.replaceAll("'head'", headExpr)}`),
      "END IF;",
    ];
  };
  const setup = history.repeatable.filter((r) => r.statements.every((s) => s.group === "setup"));
  const rest = history.repeatable.filter((r) => !r.statements.every((s) => s.group === "setup"));
  const stepBlock = (s: FrozenStep): string[] => {
    const caps = (s.verify?.before ?? []).map((c) => c.key);
    return [
      `IF NOT EXISTS (SELECT 1 FROM ${table} WHERE step_id = ${L(s.id)}) THEN`,
      `    IF head IS DISTINCT FROM ${L(s.from)} THEN RAISE EXCEPTION 'lifecycle: the database is in state %, and step % starts from ${s.from}', head, ${L(s.name)}; END IF;`,
      ...before.map((b) => `    ${b}`),
      ...(s.verify?.before ?? []).flatMap((c) => [`    EXECUTE ${L(c.query)} INTO cap_${caps.indexOf(c.key)};`]),
      ...s.up.flatMap(run).map((x) => `    ${x}`),
      ...(s.verify?.after ?? []).flatMap((c) =>
        typeof c.expect === "object"
          ? [
              `    EXECUTE ${L(c.query)} INTO chk; IF chk IS DISTINCT FROM cap_${caps.indexOf(c.expect.sameAs)} THEN RAISE EXCEPTION ${L(`lifecycle: verification failed: ${c.describe}`)}; END IF;`,
            ]
          : [
              `    IF ${c.expect === "none" ? "" : "NOT "}EXISTS (${c.query}) THEN RAISE EXCEPTION ${L(`lifecycle: verification failed: ${c.describe}`)}; END IF;`,
            ],
      ),
      ...record(s.id, s.name, s.from, s.to).map((x) => `    ${x}`),
      `    head := ${L(s.to)};`,
      `    touched := touched || ARRAY[${s.of.map((x) => L(x)).join(", ")}]::text[];`,
      "END IF;",
    ];
  };
  const maxCaps = Math.max(0, ...history.steps.map((s) => (s.verify?.before ?? []).length));
  const body = [
    "DECLARE",
    "    head text; prev text := '" + GENESIS + "'; seqn integer := 0; r record; chk text; touched text[] := ARRAY[]::text[];",
    ...Array.from({ length: maxCaps }, (_, i) => `    cap_${i} text;`),
    "BEGIN",
    `    PERFORM pg_advisory_xact_lock(hashtext(${L(`${settings.runnerSchema}.migrate`)}));`,
    `    FOR r IN SELECT * FROM ${table} ORDER BY seq LOOP`,
    `        IF r.chain <> ${hashOf("prev", "r.step_id", "r.from_state", "r.to_state")} THEN RAISE EXCEPTION 'lifecycle: the ledger was changed at entry %', r.seq; END IF;`,
    "        prev := r.chain; seqn := r.seq;",
    "        IF r.step_id NOT LIKE 'repeatable:%' THEN head := r.to_state; END IF;",
    "    END LOOP;",
    `    head := coalesce(head, ${L(history.from)});`,
    ...setup.flatMap((r) => repeatable(r, "head")).map((x) => `    ${x}`),
    ...history.steps.flatMap(stepBlock).map((x) => `    ${x}`),
    ...rest.flatMap((r) => repeatable(r, "head")).map((x) => `    ${x}`),
    "END",
  ];
  const sql = [
    `CREATE SCHEMA IF NOT EXISTS ${schema};`,
    `CREATE TABLE IF NOT EXISTS ${table} (seq integer PRIMARY KEY, step_id text NOT NULL UNIQUE, name text NOT NULL, from_state text NOT NULL, to_state text NOT NULL, chain text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), applied_by text NOT NULL DEFAULT current_user);`,
    `CREATE OR REPLACE FUNCTION ${schema}.${q("verify")}() RETURNS boolean LANGUAGE plpgsql AS ${TAG}\nDECLARE prev text := '${GENESIS}'; r record;\nBEGIN\n    FOR r IN SELECT * FROM ${table} ORDER BY seq LOOP\n        IF r.chain <> ${hashOf("prev", "r.step_id", "r.from_state", "r.to_state")} THEN RETURN false; END IF;\n        prev := r.chain;\n    END LOOP;\n    RETURN true;\nEND\n${TAG};`,
    `CREATE OR REPLACE FUNCTION ${schema}.${q("status")}() RETURNS TABLE (state text, steps integer) LANGUAGE sql AS ${TAG}\nSELECT coalesce((SELECT to_state FROM ${table} WHERE step_id NOT LIKE 'repeatable:%' ORDER BY seq DESC LIMIT 1), ${L(history.from)}), (SELECT count(*)::integer FROM ${table} WHERE step_id NOT LIKE 'repeatable:%')\n${TAG};`,
    `CREATE OR REPLACE PROCEDURE ${schema}.${q("migrate")}() LANGUAGE plpgsql AS ${TAG}\n${body.join("\n")}\n${TAG};`,
  ];
  return ok([{ path: `${settings.folder}/in-database/installer.sql`, text: `${sql.join("\n")}\n` }]);
}
