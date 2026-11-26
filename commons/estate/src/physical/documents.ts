// Spec: 0005-estate-fleet-documents FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The documents of a fleet store (commons estate 0005-estate-fleet-documents): what is kept of an estate in a store, one typed document each, with the schema that reads it and the layout that
 * names it written as code. An asset is a document of its own and is read back through `defineAsset`, so a stored asset that breaks a rule of the estate is a finding and never a value. An observation
 * is one document that is written once; a declaration and the risks accepted of an asset are one document each, changed only by a write that expects the revision it read; a reference to evidence
 * holds the digest, never the bytes, which stay in the evidence stores of grc; and a manifest says what the store is and at which schema it is kept.
 *
 * @example
 * ```ts
 * import { assetCodec, ASSETS } from "./documents.ts";
 * ASSETS; // "assets"
 * assetCodec.mediaType; // "application/json"
 * ```
 *
 * @module
 */
import { type Decoder, type DecodeError, array, err, formatDecodeError, integer, literal, object, ok, record, string, type Result } from "@intellectual-frontiers/core";
import {
  byId,
  type Codec,
  defineSchema,
  type DocId,
  type Extension,
  jsonTree,
  isJsonObject,
  type JsonObject,
  type Layout,
  parseDocId,
  parseExtension,
  sharded,
  toJsonValue,
  versioned,
} from "@intellectual-frontiers/anyfs/docs";
import { parsePrefix, type Prefix } from "@intellectual-frontiers/anyfs/governance";
import type { Json } from "@intellectual-frontiers/grc/governance";
import { type Asset, type AssetInput, type AttributeValue, defineAsset, ORIGINS, STATES } from "@intellectual-frontiers/estate/governance";

/** The schema the manifest of a store says it is kept at, and the one this code reads and writes. */
export const FLEET_SCHEMA = 1;
/** The layout of the folders: the paths below, as this code names them. */
export const FLEET_LAYOUT = 1;

const prefix = (text: string): Prefix => {
  const made = parsePrefix(text);
  if (made.kind === "err") throw new Error(`the fixed prefix ${text} is not one: ${made.error}`);
  return made.value;
};
const extension = (text: string): Extension => {
  const made = parseExtension(text);
  if (made.kind === "err") throw new Error(`the fixed extension ${text} is not one: ${made.error}`);
  return made.value;
};

/** Where the assets are: `assets/<first character>/<id>.json`. */
export const ASSETS: Prefix = prefix("assets");
/** Where the observations are: `observations/<asset>/<instant>.json`. */
export const OBSERVATIONS: Prefix = prefix("observations");
/** Where the declarations are: `declarations/<first character>/<asset>.json`. */
export const DECLARATIONS: Prefix = prefix("declarations");
/** Where the accepted risks are: `acceptances/<first character>/<asset>.json`. */
export const ACCEPTANCES: Prefix = prefix("acceptances");
/** Where the references to evidence are: `evidence/<asset>/<digest>.json`. */
export const EVIDENCE: Prefix = prefix("evidence");
/** The folder of the manifest, which is the root. */
export const ROOT_FOLDER: Prefix = prefix("");

const JSON_EXTENSION = extension(".json");

/** A stored document is a `Json` value: a tree of null, booleans, numbers, text, lists and objects, no deeper than this. */
const MAX_DEPTH = 32;

function isJson(value: unknown, depth: number): value is Json {
  if (depth > MAX_DEPTH) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((v) => isJson(v, depth + 1));
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every((v) => isJson(v, depth + 1));
  return false;
}

const decodeError = (path: string, expected: string, found: string): DecodeError => ({ kind: "decode", path, expected, found });

/** A decoder of a JSON value, no deeper than 32 levels. */
export const jsonValue: Decoder<Json> = (input, path = "$") => (isJson(input, 0) ? ok(input) : err(decodeError(path, "a JSON value", typeof input)));

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

/** A decoder of an instant: a UTC instant in the form `YYYY-MM-DDTHH:MM:SS[.fff]Z` that the calendar has. */
export const instantText: Decoder<string> = (input, path = "$") => {
  if (typeof input !== "string" || !ISO.test(input) || Number.isNaN(Date.parse(input))) return err(decodeError(path, "an instant such as 2026-11-20T10:00:00Z", typeof input === "string" ? JSON.stringify(input.slice(0, 40)) : typeof input));
  return ok(input);
};

/** The instant of a time in milliseconds, in the one form the documents use. */
export function instantOf(ms: number): string {
  return new Date(ms).toISOString();
}

/** The compact form of an instant that names an observation: the same characters with the hyphens and colons left out, so that the names sort as the instants do. */
export function observationKey(at: string): Result<DocId, string> {
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return err(`${JSON.stringify(at)} is not an instant`);
  return parseDocId(instantOf(ms).replaceAll("-", "").replaceAll(":", ""));
}

function mustSchema<T>(made: Result<T, string>): T {
  if (made.kind === "err") throw new Error(`a fixed schema is refused: ${made.error}`);
  return made.value;
}

/** What a document is written with: the value as a JSON object that its own decoder accepts, so that nothing is written that could not be read back. */
function checkedEncode<T>(decoder: Decoder<T>): (value: T) => Result<JsonObject, string> {
  return (value) => {
    const tree = toJsonValue(value);
    if (tree.kind === "err") return tree;
    if (!isJsonObject(tree.value)) return err("a document is a JSON object");
    const back = decoder(tree.value);
    return back.kind === "ok" ? ok(tree.value) : err(formatDecodeError(back.error));
  };
}

/** Why a stored value is not what the document says. */
const refused = (path: string, expected: string, problems: readonly string[]): DecodeError => decodeError(path, expected, problems.join("; "));

// --- the asset -------------------------------------------------------------------------------------------------------------------------------------

// attributes are optional, so that a document written before they existed still decodes (the schema version stays 1: a field was added, none was changed)
const attributeValue: Decoder<AttributeValue> = (input, path = "$") => {
  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") return ok(input);
  if (Array.isArray(input) && input.every((x) => typeof x === "string")) return ok(input as readonly string[]);
  return err(decodeError(path, "a string, a number, a boolean or a list of strings", typeof input));
};
const assetFields = object({ id: string, kind: string, state: literal(...STATES), owners: record(string) }, { origin: literal(...ORIGINS), attributes: record(attributeValue) });

const assetDecoder: Decoder<Asset> = (input, path = "$") => {
  const fields = assetFields(input, path);
  if (fields.kind === "err") return fields;
  const made = defineAsset({ id: fields.value.id, kind: fields.value.kind, state: fields.value.state, owners: fields.value.owners, ...(fields.value.origin === undefined ? {} : { origin: fields.value.origin }), ...(fields.value.attributes === undefined ? {} : { attributes: fields.value.attributes }) });
  return made.kind === "ok" ? ok(made.value) : err(refused(path, "an asset the estate accepts", made.error));
};

function assetEncode(asset: Asset): Result<JsonObject, string> {
  const owners: Record<string, string> = {};
  for (const line of asset.capabilities) if (line.offered) owners[line.capability] = line.owner;
  return ok({ id: asset.id, kind: asset.kind, state: asset.state, ...(asset.origin === undefined ? {} : { origin: asset.origin }), ...(asset.attributes === undefined ? {} : { attributes: asset.attributes as unknown as JsonObject[string] }), owners });
}

/** The input an asset is made from: the owners of the capabilities it offers. */
export function inputOf(asset: Asset): AssetInput {
  const owners: Partial<Record<(typeof asset.capabilities)[number]["capability"], string>> = {};
  for (const line of asset.capabilities) if (line.offered) owners[line.capability] = line.owner;
  return { id: asset.id, kind: asset.kind, state: asset.state, ...(asset.origin === undefined ? {} : { origin: asset.origin }), ...(asset.attributes === undefined ? {} : { attributes: asset.attributes }), owners };
}

/** The codec of an asset document. */
export const assetCodec: Codec<Asset> = versioned(jsonTree, mustSchema(defineSchema<Asset>({ current: 1, decoder: assetDecoder, encode: assetEncode })));

// --- the observation -------------------------------------------------------------------------------------------------------------------------------

/** What a policy found, as a document keeps it. */
export type StoredResult = { readonly id: string; readonly status: "pass" | "fail" | "warn" | "unknown"; readonly controls: readonly string[] };

/** An observation as it is kept: of which asset, when, attributed to which source, the keyed records seen and the results of the policies. */
export type StoredObservation = {
  readonly asset: string;
  readonly at: string;
  readonly source: string;
  readonly state: Readonly<Record<string, Json>>;
  readonly results: readonly StoredResult[];
};

const resultDecoder: Decoder<StoredResult> = object({ id: string, status: literal("pass", "fail", "warn", "unknown"), controls: array(string) });

const observationFields = object({ asset: string, at: instantText, source: string, state: record(jsonValue) }, { results: array(resultDecoder) });

const observationDecoder: Decoder<StoredObservation> = (input, path = "$") => {
  const fields = observationFields(input, path);
  if (fields.kind === "err") return fields;
  return ok({ asset: fields.value.asset, at: fields.value.at, source: fields.value.source, state: fields.value.state, results: fields.value.results ?? [] });
};

/** The codec of an observation document. */
export const observationCodec: Codec<StoredObservation> = versioned(jsonTree, mustSchema(defineSchema<StoredObservation>({ current: 1, decoder: observationDecoder, encode: checkedEncode(observationDecoder) })));

// --- the declaration -------------------------------------------------------------------------------------------------------------------------------

/** What is declared of an asset, who declared it and when. */
export type StoredDeclaration = { readonly asset: string; readonly declared: Readonly<Record<string, Json>>; readonly by: string; readonly at: string };

const declarationDecoder: Decoder<StoredDeclaration> = object({ asset: string, declared: record(jsonValue), by: string, at: instantText });

/** The codec of a declaration document. */
export const declarationCodec: Codec<StoredDeclaration> = versioned(jsonTree, mustSchema(defineSchema<StoredDeclaration>({ current: 1, decoder: declarationDecoder, encode: checkedEncode(declarationDecoder) })));

// --- the accepted risks ----------------------------------------------------------------------------------------------------------------------------

/** One risk a person accepted of an asset. */
export type StoredRisk = { readonly policy: string; readonly reason: string; readonly by: string; readonly until: string };
/** The risks accepted of an asset, by policy. */
export type StoredAcceptances = { readonly asset: string; readonly risks: readonly StoredRisk[] };

const riskDecoder: Decoder<StoredRisk> = object({ policy: string, reason: string, by: string, until: string });
const acceptancesDecoder: Decoder<StoredAcceptances> = object({ asset: string, risks: array(riskDecoder) });

/** The codec of an accepted-risks document. */
export const acceptancesCodec: Codec<StoredAcceptances> = versioned(jsonTree, mustSchema(defineSchema<StoredAcceptances>({ current: 1, decoder: acceptancesDecoder, encode: checkedEncode(acceptancesDecoder) })));

// --- the reference to evidence ---------------------------------------------------------------------------------------------------------------------

/** A reference to evidence kept in an evidence store: the digest of its bytes, the store, what it is about and what kind it is. The bytes are never here. */
export type StoredEvidence = {
  readonly subject: string;
  readonly digest: string;
  readonly store: string;
  readonly type: string;
  readonly observedAt: string;
  readonly mediaType?: string;
  readonly size?: number;
  readonly producer?: string;
};

const DIGEST = /^[a-f0-9]{64}$/;
const digestText: Decoder<string> = (input, path = "$") => (typeof input === "string" && DIGEST.test(input) ? ok(input) : err(decodeError(path, "a SHA-256 digest of 64 hexadecimal digits", typeof input)));
const evidenceDecoder: Decoder<StoredEvidence> = object({ subject: string, digest: digestText, store: string, type: string, observedAt: instantText }, { mediaType: string, size: integer, producer: string });

/** The codec of an evidence-reference document. */
export const evidenceCodec: Codec<StoredEvidence> = versioned(jsonTree, mustSchema(defineSchema<StoredEvidence>({ current: 1, decoder: evidenceDecoder, encode: checkedEncode(evidenceDecoder) })));

// --- the manifest ----------------------------------------------------------------------------------------------------------------------------------

/** What a store says it is: which fleet, at which schema and layout it is kept, and when it was made. */
export type Manifest = { readonly store: string; readonly schema: number; readonly layout: number; readonly created: string };

const manifestDecoder: Decoder<Manifest> = object({ store: string, schema: integer, layout: integer, created: instantText });

/** The codec of the manifest. It is read at any schema, so that a newer store is refused with a reason and not as an unreadable file. */
export const manifestCodec: Codec<Manifest> = versioned(jsonTree, mustSchema(defineSchema<Manifest>({ current: 1, decoder: manifestDecoder, encode: checkedEncode(manifestDecoder) })));

/** The key of the manifest, `fleet.json` at the root. */
export const MANIFEST_KEY: DocId = ((): DocId => {
  const made = parseDocId("fleet");
  if (made.kind === "err") throw new Error(made.error);
  return made.value;
})();

// --- the layouts -----------------------------------------------------------------------------------------------------------------------------------

/** The layout of the assets, declarations and accepted risks: one file for each asset below a folder of the first character of its identity, so that an identity of any length has a place. */
export const shardedById: Layout<DocId> = ((): Layout<DocId> => {
  const made = sharded(JSON_EXTENSION, 1);
  if (made.kind === "err") throw new Error(made.error);
  return made.value;
})();

/** The layout of the manifest and of the observations of one asset: one file for each key directly below the folder. */
export const flatById: Layout<DocId> = byId(JSON_EXTENSION);

