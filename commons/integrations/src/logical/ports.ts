// Spec: 0003-integrations-logical FR-001, FR-002, FR-003
/**
 * The ports of Integrations (commons integrations 0003-integrations-logical): typed interfaces, each a record of functions, that the pure cores are written
 * against and the physical layer implements. The credential port hands out a `Secret` that cannot be printed; the read port can only read, so that the
 * read-only contract of a connector is held by its type; the clock and the trace are ports too, so that no core reads the time or writes a line.
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { CredentialRef, Instant } from "@intellectual-frontiers/integrations/governance";

/** What JSON can say. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

/** A secret that cannot be printed, logged or serialized by accident: it says `[secret]` however it is turned into text, and gives its value only to `reveal`. */
export type Secret = { readonly reveal: () => string; readonly toJSON: () => string; readonly toString: () => string };

/** The text a secret shows. */
export const SECRET_MASK = "[secret]";

/** A secret holding a value. */
export function secretOf(value: string): Secret {
  return { reveal: () => value, toJSON: () => SECRET_MASK, toString: () => SECRET_MASK };
}

/** Why a credential cannot be given. */
export type CredentialError = { readonly kind: "missing"; readonly ref: CredentialRef } | { readonly kind: "denied"; readonly ref: CredentialRef } | { readonly kind: "vault-unavailable" };

/** The credential port: a reference to a vault store in, a secret out; nothing else can make a credential. */
export type CredentialPort = { readonly resolve: (ref: CredentialRef) => Promise<Result<Secret, CredentialError>> };

/** Why a read failed; the subject is a path of the system and never a payload. */
export type ReadFailure =
  | { readonly kind: "denied"; readonly subject: string }
  | { readonly kind: "not-found"; readonly subject: string }
  | { readonly kind: "rate-limited"; readonly subject: string }
  | { readonly kind: "server"; readonly subject: string; readonly status: number }
  | { readonly kind: "network"; readonly subject: string }
  | { readonly kind: "decode"; readonly subject: string };

/** The read port of a system: one document, or every item of a paged list. There is no way to write through it. */
export type ReadPort = {
  readonly get: (path: string) => Promise<Result<Json, ReadFailure>>;
  readonly pages: (path: string) => AsyncGenerator<Json, Result<number, ReadFailure>>;
};

/** The clock port. */
export type Clock = { readonly now: () => Instant };

/** What a run tells while it works: only identities, counts and codes, never a payload (commons integrations 0003-integrations-logical FR-003). */
export type TraceEvent =
  | { readonly kind: "observe-started"; readonly connector: string }
  | { readonly kind: "observe-finished"; readonly connector: string; readonly assets: number; readonly records: number; readonly gaps: number }
  | { readonly kind: "exchange-step"; readonly exchange: string; readonly step: string }
  | { readonly kind: "finding-counted"; readonly level: string; readonly count: number };

/** Where trace events go. */
export type Trace = (event: TraceEvent) => void;

/** Whether a JSON value is an object (not null, not an array): a guard that narrows it to one. */
export function isObject(j: Json | undefined): j is { readonly [key: string]: Json } {
  return typeof j === "object" && j !== null && !Array.isArray(j);
}

/** The member of a JSON object, or `undefined` where it is not an object or has none. */
export function member(j: Json | undefined, key: string): Json | undefined {
  return isObject(j) && Object.hasOwn(j, key) ? j[key] : undefined;
}

/** The text of a member, or `undefined` where it is not a text. */
export function textOf(j: Json | undefined, key: string): string | undefined {
  const v = member(j, key);
  return typeof v === "string" ? v : undefined;
}

/** The boolean of a member, or `undefined` where it is not one. */
export function flagOf(j: Json | undefined, key: string): boolean | undefined {
  const v = member(j, key);
  return typeof v === "boolean" ? v : undefined;
}

/** The number of a member, or `undefined` where it is not one. */
export function numberOf(j: Json | undefined, key: string): number | undefined {
  const v = member(j, key);
  return typeof v === "number" ? v : undefined;
}

/** A trace that goes nowhere. */
export const NO_TRACE: Trace = () => undefined;
