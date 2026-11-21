/**
 * Profiles (commons lang-sql 0010-aide FR-002): a subset of the language, as data. A little language made of SQL says which statements, nodes, functions and tables it has and how large a statement may be, and {@link conform} gives every
 * violation of a parse with the span of its node and one sentence, so that a language of one table and no joins is a value and not a grammar.
 *
 * @example
 * ```ts
 * const files = defineProfile({ name: "files", statements: ["select"], forbidNodes: ["join", "subquery"], tables: ["files"], functions: ["lower"], maxDepth: 40 });
 * conform(parse("SELECT name FROM files", ansi), files); // ok
 * ```
 *
 * Spec: 0010-aide FR-001, FR-002
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { children, describeParseError, type Kind, type Node, type Parsed, spanOf, type Statement } from "../../mod.ts";

/** A subset of the language. */
export interface Profile {
  readonly name: string;
  /** The kinds of statement that are allowed. */
  readonly statements: readonly Statement["kind"][];
  /** The kinds of node that are not. */
  readonly forbidNodes: readonly Kind[];
  /** The functions that may be called, without regard to case; any where not given. */
  readonly functions: readonly string[] | undefined;
  /** The tables that may be read, without regard to case; any where not given. */
  readonly tables: readonly string[] | undefined;
  readonly maxDepth: number | undefined;
  readonly maxNodes: number | undefined;
  readonly maxTables: number | undefined;
  /** The functions that may not be called, without regard to case or to a schema before the name. */
  readonly deniedFunctions: readonly string[];
  /** The most statements a text may hold; any where not given. */
  readonly maxStatements: number | undefined;
}

/** What a profile is made from. */
export interface ProfileSpec {
  readonly name: string;
  readonly statements: readonly Statement["kind"][];
  readonly forbidNodes?: readonly Kind[];
  readonly functions?: readonly string[];
  readonly tables?: readonly string[];
  readonly maxDepth?: number;
  readonly maxNodes?: number;
  readonly maxTables?: number;
  readonly deniedFunctions?: readonly string[];
  readonly maxStatements?: number;
}

/** What a parse does that its profile does not allow. */
export interface Violation {
  readonly start: number;
  readonly end: number;
  readonly message: string;
}

/** A profile from its parts. */
export function defineProfile(spec: ProfileSpec): Profile {
  return {
    name: spec.name,
    statements: spec.statements,
    forbidNodes: spec.forbidNodes ?? [],
    functions: spec.functions,
    tables: spec.tables,
    maxDepth: spec.maxDepth,
    maxNodes: spec.maxNodes,
    maxTables: spec.maxTables,
    deniedFunctions: spec.deniedFunctions ?? [],
    maxStatements: spec.maxStatements,
  };
}

const lc = (s: string): string => s.toLowerCase();

/** The parse where it is inside the profile; every violation, with its span, where it is not. */
export function conform(parsed: Parsed, profile: Profile): Result<Parsed, readonly Violation[]> {
  const out: Violation[] = [];
  for (const e of parsed.errors) {
    const s = spanOf(e);
    out.push({ start: s.start, end: s.end, message: describeParseError(e) });
  }
  const forbid = new Set<string>(profile.forbidNodes);
  const allowedStatements = new Set<string>(profile.statements);
  const functions = profile.functions === undefined ? undefined : new Set(profile.functions.map(lc));
  const denied = new Set(profile.deniedFunctions.map(lc));
  const tables = profile.tables === undefined ? undefined : new Set(profile.tables.map(lc));
  let nodes = 0;
  let tableUses = 0;
  let deepest = 0;
  /** The names of common table expressions that a child of a node sees: a later one sees the earlier ones (and its own where the `WITH` is recursive), the body sees all of them. */
  const scopeFor = (n: Node, c: Node, scope: ReadonlySet<string>): ReadonlySet<string> => {
    if (n.kind !== "with") return scope;
    const names = n.ctes.map((x) => lc(x.name.name));
    const at = n.ctes.findIndex((x) => x === c);
    if (at < 0) return c === n.body ? new Set([...scope, ...names]) : scope;
    return new Set([...scope, ...names.slice(0, n.recursive ? at + 1 : at)]);
  };
  const visit = (n: Node, depth: number, scope: ReadonlySet<string>): void => {
    nodes++;
    if (depth > deepest) deepest = depth;
    if (forbid.has(n.kind)) out.push({ start: n.start, end: n.end, message: `${n.kind} is not in the language ${profile.name}` });
    if (n.kind === "call") {
      const name = n.name.parts.map((p) => p.name).join(".");
      const bare = lc(n.name.parts[n.name.parts.length - 1]?.name ?? "");
      if (denied.has(bare)) out.push({ start: n.start, end: n.end, message: `the function ${name} is denied in the language ${profile.name}` });
      else if (functions !== undefined && !functions.has(lc(name))) out.push({ start: n.start, end: n.end, message: `the function ${name} is not in the language ${profile.name}` });
    }
    if (n.kind === "table") {
      tableUses++;
      const name = n.name.parts.map((p) => p.name).join(".");
      if (tables !== undefined && !tables.has(lc(name)) && !(n.name.parts.length === 1 && scope.has(lc(name)))) out.push({ start: n.name.start, end: n.name.end, message: `the table ${name} is not in the language ${profile.name}` });
    }
    for (const c of children(n)) visit(c, depth + 1, scopeFor(n, c, scope));
  };
  if (profile.maxStatements !== undefined && parsed.script.statements.length > profile.maxStatements)
    out.push({ start: 0, end: parsed.text.length, message: `the text has ${parsed.script.statements.length} statements, and the language ${profile.name} allows ${profile.maxStatements}` });
  for (const s of parsed.script.statements) {
    if (s.kind === "unparsed") continue;
    if (!allowedStatements.has(s.kind)) out.push({ start: s.start, end: s.end, message: `a ${s.kind} statement is not in the language ${profile.name}` });
    visit(s, 0, new Set());
  }
  const whole = { start: 0, end: parsed.text.length };
  if (profile.maxDepth !== undefined && deepest > profile.maxDepth) out.push({ ...whole, message: `the statement is nested ${deepest} deep, and the language ${profile.name} allows ${profile.maxDepth}` });
  if (profile.maxNodes !== undefined && nodes > profile.maxNodes) out.push({ ...whole, message: `the statement has ${nodes} nodes, and the language ${profile.name} allows ${profile.maxNodes}` });
  if (profile.maxTables !== undefined && tableUses > profile.maxTables) out.push({ ...whole, message: `the statement reads ${tableUses} tables, and the language ${profile.name} allows ${profile.maxTables}` });
  return out.length === 0 ? ok(parsed) : err(out);
}
