// Spec: 0029-arca-tenancy FR-001, FR-002, FR-003; 0030-identity FR-001, FR-002, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011; 0032-identity-principals FR-001, FR-002, FR-003; 0033-identity-access FR-001, FR-002, FR-003, FR-004; 0034-identity-abac FR-001, FR-002, FR-003; 0035-identity-rebac FR-001, FR-002; 0036-identity-pki FR-001, FR-002; 0037-identity-machine FR-001, FR-002, FR-003; 0038-identity-device FR-001, FR-002, FR-003; 0039-identity-delegation FR-001, FR-002; 0040-identity-agent FR-001, FR-002, FR-003, FR-004
/**
 * The tenancy and identity models (commons data 0029 to 0043), as modules on top of Arca's party model: a project composes the ones it needs into one domain, which is projected, bound for each
 * dialect and loaded into the real engines, where the constraints the models say are enforced for every kind of principal (a person, a machine, a device, an AI agent, a group); and the rules the
 * models hold themselves to (classification, personal data, secrets, provenance, keeping) are checked on the models.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { annotationsOf, composeModules, moduleOf, type AnyCodeList, type AnyConcept, type Domain, type Module, vocabularies, withRequired } from "@intellectual-frontiers/data/governance";
import { partyDomain } from "@intellectual-frontiers/data/models/arca";
import { tenancyModule, tenant } from "@intellectual-frontiers/data/models/arca-tenancy";
import { identityModule } from "@intellectual-frontiers/data/models/identity";
import { identityAbacModule } from "@intellectual-frontiers/data/models/identity-abac";
import { identityAccessModule } from "@intellectual-frontiers/data/models/identity-access";
import { identityAgentModule } from "@intellectual-frontiers/data/models/identity-agent";
import { identityDelegationModule } from "@intellectual-frontiers/data/models/identity-delegation";
import { identityDeviceModule } from "@intellectual-frontiers/data/models/identity-device";
import { identityMachineModule } from "@intellectual-frontiers/data/models/identity-machine";
import { identityPkiModule } from "@intellectual-frontiers/data/models/identity-pki";
import { identityRebacModule } from "@intellectual-frontiers/data/models/identity-rebac";
import { projectDomain } from "@intellectual-frontiers/data/sql/logical";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";

const arca = moduleOf(partyDomain.kind === "ok" ? partyDomain.value : (undefined as never));
const everything: readonly Module[] = [arca, tenancyModule, identityModule, identityAccessModule, identityAbacModule, identityRebacModule, identityPkiModule, identityMachineModule, identityDeviceModule, identityDelegationModule, identityAgentModule];
const composed = (...m: readonly Module[]): Domain => {
  const r = composeModules("app", { definition: "An application" }, m);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const wanted = (...names: string[]): Domain => {
  const w = withRequired(everything, names);
  if (w.kind === "err") throw new Error(JSON.stringify(w.error));
  return composed(...w.value);
};
const full = composed(...everything);
const schemaOf = (d: Domain) => {
  const p = projectDomain(d);
  if (p.kind === "err") throw new Error(JSON.stringify(p.error));
  return p.value.schema;
};
const tableNames = (d: Domain): string[] => schemaOf(d).tables.map((t) => t.name.join("."));
const dbWith = async (name: Engine["name"], d: Domain = full): Promise<Engine> => {
  const e = await openEngine(name);
  const b = bind(schemaOf(d), { dialect: DIALECTS.find((x) => x.name === name)!.dialect });
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
const exec = async (e: Engine, sql: string): Promise<void> => {
  try {
    await e.run(sql);
  } catch (thrown) {
    throw new Error(`${sql.slice(0, 140)}: ${String(thrown)}`);
  }
};
const AT = "'2026-01-01T00:00:00Z'";
const LATER = "'2027-01-01T00:00:00Z'";
const { security, privacy, quality, requirements } = vocabularies;
const allConcepts: readonly AnyConcept[] = [tenant, ...everything.slice(2).flatMap((m) => m.concepts)];
const allLists: readonly AnyCodeList[] = everything.slice(2).flatMap((m) => m.codeLists);

proves(
  ["0029-arca-tenancy FR-001", "0029-arca-tenancy FR-002", "0030-identity FR-001", "0033-identity-access FR-001"],
  "each module names what it requires, a project composes only what it needs and gets no table of the others, and a module whose requirement is not listed is an error as a value",
  () => {
    same(tenancyModule.requires, ["arcaParty"]);
    same(identityModule.requires, ["arcaParty", "arcaTenancy"]);
    same([identityAccessModule.requires, identityAbacModule.requires, identityRebacModule.requires, identityPkiModule.requires], [["identity"], ["identityAccess"], ["identityAccess"], ["identity"]]);
    same([identityMachineModule.requires, identityDeviceModule.requires, identityDelegationModule.requires, identityAgentModule.requires], [["identityPki"], ["identityPki"], ["identityAccess", "identityAbac"], ["identityDelegation", "identityRebac"]]);
    const r = composeModules("app", {}, [arca, identityModule]);
    assert(r.kind === "err" && r.error.some((e) => e.kind === "missing" && e.requires === "arcaTenancy"));
    const core = tableNames(wanted("identity"));
    assert(core.includes("principal") && core.includes("login.session") && !core.includes("access.role") && !core.includes("agent") && !core.includes("device"), "the core has none of the others");
    const access = tableNames(wanted("identityAccess"));
    assert(access.includes("access.role") && access.includes("role.assignment") && !access.includes("attribute.definition") && !access.includes("agent.run"));
    const agent = tableNames(wanted("identityAgent"));
    assert(agent.includes("agent.run") && agent.includes("delegation") && agent.includes("attribute.definition") && !agent.includes("device") && !agent.includes("api.key"), "an agent needs delegation, attributes and relations, not devices or keys");
    const order = withRequired(everything, ["identityAgent"]);
    assert(order.kind === "ok");
    if (order.kind === "ok") same(order.value.map((m) => m.name), ["arcaParty", "arcaTenancy", "identity", "identityAccess", "identityAbac", "identityDelegation", "identityRebac", "identityAgent"]);
  },
);

proves(
  ["0029-arca-tenancy FR-003", "0030-identity FR-002", "0032-identity-principals FR-001", "0032-identity-principals FR-002"],
  "the whole composition binds for each dialect and loads into each real engine, and on every engine a principal of any of the five kinds has a status and an owner that is not itself, and a tenant has a unique slug and is not its own parent",
  async () => {
    assert(schemaOf(full).tables.length > 85);
    for (const { name } of DIALECTS) {
      const e = await dbWith(name);
      try {
        const p = (id: string, kind: string, status = "active", owner = "NULL", tenantId = "NULL") =>
          `INSERT INTO "principal" ("principal_id", "kind", "status", "status_changed_at", "created_at", "owner_principal_id", "tenant_id") VALUES ('${id}', '${kind}', '${status}', ${AT}, ${AT}, ${owner}, ${tenantId})`;
        const t = (id: string, slug: string, kind = "platform", parent = "NULL") =>
          `INSERT INTO "tenant" ("tenant_id", "kind", "slug", "display_name", "ancestry", "status", "isolation", "created_at", "parent_tenant_id") VALUES ('${id}', '${kind}', '${slug}', 'T', '/', 'active', 'shared', ${AT}, ${parent})`;
        await e.run(t("t1", "platform"));
        await e.run(t("t2", "acme", "business", "'t1'"));
        assert(await refused(e, t("t3", "acme")), `${name}: a slug is unique`);
        assert(await refused(e, t("t4", "x", "business", "'t4'")), `${name}: a tenant is not its own parent`);
        await e.run(p("u1", "user"));
        for (const [id, kind] of [["m1", "machine"], ["d1", "device"], ["a1", "agent"], ["g1", "group"]] as const) await e.run(p(id, kind, "active", "'u1'", "'t2'"));
        assert(await refused(e, p("x1", "robot")), `${name}: a kind is checked`);
        assert(await refused(e, p("x2", "agent", "sleeping")), `${name}: a status is checked`);
        assert(await refused(e, p("x3", "agent", "active", "'x3'")), `${name}: a principal is not its own owner`);
        assert(await refused(e, p("x4", "agent", "active", "'nobody'")), `${name}: an owner is a principal`);
        same(Number((await e.rows(`SELECT count(*) n FROM "principal"`))[0]?.["n"]), 5, name);
        // a person's account, membership of tenants once, and a group whose members are principals of any kind
        await e.run(`INSERT INTO "party" ("party_id", "party_kind_code", "display_name") VALUES ('p1', 'person', 'Ann')`);
        await e.run(`INSERT INTO "person" ("party_id", "given_name", "family_name") VALUES ('p1', 'Ann', 'Lee')`);
        await e.run(`INSERT INTO "user_account" ("principal_id", "login_identifier", "created_via", "person_party_id") VALUES ('u1', 'ann', 'invited', 'p1')`);
        assert(await refused(e, `INSERT INTO "user_account" ("principal_id", "login_identifier", "created_via", "person_party_id") VALUES ('m1', 'x', 'invited', 'nobody')`), `${name}: an account is a person's`);
        const mem = (id: string, tenantId: string) => `INSERT INTO "membership" ("membership_id", "status", "source", "user_account_principal_id", "tenant_id") VALUES ('${id}', 'active', 'invited', 'u1', '${tenantId}')`;
        await e.run(mem("ms1", "t1"));
        await e.run(mem("ms2", "t2"));
        assert(await refused(e, mem("ms3", "t1")), `${name}: a membership once`);
        await e.run(`INSERT INTO "user_group" ("principal_id", "name", "source", "tenant_id") VALUES ('g1', 'finance', 'local', 't2')`);
        const gm = (member: string) => `INSERT INTO "group_member" ("group_user_group_principal_id", "member_principal_id", "added_at") VALUES ('g1', '${member}', ${AT})`;
        for (const member of ["u1", "m1", "d1", "a1"]) await e.run(gm(member));
        assert(await refused(e, gm("a1")), `${name}: a member of a group once, whatever its kind`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0033-identity-access FR-002", "0033-identity-access FR-003", "0033-identity-access FR-004", "0034-identity-abac FR-001", "0034-identity-abac FR-002", "0034-identity-abac FR-003", "0035-identity-rebac FR-001", "0035-identity-rebac FR-002"],
  "on three engines any kind of principal holds roles once, roles inherit and are separated, attributes of any principal and resource are one value each, policies and relation tuples and the permissions they grant are unique",
  async () => {
    for (const { name } of DIALECTS) {
      const e = await dbWith(name);
      try {
        const run = async (...sql: string[]): Promise<void> => {
          for (const s of sql) await e.run(s);
        };
        await run(
          `INSERT INTO "tenant" ("tenant_id", "kind", "slug", "display_name", "ancestry", "status", "isolation", "created_at") VALUES ('t1', 'business', 'acme', 'Acme', '/t1', 'active', 'shared', ${AT})`,
          ...["u1", "m1"].map((id, i) => `INSERT INTO "principal" ("principal_id", "kind", "status", "status_changed_at", "created_at") VALUES ('${id}', '${i === 0 ? "user" : "machine"}', 'active', ${AT}, ${AT})`),
          `INSERT INTO "permission" ("permission_id", "permission_key", "definition", "owner_module", "risk_level", "side_effect") VALUES ('p1', 'invoice:read', 'Read invoices', 'billing', 'low', 'read'), ('p2', 'invoice:pay', 'Pay invoices', 'billing', 'high', 'irreversible')`,
          `INSERT INTO "access_role" ("role_id", "role_key", "name", "kind", "definition", "is_privileged", "status") VALUES ('r1', 'viewer', 'Viewer', 'system', 'Reads', false, 'active'), ('r2', 'payer', 'Payer', 'system', 'Pays', true, 'active')`,
          `INSERT INTO "role_inheritance" ("senior_access_role_role_id", "junior_access_role_role_id") VALUES ('r2', 'r1')`,
          `INSERT INTO "role_permission" ("role_access_role_role_id", "permission_id") VALUES ('r1', 'p1'), ('r2', 'p2')`,
          `INSERT INTO "separation_rule" ("separation_rule_id", "name", "separation_kind_code", "limit_count", "status") VALUES ('s1', 'No viewer and payer', 'static', 2, 'active')`,
          `INSERT INTO "separation_rule_role" ("rule_separation_rule_id", "role_access_role_role_id") VALUES ('s1', 'r1'), ('s1', 'r2')`,
        );
        const ra = (id: string, who: string, role: string, key: string) =>
          `INSERT INTO "role_assignment" ("role_assignment_id", "valid_from", "status", "via", "assignment_key", "principal_id", "role_access_role_role_id", "tenant_id", "granted_by_principal_id") VALUES ('${id}', ${AT}, 'active', 'direct', '${key}', '${who}', '${role}', 't1', 'u1')`;
        await run(ra("a1", "u1", "r1", "k-u1-r1"), ra("a2", "m1", "r2", "k-m1-r2"));
        assert(await refused(e, ra("a3", "u1", "r1", "k-u1-r1")), `${name}: a grant is not made twice, even with no resource`);
        assert(await refused(e, `INSERT INTO "role_inheritance" ("senior_access_role_role_id", "junior_access_role_role_id") VALUES ('r1', 'r1')`), `${name}: a role does not inherit itself`);
        assert(await refused(e, `INSERT INTO "role_permission" ("role_access_role_role_id", "permission_id") VALUES ('r1', 'p1')`), `${name}: a permission of a role once`);
        assert(await refused(e, `INSERT INTO "permission" ("permission_id", "permission_key", "definition", "owner_module", "risk_level", "side_effect") VALUES ('p3', 'invoice:read', 'Again', 'billing', 'low', 'read')`), `${name}: a permission key is unique`);
        assert(await refused(e, `INSERT INTO "permission" ("permission_id", "permission_key", "definition", "owner_module", "risk_level", "side_effect") VALUES ('p4', 'x:y', 'Bad', 'billing', 'enormous', 'read')`), `${name}: a risk level is checked`);
        // attributes
        await run(
          `INSERT INTO "attribute_definition" ("attribute_definition_id", "attribute_key", "category", "value_type", "source", "sensitivity", "definition", "status") VALUES ('ad1', 'subject.department', 'subject', 'text', 'directory', 'internal', 'The department', 'active')`,
          `INSERT INTO "principal_attribute" ("principal_id", "definition_attribute_definition_id", "value", "valid_from", "updated_at") VALUES ('m1', 'ad1', '"finance"', ${AT}, ${AT})`,
          `INSERT INTO "resource_attribute" ("resource_attribute_id", "resource_type", "resource_id", "value", "updated_at", "value_key", "tenant_id", "definition_attribute_definition_id") VALUES ('ra1', 'invoice', 'i1', '"high"', ${AT}, 'vk1', 't1', 'ad1')`,
        );
        assert(await refused(e, `INSERT INTO "principal_attribute" ("principal_id", "definition_attribute_definition_id", "value", "valid_from", "updated_at") VALUES ('m1', 'ad1', '"sales"', ${AT}, ${AT})`), `${name}: a principal has one value of an attribute`);
        assert(await refused(e, `INSERT INTO "attribute_definition" ("attribute_definition_id", "attribute_key", "category", "value_type", "source", "sensitivity", "definition", "status") VALUES ('ad2', 'subject.department', 'subject', 'text', 'stored', 'internal', 'Again', 'active')`), `${name}: an attribute key is unique`);
        assert(await refused(e, `INSERT INTO "resource_attribute" ("resource_attribute_id", "resource_type", "resource_id", "value", "updated_at", "value_key", "tenant_id", "definition_attribute_definition_id") VALUES ('ra2', 'invoice', 'i1', '"low"', ${AT}, 'vk1', 't1', 'ad1')`), `${name}: a resource has one value of an attribute`);
        const pol = (id: string, key: string, effect = "allow") =>
          `INSERT INTO "access_policy" ("access_policy_id", "name", "definition", "effect", "action_pattern", "expression", "expression_language_code", "obligation", "priority", "status", "version", "policy_key") VALUES ('${id}', 'n', 'd', '${effect}', 'invoice:*', '{}', 'expr', 'none', 1, 'active', 1, '${key}')`;
        await run(pol("pp1", "pk1"));
        assert(await refused(e, pol("pp2", "pk1")), `${name}: a policy version is unique`);
        assert(await refused(e, pol("pp3", "pk3", "maybe")), `${name}: an effect is checked`);
        // relationship-based access
        const tup = (id: string, key: string) =>
          `INSERT INTO "relation_tuple" ("relation_tuple_id", "tuple_key", "object_type", "object_id", "relation", "subject_type", "subject_id", "created_at", "tenant_id") VALUES ('${id}', '${key}', 'folder', 'f1', 'viewer', 'agent', 'a1', ${AT}, 't1')`;
        await run(tup("rt1", "tk1"), `INSERT INTO "permission_relation" ("object_type", "relation", "permission_id") VALUES ('folder', 'viewer', 'p1')`);
        assert(await refused(e, tup("rt2", "tk1")), `${name}: a fact is recorded once`);
        assert(await refused(e, `INSERT INTO "permission_relation" ("object_type", "relation", "permission_id") VALUES ('folder', 'editor', 'p1')`), `${name}: a relation grants a permission for an object type once`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0036-identity-pki FR-001", "0036-identity-pki FR-002", "0037-identity-machine FR-001", "0037-identity-machine FR-002", "0037-identity-machine FR-003", "0038-identity-device FR-001", "0038-identity-device FR-002", "0038-identity-device FR-003"],
  "on three engines machines have workload identities, keys and certificates that are unique, and devices have attestations, posture and sessions, all as principals of their kind",
  async () => {
    for (const { name } of DIALECTS) {
      const e = await dbWith(name);
      try {
        const principal = (id: string, kind: string) => `INSERT INTO "principal" ("principal_id", "kind", "status", "status_changed_at", "created_at") VALUES ('${id}', '${kind}', 'active', ${AT}, ${AT})`;
        const cred = (id: string, who: string, kind: string) => `INSERT INTO "credential" ("credential_id", "credential_kind_code", "status", "created_at", "principal_id") VALUES ('${id}', '${kind}', 'active', ${AT}, '${who}')`;
        await exec(e, principal("m1", "machine"));
        await exec(e, principal("d1", "device"));
        await exec(e, `INSERT INTO "machine" ("principal_id", "machine_kind", "purpose", "is_break_glass") VALUES ('m1', 'service', 'Bills', false)`);
        const wl = (id: string, key: string) =>
          `INSERT INTO "workload_identity" ("workload_identity_id", "issuer_kind", "issuer", "subject", "status", "binding_key", "machine_principal_id") VALUES ('${id}', 'spiffe', 'td.example', 'spiffe://td.example/bills', 'active', '${key}', 'm1')`;
        await exec(e, wl("w1", "bk1"));
        assert(await refused(e, wl("w2", "bk1")), `${name}: a workload is bound once`);
        await exec(e, cred("c1", "m1", "api_key"));
        await exec(e, `INSERT INTO "api_key" ("credential_id", "prefix", "secret_hash") VALUES ('c1', 'ak_live_1', 'h')`);
        await exec(e, cred("c2", "m1", "api_key"));
        assert(await refused(e, `INSERT INTO "api_key" ("credential_id", "prefix", "secret_hash") VALUES ('c2', 'ak_live_1', 'h2')`), `${name}: a key prefix is unique`);
        await exec(e, cred("c3", "m1", "certificate"));
        const cert = (id: string, fp: string) =>
          `INSERT INTO "certificate" ("credential_id", "fingerprint", "serial", "subject_name", "not_before", "not_after", "key_algorithm") VALUES ('${id}', '${fp}', '1', 'CN=bills', ${AT}, ${LATER}, 'ECDSA')`;
        await exec(e, cert("c3", "fp1"));
        await exec(e, cred("c4", "d1", "certificate"));
        assert(await refused(e, cert("c4", "fp1")), `${name}: a certificate fingerprint is unique`);
        await exec(e, cred("c5", "m1", "key_pair"));
        await exec(e, `INSERT INTO "key_credential" ("credential_id", "public_jwk", "thumbprint", "algorithm") VALUES ('c5', '{"kty":"EC"}', 'th1', 'ES256')`);
        // a device
        await exec(e, `INSERT INTO "device" ("principal_id", "device_kind", "platform_code", "hardware_hash", "management_state", "ownership", "enrolled_at") VALUES ('d1', 'laptop', 'macos', 'hh1', 'managed', 'corporate', ${AT})`);
        await exec(e, `INSERT INTO "device_posture" ("device_posture_id", "source", "compliance", "disk_encrypted", "reported_at", "valid_until", "device_principal_id") VALUES ('dp1', 'mdm', 'compliant', true, ${AT}, ${LATER}, 'd1')`);
        assert(await refused(e, `INSERT INTO "device_posture" ("device_posture_id", "source", "compliance", "reported_at", "valid_until", "device_principal_id") VALUES ('dp2', 'mdm', 'fine', ${AT}, ${LATER}, 'd1')`), `${name}: compliance is checked`);
        assert(await refused(e, `INSERT INTO "device" ("principal_id", "device_kind", "platform_code", "hardware_hash", "management_state", "ownership", "enrolled_at") VALUES ('nobody', 'laptop', 'macos', 'hh2', 'managed', 'corporate', ${AT})`), `${name}: a device is a principal`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0039-identity-delegation FR-001", "0039-identity-delegation FR-002", "0040-identity-agent FR-001", "0040-identity-agent FR-002", "0040-identity-agent FR-003", "0040-identity-agent FR-004"],
  "on three engines an agent has an owner, versions that are pinned, tool grants, runs under delegations with the chain kept, budgets that are one per meter and window, calls that are one per index, and approvals bound to arguments",
  async () => {
    for (const { name } of DIALECTS) {
      const e = await dbWith(name);
      try {
        const run = async (...sql: string[]): Promise<void> => {
          for (const s of sql) await e.run(s);
        };
        const principal = (id: string, kind: string, owner = "NULL") => `INSERT INTO "principal" ("principal_id", "kind", "status", "status_changed_at", "created_at", "owner_principal_id") VALUES ('${id}', '${kind}', 'active', ${AT}, ${AT}, ${owner})`;
        await run(
          `INSERT INTO "tenant" ("tenant_id", "kind", "slug", "display_name", "ancestry", "status", "isolation", "created_at") VALUES ('t1', 'business', 'acme', 'Acme', '/t1', 'active', 'shared', ${AT})`,
          principal("u1", "user"),
          principal("a1", "agent", "'u1'"),
          principal("a2", "agent", "'u1'"),
          `INSERT INTO "agent" ("principal_id", "autonomy", "purpose", "approval_threshold", "max_delegation_depth") VALUES ('a1', 'act_with_approval', 'Pays invoices', 'high', 2), ('a2', 'suggest', 'Helps', 'medium', 1)`,
          `INSERT INTO "permission" ("permission_id", "permission_key", "definition", "owner_module", "risk_level", "side_effect") VALUES ('p1', 'invoice:pay', 'Pay', 'billing', 'high', 'irreversible')`,
        );
        const version = (id: string, label: string, key: string) =>
          `INSERT INTO "agent_version" ("agent_version_id", "version_label", "model_provider", "model_name", "model_version", "prompt_hash", "tool_manifest_hash", "status", "created_at", "version_key", "agent_principal_id") VALUES ('${id}', '${label}', 'acme-ai', 'm1', '2026-01-01', 'ph', 'th', 'approved', ${AT}, '${key}', 'a1')`;
        await run(version("v1", "1.0", "vk1"));
        assert(await refused(e, version("v2", "1.0", "vk1")), `${name}: a version label is unique for its agent`);
        assert(await refused(e, `INSERT INTO "agent_version" ("agent_version_id", "version_label", "model_provider", "model_name", "model_version", "prompt_hash", "tool_manifest_hash", "status", "created_at", "version_key", "agent_principal_id") VALUES ('v3', '2.0', 'p', 'm', 'v', 'ph', 'th', 'beta', ${AT}, 'vk3', 'a1')`), `${name}: a version status is checked`);
        await run(
          `INSERT INTO "agent_tool" ("agent_tool_id", "name", "definition", "risk_level", "side_effect", "status", "permission_id") VALUES ('tl1', 'pay_invoice', 'Pays', 'high', 'irreversible', 'active', 'p1')`,
          `INSERT INTO "tool_grant" ("agent_principal_id", "tool_agent_tool_id", "approval", "status", "granted_by_principal_id") VALUES ('a1', 'tl1', 'inherit', 'active', 'u1')`,
        );
        assert(await refused(e, `INSERT INTO "tool_grant" ("agent_principal_id", "tool_agent_tool_id", "approval", "status", "granted_by_principal_id") VALUES ('a1', 'tl1', 'always', 'active', 'u1')`), `${name}: a tool is granted once`);
        // a delegation chain, root first
        const del = (id: string, depth: number, from: string, to: string, parent: string, root: string, max: number) =>
          `INSERT INTO "delegation" ("delegation_id", "depth", "purpose", "redelegable", "max_depth", "valid_from", "expires_at", "status", "tenant_id", "delegator_principal_id", "delegate_principal_id", "parent_delegation_id", "root_delegation_id") VALUES ('${id}', ${depth}, 'pay', true, ${max}, ${AT}, ${LATER}, 'active', 't1', '${from}', '${to}', ${parent}, ${root})`;
        await run(del("dg1", 0, "u1", "a1", "NULL", "NULL", 2), del("dg2", 1, "a1", "a2", "'dg1'", "'dg1'", 1));
        assert(await refused(e, del("dg3", 0, "u1", "u1", "NULL", "NULL", 1)), `${name}: nobody delegates to themselves`);
        assert(await refused(e, del("dg4", 1, "a1", "a2", "'nothing'", "NULL", 1)), `${name}: a delegation has a delegation above it`);
        await run(`INSERT INTO "delegation_permission" ("delegation_id", "permission_id") VALUES ('dg1', 'p1')`);
        assert(await refused(e, `INSERT INTO "delegation_permission" ("delegation_id", "permission_id") VALUES ('dg1', 'p1')`), `${name}: a permission is passed on once`);
        // a run, budgets, calls, approvals
        await run(`INSERT INTO "agent_run" ("run_id", "started_at", "status", "agent_principal_id", "version_agent_version_id", "tenant_id", "initiator_principal_id", "delegation_id") VALUES ('r1', ${AT}, 'running', 'a1', 'v1', 't1', 'u1', 'dg1')`);
        const budget = (id: string, key: string, meter = "tool_calls") =>
          `INSERT INTO "agent_budget" ("budget_id", "meter", "window_kind", "limit_value", "used", "window_start", "version", "status", "budget_key", "agent_principal_id", "run_agent_run_run_id") VALUES ('${id}', '${meter}', 'run', 10, 0, ${AT}, 0, 'active', '${key}', 'a1', 'r1')`;
        await run(budget("b1", "bk1"));
        assert(await refused(e, budget("b2", "bk1")), `${name}: one budget for a meter and a window`);
        assert(await refused(e, budget("b3", "bk3", "kilowatts")), `${name}: a meter is checked`);
        const call = (id: string, idx: number, key: string, decision = "allowed") =>
          `INSERT INTO "tool_call" ("tool_call_id", "call_index", "decision", "status", "args_hash", "requested_at", "call_key", "run_agent_run_run_id", "tool_agent_tool_id") VALUES ('${id}', ${idx}, '${decision}', 'requested', 'ah', ${AT}, '${key}', 'r1', 'tl1')`;
        await run(call("tc1", 1, "ck1"));
        assert(await refused(e, call("tc2", 1, "ck1")), `${name}: one call for an index of a run`);
        assert(await refused(e, call("tc3", 2, "ck3", "maybe")), `${name}: a decision is checked`);
        await run(`INSERT INTO "approval_request" ("approval_request_id", "action_key", "args_hash", "summary", "risk_level", "approver_rule", "status", "requested_at", "expires_at", "run_agent_run_run_id", "agent_principal_id") VALUES ('ap1', 'invoice:pay', 'ah', 'Pay invoice i1', 'high', 'delegator', 'pending', ${AT}, ${LATER}, 'r1', 'a1')`);
        assert(await refused(e, `INSERT INTO "approval_request" ("approval_request_id", "action_key", "args_hash", "summary", "risk_level", "approver_rule", "status", "requested_at", "expires_at", "run_agent_run_run_id", "agent_principal_id") VALUES ('ap2', 'invoice:pay', 'ah', 'x', 'high', 'anyone', 'pending', ${AT}, ${LATER}, 'r1', 'a1')`), `${name}: an approver rule is checked`);
        assert(await refused(e, `INSERT INTO "agent_run" ("run_id", "started_at", "status", "agent_principal_id", "version_agent_version_id", "tenant_id") VALUES ('r2', ${AT}, 'dreaming', 'a1', 'v1', 't1')`), `${name}: a run status is checked`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0030-identity FR-004", "0032-identity-principals FR-003"],
  "every kind, status and method of every module is a code list with a definition of each code, closed unless it says it is open",
  () => {
    assert(allLists.length > 60, String(allLists.length));
    for (const l of allLists) {
      assert(Object.keys(l.codes).length > 0, l.name);
      for (const [code, spec] of Object.entries(l.codes)) assert((spec.definition ?? "").length > 6 && spec.label.length > 0, `${l.name}.${code}`);
      assert(annotationsOf(l, quality.openness).length === 1, `${l.name} says whether it is open`);
    }
    const open = allLists.filter((l) => annotationsOf(l, quality.openness)[0] === "open").map((l) => l.name);
    for (const n of ["credentialKind", "passwordAlgorithm", "entitlementSource", "expressionLanguage", "platform", "environment", "separationKind"]) assert(open.includes(n) || n === "credentialKind", n);
    same(Object.keys(allLists.find((l) => l.name === "principalKind")!.codes), ["user", "machine", "device", "agent", "group"]);
  },
);

proves(
  ["0030-identity FR-005", "0030-identity FR-006", "0030-identity FR-007", "0037-identity-machine FR-003", "0040-identity-agent FR-002", "0040-identity-agent FR-004"],
  "no concept of any module holds a secret, a prompt or raw arguments in the clear, every concept that holds a secret is restricted, and an agent's provenance and its calls are kept as pinned versions and hashes",
  () => {
    const by = new Map(allConcepts.map((c) => [c.name, c]));
    const attrs = (n: string): string[] => Object.keys((by.get(n) as AnyConcept).attributes);
    const level = (c: AnyConcept): string | undefined => annotationsOf(c, security.classification)[0];
    for (const c of allConcepts) {
      for (const a of Object.keys(c.attributes)) {
        assert(!/^(password|secret|token|apiKey|privateKey|refreshToken|accessToken|prompt|systemPrompt|arguments|args|clientSecret)$/i.test(a), `${c.name}.${a} would hold a secret, a prompt or raw arguments in the clear`);
        if ((/secret|token|ciphertext/i.test(a) && !/^tokens(In|Out)$/.test(a)) || a === "hash") assert(level(c) === "restricted", `${c.name}.${a} is a secret: ${c.name} is restricted`);
      }
    }
    same(attrs("passwordCredential"), ["hash", "algorithm", "changedAt", "mustChange"]);
    assert(attrs("otpSecret").includes("secretCiphertext") && attrs("otpSecret").includes("keyReference"));
    assert(!attrs("passkey").some((a) => /private/i.test(a)) && !attrs("keyCredential").some((a) => /private/i.test(a)) && !attrs("certificate").some((a) => /private/i.test(a)), "only the public half of a key");
    assert(["prefix", "secretHash", "scopes"].every((a) => attrs("apiKey").includes(a)), "a key is found by a prefix, kept as a keyed hash, narrowed by scopes");
    assert(["modelProvider", "modelName", "modelVersion", "promptHash", "toolManifestHash"].every((a) => attrs("agentVersion").includes(a)), "an agent's provenance is pinned");
    assert(["argsHash", "argsSummary", "callIndex", "decision"].every((a) => attrs("toolCall").includes(a)) && !attrs("toolCall").some((a) => /^args$|arguments/i.test(a)));
    assert(["argsHash", "status", "expiresAt", "consumedAt"].every((a) => attrs("approvalRequest").includes(a)), "an approval is bound to arguments and used once");
    for (const n of ["credential", "passwordCredential", "passkey", "otpSecret", "recoveryCode", "challenge", "refreshToken", "invitation", "auditEvent", "apiKey", "keyCredential", "certificate"]) same(level(by.get(n) as AnyConcept), "restricted", n);
    assert(["onBehalfOf", "actor"].every((r) => r in (by.get("auditEvent") as AnyConcept).relationships) && ["chain", "decision", "policyRefs", "delegationKey", "runKey"].every((a) => attrs("auditEvent").includes(a)), "the audit trail keeps who, on behalf of whom, and what decided");
  },
);

proves(
  ["0030-identity FR-008", "0030-identity FR-009", "0030-identity FR-010", "0033-identity-access FR-003"],
  "on three engines invitations grant roles once, domains and policies and the audit chain keep what the model says, and a hash in the chain is unique",
  async () => {
    for (const { name } of DIALECTS) {
      const e = await dbWith(name);
      try {
        await e.run(`INSERT INTO "principal" ("principal_id", "kind", "status", "status_changed_at", "created_at") VALUES ('u1', 'user', 'active', ${AT}, ${AT})`);
        await e.run(`INSERT INTO "tenant" ("tenant_id", "kind", "slug", "display_name", "ancestry", "status", "isolation", "created_at") VALUES ('t1', 'business', 'acme', 'Acme', '/t1', 'active', 'shared', ${AT})`);
        const inv = (id: string, status: string) => `INSERT INTO "invitation" ("invitation_id", "email", "token_hash", "status", "expires_at", "tenant_id", "invited_by_principal_id") VALUES ('${id}', 'a@example.org', 'h-${id}', '${status}', ${AT}, 't1', 'u1')`;
        await e.run(inv("i1", "pending"));
        assert(await refused(e, inv("i2", "maybe")), `${name}: a status is checked`);
        await e.run(`INSERT INTO "access_role" ("role_id", "role_key", "name", "kind", "definition", "is_privileged", "status") VALUES ('r1', 'viewer', 'Viewer', 'system', 'Reads', false, 'active')`);
        await e.run(`INSERT INTO "invitation_role" ("invitation_id", "role_access_role_role_id") VALUES ('i1', 'r1')`);
        assert(await refused(e, `INSERT INTO "invitation_role" ("invitation_id", "role_access_role_role_id") VALUES ('i1', 'r1')`), `${name}: a role of an invitation once`);
        await e.run(`INSERT INTO "lockout_policy" ("lockout_policy_id", "failed_attempts", "window_minutes", "lock_minutes", "unlock_mode") VALUES ('lp1', 5, 15, 30, 'timer')`);
        assert(await refused(e, `INSERT INTO "lockout_policy" ("lockout_policy_id", "failed_attempts", "window_minutes", "lock_minutes", "unlock_mode") VALUES ('lp2', 5, 15, 30, 'never')`), `${name}: an unlock mode is checked`);
        const audit = (id: string, seq: number, prev: string, h: string, kind = "agent") =>
          `INSERT INTO "audit_event" ("audit_event_id", "sequence", "occurred_at", "actor_kind", "action", "outcome", "previous_hash", "event_hash", "decision", "actor_principal_id", "on_behalf_of_principal_id") VALUES ('${id}', ${seq}, ${AT}, '${kind}', 'invoice.paid', 'success', '${prev}', '${h}', 'allow', 'u1', 'u1')`;
        await e.run(audit("e1", 1, "genesis", "h-e1"));
        await e.run(audit("e2", 2, "h-e1", "h-e2"));
        assert(await refused(e, audit("e3", 3, "h-e2", "h-e2")), `${name}: an event hash is unique`);
        assert(await refused(e, audit("e5", 2, "h-e2", "h-e5")), `${name}: a place in the trail is taken once`);
        assert(await refused(e, audit("e4", 3, "h-e2", "h-e4", "robot")), `${name}: an actor kind is checked`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0030-identity FR-011", "0038-identity-device FR-001"],
  "every concept carries a classification and the requirement it cites, what is personal carries its category, and short-lived data says how long it is kept",
  () => {
    for (const c of allConcepts) {
      assert(annotationsOf(c, security.classification).length === 1, `${c.name} is classified`);
      assert(annotationsOf(c, requirements.cites).flat().length > 0, `${c.name} cites a requirement`);
    }
    for (const c of allConcepts)
      for (const [a, spec] of Object.entries(c.attributes))
        if (/^(ip|userAgent|email|loginIdentifier|fingerprintHash|hardwareHash)$/.test(a)) assert(annotationsOf(spec, privacy.personal).length === 1, `${c.name}.${a} says what is personal about it`);
    const days = new Map(allConcepts.map((c) => [c.name, annotationsOf(c, quality.retention)[0]?.days]));
    same(["challenge", "loginAttempt", "knownBrowser", "loginSession", "refreshToken", "auditEvent", "deviceAttestation", "devicePosture", "deviceSession", "delegation", "agentRun", "toolCall", "approvalRequest"].map((n) => days.get(n)), [1, 30, 180, 90, 30, 365, 90, 30, 90, 365, 365, 365, 365]);
  },
);

proves(
  ["0030-identity FR-002", "0030-identity FR-005", "0030-identity FR-006"],
  "the identity model's uniques are in the database: one login in a tenant, one name for a group in a tenant, one passkey credential id, one hash for a refresh token, one verified domain, one membership of a user in a tenant",
  () => {
    const b = bind(schemaOf(full), { dialect: DIALECTS[0].dialect });
    assert(b.kind === "ok");
    const uniques = (table: string): string[] => {
      const sql = b.kind === "ok" ? (b.value.statements.find((s) => s.group === "table" && s.sql.startsWith(`CREATE TABLE IF NOT EXISTS "${table}" `))?.sql ?? "") : "";
      return [...sql.matchAll(/UNIQUE \(([^)]*)\)/g)].map((m) => (m[1] ?? "").replaceAll('"', "").replaceAll(" ", ""));
    };
    same(uniques("user_account").some((u) => u.includes("login_identifier")), true, "login");
    same(uniques("user_group").some((u) => u === "tenant_id,name"), true, "group name");
    same(uniques("passkey"), ["credential_id_value"], "passkey credential id");
    same(uniques("refresh_token"), ["token_hash"], "refresh token hash");
    same(uniques("verified_domain"), ["domain"], "verified domain");
    same(uniques("membership").length, 1, "one membership");
  },
);
