// Spec: 0001-formats FR-020
/**
 * Formats, the file and wire formats of Intellectual Frontiers Commons, read and written in pure code with no outside package (its specification 0001-formats): JSON5, YAML, TOML, XML, CSV, base64 and hexadecimal,
 * ASN.1 DER (as `der`), CBOR (as `cbor`), archives (tar, gzip, zip), PNG and ICO pictures (as `png`), TypeScript literals, glob patterns (as `glob`), semantic versions, media types and HTTP headers. It
 * depends on `core` alone, names no host global and runs wherever ECMAScript does: Bun, Node 26, a browser, a Worker.
 *
 * @example
 * ```ts
 * import { parseYaml, toJson5 } from "@intellectual-frontiers/formats";
 * const doc = parseYaml("name: commons\nlevels: [L0, L1]\n");
 * doc.kind === "ok" ? toJson5(doc.value) : doc.error;
 * ```
 *
 * @module
 */
export {
  ArchiveFailure,
  concat,
  crc32,
  deflateRaw,
  dosDate,
  filesOf,
  formatArchiveError,
  gunzip,
  gzip,
  isSafePath,
  linksOf,
  readTarStream,
  sortedPaths,
  splitName,
  tar,
  tarHeader,
  untar,
  untarStream,
  unzip,
  zip,
  ZIP_EPOCH,
  zipDeflated,
  zipEntries,
  zipRead,
} from "./archive.ts";
export type { ArchiveError, Files, TarEntry, TarHeader, TarLink, TarStreamEntry, ZipEntry } from "./archive.ts";
export { DEFAULT_MAX_BYTES, isXz, unxz } from "./xz.ts";
export type { UnxzOptions } from "./xz.ts";
export { fromBase64, fromBase64Url, toBase64, toBase64Url } from "./base64.ts";
export * as cbor from "./cbor.ts";
export { csvField, formatCsvError, parseCsv, parseCsvRecords, toCsv } from "./csv.ts";
export type { CsvError, CsvOptions } from "./csv.ts";
export * as der from "./der.ts";
export * as glob from "./glob.ts";
export {
  entityTag,
  entityTags,
  ifMatch,
  ifNoneMatch,
  isSafeMethod,
  nextLink,
  parseLinkHeader,
  retryAfterMs,
  SAFE_METHODS,
} from "./http.ts";
export type { WebLink } from "./http.ts";
export { formatJson5Error, isBareKey, isJsonObject, parseJson5, toJson5 } from "./json5.ts";
export type { Json, Json5Error, JsonObject } from "./json5.ts";
export { contentType, extensionOf, isTextual, MEDIA_TYPES, mediaType } from "./media-types.ts";
export {
  atLeast,
  bump,
  bumpSuffices,
  compareDotted,
  compareSemVer,
  dottedParts,
  formatRange,
  formatSemVer,
  maxSatisfying,
  parseRange,
  parseSemVer,
  satisfies,
  versionIn,
} from "./semver.ts";
export type { Change, Comparator, Level, Operator, Range, SatisfiesOptions, SemVer } from "./semver.ts";
export { fromHex, toHex } from "./hex.ts";
export * as png from "./png.ts";
export { formatTomlError, isTomlDateTime, isTomlTable, parseToml, tomlKey, tomlString, toToml } from "./toml.ts";
export type { TomlDateTime, TomlError, TomlTable, TomlValue } from "./toml.ts";
export { BARE_KEY, exportedLiteral, parseTsLiteral, tsKey, tsLiteral } from "./ts-literal.ts";
export type { Literal, LiteralError, LiteralShape } from "./ts-literal.ts";
export {
  attribute,
  child,
  children,
  descendants,
  el,
  escapeXml,
  formatXmlError,
  leaf,
  localName,
  readXml,
  textOf,
  writeNode,
  writeXml,
} from "./xml.ts";
export { formatYamlError, isPlainSafe, parseYaml, resolveCore, toYaml } from "./yaml.ts";
export type { YamlError, YamlOptions } from "./yaml.ts";
export type { ReadXmlOptions, XmlChild, XmlElement, XmlError, XmlNode, XmlText } from "./xml.ts";
