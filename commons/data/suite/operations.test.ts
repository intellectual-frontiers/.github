// Spec: 0031-operations FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * Operations (commons data 0031-operations), on real engines: contracts held to the domain they are for; a runtime that runs implementations in one transaction and holds them to their contracts;
 * typed row operations by the words of names; refusals that are recorded; and a business outcome that is kept though it is a refusal.
 * Not shown here: two connections doing the same thing at once, which these in-process engines cannot do.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { composeModules, lintOperations, moduleOf, operation } from "@intellectual-frontiers/data/governance";
import { partyDomain } from "@intellectual-frontiers/data/models/arca";
import { tenancyModule } from "@intellectual-frontiers/data/models/arca-tenancy";
import { identityModule } from "@intellectual-frontiers/data/models/identity";
import { type AuditSink, defaultContext, type Implementation, operations, type RuntimeOptions } from "@intellectual-frontiers/data/sql/extensions/operations";
import { projectDomain } from "@intellectual-frontiers/data/sql/logical";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf } from "./lifecycle-fixture.ts";

const domain = (() => {
  const r = composeModules("app", {}, [moduleOf(partyDomain.kind === "ok" ? partyDomain.value : (undefined as never)), tenancyModule, identityModule]);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
})();
const schema = (() => {
  const p = projectDomain(domain);
  if (p.kind === "err") throw new Error(JSON.stringify(p.error));
  return p.value.schema;
})();
const dbWith = async (name: Engine["name"]): Promise<Engine> => {
  const e = await openEngine(name);
  const b = bind(schema, { dialect: DIALECTS.find((x) => x.name === name)!.dialect });
  assert(b.kind === "ok");
  if (b.kind === "ok") await load(e, b.value);
  return e;
};
const AT = "2026-01-01T00:00:00.000Z";
const fixed = { now: () => AT, newId: (() => { let n = 0; return () => `id${++n}`; })() };
// a small audit sink of the test's own: one row of the audit table, no chain
const sink: AuditSink = {
  table: "audit event",
  async record(tx, event, c) {
    const id = c.newId();
    const sequence = Number((await tx.query((r) => `SELECT COUNT(*) AS n FROM ${r.table("audit event")}`))[0]?.["n"]) + 1;
    await tx.insert("audit event", { auditEventId: id, sequence, occurredAt: c.now(), actorKind: event.actorKind, action: event.action, outcome: event.outcome, previousHash: "x", eventHash: `h-${id}` });
    return `h-${id}`;
  },
};

const rename = operation("renameTenant", {
  definition: "Renames a tenant",
  kind: "command",
  input: { tenant: "text", displayName: "text", note: { type: "text", optional: true } },
  reads: ["tenant"],
  writes: ["tenant"],
  requires: "tenant:rename",
  scope: "tenant",
  emits: ["tenant.renamed"],
  runsAs: "caller",
  idempotent: true,
});
const count = operation("countTenants", { definition: "How many tenants there are", kind: "query", input: {}, reads: ["tenant"], public: true, runsAs: "caller", idempotent: true });
const impls: Record<string, Implementation> = {
  async renameTenant(tx, input) {
    const n = await tx.update("tenant", { displayName: input["displayName"] as string }, { tenantId: input["tenant"] as string });
    if (n === 0) return { status: "not-found" };
    await tx.audit({ action: "tenant.renamed", outcome: "success", actorKind: "user", tenant: input["tenant"] as string });
    return { status: "renamed" };
  },
  async countTenants(tx) {
    return { status: "counted", n: await tx.count("tenant") };
  },
};
const options = (allow: boolean): RuntimeOptions => ({ context: fixed, audit: sink, authorize: async () => allow });
const seedTenant = (e: Engine) =>
  e.run(`INSERT INTO "tenant" ("tenant_id", "kind", "slug", "display_name", "ancestry", "status", "isolation", "created_at") VALUES ('t1', 'business', 'acme', 'Acme', '/t1', 'active', 'shared', '${AT}')`);

proves(
  ["0031-operations FR-001", "0031-operations FR-002"],
  "a contract is frozen, and the lint finds a concept that is not there, a query that writes, a bad permission or action, a scope that is not an input, a duplicate, a restricted write as the caller and a silent command",
  () => {
    assert(Object.isFrozen(rename) && Object.isFrozen(rename.spec) && Object.isFrozen(rename.input));
    same(rename.input["note"], { type: "text", optional: true });
    same(rename.input["tenant"], { type: "text", optional: false });
    same(lintOperations(domain, [rename, count]), []);
    const rules = (...o: Parameters<typeof operation>[]): string[] => lintOperations(domain, o.map(([n, s]) => operation(n, s))).map((f) => f.rule);
    const base = { definition: "x", kind: "command", input: {}, reads: [], public: true, runsAs: "service", idempotent: false } as const;
    same(rules(["a", { ...base, reads: ["nothing"] }]), ["operation/unknown-concept"]);
    same(rules(["a", { ...base, kind: "query", writes: ["tenant"], reads: ["tenant"] }]), ["operation/query-writes"]);
    same(rules(["a", { ...base, public: false, requires: "BAD", writes: ["tenant"], emits: ["tenant.x"] }]), ["operation/permission-form"]);
    same(rules(["a", { ...base, writes: ["tenant"], emits: ["Tenant-x"] }]), ["operation/emit-form"]);
    same(rules(["a", { ...base, input: { t: "text" }, scope: "nope", writes: ["tenant"], emits: ["a.b"] }]), ["operation/scope-unknown"]);
    same(rules(["a", base], ["a", base]), ["operation/duplicate", "operation/duplicate"].slice(0, 1));
    same(rules(["a", { ...base, writes: ["credential"], emits: ["a.b"], runsAs: "caller" }]), ["operation/restricted-as-caller"]);
    const silent = lintOperations(domain, [operation("a", { ...base, writes: ["tenant"] })]);
    same(silent.map((f) => [f.rule, f.severity]), [["operation/command-silent", "warning"]]);
  },
);

proves(
  ["0031-operations FR-009"],
  "an operation requires a permission or says it is public, and a contract that does neither is found by the lint and refused by the runtime",
  () => {
    const mk = (spec: Record<string, unknown>) => operation("a", { definition: "x", kind: "query", input: {}, reads: ["tenant"], runsAs: "service", idempotent: true, ...spec });
    const rules = (o: ReturnType<typeof operation>) => lintOperations(domain, [o]).map((f) => f.rule);
    same(rules(mk({})), ["operation/no-permission"], "none of the three");
    same(rules(mk({ requires: "tenant:read" })), []);
    same(rules(mk({ public: true })), []);
    same(rules(mk({ checkedBy: "the caller is the tenant's owner" })), []);
    same(rules(mk({ requires: "tenant:read", public: true })), ["operation/access-ambiguous"]);
    same(rules(mk({ public: true, checkedBy: "x" })), ["operation/access-ambiguous"]);
    for (const e of DIALECTS.slice(0, 1)) {
      const r = operations(schema, e.dialect, { exec: async () => undefined, query: async () => [] }, [mk({})], { a: async () => ({ status: "ok" }) }, {});
      same(r.kind === "err" ? r.error.map((x) => x.kind) : [], ["no-permission"], "no runtime is made for it");
    }
  },
);

proves(
  ["0031-operations FR-003"],
  "a runtime needs an implementation for each contract, a contract for each implementation, tables the schema has, and an authorizer and an audit trail where the contract asks for them",
  () => {
    const d = DIALECTS[2].dialect;
    const make = (c: Parameters<typeof operations>[3], i: Parameters<typeof operations>[4], o: RuntimeOptions = {}) => {
      const r = operations(schema, d, { exec: async () => undefined, query: async () => [] }, c, i, o);
      return r.kind === "err" ? r.error.map((e) => e.kind) : ["ok"];
    };
    same(make([rename, count], impls, options(true)), ["ok"]);
    same(make([rename, count], { countTenants: impls["countTenants"]! }, options(true)), ["no-implementation"]);
    same(make([count], impls, options(true)), ["no-contract"]);
    same(make([operation("x", { definition: "d", kind: "query", input: {}, reads: ["nope"], public: true, runsAs: "caller", idempotent: true })], { x: impls["countTenants"]! }), ["unknown-table"]);
    same(make([rename], { renameTenant: impls["renameTenant"]! }, { audit: sink }), ["no-authorizer"]);
    same(make([rename], { renameTenant: impls["renameTenant"]! }, { authorize: async () => true }), ["no-audit"]);
  },
);

proves(
  ["0031-operations FR-004", "0031-operations FR-005", "0031-operations FR-008"],
  "on three engines typed row operations work by the words of names and a query cannot write, and input that is missing, unknown or of the wrong type is refused before anything is done",
  async () => {
    const ctx = defaultContext("pepper");
    assert(ctx.hashToken("a") === ctx.hashToken("a") && ctx.hashToken("a") !== ctx.hashToken("b") && ctx.hashIdentifier(" Ann@Example.org ") === ctx.hashIdentifier("ann@example.org"));
    assert(ctx.newToken().length === 64 && ctx.newToken() !== ctx.newToken());
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name);
      try {
        await seedTenant(e);
        const rt = operations(schema, dialect, driverOf(e), [rename, count], impls, options(true));
        assert(rt.kind === "ok");
        if (rt.kind !== "ok") continue;
        const bad = await rt.value.run("renameTenant", { tenant: 5, extra: 1 }, "u1");
        assert(bad.kind === "err" && bad.error.kind === "input", `${name}`);
        if (bad.kind === "err" && bad.error.kind === "input")
          same(bad.error.errors.map((x) => `${x.kind}:${x.input}`).sort(), ["missing:displayName", "type:tenant", "unknown:extra"], name);
        same((await e.rows(`SELECT "display_name" d FROM "tenant"`))[0]?.["d"], "Acme", `${name}: nothing was done`);
        const unknown = await rt.value.run("nope", {});
        assert(unknown.kind === "err" && unknown.error.kind === "unknown-operation");
        const counted = await rt.value.run("countTenants", {});
        assert(counted.kind === "ok" && counted.value["n"] === 1, `${name}: ${JSON.stringify(counted)}`);
        // a query that tries to write
        const sneaky: Implementation = async (tx) => {
          await tx.update("tenant", { displayName: "Hacked" }, { tenantId: "t1" });
          return { status: "x" };
        };
        const rt2 = operations(schema, dialect, driverOf(e), [count], { countTenants: sneaky }, options(true));
        assert(rt2.kind === "ok");
        if (rt2.kind === "ok") {
          const r = await rt2.value.run("countTenants", {});
          assert(r.kind === "err" && r.error.kind === "failed" && r.error.message.includes("may not write"), `${name}: ${JSON.stringify(r)}`);
        }
        same((await e.rows(`SELECT "display_name" d FROM "tenant"`))[0]?.["d"], "Acme", `${name}: a query did not write`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0031-operations FR-006"],
  "a caller without the permission gets denied, and the attempt is recorded and kept alone",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name);
      try {
        await seedTenant(e);
        const seen: unknown[] = [];
        const authorize: RuntimeOptions["authorize"] = async (_tx, caller, permission, tenant) => {
          seen.push([caller, permission, tenant]);
          return false;
        };
        const rt = operations(schema, dialect, driverOf(e), [rename], { renameTenant: impls["renameTenant"]! }, { context: fixed, audit: sink, authorize });
        assert(rt.kind === "ok");
        if (rt.kind !== "ok") continue;
        const r = await rt.value.run("renameTenant", { tenant: "t1", displayName: "New" }, "u1");
        same(r, { kind: "ok", value: { status: "denied", permission: "tenant:rename" } }, name);
        same(seen, [["u1", "tenant:rename", "t1"]], `${name}: asked in the tenant the scope names`);
        same((await e.rows(`SELECT "display_name" d FROM "tenant"`))[0]?.["d"], "Acme", `${name}: nothing was done`);
        const log = await e.rows(`SELECT "action", "outcome" FROM "audit_event"`);
        same(log.map((x) => [x["action"], x["outcome"]]), [["tenant.renamed", "denied"]], `${name}: the attempt is recorded`);
        const nobody = await rt.value.run("renameTenant", { tenant: "t1", displayName: "New" });
        assert(nobody.kind === "ok" && nobody.value.status === "denied", `${name}: no caller`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0031-operations FR-007"],
  "an operation is one transaction: a refusal writes nothing and is not an error, a throw and a write outside the contract and a write with no audit record roll back, and an outcome that must be kept is kept",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name);
      try {
        await seedTenant(e);
        const mk = (impl: Implementation, c = rename) => {
          const r = operations(schema, dialect, driverOf(e), [c], { [c.name]: impl }, options(true));
          assert(r.kind === "ok", `${name}: ${JSON.stringify(r)}`);
          return r.kind === "ok" ? r.value : (undefined as never);
        };
        const name1 = async (): Promise<unknown> => (await e.rows(`SELECT "display_name" d FROM "tenant"`))[0]?.["d"];
        const input = { tenant: "t1", displayName: "New" };
        const good = await mk(impls["renameTenant"]!).run("renameTenant", input, "u1");
        same(good, { kind: "ok", value: { status: "renamed" } }, name);
        same(await name1(), "New");
        same(Number((await e.rows(`SELECT count(*) n FROM "audit_event"`))[0]?.["n"]), 1, `${name}: recorded with it`);
        // a throw after a write
        const thrown = await mk(async (tx) => {
          await tx.update("tenant", { displayName: "Half" }, { tenantId: "t1" });
          throw new Error("boom");
        }).run("renameTenant", input, "u1");
        assert(thrown.kind === "err" && thrown.error.kind === "failed" && thrown.error.message === "boom", `${name}: ${JSON.stringify(thrown)}`);
        same(await name1(), "New", `${name}: a throw rolls back`);
        // a write outside the contract
        const stray = await mk(async (tx) => {
          await tx.update("tenant", { displayName: "Stray" }, { tenantId: "t1" });
          await tx.update("principal", { displayName: "x" }, { principalId: "none" });
          await tx.audit({ action: "tenant.renamed", outcome: "success", actorKind: "user" });
          return { status: "renamed" };
        }).run("renameTenant", input, "u1");
        assert(stray.kind === "err" && stray.error.kind === "undeclared-write" && stray.error.tables.includes("principal"), JSON.stringify(stray));
        same(await name1(), "New", `${name}: a write outside the contract rolls back`);
        // a write that is not recorded
        const silent = await mk(async (tx) => {
          await tx.update("tenant", { displayName: "Silent" }, { tenantId: "t1" });
          return { status: "renamed" };
        }).run("renameTenant", input, "u1");
        assert(silent.kind === "err" && silent.error.kind === "missing-audit", JSON.stringify(silent));
        same(await name1(), "New", `${name}: a write with no record rolls back`);
        // a refusal writes nothing and is not an error
        const refusal = await mk(async () => ({ status: "not-found" })).run("renameTenant", input, "u1");
        same(refusal, { kind: "ok", value: { status: "not-found" } });
        // an outcome that must be kept is kept
        const kept = await mk(async (tx) => {
          await tx.update("tenant", { displayName: "Kept" }, { tenantId: "t1" });
          await tx.audit({ action: "tenant.renamed", outcome: "failure", actorKind: "system" });
          return { status: "reuse", revoked: 1 };
        }).run("renameTenant", input, "u1");
        same(kept, { kind: "ok", value: { status: "reuse", revoked: 1 } });
        same(await name1(), "Kept", `${name}: an outcome that is a refusal can still be kept`);
        // and one that says not to
        await mk(async (tx) => {
          await tx.update("tenant", { displayName: "Undone" }, { tenantId: "t1" });
          return { status: "dry-run", commit: false };
        }).run("renameTenant", input, "u1");
        same(await name1(), "Kept", `${name}: commit: false`);
      } finally {
        await e.close();
      }
    }
  },
);
