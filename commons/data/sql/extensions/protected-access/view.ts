// Spec: 0014-sql-protected-access FR-002, FR-003, FR-004, FR-005, FR-008, FR-011
/**
 * The view of a table (commons data 0014-sql-protected-access FR-002 to FR-005, FR-008, FR-011): its name and columns, what governance says must be hidden in it, the old name of a column that was
 * renamed, its comment, the rights of the roles that read and write it and, where the engine has no updatable views, the triggers that make it writable. It is written from a plain description
 * of the table, so that it is the same whether it is made with the schema or around a step that changes the table.
 *
 * @module
 */
import { vocabularies, words } from "@intellectual-frontiers/data/governance";
import { carriedOf, type LogicalId, type LogicalSchema, sameWords } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, featureId, type Naming, type PhysicalError, qualified, type Statement } from "./deps.ts";
import type { Protection } from "./settings.ts";

const { security, lifecycle } = vocabularies;

/** A table as the view is made from it. */
export interface ViewTable {
  readonly words: readonly string[];
  /** The table's name as written, with the schema's words where the dialect has no schemas. */
  readonly name: string;
  /** The schema the table is qualified by, where the dialect has schemas. */
  readonly qualifier: string | undefined;
  readonly columns: readonly { readonly name: string; readonly words: readonly string[]; readonly type: string }[];
  /** The written names of the primary key's columns. */
  readonly primaryKey: readonly string[];
  readonly comment: string;
  /** What the statements are made from, so that the lifecycle applies them again when a step changes it. */
  readonly of: readonly LogicalId[];
}

/** What a view is made with. */
export interface ViewContext {
  readonly dialect: Dialect;
  readonly naming: Naming;
  readonly schema: LogicalSchema;
  readonly settings: Protection;
  /** Whether rights are granted: the layer is enforced. */
  readonly enforced: boolean;
}

/** The name of a view: the table's own, written without the schema's words. */
export const viewName = (t: { readonly words: readonly string[] }, naming: Naming): string => naming.names.write(t.words);

/** The reference to a view, qualified by the schema of the views where the dialect has schemas. */
export const viewRef = (t: { readonly words: readonly string[] }, c: ViewContext): string =>
  qualified(c.dialect, c.dialect.features.includes("schemas") ? c.settings.viewsSchema : undefined, viewName(t, c.naming));

const isText = (type: string): boolean => /^(TEXT|VARCHAR|CHAR|CHARACTER)/i.test(type);

/**
 * The statements that make a view, in the order they are run: it is dropped, made again, described and granted.
 *
 * @param t - the table
 * @param c - what the view is made with
 * @returns the statements, or what the dialect cannot write
 */
export function viewStatements(
  t: ViewTable,
  c: ViewContext,
): { readonly statements: readonly Statement[]; readonly errors: readonly PhysicalError[] } {
  const { dialect, naming, schema, settings } = c;
  const q = (n: string): string => dialect.quote(n);
  const errors: PhysicalError[] = [];
  const logical = schema.tables.find((x) => sameWords(x.name, t.words));
  const view = viewRef(t, c);
  const table = qualified(dialect, t.qualifier, t.name);
  const hidden = (name: string, type: string, kind: string, id: LogicalId): string | undefined => {
    const raw = q(name);
    const text = `CAST(${raw} AS TEXT)`;
    const masked =
      kind === "hash"
        ? dialect.hash?.(text)
        : kind === "partial"
          ? `substr(${text}, 1, 2) || '***'`
          : isText(type)
            ? dialect.literal("[redacted]")
            : `CAST(NULL AS ${type})`;
    if (masked === undefined) {
      errors.push({ kind: "unsupported", element: id, why: `${dialect.name} has no hash to mask ${name} with` });
      return undefined;
    }
    const tests = settings.unmaskedRoles.map((r) => dialect.hasRole?.(r)).filter((x): x is string => x !== undefined);
    if (tests.length === 0) return masked;
    return `CASE WHEN ${tests.join(" OR ")} THEN ${kind === "redact" ? raw : text} ELSE ${masked} END`;
  };
  const select: string[] = [];
  const direct: string[] = [];
  for (const col of t.columns) {
    const lc = logical?.columns.find((x) => sameWords(x.name, col.words));
    const mask = settings.masks && lc !== undefined ? carriedOf(lc, security.mask)[0] : undefined;
    let expr = q(col.name);
    if (mask !== undefined && lc !== undefined) {
      const h = hidden(col.name, col.type, mask, lc.id);
      if (h === undefined) continue;
      expr = h;
    } else direct.push(col.name);
    select.push(mask === undefined ? expr : `${expr} AS ${q(col.name)}`);
    // the name a renamed attribute had stays in the view for as long as governance says so
    const old = lc === undefined ? undefined : carriedOf(lc, lifecycle.renamedFrom)[0];
    const oldName = old === undefined ? undefined : naming.names.write(words(old));
    if (oldName !== undefined && oldName !== col.name) select.push(`${expr} AS ${q(oldName)}`);
  }
  const id = featureId("view", t.words);
  const of: readonly LogicalId[] = [...t.of, id];
  const out: Statement[] = [];
  const add = (sql: string): void => void out.push({ group: "view", sql, of });
  add(`DROP VIEW IF EXISTS ${view};`);
  add(
    `CREATE VIEW ${view}${dialect.features.includes("updatable-views") ? " WITH (security_barrier = true)" : ""} AS\nSELECT ${select.join(", ")}\n  FROM ${table};`,
  );
  if (c.enforced && settings.owner !== undefined) add(`ALTER VIEW ${view} OWNER TO ${q(settings.owner)};`);
  if (dialect.features.includes("comment-on") && t.comment.trim() !== "") add(`COMMENT ON VIEW ${view} IS ${dialect.literal(t.comment)};`);
  if (dialect.features.includes("instead-of-triggers")) {
    const vn = viewName(t, naming);
    const cols = direct.map(q).join(", ");
    const news = direct.map((n) => `NEW.${q(n)}`).join(", ");
    const key = t.primaryKey.map((k) => `${q(k)} = OLD.${q(k)}`).join(" AND ");
    add(`CREATE TRIGGER ${q(`${vn}_ins`)} INSTEAD OF INSERT ON ${q(vn)} BEGIN INSERT INTO ${table} (${cols}) VALUES (${news}); END;`);
    if (key !== "") {
      add(
        `CREATE TRIGGER ${q(`${vn}_upd`)} INSTEAD OF UPDATE ON ${q(vn)} BEGIN UPDATE ${table} SET ${direct.map((n) => `${q(n)} = NEW.${q(n)}`).join(", ")} WHERE ${key}; END;`,
      );
      add(`CREATE TRIGGER ${q(`${vn}_del`)} INSTEAD OF DELETE ON ${q(vn)} BEGIN DELETE FROM ${table} WHERE ${key}; END;`);
    }
  }
  if (c.enforced && dialect.features.includes("grants") && logical !== undefined) {
    const roles = carriedOf(logical, security.access)[0];
    if (roles !== undefined) {
      const list = (rs: readonly string[]): string => rs.map(q).join(", ");
      if (roles.read.length > 0) add(`GRANT SELECT ON ${view} TO ${list(roles.read)};`);
      if (roles.write.length > 0) add(`GRANT INSERT, UPDATE, DELETE ON ${view} TO ${list(roles.write)};`);
    }
  }
  return { statements: out, errors };
}

/** The statement that drops the view of a table, for a step to run before it changes the table. */
export const dropView = (t: { readonly words: readonly string[]; readonly of: readonly LogicalId[] }, c: ViewContext): Statement => ({
  group: "view",
  sql: `DROP VIEW IF EXISTS ${viewRef(t, c)};`,
  of: [...t.of, featureId("view", t.words)],
});
