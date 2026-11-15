/**
 * Plans and compiled queries (commons 0010-file-aide FR-022 to FR-028). A query is planned once: its `where` is divided into the prefixes a
 * store lists, the ranges a listing starts after and stops at, the folders left unlisted because no file below them can satisfy it, and the
 * tests run on each file. The plan is compiled once into closures that walk a store folder by folder, in parallel or in key order, honour
 * ignore files and hidden names, and stop as soon as the limit is reached or the caller stops reading.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "../../../kernel/mod.ts";
import type { Entry } from "../algebra/entry.ts";
import { relPath } from "../algebra/names.ts";
import type { Part, Pattern } from "../algebra/path.ts";
import type { AnySegment } from "../algebra/segment.ts";
import { compareKeys, type Capability, type FileMeta, type ListItem, type Store, type StoreError } from "../store/store.ts";
import { type Glob, glob, literalPrefix } from "./glob.ts";
import { IGNORE_FILES, type IgnoreFile, ignored, parseIgnore } from "./ignore.ts";
import { type Comparison, type Expr, META_FIELDS, type Query, type QueryValue, type Scalar } from "./query.ts";

/** The longest regular expression a query may hold (FR-025). */
export const MAX_REGEX = 256;
/** The most prefixes a plan lists before it lists their parent instead. */
export const MAX_PREFIXES = 256;

/** A plan as data (FR-022): what `explain` gives. */
export type Plan = {
  /** What the query reads: `entry <name>` or `root <folder>`. */
  readonly from: string;
  /** The folders the walk begins at, each `""` or ending with `/`. */
  readonly prefixes: readonly string[];
  /** A range on the names of one depth: listed after one name and, where names have one length, stopped after another. */
  readonly ranges: readonly { readonly depth: number; readonly field: string; readonly after?: string; readonly stop?: string }[];
  /** The fields by which a folder is left unlisted where no file below it can satisfy the `where`. */
  readonly pruned: readonly string[];
  /** The tests run on each file listed. */
  readonly filters: readonly string[];
  /** Whether the walk reads everything under where it begins (FR-023). */
  readonly everything: boolean;
  /** Rows in key order, or in no order promised. */
  readonly order: "key" | "none";
  /** At most this many rows. */
  readonly limit: number | undefined;
};

/** Why a query cannot run. */
export type QueryError =
  | { readonly kind: "unknown-field"; readonly field: string }
  | { readonly kind: "bad-value"; readonly field: string; readonly why: string }
  | { readonly kind: "regex-not-allowed"; readonly pattern: string }
  | { readonly kind: "needs-scan"; readonly plan: Plan };

/** Says a query error in one sentence. */
export function formatQueryError(e: QueryError): string {
  switch (e.kind) {
    case "unknown-field":
      return `there is no field ${e.field}`;
    case "bad-value":
      return `${e.field}: ${e.why}`;
    case "regex-not-allowed":
      return `regex ${JSON.stringify(e.pattern)} is not allowed unless the query's with allows regex`;
    case "needs-scan":
      return `the query reads everything under ${e.plan.prefixes.join(", ") || "the root"}; say scan to allow it`;
  }
}

/** A compiled query: its plan, and the function that runs it on a store. */
export interface Compiled<R> {
  /** The plan. */
  readonly plan: Plan;
  /** The rows of the query in a store, as they are found. */
  run<C extends Capability>(store: Store<C>): AsyncIterable<Result<R, StoreError>>;
}

type Row = Readonly<Record<string, unknown>>;
type Pred3 = (row: Row) => boolean | undefined;

const timeOf = (v: unknown): number | undefined =>
  v instanceof Date
    ? v.getTime()
    : typeof v === "string"
      ? Number.isNaN(Date.parse(v))
        ? undefined
        : Date.parse(v)
      : typeof v === "number"
        ? v
        : undefined;

function order(a: unknown, b: Scalar): number | undefined {
  if (a === null || a === undefined || b === null) return undefined;
  if (a instanceof Date) {
    const t = timeOf(b);
    return t === undefined ? undefined : Math.sign(a.getTime() - t);
  }
  if (typeof a === "number" && typeof b === "number") return Math.sign(a - b);
  if (typeof a === "string" && typeof b === "string") return compareKeys(a, b);
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;
  return undefined;
}

function holds(op: Comparison, a: unknown, b: Scalar): boolean {
  if (op === "=" && (a === null || b === null)) return a === b;
  if (op === "<>" && (a === null || b === null)) return a !== b;
  const c = order(a, b);
  if (c === undefined) return false;
  switch (op) {
    case "=":
      return c === 0;
    case "<>":
      return c !== 0;
    case "<":
      return c < 0;
    case "<=":
      return c <= 0;
    case ">":
      return c > 0;
    case ">=":
      return c >= 0;
    default:
      return absurd(op);
  }
}

type Compiler = { readonly globs: Map<string, Glob>; readonly regexes: Map<string, RegExp>; readonly now: () => number };

/** The test of a `where` as a closure (FR-024): made once, run on every row. */
function predicate(e: Expr, c: Compiler): Pred3 {
  switch (e.kind) {
    case "true":
      return () => true;
    case "and": {
      const items = e.items.map((i) => predicate(i, c));
      return (row) => {
        let unknown = false;
        for (const p of items) {
          const v = p(row);
          if (v === false) return false;
          if (v === undefined) unknown = true;
        }
        return unknown ? undefined : true;
      };
    }
    case "or": {
      const items = e.items.map((i) => predicate(i, c));
      return (row) => {
        let unknown = false;
        for (const p of items) {
          const v = p(row);
          if (v === true) return true;
          if (v === undefined) unknown = true;
        }
        return unknown ? undefined : false;
      };
    }
    case "not": {
      const item = predicate(e.item, c);
      return (row) => {
        const v = item(row);
        return v === undefined ? undefined : !v;
      };
    }
    case "compare": {
      const { field, op, value } = e;
      return (row) => (field in row ? holds(op, row[field], value) : undefined);
    }
    case "in": {
      const { field, values } = e;
      return (row) => (field in row ? values.some((v) => holds("=", row[field], v)) : undefined);
    }
    case "between": {
      const { field, low, high } = e;
      return (row) => (field in row ? holds(">=", row[field], low) && holds("<=", row[field], high) : undefined);
    }
    case "glob": {
      const g = c.globs.get(e.pattern);
      const { field } = e;
      return (row) => {
        if (!(field in row)) return undefined;
        const v = row[field];
        return typeof v === "string" && g !== undefined && g.matches(v);
      };
    }
    case "regex": {
      const r = c.regexes.get(e.pattern);
      const { field } = e;
      return (row) => {
        if (!(field in row)) return undefined;
        const v = row[field];
        return typeof v === "string" && r !== undefined && r.test(v);
      };
    }
    case "within": {
      const { field, ms } = e;
      return (row) => {
        if (!(field in row)) return undefined;
        const t = timeOf(row[field]);
        return t !== undefined && c.now() - t <= ms;
      };
    }
    default:
      return absurd(e);
  }
}

/** The terms of a `where` that must all hold: the items of a top-level `and`, or the `where` itself. */
const conjuncts = (e: Expr): readonly Expr[] => (e.kind === "and" ? e.items.flatMap(conjuncts) : e.kind === "true" ? [] : [e]);

/** The fields an expression reads. */
function fieldsOf(e: Expr): string[] {
  switch (e.kind) {
    case "true":
      return [];
    case "and":
    case "or":
      return e.items.flatMap(fieldsOf);
    case "not":
      return fieldsOf(e.item);
    case "compare":
    case "in":
    case "between":
    case "glob":
    case "regex":
    case "within":
      return [e.field];
    default:
      return absurd(e);
  }
}

function describe(e: Expr): string {
  switch (e.kind) {
    case "true":
      return "true";
    case "and":
      return e.items.map(describe).join(" and ");
    case "or":
      return `(${e.items.map(describe).join(" or ")})`;
    case "not":
      return `not ${describe(e.item)}`;
    case "compare":
      return `${e.field} ${e.op} ${JSON.stringify(e.value)}`;
    case "in":
      return `${e.field} in (${e.values.map((v) => JSON.stringify(v)).join(", ")})`;
    case "between":
      return `${e.field} between ${JSON.stringify(e.low)} and ${JSON.stringify(e.high)}`;
    case "glob":
      return `${e.field} glob ${JSON.stringify(e.pattern)}`;
    case "regex":
      return `${e.field} regex ${JSON.stringify(e.pattern)}`;
    case "within":
      return `${e.field} within ${e.ms}ms`;
    default:
      return absurd(e);
  }
}

/** The values a field may take by the terms that must hold, where they are few: `=` and `in`. */
function boundValues(terms: readonly Expr[], field: string): readonly Scalar[] | undefined {
  let out: Scalar[] | undefined;
  for (const t of terms) {
    const vs =
      t.kind === "compare" && t.op === "=" && t.field === field
        ? [t.value]
        : t.kind === "in" && t.field === field
          ? [...t.values]
          : undefined;
    if (vs === undefined) continue;
    out = out === undefined ? vs : out.filter((v) => vs.includes(v));
  }
  return out;
}

/** The lowest and highest values a field may take by the terms that must hold. */
function boundRange(terms: readonly Expr[], field: string): { low?: Scalar; high?: Scalar } {
  let low: Scalar | undefined;
  let high: Scalar | undefined;
  for (const t of terms) {
    if (t.kind === "between" && t.field === field) {
      low = t.low;
      high = t.high;
    } else if (t.kind === "compare" && t.field === field) {
      if (t.op === ">" || t.op === ">=") low = t.value;
      if (t.op === "<" || t.op === "<=") high = t.value;
    }
  }
  return { ...(low === undefined ? {} : { low }), ...(high === undefined ? {} : { high }) };
}

/** The text just below `text` in code-point order, so that a listing after it begins at `text`. */
function before(text: string): string {
  const cps = [...text];
  const last = cps.pop();
  if (last === undefined) return "";
  const c = last.codePointAt(0) ?? 0;
  return c === 0 ? cps.join("") : cps.join("") + String.fromCodePoint(c - 1) + "\u{10FFFF}";
}

/** The text of one name of a pattern for bound values, or `undefined` where one of its segments is not bound. */
function nameText(parts: readonly Part[], values: ReadonlyMap<string, unknown>, all: readonly AnySegment[]): string | undefined {
  let out = "";
  for (const p of parts) {
    if (p.kind === "text") {
      out += p.text;
      continue;
    }
    const s = p.segment;
    const role = s.role;
    switch (role.kind) {
      case "rest":
        return undefined;
      case "fanout": {
        const of = all.find((o) => o.name === role.of);
        if (of === undefined || !values.has(of.name)) return undefined;
        const t = of.format(values.get(of.name));
        if (t.kind === "err") return undefined;
        out += t.value.slice(0, role.chars);
        break;
      }
      case "plain": {
        if (!values.has(s.name)) return undefined;
        const t = s.format(values.get(s.name));
        if (t.kind === "err") return undefined;
        out += t.value;
        break;
      }
      default:
        return absurd(role);
    }
  }
  return out;
}

type Walk = {
  readonly prefixes: readonly string[];
  readonly ranges: Plan["ranges"];
  readonly pruned: readonly string[];
  readonly everything: boolean;
};

/** The prefixes, ranges and pruning of a query of an entry (FR-022). */
function planEntry(pattern: Pattern<unknown>, terms: readonly Expr[]): Walk {
  const segments = pattern.segments;
  const names = pattern.names;
  const isRest = (parts: readonly Part[]): boolean =>
    parts.length === 1 && parts[0]?.kind === "segment" && parts[0].segment.role.kind === "rest";
  let prefixes: string[] = [""];
  let depth = 0;
  for (; depth < names.length - 1; depth++) {
    const parts = names[depth] ?? [];
    if (isRest(parts)) break;
    const segs = parts.flatMap((p) => (p.kind === "segment" && !p.segment.derived ? [p.segment] : []));
    const choices = segs.map((s) => [s.name, boundValues(terms, s.name)] as const);
    if (choices.some(([, vs]) => vs === undefined)) break;
    let combos: Map<string, unknown>[] = [new Map()];
    for (const [n, vs] of choices) combos = combos.flatMap((m) => (vs ?? []).map((v) => new Map([...m, [n, v]])));
    const texts = combos.map((m) => nameText(parts, m, segments));
    if (texts.some((t) => t === undefined) || prefixes.length * texts.length > MAX_PREFIXES) break;
    prefixes = prefixes.flatMap((p) => texts.map((t) => `${p}${t ?? ""}/`));
  }
  const ranges: { depth: number; field: string; after?: string; stop?: string }[] = [];
  const parts = names[depth] ?? [];
  const only = parts.length === 1 && parts[0]?.kind === "segment" ? parts[0].segment : undefined;
  if (only !== undefined && only.ordered && only.role.kind === "plain") {
    const { low, high } = boundRange(terms, only.name);
    const lowText = low === undefined ? undefined : only.format(low);
    const highText = high === undefined ? undefined : only.format(high);
    const after = lowText?.kind === "ok" ? before(lowText.value) : undefined;
    const stop = highText?.kind === "ok" && !only.variable ? highText.value : undefined;
    if (after !== undefined || stop !== undefined)
      ranges.push({ depth, field: only.name, ...(after === undefined ? {} : { after }), ...(stop === undefined ? {} : { stop }) });
  }
  const keyFields = new Set(segments.filter((s) => !s.derived).map((s) => s.name));
  const pruned = [...new Set(terms.flatMap(fieldsOf).filter((f) => keyFields.has(f)))];
  return { prefixes, ranges, pruned, everything: pruned.length === 0 };
}

/** The prefixes and pruning of a query of a tree with no layout. */
function planTree(root: string, terms: readonly Expr[]): Walk {
  const base = root === "" ? "" : `${root}/`;
  const globs = terms.flatMap((t) => (t.kind === "glob" && t.field === "path" ? [literalPrefix(t.pattern)] : []));
  const longest = globs.sort((a, b) => b.length - a.length)[0] ?? "";
  const start = longest.startsWith(base) ? longest : base;
  const depthBound = terms.some(
    (t) =>
      (t.kind === "compare" && t.field === "depth" && (t.op === "<" || t.op === "<=" || t.op === "=")) ||
      (t.kind === "between" && t.field === "depth"),
  );
  const pruned = depthBound ? ["depth"] : [];
  return { prefixes: [start], ranges: [], pruned, everything: start === base && !depthBound };
}

/** The deepest a tree query reads, by its terms on `depth`. */
function maxDepth(terms: readonly Expr[]): number {
  let most = Number.POSITIVE_INFINITY;
  for (const t of terms) {
    if (t.kind === "compare" && t.field === "depth" && typeof t.value === "number") {
      if (t.op === "<") most = Math.min(most, t.value - 1);
      if (t.op === "<=" || t.op === "=") most = Math.min(most, t.value);
    }
    if (t.kind === "between" && t.field === "depth" && typeof t.high === "number") most = Math.min(most, t.high);
  }
  return most;
}

function checkFields(e: Expr, known: ReadonlySet<string>): Result<void, QueryError> {
  for (const f of fieldsOf(e)) if (!known.has(f)) return err({ kind: "unknown-field", field: f });
  return ok(undefined);
}

function prepare(e: Expr, allowRegex: boolean, c: Compiler): Result<void, QueryError> {
  switch (e.kind) {
    case "true":
    case "compare":
    case "in":
    case "between":
      return ok(undefined);
    case "and":
    case "or":
      for (const i of e.items) {
        const r = prepare(i, allowRegex, c);
        if (r.kind === "err") return r;
      }
      return ok(undefined);
    case "not":
      return prepare(e.item, allowRegex, c);
    case "glob": {
      const g = glob(e.pattern);
      if (g.kind === "err") return err({ kind: "bad-value", field: e.field, why: g.error });
      c.globs.set(e.pattern, g.value);
      return ok(undefined);
    }
    case "regex": {
      if (!allowRegex) return err({ kind: "regex-not-allowed", pattern: e.pattern });
      if (e.pattern.length > MAX_REGEX)
        return err({ kind: "bad-value", field: e.field, why: `a regular expression longer than ${MAX_REGEX} characters` });
      try {
        c.regexes.set(e.pattern, new RegExp(e.pattern, "u"));
        return ok(undefined);
      } catch (thrown) {
        return err({ kind: "bad-value", field: e.field, why: thrown instanceof Error ? thrown.message : "not a regular expression" });
      }
    }
    case "within":
      return Number.isFinite(e.ms) ? ok(undefined) : err({ kind: "bad-value", field: e.field, why: "not a duration" });
    default:
      return absurd(e);
  }
}

const nameOf = (p: string): string => p.slice(p.lastIndexOf("/") + 1);
const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1);
};

/**
 * Plans a query and compiles it into a function, or says why it cannot run: a field there is not, a value that is not one, a regular
 * expression `with` does not allow, or a walk of everything that does not say `scan` (FR-022 to FR-025).
 *
 * @param query - the query
 * @param options - the clock `within` measures from
 */
export function compile<R>(query: Query<R>, options: { readonly now?: () => number } = {}): Result<Compiled<R>, QueryError> {
  const q: QueryValue = query.value;
  const c: Compiler = { globs: new Map(), regexes: new Map(), now: options.now ?? (() => Date.now()) };
  const entry: Entry<string, object, unknown> | undefined = q.from.kind === "entry" ? q.from.entry : undefined;
  const keyFields = entry === undefined ? [] : entry.pattern.segments.filter((s) => !s.derived).map((s) => s.name);
  const known = new Set<string>([...keyFields, ...META_FIELDS, ...(entry === undefined ? ["type"] : [])]);
  const fieldCheck = checkFields(q.where, known);
  if (fieldCheck.kind === "err") return fieldCheck;
  if (q.select !== "*") for (const f of q.select) if (!known.has(f)) return err({ kind: "unknown-field", field: f });
  const prepared = prepare(q.where, q.with.regex, c);
  if (prepared.kind === "err") return prepared;
  const terms = conjuncts(q.where);
  const walk = entry === undefined ? planTree(q.from.kind === "root" ? q.from.root : "", terms) : planEntry(entry.pattern, terms);
  const plan: Plan = {
    from: q.from.kind === "entry" ? `entry ${q.from.entry.name}` : `root ${q.from.root === "" ? "." : q.from.root}`,
    prefixes: walk.prefixes,
    ranges: walk.ranges,
    pruned: walk.pruned,
    filters: terms.map(describe),
    everything: walk.everything,
    order: q.orderByKey ? "key" : "none",
    limit: q.limit,
  };
  if (plan.everything && !q.scan) return err({ kind: "needs-scan", plan });
  const test = predicate(q.where, c);
  const pick = (row: Row): R => {
    const chosen = q.select === "*" ? row : Object.fromEntries(q.select.map((f) => [f, row[f]]));
    // a row holds every field its query's type names: the key its entry's pattern read, and the metadata written above
    return Object.freeze(chosen) as R;
  };
  const rootBase = q.from.kind === "root" && q.from.root !== "" ? `${q.from.root}/` : "";
  const deepest = entry === undefined ? maxDepth(terms) : Number.POSITIVE_INFINITY;
  const isRest = (parts: readonly Part[] | undefined): boolean =>
    parts !== undefined && parts.length === 1 && parts[0]?.kind === "segment" && parts[0].segment.role.kind === "rest";

  /** The key fields a folder fixes, or `undefined` where no file of the entry can be below it. */
  const folderKey = (folder: string): Row | undefined => {
    if (entry === undefined) return {};
    const names = folder.slice(0, -1).split("/");
    const pattern = entry.pattern;
    const values: Record<string, unknown> = {};
    for (const [i, name] of names.entries()) {
      const parts = pattern.names[i];
      if (parts === undefined) return undefined;
      if (isRest(parts)) return values;
      if (i === pattern.names.length - 1) return undefined;
      const re = new RegExp(
        `^${parts.map((p) => (p.kind === "text" ? p.text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") : `(${p.segment.source})`)).join("")}$`,
        "u",
      );
      const m = re.exec(name);
      if (m === null) return undefined;
      let g = 1;
      for (const p of parts) {
        if (p.kind === "text") continue;
        const r = p.segment.parse(m[g++] ?? "");
        if (r.kind === "err") return undefined;
        if (!p.segment.derived) values[p.segment.name] = r.value;
      }
    }
    return values;
  };

  const rowOf = (meta: FileMeta | { readonly path: string; readonly folder: true }, key: Row): Row => {
    const p = meta.path;
    const below = p.slice(rootBase.length);
    const name = nameOf(p);
    const isFolder = "folder" in meta;
    return {
      ...key,
      path: p,
      name,
      extension: isFolder ? "" : extensionOf(name),
      size: isFolder ? 0 : meta.size,
      modified: isFolder ? null : meta.modified,
      version: isFolder ? "" : meta.version,
      depth: below.split("/").length,
      hidden: below.split("/").some((n) => n.startsWith(".")),
      ...(entry === undefined ? { type: isFolder ? "folder" : "file" } : {}),
    };
  };

  type Visit = { readonly rows: Row[]; readonly folders: string[] };

  const run = <C extends Capability>(store: Store<C>): AsyncIterable<Result<R, StoreError>> => {
    const readIgnore = async (folder: string): Promise<IgnoreFile[]> => {
      const out: IgnoreFile[] = [];
      for (const n of IGNORE_FILES) {
        const p = relPath(`${folder}${n}`);
        if (p.kind === "err") continue;
        const got = await store.get(p.value);
        if (got.kind === "ok") out.push(parseIgnore(new TextDecoder().decode(got.value), folder));
      }
      return out;
    };

    const visit = async (
      folder: string,
      rules: readonly IgnoreFile[],
    ): Promise<Result<Visit & { readonly rules: readonly IgnoreFile[] }, StoreError>> => {
      const range = plan.ranges.find((r) => r.depth === (folder === "" ? 0 : folder.split("/").length - 1));
      const items: ListItem[] = [];
      let continuation: string | undefined;
      let stopped = false;
      do {
        const page = await store.list({
          prefix: folder,
          delimiter: "/",
          ...(range?.after === undefined ? {} : { after: `${folder}${range.after}` }),
          ...(continuation === undefined ? {} : { continuation }),
        });
        if (page.kind === "err") return page;
        for (const f of page.value.folders) items.push({ kind: "folder", prefix: f });
        for (const f of page.value.files) items.push({ kind: "file", meta: f });
        continuation = page.value.continuation;
        if (range?.stop !== undefined) {
          const beyond = (k: string): boolean => compareKeys(k.slice(folder.length).split("/")[0] ?? "", range.stop ?? "") > 0;
          const keys = [...page.value.folders, ...page.value.files.map((f) => f.path)];
          if (keys.some(beyond)) stopped = true;
        }
      } while (continuation !== undefined && !stopped);
      const here =
        q.with.ignore && items.some((i) => i.kind === "file" && (IGNORE_FILES as readonly string[]).includes(nameOf(i.meta.path)))
          ? [...rules, ...(await readIgnore(folder))]
          : rules;
      const rows: Row[] = [];
      const folders: string[] = [];
      const key = (i: ListItem): string => (i.kind === "file" ? i.meta.path : i.prefix);
      for (const i of items.sort((a, b) => compareKeys(key(a), key(b)))) {
        const p = i.kind === "file" ? i.meta.path : i.prefix.slice(0, -1);
        const name = nameOf(p);
        if (range?.stop !== undefined && compareKeys(p.slice(folder.length).split("/")[0] ?? "", range.stop) > 0) continue;
        if (!q.with.hidden && name.startsWith(".")) continue;
        if (q.with.ignore && i.kind === "folder" && name === ".git") continue;
        if (q.with.ignore && ignored(here, p, i.kind === "folder")) continue;
        if (i.kind === "folder") {
          if (entry === undefined) {
            const row = rowOf({ path: p, folder: true }, {});
            if (test(row) === true) rows.push(row);
            if (Number(row["depth"]) < deepest) folders.push(i.prefix);
            continue;
          }
          const partial = folderKey(i.prefix);
          if (partial === undefined || test(partial) === false) continue;
          folders.push(i.prefix);
          continue;
        }
        if (entry === undefined) {
          const row = rowOf(i.meta, {});
          if (test(row) === true) rows.push(row);
          continue;
        }
        const k = entry.pattern.parse(i.meta.path);
        if (k.kind === "err") continue;
        const row = rowOf(i.meta, { ...k.value });
        if (test(row) === true) rows.push(row);
      }
      return ok({ rows, folders, rules: here });
    };

    /** One folder and everything below it, in key order: its rows and its folders interleaved as their keys sort. */
    async function* depthFirst(folder: string, rules: readonly IgnoreFile[]): AsyncIterable<Result<Row, StoreError>> {
      const v = await visit(folder, rules);
      if (v.kind === "err") {
        yield v;
        return;
      }
      const items = [
        ...v.value.rows.map((row) => ({ key: String(row["path"]), row, folder: undefined })),
        ...v.value.folders.map((f) => ({ key: f, row: undefined, folder: f })),
      ].sort((a, b) => compareKeys(a.key, b.key));
      for (const it of items) {
        if (it.row !== undefined) yield ok(it.row);
        else if (it.folder !== undefined) {
          for await (const r of depthFirst(it.folder, v.value.rules)) {
            yield r;
            if (r.kind === "err") return;
          }
        }
      }
    }

    async function* ordered(): AsyncIterable<Result<R, StoreError>> {
      let given = 0;
      for (const p of [...plan.prefixes].sort(compareKeys)) {
        for await (const r of depthFirst(p, q.with.ignore ? await ancestors(p) : [])) {
          if (r.kind === "err") {
            yield r;
            return;
          }
          yield ok(pick(r.value));
          if (++given === q.limit) return;
        }
      }
    }

    async function* unordered(): AsyncIterable<Result<R, StoreError>> {
      let given = 0;
      const queue: { folder: string; rules: readonly IgnoreFile[] }[] = [];
      for (const p of plan.prefixes) queue.push({ folder: p, rules: q.with.ignore ? await ancestors(p) : [] });
      const running = new Map<number, Promise<{ id: number; r: Awaited<ReturnType<typeof visit>> }>>();
      let ids = 0;
      const width = Math.max(1, q.with.parallel);
      while (queue.length > 0 || running.size > 0) {
        while (running.size < width && queue.length > 0) {
          const job = queue.shift();
          if (job === undefined) break;
          const id = ids++;
          running.set(
            id,
            visit(job.folder, job.rules).then((r) => ({ id, r })),
          );
        }
        const { id, r } = await Promise.race(running.values());
        running.delete(id);
        if (r.kind === "err") {
          yield r;
          return;
        }
        for (const row of r.value.rows) {
          yield ok(pick(row));
          if (++given === q.limit) return;
        }
        for (const f of r.value.folders) queue.push({ folder: f, rules: r.value.rules });
      }
    }

    const ancestors = async (prefix: string): Promise<IgnoreFile[]> => {
      const out: IgnoreFile[] = [];
      const exclude = relPath(".git/info/exclude");
      if (exclude.kind === "ok") {
        const got = await store.get(exclude.value);
        if (got.kind === "ok") out.push(parseIgnore(new TextDecoder().decode(got.value), ""));
      }
      const names = prefix === "" ? [] : prefix.slice(0, -1).split("/");
      for (let i = 0; i < names.length; i++) out.push(...(await readIgnore(i === 0 ? "" : `${names.slice(0, i).join("/")}/`)));
      return out;
    };

    return q.orderByKey ? ordered() : unordered();
  };

  return ok({ plan, run });
}

/**
 * The plan of a query, as data (FR-022).
 *
 * @param query - the query
 */
export function explain<R>(query: Query<R>): Result<Plan, QueryError> {
  const scanning: Query<R> = { value: { ...query.value, scan: true } };
  const c = compile(scanning);
  return c.kind === "ok" ? ok({ ...c.value.plan }) : c;
}
