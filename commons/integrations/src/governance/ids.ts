// Spec: 0002-integrations-governance FR-001, FR-002, FR-003
/**
 * The identities of Integrations (commons integrations 0002-integrations-governance): each an opaque (branded) string that only a smart constructor makes, so that a
 * value that is not a connector id, a standard urn, a credential reference, a digest or an instant cannot reach a function that wants one (parse, do not validate).
 *
 * @remarks
 * `brand` is the one cast of the library. A refusal says what was expected and never repeats the input of a credential reference, because a mistaken
 * reference may be the value itself.
 *
 * @module
 */
import { err, ok, type Brand, type Result } from "@intellectual-frontiers/core";

/** Why a text is not an identity: what it was to be, and the input where the input is an identity and not a secret. */
export type IdError = { readonly kind: "id"; readonly what: string; readonly expected: string; readonly input?: string };

/** The one cast of the library: a text that a smart constructor has checked. */
export function brand<B extends string, T extends string | number = string>(value: T): Brand<T, B> {
  return value as Brand<T, B>;
}

function parseWith<B extends string>(what: B, pattern: RegExp, expected: string, text: string, echo = true): Result<Brand<string, B>, IdError> {
  return pattern.test(text) ? ok(brand<B>(text)) : err(echo ? { kind: "id", what, expected, input: text } : { kind: "id", what, expected });
}

/** The id of a connector: `^[a-z][a-z0-9-]{1,39}$`. */
export type ConnectorId = Brand<string, "ConnectorId">;
/** Reads the id of a connector: a lower-case name of 2 to 40 characters. */
export const parseConnectorId = (text: string): Result<ConnectorId, IdError> => parseWith("ConnectorId", /^[a-z][a-z0-9-]{1,39}$/, "a lower-case name of 2 to 40 letters, digits and dashes", text);

/** The id of a trading partner. */
export type PartnerId = Brand<string, "PartnerId">;
/** Reads the id of a partner: a lower-case name of 2 to 64 characters. */
export const parsePartnerId = (text: string): Result<PartnerId, IdError> => parseWith("PartnerId", /^[a-z][a-z0-9-]{1,63}$/, "a lower-case name of 2 to 64 letters, digits and dashes", text);

/** The id of an exchange agreement. */
export type AgreementId = Brand<string, "AgreementId">;
/** Reads the id of an agreement: a lower-case name of 2 to 80 characters. */
export const parseAgreementId = (text: string): Result<AgreementId, IdError> => parseWith("AgreementId", /^[a-z][a-z0-9-]{1,79}$/, "a lower-case name of 2 to 80 letters, digits and dashes", text);

/** The urn of a standard: `urn:standard:<issuer>:<name>:<version>` (commons 0018-standards-first FR-006). */
export type StandardUrn = Brand<string, "StandardUrn">;
/** Reads the URN of a standard that a message is written to. */
export const parseStandardUrn = (text: string): Result<StandardUrn, IdError> =>
  parseWith("StandardUrn", /^urn:standard:[a-z0-9][a-z0-9.-]*:[a-z0-9][a-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/, "urn:standard:<issuer>:<name>:<version>", text);

/** The parts of a standard's urn. */
export type StandardParts = { readonly issuer: string; readonly name: string; readonly version: string };

/** The issuer, name and version a urn names. */
export function partsOfUrn(urn: StandardUrn): StandardParts {
  const [, , issuer = "", name = "", version = ""] = urn.split(":");
  return { issuer, name, version };
}

/** A urn built from its parts. */
export const standardUrn = (p: StandardParts): Result<StandardUrn, IdError> => parseStandardUrn(`urn:standard:${p.issuer}:${p.name}:${p.version}`);

/** A reference to a secret in a vault: `vault://<store>/<name>`. Never the secret; a refusal never repeats its input. */
export type CredentialRef = Brand<string, "CredentialRef">;
/** Reads a reference to a credential, never the credential itself. */
export const parseCredentialRef = (text: string): Result<CredentialRef, IdError> =>
  parseWith("CredentialRef", /^vault:\/\/[a-z][a-z0-9-]{0,31}\/[a-z][a-z0-9._/-]{0,95}$/, "vault://<store>/<name>", text, false);

/** A SHA-256 digest as 64 lower-case hexadecimal digits. */
export type Sha256 = Brand<string, "Sha256">;
/** Reads a SHA-256 digest: 64 lower-case hexadecimal digits. */
export const parseSha256 = (text: string): Result<Sha256, IdError> => parseWith("Sha256", /^[0-9a-f]{64}$/, "64 lower-case hexadecimal digits", text);

/** A moment in UTC as an ISO 8601 text with a `Z`: `2026-11-20T10:00:00.000Z`. */
export type Instant = Brand<string, "Instant">;
/** Reads an instant as an ISO 8601 timestamp in UTC. */
export function parseInstant(text: string): Result<Instant, IdError> {
  const t = Date.parse(text);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(text) || Number.isNaN(t)) return err({ kind: "id", what: "Instant", expected: "an ISO 8601 moment in UTC, such as 2026-11-20T10:00:00Z", input: text });
  return ok(brand<"Instant">(text));
}

/** The instant of a number of milliseconds since the epoch. */
export const instantOf = (ms: number): Instant => brand<"Instant">(new Date(ms).toISOString());

/** The milliseconds since the epoch of an instant. */
export const msOf = (at: Instant): number => Date.parse(at);

/** A length of time in whole milliseconds, positive. */
export type Duration = Brand<number, "Duration">;

const UNITS: Readonly<Record<string, number>> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** A duration from `15m`, `6h`, `1d` or `30s`: a whole number and one unit. */
export function parseDuration(text: string): Result<Duration, IdError> {
  const m = /^([1-9][0-9]{0,5})([smhd])$/.exec(text);
  const unit = m?.[2] === undefined ? undefined : UNITS[m[2]];
  if (m?.[1] === undefined || unit === undefined) return err({ kind: "id", what: "Duration", expected: "a whole number and one of s, m, h, d, such as 15m", input: text });
  return ok(brand<"Duration", number>(Number(m[1]) * unit));
}

/** The milliseconds of a duration, as a duration (for arithmetic that stays positive). */
export const durationMs = (d: Duration): number => d;
