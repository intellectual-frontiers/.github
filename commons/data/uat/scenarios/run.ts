// Spec: 0071-uat-kit FR-005
/**
 * The runner of the row-security scenarios (commons data 0071-uat-kit FR-005): it is given a way to open a session as a role, and runs each scenario in a transaction that it rolls back. It knows no database: `bin/rls-check.ts`
 * gives it connections to yours, and the library's tests give it an in-process PostgreSQL.
 *
 * @module
 */
import { type Issuer, type Scenario, scenarios } from "./scenarios.ts";

/** A session as a role. */
export interface Session {
  exec(sql: string): Promise<void>;
  query(sql: string): Promise<readonly Record<string, unknown>[]>;
  close(): Promise<void>;
}

/** What came of one scenario. */
export interface Result {
  readonly scenario: Scenario;
  readonly status: "pass" | "fail" | "gap";
  readonly detail: string;
}

const text = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Runs the scenarios.
 *
 * @param open - opens a session as a role
 * @param issuer - what the issuer holds
 * @param only - the ids to run; all by default
 */
export async function runScenarios(open: (role: Scenario["role"]) => Promise<Session>, issuer: Issuer, only?: readonly string[]): Promise<Result[]> {
  const out: Result[] = [];
  for (const s of scenarios.filter((x) => only === undefined || only.includes(x.id))) {
    const session = await open(s.role);
    let status: Result["status"] = "fail";
    let detail = "";
    try {
      await session.exec("BEGIN");
      for (const stmt of (await s.scope?.(issuer)) ?? []) await session.exec(stmt);
      let rows: readonly Record<string, unknown>[] | undefined;
      let error: string | undefined;
      try {
        rows = await session.query(s.sql);
      } catch (thrown) {
        error = text(thrown);
      }
      const e = s.expect;
      if (e.kind === "error") {
        const ok = error !== undefined && new RegExp(e.match, "i").test(error);
        status = ok ? "pass" : "fail";
        detail = ok ? `refused: ${error?.split("\n")[0]}` : error === undefined ? `it ran and returned ${rows?.length ?? 0} row(s)` : `refused for another reason: ${error.split("\n")[0]}`;
      } else if (error !== undefined) detail = `it was refused: ${error.split("\n")[0]}`;
      else {
        const got = [...new Set((rows ?? []).map((r) => String(r[e.of])))].sort();
        const want = [...e.values].sort();
        const ok = JSON.stringify(got) === JSON.stringify(want);
        status = ok ? "pass" : "fail";
        detail = ok ? `${e.of}: ${want.length === 0 ? "(none)" : want.join(", ")}` : `${e.of}: got ${got.length === 0 ? "(none)" : got.join(", ")}, wanted ${want.length === 0 ? "(none)" : want.join(", ")}`;
      }
      if (s.gap === true) {
        status = status === "pass" ? "gap" : "fail";
        detail = status === "gap" ? `the gap is still there: ${detail}` : `the gap seems closed (or changed): ${detail}; revisit the finding`;
      }
    } catch (thrown) {
      detail = `the scenario could not run: ${text(thrown)}`;
    } finally {
      try {
        await session.exec("ROLLBACK");
        await session.exec("RESET app.tenant");
      } catch {
        // the session is closed next
      }
      await session.close();
    }
    out.push({ scenario: s, status, detail });
  }
  return out;
}

/** The results as a table of text a person reads, and whether every scenario did what it must. */
export function report(results: readonly Result[]): { readonly text: string; readonly ok: boolean } {
  const mark = { pass: "PASS", fail: "FAIL", gap: "GAP " } as const;
  const lines = results.map((r) => `${mark[r.status]}  ${r.scenario.id}  ${r.scenario.title}\n      ${r.detail}`);
  const failed = results.filter((r) => r.status === "fail").length;
  const gaps = results.filter((r) => r.status === "gap").length;
  const summary = `${results.length - failed - gaps} passed, ${gaps} known gap${gaps === 1 ? "" : "s"}, ${failed} failed`;
  return { text: `${lines.join("\n")}\n\n${summary}\n`, ok: failed === 0 };
}
