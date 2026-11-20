// Spec: 0043-sql-invariants FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * Invariants in the database (commons data 0043-sql-invariants): what governance says must always be true of the records of a concept (they are only added, they form a chain, a status moves only
 * along the moves it may, a number never goes above another) written as triggers, so that the database refuses what breaks it for every client, including a statement typed by hand that never
 * passed through an application. A dialect that cannot say them is an error value by default, never a silent loss.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";
import { vocabularies, words } from "@intellectual-frontiers/data/governance";
import { carriedOf, type Column, type LogicalId, type Table } from "@intellectual-frontiers/data/sql/logical";
import { type BindContext, type Dialect, type Need, type PhysicalError, qualified, type Statement, type StatementSource, where, writeCode } from "@intellectual-frontiers/data/sql/physical";

const { quality } = vocabularies;

/** What a project says of invariants. */
export interface InvariantSettings {
  /** What to do where the dialect has no triggers: `refuse` (an error value, the default) or `carry` (no statements; the invariant is only declared). */
  readonly unsupported?: "refuse" | "carry";
  /**
   * Where the dialect has event triggers (PostgreSQL), the guard that refuses to weaken the invariants (0043-sql-invariants FR-007): on by default, `false` to leave it out. `unlock` is the hash of a
   * secret (`guardKeyOf`) that lets a session that knows it change them (`unlockStatement`), as a migration must; without one nothing but a superuser's disabling of the guard can.
   */
  readonly guard?: false | { readonly unlock?: string };
}

/** The hash of a secret that unlocks the guard, to give as `guard.unlock`; the secret itself is kept outside the database. */
export const guardKeyOf = (secret: string): string => sha256Hex(secret);

/** The statement that unlocks the guard for the session (or, where `local`, for the transaction) that runs it. */
export const unlockStatement = (secret: string, local = true): string => `SELECT set_config('ifc.ddl_unlock', '${secret.replaceAll("'", "''")}', ${local ? "true" : "false"});`;

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
    if (dialect.name === "postgres" && given.guard !== false && dialect.features.includes("event-triggers")) out.push(...guardStatements(context, declared.map((t) => t.id), given.guard?.unlock));
    return errors.length > 0 ? err(errors) : ok(out);
  };
}

/**
 * The guard (0043-sql-invariants FR-007): event triggers that refuse, unless the session holds the unlock secret, to drop a trigger or function of an invariant (alone, with its table or with its schema), to
 * disable one, to rename one or to replace one, so that the owner of a table cannot weaken what the database enforces. The guard's own functions are named as an invariant's, so they are guarded too.
 */
function guardStatements(context: BindContext, of: LogicalId[], unlock: string | undefined): Statement[] {
  const { dialect, written } = context;
  const lit = (s: string): string => dialect.literal(s);
  const fn = (n: string): string => qualified(dialect, written.qualifier, n);
  const open = unlock === undefined ? "FALSE" : `encode(sha256(convert_to(coalesce(current_setting('ifc.ddl_unlock', true), ''), 'UTF8')), 'hex') = ${lit(unlock)}`;
  const body = (inner: string): string => `AS $g$\nDECLARE o record;\nBEGIN\n  IF ${open} THEN RETURN; END IF;\n${inner}END\n$g$;`;
  const refuse = (what: string): string => `RAISE EXCEPTION '%: %', ${lit(what)}, o.object_identity USING ERRCODE = 'insufficient_privilege', HINT = 'the invariants of the database are changed by a session that holds the unlock secret';`;
  const s = (sql: string): Statement => ({ group: "routine", of, sql });
  return [
    s(`CREATE OR REPLACE FUNCTION ${fn("inv_guard_drop")}() RETURNS event_trigger LANGUAGE plpgsql ${body(`  FOR o IN SELECT object_type, object_identity FROM pg_event_trigger_dropped_objects() LOOP\n    IF o.object_type IN ('trigger', 'function') AND o.object_identity ~ '(^|[ .])inv_' THEN ${refuse("an invariant of the database cannot be dropped")} END IF;\n  END LOOP;\n`)}`),
    s(`CREATE OR REPLACE FUNCTION ${fn("inv_guard_end")}() RETURNS event_trigger LANGUAGE plpgsql ${body(`  FOR o IN SELECT command_tag, object_identity, objid FROM pg_event_trigger_ddl_commands() LOOP\n    IF o.command_tag = 'ALTER TABLE' AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = o.objid AND tgname ~ '^inv_' AND tgenabled <> 'O') THEN ${refuse("an invariant of the database cannot be disabled")} END IF;\n    IF o.command_tag IN ('CREATE FUNCTION', 'ALTER FUNCTION') AND o.object_identity ~ '(^|[.])inv_' THEN ${refuse("an invariant of the database cannot be replaced")} END IF;\n  END LOOP;\n`)}`),
    s(`CREATE OR REPLACE FUNCTION ${fn("inv_guard_start")}() RETURNS event_trigger LANGUAGE plpgsql AS $g$\nBEGIN\n  IF ${open} THEN RETURN; END IF;\n  RAISE EXCEPTION 'a trigger cannot be renamed: it may be an invariant of the database' USING ERRCODE = 'insufficient_privilege';\nEND\n$g$;`),
    s("DROP EVENT TRIGGER IF EXISTS inv_guard_drop;"),
    s(`CREATE EVENT TRIGGER inv_guard_drop ON sql_drop EXECUTE FUNCTION ${fn("inv_guard_drop")}();`),
    s("DROP EVENT TRIGGER IF EXISTS inv_guard_end;"),
    s(`CREATE EVENT TRIGGER inv_guard_end ON ddl_command_end WHEN TAG IN ('ALTER TABLE', 'CREATE FUNCTION', 'ALTER FUNCTION') EXECUTE FUNCTION ${fn("inv_guard_end")}();`),
    s("DROP EVENT TRIGGER IF EXISTS inv_guard_start;"),
    s(`CREATE EVENT TRIGGER inv_guard_start ON ddl_command_start WHEN TAG IN ('ALTER TRIGGER') EXECUTE FUNCTION ${fn("inv_guard_start")}();`),
  ];
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
