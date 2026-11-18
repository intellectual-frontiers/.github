// Spec: 0018-sql-history FR-008
/**
 * The release package (commons data 0018-sql-history FR-008): what a DBA runs with nothing but a SQL client. An installer that runs the steps in one transaction with each guard written in the SQL
 * itself, a preflight that returns a row only if the database is in the state the release needs, a verification of what must be true after it, a back-out that undoes the steps that can be undone
 * in the opposite order, a runbook, and a manifest. Where a guard cannot be written in the dialect's SQL the package is an error value, unless the project allows it to be left out.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Repeatable, StepStatement } from "@intellectual-frontiers/data/sql/lifecycle";
import { type Dialect, upsert } from "@intellectual-frontiers/data/sql/physical";
import { type Artifact, sha256Hex } from "./deps.ts";
import type { FrozenStep } from "./format.ts";
import type { History } from "./settings.ts";

/** What a package is made from. */
export interface Releasable {
  readonly from: string;
  readonly to: string;
  readonly steps: readonly FrozenStep[];
  readonly repeatable: readonly Repeatable[];
}

/** What is wrong with a package. */
export type PackageError = { readonly kind: "guard"; readonly step: string; readonly why: string };

/** What a package is given besides the steps. */
export interface PackageOptions {
  readonly settings: History;
  /** The hash of the state of an empty database: a release from it has no release before it. */
  readonly empty?: string;
  /** Statements run at the start of the transaction, such as the setting that tells a guard a migration is running. */
  readonly before?: readonly string[];
}

const TAG = "$ifc_release$";

function inline(s: StepStatement, dialect: Dialect, leaveOut: boolean): string | undefined {
  const g = s.guard;
  if (g === undefined) return s.sql;
  if (dialect.features.includes("routines") && !s.sql.includes(TAG) && !g.query.includes(TAG))
    return `DO ${TAG}\nBEGIN\n    IF ${g.skipWhen === "rows" ? "NOT " : ""}EXISTS (${g.query}) THEN\n        EXECUTE ${dialect.literal(s.sql)};\n    END IF;\nEND\n${TAG};`;
  return leaveOut
    ? `${s.sql}\n-- the guard (${g.skipWhen === "rows" ? "skip when" : "run only when"} a row is returned by: ${g.query.replace(/\s+/g, " ")}) cannot be written in ${dialect.name}'s SQL and was left out`
    : undefined;
}

/** What must be true after a step, as a block that raises where it is not, for a dialect that has blocks. */
function checkBlock(
  c: { readonly describe: string; readonly query: string; readonly expect: "rows" | "none" | { readonly sameAs: string } },
  n: number,
  dialect: Dialect,
): string[] {
  if (typeof c.expect === "object")
    return [`-- step ${n}: ${c.describe} compares with a value read before the step, which only a runner can do`];
  if (!dialect.features.includes("routines")) return [`-- step ${n}: ${c.describe} is checked by verify.sql, not inside the transaction`];
  return [
    `DO ${TAG}\nBEGIN\n    IF ${c.expect === "none" ? "" : "NOT "}EXISTS (${c.query}) THEN RAISE EXCEPTION ${dialect.literal(`verification failed: step ${n}: ${c.describe}`)}; END IF;\nEND\n${TAG};`,
  ];
}

const one = (t: string): string => t.replace(/\s*\r?\n\s*/g, " ").trim();

/**
 * The release package of a frozen history.
 *
 * @param release - the steps and the objects that are applied again
 * @param dialect - the dialect
 * @param options - the settings, the empty state and what is run first
 * @returns the files, or why a guard cannot be written
 */
export function releasePackage(
  release: Releasable,
  dialect: Dialect,
  options: PackageOptions,
): Result<readonly Artifact[], readonly PackageError[]> {
  const { settings } = options;
  const label = settings.release ?? release.to.slice(0, 12);
  const dir = `${settings.folder}/release-${label}`;
  const q = dialect.quote;
  const leaveOut = settings.unguardable === "leave-out";
  const errors: PackageError[] = [];
  const text = (s: StepStatement, step: string): string => {
    const sql = inline(s, dialect, leaveOut);
    if (sql === undefined) {
      errors.push({
        kind: "guard",
        step,
        why: `${dialect.name} has no procedural block to carry the guard of: ${one(s.sql).slice(0, 80)}`,
      });
      return s.sql;
    }
    return sql;
  };
  const runnable = (r: Repeatable): string[] => r.statements.map((s) => text(s, r.key));
  const setup = release.repeatable.filter((r) => r.statements.every((s) => s.group === "setup"));
  const rest = release.repeatable.filter((r) => !r.statements.every((s) => s.group === "setup"));
  const check = (c: Parameters<typeof checkBlock>[0], n: number): string[] => checkBlock(c, n, dialect);
  const marker = "lifecycle_release";
  const markerDdl = `CREATE TABLE IF NOT EXISTS ${q(marker)} (${q("release")} ${dialect.type({ kind: "text" })} NOT NULL, ${q("from_state")} ${dialect.type({ kind: "text" })} NOT NULL, ${q("to_state")} ${dialect.type({ kind: "text" })} NOT NULL PRIMARY KEY);`;
  const install = [
    `-- release ${label}: ${release.steps.length} steps, from state ${release.from} to state ${release.to}`,
    "-- Run preflight.sql first: it must return a row. Run verify.sql after: every row must say ok.",
    "BEGIN;",
    ...(options.before ?? []),
    markerDdl,
    ...setup.flatMap((r) => [`-- ${r.key}`, ...runnable(r)]),
    ...release.steps.flatMap((s, i) => [
      "",
      `-- step ${i + 1}: ${one(s.name)} (${s.class}, ${s.reversibility}${s.idempotency === undefined ? "" : `, ${s.idempotency}`})`,
      ...s.up.map((u) => text(u, s.name)),
      ...(s.verify?.after ?? []).flatMap((c) => check(c, i + 1)),
    ]),
    ...rest.flatMap((r) => ["", `-- ${r.key}`, ...runnable(r)]),
    "",
    upsert(dialect, marker, ["release", "from_state", "to_state"], ["to_state"], [[label, release.from, release.to]]),
    "COMMIT;",
  ];
  const first = options.empty !== undefined && release.from === options.empty;
  const preflight = [
    `-- the database must be in state ${release.from}`,
    first
      ? `SELECT 1 AS ok WHERE NOT EXISTS (${dialect.probes?.table(marker) ?? `SELECT 1 FROM ${q(marker)}`});`
      : `SELECT 1 AS ok FROM ${q(marker)} WHERE ${q("to_state")} = ${dialect.literal(release.from)};`,
  ];
  // what is checked after the release is what its last step says, since an earlier step's check may have been made false by a later step; each step was checked inside the installer
  const lastN = release.steps.length;
  const checks = (release.steps[lastN - 1]?.verify?.after ?? []).flatMap((c) =>
    typeof c.expect === "object"
      ? []
      : [
          `SELECT CASE WHEN ${c.expect === "none" ? "NOT " : ""}EXISTS (${c.query}) THEN 'ok' ELSE ${dialect.literal(`FAILED: step ${lastN}: ${c.describe}`)} END AS result;`,
        ],
  );
  const verify = [
    `-- what must be true after release ${label}`,
    ...checks,
    `SELECT CASE WHEN EXISTS (SELECT 1 FROM ${q(marker)} WHERE ${q("to_state")} = ${dialect.literal(release.to)}) THEN 'ok' ELSE 'FAILED: the release is not recorded' END AS result;`,
  ];
  const stuck = release.steps.filter((s) => s.down === undefined);
  const backout = [
    `-- back out release ${label}, in the opposite order of the steps`,
    ...(stuck.length === 0
      ? []
      : [`-- these steps cannot be undone, and their data is not brought back by this file: ${stuck.map((s) => one(s.name)).join("; ")}`]),
    "BEGIN;",
    ...(options.before ?? []),
    ...[...release.steps]
      .reverse()
      .flatMap((s) =>
        s.down === undefined
          ? [`-- step: ${one(s.name)} cannot be undone`]
          : [`-- undo: ${one(s.name)}`, ...s.down.map((d) => text(d, s.name))],
      ),
    `DELETE FROM ${q(marker)} WHERE ${q("to_state")} = ${dialect.literal(release.to)};`,
    "COMMIT;",
  ];
  const runbook = [
    `# Release ${label}`,
    "",
    `From state \`${release.from.slice(0, 12)}\` to state \`${release.to.slice(0, 12)}\`, ${release.steps.length} steps.`,
    "",
    "1. Run `preflight.sql`. It must return a row: the database is in the state this release needs.",
    "2. Run `install.sql`. It runs in one transaction: it applies all of it or none of it.",
    "3. Run `verify.sql`. Every row must say `ok`.",
    "4. To undo, run `backout.sql`.",
    "",
    "| # | Step | Class | Reversibility | Idempotency |",
    "| --- | --- | --- | --- | --- |",
    ...release.steps.map(
      (s, i) => `| ${i + 1} | ${one(s.name).replaceAll("|", "\\|")} | ${s.class} | ${s.reversibility} | ${s.idempotency ?? ""} |`,
    ),
    ...(stuck.length === 0 ? [] : ["", `Cannot be undone: ${stuck.map((s) => one(s.name)).join("; ")}.`]),
  ];
  if (errors.length > 0) return err(errors);
  const files: Artifact[] = [
    { path: `${dir}/install.sql`, text: `${install.join("\n")}\n` },
    { path: `${dir}/preflight.sql`, text: `${preflight.join("\n")}\n` },
    { path: `${dir}/verify.sql`, text: `${verify.join("\n")}\n` },
    { path: `${dir}/backout.sql`, text: `${backout.join("\n")}\n` },
    { path: `${dir}/runbook.md`, text: `${runbook.join("\n")}\n` },
  ];
  const manifest = JSON.stringify(
    {
      format: 1,
      release: label,
      dialect: dialect.name,
      from: release.from,
      to: release.to,
      files: files.map((f) => ({ file: f.path, sha256: sha256Hex(f.text) })),
    },
    null,
    2,
  );
  return ok([...files, { path: `${dir}/manifest.json`, text: `${manifest}\n` }]);
}
