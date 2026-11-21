// Spec: 0003-query-planning FR-001, FR-002
/**
 * What a filter shows before anything is listed (commons anyfs-query 0003-query-planning FR-001, FR-002): each conjunct of the `WHERE` is of the listing (it needs only what a listing says) or of the
 * content (it needs a read of the object), and the conjuncts on `path` that are an equality, a `GLOB` or a call of `under` say where the objects can be: one path, or below a prefix, or nowhere.
 * `LIKE` is not used, because it ignores case and a prefix does not.
 *
 * @module
 */
import { type Expr, type Node, children } from "@intellectual-frontiers/lang-sql";
import { conjuncts } from "@intellectual-frontiers/lang-sql/aide/normalize";
import { type Path, type Prefix, parsePath, parsePrefix } from "@intellectual-frontiers/anyfs/governance";
import { READ_COLUMNS } from "@intellectual-frontiers/anyfs-query/governance";

/** Where the objects a filter can match are. */
export type Bound =
  | { readonly kind: "anywhere" }
  | { readonly kind: "nowhere"; readonly why: string }
  | { readonly kind: "below"; readonly prefix: Prefix; readonly rules: readonly string[] }
  | { readonly kind: "exact"; readonly path: Path; readonly rules: readonly string[] };

/** A filter divided by what it needs. */
export type Classified = {
  /** The conjuncts that need only a listing. */
  readonly listing: readonly Expr[];
  /** The conjuncts that need a read. */
  readonly content: readonly Expr[];
  readonly bound: Bound;
};

/** The names a node uses as columns: a call's name is not one. */
export function columnsIn(n: Node): ReadonlySet<string> {
  const out = new Set<string>();
  const go = (x: Node): void => {
    if (x.kind === "name") {
      const last = x.parts[x.parts.length - 1];
      if (last !== undefined) out.add(last.name.toLowerCase());
      return;
    }
    if (x.kind === "call") {
      for (const a of x.args) go(a);
      return;
    }
    for (const c of children(x)) go(c);
  };
  go(n);
  return out;
}

const isPath = (e: Expr): boolean => e.kind === "name" && e.parts[e.parts.length - 1]?.name.toLowerCase() === "path";

type Fact = { readonly kind: "exact"; readonly text: string; readonly rule: string } | { readonly kind: "below"; readonly text: string; readonly rule: string };

/** What a conjunct says of the path, or nothing. */
function factOf(c: Expr): Fact | undefined {
  if (c.kind === "binary" && c.op === "=") {
    if (isPath(c.left) && c.right.kind === "string") return { kind: "exact", text: c.right.value, rule: `path = '${c.right.value}'` };
    if (isPath(c.right) && c.left.kind === "string") return { kind: "exact", text: c.left.value, rule: `path = '${c.left.value}'` };
  }
  if (c.kind === "like" && !c.negated && c.escape === undefined && c.op.toUpperCase() === "GLOB" && isPath(c.arg) && c.pattern.kind === "string") {
    const pattern = c.pattern.value;
    const wild = /[*?[]/.exec(pattern);
    if (wild === null) return { kind: "exact", text: pattern, rule: `path GLOB '${pattern}'` };
    const literal = pattern.slice(0, wild.index);
    const slash = literal.lastIndexOf("/");
    return { kind: "below", text: slash < 0 ? "" : literal.slice(0, slash), rule: `path GLOB '${pattern}'` };
  }
  if (c.kind === "call" && c.name.parts.length === 1 && c.name.parts[0]?.name.toLowerCase() === "under" && c.args.length === 2) {
    const [a, b] = c.args;
    if (a !== undefined && b !== undefined && a.kind !== "named-arg" && a.kind !== "keyword-arg" && b.kind === "string" && isPath(a)) return { kind: "below", text: b.value.replace(/\/+$/, ""), rule: `under(path, '${b.value}')` };
  }
  return undefined;
}

const isUnder = (prefix: string, text: string): boolean => prefix === "" || text === prefix || text.startsWith(`${prefix}/`);

/** The bound the facts of a filter give: the one path, the deepest prefix, or nowhere where the facts cannot all be true. */
export function boundOf(facts: readonly Fact[]): Bound {
  if (facts.length === 0) return { kind: "anywhere" };
  const exacts = [...new Set(facts.filter((f) => f.kind === "exact").map((f) => f.text))];
  const belows = facts.filter((f) => f.kind === "below");
  const rules = facts.map((f) => f.rule);
  if (exacts.length > 1) return { kind: "nowhere", why: "two different paths are asked for at once" };
  const exact = exacts[0];
  if (exact !== undefined) {
    const stray = belows.find((b) => !isUnder(b.text, exact));
    if (stray !== undefined) return { kind: "nowhere", why: `${exact} is not below ${stray.text}` };
    const p = parsePath(exact);
    return p.kind === "ok" ? { kind: "exact", path: p.value, rules } : { kind: "anywhere" };
  }
  const deepest = belows.reduce((a, b) => (b.text.length > a.text.length ? b : a));
  const stray = belows.find((b) => !isUnder(b.text, deepest.text));
  if (stray !== undefined) return { kind: "nowhere", why: `${deepest.text} is not below ${stray.text}` };
  const p = parsePrefix(deepest.text);
  return p.kind === "ok" ? { kind: "below", prefix: p.value, rules } : { kind: "anywhere" };
}

/** A filter divided into what a listing answers and what a read answers, and the bound it gives. */
export function classify(predicate: Expr | undefined): Classified {
  if (predicate === undefined) return { listing: [], content: [], bound: { kind: "anywhere" } };
  const listing: Expr[] = [];
  const content: Expr[] = [];
  const facts: Fact[] = [];
  for (const c of conjuncts(predicate)) {
    const uses = columnsIn(c);
    if ([...uses].some((u) => READ_COLUMNS.has(u))) content.push(c);
    else {
      listing.push(c);
      const f = factOf(c);
      if (f !== undefined) facts.push(f);
    }
  }
  return { listing, content, bound: boundOf(facts) };
}
