// Spec: 0006-anyfs-documents FR-001, FR-002
/**
 * The codec of a document: a pair of functions between a value and the bytes of an object, with the media type of the bytes. A codec never throws: it ends with a result, and the bytes it makes are
 * canonical, so that one value is always the same bytes and therefore the same revision on a store that names revisions by content. The codecs here are the ones that need nothing: bytes, text and JSON
 * (`./formats` has the codecs that need the file formats of commons).
 *
 * @example
 * ```ts
 * import { jsonTree, canonicalJson } from "./codec.ts";
 * canonicalJson({ b: 1, a: [true, null] }); // '{\n  "a": [\n    true,\n    null\n  ],\n  "b": 1\n}\n'
 * jsonTree.mediaType; // "application/json"
 * ```
 *
 * @module
 */
import { err, json, ok, type Result, unknownValue } from "@intellectual-frontiers/core";

/** A JSON value: what every tree codec reads and writes. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;
/** A JSON object. */
export type JsonObject = { readonly [key: string]: JsonValue };

/** Why a codec could not make or read a document: a closed list. */
export const CODEC_REASONS = ["malformed", "invalid", "newer-version", "unencodable"] as const;
/** One reason a codec could not make or read a document. */
export type CodecReason = (typeof CODEC_REASONS)[number];

/** What a codec says when it does not: the reason and one sentence. */
export type CodecProblem = { readonly reason: CodecReason; readonly detail: string };

/** What a codec read: the value and whether the bytes were written at an older version than the current one. */
export type Decoded<T> = { readonly value: T; readonly stale: boolean };

/** Bytes to a value and back, with the media type of the bytes. */
export type Codec<T> = {
  readonly mediaType: string;
  encode(value: T): Result<Uint8Array, CodecProblem>;
  decode(bytes: Uint8Array): Result<Decoded<T>, CodecProblem>;
};

/** A problem of one reason. */
export const problem = (reason: CodecReason, detail: string): CodecProblem => ({ reason, detail });

const MAX_DEPTH = 64;

/** A value as a JSON value, or why it is not one: only null, booleans, finite numbers, well-formed strings, arrays and plain objects are, to a depth of 64. */
export function toJsonValue(value: unknown, depth = 0): Result<JsonValue, string> {
  if (depth > MAX_DEPTH) return err(`nested deeper than ${MAX_DEPTH}`);
  if (value === null || typeof value === "boolean") return ok(value);
  if (typeof value === "number") return Number.isFinite(value) ? ok(value) : err(`${String(value)} is not a JSON number`);
  if (typeof value === "string") return value.isWellFormed() ? ok(value) : err("a string holds a lone surrogate");
  if (Array.isArray(value)) {
    const items: JsonValue[] = [];
    for (const item of value as readonly unknown[]) {
      const r = toJsonValue(item, depth + 1);
      if (r.kind === "err") return r;
      items.push(r.value);
    }
    return ok(items);
  }
  if (typeof value === "object") {
    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return err("an object that is not plain (a class, a Map, a Date) is not JSON");
    const fields: [string, JsonValue][] = [];
    for (const [key, item] of Object.entries(value)) {
      const r = toJsonValue(item, depth + 1);
      if (r.kind === "err") return err(`${JSON.stringify(key)}: ${r.error}`);
      fields.push([key, r.value]);
    }
    return ok(Object.fromEntries(fields));
  }
  return err(`${typeof value} is not JSON`);
}

/** Whether a JSON value is an object. */
export const isJsonObject = (value: JsonValue): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

function write(value: JsonValue, indent: string): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    const items = value as readonly JsonValue[];
    return items.length === 0 ? "[]" : `[\n${items.map((v) => `${inner}${write(v, inner)}`).join(",\n")}\n${indent}]`;
  }
  const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const object = value as JsonObject;
  return keys.length === 0 ? "{}" : `{\n${keys.map((k) => `${inner}${JSON.stringify(k)}: ${write(object[k] as JsonValue, inner)}`).join(",\n")}\n${indent}}`;
}

/** A JSON value as canonical text: keys in order, two-space indentation, one newline at the end, so that one value is one text. */
export function canonicalJson(value: JsonValue): string {
  return `${write(value, "")}\n`;
}

/** The bytes as they are. */
export const bytesCodec: Codec<Uint8Array> = {
  mediaType: "application/octet-stream",
  encode: (value) => ok(value),
  decode: (bytes) => ok({ value: bytes, stale: false }),
};

/** The bytes as UTF-8 text: bytes that are not UTF-8 are malformed. */
export const textCodec: Codec<string> = {
  mediaType: "text/plain; charset=utf-8",
  encode: (value) => (value.isWellFormed() ? ok(new TextEncoder().encode(value)) : err(problem("unencodable", "the text holds a lone surrogate"))),
  decode: (bytes) => {
    try {
      return ok({ value: new TextDecoder("utf-8", { fatal: true }).decode(bytes), stale: false });
    } catch {
      return err(problem("malformed", "the bytes are not UTF-8"));
    }
  },
};

/** The bytes as canonical JSON of any value. */
export const jsonTree: Codec<JsonValue> = {
  mediaType: "application/json",
  encode: (value) => ok(new TextEncoder().encode(canonicalJson(value))),
  decode: (bytes) => {
    const text = textCodec.decode(bytes);
    if (text.kind === "err") return text;
    const parsed = json(text.value.value, unknownValue);
    if (parsed.kind === "err") return err(problem("malformed", "the text is not JSON"));
    const tree = toJsonValue(parsed.value);
    return tree.kind === "ok" ? ok({ value: tree.value, stale: false }) : err(problem("malformed", tree.error));
  },
};
