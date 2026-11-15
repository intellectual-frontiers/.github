/**
 * Media types by file extension (commons 0005-typescript-runtime FR-037): what a server says a file is, with `charset=UTF-8` on text, so a
 * page, a stylesheet, a feed or a book is served as what it is. The table holds the types the harnesses serve and publish (web, documents,
 * images, fonts, audio and video, archives, data); an extension it does not hold is `application/octet-stream` to `contentType`. Replaces
 * `@std/media-types` in erga.
 *
 * @example
 * ```ts
 * import { contentType, mediaType } from "./media-types.ts";
 * contentType("site/index.html"); // "text/html; charset=UTF-8"
 * mediaType(".epub"); // "application/epub+zip"
 * ```
 *
 * @module
 */

/** The media type of each extension (lower case, without its dot). */
export const MEDIA_TYPES: Readonly<Record<string, string>> = {
  html: "text/html",
  htm: "text/html",
  xhtml: "application/xhtml+xml",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  ts: "text/typescript",
  map: "application/json",
  json: "application/json",
  jsonld: "application/ld+json",
  webmanifest: "application/manifest+json",
  xml: "application/xml",
  xsl: "application/xslt+xml",
  rss: "application/rss+xml",
  atom: "application/atom+xml",
  opf: "application/oebps-package+xml",
  ncx: "application/x-dtbncx+xml",
  txt: "text/plain",
  text: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  adoc: "text/asciidoc",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  ics: "text/calendar",
  vtt: "text/vtt",
  yaml: "application/yaml",
  yml: "application/yaml",
  toml: "application/toml",
  wasm: "application/wasm",
  pdf: "application/pdf",
  epub: "application/epub+zip",
  zip: "application/zip",
  gz: "application/gzip",
  tgz: "application/gzip",
  tar: "application/x-tar",
  xz: "application/x-xz",
  zst: "application/zstd",
  "7z": "application/x-7z-compressed",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  png: "image/png",
  apng: "image/apng",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/vnd.microsoft.icon",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  wav: "audio/wav",
  flac: "audio/flac",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
};

/** Whether text of a media type is read as characters, and so served with a charset. */
export function isTextual(type: string): boolean {
  return (
    type.startsWith("text/") ||
    /^application\/(?:json|ld\+json|manifest\+json|xml|xhtml\+xml|xslt\+xml|rss\+xml|atom\+xml|yaml|toml|javascript)$/.test(type) ||
    type === "image/svg+xml" ||
    type.endsWith("+xml") ||
    type.endsWith("+json")
  );
}

/**
 * The extension of a path (`site/index.html` gives `html`), or an extension given on its own (`.html` or `html`), in lower case without its
 * dot; `""` where a path has none. A name that starts with a dot and has no other (`.epub`) is taken as an extension.
 */
export function extensionOf(pathOrExtension: string): string {
  const name = pathOrExtension.slice(Math.max(pathOrExtension.lastIndexOf("/"), pathOrExtension.lastIndexOf("\\")) + 1);
  const dot = name.lastIndexOf(".");
  if (name === pathOrExtension && dot <= 0) return (dot === 0 ? name.slice(1) : name).toLowerCase();
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/** The media type of a path or an extension, or undefined where the table does not hold it. */
export function mediaType(pathOrExtension: string): string | undefined {
  const ext = extensionOf(pathOrExtension);
  return Object.hasOwn(MEDIA_TYPES, ext) ? MEDIA_TYPES[ext] : undefined;
}

/** What a `Content-Type` header says for a path or an extension: its media type, with `; charset=UTF-8` for text; `application/octet-stream` where it is not known. */
export function contentType(pathOrExtension: string): string {
  const type = mediaType(pathOrExtension) ?? "application/octet-stream";
  return isTextual(type) ? `${type}; charset=UTF-8` : type;
}
