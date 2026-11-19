// Spec: 0029-arca-tenancy FR-001, FR-002, FR-003; 0030-identity FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * The tenancy and identity models (commons data 0029-arca-tenancy, 0030-identity), as modules on top of Arca's party model: composed into one domain, projected, bound for each dialect and loaded
 * into the real engines, where the constraints that the model says are enforced; and the rules that the model holds itself to (classification, personal data, secrets, keeping) checked on the model.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { annotationsOf, composeModules, moduleOf, type AnyCodeList, type AnyConcept, type Domain, vocabularies } from "@intellectual-frontiers/data/governance";
import { partyDomain } from "@intellectual-frontiers/data/models/arca";
import { tenancyModule, tenant } from "@intellectual-frontiers/data/models/arca-tenancy";
import { concepts, identityModule } from "@intellectual-frontiers/data/models/identity";
import { projectDomain } from "@intellectual-frontiers/data/sql/logical";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";

const arca = moduleOf(partyDomain.kind === "ok" ? partyDomain.value : (undefined as never));
const composed = (...m: Parameters<typeof composeModules>[2]): Domain => {
  const r = composeModules("app", { definition: "An application" }, m);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const full = composed(arca, tenancyModule, identityModule);
const schemaOf = (d: Domain) => {
  const p = projectDomain(d);
  if (p.kind === "err") throw new Error(JSON.stringify(p.error));
  return p.value.schema;
};
const dbWith = async (name: Engine["name"], d: Domain): Promise<Engine> => {
  const e = await openEngine(name);
  const dialect = DIALECTS.find((x) => x.name === name)!.dialect;
  const b = bind(schemaOf(d), { dialect });
  assert(b.kind === "ok", JSON.stringify(b));
  if (b.kind === "ok") await load(e, b.value);
  return e;
};
const refused = async (e: Engine, sql: string): Promise<boolean> => {
  try {
    await e.run(sql);
    return false;
  } catch {
    return true;
  }
};
const AT = "'2026-01-01T00:00:00Z'";
const { security, privacy, quality, requirements } = vocabularies;

proves(
  ["0029-arca-tenancy FR-001", "0029-arca-tenancy FR-002"],
  "the tenancy module requires the party model and holds the tenant, and tenancy composes with the party model alone, without identity",
  () => {
    same([tenancyModule.name, tenancyModule.requires, tenancyModule.concepts.map((c) => c.name), tenancyModule.codeLists.map((l) => l.name)], ["arcaTenancy", ["arcaParty"], ["tenant"], ["tenantKind", "tenantStatus", "isolation"]]);
    const r = composeModules("app", {}, [tenancyModule]);
    assert(r.kind === "err" && r.error[0]?.kind === "missing", "arca is not listed");
    const only = schemaOf(composed(arca, tenancyModule)).tables.map((t) => t.name.join("."));
    assert(only.includes("tenant") && only.includes("party") && !only.includes("principal") && !only.includes("login.session"), "no table of identity");
    same(tenant.name, "tenant");
  },
);

proves(
  ["0029-arca-tenancy FR-003"],
  "on three engines the tenant has a unique slug, checked kind, status and isolation, a parent that is a tenant, and may not be its own parent",
  async () => {
    for (const { name } of DIALECTS) {
      const e = await dbWith(name, composed(arca, tenancyModule));
      try {
        const ins = (id: string, slug: string, kind = "platform", parent = "NULL") =>
          `INSERT INTO "tenant" ("tenant_id", "kind", "slug", "display_name", "ancestry", "status", "isolation", "created_at", "parent_tenant_id") VALUES ('${id}', '${kind}', '${slug}', 'T', '/', 'active', 'shared', ${AT}, ${parent})`;
        await e.run(ins("t1", "platform"));
        await e.run(ins("t2", "acme", "business", "'t1'"));
        await e.run(ins("t3", "acme-consumers", "consumer_pool", "'t2'"));
        assert(await refused(e, ins("t4", "acme")), `${name}: a slug is unique`);
        assert(await refused(e, ins("t5", "x", "alien")), `${name}: a kind is checked`);
        assert(await refused(e, ins("t6", "y", "business", "'nobody'")), `${name}: a parent is a tenant`);
        assert(await refused(e, ins("t7", "z", "business", "'t7'")), `${name}: a tenant is not its own parent`);
        same(Number((await e.rows(`SELECT count(*) n FROM "tenant"`))[0]?.["n"]), 3, name);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0030-identity FR-001"],
  "identity composes with the party model and tenancy into one domain that binds and loads into each real engine, and without tenancy it is an error as a value",
  async () => {
    same([identityModule.name, identityModule.requires], ["identity", ["arcaParty", "arcaTenancy"]]);
    const r = composeModules("app", {}, [arca, identityModule]);
    assert(r.kind === "err" && r.error.some((e) => e.kind === "missing" && e.requires === "arcaTenancy"));
    const schema = schemaOf(full);
    assert(schema.tables.length > 50);
    for (const c of concepts) assert(schema.tables.some((t) => t.name.join(".") === c.name.replace(/([A-Z])/g, ".$1").toLowerCase()), `${c.name} has a table`);
    for (const { name } of DIALECTS) await (await dbWith(name, full)).close();
  },
);

proves(
  ["0030-identity FR-002", "0030-identity FR-003"],
  "on three engines a user is a person's account in a principal, joins a tenant once, holds roles that hold permissions once, and a verified domain is one tenant's",
  async () => {
    for (const { name } of DIALECTS) {
      const e = await dbWith(name, full);
      try {
        const run = async (...sql: string[]): Promise<void> => {
          for (const s of sql) await e.run(s);
        };
        await run(
          `INSERT INTO "party" ("party_id", "party_kind_code", "display_name") VALUES ('p1', 'person', 'Ann')`,
          `INSERT INTO "person" ("party_id", "given_name", "family_name") VALUES ('p1', 'Ann', 'Lee')`,
          `INSERT INTO "principal" ("principal_id", "kind", "created_at") VALUES ('u1', 'user', ${AT}), ('g1', 'group', ${AT})`,
          `INSERT INTO "tenant" ("tenant_id", "kind", "slug", "display_name", "ancestry", "status", "isolation", "created_at") VALUES ('t1', 'business', 'acme', 'Acme', '/t1', 'active', 'shared', ${AT}), ('t2', 'business', 'beta', 'Beta', '/t2', 'active', 'shared', ${AT})`,
          `INSERT INTO "user_account" ("principal_id", "login_identifier", "status", "created_via", "person_party_id") VALUES ('u1', 'ann', 'active', 'invited', 'p1')`,
          `INSERT INTO "membership" ("membership_id", "status", "source", "user_account_principal_id", "tenant_id") VALUES ('m1', 'active', 'invited', 'u1', 't1')`,
          `INSERT INTO "membership" ("membership_id", "status", "source", "user_account_principal_id", "tenant_id") VALUES ('m2', 'active', 'admin', 'u1', 't2')`,
          `INSERT INTO "user_group" ("principal_id", "name", "source", "tenant_id") VALUES ('g1', 'admins', 'local', 't1')`,
          `INSERT INTO "group_member" ("group_user_group_principal_id", "member_principal_id", "added_at") VALUES ('g1', 'u1', ${AT})`,
          `INSERT INTO "permission" ("permission_id", "permission_key", "definition", "owner_module") VALUES ('x1', 'invoice:read', 'Read invoices', 'billing')`,
          `INSERT INTO "access_role" ("role_id", "key", "name", "kind", "definition") VALUES ('r1', 'viewer', 'Viewer', 'system', 'Reads')`,
          `INSERT INTO "role_permission" ("role_access_role_role_id", "permission_id") VALUES ('r1', 'x1')`,
          `INSERT INTO "role_assignment" ("role_assignment_id", "valid_from", "principal_id", "role_access_role_role_id", "tenant_id", "granted_by_principal_id") VALUES ('a1', ${AT}, 'u1', 'r1', 't1', 'u1')`,
          `INSERT INTO "verified_domain" ("verified_domain_id", "domain", "verified_at", "policy", "tenant_id") VALUES ('d1', 'acme.example', ${AT}, 'capture_users', 't1')`,
        );
        assert(await refused(e, `INSERT INTO "membership" ("membership_id", "status", "source", "user_account_principal_id", "tenant_id") VALUES ('m3', 'active', 'admin', 'u1', 't1')`), `${name}: a membership once`);
        assert(await refused(e, `INSERT INTO "group_member" ("group_user_group_principal_id", "member_principal_id", "added_at") VALUES ('g1', 'u1', ${AT})`), `${name}: a member of a group once`);
        assert(await refused(e, `INSERT INTO "role_permission" ("role_access_role_role_id", "permission_id") VALUES ('r1', 'x1')`), `${name}: a permission of a role once`);
        assert(await refused(e, `INSERT INTO "permission" ("permission_id", "permission_key", "definition", "owner_module") VALUES ('x2', 'invoice:read', 'Again', 'billing')`), `${name}: a permission key is unique`);
        assert(await refused(e, `INSERT INTO "verified_domain" ("verified_domain_id", "domain", "verified_at", "policy", "tenant_id") VALUES ('d2', 'acme.example', ${AT}, 'none', 't2')`), `${name}: a domain is one tenant's`);
        assert(await refused(e, `INSERT INTO "user_account" ("principal_id", "login_identifier", "status", "created_via", "person_party_id") VALUES ('nobody', 'x', 'active', 'invited', 'p1')`), `${name}: an account is a principal's`);
        assert(await refused(e, `INSERT INTO "principal" ("principal_id", "kind", "created_at") VALUES ('u9', 'alien', ${AT})`), `${name}: a kind is checked`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0030-identity FR-004"],
  "every kind, status and method is a code list with a definition of each code, closed unless it says it is open",
  () => {
    const lists: readonly AnyCodeList[] = identityModule.codeLists;
    assert(lists.length > 25);
    for (const l of lists) {
      assert(Object.keys(l.codes).length > 0, l.name);
      for (const [code, spec] of Object.entries(l.codes)) assert((spec.definition ?? "").length > 6 && spec.label.length > 0, `${l.name}.${code}`);
      assert(annotationsOf(l, quality.openness).length === 1, `${l.name} says whether it is open`);
    }
    same(lists.filter((l) => annotationsOf(l, quality.openness)[0] === "open").map((l) => l.name).sort(), ["conditionLanguage", "entitlementSource", "passwordAlgorithm"]);
  },
);

proves(
  ["0030-identity FR-005", "0030-identity FR-006", "0030-identity FR-007"],
  "no concept holds a password, a token or a key in the clear, every concept that holds a secret is restricted, and credentials, sessions and tokens hold what the model says",
  () => {
    const by = new Map(concepts.map((c) => [c.name, c]));
    const attrs = (n: string): string[] => Object.keys((by.get(n) as AnyConcept).attributes);
    const level = (c: AnyConcept): string | undefined => annotationsOf(c, security.classification)[0];
    for (const c of concepts) {
      for (const a of Object.keys(c.attributes)) {
        assert(!/^(password|secret|token|apiKey|privateKey|refreshToken|accessToken)$/i.test(a), `${c.name}.${a} would hold a secret in the clear`);
        if (/secret|token|ciphertext/i.test(a) || a === "hash") assert(level(c) === "restricted", `${c.name}.${a} is a secret: ${c.name} is restricted`);
      }
    }
    same(attrs("passwordCredential"), ["hash", "algorithm", "changedAt", "mustChange"]);
    assert(attrs("otpSecret").includes("secretCiphertext") && attrs("otpSecret").includes("keyReference") && attrs("otpSecret").includes("lastUsedStep"));
    assert(attrs("passkey").includes("publicKey") && !attrs("passkey").some((a) => /private/i.test(a)));
    assert(attrs("loginAttempt").includes("loginIdentifierHash") && !attrs("loginAttempt").includes("loginIdentifier"), "an unknown user leaves nothing personal");
    assert(["tokenHash", "familyId", "usedAt"].every((a) => attrs("refreshToken").includes(a)) && Object.keys((by.get("refreshToken") as AnyConcept).relationships).includes("replacedBy"));
    assert(["assuranceLevel", "absoluteExpiresAt", "idleExpiresAt", "revokedReason"].every((a) => attrs("loginSession").includes(a)));
    for (const n of ["credential", "passwordCredential", "passkey", "otpSecret", "recoveryCode", "challenge", "refreshToken", "invitation", "auditEvent"]) same(level(by.get(n) as AnyConcept), "restricted", n);
  },
);

proves(
  ["0030-identity FR-008", "0030-identity FR-009", "0030-identity FR-010"],
  "on three engines invitations, domains, policies and the audit chain keep what the model says, and a hash in the chain is unique",
  async () => {
    for (const { name } of DIALECTS) {
      const e = await dbWith(name, full);
      try {
        await e.run(`INSERT INTO "principal" ("principal_id", "kind", "created_at") VALUES ('u1', 'user', ${AT})`);
        await e.run(`INSERT INTO "tenant" ("tenant_id", "kind", "slug", "display_name", "ancestry", "status", "isolation", "created_at") VALUES ('t1', 'business', 'acme', 'Acme', '/t1', 'active', 'shared', ${AT})`);
        await e.run(`INSERT INTO "invitation" ("invitation_id", "email", "token_hash", "status", "expires_at", "tenant_id", "invited_by_principal_id") VALUES ('i1', 'a@example.org', 'h1', 'pending', ${AT}, 't1', 'u1')`);
        assert(await refused(e, `INSERT INTO "invitation" ("invitation_id", "email", "token_hash", "status", "expires_at", "tenant_id", "invited_by_principal_id") VALUES ('i2', 'a@example.org', 'h2', 'maybe', ${AT}, 't1', 'u1')`), `${name}: a status is checked`);
        await e.run(`INSERT INTO "password_policy" ("password_policy_id", "min_length", "max_length", "require_breach_check", "history_count") VALUES ('pp1', 12, 128, true, 5)`);
        await e.run(`INSERT INTO "lockout_policy" ("lockout_policy_id", "failed_attempts", "window_minutes", "lock_minutes", "unlock_mode") VALUES ('lp1', 5, 15, 30, 'timer')`);
        assert(await refused(e, `INSERT INTO "lockout_policy" ("lockout_policy_id", "failed_attempts", "window_minutes", "lock_minutes", "unlock_mode") VALUES ('lp2', 5, 15, 30, 'never')`), `${name}: an unlock mode is checked`);
        const audit = (id: string, prev: string, h: string) =>
          `INSERT INTO "audit_event" ("audit_event_id", "occurred_at", "actor_kind", "action", "outcome", "previous_hash", "event_hash") VALUES ('${id}', ${AT}, 'system', 'tenant.created', 'success', '${prev}', '${h}')`;
        await e.run(audit("e1", "genesis", "h-e1"));
        await e.run(audit("e2", "h-e1", "h-e2"));
        assert(await refused(e, audit("e3", "h-e2", "h-e2")), `${name}: an event hash is unique`);
        same(Number((await e.rows(`SELECT count(*) n FROM "audit_event"`))[0]?.["n"]), 2, name);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0030-identity FR-011"],
  "every concept carries a classification and the requirement it cites, what is personal carries its category, and short-lived data says how long it is kept",
  () => {
    for (const c of [...concepts, tenant]) {
      assert(annotationsOf(c, security.classification).length === 1, `${c.name} is classified`);
      assert(annotationsOf(c, requirements.cites).flat().length > 0, `${c.name} cites a requirement`);
    }
    for (const c of concepts) {
      for (const [a, spec] of Object.entries(c.attributes)) {
        if (/^(ip|userAgent|email|loginIdentifier|fingerprintHash)$/.test(a)) assert(annotationsOf(spec, privacy.personal).length === 1, `${c.name}.${a} says what is personal about it`);
      }
    }
    const days = new Map(concepts.map((c) => [c.name, annotationsOf(c, quality.retention)[0]?.days]));
    same(["challenge", "loginAttempt", "device", "loginSession", "refreshToken", "auditEvent"].map((n) => days.get(n)), [1, 30, 180, 90, 30, 365]);
  },
);
