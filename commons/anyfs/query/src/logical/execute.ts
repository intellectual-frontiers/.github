// Spec: 0003-query-planning FR-002, FR-003, FR-004, FR-005, FR-006, FR-007; 0004-query-safety FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * A query run (commons anyfs-query 0003-query-planning, 0004-query-safety): the plan of a query is carried out over the store of its place, listing only below the prefix its filter allows, answering from the
 * listing what the listing answers, and reading an object only when the listing has left it and the consent and the budget allow. The operations it uses are `list`, `stat`, `history` and `read`, and no
 * others. A run that reaches a limit says so in its result, with the rows it has.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Expr } from "@intellectual-frontiers/lang-sql";
import { explain as explainPlan, type Plan } from "@intellectual-frontiers/lang-sql/aide/plan";
import { compile, run, type Row, type Value } from "@intellectual-frontiers/lang-sql/aide/exec";
import { print, ansi } from "@intellectual-frontiers/lang-sql";
import { type Cursor, type Path, type Prefix, nameOf, parentOf } from "@intellectual-frontiers/anyfs/governance";
import type { Stat } from "@intellectual-frontiers/anyfs/logical";
import {
  type Budget,
  type Consent,
  type QueryProblem,
  type Stats,
  type TableName,
  type Truncation,
  consentFor,
  covers,
  parseBudget,
} from "@intellectual-frontiers/anyfs-query/governance";
import { type Analyzed, type OutColumn, analyze } from "./analyze.ts";
import { type QueryContext, type Resolved, budgetOf } from "./context.ts";
import { environmentFunctions } from "./functions.ts";
import { mediaTypeOf } from "./media.ts";
import { type Bound, type Classified, classify } from "./pushdown.ts";

/** What a query gave. */
export type Queried = {
  readonly columns: readonly OutColumn[];
  readonly rows: readonly Row[];
  /** The limit the run ended at, short of its end, or nothing where it ended. */
  readonly truncated: Truncation | undefined;
  readonly stats: Stats;
  /** The plan and what the run did, as text. */
  readonly explained: string;
};

const PAGE = 1000;

const truthy = (v: Value): boolean => v === true || (typeof v === "number" && v !== 0);

/** Whether `inner` is `outer` or below it, by whole segments. */
const within = (outer: string, inner: string): boolean => outer === "" || inner === outer || inner.startsWith(`${outer}/`);

/** The row a listing gives for an object. */
export function listingRow(place: string, s: Stat): Row {
  const path: string = s.path;
  const name = nameOf(s.path);
  const dot = name.lastIndexOf(".");
  const ext = dot <= 0 ? "" : name.slice(dot + 1);
  const ms = s.modified === undefined ? Number.NaN : Date.parse(s.modified);
  return { place, path, name, ext, size: s.size, media_type: mediaTypeOf(ext), mtime: Number.isNaN(ms) ? null : Math.floor(ms / 1000), rev: s.rev, kind: "f", depth: path.split("/").length };
}

/** Everything a run needs, found before anything is listed. */
type Prepared = {
  readonly analyzed: Analyzed;
  readonly table: TableName;
  readonly resolved: Resolved | undefined;
  readonly classified: Classified;
  readonly budget: Budget;
  readonly required: Consent;
};


/** A query read, its place resolved, its consent and capabilities checked: no store is called. */
function prepare(ctx: QueryContext, text: string): Result<Prepared, QueryProblem> {
  const analyzed = analyze(text);
  if (analyzed.kind === "err") return analyzed;
  const a = analyzed.value;
  const budgetResult = parseBudget(budgetOf(ctx));
  if (budgetResult.kind === "err") return err({ kind: "budget", why: budgetResult.error });
  const classified = classify(a.predicate);
  const table = a.origin.table;
  if (table === "places") return ok({ analyzed: a, table, resolved: undefined, classified, budget: budgetResult.value, required: "none" });
  const named = a.origin.place ?? ctx.defaultPlace;
  if (named === undefined) return err({ kind: "place", place: "", reason: `${table} names no place and the context has no default` });
  const resolved = ctx.resolve(named);
  if (resolved.kind === "err") return err({ kind: "place", place: named, reason: resolved.error });
  const required = consentFor(table);
  const granted = ctx.consent(resolved.value.place);
  if (!covers(granted, required)) return err({ kind: "consent", place: resolved.value.place, needed: required, granted });
  const store = resolved.value.store;
  const needed = table === "revisions" ? ("history" as const) : table === "content" ? ("read" as const) : ("list" as const);
  if (!store.capabilities.has(needed)) return err({ kind: "capability", place: resolved.value.place, table, needed });
  if (table === "content" && !store.capabilities.has("list")) return err({ kind: "capability", place: resolved.value.place, table, needed: "list" });
  if (table === "revisions" && classified.bound.kind !== "exact") return err({ kind: "path-needed", table, why: "its versions are asked of one path: add path = '...' to the WHERE" });
  return ok({ analyzed: a, table, resolved: resolved.value, classified, budget: budgetResult.value, required });
}

/** What the listing is asked for: nothing, one path, or a prefix. */
type Reach = { readonly kind: "nothing"; readonly why: string } | { readonly kind: "path"; readonly path: Path } | { readonly kind: "below"; readonly prefix: Prefix };

/** Where a query lists: the prefix of its place, narrowed by what its filter says. */
export function reachOf(base: Prefix, bound: Bound): Reach {
  switch (bound.kind) {
    case "anywhere":
      return { kind: "below", prefix: base };
    case "nowhere":
      return { kind: "nothing", why: bound.why };
    case "exact":
      return within(base, bound.path) ? { kind: "path", path: bound.path } : { kind: "nothing", why: `${bound.path} is not below ${base === "" ? "the root" : base}` };
    case "below":
      if (within(base, bound.prefix)) return { kind: "below", prefix: bound.prefix };
      return within(bound.prefix, base) ? { kind: "below", prefix: base } : { kind: "nothing", why: `${bound.prefix === "" ? "the root" : bound.prefix} is not below ${base === "" ? "the root" : base}` };
  }
}

/** The run's state: what it did, and why it stopped. */
type State = { stats: { listCalls: number; listed: number; statCalls: number; read: number; bytes: number }; truncated: Truncation | undefined; problem: QueryProblem | undefined };

const emptyState = (): State => ({ stats: { listCalls: 0, listed: 0, statCalls: 0, read: 0, bytes: 0 }, truncated: undefined, problem: undefined });

const decoder = new TextDecoder("utf-8", { fatal: true });

/** The rows of the objects of a place that the filter's listing conjuncts leave, in the order the store lists them; the read of an object comes after. */
async function* candidates(ctx: QueryContext, p: Prepared, listing: readonly ((row: Row) => Value)[], state: State, started: number): AsyncGenerator<Row> {
  const resolved = p.resolved;
  if (resolved === undefined) return;
  const store = resolved.store;
  const place = resolved.place;
  const reach = reachOf(resolved.prefix, p.classified.bound);
  if (reach.kind === "nothing") return;
  const late = (): boolean => {
    if (ctx.clock.now() - started >= p.budget.deadlineMs) {
      state.truncated = "deadline";
      return true;
    }
    return false;
  };
  const keep = (row: Row): boolean => listing.every((f) => truthy(f(row)));
  const entries = async function* (): AsyncGenerator<Stat> {
    if (reach.kind === "path") {
      if (store.capabilities.has("stat")) {
        state.stats.statCalls += 1;
        const r = await store.handle({ op: "stat", path: reach.path });
        if (r.kind === "ok" && r.value.op === "stat") yield r.value.value;
        else if (r.kind === "err" && r.error.kind !== "missing") state.problem = { kind: "store", place, problem: r.error };
        return;
      }
    }
    const prefix: Prefix = reach.kind === "path" ? parentOf(reach.path) : reach.prefix;
    const known = reach.kind === "below" && ctx.index !== undefined ? await ctx.index.list(place, prefix) : undefined;
    if (known !== undefined) {
      for (const s of known) yield s;
      return;
    }
    let after: Cursor | undefined;
    for (;;) {
      if (late()) return;
      state.stats.listCalls += 1;
      const r = await store.handle(after === undefined ? { op: "list", prefix, limit: PAGE } : { op: "list", prefix, limit: PAGE, after });
      if (r.kind === "err") {
        state.problem = { kind: "store", place, problem: r.error };
        return;
      }
      if (r.value.op !== "list") return;
      for (const s of r.value.value.entries) {
        if (reach.kind === "path" && s.path !== reach.path) continue;
        yield s;
      }
      after = r.value.value.next;
      if (after === undefined) return;
    }
  };
  for await (const s of entries()) {
    if (late()) return;
    if (state.stats.listed >= p.budget.maxListed) {
      state.truncated = "listed";
      return;
    }
    state.stats.listed += 1;
    let row = listingRow(place, s);
    if (!keep(row)) continue;
    if (p.table === "content") {
      if (ctx.redacted?.(place, s.path) === true) row = { ...row, text: null, is_text: false, redacted: true };
      else {
        if (state.stats.read >= p.budget.maxRead) {
          state.truncated = "read";
          return;
        }
        if (state.stats.bytes + s.size > p.budget.maxBytes) {
          state.truncated = "bytes";
          return;
        }
        const r = await store.handle({ op: "read", path: s.path });
        if (r.kind === "err") {
          if (r.error.kind === "missing") continue;
          state.problem = { kind: "store", place, problem: r.error };
          return;
        }
        if (r.value.op !== "read") return;
        state.stats.read += 1;
        state.stats.bytes += r.value.value.bytes.length;
        let text: string | null = null;
        try {
          text = decoder.decode(r.value.value.bytes);
        } catch {
          text = null;
        }
        row = { ...row, text, is_text: text !== null, redacted: false };
      }
    }
    yield row;
  }
}

/** The rows of the versions of one path. */
async function versions(p: Prepared, state: State): Promise<readonly Row[]> {
  const resolved = p.resolved;
  const bound = p.classified.bound;
  if (resolved === undefined || bound.kind !== "exact") return [];
  const r = await resolved.store.handle({ op: "history", path: bound.path });
  if (r.kind === "err") {
    if (r.error.kind !== "missing") state.problem = { kind: "store", place: resolved.place, problem: r.error };
    return [];
  }
  if (r.value.op !== "history") return [];
  return r.value.value.versions.map((v): Row => {
    const ms = v.modified === undefined ? Number.NaN : Date.parse(v.modified);
    return { place: resolved.place, path: bound.path, rev: v.rev, size: v.size, instant: Number.isNaN(ms) ? null : Math.floor(ms / 1000) };
  });
}

const limitOf = (plan: Plan): { readonly limit: number | undefined; readonly offset: number } => (plan.kind === "limit" ? { limit: plan.limit, offset: plan.offset ?? 0 } : { limit: undefined, offset: 0 });

const hasNode = (plan: Plan, kind: "sort"): boolean => {
  for (let q: Plan = plan; ; ) {
    if (q.kind === kind) return true;
    if (q.kind === "scan") return false;
    q = q.input;
  }
};

const isDistinct = (plan: Plan): boolean => {
  for (let q: Plan = plan; ; ) {
    if (q.kind === "project") return q.distinct;
    if (q.kind === "scan") return false;
    q = q.input;
  }
};

const text = (e: Expr): string => print(e, ansi);

/** The plan of a run and what the run would do, as text, with no store called. */
export function describeRun(ctx: QueryContext, p: Prepared): string {
  const lines = [explainPlan(p.analyzed.plan)];
  const src = p.analyzed.origin;
  lines.push(`source: ${src.table}${src.place === undefined ? "" : `('${src.place}')`}${p.resolved === undefined ? "" : ` at ${p.resolved.place}${p.resolved.prefix === "" ? "" : `/${p.resolved.prefix}`}`}`);
  if (p.table === "places") lines.push("lists: nothing (the places of the context)");
  else if (p.table === "revisions") lines.push(`history: ${p.classified.bound.kind === "exact" ? p.classified.bound.path : "?"}`);
  else {
    const reach = p.resolved === undefined ? undefined : reachOf(p.resolved.prefix, p.classified.bound);
    if (reach?.kind === "nothing") lines.push(`lists: nothing (${reach.why})`);
    else if (reach?.kind === "path") lines.push(`stats: ${reach.path}`);
    else lines.push(`lists: below ${reach === undefined || reach.prefix === "" ? "the root" : reach.prefix}${ctx.index === undefined ? "" : " (the index is asked first)"}`);
    const rules = p.classified.bound.kind === "below" || p.classified.bound.kind === "exact" ? p.classified.bound.rules : [];
    if (rules.length > 0) lines.push(`pushed: ${rules.join("; ")}`);
    lines.push(`listing filters: ${p.classified.listing.length === 0 ? "none" : p.classified.listing.map(text).join(" AND ")}`);
    lines.push(`content filters: ${p.classified.content.length === 0 ? "none" : `${p.classified.content.map(text).join(" AND ")} (only for objects the listing filters leave)`}`);
  }
  lines.push(`consent: needs ${p.required}`);
  const b = p.budget;
  lines.push(`budget: ${b.maxListed} listed, ${b.maxRead} read, ${b.maxBytes} bytes, ${b.maxRows} rows, ${b.deadlineMs} ms`);
  return lines.join("\n");
}

/** What a query would do, as text, with no store called. */
export function explainQuery(ctx: QueryContext, queryText: string): Result<string, QueryProblem> {
  const prepared = prepare(ctx, queryText);
  return prepared.kind === "err" ? prepared : ok(describeRun(ctx, prepared.value));
}

/** Runs a query. */
export async function query(ctx: QueryContext, queryText: string): Promise<Result<Queried, QueryProblem>> {
  const prepared = prepare(ctx, queryText);
  if (prepared.kind === "err") return prepared;
  const p = prepared.value;
  const a = p.analyzed;
  const started = ctx.clock.now();
  const env = { functions: environmentFunctions(Math.floor(started / 1000)) };
  const compiled = (e: Expr): Result<(row: Row) => Value, QueryProblem> => {
    const c = compile(e, env);
    return c.kind === "ok" ? ok(c.value) : err({ kind: "run", diagnostics: c.error });
  };
  const listingFns: ((row: Row) => Value)[] = [];
  for (const e of p.classified.listing) {
    const c = compiled(e);
    if (c.kind === "err") return c;
    listingFns.push(c.value);
  }
  let whole: ((row: Row) => Value) | undefined;
  if (a.predicate !== undefined) {
    const c = compiled(a.predicate);
    if (c.kind === "err") return c;
    whole = c.value;
  }
  const state = emptyState();
  const { limit, offset } = limitOf(a.plan);
  const stopAfter = limit !== undefined && !hasNode(a.plan, "sort") && !isDistinct(a.plan) ? offset + limit : undefined;
  const matched: Row[] = [];
  const source: AsyncIterable<Row> | readonly Row[] =
    p.table === "places"
      ? (ctx.places ?? []).map((x): Row => ({ uri: x.uri, kind: x.kind, capabilities: x.capabilities.join(","), consistency: x.consistency, max_object: x.maxObject ?? null }))
      : p.table === "revisions"
        ? await versions(p, state)
        : candidates(ctx, p, listingFns, state, started);
  for await (const row of source) {
    if (whole !== undefined && !truthy(whole(row))) continue;
    matched.push(row);
    if (stopAfter !== undefined && matched.length >= stopAfter) break;
  }
  if (state.problem !== undefined) return err(state.problem);
  const ran = await run(a.plan, matched, env);
  if (ran.kind === "err") return err({ kind: "run", diagnostics: ran.error });
  const rows = ran.value.length > p.budget.maxRows ? ran.value.slice(0, p.budget.maxRows) : ran.value;
  const truncated = state.truncated ?? (ran.value.length > p.budget.maxRows ? "rows" : undefined);
  return ok({ columns: a.columns, rows, truncated, stats: { ...state.stats }, explained: describeRun(ctx, p) });
}

