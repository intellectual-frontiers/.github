// Spec: 0002-query-language FR-002
/**
 * The media type of a name, from what follows its last dot (commons anyfs-query 0002-query-language FR-002): a short table of the types a file store has, and `application/octet-stream` for the rest. A store
 * that is told the type of what it keeps has no such table to keep; this is what a listing that does not say has.
 *
 * @module
 */
const TYPES: Readonly<Record<string, string>> = {
  json: "application/json",
  json5: "application/json5",
  yaml: "application/yaml",
  yml: "application/yaml",
  toml: "application/toml",
  xml: "application/xml",
  txt: "text/plain",
  md: "text/markdown",
  html: "text/html",
  css: "text/css",
  csv: "text/csv",
  ts: "text/typescript",
  js: "text/javascript",
  sh: "text/x-shellscript",
  ps1: "text/x-powershell",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  epub: "application/epub+zip",
};

/** The media type of an extension, without regard to case. */
export const mediaTypeOf = (ext: string): string => {
  const key = ext.toLowerCase();
  return Object.hasOwn(TYPES, key) ? (TYPES[key] ?? "application/octet-stream") : "application/octet-stream";
};
