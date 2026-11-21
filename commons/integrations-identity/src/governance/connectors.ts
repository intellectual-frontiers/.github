// Spec: 0002-identity-connectors FR-001, FR-002, FR-003
/**
 * The governance of the three connectors as data (0002-identity-connectors FR-001 to FR-003): the system each reads, the one scope it asks for (read only, named), the hosts its transport may reach, its cadence, and the posture policies in the vocabulary of GRC, whose control identifiers are
 * the consumer's to attach. Nothing here reaches a network: each connector is a function of the answers a read port gives.
 *
 * @example
 * ```ts
 * import { ENTRA_POLICIES } from "./connectors.ts";
 * ENTRA_POLICIES.length > 0; // true
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { cadence, credentialSpec, denylistWith, parseConnectorId, parseCredentialRef, type ConnectorGovernance } from "@intellectual-frontiers/integrations/governance";
import type { PosturePolicy } from "@intellectual-frontiers/integrations/logical";

/** Why a governance cannot be made. */
export type GovernanceError = { readonly kind: "id"; readonly what: string };

type Spec = {
  readonly id: string;
  readonly title: string;
  readonly cls: "identity" | "endpoint";
  readonly categories: readonly string[];
  readonly vault: string;
  readonly hint: string;
  readonly resources: readonly string[];
  readonly hosts: readonly string[];
  readonly tokenEndpoints: readonly string[];
  readonly entities: ConnectorGovernance["entities"];
  readonly cadence: string;
};

function make(s: Spec): Result<ConnectorGovernance, GovernanceError> {
  const id = parseConnectorId(s.id);
  const ref = parseCredentialRef(s.vault);
  const cad = cadence(s.cadence);
  if (id.kind === "err" || ref.kind === "err" || cad.kind === "err") return err({ kind: "id", what: `${s.id}: its id, its credential reference or its cadence` });
  const spec = credentialSpec(ref.value, [{ name: "token", secret: true, hint: s.hint }]);
  if (spec.kind === "err") return err({ kind: "id", what: `${s.id}: the credential spec` });
  return ok({
    id: id.value,
    title: s.title,
    class: s.cls,
    labels: { serviceModels: ["SaaS"], categories: [...s.categories] },
    contract: { writes: "never", tokenEndpoints: [...s.tokenEndpoints] },
    credential: spec.value,
    scope: { grants: s.resources.map((resource) => ({ resource, access: "read" as const })) },
    cadence: cad.value,
    entities: s.entities,
    denylist: denylistWith([]),
    transport: { kind: "https", hosts: [...s.hosts], tls: { kind: "system-roots" } },
  });
}

/** The host of Microsoft Graph and the host the application's token is asked from. */
export const GRAPH_HOST = "graph.microsoft.com";
/** The host of the token service of Microsoft's identity platform. */
export const LOGIN_HOST = "login.microsoftonline.com";
/** The host of Google's Admin SDK. */
export const GOOGLE_HOST = "admin.googleapis.com";

/** The governance of the connector of a Microsoft Entra tenant: it reads the authentication-method registrations, the conditional access policies and the organization's name, with the read-only application permissions `Reports.Read.All`, `Policy.Read.All` and `Organization.Read.All`. */
export function entraGovernance(tenant: string): Result<ConnectorGovernance, GovernanceError> {
  return make({
    id: "entra-tenant", title: "Microsoft Entra tenant: multifactor authentication and conditional access", cls: "identity", categories: ["identity-provider", "mfa"], vault: `vault://entra/${tenant.toLowerCase()}-read`,
    hint: "A client secret or certificate of an application registered in the tenant with the read-only application permissions Reports.Read.All, Policy.Read.All and Organization.Read.All, and no other.",
    resources: ["organization", "reports/authenticationMethods/userRegistrationDetails", "identity/conditionalAccess/policies"], hosts: [GRAPH_HOST, LOGIN_HOST], tokenEndpoints: [`https://${LOGIN_HOST}/${tenant.toLowerCase()}/oauth2/v2.0/token`], entities: ["account"], cadence: "1d",
  });
}

/** The governance of the connector of Microsoft Intune's managed devices, with the read-only application permission `DeviceManagementManagedDevices.Read.All`. */
export function intuneGovernance(tenant: string): Result<ConnectorGovernance, GovernanceError> {
  return make({
    id: "intune-devices", title: "Microsoft Intune managed devices: compliance and encryption", cls: "endpoint", categories: ["mdm", "endpoint-management"], vault: `vault://intune/${tenant.toLowerCase()}-read`,
    hint: "A client secret or certificate of an application registered in the tenant with the read-only application permission DeviceManagementManagedDevices.Read.All, and no other.",
    resources: ["deviceManagement/managedDevices"], hosts: [GRAPH_HOST, LOGIN_HOST], tokenEndpoints: [`https://${LOGIN_HOST}/${tenant.toLowerCase()}/oauth2/v2.0/token`], entities: [], cadence: "1d",
  });
}

/** The governance of the connector of a Google Workspace domain's users, with the read-only scope `admin.directory.user.readonly` of a service account that acts for a named administrator. */
export function googleWorkspaceGovernance(domain: string): Result<ConnectorGovernance, GovernanceError> {
  return make({
    id: "google-workspace", title: "Google Workspace domain: two-step verification and administrators", cls: "identity", categories: ["identity-provider", "mfa"], vault: `vault://google-workspace/${domain.toLowerCase()}-read`,
    hint: "A service account key with domain-wide delegation limited to the read-only scope https://www.googleapis.com/auth/admin.directory.user.readonly, acting for an administrator who can read users.",
    resources: ["admin/directory/v1/users"], hosts: [GOOGLE_HOST, "oauth2.googleapis.com"], tokenEndpoints: ["https://oauth2.googleapis.com/token"], entities: ["account"], cadence: "1d",
  });
}

/** The posture policies of an Entra tenant. */
export const ENTRA_POLICIES: readonly PosturePolicy[] = [
  { id: "entra-admins-have-mfa", title: "Every administrator has registered multifactor authentication", fact: "admins-without-mfa", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "high", onMiss: "fail", controls: [], fix: "Have each administrator register a second factor, and require it by a conditional access policy." },
  { id: "entra-users-have-mfa", title: "Every user has registered multifactor authentication", fact: "users-without-mfa", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "medium", onMiss: "warn", controls: [], fix: "Have the users register a second factor." },
  { id: "entra-policy-requires-mfa", title: "An enabled conditional access policy requires multifactor authentication", fact: "mfa-required-by-policy", want: { kind: "equals", value: true }, severity: "high", onMiss: "fail", controls: [], fix: "Enable a conditional access policy that grants access only with multifactor authentication." },
];

/** The posture policies of Intune's managed devices. */
export const INTUNE_POLICIES: readonly PosturePolicy[] = [
  { id: "intune-devices-encrypted", title: "Every managed device is encrypted", fact: "unencrypted-devices", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "high", onMiss: "fail", controls: [], fix: "Turn on disk encryption on the devices, and require it in a compliance policy." },
  { id: "intune-devices-compliant", title: "Every managed device is compliant", fact: "noncompliant-devices", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "medium", onMiss: "warn", controls: [], fix: "Bring the devices into compliance or retire them." },
  { id: "intune-devices-check-in", title: "Every managed device has checked in within 30 days", fact: "stale-devices", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "low", onMiss: "warn", controls: [], fix: "Find the devices that have not checked in and retire or recover them." },
];

/** The posture policies of a Google Workspace domain. */
export const GOOGLE_POLICIES: readonly PosturePolicy[] = [
  { id: "google-admins-have-2sv", title: "Every administrator is enrolled in two-step verification", fact: "admins-without-2sv", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "high", onMiss: "fail", controls: [], fix: "Enroll each administrator in two-step verification and enforce it." },
  { id: "google-users-have-2sv", title: "Every user is enrolled in two-step verification", fact: "users-without-2sv", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "medium", onMiss: "warn", controls: [], fix: "Enroll the users in two-step verification, and enforce it for the organization." },
];
