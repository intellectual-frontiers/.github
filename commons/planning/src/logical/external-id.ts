// Spec: 0002-planning-core FR-010
/**
 * The ids of a record read from another scheme (0037-planning FR-044). An external id that is a valid ULID gives its item or event id by a pure function: the 48 bits of time of the ULID are the `unix_ts_ms`
 * of a UUID version 7 and the first 74 of its 80 random bits are `rand_a` and `rand_b` (RFC 9562 section 5.7; ULID, 48 bits of time and 80 of chance), so that two stores that read one file make the same ids. An
 * id that is not a ULID gives its id by the same function from the time of its event and the SHA-256 of the external id (the source's name, a zero byte and the value). The external id is carried
 * beside the id, as the source named it, and no id's wording says where it came from.
 *
 * @example
 * ```ts
 * import { uuid7OfUlid } from "./external-id.ts";
 * uuid7OfUlid("01ARZ3NDEKTSV4RRFFQ69G5FAV"); // { kind: "ok", value: "01563e3a-b5d3-7..." }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type EventId, type IdProblem, type ItemId, parseEventId, parseItemId } from "@intellectual-frontiers/planning/governance";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const MS_LIMIT = 2 ** 48;

/** The 48 bits of time and the 80 bits of chance of a ULID, or why a text is not one: 26 characters of Crockford's base 32, in either case, no larger than `7ZZZZZZZZZZZZZZZZZZZZZZZZZ`. */
export function parseUlid(text: string): Result<{ readonly ms: number; readonly random: bigint }, IdProblem> {
  const upper = text.toUpperCase();
  if (upper.length !== 26 || [...upper].some((c) => !CROCKFORD.includes(c)) || upper.charAt(0) > "7") {
    return err({ kind: "not-uuid-v7", what: "item id", text: `${text.slice(0, 30)} is not a ULID` });
  }
  let value = 0n;
  for (const c of upper) value = (value << 5n) | BigInt(CROCKFORD.indexOf(c));
  return ok({ ms: Number(value >> 80n), random: value & ((1n << 80n) - 1n) });
}

/** The text of the UUID version 7 made of a time in milliseconds and 74 bits: the 12 leftmost are `rand_a` and the 62 others `rand_b`, with the version and the variant set. */
export function uuid7Text(ms: number, bits74: bigint): string {
  const time = BigInt(Math.min(Math.max(Math.trunc(ms), 0), MS_LIMIT - 1)).toString(16).padStart(12, "0");
  const randA = ((bits74 >> 62n) & 0xfffn).toString(16).padStart(3, "0");
  const randB = ((2n << 62n) | (bits74 & ((1n << 62n) - 1n))).toString(16).padStart(16, "0");
  return `${time.slice(0, 8)}-${time.slice(8, 12)}-7${randA}-${randB.slice(0, 4)}-${randB.slice(4, 16)}`;
}

/** The UUID version 7 of a ULID, as text, or why the text is not a ULID. */
export function uuid7OfUlid(text: string): Result<string, IdProblem> {
  const u = parseUlid(text);
  return u.kind === "ok" ? ok(uuid7Text(u.value.ms, u.value.random >> 6n)) : u;
}

/** The UUID version 7 of an id that is not a ULID, as text: the time of its event and the first 74 bits of the SHA-256 of the source's name, a zero byte and the value. */
export async function uuid7OfExternal(source: string, value: string, atMs: number): Promise<string> {
  const digest = await sha256(`${source}\u0000${value}`);
  return uuid7Text(atMs, BigInt(`0x${digest.slice(0, 20)}`) >> 6n);
}

async function textOf(source: string, value: string, atMs: number): Promise<Result<string, IdProblem>> {
  const ulid = uuid7OfUlid(value);
  return ulid.kind === "ok" ? ulid : ok(await uuid7OfExternal(source, value, atMs));
}

/** The item id of an external id: the id of a ULID, else of the source's name, the value and the time of the item's opening. */
export async function itemIdOfExternal(source: string, value: string, atMs: number): Promise<Result<ItemId, IdProblem>> {
  const text = await textOf(source, value, atMs);
  return text.kind === "ok" ? parseItemId(text.value) : text;
}

/** The event id of an external id: the id of a ULID, else of the source's name, the value and the time of the event. */
export async function eventIdOfExternal(source: string, value: string, atMs: number): Promise<Result<EventId, IdProblem>> {
  const text = await textOf(source, value, atMs);
  return text.kind === "ok" ? parseEventId(text.value) : text;
}

/** The ULID text that reads back as this id: its time as the 48 bits and its 74 random bits as the first 74 of the 80, so that `uuid7OfUlid` of it is the id again (the last six bits are zero). */
export function ulidOfUuid7(id: ItemId | EventId): string {
  const hex = id.replace(/-/gu, "");
  const ms = BigInt(`0x${hex.slice(0, 12)}`);
  const randA = BigInt(`0x${hex.slice(13, 16)}`);
  const randB = BigInt(`0x${hex.slice(16, 32)}`) & ((1n << 62n) - 1n);
  const value = (ms << 80n) | (((randA << 62n) | randB) << 6n);
  let out = "";
  for (let i = 25; i >= 0; i--) out += CROCKFORD.charAt(Number((value >> BigInt(5 * i)) & 31n));
  return out;
}
