// Spec: 0002-integrations-governance FR-010, FR-011, FR-012, FR-013, FR-014, FR-015
/**
 * The governance of exchange (commons integrations 0002-integrations-governance): standards as registry entries with identity, version and licence, the four levels
 * a standard is at (syntax, schema, profile, terminology), the agreement with a trading partner, the protection of what is exchanged and the obligations that follow.
 * It names no syntax and no transport: X12, HL7 v2 and FHIR are entries of the registry, not words of this module.
 *
 * @remarks
 * A standard's licence is data with the rule that follows from it (`Embedding`): what may be committed to this public repository and what must be read from a
 * copy the user supplies. Payloads are classified (`Classification`) and a classification says whether the payload may appear in a log, a hint or a trace; for
 * every classification above `public` it may not.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { AgreementId, CredentialRef, Duration, PartnerId, Sha256, StandardUrn } from "./ids.ts";

/** The four levels a standard is at. */
export type Level = "syntax" | "schema" | "profile" | "terminology";
/** The levels of validation a message passes, in order: syntax, schema, profile and terminology. */
export const LEVELS: readonly Level[] = ["syntax", "schema", "profile", "terminology"];

/** A reference to a standard at one level; the level is in the type so that a schema cannot stand where a terminology is wanted. */
export type Ref<L extends Level> = { readonly level: L; readonly urn: StandardUrn };

/** A reference at a level. */
export const ref = <L extends Level>(level: L, urn: StandardUrn): Ref<L> => ({ level, urn });

/** What kind of thing a standard defines. */
export type Family = "message" | "document" | "resource-api" | "vocabulary" | "file-format";

/** How a standard relates to the standard it comes from (commons 0018-standards-first). */
export type Basis =
  | { readonly kind: "adopts"; readonly of: StandardUrn }
  | { readonly kind: "specializes"; readonly of: StandardUrn }
  | { readonly kind: "maps"; readonly to: StandardUrn }
  | { readonly kind: "unaligned"; readonly reason: string };

/** What the licence of a standard allows this repository to hold. */
export type Embedding =
  | "allowed" // the text and its machine-readable definitions may be committed, with the licence cited
  | "user-supplied" // only a copy the user holds under a licence is read; nothing of it is committed
  | "refused"; // not even read from a copy by this library

/** A licence as data: its SPDX identifier (or a `LicenseRef-` of the holder's terms), what it allows, and the text that cites the terms. */
export type License = { readonly spdx: string; readonly embedding: Embedding; readonly terms: string };

/** A standard: a registry entry with a stable identity (commons 0018-standards-first FR-006). */
export type Standard = {
  readonly urn: StandardUrn;
  readonly level: Level;
  readonly family: Family;
  readonly title: string;
  readonly issuer: string;
  readonly version: string;
  readonly basis: Basis;
  readonly location: string;
  readonly license: License;
  /** The digest of what was imported; absent where nothing was (a standard that is read from the user's copy). */
  readonly sha256: Sha256 | undefined;
};

/** What a binding of a terminology demands of a code. */
export type BindingStrength = "required" | "extensible" | "preferred" | "example";

/** A binding of an element to a terminology. */
export type TerminologyBinding = { readonly path: string; readonly terminology: Ref<"terminology">; readonly strength: BindingStrength };

/** A profile bound to the schema it constrains. */
export type ProfileBinding = { readonly profile: Ref<"profile">; readonly schema: Ref<"schema"> };

/** Whether a standard may be loaded from a source of the given kind. */
export type Source = "embedded-in-package" | "user-supplied" | "published-by-issuer";

/** Whether the licence of a standard lets this source be used: a pure decision. */
export function sourceAllowed(license: License, source: Source): boolean {
  switch (license.embedding) {
    case "allowed":
      return true;
    case "user-supplied":
      return source !== "embedded-in-package";
    case "refused":
      return false;
    default:
      return absurd(license.embedding);
  }
}

/** How sensitive what is exchanged is. */
export type Classification = "public" | "internal" | "confidential" | "protected-health-information";
/** The classifications of data an agreement may name, from public to protected health information. */
export const CLASSIFICATIONS: readonly Classification[] = ["public", "internal", "confidential", "protected-health-information"];

/** Where a payload of a classification may appear: only a `public` one in a log, a hint or a trace; no other, ever. */
export function mayAppearInLogs(c: Classification): boolean {
  switch (c) {
    case "public":
      return true;
    case "internal":
    case "confidential":
    case "protected-health-information":
      return false;
    default:
      return absurd(c);
  }
}

/** How much of a record a recipient may be given. */
export type MinimumNecessary =
  | { readonly kind: "whole-record" }
  | { readonly kind: "listed-elements"; readonly paths: readonly string[] }
  | { readonly kind: "treatment-exempt" };

/** What is done with a payload at rest and in flight. */
export type Handling = { readonly encryptedInTransit: true; readonly encryptedAtRest: boolean; readonly retention: Duration };

/** The data protection of an exchange. */
export type DataProtection = { readonly classification: Classification; readonly handling: Handling; readonly minimumNecessary: MinimumNecessary };

/** The acknowledgement a partner requires, by standard. */
export type AckRequirement =
  | { readonly kind: "x12-ta1"; readonly within: Duration }
  | { readonly kind: "x12-999"; readonly within: Duration }
  | { readonly kind: "hl7-ack"; readonly mode: "original" | "enhanced"; readonly within: Duration }
  | { readonly kind: "fhir-operation-outcome"; readonly within: Duration };

/** Which direction messages flow with a partner. */
export type Direction = "inbound" | "outbound" | "both";

/** What an exchange must do. */
export type Obligation =
  | { readonly kind: "validate"; readonly levels: readonly Level[] }
  | { readonly kind: "acknowledge" }
  | { readonly kind: "log"; readonly what: "metadata-only" }
  | { readonly kind: "keep"; readonly for: Duration };

/** The service levels agreed: how long until an acknowledgement is overdue and how many times a send is tried. */
export type ServiceLevels = { readonly ackWithin: Duration; readonly maxAttempts: number };

/** How a partner is reached; the credential is a reference. */
export type ExchangeTransportPolicy =
  | { readonly kind: "https"; readonly endpoint: string; readonly auth: "oauth2-backend-services" | "mutual-tls" | "api-key" }
  | { readonly kind: "sftp"; readonly host: string }
  | { readonly kind: "as2"; readonly endpoint: string }
  | { readonly kind: "mllp"; readonly host: string; readonly port: number };

/** An exchange agreement with a trading partner. */
export type ExchangeAgreement = {
  readonly id: AgreementId;
  readonly partner: PartnerId;
  readonly direction: Direction;
  readonly syntax: Ref<"syntax">;
  readonly schemas: readonly Ref<"schema">[];
  readonly profiles: readonly ProfileBinding[];
  readonly bindings: readonly TerminologyBinding[];
  readonly acknowledgements: readonly AckRequirement[];
  readonly serviceLevels: ServiceLevels;
  readonly protection: DataProtection;
  readonly obligations: readonly Obligation[];
  readonly transport: ExchangeTransportPolicy;
  readonly credential: CredentialRef;
};

/** What is wrong with an agreement. */
export type AgreementProblem =
  | { readonly kind: "no-schema" }
  | { readonly kind: "unacknowledged"; readonly needs: "acknowledgement-requirement" }
  | { readonly kind: "validates-no-level" }
  | { readonly kind: "log-would-carry-payload"; readonly classification: Classification }
  | { readonly kind: "attempts-not-positive" }
  | { readonly kind: "retention-shorter-than-keep" };

/** Every problem of an agreement against the standards registry; none where it may be used. */
export function agreementProblems(a: ExchangeAgreement): readonly AgreementProblem[] {
  const out: AgreementProblem[] = [];
  if (a.schemas.length === 0) out.push({ kind: "no-schema" });
  const acks = a.obligations.some((o) => o.kind === "acknowledge");
  if (acks && a.acknowledgements.length === 0) out.push({ kind: "unacknowledged", needs: "acknowledgement-requirement" });
  const validates = a.obligations.filter((o) => o.kind === "validate");
  if (validates.length > 0 && validates.every((o) => o.kind === "validate" && o.levels.length === 0)) out.push({ kind: "validates-no-level" });
  if (a.serviceLevels.maxAttempts < 1) out.push({ kind: "attempts-not-positive" });
  for (const o of a.obligations) {
    if (o.kind === "keep" && o.for > a.protection.handling.retention) out.push({ kind: "retention-shorter-than-keep" });
  }
  return out;
}

/** A standard registry: typed entries by urn. */
export type StandardsRegistry = ReadonlyMap<StandardUrn, Standard>;

/** Why an entry is refused by a registry. */
export type RegistryError =
  | { readonly kind: "duplicate"; readonly urn: StandardUrn }
  | { readonly kind: "urn-mismatch"; readonly urn: StandardUrn; readonly want: string }
  | { readonly kind: "no-terms"; readonly urn: StandardUrn };

/** The registry with one more entry, or why not. */
export function register(reg: StandardsRegistry, s: Standard): Result<StandardsRegistry, RegistryError> {
  if (reg.has(s.urn)) return err({ kind: "duplicate", urn: s.urn });
  const want = `urn:standard:${s.issuer}:${s.urn.split(":")[3] ?? ""}:${s.version}`;
  if (s.urn !== want) return err({ kind: "urn-mismatch", urn: s.urn, want });
  if (s.license.terms.trim() === "") return err({ kind: "no-terms", urn: s.urn });
  return ok(new Map([...reg, [s.urn, s]]));
}

/** A file a package holds, with the standard whose content it embeds. */
export type EmbeddedContent = { readonly path: string; readonly standard: StandardUrn };

/** A finding of the publication gate. */
export type EmbeddingFinding =
  | { readonly kind: "embedded-not-allowed"; readonly path: string; readonly standard: StandardUrn; readonly embedding: Embedding }
  | { readonly kind: "embedded-unknown-standard"; readonly path: string; readonly standard: StandardUrn };

/** The refusal to publish embedded content a licence does not allow: a finding for each embedded file whose standard's licence is not `allowed` or is not in the registry. */
export function embeddingFindings(reg: StandardsRegistry, embedded: readonly EmbeddedContent[]): readonly EmbeddingFinding[] {
  const out: EmbeddingFinding[] = [];
  for (const e of embedded) {
    const s = reg.get(e.standard);
    if (s === undefined) out.push({ kind: "embedded-unknown-standard", path: e.path, standard: e.standard });
    else if (!sourceAllowed(s.license, "embedded-in-package")) out.push({ kind: "embedded-not-allowed", path: e.path, standard: e.standard, embedding: s.license.embedding });
  }
  return out;
}
