// Spec: 0002-planning-core FR-003
/**
 * The ids of Planning: an item id and an event id are each a UUID version 7 as 36 lower case characters (RFC 9562 section 5.7), branded and made only by a smart constructor that returns a `Result`
 * (0037-planning FR-007). The syntax is the one of the version id of AnyFS, which makes them with its hybrid clock (the logical layer mints them); an id of another scheme is an external id, a source's name
 * and a value, kept as the source named it and never written into the wording of an id (FR-044).
 *
 * @example
 * ```ts
 * import { parseItemId } from "./ids.ts";
 * parseItemId("018f3a6e-7c00-7000-8123-456789abcdef"); // { kind: "ok", value: "018f3a6e-7c00-7000-8123-456789abcdef" }
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";
import { type IdTime, parseVersionId, timeOfId } from "@intellectual-frontiers/anyfs/governance";
import { brand } from "./brand.ts";

/** The id of an item: a UUID version 7. Made only by `parseItemId`, or by the clock. */
export type ItemId = Brand<string, "plan item id">;
/** The id of an event: a UUID version 7. Made only by `parseEventId`, or by the clock. */
export type EventId = Brand<string, "plan event id">;

/** An id that is not one. */
export type IdProblem =
  | { readonly kind: "not-uuid-v7"; readonly what: "item id" | "event id"; readonly text: string }
  | { readonly kind: "bad-external-id"; readonly message: string };

/** An item id from text, or why it is not one. */
export function parseItemId(text: string): Result<ItemId, IdProblem> {
  return parseVersionId(text).kind === "ok" ? ok(brand<string, "plan item id">(text)) : err({ kind: "not-uuid-v7", what: "item id", text: text.slice(0, 50) });
}

/** An event id from text, or why it is not one. */
export function parseEventId(text: string): Result<EventId, IdProblem> {
  return parseVersionId(text).kind === "ok" ? ok(brand<string, "plan event id">(text)) : err({ kind: "not-uuid-v7", what: "event id", text: text.slice(0, 50) });
}

/** The time an id holds: the milliseconds and the counter that orders ids of one millisecond. */
export function idTime(id: ItemId | EventId): IdTime {
  const v = parseVersionId(id);
  return v.kind === "ok" ? timeOfId(v.value) : { ms: 0, counter: 0 };
}

/** The id an item or an event has in the place it was read from, named by that place: the source's name and the value, as the source wrote it. */
export type ExternalId = { readonly source: string; readonly value: string };

/** An external id, or why the two texts are not one: each is non-empty, with no control character, and the source's name is at most 64 characters and the value at most 256. */
export function externalId(source: string, value: string): Result<ExternalId, IdProblem> {
  // eslint-disable-next-line no-control-regex
  const control = /[\u0000-\u001f\u007f]/u;
  return source.length === 0 || source.length > 64 || value.length === 0 || value.length > 256 || control.test(source) || control.test(value)
    ? err({ kind: "bad-external-id", message: "an external id is a source name of 1 to 64 characters and a value of 1 to 256, with no control character" })
    : ok({ source, value });
}
