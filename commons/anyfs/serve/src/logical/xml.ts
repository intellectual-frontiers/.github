// Spec: 0003-anyfs-serve-logical FR-001, FR-002
/**
 * XML for the bodies of WebDAV, strict and bounded. The reader takes one document of elements, attributes, text, CDATA, comments and the five named references and the numeric ones, and refuses everything that a
 * document may use to attack its reader: a document type (so no entity is ever declared or expanded and no external subset is read), a reference it does not know, a name of a prefix that is not declared, and a
 * document larger, deeper or with more parts than the limits allow. The writer escapes every text and attribute and declares each namespace once on the root.
 *
 * @example
 * ```ts
 * import { parseXml, writeXml, dav } from "./xml.ts";
 * const doc = parseXml('<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>', { maxBytes: 1024, maxDepth: 8, maxNodes: 100 });
 * writeXml({ name: dav("multistatus"), attrs: [], children: [] }); // '<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:"/>'
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** A name with its namespace. */
export type QName = { readonly ns: string; readonly local: string };
/** One attribute: a name without a namespace prefix of its own (`xmlns` declarations are not attributes here) and its value. */
export type XmlAttr = { readonly name: string; readonly value: string };
/** An element: its name, attributes and children. */
export type XmlElement = { readonly kind: "element"; readonly name: QName; readonly attrs: readonly XmlAttr[]; readonly children: readonly XmlNode[] };
/** A piece of text. */
export type XmlText = { readonly kind: "text"; readonly text: string };
/** What an element holds. */
export type XmlNode = XmlElement | XmlText;

/** The namespace of WebDAV. */
export const DAV_NS = "DAV:";

/** A name in the namespace of WebDAV. */
export const dav = (local: string): QName => ({ ns: DAV_NS, local });

/** An element, with children that are elements or texts. */
export function el(name: QName, children: readonly (XmlNode | string)[] = [], attrs: readonly XmlAttr[] = []): XmlElement {
  return { kind: "element", name, attrs, children: children.map((c) => (typeof c === "string" ? ({ kind: "text", text: c } as const) : c)) };
}

/** What the reader is allowed. */
export type XmlLimits = { readonly maxBytes: number; readonly maxDepth: number; readonly maxNodes: number };

/** Why a document is not read: a closed list. */
export type XmlProblem =
  | { readonly kind: "too-large"; readonly bytes: number }
  | { readonly kind: "too-deep"; readonly at: number }
  | { readonly kind: "too-many"; readonly at: number }
  | { readonly kind: "doctype"; readonly at: number }
  | { readonly kind: "reference"; readonly at: number; readonly text: string }
  | { readonly kind: "namespace"; readonly at: number; readonly prefix: string }
  | { readonly kind: "malformed"; readonly at: number; readonly message: string };

/** A problem in a sentence. */
export function describeXmlProblem(p: XmlProblem): string {
  switch (p.kind) {
    case "too-large":
      return `the document is ${p.bytes} bytes, more than the server reads`;
    case "too-deep":
      return `the document nests deeper than the server reads, at offset ${p.at}`;
    case "too-many":
      return `the document has more parts than the server reads, at offset ${p.at}`;
    case "doctype":
      return `a document type is not accepted, at offset ${p.at}: no entity is declared or expanded`;
    case "reference":
      return `the reference ${p.text} is not one of the five names or a number, at offset ${p.at}`;
    case "namespace":
      return `the prefix ${p.prefix} is not declared, at offset ${p.at}`;
    case "malformed":
      return `${p.message}, at offset ${p.at}`;
  }
}

const NAMED: Readonly<Record<string, string>> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

type Raw = { readonly qname: string; readonly attrs: readonly { readonly qname: string; readonly value: string }[]; readonly children: (Raw | string)[] };

/** One document, or why it is not read. */
export function parseXml(text: string, limits: XmlLimits): Result<XmlElement, XmlProblem> {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > limits.maxBytes) return err({ kind: "too-large", bytes });
  let i = 0;
  let nodes = 0;
  const fail = (message: string): XmlProblem => ({ kind: "malformed", at: i, message });
  const count = (): XmlProblem | undefined => (++nodes > limits.maxNodes ? { kind: "too-many", at: i } : undefined);
  const isSpace = (c: string): boolean => c === " " || c === "\t" || c === "\n" || c === "\r";
  const skipSpace = (): void => {
    while (i < text.length && isSpace(text.charAt(i))) i++;
  };
  const isNameChar = (c: string): boolean => /[A-Za-z0-9_:.\-·À-￿]/.test(c);

  function readName(): string | undefined {
    const start = i;
    if (!/[A-Za-z_:\u00C0-\uFFFF]/.test(text.charAt(i))) return undefined;
    while (i < text.length && isNameChar(text.charAt(i))) i++;
    return i === start ? undefined : text.slice(start, i);
  }

  function decode(s: string, at: number): Result<string, XmlProblem> {
    let out = "";
    for (let k = 0; k < s.length; k++) {
      const c = s.charAt(k);
      if (c !== "&") {
        out += c;
        continue;
      }
      const end = s.indexOf(";", k);
      if (end < 0 || end - k > 12) return err({ kind: "reference", at: at + k, text: s.slice(k, k + 12) });
      const ref = s.slice(k + 1, end);
      const named = NAMED[ref];
      if (named !== undefined) out += named;
      else if (/^#[0-9]{1,7}$/.test(ref) || /^#x[0-9A-Fa-f]{1,6}$/.test(ref)) {
        const code = ref.startsWith("#x") ? Number.parseInt(ref.slice(2), 16) : Number.parseInt(ref.slice(1), 10);
        if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return err({ kind: "reference", at: at + k, text: `&${ref};` });
        out += String.fromCodePoint(code);
      } else return err({ kind: "reference", at: at + k, text: `&${ref};` });
      k = end;
    }
    return ok(out);
  }

  function parseElement(depth: number): Result<Raw, XmlProblem> {
    if (depth > limits.maxDepth) return err({ kind: "too-deep", at: i });
    const tooMany = count();
    if (tooMany !== undefined) return err(tooMany);
    i++; // <
    const qname = readName();
    if (qname === undefined) return err(fail("an element needs a name"));
    const attrs: { qname: string; value: string }[] = [];
    for (;;) {
      skipSpace();
      const c = text.charAt(i);
      if (c === "/" || c === ">") break;
      const an = readName();
      if (an === undefined) return err(fail("an attribute needs a name"));
      skipSpace();
      if (text.charAt(i) !== "=") return err(fail("an attribute needs a value"));
      i++;
      skipSpace();
      const quote = text.charAt(i);
      if (quote !== '"' && quote !== "'") return err(fail("an attribute value is quoted"));
      const close = text.indexOf(quote, i + 1);
      if (close < 0) return err(fail("an attribute value is not closed"));
      const rawValue = text.slice(i + 1, close);
      if (rawValue.includes("<")) return err(fail("an attribute value has no <"));
      const v = decode(rawValue, i + 1);
      if (v.kind === "err") return v;
      if (attrs.some((a) => a.qname === an)) return err(fail(`the attribute ${an} is given twice`));
      const t = count();
      if (t !== undefined) return err(t);
      attrs.push({ qname: an, value: v.value });
      i = close + 1;
    }
    const children: (Raw | string)[] = [];
    if (text.charAt(i) === "/") {
      if (text.charAt(i + 1) !== ">") return err(fail("an empty element ends with />"));
      i += 2;
      return ok({ qname, attrs, children });
    }
    i++; // >
    for (;;) {
      if (i >= text.length) return err(fail(`the element ${qname} is not closed`));
      if (text.startsWith("</", i)) {
        i += 2;
        const closing = readName();
        skipSpace();
        if (closing !== qname || text.charAt(i) !== ">") return err(fail(`the element ${qname} is closed by ${closing ?? "nothing"}`));
        i++;
        return ok({ qname, attrs, children });
      }
      if (text.startsWith("<!--", i)) {
        const end = text.indexOf("-->", i + 4);
        if (end < 0) return err(fail("a comment is not closed"));
        i = end + 3;
        continue;
      }
      if (text.startsWith("<![CDATA[", i)) {
        const end = text.indexOf("]]>", i + 9);
        if (end < 0) return err(fail("a CDATA section is not closed"));
        const t = count();
        if (t !== undefined) return err(t);
        children.push(text.slice(i + 9, end));
        i = end + 3;
        continue;
      }
      if (text.startsWith("<!", i)) return err({ kind: "doctype", at: i });
      if (text.startsWith("<?", i)) {
        const end = text.indexOf("?>", i + 2);
        if (end < 0) return err(fail("an instruction is not closed"));
        i = end + 2;
        continue;
      }
      if (text.charAt(i) === "<") {
        const child = parseElement(depth + 1);
        if (child.kind === "err") return child;
        children.push(child.value);
        continue;
      }
      const next = text.indexOf("<", i);
      const end = next < 0 ? text.length : next;
      const t = count();
      if (t !== undefined) return err(t);
      const d = decode(text.slice(i, end), i);
      if (d.kind === "err") return d;
      children.push(d.value);
      i = end;
    }
  }

  function resolve(raw: Raw, scope: ReadonlyMap<string, string>, at: number): Result<XmlElement, XmlProblem> {
    const next = new Map(scope);
    const plain: XmlAttr[] = [];
    for (const a of raw.attrs) {
      if (a.qname === "xmlns") next.set("", a.value);
      else if (a.qname.startsWith("xmlns:")) {
        if (a.value === "") return err({ kind: "namespace", at, prefix: a.qname.slice(6) });
        next.set(a.qname.slice(6), a.value);
      }
      else plain.push({ name: a.qname, value: a.value });
    }
    const colon = raw.qname.indexOf(":");
    const prefix = colon < 0 ? "" : raw.qname.slice(0, colon);
    const local = colon < 0 ? raw.qname : raw.qname.slice(colon + 1);
    const ns = next.get(prefix);
    if (ns === undefined && prefix !== "") return err({ kind: "namespace", at, prefix });
    const kids: XmlNode[] = [];
    for (const c of raw.children) {
      if (typeof c === "string") {
        kids.push({ kind: "text", text: c });
        continue;
      }
      const r = resolve(c, next, at);
      if (r.kind === "err") return r;
      kids.push(r.value);
    }
    return ok({ kind: "element", name: { ns: ns ?? "", local }, attrs: plain, children: kids });
  }

  if (text.charCodeAt(0) === 0xfeff) i = 1;
  skipSpace();
  if (text.startsWith("<?xml", i)) {
    const end = text.indexOf("?>", i);
    if (end < 0) return err(fail("the declaration is not closed"));
    i = end + 2;
  }
  for (;;) {
    skipSpace();
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end < 0) return err(fail("a comment is not closed"));
      i = end + 3;
      continue;
    }
    if (text.startsWith("<!", i)) return err({ kind: "doctype", at: i });
    break;
  }
  if (text.charAt(i) !== "<") return err(fail("a document is one element"));
  const root = parseElement(1);
  if (root.kind === "err") return root;
  for (;;) {
    skipSpace();
    if (i >= text.length) break;
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end < 0) return err(fail("a comment is not closed"));
      i = end + 3;
      continue;
    }
    return err(fail("nothing follows the root element"));
  }
  return resolve(root.value, new Map(), 0);
}

/** The child elements of an element, in order. */
export function childElements(e: XmlElement): readonly XmlElement[] {
  return e.children.filter((c): c is XmlElement => c.kind === "element");
}

/** The text an element holds below it, joined. */
export function textOf(e: XmlElement): string {
  return e.children.map((c) => (c.kind === "text" ? c.text : textOf(c))).join("");
}

/** Whether an element has a name. */
export const isNamed = (e: XmlElement, ns: string, local: string): boolean => e.name.ns === ns && e.name.local === local;

const escapeText = (s: string): string => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const escapeAttr = (s: string): string => escapeText(s).replaceAll('"', "&quot;");

/** The characters XML 1.0 allows; any other is replaced in text so that a name with one cannot make an answer that a client refuses. */
function stripInvalid(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const allowed = c === 0x9 || c === 0xa || c === 0xd || (c >= 0x20 && c <= 0xd7ff) || (c >= 0xe000 && c <= 0xfffd) || (c >= 0x10000 && c <= 0x10ffff);
    out += allowed ? ch : "\uFFFD";
  }
  return out;
}

/** One element as XML, with the namespaces declared once on it: `DAV:` is `D`, the others are `n1`, `n2`. */
export function writeXml(root: XmlElement): string {
  const prefixes = new Map<string, string>([[DAV_NS, "D"]]);
  const collect = (e: XmlElement): void => {
    if (e.name.ns !== "" && !prefixes.has(e.name.ns)) prefixes.set(e.name.ns, `n${prefixes.size}`);
    for (const c of e.children) if (c.kind === "element") collect(c);
  };
  collect(root);
  const nameOf = (q: QName): string => (q.ns === "" ? q.local : `${prefixes.get(q.ns)}:${q.local}`);
  const write = (e: XmlElement, top: boolean): string => {
    const decl = top ? [...prefixes].map(([ns, p]) => ` xmlns:${p}="${escapeAttr(ns)}"`).join("") : "";
    const attrs = e.attrs.map((a) => ` ${a.name}="${escapeAttr(stripInvalid(a.value))}"`).join("");
    const inner = e.children.map((c) => (c.kind === "text" ? escapeText(stripInvalid(c.text)) : write(c, false))).join("");
    return inner === "" ? `<${nameOf(e.name)}${decl}${attrs}/>` : `<${nameOf(e.name)}${decl}${attrs}>${inner}</${nameOf(e.name)}>`;
  };
  return `<?xml version="1.0" encoding="utf-8"?>\n${write(root, true)}`;
}
