// Spec: 0002-anyfs-serve-governance FR-004
/**
 * The content types by extension: a small typed table the server reads and never grows by itself. What it does not name is `application/octet-stream`, and a text that is not a name is that too.
 *
 * @example
 * ```ts
 * import { contentTypeOf } from "./mime.ts";
 * contentTypeOf("report.pdf"); // "application/pdf"
 * contentTypeOf("noextension"); // "application/octet-stream"
 * ```
 *
 * @module
 */

/** The extensions the server knows, lower case, without the dot. */
export const CONTENT_TYPES: Readonly<Record<string, string>> = {
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  ts: "text/plain; charset=utf-8",
  json: "application/json",
  json5: "application/json5",
  yaml: "application/yaml",
  yml: "application/yaml",
  toml: "application/toml",
  xml: "application/xml",
  pdf: "application/pdf",
  zip: "application/zip",
  gz: "application/gzip",
  tgz: "application/gzip",
  tar: "application/x-tar",
  epub: "application/epub+zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  woff2: "font/woff2",
  sh: "text/plain; charset=utf-8",
  log: "text/plain; charset=utf-8",
};

/** The content type of a name: by its last extension, in lower case. */
export function contentTypeOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "application/octet-stream";
  return CONTENT_TYPES[name.slice(dot + 1).toLowerCase()] ?? "application/octet-stream";
}
