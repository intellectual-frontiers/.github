// Spec: 0002-integrations-governance FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * The governance of observation (commons integrations 0002-integrations-governance): what a connector is allowed to be and to read, as data that names no
 * vendor, no HTTP and no file path. A connector has a class, one read-only contract, a credential reference with its least-privilege scope, a cadence, the
 * kinds of entity it may produce and the fields that are never kept, labels in the world's terms, and a policy for the trust it places in the system it reads.
 *
 * @remarks
 * Every list is a closed union with an exhaustive `switch` where it is read; the policy data of a consumer (a fleet's paths, an estate's labels, a catalogue of
 * controls) is attached by the consumer and is not in this module.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { brand, durationMs, parseDuration, type ConnectorId, type CredentialRef, type Duration, type IdError, type Instant, msOf, type Sha256 } from "./ids.ts";

/** What a connector connects to. */
export type ConnectorClass = "cloud" | "identity" | "code-host" | "hr" | "endpoint" | "ticketing" | "network-device" | "vulnerability";
/** The classes of system a connector observes: cloud, identity, code host, HR, endpoint and the like. */
export const CONNECTOR_CLASSES: readonly ConnectorClass[] = ["cloud", "identity", "code-host", "hr", "endpoint", "ticketing", "network-device", "vulnerability"];

/** The service models of NIST SP 800-145. */
export type ServiceModel = "IaaS" | "PaaS" | "SaaS";

/** The labels of a connector in the world's terms: its service models and the categories a consumer's own vocabulary (an analyst's, a catalogue's) names. */
export type Labels = { readonly serviceModels: readonly ServiceModel[]; readonly categories: readonly string[] };

/** The only thing a connector may do to a system it observes. */
export type Access = "read";

/** One grant of the least-privilege scope: a resource the credential must reach, named in the system's own words, and read access. */
export type Grant = { readonly resource: string; readonly access: Access };

/** The least privilege a connector needs: its grants, all read. */
export type Scope = { readonly grants: readonly Grant[] };

/** The read-only contract: a connector never changes what it observes, and this is a value so that a conformance check can hold it. */
export type ReadOnlyContract = { readonly writes: "never"; readonly tokenEndpoints: readonly string[] };

/** The kinds of entity an observation may carry. */
export type EntityKind = "person" | "account" | "device" | "repository";

/** What the denylist matches: a field name exactly, or a field name containing the text, ignoring case. */
export type FieldPattern =
  | { readonly kind: "exact"; readonly text: string; readonly why: string }
  | { readonly kind: "contains"; readonly text: string; readonly why: string };

/** The fields that are never kept, whichever connector reads them. */
export type Denylist = { readonly patterns: readonly FieldPattern[] };

/** The generic denylist: personal, compensation and secret fields. A connector may add to it and never remove from it. */
export const GENERIC_DENYLIST: Denylist = {
  patterns: [
    { kind: "contains", text: "salary", why: "compensation" },
    { kind: "contains", text: "compensation", why: "compensation" },
    { kind: "contains", text: "bonus", why: "compensation" },
    { kind: "contains", text: "ssn", why: "government identifier" },
    { kind: "contains", text: "social_security", why: "government identifier" },
    { kind: "contains", text: "passport", why: "government identifier" },
    { kind: "contains", text: "national_id", why: "government identifier" },
    { kind: "contains", text: "birth", why: "birth date" },
    { kind: "contains", text: "dob", why: "birth date" },
    { kind: "contains", text: "address", why: "home address" },
    { kind: "contains", text: "phone", why: "personal contact" },
    { kind: "contains", text: "password", why: "secret" },
    { kind: "contains", text: "secret", why: "secret" },
    { kind: "contains", text: "token", why: "secret" },
    { kind: "contains", text: "private_key", why: "secret" },
    { kind: "contains", text: "api_key", why: "secret" },
  ],
};

/** Whether a field name is denied by a denylist. */
export function isDenied(list: Denylist, field: string): boolean {
  const f = field.toLowerCase();
  return list.patterns.some((p) => {
    switch (p.kind) {
      case "exact":
        return f === p.text.toLowerCase();
      case "contains":
        return f.includes(p.text.toLowerCase());
      default:
        return absurd(p);
    }
  });
}

/** The denylist of a connector: the generic one and what the connector adds. */
export const denylistWith = (extra: readonly FieldPattern[]): Denylist => ({ patterns: [...GENERIC_DENYLIST.patterns, ...extra] });

/** A cadence: how often the system is observed, and after how long an observation is stale. */
export type Cadence = { readonly every: Duration; readonly staleAfter: Duration };

/** An observation is never held fresh for longer than seven days. */
export const MAX_STALE_MS = 7 * 86_400_000;

/** Why a cadence is refused. */
export type CadenceError =
  | { readonly kind: "cadence-text"; readonly error: IdError }
  | { readonly kind: "stale-before-every"; readonly every: Duration; readonly staleAfter: Duration }
  | { readonly kind: "stale-beyond-cap"; readonly staleAfter: Duration };

/** A cadence from `every` (`15m`, `6h`, `1d`) and, where given, `staleAfter`: by default twice `every`, never more than seven days, never less than `every`. */
export function cadence(every: string, staleAfter?: string): Result<Cadence, CadenceError> {
  const e = parseDuration(every);
  if (e.kind === "err") return err({ kind: "cadence-text", error: e.error });
  let s: Duration;
  if (staleAfter === undefined) {
    s = brand<"Duration", number>(Math.min(durationMs(e.value) * 2, MAX_STALE_MS));
  } else {
    const parsed = parseDuration(staleAfter);
    if (parsed.kind === "err") return err({ kind: "cadence-text", error: parsed.error });
    s = parsed.value;
  }
  if (durationMs(s) > MAX_STALE_MS) return err({ kind: "stale-beyond-cap", staleAfter: s });
  if (durationMs(s) < durationMs(e.value)) return err({ kind: "stale-before-every", every: e.value, staleAfter: s });
  return ok({ every: e.value, staleAfter: s });
}

/** Whether an observation made at `at` is stale at `now`. */
export const isStale = (c: Cadence, at: Instant, now: Instant): boolean => msOf(now) - msOf(at) > durationMs(c.staleAfter);

/** A field of the credential a person gives the vault: its name, whether it is secret and a hint. A secret field is never optional. */
export type CredentialField = { readonly name: string; readonly secret: boolean; readonly hint: string };

/** The credential a connector needs: where the vault keeps it (a reference, never a value) and its fields. */
export type CredentialSpec = { readonly ref: CredentialRef; readonly fields: readonly CredentialField[] };

/** Why a credential spec is refused. */
export type CredentialSpecError = { readonly kind: "no-secret-field" } | { readonly kind: "field-without-hint"; readonly name: string } | { readonly kind: "duplicate-field"; readonly name: string };

/** A credential spec that has at least one secret field, a hint on each field and no field twice. */
export function credentialSpec(ref: CredentialRef, fields: readonly CredentialField[]): Result<CredentialSpec, CredentialSpecError> {
  if (!fields.some((f) => f.secret)) return err({ kind: "no-secret-field" });
  const seen = new Set<string>();
  for (const f of fields) {
    if (f.hint.trim() === "") return err({ kind: "field-without-hint", name: f.name });
    if (seen.has(f.name)) return err({ kind: "duplicate-field", name: f.name });
    seen.add(f.name);
  }
  return ok({ ref, fields });
}

/** Why the access to a store of our own is refused. */
export type LocalAccessError = { readonly kind: "secret-field"; readonly name: string } | { readonly kind: "no-field" } | { readonly kind: "field-without-hint"; readonly name: string } | { readonly kind: "duplicate-field"; readonly name: string };

/**
 * The credential spec of a connector that reads only a store of our own, with the access of the process that runs it (0002-integrations-governance FR-016): a reference, and fields that name the store, none of them secret, each with a hint. The way
 * to a secret stays `credentialSpec`, which refuses a spec with no secret field.
 */
export function localAccess(ref: CredentialRef, fields: readonly CredentialField[]): Result<CredentialSpec, LocalAccessError> {
  if (fields.length === 0) return err({ kind: "no-field" });
  const seen = new Set<string>();
  for (const f of fields) {
    if (f.secret) return err({ kind: "secret-field", name: f.name });
    if (f.hint.trim() === "") return err({ kind: "field-without-hint", name: f.name });
    if (seen.has(f.name)) return err({ kind: "duplicate-field", name: f.name });
    seen.add(f.name);
  }
  return ok({ ref, fields });
}

/** How a pinned certificate came to be trusted: the first one seen (trust on first use), or one that was set beforehand. */
export type PinOrigin = "trust-on-first-use" | "preconfigured";

/** How the TLS of a system is trusted. */
export type TlsPolicy =
  | { readonly kind: "system-roots" }
  | { readonly kind: "pinned"; readonly origin: PinOrigin; readonly sha256: Sha256 | undefined };

/** How the system is reached: over HTTPS to listed hosts, over SNMPv3, or not at all because it is a store of our own that the process reads with its own access (`local`). */
export type TransportPolicy =
  | { readonly kind: "https"; readonly hosts: readonly string[]; readonly tls: TlsPolicy }
  | { readonly kind: "snmp-v3"; readonly level: "authPriv" }
  | { readonly kind: "local" };

/** The governance of one connector. */
export type ConnectorGovernance = {
  readonly id: ConnectorId;
  readonly title: string;
  readonly class: ConnectorClass;
  readonly labels: Labels;
  readonly contract: ReadOnlyContract;
  readonly credential: CredentialSpec;
  readonly scope: Scope;
  readonly cadence: Cadence;
  readonly entities: readonly EntityKind[];
  readonly denylist: Denylist;
  readonly transport: TransportPolicy;
};

/** What is wrong with the governance of a connector. */
export type GovernanceProblem =
  | { readonly kind: "no-scope" }
  | { readonly kind: "no-host" }
  | { readonly kind: "pin-without-digest"; readonly origin: "preconfigured" }
  | { readonly kind: "denylist-weaker"; readonly missing: string }
  | { readonly kind: "no-service-model" }
  | { readonly kind: "entity-twice"; readonly entity: EntityKind };

/** Every problem of a connector's governance; none where it may be used. */
export function governanceProblems(g: ConnectorGovernance): readonly GovernanceProblem[] {
  const out: GovernanceProblem[] = [];
  if (g.scope.grants.length === 0) out.push({ kind: "no-scope" });
  if (g.transport.kind === "https") {
    if (g.transport.hosts.length === 0) out.push({ kind: "no-host" });
    if (g.transport.tls.kind === "pinned" && g.transport.tls.origin === "preconfigured" && g.transport.tls.sha256 === undefined) out.push({ kind: "pin-without-digest", origin: "preconfigured" });
  }
  for (const p of GENERIC_DENYLIST.patterns) {
    if (!g.denylist.patterns.some((q) => q.kind === p.kind && q.text === p.text)) out.push({ kind: "denylist-weaker", missing: p.text });
  }
  if (g.labels.serviceModels.length === 0 && g.class === "cloud") out.push({ kind: "no-service-model" });
  const seen = new Set<EntityKind>();
  for (const e of g.entities) {
    if (seen.has(e)) out.push({ kind: "entity-twice", entity: e });
    seen.add(e);
  }
  return out;
}

/** What the next contact with a system does about its pinned certificate. */
export type PinDecision =
  | { readonly kind: "accept" }
  | { readonly kind: "remember"; readonly sha256: Sha256 }
  | { readonly kind: "refuse"; readonly why: "mismatch" | "no-pin-and-not-first-use" | "not-pinned-policy" };

/** What a pinned policy does with the digest the system shows and the one remembered (or none): a total function of the policy, the shown digest and what is remembered. */
export function decidePin(policy: TlsPolicy, shown: Sha256, remembered: Sha256 | undefined): PinDecision {
  switch (policy.kind) {
    case "system-roots":
      return { kind: "refuse", why: "not-pinned-policy" };
    case "pinned": {
      const expected = policy.sha256 ?? remembered;
      if (expected !== undefined) return expected === shown ? { kind: "accept" } : { kind: "refuse", why: "mismatch" };
      switch (policy.origin) {
        case "trust-on-first-use":
          return { kind: "remember", sha256: shown };
        case "preconfigured":
          return { kind: "refuse", why: "no-pin-and-not-first-use" };
        default:
          return absurd(policy.origin);
      }
    }
    default:
      return absurd(policy);
  }
}
