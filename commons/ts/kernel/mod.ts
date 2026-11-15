/**
 * The kernel of IFC TypeScript (commons 0005-typescript-runtime): pure code that imports nothing outside this folder, has no effect on the
 * host and runs wherever ECMAScript and the web standards do (Deno, Node, Bun, a browser, a Cloudflare Worker). Errors as values,
 * exhaustive matching, branded identifiers, decoders at the boundary; versions, SHA-256, SHA-512 crypt, base64, ASN.1 DER (as `der`), CMS
 * encryption (as `cms`) and signed in-toto statements (as `dsse`); PNG and ICO pictures (as `png`); archives, JSON5, TOML, YAML, CSV, XML
 * and TypeScript literals; HTTP headers and media types; graphs; command-line arguments (as `args`); OS scheduled jobs planned (as
 * `jobs`); and type-level tests.
 *
 * @example
 * ```ts
 * import { absurd, err, ok, type Result } from "./mod.ts";
 * type Stage = { readonly kind: "intake" } | { readonly kind: "review" };
 * function next(s: Stage): Result<Stage, string> {
 *   switch (s.kind) {
 *     case "intake": return ok({ kind: "review" });
 *     case "review": return err("review is the last stage");
 *     default: return absurd(s);
 *   }
 * }
 * ```
 *
 * @module
 */
export { absurd } from "./absurd.ts";
export {
  concat,
  crc32,
  dosDate,
  filesOf,
  formatArchiveError,
  gunzip,
  gzip,
  isSafePath,
  sortedPaths,
  splitName,
  tar,
  tarHeader,
  untar,
  unzip,
  zip,
  ZIP_EPOCH,
  zipEntries,
  zipRead,
} from "./archive.ts";
export type { ArchiveError, Files, TarEntry, ZipEntry } from "./archive.ts";
export { fromBase64, fromBase64Url, toBase64, toBase64Url } from "./base64.ts";
export type { Brand } from "./brand.ts";
export * as args from "./args.ts";
export * as assess from "./assess.ts";
export * as cms from "./cms.ts";
export { csvField, formatCsvError, parseCsv, parseCsvRecords, toCsv } from "./csv.ts";
export type { CsvError, CsvOptions } from "./csv.ts";
export { CRYPT_ROUNDS, cryptSalt, sha512Crypt, verifySha512Crypt } from "./crypt.ts";
export {
  array,
  boolean,
  describe,
  formatDecodeError,
  integer,
  json,
  literal,
  mapDecoder,
  nullable,
  number,
  object,
  oneOf,
  record,
  refine,
  string,
  tagged,
  tuple,
  unknownValue,
} from "./decode.ts";
export type { Decoded, DecodeError, Decoder, Fields, ObjectOf } from "./decode.ts";
export * as der from "./der.ts";
export * as dsse from "./dsse.ts";
export * as evidence from "./evidence.ts";
export * as grc from "./grc.ts";
export { order, schedule } from "./graph.ts";
export type { Cycle, Graph, Ran } from "./graph.ts";
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
export { all, andThen, attempt, done, err, isErr, isOk, map, mapErr, match, ok, orElse, settle, unwrapOr } from "./result.ts";
export type { Err, Ok, Result } from "./result.ts";
export { atLeast, bump, bumpSuffices, compareDotted, compareSemVer, dottedParts, formatSemVer, parseSemVer, versionIn } from "./semver.ts";
export type { Change, Level, SemVer } from "./semver.ts";
export { fromHex, parseSha256Sums, sameSha256, sha256, sha256Of, toHex } from "./sha256.ts";
export type { Sha256 } from "./sha256.ts";
export { ANSI, lf, plain, quoteArgs, splitArgs } from "./text.ts";
export * as palette from "./palette.ts";
export * as png from "./png.ts";
export * as jobs from "./schedule.ts";
export { formatTomlError, isTomlDateTime, isTomlTable, parseToml, tomlKey, tomlString, toToml } from "./toml.ts";
export type { TomlDateTime, TomlError, TomlTable, TomlValue } from "./toml.ts";
export { BARE_KEY, exportedLiteral, parseTsLiteral, tsKey, tsLiteral } from "./ts-literal.ts";
export type { Literal, LiteralError } from "./ts-literal.ts";
export { expectType } from "./types.ts";
export * as vt from "./vt.ts";
export * as width from "./width.ts";
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
export type { Equal, Extends, Not } from "./types.ts";
