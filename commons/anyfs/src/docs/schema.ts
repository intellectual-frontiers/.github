// Spec: 0006-anyfs-documents FR-003, FR-004
/**
 * The version of a document as code: a schema has the number of the version it writes and the decoder of that version. A document carries its version in the field `$version`; one without the field is version 1.
 * A document of any other version than the schema's is refused and never guessed at.
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

/** The version a document is written at and how to read it. */
export type Schema<T> = {
  readonly current: number;
  readonly decoder: Decoder<T>;
  readonly encode: (value: T) => Result<JsonObject, string>;
};

/** What a schema is made from. */
export type SchemaSpec<T> = {
  readonly current: number;
  readonly decoder: Decoder<T>;
  readonly encode?: (value: T) => Result<JsonObject, string>;
};

const plain = <T>(value: T): Result<JsonObject, string> => {
  const tree = toJsonValue(value);
  if (tree.kind === "err") return tree;
  return isJsonObject(tree.value) ? ok(tree.value) : err("a document is a JSON object");
};

/** A schema, or why the specification is not one: the version is a positive whole number. */
export function defineSchema<T>(spec: SchemaSpec<T>): Result<Schema<T>, string> {
  if (!Number.isInteger(spec.current) || spec.current < 1) return err("the current version is a positive whole number");
  return ok({ current: spec.current, decoder: spec.decoder, encode: spec.encode ?? ((value: T) => plain(value)) });
}

const refused = (reason: CodecProblem["reason"], detail: string) => err(problem(reason, detail));

/** The codec of a schema over a codec of JSON trees: it writes the current version and reads that version only. */
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
      if (version !== schema.current) return refused("version", `written at version ${version}, and this code reads version ${schema.current}`);
      const { [VERSION_FIELD]: _version, ...rest } = root;
      const decoded = schema.decoder(rest);
      return decoded.kind === "ok" ? ok({ value: decoded.value }) : refused("invalid", formatDecodeError(decoded.error));
    },
  };
}
