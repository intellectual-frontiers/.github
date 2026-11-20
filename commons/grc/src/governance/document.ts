// Spec: 0004-grc-documents FR-001, FR-002
/**
 * The document envelope (0004-grc-documents): everything GRC persists or exchanges is `{ kind, schema, id, createdAt, provenance, ...body }`. `defineKind` makes the decoder of a kind from
 * the decoders of its body, a registry of kinds holds them by `kind`, and `readDocument` reads text or a value through it, knowing exactly the schema each kind has in this release: a
 * document of another schema is an error value that names both, never read by a second reader.
 *
 * @example
 * ```ts
 * import { createKinds, defineKind, readDocument } from "./document.ts";
 * import { string } from "@intellectual-frontiers/core";
 * const note = defineKind("grc.note", "1", { text: string });
 * const kinds = createKinds();
 * kinds.register(note);
 * readDocument(kinds, "{}"); // an error value: the kind is missing
 * ```
 *
 * @module
 */
import { array, type Decoded, type DecodeError, type Decoder, err, type Fields, ok, object, type ObjectOf, type Result, string } from "@intellectual-frontiers/core";
import { createRegistry, type Registry } from "./registry.ts";
import { instantMs } from "./time.ts";

/** An ISO 8601 instant with a zone. */
export const instant: Decoder<string> = (input, path = "$") =>
  typeof input === "string" && instantMs(input) !== undefined
    ? ok(input)
    : err({ kind: "decode", path, expected: "an ISO 8601 instant with a zone", found: typeof input === "string" ? input : typeof input });

/** Provenance: the producer, what it was made from (ids or digests), and optionally who or what acted. */
export const provenanceDecoder = object({ producer: object({ name: string, version: string }), inputs: array(string) }, { actor: string });
/** Provenance. */
export type Provenance = Decoded<typeof provenanceDecoder>;

/** What every document has. */
export type Document = {
  readonly kind: string;
  readonly schema: string;
  readonly id: string;
  readonly createdAt: string;
  readonly provenance: Provenance;
};

/** A kind of document: its decoder, with the one schema it knows. Its `id` is its `kind`, the stable id in the registry of kinds. */
export type DocumentKind<T extends Document = Document> = {
  readonly id: string;
  readonly kind: string;
  readonly schema: string;
  readonly decode: Decoder<T>;
};

const head = object({ kind: string, schema: string, id: string, createdAt: instant, provenance: provenanceDecoder });

/** The kind `kind` at `schema`, with a body of these required and optional fields, and optionally a check of the whole that says what is wrong. */
export function defineKind<R extends Fields, O extends Fields = Record<never, never>>(
  kind: string,
  schema: string,
  required: R,
  optional?: O,
  validate?: (value: Document & ObjectOf<R, O>) => string | undefined,
): DocumentKind<Document & ObjectOf<R, O>> {
  const body = object(required, optional ?? ({} as O));
  return {
    id: kind,
    kind,
    schema,
    decode(input, path = "$") {
      const h = head(input, path);
      if (h.kind === "err") return h;
      if (h.value.kind !== kind) return err({ kind: "decode", path: `${path}.kind`, expected: kind, found: h.value.kind });
      if (h.value.schema !== schema) return err({ kind: "decode", path: `${path}.schema`, expected: schema, found: h.value.schema });
      const b = body(input, path);
      if (b.kind === "err") return b;
      const value = { ...h.value, ...b.value } as Document & ObjectOf<R, O>;
      const problem = validate?.(value);
      return problem === undefined ? ok(value) : err({ kind: "decode", path, expected: problem, found: h.value.id });
    },
  };
}

/** A registry of kinds of documents. */
export type Kinds = Registry<DocumentKind>;

/** A registry of kinds, empty. */
export function createKinds(): Kinds {
  return createRegistry<DocumentKind>("document kind");
}

/** Why a document was not read. */
export type ReadProblem =
  | { readonly kind: "json"; readonly message: string }
  | { readonly kind: "no-kind"; readonly found: string }
  | { readonly kind: "unknown-kind"; readonly found: string }
  | { readonly kind: "schema"; readonly documentKind: string; readonly found: string; readonly expected: string }
  | { readonly kind: "decode"; readonly error: DecodeError };

/** The document in `input` (a value, or its JSON text), through the registry; or why it cannot be read. */
export function readDocument(kinds: Kinds, input: unknown): Result<Document, ReadProblem> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch (e) {
      return err({ kind: "json", message: e instanceof Error ? e.message : String(e) });
    }
  }
  const k: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "kind") : undefined;
  if (typeof k !== "string") return err({ kind: "no-kind", found: typeof k });
  const def = kinds.get(k);
  if (def === undefined) return err({ kind: "unknown-kind", found: k });
  const s: unknown = typeof value === "object" && value !== null ? Reflect.get(value, "schema") : undefined;
  if (s !== def.schema) return err({ kind: "schema", documentKind: k, found: typeof s === "string" ? s : typeof s, expected: def.schema });
  const d = def.decode(value);
  return d.kind === "ok" ? d : err({ kind: "decode", error: d.error });
}

/** One sentence for a problem. */
export function describeReadProblem(p: ReadProblem): string {
  switch (p.kind) {
    case "json":
      return `not JSON: ${p.message}`;
    case "no-kind":
      return `no kind: a document says its kind (found ${p.found})`;
    case "unknown-kind":
      return `unknown kind ${p.found}`;
    case "schema":
      return `${p.documentKind} of schema ${p.found}: this release reads schema ${p.expected} only`;
    case "decode":
      return `${p.error.path}: expected ${p.error.expected}, found ${p.error.found}`;
  }
}

/** The producer every document of this library names. */
export const PRODUCER = { name: "@intellectual-frontiers/grc", version: "0.2.0" } as const;

/** Provenance for a document made here from the documents or digests `inputs`. */
export function provenanceOf(inputs: readonly string[] = [], actor?: string): Provenance {
  return actor === undefined ? { producer: PRODUCER, inputs } : { producer: PRODUCER, inputs, actor };
}
