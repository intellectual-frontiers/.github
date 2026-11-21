// Spec: 0002-anyfs-s3-store FR-003
/**
 * The XML that S3 answers with, read by a small strict reader and not a general one. It reads one root element with its children, attributes (kept for nobody), text and the five named entities and the numeric
 * ones, and it refuses everything an answer of S3 never has and an attacker would use: a document type (and so every entity of its own), a comment, CDATA, a processing instruction after the declaration, a name or an
 * entity it does not know, a character XML 1.0 does not allow, more than a bound of bytes, depth or nodes, and text after the root. The two shapes the store needs are read from the tree: a `ListObjectsV2` answer and an
 * error.
 *
 * @example
 * ```ts
 * import { parseXml } from "./xml.ts";
 * const r = parseXml("<Error><Code>NoSuchKey</Code><Message>gone</Message></Error>");
 * r.kind === "ok" && r.value.children[0]?.text; // "NoSuchKey"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** An element: its name without a namespace prefix, its text where it has no children, and its children in order. */
export type XmlNode = { readonly name: string; readonly text: string; readonly children: readonly XmlNode[] };

/** What a document may be. */
export type XmlLimits = { readonly maxBytes: number; readonly maxDepth: number; readonly maxNodes: number };

/** The bounds of an answer of S3: a list of a thousand keys is far below them. */
export const DEFAULT_LIMITS: XmlLimits = { maxBytes: 16 * 1024 * 1024, maxDepth: 16, maxNodes: 200_000 };

const NAME = /^[A-Za-z_][A-Za-z0-9._-]*(?::[A-Za-z_][A-Za-z0-9._-]*)?/u;
const ATTRIBUTE = /^\s+([A-Za-z_][A-Za-z0-9._:-]*)\s*=\s*("([^"<]*)"|'([^'<]*)')/u;
const NAMED: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Whether XML 1.0 allows the code point in text. */
const allowed = (c: number): boolean => c === 0x9 || c === 0xa || c === 0xd || (c >= 0x20 && c <= 0xd7ff) || (c >= 0xe000 && c <= 0xfffd) || (c >= 0x10000 && c <= 0x10ffff);

function unescape(text: string): Result<string, string> {
  if (!text.includes("&")) return ok(text);
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i] ?? "";
    if (c !== "&") {
      out += c;
      i++;
      continue;
    }
    const end = text.indexOf(";", i);
    if (end < 0 || end - i > 10) return err("an entity that does not end");
    const name = text.slice(i + 1, end);
    const named = NAMED[name];
    if (named !== undefined) {
      out += named;
    } else {
      const m = /^#(?:(\d{1,7})|x([0-9a-fA-F]{1,6}))$/u.exec(name);
      if (m === null) return err(`the entity &${name}; is not one of the five and not a number`);
      const code = m[1] !== undefined ? Number.parseInt(m[1], 10) : Number.parseInt(m[2] ?? "", 16);
      if (!allowed(code)) return err(`the character reference &${name}; is not a character XML allows`);
      out += String.fromCodePoint(code);
    }
    i = end + 1;
  }
  return ok(out);
}

/** The one root element of a document, or why the text is not a document this reader takes. */
export function parseXml(source: string, limits: XmlLimits = DEFAULT_LIMITS): Result<XmlNode, string> {
  if (source.length > limits.maxBytes) return err(`the document is more than ${limits.maxBytes} characters`);
  let text = source.startsWith("﻿") ? source.slice(1) : source;
  if (!text.isWellFormed()) return err("the document holds a lone surrogate");
  for (const ch of text) if (!allowed(ch.codePointAt(0) ?? 0)) return err(`the document holds a character XML 1.0 does not allow (U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")})`);
  const declaration = /^<\?xml\s[^>?]*\?>/u.exec(text);
  if (declaration !== null) text = text.slice(declaration[0].length);
  let pos = 0;
  let nodes = 0;
  const skipSpace = (): void => {
    while (pos < text.length && /\s/u.test(text[pos] ?? "")) pos++;
  };
  const fail = (why: string): Result<never, string> => err(`${why} (at character ${pos})`);

  const element = (depth: number): Result<XmlNode, string> => {
    if (depth > limits.maxDepth) return fail(`the document is nested deeper than ${limits.maxDepth}`);
    if (++nodes > limits.maxNodes) return fail(`the document has more than ${limits.maxNodes} elements`);
    if (text[pos] !== "<") return fail("an element was expected");
    pos++;
    const named = NAME.exec(text.slice(pos, pos + 200));
    if (named === null) return fail("an element has no name this reader knows");
    pos += named[0].length;
    const name = named[0].includes(":") ? (named[0].split(":")[1] ?? "") : named[0];
    for (;;) {
      const a = ATTRIBUTE.exec(text.slice(pos, pos + 2000));
      if (a === null) break;
      pos += a[0].length;
    }
    skipSpace();
    if (text.startsWith("/>", pos)) {
      pos += 2;
      return ok({ name, text: "", children: [] });
    }
    if (text[pos] !== ">") return fail(`the tag of ${name} does not end`);
    pos++;
    const children: XmlNode[] = [];
    let body = "";
    for (;;) {
      const lt = text.indexOf("<", pos);
      if (lt < 0) return fail(`${name} is not closed`);
      const run = unescape(text.slice(pos, lt));
      if (run.kind === "err") return fail(run.error);
      body += run.value;
      pos = lt;
      if (text.startsWith("</", pos)) {
        const close = NAME.exec(text.slice(pos + 2, pos + 202));
        const closeName = close === null ? "" : close[0].includes(":") ? (close[0].split(":")[1] ?? "") : close[0];
        if (close === null || closeName !== name) return fail(`${name} is closed by another name`);
        pos += 2 + close[0].length;
        skipSpace();
        if (text[pos] !== ">") return fail(`the closing tag of ${name} does not end`);
        pos++;
        return ok({ name, text: children.length === 0 ? body : "", children });
      }
      if (text.startsWith("<!--", pos) || text.startsWith("<![CDATA[", pos) || text.startsWith("<!", pos) || text.startsWith("<?", pos)) return fail("a comment, CDATA, a declaration or an instruction is not in an answer of S3");
      const child = element(depth + 1);
      if (child.kind === "err") return child;
      children.push(child.value);
    }
  };

  skipSpace();
  if (text.startsWith("<!", pos) || text.startsWith("<?", pos)) return fail("a document type, a comment or an instruction is not in an answer of S3");
  const root = element(1);
  if (root.kind === "err") return root;
  skipSpace();
  if (pos < text.length) return fail("there is text after the root element");
  return root;
}

/** The first child of an element with a name. */
export const child = (node: XmlNode, name: string): XmlNode | undefined => node.children.find((c) => c.name === name);
/** The text of the first child with a name. */
export const textOf = (node: XmlNode, name: string): string | undefined => child(node, name)?.text;

/** One object of a listing. */
export type Listed = { readonly key: string; readonly size: number; readonly etag: string; readonly modified?: string };
/** A page of `ListObjectsV2`: the objects in the order S3 gave them, and the token to go on where there are more. */
export type ListPage = { readonly objects: readonly Listed[]; readonly truncated: boolean; readonly next?: string };

/** What S3 says of a failure. */
export type ErrorBody = { readonly code: string; readonly message: string; readonly requestId?: string };

const nonNegative = (text: string | undefined): number | undefined => {
  if (text === undefined || !/^\d{1,15}$/u.test(text)) return undefined;
  return Number.parseInt(text, 10);
};

/** A listing read from the XML of `ListObjectsV2`, with each key as the answer gave it (still encoded where `encoding-type=url` was asked). */
export function parseListing(source: string): Result<ListPage, string> {
  const doc = parseXml(source);
  if (doc.kind === "err") return doc;
  if (doc.value.name !== "ListBucketResult") return err(`the answer is a ${doc.value.name}, not a ListBucketResult`);
  const objects: Listed[] = [];
  for (const c of doc.value.children) {
    if (c.name !== "Contents") continue;
    const key = textOf(c, "Key");
    const size = nonNegative(textOf(c, "Size"));
    if (key === undefined || size === undefined) return err("an object of the listing has no key or no size");
    const modified = textOf(c, "LastModified");
    objects.push({ key, size, etag: (textOf(c, "ETag") ?? "").replaceAll('"', ""), ...(modified === undefined ? {} : { modified }) });
  }
  const truncated = textOf(doc.value, "IsTruncated");
  if (truncated !== undefined && truncated !== "true" && truncated !== "false") return err("IsTruncated is neither true nor false");
  const next = textOf(doc.value, "NextContinuationToken");
  return ok({ objects, truncated: truncated === "true", ...(next === undefined || next === "" ? {} : { next }) });
}

/** The code and message of the XML of an error. */
export function parseErrorBody(source: string): Result<ErrorBody, string> {
  const doc = parseXml(source);
  if (doc.kind === "err") return doc;
  if (doc.value.name !== "Error") return err(`the answer is a ${doc.value.name}, not an Error`);
  const code = textOf(doc.value, "Code");
  if (code === undefined || code === "") return err("the error has no code");
  const requestId = textOf(doc.value, "RequestId");
  return ok({ code, message: textOf(doc.value, "Message") ?? "", ...(requestId === undefined ? {} : { requestId }) });
}
