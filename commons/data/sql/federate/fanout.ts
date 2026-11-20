// Spec: 0059-sql-federate FR-001, FR-002, FR-003, FR-004
/**
 * Fan-out (commons data 0059-sql-federate): one read-only query asked of many targets at once. A target is anything that answers a query: a `Driver` (0056) with a name and, where it matters, a platform: a database, or a
 * machine asked through osquery (0058). Every target's answer is a value: its rows, or a typed error (it timed out, it failed, it gave more rows than the plan allows), so that one target failing is a line in the result
 * and not the end of the run. The result is partial by default; a quorum says how many must answer for it to count.
 *
 * @module
 */
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";

/** Something that answers a query. */
export interface Target {
  /** What it is called in results (a host name, a database's name): unique in a plan. */
  readonly id: string;
  /** Where it is, where that decides what it can answer (`linux`, `darwin`); free text for the caller. */
  readonly platform?: string;
  readonly driver: Driver;
}

/** A value of a row as a target gives it. */
export type Value = string | number | boolean | null;
/** A row as a target gives it. */
export type Row = Readonly<Record<string, unknown>>;

/** Why a target gave no rows. */
export type FanOutError =
  | { readonly kind: "timeout"; readonly ms: number }
  | { readonly kind: "too-many-rows"; readonly max: number }
  | { readonly kind: "failed"; readonly message: string; /** What the driver rejected with, where it is a typed error (osquery's `OsqueryFailure` has `.error`). */ readonly cause?: unknown };

/** What one target answered. */
export type Outcome =
  | { readonly target: string; readonly status: "ok"; readonly rows: readonly Row[]; readonly durationMs: number; readonly collectedAt: string }
  | { readonly target: string; readonly status: "error"; readonly error: FanOutError; readonly durationMs: number; readonly collectedAt: string };

/** What a fan-out is told. */
export interface Plan {
  /** The query. The driver of each target is trusted to refuse what it must (osquery's is read-only); a query that writes is the caller's to keep out. */
  readonly sql: string;
  readonly targets: readonly Target[];
  /** How long a target may take; none where not given. */
  readonly timeoutMs?: number;
  /** How many targets are asked at once; all of them where not given. */
  readonly concurrency?: number;
  /** The most rows a target may give: more is an error, and the rows are not kept. */
  readonly maxRows?: number;
  /** The share of targets (0 to 1) that must answer for the result to count: `0` where not given, so that a result is partial by default. */
  readonly quorum?: number;
  /** Changes a value before it is kept (to hide a personal column): the column and the value. */
  readonly redact?: (column: string, value: unknown) => unknown;
  /** The clock, for tests. */
  readonly now?: () => Date;
}

/** What a fan-out gave. */
export interface FanOut {
  readonly sql: string;
  /** Every target's outcome, in the order of the plan. */
  readonly outcomes: readonly Outcome[];
  readonly ok: number;
  readonly failed: number;
  /** Whether every target answered. */
  readonly complete: boolean;
  /** Whether enough answered: the share that did is at least the plan's quorum. */
  readonly quorumMet: boolean;
  readonly quorum: number;
  /** When the run began. */
  readonly startedAt: string;
}

const messageOf = (thrown: unknown): string => (thrown instanceof Error ? thrown.message : String(thrown));

async function ask(t: Target, plan: Plan, now: () => Date): Promise<Outcome> {
  const started = now();
  const done = (): number => now().getTime() - started.getTime();
  const at = started.toISOString();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const query = t.driver.query(plan.sql);
    const raced =
      plan.timeoutMs === undefined
        ? await query
        : await Promise.race([
            query,
            new Promise<"timeout">((resolve) => {
              timer = setTimeout(() => resolve("timeout"), plan.timeoutMs);
            }),
          ]);
    if (raced === "timeout") {
      query.catch(() => undefined);
      return { target: t.id, status: "error", error: { kind: "timeout", ms: plan.timeoutMs ?? 0 }, durationMs: done(), collectedAt: at };
    }
    if (plan.maxRows !== undefined && raced.length > plan.maxRows) return { target: t.id, status: "error", error: { kind: "too-many-rows", max: plan.maxRows }, durationMs: done(), collectedAt: at };
    const rows = plan.redact === undefined ? raced : raced.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plan.redact?.(k, v) ?? v])));
    return { target: t.id, status: "ok", rows, durationMs: done(), collectedAt: at };
  } catch (thrown) {
    return { target: t.id, status: "error", error: { kind: "failed", message: messageOf(thrown), cause: thrown }, durationMs: done(), collectedAt: at };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Asks every target the query, at most `concurrency` at a time.
 *
 * @param plan - the query, the targets and the limits
 * @returns every target's outcome; a target that fails is an outcome, never a throw
 */
export async function fanOut(plan: Plan): Promise<FanOut> {
  const now = plan.now ?? ((): Date => new Date());
  const ids = plan.targets.map((t) => t.id);
  if (new Set(ids).size !== ids.length) throw new TypeError(`the targets of a plan are named once each: ${ids.filter((x, i) => ids.indexOf(x) !== i).join(", ")}`);
  const startedAt = now().toISOString();
  const outcomes: Outcome[] = new Array(plan.targets.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(plan.concurrency ?? plan.targets.length, plan.targets.length || 1)) }, async () => {
    for (;;) {
      const i = next++;
      const t = plan.targets[i];
      if (t === undefined) return;
      outcomes[i] = await ask(t, plan, now);
    }
  });
  await Promise.all(workers);
  const ok = outcomes.filter((o) => o.status === "ok").length;
  const quorum = plan.quorum ?? 0;
  return { sql: plan.sql, outcomes, ok, failed: outcomes.length - ok, complete: ok === outcomes.length, quorumMet: plan.targets.length === 0 ? quorum === 0 : ok / plan.targets.length >= quorum, quorum, startedAt };
}

/** The outcomes that failed, with the targets they are of. */
export const failures = (r: FanOut): readonly (Outcome & { readonly status: "error" })[] => r.outcomes.filter((o): o is Outcome & { readonly status: "error" } => o.status === "error");
