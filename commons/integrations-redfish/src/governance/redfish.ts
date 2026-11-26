// Spec: 0002-redfish-connector FR-001, FR-002, FR-003
/**
 * The governance of the Redfish connector as data (0002-redfish-connector): the one class (a management controller is a network device), the read-only grants for the documents it follows by their links, the bounds of that walk, the certificate it pins (a controller commonly has
 * one of its own) and the posture policies in the vocabulary of GRC, whose control identifiers are the consumer's to attach. Nothing here reaches a network.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { cadence, credentialSpec, denylistWith, parseConnectorId, parseCredentialRef, type ConnectorGovernance, type PinOrigin, type Sha256 } from "@intellectual-frontiers/integrations/governance";
import type { PosturePolicy } from "@intellectual-frontiers/integrations/logical";

/** Why a governance cannot be made. */
export type GovernanceError = { readonly kind: "id"; readonly what: string } | { readonly kind: "host"; readonly host: string };

/** The documents the connector may read: the service root and the collections it follows from it. */
export const ROOT_PATH = "/redfish/v1/";
/** The members of the root the connector follows, by the name of the link. */
export const FOLLOWED = ["Systems", "Chassis", "Managers", "UpdateService"] as const;
/** The bounds of the walk of links: how deep, and how many members of a collection. */
export const LINK_BOUNDS = { maxDepth: 4, maxMembers: 16 } as const;

/** Whether a path is one the connector may ask for: under `/redfish/v1/`, no query and no dot-dot. */
export const pathAllowed = (path: string): boolean => path.startsWith(ROOT_PATH) && !path.includes("..") && !path.includes("?") && path.length <= 256;

/** The governance of the controllers of one site, which answer on the given hosts and whose certificate is pinned. */
export function redfishGovernance(site: string, hosts: readonly string[], pin: { readonly origin: PinOrigin; readonly sha256: Sha256 | undefined } = { origin: "trust-on-first-use", sha256: undefined }): Result<ConnectorGovernance, GovernanceError> {
  const id = parseConnectorId("redfish-controllers");
  const ref = parseCredentialRef(`vault://redfish/${site.toLowerCase()}-read`);
  const cad = cadence("1d");
  if (id.kind === "err" || ref.kind === "err" || cad.kind === "err") return err({ kind: "id", what: "redfish-controllers: its id, its credential reference or its cadence" });
  for (const h of hosts) if (!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/iu.test(h)) return err({ kind: "host", host: h });
  const spec = credentialSpec(ref.value, [
    { name: "user", secret: false, hint: "The name of a user of the controllers with the read-only role (Redfish `ReadOnly`)." },
    { name: "password", secret: true, hint: "The password of that user." },
  ]);
  if (spec.kind === "err") return err({ kind: "id", what: "redfish-controllers: the credential spec" });
  return ok({
    id: id.value,
    title: "Management controllers that answer Redfish: identity, health and firmware",
    class: "network-device",
    labels: { serviceModels: [], categories: ["management-controller", "redfish"] },
    contract: { writes: "never", tokenEndpoints: [] },
    credential: spec.value,
    scope: { grants: ["Systems", "Chassis", "Managers", "UpdateService"].map((resource) => ({ resource: `/redfish/v1/${resource}`, access: "read" as const })) },
    cadence: cad.value,
    entities: ["device"],
    denylist: denylistWith([{ kind: "exact", text: "oem", why: "vendor extension" }, { kind: "contains", text: "credential", why: "secret" }]),
    transport: { kind: "https", hosts: [...hosts], tls: { kind: "pinned", origin: pin.origin, sha256: pin.sha256 } },
  });
}

/** The posture policies of a controller. */
export const REDFISH_POLICIES: readonly PosturePolicy[] = [
  { id: "redfish-controller-answers", title: "The controller answers an authenticated request", fact: "controller-answers", want: { kind: "equals", value: true }, severity: "high", onMiss: "fail", controls: [], fix: "Check the controller is up, its address, its certificate pin, and the user and its read-only role." },
  { id: "redfish-systems-healthy", title: "Every system reports health OK", fact: "systems-unhealthy", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "high", onMiss: "fail", controls: [], fix: "Open the event log of the controller of each system that is not healthy and repair it." },
  { id: "redfish-firmware-known", title: "The firmware of the controller is known", fact: "firmware-known", want: { kind: "equals", value: true }, severity: "low", onMiss: "warn", controls: [], fix: "Have the controller give its manager or its firmware inventory to the read-only role." },
];
