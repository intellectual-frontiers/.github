// Spec: 0002-identity-connectors FR-001, FR-004, FR-005, FR-006
/**
 * The three connectors (0002-identity-connectors FR-001, FR-004 to FR-006), each a function of the answers a read port gives, so none can write and none reaches a network. What each keeps is counts, and the identity of an administrator where the policy is about administrators; a user who is not an administrator
 * is never kept by name, a device by its name only as the asset it is, and no serial number, address, phone number or email address of a device or a user is kept. A part the credential may not read is a gap, never a silent pass; a system that cannot be reached at all is an error.
 *
 * @example
 * ```ts
 * import { entraConnector } from "./connectors.ts";
 * entraConnector("contoso.example").kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Account, defineConnector, flagOf, fromReadFailure, gapOf, isObject, type Connector, type Gap, type Json, type ObservedRecord, type ReadPort, textOf } from "@intellectual-frontiers/integrations/logical";
import { ENTRA_POLICIES, entraGovernance, GOOGLE_POLICIES, googleWorkspaceGovernance, type GovernanceError, INTUNE_POLICIES, intuneGovernance } from "@intellectual-frontiers/integrations-identity/governance";

async function all(port: ReadPort, path: string): Promise<Result<readonly Json[], Gap | "failed">> {
  const items: Json[] = [];
  const g = port.pages(path);
  for (;;) {
    const n = await g.next();
    if (n.done === true) {
      if (n.value.kind === "err") return err(gapOf(fromReadFailure(n.value.error)) ?? "failed");
      return ok(items);
    }
    items.push(n.value);
  }
}

const DAY = 86_400_000;

/** The connector of a Microsoft Entra tenant: users without multifactor authentication, administrators without it, and whether an enabled conditional access policy requires it. */
export function entraConnector(tenant: string): Result<Connector, GovernanceError | import("@intellectual-frontiers/integrations/logical").DefinitionError> {
  const g = entraGovernance(tenant);
  if (g.kind === "err") return g;
  const registrations = "/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=999";
  const policies = "/v1.0/identity/conditionalAccess/policies";
  return defineConnector({
    governance: g.value,
    policies: ENTRA_POLICIES,
    probe: async ({ port }) => {
      const o = await port.get("/v1.0/organization");
      return o.kind === "ok" ? ok({ reachable: true as const, account: tenant }) : err(fromReadFailure(o.error));
    },
    observe: async ({ port, now }) => {
      const reg = await all(port, registrations);
      if (reg.kind === "err" && reg.error === "failed") return err({ kind: "transport", subject: registrations, failure: "network" });
      const pol = await all(port, policies);
      const gaps: Gap[] = [];
      if (reg.kind === "err" && reg.error !== "failed") gaps.push(reg.error);
      if (pol.kind === "err" && pol.error !== "failed") gaps.push(pol.error);
      const users = (reg.kind === "ok" ? reg.value : []).filter(isObject);
      const requiresMfa = pol.kind === "ok" ? pol.value.filter(isObject).some((p) => textOf(p, "state") === "enabled" && JSON.stringify((p["grantControls"] as Json | undefined) ?? null).includes('"mfa"')) : undefined;
      const admins = users.filter((u) => flagOf(u, "isAdmin") === true);
      const accounts: Account[] = admins.map((u) => ({ system: "entra", id: textOf(u, "userPrincipalName") ?? "?", name: textOf(u, "userDisplayName") ?? textOf(u, "userPrincipalName") ?? "?", active: true, admin: true }));
      const withoutMfa = (u: { readonly [k: string]: Json }): boolean => flagOf(u, "isMfaRegistered") !== true;
      return ok({
        at: now,
        provider: "entra-tenant",
        account: tenant,
        assets: [],
        posture: {
          ...(reg.kind === "ok" ? { users: users.length, "users-without-mfa": users.filter(withoutMfa).length, "admins-without-mfa": admins.filter(withoutMfa).length } : {}),
          ...(requiresMfa === undefined ? {} : { "mfa-required-by-policy": requiresMfa }),
          ...(pol.kind === "ok" ? { "conditional-access-policies": pol.value.length } : {}),
        },
        gaps,
        entities: { accounts },
        records: [],
      });
    },
  });
}

/** The connector of Microsoft Intune's managed devices: devices that are not encrypted, not compliant, or have not checked in for 30 days. */
export function intuneConnector(tenant: string): Result<Connector, GovernanceError | import("@intellectual-frontiers/integrations/logical").DefinitionError> {
  const g = intuneGovernance(tenant);
  if (g.kind === "err") return g;
  const path = "/v1.0/deviceManagement/managedDevices?$select=id,deviceName,operatingSystem,complianceState,isEncrypted,lastSyncDateTime";
  return defineConnector({
    governance: g.value,
    policies: INTUNE_POLICIES,
    probe: async ({ port }) => {
      const first = port.pages(path);
      const n = await first.next();
      if (n.done === true && n.value.kind === "err") return err(fromReadFailure(n.value.error));
      return ok({ reachable: true as const, account: tenant });
    },
    observe: async ({ port, now }) => {
      const list = await all(port, path);
      if (list.kind === "err") return list.error === "failed" ? err({ kind: "transport", subject: path, failure: "network" }) : ok({ at: now, provider: "intune-devices", account: tenant, assets: [], posture: {}, gaps: [list.error], entities: {}, records: [] });
      const devices = list.value.filter(isObject);
      const cutoff = Date.parse(now) - 30 * DAY;
      const stale = (d: { readonly [k: string]: Json }): boolean => {
        const t = Date.parse(textOf(d, "lastSyncDateTime") ?? "");
        return Number.isNaN(t) || t < cutoff;
      };
      const records: ObservedRecord[] = devices.map((d) => ({ label: "device", ocsf_class_uid: 5001, native_id: textOf(d, "id") ?? "?", display_name: textOf(d, "deviceName") ?? "?", props: { os: textOf(d, "operatingSystem") ?? "?", compliant: textOf(d, "complianceState") === "compliant", encrypted: flagOf(d, "isEncrypted") === true } }));
      return ok({
        at: now,
        provider: "intune-devices",
        account: tenant,
        assets: devices.map((d) => ({ kind: "device", id: textOf(d, "id") ?? "?", name: textOf(d, "deviceName") ?? "?" })),
        posture: {
          devices: devices.length,
          "unencrypted-devices": devices.filter((d) => flagOf(d, "isEncrypted") !== true).length,
          "noncompliant-devices": devices.filter((d) => textOf(d, "complianceState") !== "compliant").length,
          "stale-devices": devices.filter(stale).length,
        },
        gaps: [],
        entities: {},
        records,
      });
    },
  });
}

/** The connector of a Google Workspace domain: users and administrators not enrolled in two-step verification. */
export function googleWorkspaceConnector(domain: string): Result<Connector, GovernanceError | import("@intellectual-frontiers/integrations/logical").DefinitionError> {
  const g = googleWorkspaceGovernance(domain);
  if (g.kind === "err") return g;
  const path = "/admin/directory/v1/users?customer=my_customer&maxResults=500";
  return defineConnector({
    governance: g.value,
    policies: GOOGLE_POLICIES,
    probe: async ({ port }) => {
      const n = await port.pages(path).next();
      if (n.done === true && n.value.kind === "err") return err(fromReadFailure(n.value.error));
      return ok({ reachable: true as const, account: domain });
    },
    observe: async ({ port, now }) => {
      const list = await all(port, path);
      if (list.kind === "err") return list.error === "failed" ? err({ kind: "transport", subject: path, failure: "network" }) : ok({ at: now, provider: "google-workspace", account: domain, assets: [], posture: {}, gaps: [list.error], entities: {}, records: [] });
      const users = list.value.filter(isObject).filter((u) => flagOf(u, "suspended") !== true);
      const admins = users.filter((u) => flagOf(u, "isAdmin") === true || flagOf(u, "isDelegatedAdmin") === true);
      const without = (u: { readonly [k: string]: Json }): boolean => flagOf(u, "isEnrolledIn2Sv") !== true;
      const accounts: Account[] = admins.map((u) => ({ system: "google-workspace", id: textOf(u, "primaryEmail") ?? "?", name: textOf(u, "primaryEmail") ?? "?", active: true, admin: true }));
      return ok({
        at: now,
        provider: "google-workspace",
        account: domain,
        assets: [],
        posture: { users: users.length, "users-without-2sv": users.filter(without).length, "admins-without-2sv": admins.filter(without).length },
        gaps: [],
        entities: { accounts },
        records: [],
      });
    },
  });
}
