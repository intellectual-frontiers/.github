// Spec: 0001-arcactl-pg-kit FR-005
/**
 * The row-security scenarios of the UAT kit (commons data 0001-arcactl-pg-kit FR-005): each says who connects (a role), what scope the issuer gives them, the one statement they run and what must come of it. They are data, so that
 * the same list is run by the checker against your database (`bin/rls-check.ts`), against an in-process PostgreSQL by the library's own tests, and read by a person who wants to reproduce one by hand (`--explain` prints the
 * statements). Every scenario runs in a transaction that is rolled back, so none leaves a trace.
 *
 * @module
 */
import { grantOf, sealedScope } from "@intellectual-frontiers/data/sql/extensions/access";

/** What the issuer holds: the key of the seal, and the tenants beneath a tenant (read by the checker from the tenant table). */
export interface Issuer {
  readonly key: string;
  readonly subtree: (tenant: string) => Promise<readonly string[]>;
}

/** The statement that sets the scope `tenant` to a value, for the session. */
export const setScope = (value: string): string => `SELECT set_config('app.tenant', '${value.replaceAll("'", "''")}', false)`;

/** The sealed scope of a grant, as the issuer makes it. */
export const sealed = (issuer: Issuer, grant: readonly string[] | "*"): string => setScope(sealedScope(issuer.key, "tenant", grantOf(grant)));

/** What must come of the statement. */
export type Expect =
  | { readonly kind: "rows"; readonly of: string; readonly values: readonly string[] }
  | { readonly kind: "error"; readonly match: string };

/** One scenario. */
export interface Scenario {
  readonly id: string;
  readonly title: string;
  /** The role that connects; `superuser` is the connection of `ARCA_DATABASE_URL`, and `crm_owner` is that connection after `SET ROLE crm_owner`. */
  readonly role: "uat_reader" | "uat_writer" | "uat_support" | "uat_operator" | "crm_owner" | "superuser";
  /** The statements that set the scope, made by the issuer; none is no scope. */
  readonly scope?: (issuer: Issuer) => Promise<readonly string[]>;
  /** The statement the role runs. */
  readonly sql: string;
  readonly expect: Expect;
  /** Why it must be so: what a reviewer is looking for. */
  readonly why: string;
  /** Not a promise the kit makes but a gap it records: the scenario passes while the gap is there and fails when it is closed, so that the finding is revisited. */
  readonly gap?: true;
}

const ids = (table: string, column = "tenant_id") => `SELECT DISTINCT "${column}" FROM "api"."${table}" ORDER BY 1`;
const tenants = (...t: readonly string[]): Expect => ({ kind: "rows", of: "tenant_id", values: t });
const denied = "permission denied";
const rls = "row-level security";

/** The scenarios, in the order of the README. */
export const scenarios: readonly Scenario[] = [
  { id: "S01", title: "A tenant sees only its own rows", role: "uat_reader", scope: async (i) => [sealed(i, ["acme"])], sql: ids("customer_account"), expect: tenants("acme"), why: "the policy filters by the sealed scope: Acme's rows, and nobody else's, although every tenant's rows are in the table" },
  { id: "S02", title: "A tenant sees all of its own rows", role: "uat_reader", scope: async (i) => [sealed(i, ["acme"])], sql: `SELECT "account_id" FROM "api"."customer_account" ORDER BY 1`, expect: { kind: "rows", of: "account_id", values: ["acme-a1", "acme-a2"] }, why: "the filter takes nothing of its own away" },
  { id: "S03", title: "With no scope, nothing is shown", role: "uat_reader", sql: ids("customer_account"), expect: tenants(), why: "a session that has not been given a scope sees no tenant's rows, not all of them (fail closed)" },
  { id: "S04", title: "A scope a session wrote itself is not trusted", role: "uat_reader", scope: async () => [setScope("acme")], sql: ids("customer_account"), expect: tenants(), why: "without the issuer's mark the setting is only text: a caller cannot name its own tenant" },
  { id: "S05", title: "A forged mark is not trusted", role: "uat_reader", scope: async () => [setScope(`acme.${"0".repeat(64)}`)], sql: ids("customer_account"), expect: tenants(), why: "a mark that is not the key's mark of this value is refused" },
  { id: "S06", title: "The mark of one tenant is not the mark of another", role: "uat_reader", scope: async (i) => [setScope(`acme.${sealedScope(i.key, "tenant", "globex").split(".")[1]}`)], sql: ids("customer_account"), expect: tenants(), why: "a caller that holds Globex's scope cannot rename it Acme's" },
  { id: "S07", title: "The tables themselves are not readable", role: "uat_reader", scope: async (i) => [sealed(i, ["acme"])], sql: `SELECT * FROM "data"."customer_account"`, expect: { kind: "error", match: denied }, why: "applications read the views; the tables of the `data` schema belong to the owner" },
  { id: "S08", title: "A reader cannot write", role: "uat_reader", scope: async (i) => [sealed(i, ["acme"])], sql: `INSERT INTO "api"."customer_account" VALUES ('x', 'acme', 'X', 'active', now()) RETURNING "account_id"`, expect: { kind: "error", match: denied }, why: "the grant gives the reader SELECT and nothing else" },
  { id: "S09", title: "A writer writes in its own tenant", role: "uat_writer", scope: async (i) => [sealed(i, ["acme"])], sql: `INSERT INTO "api"."customer_account" VALUES ('acme-a3', 'acme', 'Acme Retail', 'active', now()) RETURNING "account_id"`, expect: { kind: "rows", of: "account_id", values: ["acme-a3"] }, why: "WITH CHECK holds the row to the scope, and this row is in it" },
  { id: "S10", title: "A writer cannot write into another tenant", role: "uat_writer", scope: async (i) => [sealed(i, ["acme"])], sql: `INSERT INTO "api"."customer_account" VALUES ('globex-a9', 'globex', 'Sneaky', 'active', now()) RETURNING "account_id"`, expect: { kind: "error", match: rls }, why: "a row of another tenant fails the policy's WITH CHECK" },
  { id: "S11", title: "A writer cannot change another tenant's row", role: "uat_writer", scope: async (i) => [sealed(i, ["acme"])], sql: `UPDATE "api"."customer_account" SET "name" = 'Hacked' WHERE "tenant_id" = 'globex' RETURNING "account_id"`, expect: { kind: "rows", of: "account_id", values: [] }, why: "the row is not visible to the writer, so there is nothing to update" },
  { id: "S12", title: "A writer cannot move its row to another tenant", role: "uat_writer", scope: async (i) => [sealed(i, ["acme"])], sql: `UPDATE "api"."customer_account" SET "tenant_id" = 'globex' WHERE "account_id" = 'acme-a1' RETURNING "account_id"`, expect: { kind: "error", match: rls }, why: "the new row would be outside the scope, which WITH CHECK refuses" },
  { id: "S13", title: "A writer cannot delete another tenant's row", role: "uat_writer", scope: async (i) => [sealed(i, ["acme"])], sql: `DELETE FROM "api"."customer_account" WHERE "tenant_id" = 'globex' RETURNING "account_id"`, expect: { kind: "rows", of: "account_id", values: [] }, why: "invisible rows are not deletable" },
  { id: "S14", title: "Support may comment on a ticket but not create an account", role: "uat_support", scope: async (i) => [sealed(i, ["acme"])], sql: `INSERT INTO "api"."customer_account" VALUES ('x', 'acme', 'X', 'active', now()) RETURNING "account_id"`, expect: { kind: "error", match: denied }, why: "the support role's write grant is on tickets and comments only" },
  { id: "S15", title: "Support writes a comment in its tenant", role: "uat_support", scope: async (i) => [sealed(i, ["acme"])], sql: `INSERT INTO "api"."ticket_comment" VALUES ('acme-m2', 'acme', 'support', 'Fixed.', now(), 'acme-t1') RETURNING "comment_id"`, expect: { kind: "rows", of: "comment_id", values: ["acme-m2"] }, why: "the grants and the policy agree" },
  { id: "S16", title: "A reseller reaches the tenants beneath it", role: "uat_reader", scope: async (i) => [sealed(i, await i.subtree("northwind"))], sql: ids("customer_account"), expect: tenants("acme", "initech", "northwind"), why: "the issuer expands the hierarchy (arcactl scope --subtree northwind) and seals the list: Northwind, Acme and Initech, and not Globex" },
  { id: "S17", title: "A reseller cannot write beyond its tenants", role: "uat_writer", scope: async (i) => [sealed(i, await i.subtree("northwind"))], sql: `INSERT INTO "api"."customer_account" VALUES ('globex-a9', 'globex', 'Sneaky', 'active', now()) RETURNING "account_id"`, expect: { kind: "error", match: rls }, why: "the reach is the same for reading and writing" },
  { id: "S18", title: "A platform operator reaches every tenant", role: "uat_operator", scope: async (i) => [sealed(i, "*")], sql: ids("customer_account"), expect: tenants("acme", "globex", "initech", "northwind"), why: "the wildcard is the platform operator's, given only by the issuer" },
  { id: "S19", title: "A wildcard a session wrote itself reaches nothing", role: "uat_operator", scope: async () => [setScope("*")], sql: ids("customer_account"), expect: tenants(), why: "an unsealed * is only text" },
  { id: "S20", title: "Row security binds the owner too", role: "crm_owner", sql: `SELECT count(*)::text AS n FROM "data"."customer_account"`, expect: { kind: "rows", of: "n", values: ["0"] }, why: "the tables' owner is forced to the policy: with no scope it sees no row" },
  { id: "S21", title: "Row security cannot be switched off", role: "superuser", sql: `ALTER TABLE "data"."customer_account" DISABLE ROW LEVEL SECURITY`, expect: { kind: "error", match: "" }, why: "an event trigger refuses a change of the table's row security unless the session holds the unlock secret" },
  { id: "S22", title: "A policy cannot be dropped", role: "superuser", sql: `DROP POLICY "customer_account_tenant_all" ON "data"."customer_account"`, expect: { kind: "error", match: "" }, why: "the same guard refuses it" },
  { id: "S23", title: "The key of the seal cannot be read", role: "uat_reader", scope: async (i) => [sealed(i, ["acme"])], sql: `SELECT "secret" FROM "ifc_seal"."key"`, expect: { kind: "error", match: denied }, why: "a caller that could read the key could make any scope" },
  { id: "S24", title: "A mark cannot be made", role: "uat_reader", scope: async (i) => [sealed(i, ["acme"])], sql: `SELECT "ifc_seal"."mac"('tenant=globex')`, expect: { kind: "error", match: denied }, why: "the function that makes marks is the policy's, not the caller's" },
  {
    id: "S25",
    title: "GAP: a ticket may point at another tenant's account",
    role: "uat_writer",
    scope: async (i) => [sealed(i, ["acme"])],
    sql: `INSERT INTO "api"."support_ticket" VALUES ('acme-t9', 'acme', 'Points at Globex', 'low', 'open', now(), 'globex-a1') RETURNING "ticket_id"`,
    expect: { kind: "rows", of: "ticket_id", values: ["acme-t9"] },
    why: "a foreign key is checked without row security, and governance has no composite key that carries the tenant, so a writer who knows another tenant's account id can point at it; the row is still its own tenant's, and it cannot read what it points at",
    gap: true,
  },
];
