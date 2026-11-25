// Spec: 0002-sql-governance FR-004
/**
 * The media type a path's name says: a closed table of the extensions of the files a fleet and its documents are made of, so that a catalog can ask for the kind of a file without reading it. A name
 * with no extension in the table has none, and nothing is guessed from the bytes.
 *
 * @example
 * ```ts
 * import { mediaTypeOf } from "./media.ts";
 * mediaTypeOf("fleet/synthetic-server-01/asset.json"); // "application/json"
 * mediaTypeOf("README"); // undefined
 * ```
 *
 * @module
 */

const TABLE: Readonly<Record<string, string>> = {
  json: "application/json",
  json5: "application/json5",
  yaml: "application/yaml",
  yml: "application/yaml",
  toml: "application/toml",
  xml: "application/xml",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  md: "text/markdown",
  adoc: "text/asciidoc",
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  ts: "text/typescript",
  sh: "text/x-shellscript",
  sql: "application/sql",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gz: "application/gzip",
  tgz: "application/gzip",
  zip: "application/zip",
  epub: "application/epub+zip",
};

/** The media type the extension of the last segment of a path says, or nothing. */
export function mediaTypeOf(path: string): string | undefined {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return undefined;
  return Object.hasOwn(TABLE, name.slice(dot + 1).toLowerCase()) ? TABLE[name.slice(dot + 1).toLowerCase()] : undefined;
}
