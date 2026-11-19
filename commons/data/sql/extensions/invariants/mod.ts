// Spec: 0043-sql-invariants FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * Invariants in the database (commons data 0043-sql-invariants): what governance says must always be true of the records of a concept (they are only added, they form a chain, a status moves only
 * along the moves it may, a number never goes above another) written as triggers, so that the database refuses what breaks it for every client, including a statement typed by hand that never
 * passed through an application. A dialect that cannot say them is an error value by default, never a silent loss.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import { vocabularies, words } from "@intellectual-frontiers/data/governance";
import { carriedOf, type Column, type LogicalId, type Table } from "@intellectual-frontiers/data/sql/logical";
import { type BindContext, type Dialect, type Need, type PhysicalError, qualified, type Statement, type StatementSource, where, writeCode } from "@intellectual-frontiers/data/sql/physical";

const { quality } = vocabularies;

/** What a project says of invariants. */
export interface InvariantSettings {
  /** What to do where the dialect has no triggers: `refuse` (an error value, the default) or `carry` (no statements; the invariant is only declared). */
  readonly unsupported?: "refuse" | "carry";
}

/** One invariant of the schema. */
export interface Invariant {
  readonly table: string;
  readonly kind: "append-only" | "chain" | "transitions" | "at-most";
  /** What it holds, in words. */
  readonly says: string;
}

const column = (t: Table, member: string): Column | undefined => {
  const w = words(member).join(".");
  const exact = t.columns.find((c) => c.name.join(".") === w);
  if (exact !== undefined) return exact;
  // a code of an open list is held by the column that carries the list's name after the attribute's
  const near = t.columns.filter((c) => c.name.join(".").startsWith(`${w}.`) && c.name.join(".").endsWith(".code"));
  return near.length === 1 ? near[0] : undefined;
};

/**
 * The invariants a schema declares, where each lives and what it says.
 *
 * @param tables - the tables of the logical schema
 * @returns the invariants
 */
export function invariantsOf(tables: readonly Table[]): readonly Invariant[] {
  const out: Invariant[] = [];
  for (const t of tables) {
    const name = t.name.join(" ");
    for (const a of carriedOf(t, quality.appendOnly)) {
      out.push({ table: name, kind: "append-only", says: "records are only added" });
      if (a.chain !== undefined) out.push({ table: name, kind: "chain", says: `each record names the hash of the one before it, in sequence` });
    }
    for (const m of carriedOf(t, quality.atMost)) out.push({ table: name, kind: "at-most", says: `${m.member} is never above ${m.other}` });
    for (const c of t.columns) for (const tr of carriedOf(c, quality.transitions)) out.push({ table: name, kind: "transitions", says: `${c.name.join(" ")} moves only ${Object.entries(tr.allowed).map(([f, to]) => `${f} to ${to.join(" or ") || "nothing"}`).join("; ")}` });
  }
  return out;
}

/**
 * The statement source of a project's invariants.
 *
 * @param given - what a project says
 * @returns a statement source
 */
export function invariants(given: InvariantSettings = {}): StatementSource {
  const mode = given.unsupported ?? "refuse";
  return (context: BindContext) => {
    const { dialect, schema, written, naming } = context;
    const declared = schema.tables.filter((t) => invariantsOf([t]).length > 0);
    if (declared.length === 0) return ok([]);
    if (!dialect.features.includes("triggers")) {
      return mode === "carry"
        ? ok([])
        : err(declared.map((t): PhysicalError => ({ kind: "unsupported", element: t.id, why: `${dialect.name} has no triggers, so ${invariantsOf([t]).map((i) => i.says).join("; ")} cannot be enforced by the database` })));
    }
    const errors: PhysicalError[] = [];
    const out: Statement[] = [];
    const q = (n: string): string => dialect.quote(n);
    const lit = (s: string): string => dialect.literal(s);
    for (const t of declared) {
      const tn = written.table(t.id) ?? "";
      const ref = written.ref(t.id);
      const of: LogicalId[] = [t.id];
      const col = (m: string): string | undefined => {
        const c = column(t, m);
        if (c === undefined) {
          errors.push({ kind: "unsupported", element: t.id, why: `${tn} has no member ${m} for an invariant` });
          return undefined;
        }
        return written.column(c.id);
      };
      const postgres = dialect.name === "postgres";
      // one trigger: its function (where the dialect needs one), its name and when it fires
      const add = (what: string, timing: string, body: { when?: string; test: string; message: string }): void => {
        const fn = `inv_${tn}_${what}`.slice(0, 63);
        const message = `${tn}: ${body.message}`;
        if (postgres) {
          const fnRef = qualified(dialect, written.qualifier, fn);
          out.push({ group: "routine", of, sql: `CREATE OR REPLACE FUNCTION ${fnRef}() RETURNS trigger LANGUAGE plpgsql AS $inv$\nBEGIN\n  IF ${body.test} THEN\n    RAISE EXCEPTION ${lit(message)} USING ERRCODE = 'integrity_constraint_violation';\n  END IF;\n  RETURN NEW;\nEND\n$inv$;` });
          out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(fn)} ON ${ref};` });
          out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(fn)} ${timing} ON ${ref} FOR EACH ROW EXECUTE FUNCTION ${fnRef}();` });
        } else {
          out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(fn)};` });
          out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(fn)} ${timing} ON ${ref}${body.when === undefined ? "" : ` WHEN ${body.when}`}\nBEGIN\n  SELECT RAISE(ABORT, ${lit(message)});\nEND;` });
        }
      };
      // each test is written for the row (PostgreSQL's IF) and as a WHEN (SQLite's), from one condition
      const rule = (what: string, timing: string, condition: string, message: string, sqliteTimings: readonly string[] = [timing]): void => {
        if (postgres) add(what, timing, { test: condition, message });
        else for (const s of sqliteTimings) add(`${what}${sqliteTimings.length > 1 ? `_${s.split(" ")[1]?.toLowerCase() ?? ""}` : ""}`, s, { when: condition, test: condition, message });
      };
      for (const a of carriedOf(t, quality.appendOnly)) {
        if (postgres) {
          const fn = `inv_${tn}_append_only`.slice(0, 63);
          const fnRef = qualified(dialect, written.qualifier, fn);
          out.push({ group: "routine", of, sql: `CREATE OR REPLACE FUNCTION ${fnRef}() RETURNS trigger LANGUAGE plpgsql AS $inv$\nBEGIN\n  RAISE EXCEPTION ${lit(`${tn} is append-only: a record is never changed or removed`)} USING ERRCODE = 'integrity_constraint_violation';\nEND\n$inv$;` });
          out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(fn)} ON ${ref};` });
          out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(fn)} BEFORE UPDATE OR DELETE ON ${ref} FOR EACH ROW EXECUTE FUNCTION ${fnRef}();` });
          out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(`${fn}_t`.slice(0, 63))} ON ${ref};` });
          out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(`${fn}_t`.slice(0, 63))} BEFORE TRUNCATE ON ${ref} FOR EACH STATEMENT EXECUTE FUNCTION ${fnRef}();` });
        } else {
          for (const when of ["UPDATE", "DELETE"]) {
            const n = `inv_${tn}_append_only_${when.toLowerCase()}`.slice(0, 63);
            out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(n)};` });
            out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(n)} BEFORE ${when} ON ${ref}\nBEGIN\n  SELECT RAISE(ABORT, ${lit(`${tn} is append-only: a record is never changed or removed`)});\nEND;` });
          }
        }
        if (a.chain !== undefined) {
          const h = col(a.chain.hash);
          const p = col(a.chain.previous);
          const s = col(a.chain.sequence);
          if (h === undefined || p === undefined || s === undefined) continue;
          const genesis = lit(a.chain.genesis);
          if (postgres) {
            const fn = `inv_${tn}_chain`.slice(0, 63);
            const fnRef = qualified(dialect, written.qualifier, fn);
            out.push({
              group: "routine",
              of,
              sql: `CREATE OR REPLACE FUNCTION ${fnRef}() RETURNS trigger LANGUAGE plpgsql AS $inv$\nDECLARE last_seq bigint; last_hash text;\nBEGIN\n  SELECT ${q(s)}, ${q(h)} INTO last_seq, last_hash FROM ${ref} ORDER BY ${q(s)} DESC LIMIT 1;\n  IF NOT FOUND THEN\n    IF NEW.${q(s)} <> 1 OR NEW.${q(p)} <> ${genesis} THEN RAISE EXCEPTION ${lit(`${tn} chain: the first record is number 1 and follows the start`)} USING ERRCODE = 'integrity_constraint_violation'; END IF;\n  ELSIF NEW.${q(s)} <> last_seq + 1 OR NEW.${q(p)} <> last_hash THEN\n    RAISE EXCEPTION ${lit(`${tn} chain: a record follows the last one, by number and by hash`)} USING ERRCODE = 'integrity_constraint_violation';\n  END IF;\n  RETURN NEW;\nEND\n$inv$;`,
            });
            out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(fn)} ON ${ref};` });
            out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(fn)} BEFORE INSERT ON ${ref} FOR EACH ROW EXECUTE FUNCTION ${fnRef}();` });
          } else {
            const n = `inv_${tn}_chain`.slice(0, 63);
            const when = `((SELECT COUNT(*) FROM ${ref}) = 0 AND (NEW.${q(s)} <> 1 OR NEW.${q(p)} <> ${genesis})) OR ((SELECT COUNT(*) FROM ${ref}) > 0 AND NOT EXISTS (SELECT 1 FROM ${ref} AS h WHERE h.${q(s)} = (SELECT MAX(${q(s)}) FROM ${ref}) AND NEW.${q(s)} = h.${q(s)} + 1 AND NEW.${q(p)} = h.${q(h)}))`;
            out.push({ group: "routine", of, sql: `DROP TRIGGER IF EXISTS ${q(n)};` });
            out.push({ group: "routine", of, sql: `CREATE TRIGGER ${q(n)} BEFORE INSERT ON ${ref} WHEN ${when}\nBEGIN\n  SELECT RAISE(ABORT, ${lit(`${tn} chain: a record follows the last one, by number and by hash`)});\nEND;` });
          }
        }
      }
      for (const m of carriedOf(t, quality.atMost)) {
        const a = col(m.member);
        const b = col(m.other);
        if (a === undefined || b === undefined) continue;
        const bad = `NEW.${q(a)} > NEW.${q(b)}`;
        rule(`${a}_at_most`, "BEFORE INSERT OR UPDATE", bad, `${a} is never above ${b}`, ["BEFORE INSERT", "BEFORE UPDATE"]);
      }
      for (const c of t.columns) {
        for (const tr of carriedOf(c, quality.transitions)) {
          const cn = written.column(c.id) ?? "";
          const allowed = Object.entries(tr.allowed).filter(([, to]) => to.length > 0);
          const ok1 = allowed.length === 0 ? "FALSE" : allowed.map(([from, to]) => `(OLD.${q(cn)} = ${lit(writeCode(naming, from))} AND NEW.${q(cn)} IN (${to.map((x) => lit(writeCode(naming, x))).join(", ")}))`).join(" OR ");
          const changed = postgres ? `OLD.${q(cn)} IS DISTINCT FROM NEW.${q(cn)}` : `OLD.${q(cn)} IS NOT NEW.${q(cn)}`;
          rule(`${cn}_moves`, `BEFORE UPDATE OF ${q(cn)}`, `${changed} AND NOT (${ok1})`, `${cn} moves only along the moves it may make`, [`BEFORE UPDATE OF ${q(cn)}`]);
        }
      }
    }
    return errors.length > 0 ? err(errors) : ok(out);
  };
}


/** An invariant and where a dialect can enforce it. */
export interface Placed extends Invariant {
  readonly by: "database" | "application";
  readonly via: string;
}

/**
 * The invariants of a schema, each with where the dialect enforces it: in the database, or by the application's runtime where the dialect has no way to do it in the database.
 *
 * @param tables - the tables of the logical schema
 * @param dialect - the dialect
 * @returns each invariant, placed
 */
export function placed(tables: readonly Table[], dialect: Dialect): readonly Placed[] {
  const need: Readonly<Record<Invariant["kind"], Need>> = { "append-only": "append-only", chain: "hash-chain", transitions: "status-moves", "at-most": "column-cap" };
  return invariantsOf(tables).map((i) => ({ ...i, ...where(dialect, need[i.kind]) }));
}
