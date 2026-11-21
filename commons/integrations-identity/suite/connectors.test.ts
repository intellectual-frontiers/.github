/**
 * Tests of the identity and device connectors (commons integrations-identity 0002-identity-connectors FR-001 to FR-007): governance of each, the posture of an Entra tenant, Intune devices and a Google Workspace domain from recorded made-up answers, the policies that fail and warn, what is and is not kept,
 * a gap where a part is not readable, an error where nothing is reachable, and the conformance suite of integrations.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { parseInstant } from "@intellectual-frontiers/integrations/governance";
import { conformConnector, type Connector, type Json, type ReadPort } from "@intellectual-frontiers/integrations/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { entraGovernance, googleWorkspaceGovernance, intuneGovernance } from "../src/governance/mod.ts";
import { entraConnector, googleWorkspaceConnector, intuneConnector } from "../src/logical/mod.ts";

const NOW = (() => {
  const r = parseInstant("2026-11-21T10:00:00Z");
  if (r.kind === "err") throw new Error("instant");
  return r.value;
})();

function port(docs: Record<string, Json>, lists: Record<string, readonly Json[]>, denied: readonly string[] = []): ReadPort {
  return {
    get: (p) => Promise.resolve(docs[p] === undefined ? err({ kind: "not-found" as const, subject: p }) : ok(docs[p])),
    pages: async function* (p) {
      if (denied.includes(p)) return err({ kind: "denied" as const, subject: p });
      const l = lists[p];
      if (l === undefined) return err({ kind: "not-found" as const, subject: p });
      yield* l;
      return ok(1);
    },
  };
}
const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

const REG = "/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=999";
const CA = "/v1.0/identity/conditionalAccess/policies";
const entraDocs = { "/v1.0/organization": { value: [{ displayName: "Contoso" }] } };
const entraLists = {
  [REG]: [
    { userPrincipalName: "ada@contoso.example", userDisplayName: "Ada", isAdmin: true, isMfaRegistered: true, mobilePhone: "+1 555 0100" },
    { userPrincipalName: "root@contoso.example", userDisplayName: "Root", isAdmin: true, isMfaRegistered: false },
    { userPrincipalName: "bob@contoso.example", userDisplayName: "Bob", isAdmin: false, isMfaRegistered: false },
    { userPrincipalName: "cy@contoso.example", userDisplayName: "Cy", isAdmin: false, isMfaRegistered: true },
  ],
  [CA]: [{ displayName: "Require MFA", state: "enabled", grantControls: { builtInControls: ["mfa"] } }, { displayName: "Old", state: "disabled", grantControls: { builtInControls: ["block"] } }],
};

proves(["0002-identity-connectors FR-001"], "each governance is read-only, scoped to what it reads, names its hosts and token service, and is a function of the tenant", () => {
  for (const g of [must(entraGovernance("Contoso.Example")), must(intuneGovernance("Contoso.Example")), must(googleWorkspaceGovernance("Contoso.Example"))]) {
    assertEquals(g.contract.writes, "never");
    assert(g.scope.grants.length > 0 && g.scope.grants.every((x) => x.access === "read"));
    assert(g.credential.ref.includes("contoso.example-read"), g.credential.ref);
    assert(g.transport.kind === "https" && g.transport.hosts.length === 2);
    assert(g.contract.tokenEndpoints.every((t) => t.startsWith("https://")));
  }
  assert(must(entraGovernance("a")).credential.fields.some((f) => /Reports\.Read\.All/.test(f.hint ?? "")));
  assert(must(googleWorkspaceGovernance("a")).credential.fields.some((f) => /readonly/.test(f.hint ?? "")));
  for (const c of [entraConnector("t"), intuneConnector("t"), googleWorkspaceConnector("t")]) assertEquals(must(c).describe().readOnly, true);
});

proves(["0002-identity-connectors FR-002", "0002-identity-connectors FR-005"], "the Entra posture counts users and administrators without multifactor and whether a policy requires it, fails for an administrator, and keeps no user who is not an administrator", async () => {
  const c = must(entraConnector("contoso.example"));
  const o = await c.observe({ port: port(entraDocs, entraLists), now: NOW });
  assert(o.kind === "ok");
  assertEquals(o.value.posture, { users: 4, "users-without-mfa": 2, "admins-without-mfa": 1, "mfa-required-by-policy": true, "conditional-access-policies": 2 });
  const res = c.check(o.value, NOW);
  assertEquals(res.find((r) => r.id === "entra-admins-have-mfa")?.status, "fail");
  assertEquals(res.find((r) => r.id === "entra-users-have-mfa")?.status, "warn");
  assertEquals(res.find((r) => r.id === "entra-policy-requires-mfa")?.status, "pass");
  assertEquals(o.value.entities?.accounts?.map((a) => a.id), ["ada@contoso.example", "root@contoso.example"]);
  const text = JSON.stringify(o.value);
  assert(!text.includes("bob@") && !text.includes("cy@") && !text.includes("555") && !text.includes("mobilePhone"));
  const none = await c.observe({ port: port(entraDocs, { [REG]: [{ userPrincipalName: "a@x", isAdmin: true, isMfaRegistered: true }], [CA]: [{ state: "enabledForReportingButNotEnforced", grantControls: { builtInControls: ["mfa"] } }] }), now: NOW });
  assert(none.kind === "ok");
  assertEquals(c.check(none.value, NOW).find((r) => r.id === "entra-policy-requires-mfa")?.status, "fail", "a policy that only reports does not require");
});

proves(["0002-identity-connectors FR-006"], "a part the credential may not read is a gap and its fact is absent, and an unreachable system is an error", async () => {
  const c = must(entraConnector("contoso.example"));
  const o = await c.observe({ port: port(entraDocs, entraLists, [CA]), now: NOW });
  assert(o.kind === "ok");
  assertEquals(o.value.gaps, [{ kind: "denied", subject: CA }]);
  assert(!("mfa-required-by-policy" in o.value.posture) && o.value.posture["users"] === 4);
  const policyResult = c.check(o.value, NOW).find((r) => r.id === "entra-policy-requires-mfa");
  assert(policyResult?.status !== "pass", "an unread fact is not a pass");
  const net = (p: string) => err({ kind: "network" as const, subject: p });
  const dead = await c.observe({ port: { get: (p) => Promise.resolve(net(p)), pages: async function* (p) { return net(p); } }, now: NOW });
  assertEquals(dead.kind, "err");
  const missing = await c.observe({ port: port({}, {}), now: NOW });
  assert(missing.kind === "ok" && missing.value.gaps.length === 2 && Object.keys(missing.value.posture).length === 0, "nothing found is gaps and no posture");
  const i = must(intuneConnector("contoso.example"));
  const denied = await i.observe({ port: port({}, {}, ["/v1.0/deviceManagement/managedDevices?$select=id,deviceName,operatingSystem,complianceState,isEncrypted,lastSyncDateTime"]), now: NOW });
  assert(denied.kind === "ok" && denied.value.gaps.length === 1 && Object.keys(denied.value.posture).length === 0);
});

const DEV = "/v1.0/deviceManagement/managedDevices?$select=id,deviceName,operatingSystem,complianceState,isEncrypted,lastSyncDateTime";
const devices = [
  { id: "d1", deviceName: "ADA-LAPTOP", operatingSystem: "Windows", complianceState: "compliant", isEncrypted: true, lastSyncDateTime: "2026-11-20T08:00:00Z", serialNumber: "SN123", userPrincipalName: "ada@contoso.example", phoneNumber: "+1 555" },
  { id: "d2", deviceName: "BOB-PHONE", operatingSystem: "iOS", complianceState: "noncompliant", isEncrypted: false, lastSyncDateTime: "2026-09-01T08:00:00Z" },
  { id: "d3", deviceName: "SPARE", operatingSystem: "macOS", complianceState: "compliant", isEncrypted: true },
];

proves(["0002-identity-connectors FR-003", "0002-identity-connectors FR-005"], "the Intune posture counts devices not encrypted, not compliant and not checked in for 30 days, each device is an asset, and no serial number, user or phone is kept", async () => {
  const c = must(intuneConnector("contoso.example"));
  const o = await c.observe({ port: port({}, { [DEV]: devices }), now: NOW });
  assert(o.kind === "ok");
  assertEquals(o.value.posture, { devices: 3, "unencrypted-devices": 1, "noncompliant-devices": 1, "stale-devices": 2 });
  assertEquals(o.value.assets.map((a) => a.id), ["d1", "d2", "d3"]);
  const res = c.check(o.value, NOW);
  assertEquals(res.find((r) => r.id === "intune-devices-encrypted")?.status, "fail");
  assertEquals(res.find((r) => r.id === "intune-devices-compliant")?.status, "warn");
  assertEquals(res.find((r) => r.id === "intune-devices-check-in")?.status, "warn");
  const text = JSON.stringify(o.value);
  assert(!text.includes("SN123") && !text.includes("ada@") && !text.includes("555") && !text.includes("serialNumber"));
});

const USERS = "/admin/directory/v1/users?customer=my_customer&maxResults=500";
const gusers = [
  { primaryEmail: "boss@acme.example", isAdmin: true, isEnrolledIn2Sv: true },
  { primaryEmail: "deputy@acme.example", isAdmin: false, isDelegatedAdmin: true, isEnrolledIn2Sv: false },
  { primaryEmail: "sam@acme.example", isAdmin: false, isEnrolledIn2Sv: false, recoveryPhone: "+1 555 0101" },
  { primaryEmail: "gone@acme.example", isAdmin: false, isEnrolledIn2Sv: false, suspended: true },
];

proves(["0002-identity-connectors FR-004", "0002-identity-connectors FR-005"], "the Google Workspace posture counts the users and the administrators without two-step verification, leaves out a suspended user, and keeps no user who is not an administrator", async () => {
  const c = must(googleWorkspaceConnector("acme.example"));
  const o = await c.observe({ port: port({}, { [USERS]: gusers }), now: NOW });
  assert(o.kind === "ok");
  assertEquals(o.value.posture, { users: 3, "users-without-2sv": 2, "admins-without-2sv": 1 });
  const res = c.check(o.value, NOW);
  assertEquals(res.find((r) => r.id === "google-admins-have-2sv")?.status, "fail");
  assertEquals(res.find((r) => r.id === "google-users-have-2sv")?.status, "warn");
  assertEquals(o.value.entities?.accounts?.map((a) => a.id), ["boss@acme.example", "deputy@acme.example"]);
  const text = JSON.stringify(o.value);
  assert(!text.includes("sam@") && !text.includes("gone@") && !text.includes("555"));
});

proves(["0002-identity-connectors FR-007"], "each connector passes the conformance suite of integrations over recorded answers", async () => {
  const run = async (c: Connector, cases: Parameters<typeof conformConnector>[1]): Promise<void> => assertEquals(await conformConnector(c, cases), []);
  await run(must(entraConnector("contoso.example")), [{ name: "a tenant with one administrator without a second factor", port: port(entraDocs, entraLists), now: NOW, expect: { account: "contoso.example", posture: { users: 4, "admins-without-mfa": 1 }, labels: {}, policies: { "entra-admins-have-mfa": "fail", "entra-policy-requires-mfa": "pass" } } }]);
  await run(must(intuneConnector("contoso.example")), [{ name: "three devices", port: port({}, { [DEV]: devices }), now: NOW, expect: { account: "contoso.example", posture: { devices: 3 }, labels: { device: 3 }, policies: { "intune-devices-encrypted": "fail" } } }]);
  await run(must(googleWorkspaceConnector("acme.example")), [{ name: "a domain", port: port({}, { [USERS]: gusers }), now: NOW, expect: { account: "acme.example", posture: { users: 3 }, labels: {}, policies: { "google-admins-have-2sv": "fail" } } }]);
});
