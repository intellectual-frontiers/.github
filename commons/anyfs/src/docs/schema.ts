// Spec: 0006-anyfs-documents FR-003, FR-004
/**
 * The version of a document as code: a schema has the number of the version it writes, the decoder of that version and the pure functions that bring each older version to the next. A document carries
 * its version in the field `$version`; one without the field is version 1. A document of a version newer than the schema's is refused and never guessed at, and one of an older version is read through the
 * migrations and said to be stale, so that a collection can write it again at the current version.
 *
 * @example
 * ```ts
 * import { defineSchema, versioned } from "./schema.ts";
 * import { jsonTree } from "./codec.ts";
 * import { number, object, string } from "@intellectual-frontiers/core";
 * const schema = defineSchema({ current: 1, decoder: object({ name: string, size: number }) });
 * schema.kind === "ok" && versioned(jsonTree, schema.value).mediaType; // "application/json"
 * ```
 *
 * @module
 */
import { type Decoder, err, formatDecodeError, ok, type Result } from "@intellectual-frontiers/core";
import { type Codec, type CodecProblem, isJsonObject, type JsonObject, type JsonValue, problem, toJsonValue } from "./codec.ts";

/** The field of a document that holds its version. */
export const VERSION_FIELD = "$version";

/** The step from one version to the next: a pure function of the object of that version, without its version field. */
export type Migration = { readonly from: number; readonly up: (value: JsonObject) => Result<JsonObject, string> };

/** The version a document is written at, how to read it and how to bring an older one forward. */
export type Schema<T> = {
  readonly current: number;
  readonly decoder: Decoder<T>;
  readonly encode: (value: T) => Result<JsonObject, string>;
  readonly migrations: readonly Migration[];
};

/** What a schema is made from. */
export type SchemaSpec<T> = {
  readonly current: number;
  readonly decoder: Decoder<T>;
  readonly encode?: (value: T) => Result<JsonObject, string>;
  readonly migrations?: readonly Migration[];
};

const plain = <T>(value: T): Result<JsonObject, string> => {
  const tree = toJsonValue(value);
  if (tree.kind === "err") return tree;
  return isJsonObject(tree.value) ? ok(tree.value) : err("a document is a JSON object");
};

/** A schema, or why the specification is not one: the version is a positive whole number and the migrations step from 1 to the version before it, in order and with none missing. */
export function defineSchema<T>(spec: SchemaSpec<T>): Result<Schema<T>, string> {
  if (!Number.isInteger(spec.current) || spec.current < 1) return err("the current version is a positive whole number");
  const migrations = spec.migrations ?? [];
  if (migrations.length !== spec.current - 1) return err(`version ${spec.current} needs ${spec.current - 1} migrations, from 1 to ${spec.current - 1}; there are ${migrations.length}`);
  for (const [i, m] of migrations.entries()) if (m.from !== i + 1) return err(`the migration at place ${i + 1} is from version ${m.from}: they step from 1 in order`);
  return ok({ current: spec.current, decoder: spec.decoder, encode: spec.encode ?? ((value: T) => plain(value)), migrations });
}

const refused = (reason: CodecProblem["reason"], detail: string) => err(problem(reason, detail));

/** The codec of a schema over a codec of JSON trees: it writes the current version and reads any version up to it. */
export function versioned<T>(tree: Codec<JsonValue>, schema: Schema<T>): Codec<T> {
  return {
    mediaType: tree.mediaType,
    encode: (value) => {
      const object = schema.encode(value);
      if (object.kind === "err") return refused("unencodable", object.error);
      return tree.encode({ ...object.value, [VERSION_FIELD]: schema.current });
    },
    decode: (bytes) => {
      const read = tree.decode(bytes);
      if (read.kind === "err") return read;
      const root = read.value.value;
      if (!isJsonObject(root)) return refused("invalid", "a document is a JSON object");
      const stated = root[VERSION_FIELD];
      const version = stated === undefined ? 1 : stated;
      if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return refused("invalid", `${VERSION_FIELD} is a positive whole number`);
      if (version > schema.current) return refused("newer-version", `written at version ${version}, and this code reads up to ${schema.current}`);
      const { [VERSION_FIELD]: _version, ...rest } = root;
      let value: JsonObject = rest;
      for (const m of schema.migrations.slice(version - 1)) {
        const next = m.up(value);
        if (next.kind === "err") return refused("invalid", `the migration from version ${m.from} refused it: ${next.error}`);
        value = next.value;
      }
      const decoded = schema.decoder(value);
      return decoded.kind === "ok" ? ok({ value: decoded.value, stale: version < schema.current }) : refused("invalid", formatDecodeError(decoded.error));
    },
  };
}
