/**
 * XML as a typed tree of elements and text, written with every value escaped (no document is a template of values) and read with no
 * outside package (commons 0005-typescript-runtime FR-032). The reader takes elements, attributes in either quote, the five named entities
 * and character references, CDATA, comments, processing instructions and the XML declaration, checks that every element is closed by its
 * own name, and refuses a document type with an internal subset, so no entity is ever expanded (no "billion laughs", no external entity).
 * Names are kept as written (`dc:title`); the finders match a name with or without its prefix. Taken from erga's `lib/ts/xml`, whose
 * reader was `@std/xml`.
 *
 * @example
 * ```ts
 * import { el, readXml, textOf, writeXml } from "./xml.ts";
 * const doc = writeXml(el("note", [el("to", ["Ada & Charles"])], [["lang", "en"]]));
 * // '<?xml version="1.0" encoding="UTF-8"?>\n<note lang="en"><to>Ada &amp; Charles</to></note>'
 * const back = readXml(doc);
 * if (back.kind === "ok") textOf(back.value); // "Ada & Charles"
 * ```
 *
 * @module
 */
import { absurd } from "./absurd.ts";
import { err, ok, type Result } from "./result.ts";

/** An element: its name as written, its attributes in order, and its children. */
export type XmlElement = {
  readonly kind: "element";
  readonly name: string;
  readonly attributes: readonly (readonly [string, string])[];
  readonly children: readonly XmlNode[];
};

/** Text, its entities and references already replaced. */
export type XmlText = { readonly kind: "text"; readonly text: string };

/** A node of an XML document. */
export type XmlNode = XmlElement | XmlText;

/** What an element may be given as a child: a node, or a value written as text; `undefined` gives nothing. */
export type XmlChild = XmlNode | string | number | boolean | undefined;

const asNodes = (c: XmlChild): readonly XmlNode[] =>
  c === undefined ? [] : typeof c === "object" ? [c] : [{ kind: "text", text: String(c) }];

/** An element. */
export function el(name: string, children: readonly XmlChild[] = [], attributes: readonly (readonly [string, string])[] = []): XmlElement {
  return { kind: "element", name, attributes, children: children.flatMap(asNodes) };
}

/** An element holding one value, or nothing where the value is absent. */
export function leaf(name: string, value: string | number | boolean | undefined): XmlElement | undefined {
  return value === undefined ? undefined : el(name, [value]);
}

const FORBIDDEN = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11, 12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}\\ufffe\\uffff]`,
  "g",
);

/** A value as XML text or an attribute's value: `&`, `<`, `>`, `"` and `'` escaped, and the characters XML 1.0 forbids removed. */
export function escapeXml(s: string): string {
  return s
    .replace(FORBIDDEN, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** A node as XML text, with no declaration. */
export function writeNode(n: XmlNode): string {
  switch (n.kind) {
    case "text":
      return escapeXml(n.text);
    case "element": {
      const attrs = n.attributes.map(([k, v]) => ` ${k}="${escapeXml(v)}"`).join("");
      return n.children.length === 0 ? `<${n.name}${attrs}/>` : `<${n.name}${attrs}>${n.children.map(writeNode).join("")}</${n.name}>`;
    }
    default:
      return absurd(n);
  }
}

/** A whole document: the XML declaration, then its root. */
export function writeXml(root: XmlElement): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${writeNode(root)}`;
}

/** Where a text stops being XML this reader takes, and why. Lines and columns count from 1. */
export type XmlError = { readonly kind: "xml"; readonly line: number; readonly column: number; readonly message: string };

class Stop extends Error {
  readonly at: number;
  constructor(at: number, message: string) {
    super(message);
    this.at = at;
  }
}

const NAME_START = /[:A-Z_a-z\p{L}\p{Nl}]/u;
const NAME_PART = /[-.0-9:A-Z_a-z\p{L}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}\u00b7]/u;
const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** How to read: whether text that is only white space between elements is kept (it is dropped by default). */
export type ReadXmlOptions = { readonly keepWhitespace?: boolean };

/** A document read: its root element; or where and why it is not XML this reader takes. */
export function readXml(text: string, options: ReadXmlOptions = {}): Result<XmlElement, XmlError> {
  let i = text.startsWith("\ufeff") ? 1 : 0;
  const fail = (message: string, at = i): never => {
    throw new Stop(at, message);
  };
  const space = (): void => {
    while (/[ \t\r\n]/.test(text[i] ?? "")) i++;
  };
  const expect = (s: string): void => {
    if (!text.startsWith(s, i)) fail(`expected ${JSON.stringify(s)}`);
    i += s.length;
  };
  const charAt = (at: number): string => {
    const cp = text.codePointAt(at);
    return cp === undefined ? "" : String.fromCodePoint(cp);
  };
  const name = (): string => {
    const start = i;
    if (!NAME_START.test(charAt(i))) fail("expected a name");
    while (i < text.length && NAME_PART.test(charAt(i))) i += charAt(i).length;
    return text.slice(start, i);
  };
  const decode = (raw: string, at: number): string =>
    raw.replace(/&([^;&]*);?/g, (whole: string, ref: string, offset: number) => {
      if (!whole.endsWith(";")) fail("an entity reference that ends with ;", at + offset);
      const named = ENTITIES[ref];
      if (named !== undefined) return named;
      const m = /^#(?:x([0-9a-fA-F]+)|([0-9]+))$/.exec(ref);
      const code = m === null ? Number.NaN : m[1] !== undefined ? Number.parseInt(m[1], 16) : Number(m[2]);
      if (!Number.isInteger(code) || code < 1 || code > 0x10ffff)
        fail(`a known entity or a character reference, not &${ref};`, at + offset);
      return String.fromCodePoint(code);
    });
  const misc = (): void => {
    for (;;) {
      space();
      if (text.startsWith("<!--", i)) {
        const end = text.indexOf("-->", i + 4);
        if (end < 0) fail("a comment that is closed");
        i = end + 3;
      } else if (text.startsWith("<?", i)) {
        const end = text.indexOf("?>", i + 2);
        if (end < 0) fail("a processing instruction that is closed");
        i = end + 2;
      } else if (text.startsWith("<!DOCTYPE", i)) {
        const end = text.indexOf(">", i);
        if (end < 0) fail("a document type that is closed");
        if (text.slice(i, end).includes("[")) fail("a document type with no internal subset (no entity is expanded)");
        i = end + 1;
      } else return;
    }
  };
  const element = (depth: number): XmlElement => {
    if (depth > 512) fail("less nesting (more than 512 levels)");
    expect("<");
    const tag = name();
    const attributes: [string, string][] = [];
    for (;;) {
      const before = i;
      space();
      if (text.startsWith("/>", i)) {
        i += 2;
        return { kind: "element", name: tag, attributes, children: [] };
      }
      if (text[i] === ">") {
        i++;
        break;
      }
      if (i === before) fail("white space before an attribute");
      const keyAt = i;
      const key = name();
      if (attributes.some(([k]) => k === key)) fail(`the attribute ${key} only once`, keyAt);
      space();
      expect("=");
      space();
      const quote = text[i];
      if (quote !== '"' && quote !== "'") fail("a quoted attribute value");
      const end = text.indexOf(quote ?? "", i + 1);
      if (end < 0) fail("a closing quote");
      const raw = text.slice(i + 1, end);
      if (raw.includes("<")) fail("no < in an attribute value", i + 1 + raw.indexOf("<"));
      attributes.push([key, decode(raw, i + 1).replace(/[\t\n\r]/g, " ")]);
      i = end + 1;
    }
    const children: XmlNode[] = [];
    let buffer = "";
    let whitespaceOnly = true;
    const flush = (): void => {
      if (buffer !== "" && (options.keepWhitespace === true || !whitespaceOnly)) children.push({ kind: "text", text: buffer });
      buffer = "";
      whitespaceOnly = true;
    };
    for (;;) {
      if (i >= text.length) fail(`the end tag </${tag}>`);
      if (text.startsWith("</", i)) {
        flush();
        i += 2;
        const at = i;
        const closing = name();
        if (closing !== tag) fail(`</${tag}>, not </${closing}>`, at);
        space();
        expect(">");
        return { kind: "element", name: tag, attributes, children };
      }
      if (text.startsWith("<![CDATA[", i)) {
        const end = text.indexOf("]]>", i + 9);
        if (end < 0) fail("a CDATA section that is closed");
        buffer += text.slice(i + 9, end);
        whitespaceOnly = false;
        i = end + 3;
      } else if (text.startsWith("<!--", i)) {
        const end = text.indexOf("-->", i + 4);
        if (end < 0) fail("a comment that is closed");
        i = end + 3;
      } else if (text.startsWith("<?", i)) {
        const end = text.indexOf("?>", i + 2);
        if (end < 0) fail("a processing instruction that is closed");
        i = end + 2;
      } else if (text[i] === "<") {
        flush();
        children.push(element(depth + 1));
      } else {
        const next = text.indexOf("<", i);
        const end = next < 0 ? text.length : next;
        const raw = text.slice(i, end);
        const decoded = decode(raw, i);
        if (!/^[ \t\r\n]*$/.test(decoded)) whitespaceOnly = false;
        buffer += decoded;
        i = end;
      }
    }
  };
  try {
    misc();
    if (text[i] !== "<") fail("a root element");
    const root = element(0);
    misc();
    if (i < text.length) fail("nothing after the root element");
    return ok(root);
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    const before = text.slice(0, e.at).split(/\r\n|[\n\r]/);
    return err({ kind: "xml", line: before.length, column: (before.at(-1)?.length ?? 0) + 1, message: e.message });
  }
}

/** An XML error as one line: `3:14: expected a name`. */
export function formatXmlError(e: XmlError): string {
  return `${e.line}:${e.column}: ${e.message}`;
}

/** A name without its prefix: `title` for `dc:title`. */
export function localName(name: string): string {
  const at = name.indexOf(":");
  return at < 0 ? name : name.slice(at + 1);
}

const named = (n: XmlNode, name: string): n is XmlElement => n.kind === "element" && (n.name === name || localName(n.name) === name);

/** The child elements of a node named `name` (with or without a prefix). */
export function children(n: XmlNode, name: string): readonly XmlElement[] {
  return n.kind === "element" ? n.children.filter((c): c is XmlElement => named(c, name)) : [];
}

/** The first child element named `name`. */
export function child(n: XmlNode, name: string): XmlElement | undefined {
  return children(n, name)[0];
}

/** Every element below a node named `name`, in document order. */
export function descendants(n: XmlNode, name: string): readonly XmlElement[] {
  if (n.kind !== "element") return [];
  return n.children.flatMap((c) => [...(named(c, name) ? [c] : []), ...descendants(c, name)]);
}

/** All the text a node holds. */
export function textOf(n: XmlNode | undefined): string {
  if (n === undefined) return "";
  return n.kind === "text" ? n.text : n.children.map(textOf).join("");
}

/** An attribute's value, by its name with or without a prefix. */
export function attribute(n: XmlNode | undefined, name: string): string | undefined {
  return n?.kind === "element" ? n.attributes.find(([k]) => k === name || localName(k) === name)?.[1] : undefined;
}
