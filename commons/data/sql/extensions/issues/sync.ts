// Spec: 0045-issues-model FR-003, FR-004, FR-005
/**
 * Keeps the records of the issues model in step with the issues in the code (commons data 0045-issues-model): each issue is a record by its scope and number with a hash of what the code says, so that
 * a sync adds what is new, rewrites what changed, marks what the code no longer has as withdrawn (never deleting it) and brings back what returns. All of it is one transaction and is recorded in a
 * ledger; where the records already match the code nothing is written.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Evidence, Issue, IssueSet } from "@intellectual-frontiers/data/governance";
import { canonical, type Driver, sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, type Literal, type Naming, naming as defaultNaming, refsOf, type RefError, writeCode } from "@intellectual-frontiers/data/sql/physical";

/** What a sync is given besides the issues. */
export interface SyncOptions {
  readonly naming?: Naming;
  /** The schema the tables are in. */
  readonly schema?: string;
  readonly now?: () => string;
  readonly newId?: () => string;
  /** Whether to record a run that found nothing to do; by default it writes nothing. */
  readonly recordUnchanged?: boolean;
}

/** What one scope's sync did. */
export interface SyncReport {
  readonly scope: string;
  readonly outcome: "synced" | "unchanged";
  readonly inserted: number;
  readonly updated: number;
  readonly withdrawn: number;
  readonly reopened: number;
  readonly unchanged: number;
  /** A hash of the issues of the code. */
  readonly sourceHash: string;
}

/** Why a sync changed nothing. */
export type SyncError = { readonly kind: "schema"; readonly errors: readonly RefError[] } | { readonly kind: "database"; readonly message: string };

const refOf = (e: Evidence): string => {
  switch (e.kind) {
    case "commit":
      return e.sha;
    case "test":
      return `${e.file}::${e.name}`;
    case "spec":
      return e.id;
    case "file":
      return e.line === undefined ? e.path : `${e.path}:${e.line}`;
    case "review":
      return e.source;
  }
};

/** The hash of what the code says of an issue; a change of anything of it changes the hash. */
export const contentHashOf = (i: Issue): string => sha256Hex(canonical(i));

/**
 * Brings the records of the issues of some scopes in step with the code.
 *
 * @param driver - the database
 * @param schema - the logical schema that has the issues model
 * @param dialect - how the engine writes SQL
 * @param sets - the issues of each scope, as the code has them
 * @param options - the naming, the schema, the clock
 * @returns what each scope's sync did, or why nothing changed
 */
export async function syncIssues(
  driver: Driver,
  schema: LogicalSchema,
  dialect: Dialect,
  sets: readonly IssueSet[],
  options: SyncOptions = {},
): Promise<Result<readonly SyncReport[], SyncError>> {
  const naming = options.naming ?? defaultNaming();
  const kit = refsOf(schema, dialect, naming, options.schema);
  const { refs } = kit;
  const t = refs.table;
  const c = refs.column;
  const lit = (v: Literal): string => dialect.literal(v);
  const code = (s: string): string => writeCode(naming, s);
  const now = options.now ?? ((): string => new Date().toISOString());
  const newId = options.newId ?? ((): string => crypto.randomUUID());
  const T = { issue: t("issue"), goal: t("issue goal"), engine: t("issue engine"), evidence: t("issue evidence"), link: t("issue link"), sync: t("issue sync") };
  const I = (name: string): string => c("issue", name);
  const bad = kit.errors();
  if (bad.length > 0) return err({ kind: "schema", errors: bad });
  const reports: SyncReport[] = [];
  const ids = (s: string, n: number): string => `${s}#${n}`;
  try {
    await driver.exec("BEGIN");
    for (const set of sets) {
      const hashes = new Map(set.issues.map((i) => [ids(set.scope, i.id), contentHashOf(i)]));
      const sourceHash = sha256Hex(canonical([...hashes.entries()]));
      const existing = new Map(
        (await driver.query(`SELECT ${I("issue id")} AS k, ${I("content hash")} AS h, ${I("presence")} AS p FROM ${T.issue} WHERE ${I("scope")} = ${lit(set.scope)}`)).map((r) => [
          String(r["k"]),
          { hash: String(r["h"]), presence: String(r["p"]) },
        ]),
      );
      const at = now();
      let inserted = 0;
      let updated = 0;
      let reopened = 0;
      let withdrawn = 0;
      let same = 0;
      const written: Issue[] = [];
      for (const i of set.issues) {
        const k = ids(set.scope, i.id);
        const e = existing.get(k);
        if (e === undefined) inserted++;
        else if (e.presence === code("withdrawn")) {
          reopened++;
          if (e.hash !== hashes.get(k)) updated++;
        } else if (e.hash !== hashes.get(k)) updated++;
        else {
          same++;
          continue;
        }
        written.push(i);
      }
      const gone = [...existing.entries()].filter(([k, e]) => !hashes.has(k) && e.presence !== code("withdrawn")).map(([k]) => k);
      withdrawn = gone.length;
      if (written.length === 0 && withdrawn === 0) {
        reports.push({ scope: set.scope, outcome: "unchanged", inserted: 0, updated: 0, withdrawn: 0, reopened: 0, unchanged: same, sourceHash });
        if (options.recordUnchanged !== true) continue;
      }
      for (const i of written) {
        const k = ids(set.scope, i.id);
        const s = i.status;
        const reason = s.kind === "wont-fix" || s.kind === "not-a-defect" || s.kind === "deferred" ? s.reason : undefined;
        const proof = s.kind === "fixed" ? s.proof.map(refOf).join("; ") : undefined;
        const values: [string, Literal][] = [
          ["issue id", k],
          ["scope", set.scope],
          ["number", i.id],
          ["slug", i.slug],
          ["title", i.title],
          ["summary", i.summary],
          ["severity", code(i.severity)],
          ["priority", code(i.priority)],
          ["size", code(i.size)],
          ["status kind", code(s.kind)],
          ["status reason", reason ?? null],
          ["status proof", proof ?? null],
          ["duplicate of", s.kind === "duplicate" ? s.of : null],
          ["applies to all", i.appliesTo.engines === "all"],
          ["raised", i.raised],
          ["content hash", contentHashOf(i)],
          ["presence", code("present")],
          ["synced at", at],
        ];
        if (existing.has(k)) {
          await driver.exec(`UPDATE ${T.issue} SET ${values.slice(1).map(([n, v]) => `${I(n)} = ${lit(v)}`).join(", ")} WHERE ${I("issue id")} = ${lit(k)};`);
          for (const [table, name] of [[T.goal, "issue goal"], [T.engine, "issue engine"], [T.evidence, "issue evidence"], [T.link, "issue link"]] as const)
            await driver.exec(`DELETE FROM ${table} WHERE ${c(name, "issue id")} = ${lit(k)};`);
        } else await driver.exec(`INSERT INTO ${T.issue} (${values.map(([n]) => I(n)).join(", ")}) VALUES (${values.map(([, v]) => lit(v)).join(", ")});`);
        for (const g of i.goals)
          await driver.exec(`INSERT INTO ${T.goal} (${c("issue goal", "issue goal id")}, ${c("issue goal", "issue id")}, ${c("issue goal", "goal")}) VALUES (${lit(`${k}/goal/${g}`)}, ${lit(k)}, ${lit(code(g))});`);
        if (i.appliesTo.engines !== "all")
          for (const e of i.appliesTo.engines)
            await driver.exec(`INSERT INTO ${T.engine} (${c("issue engine", "issue engine id")}, ${c("issue engine", "issue id")}, ${c("issue engine", "engine")}) VALUES (${lit(`${k}/engine/${e}`)}, ${lit(k)}, ${lit(e)});`);
        const evidence = i.evidence ?? [];
        for (const [n, e] of evidence.entries())
          await driver.exec(
            `INSERT INTO ${T.evidence} (${c("issue evidence", "issue evidence id")}, ${c("issue evidence", "issue id")}, ${c("issue evidence", "position")}, ${c("issue evidence", "kind")}, ${c("issue evidence", "reference")}) VALUES (${lit(`${k}/evidence/${n + 1}`)}, ${lit(k)}, ${n + 1}, ${lit(code(e.kind))}, ${lit(refOf(e))});`,
          );
      }
      // links last, so that what they point at is there
      for (const i of written) {
        const k = ids(set.scope, i.id);
        for (const l of i.links ?? [])
          await driver.exec(
            `INSERT INTO ${T.link} (${c("issue link", "issue link id")}, ${c("issue link", "issue id")}, ${c("issue link", "target issue id")}, ${c("issue link", "kind")}) VALUES (${lit(`${k}/link/${l.kind}/${l.to}`)}, ${lit(k)}, ${lit(ids(set.scope, l.to))}, ${lit(code(l.kind))});`,
          );
      }
      for (const k of gone) await driver.exec(`UPDATE ${T.issue} SET ${I("presence")} = ${lit(code("withdrawn"))}, ${I("synced at")} = ${lit(at)} WHERE ${I("issue id")} = ${lit(k)};`);
      const S = (name: string): string => c("issue sync", name);
      const vs: [string, Literal][] = [
        ["issue sync id", newId()],
        ["scope", set.scope],
        ["source hash", sourceHash],
        ["ran at", at],
        ["outcome", code(written.length === 0 && withdrawn === 0 ? "unchanged" : "synced")],
        ["inserted", inserted],
        ["updated", updated],
        ["withdrawn", withdrawn],
        ["reopened", reopened],
      ];
      await driver.exec(`INSERT INTO ${T.sync} (${vs.map(([n]) => S(n)).join(", ")}) VALUES (${vs.map(([, v]) => lit(v)).join(", ")});`);
      const done: SyncReport = { scope: set.scope, outcome: written.length === 0 && withdrawn === 0 ? "unchanged" : "synced", inserted, updated, withdrawn, reopened, unchanged: same, sourceHash };
      const prior = reports.findIndex((r) => r.scope === set.scope);
      if (prior >= 0) reports[prior] = done;
      else reports.push(done);
    }
    await driver.exec("COMMIT");
    return ok(reports);
  } catch (thrown) {
    await driver.exec("ROLLBACK").catch(() => undefined);
    return err({ kind: "database", message: thrown instanceof Error ? thrown.message : String(thrown) });
  }
}
