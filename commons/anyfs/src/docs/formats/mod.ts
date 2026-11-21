// Spec: 0006-anyfs-documents FR-012
/**
 * The codecs of documents that need the file formats of commons: JSON5 and YAML trees. They read what the format holds as a JSON value and write it back in the format's own canonical text; use `versioned`
 * over one of them for a typed document with a version.
 *
 * @example
 * ```ts
 * import { yamlTree } from "@intellectual-frontiers/anyfs/docs/formats";
 * yamlTree.mediaType; // "application/yaml"
 * ```
 *
 * @module
 */
import { parseJson5, toJson5 } from "@intellectual-frontiers/formats/json5";
import { formatJson5Error } from "@intellectual-frontiers/formats/json5";
import { formatYamlError, parseYaml, toYaml } from "@intellectual-frontiers/formats/yaml";
import { err, ok } from "@intellectual-frontiers/core";
import { type Codec, type JsonValue, problem, textCodec, toJsonValue } from "@intellectual-frontiers/anyfs/docs";

const fromText = (read: (text: string) => { readonly kind: "ok"; readonly value: unknown } | { readonly kind: "err"; readonly error: string }): Codec<JsonValue>["decode"] => (bytes) => {
  const text = textCodec.decode(bytes);
  if (text.kind === "err") return text;
  const parsed = read(text.value.value);
  if (parsed.kind === "err") return err(problem("malformed", parsed.error));
  const tree = toJsonValue(parsed.value);
  return tree.kind === "ok" ? ok({ value: tree.value, stale: false }) : err(problem("malformed", tree.error));
};

/** JSON5 trees: comments and trailing commas are read; the text written is the format's own. */
export const json5Tree: Codec<JsonValue> = {
  mediaType: "application/json5",
  encode: (value) => textCodec.encode(toJson5(value)),
  decode: fromText((text) => {
    const r = parseJson5(text);
    return r.kind === "ok" ? r : { kind: "err", error: formatJson5Error(r.error) };
  }),
};

/** YAML trees, in the core schema. */
export const yamlTree: Codec<JsonValue> = {
  mediaType: "application/yaml",
  encode: (value) => textCodec.encode(toYaml(value)),
  decode: fromText((text) => {
    const r = parseYaml(text);
    return r.kind === "ok" ? r : { kind: "err", error: formatYamlError(r.error) };
  }),
};
