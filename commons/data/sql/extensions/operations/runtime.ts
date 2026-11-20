// Spec: 0031-operations FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * The runtime of operations (commons data 0031-operations): each run in one transaction, its input checked against its contract, its caller authorized, what it wrote held to what it declared, and
 * what it must record in the audit trail recorded in the same transaction. A business outcome is a value, never an exception, so that an outcome that must be kept (a revocation after a reused
 * token) is committed; anything thrown rolls back.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Operation, words } from "@intellectual-frontiers/data/governance";
import { sha256Hex, type Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, type Naming, naming as defaultNaming } from "@intellectual-frontiers/data/sql/physical";
import { type AuditEvent, type AuditSink, type Context, resolver, track, type Tx } from "./tx.ts";

/** What an operation gives back: a status, what goes with it, and whether to keep what it did (it does, where it does not say). */
export type Outcome = { readonly status: string; readonly commit?: boolean } & Readonly<Record<string, unknown>>;

/** How an operation is done. */
export type Implementation = (tx: Tx, input: Readonly<Record<string, unknown>>, context: Context) => Promise<Outcome>;

/** Whether a caller holds a permission in a tenant; the model's, given by the project. */
export type Authorize = (tx: Tx, caller: string, permission: string, tenant: string | undefined) => Promise<boolean>;

/** Why an operation refuses its input, as a value. */
export type InputError =
  | { readonly kind: "missing"; readonly input: string }
  | { readonly kind: "unknown"; readonly input: string }
  | { readonly kind: "type"; readonly input: string; readonly expected: string };

export type RunError =
  | { readonly kind: "unknown-operation"; readonly name: string }
  | { readonly kind: "input"; readonly errors: readonly InputError[] }
  | { readonly kind: "undeclared-write"; readonly tables: readonly string[] }
  | { readonly kind: "missing-audit"; readonly emits: readonly string[] }
  | { readonly kind: "failed"; readonly message: string };

/** Why an operation cannot be set up on a database, as a value. */
export type SetupError =
  | { readonly kind: "no-implementation"; readonly operation: string }
  | { readonly kind: "no-contract"; readonly operation: string }
  | { readonly kind: "unknown-table"; readonly operation: string; readonly table: string }
  | { readonly kind: "no-authorizer"; readonly operation: string }
  | { readonly kind: "no-audit"; readonly operation: string }
  | { readonly kind: "no-permission"; readonly operation: string };

/** What a runtime is made with. */
export interface RuntimeOptions {
  readonly naming?: Naming;
  /** The schema the tables are in. */
  readonly schema?: string;
  readonly context?: Partial<Context>;
  readonly authorize?: Authorize;
  readonly audit?: AuditSink;
}

/** The operations of a model, ready to run. */
export interface Runtime {
  readonly names: readonly string[];
  /**
   * Runs an operation.
   *
   * @param name - the operation
   * @param input - its input
   * @param caller - who is acting, by principal
   * @returns what it came to, or why it could not be run
   */
  run(name: string, input: Readonly<Record<string, unknown>>, caller?: string): Promise<Result<Outcome, RunError>>;
}

const bytes = (n: number): string => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");

/** The default of what an operation is given: the clock, random identifiers and tokens, and SHA-256; a password verifier is the application's. */
export function defaultContext(pepper = ""): Context {
  return {
    now: () => new Date().toISOString(),
    newId: () => globalThis.crypto.randomUUID(),
    newToken: () => bytes(32),
    hashToken: (t) => sha256Hex(t),
    hashIdentifier: (s) => sha256Hex(`${pepper}:${s.trim().toLowerCase()}`),
    verifyPassword: () => Promise.reject(new Error("no password verifier is given")),
  };
}

const TYPES: Readonly<Record<string, (v: unknown) => boolean>> = {
  text: (v) => typeof v === "string",
  integer: (v) => typeof v === "number" && Number.isSafeInteger(v),
  number: (v) => typeof v === "number" && Number.isFinite(v),
  boolean: (v) => typeof v === "boolean",
  instant: (v) => typeof v === "string" && !Number.isNaN(Date.parse(v)),
  textList: (v) => Array.isArray(v) && v.every((x) => typeof x === "string"),
};

/** The errors of an input against a contract. */
export function checkInput(o: Operation, input: Readonly<Record<string, unknown>>): readonly InputError[] {
  const errors: InputError[] = [];
  for (const k of Object.keys(input)) if (!(k in o.input)) errors.push({ kind: "unknown", input: k });
  for (const [k, spec] of Object.entries(o.input)) {
    const v = input[k];
    if (v === undefined || v === null) {
      if (!spec.optional) errors.push({ kind: "missing", input: k });
    } else if (!(TYPES[spec.type] as (v: unknown) => boolean)(v)) errors.push({ kind: "type", input: k, expected: spec.type });
  }
  return errors;
}

/**
 * The operations of a model, ready to run.
 *
 * @param schema - the logical schema
 * @param dialect - the dialect
 * @param driver - the database
 * @param contracts - the operations' contracts
 * @param implementations - how each is done, by name
 * @param options - the naming, the schema, what operations are given, how a caller is authorized and where the audit trail is written
 * @returns the runtime, or why it cannot be made
 */
export function operations(
  schema: LogicalSchema,
  dialect: Dialect,
  driver: Driver,
  contracts: readonly Operation[],
  implementations: Readonly<Record<string, Implementation>>,
  options: RuntimeOptions = {},
): Result<Runtime, readonly SetupError[]> {
  const nm = options.naming ?? defaultNaming();
  const r = resolver(schema, dialect, nm, options.schema);
  const errors: SetupError[] = [];
  const by = new Map(contracts.map((c) => [c.name, c]));
  for (const c of contracts) {
    if (implementations[c.name] === undefined) errors.push({ kind: "no-implementation", operation: c.name });
    for (const t of [...c.spec.reads, ...c.spec.writes])
      try {
        r.tableOf(t);
      } catch {
        errors.push({ kind: "unknown-table", operation: c.name, table: t });
      }
    if (c.spec.requires === undefined && c.spec.public !== true && c.spec.checkedBy === undefined) errors.push({ kind: "no-permission", operation: c.name });
    if (c.spec.requires !== undefined && options.authorize === undefined) errors.push({ kind: "no-authorizer", operation: c.name });
    if (c.spec.emits.length > 0 && options.audit === undefined) errors.push({ kind: "no-audit", operation: c.name });
  }
  for (const n of Object.keys(implementations)) if (!by.has(n)) errors.push({ kind: "no-contract", operation: n });
  if (errors.length > 0) return err(errors);
  const context: Context = { ...defaultContext(), ...options.context };
  const run: Runtime["run"] = async (name, input, caller) => {
    const o = by.get(name);
    if (o === undefined) return err({ kind: "unknown-operation", name });
    const bad = checkInput(o, input);
    if (bad.length > 0) return err({ kind: "input", errors: bad });
    const ctx: Context = caller === undefined ? context : { ...context, caller };
    const kept = track(driver, r, dialect, o.spec.kind, options.audit, ctx);
    await driver.exec("BEGIN");
    let done = false;
    try {
      if (o.spec.requires !== undefined) {
        const tenant = o.spec.scope === undefined ? undefined : (input[o.spec.scope] as string | undefined);
        const allowed = caller !== undefined && (await (options.authorize as NonNullable<RuntimeOptions["authorize"]>)(kept.tx, caller, o.spec.requires, tenant));
        if (!allowed) {
          // the attempt is itself recorded
          const first = o.spec.emits[0];
          if (first !== undefined && o.spec.kind === "command") {
            const event: AuditEvent = { action: first, outcome: "denied", actorKind: caller === undefined ? "system" : "user", ...(caller === undefined ? {} : { actor: caller }), ...(tenant === undefined ? {} : { tenant }), reason: `lacks ${o.spec.requires}` };
            await kept.tx.audit(event);
            await driver.exec("COMMIT");
            done = true;
          }
          return ok({ status: "denied", permission: o.spec.requires });
        }
      }
      const outcome = await (implementations[name] as Implementation)(kept.tx, input, ctx);
      if (o.spec.kind === "command") {
        const declared = new Set([...o.spec.writes, ...(options.audit === undefined ? [] : [options.audit.table])].map((w) => words(w).join(".")));
        const stray = [...kept.writes()].filter((w) => !declared.has(w));
        if (stray.length > 0) return err({ kind: "undeclared-write", tables: stray });
        if (outcome.commit !== false && kept.changed().size > 0 && o.spec.emits.length > 0 && !kept.actions().some((a) => o.spec.emits.includes(a)))
          return err({ kind: "missing-audit", emits: o.spec.emits });
      }
      if (outcome.commit === false || o.spec.kind === "query") await driver.exec("ROLLBACK");
      else await driver.exec("COMMIT");
      done = true;
      return ok(outcome);
    } catch (thrown) {
      return err({ kind: "failed", message: thrown instanceof Error ? thrown.message : String(thrown) });
    } finally {
      if (!done) await driver.exec("ROLLBACK").catch(() => undefined);
    }
  };
  return ok({ names: contracts.map((c) => c.name), run });
}
