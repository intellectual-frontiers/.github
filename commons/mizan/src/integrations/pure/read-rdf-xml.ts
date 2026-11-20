/**
 * A reader of RDF/XML (commons 0019-mizan-integrations FR-024, FR-025): the text of an outside ontology published as RDF/XML (the W3C's SKOS, OWL, PROV-O, SHACL, DCAT) as triples,
 * with what the typed form cannot hold named as findings and never dropped silently. It is hand-written TypeScript, and needs no `Exception` (0017-two-languages FR-003):
 * it read every W3C RDF/XML file it was tried on to the graph rdflib reads (the decision and the evidence are in 0019 FR-024).
 *
 * @remarks
 * Two layers in one file. The first is a minimal XML reader: elements, attributes, text, CDATA, comments, processing instructions, character references, the five predefined
 * entities, the entities a `<!DOCTYPE>` internal subset declares (`<!ENTITY rdf "http://...#">`, which RDF/XML files use to shorten IRIs), namespaces and `xml:lang` and `xml:base`;
 * it refuses what is not well formed with the line. The second is the RDF/XML grammar: node elements (`rdf:Description` and typed nodes, `rdf:about`, `rdf:ID`, `rdf:nodeID`,
 * anonymous nodes), property elements (literals, `rdf:resource`, `rdf:datatype`, nested nodes, `rdf:parseType="Resource"` and `"Collection"`), property attributes, `rdf:li`
 * counting, `rdf:ID` reification, and relative IRIs resolved against `xml:base` (RFC 3986). Blank nodes keep their structure as `blank` terms (labels `genid-N` in document order,
 * and `rdf:nodeID` as written). A `parseType="Literal"` (an XML literal, whose canonical form this reader does not compute) and an external entity are `unsupported` findings, the
 * property or entity is not read and the rest is.
 *
 * @limits
 * It does not validate against a DTD, does not fetch an external entity, keeps no XML literal, and reads UTF-8 text (the caller decodes). It reads no `rdf:bagID` (removed from the
 * RDF/XML grammar). A property attribute without a namespace is an `unsupported` finding.
 *
 * @example
 * ```ts
 * import { readRdfXml } from "./read-rdf-xml.ts";
 * const r = readRdfXml('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:ex="https://example.org/"><ex:B rdf:about="https://example.org/a"/></rdf:RDF>');
 * r.kind === "ok" && r.value.triples.length; // 1
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { RdfTerm, RdfTriple, Read } from "./read-rdf.ts";
import type { IntegrationFinding } from "./types.ts";

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";

class Fail extends Error {
  readonly line: number;
  constructor(line: number, message: string) {
    super(message);
    this.line = line;
  }
}

/** An attribute, its namespace resolved. */
type Attr = { readonly ns: string; readonly local: string; readonly value: string };

/** An element of the XML read, its names resolved and its line kept; `text` is the character data directly in it, `children` its elements and `mixed` whether it has both. */
type Elem = {
  readonly ns: string;
  readonly local: string;
  readonly attrs: readonly Attr[];
  readonly children: readonly Elem[];
  readonly text: string;
  /** The raw character data between the children, whitespace only or not (a property element with a child node and other text is a literal of nothing). */
  readonly hasText: boolean;
  readonly line: number;
};

const PREDEFINED: Readonly<Record<string, string>> = { lt: "<", gt: ">", amp: "&", apos: "'", quot: '"' };

/** The XML reader: what a well-formed RDF/XML document needs, and a `Fail` with the line for what is not. */
class XmlReader {
  private pos = 0;
  private line = 1;
  private readonly entities = new Map<string, string>();
  readonly findings: IntegrationFinding[] = [];
  private readonly text: string;

  constructor(text: string) {
    this.text = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }

  private fail(message: string): never {
    throw new Fail(this.line, message);
  }

  private startsWith(s: string): boolean {
    return this.text.startsWith(s, this.pos);
  }

  private advance(n: number): void {
    for (let i = 0; i < n; i++) if (this.text[this.pos + i] === "\n") this.line++;
    this.pos += n;
  }

  private skipSpace(): void {
    while (/[ \t\r\n]/.test(this.text[this.pos] ?? "x")) this.advance(1);
  }

  private skipPast(end: string, what: string): void {
    const at = this.text.indexOf(end, this.pos);
    if (at < 0) this.fail(`${what} with no end`);
    this.advance(at + end.length - this.pos);
  }

  /** Character and entity references in a piece of text, expanded; an entity declared in the DOCTYPE is expanded (its own references too), an undeclared one is a failure. */
  private expand(raw: string, depth = 0): string {
    if (!raw.includes("&")) return raw;
    if (depth > 8) this.fail("entities nested too deeply");
    return raw.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z_][A-Za-z0-9_.-]*);/g, (_whole, name: string) => {
      if (name.startsWith("#x")) return String.fromCodePoint(parseInt(name.slice(2), 16));
      if (name.startsWith("#")) return String.fromCodePoint(parseInt(name.slice(1), 10));
      const predefined = PREDEFINED[name];
      if (predefined !== undefined) return predefined;
      const declared = this.entities.get(name);
      if (declared === undefined) this.fail(`the entity &${name}; is not declared`);
      return this.expand(declared, depth + 1);
    });
  }

  private doctype(): void {
    this.advance("<!DOCTYPE".length);
    for (;;) {
      const c = this.text[this.pos] ?? "";
      if (c === "") this.fail("a DOCTYPE with no end");
      if (c === ">") {
        this.advance(1);
        return;
      }
      if (c === "[") {
        this.advance(1);
        this.internalSubset();
        continue;
      }
      if (c === '"' || c === "'") {
        const close = this.text.indexOf(c, this.pos + 1);
        if (close < 0) this.fail("a DOCTYPE with an unclosed string");
        this.advance(close + 1 - this.pos);
        continue;
      }
      this.advance(1);
    }
  }

  private internalSubset(): void {
    for (;;) {
      this.skipSpace();
      if (this.startsWith("]")) {
        this.advance(1);
        return;
      }
      if (this.startsWith("<!--")) {
        this.skipPast("-->", "a comment");
        continue;
      }
      if (this.startsWith("<!ENTITY")) {
        const line = this.line;
        const end = this.text.indexOf(">", this.pos);
        const decl = end < 0 ? "" : this.text.slice(this.pos + "<!ENTITY".length, end);
        const m = /^\s+([A-Za-z_][A-Za-z0-9_.-]*)\s+(?:"([^"]*)"|'([^']*)')\s*$/.exec(decl);
        if (end < 0) this.fail("an ENTITY declaration with no end");
        if (m === null) {
          this.findings.push({ kind: "unsupported", what: "an external or parameter entity", about: decl.trim().slice(0, 60) });
        } else if (!this.entities.has(m[1] ?? "")) {
          this.entities.set(m[1] ?? "", this.expandCharsOnly(m[2] ?? m[3] ?? "", line));
        }
        this.advance(end + 1 - this.pos);
        continue;
      }
      if (this.startsWith("<!")) {
        this.skipPast(">", "a declaration");
        continue;
      }
      if (this.startsWith("<?")) {
        this.skipPast("?>", "a processing instruction");
        continue;
      }
      this.fail("something that is not a declaration in the DOCTYPE");
    }
  }

  /** An entity's value takes its character references at declaration, and its entity references when used. */
  private expandCharsOnly(raw: string, line: number): string {
    return raw.replace(/&#(x[0-9A-Fa-f]+|[0-9]+);/g, (_w, n: string) => {
      const code = n.startsWith("x") ? parseInt(n.slice(1), 16) : parseInt(n, 10);
      if (!Number.isInteger(code) || code > 0x10ffff) throw new Fail(line, "a bad character reference");
      return String.fromCodePoint(code);
    });
  }

  private name(): string {
    const m = /^[A-Za-z_:À-￿][A-Za-z0-9_:.\-·À-￿]*/.exec(this.text.slice(this.pos, this.pos + 256));
    if (m === null) this.fail("expected a name");
    this.advance(m[0].length);
    return m[0];
  }

  private rawAttributes(): { readonly name: string; readonly value: string }[] {
    const out: { name: string; value: string }[] = [];
    for (;;) {
      const before = this.pos;
      this.skipSpace();
      const c = this.text[this.pos] ?? "";
      if (c === ">" || c === "/" || c === "") return out;
      if (this.pos === before) this.fail("expected a space before an attribute");
      const name = this.name();
      this.skipSpace();
      if (this.text[this.pos] !== "=") this.fail(`the attribute ${name} has no =`);
      this.advance(1);
      this.skipSpace();
      const q = this.text[this.pos] ?? "";
      if (q !== '"' && q !== "'") this.fail(`the attribute ${name} has no quoted value`);
      const close = this.text.indexOf(q, this.pos + 1);
      if (close < 0) this.fail(`the attribute ${name} has an unclosed value`);
      const raw = this.text.slice(this.pos + 1, close);
      if (raw.includes("<")) this.fail(`the attribute ${name} has a < in its value`);
      this.advance(close + 1 - this.pos);
      if (out.some((a) => a.name === name)) this.fail(`the attribute ${name} is given twice`);
      out.push({ name, value: this.expand(raw.replace(/\r\n|[\r\n\t]/g, " ")) });
    }
  }

  private resolveName(
    qname: string,
    scope: ReadonlyMap<string, string>,
    isAttribute: boolean,
  ): { readonly ns: string; readonly local: string } {
    const colon = qname.indexOf(":");
    if (colon < 0) return { ns: isAttribute ? "" : (scope.get("") ?? ""), local: qname };
    const prefix = qname.slice(0, colon);
    const ns = prefix === "xml" ? XML_NS : scope.get(prefix);
    if (ns === undefined) this.fail(`the prefix ${prefix}: is not declared`);
    return { ns, local: qname.slice(colon + 1) };
  }

  private element(scope: ReadonlyMap<string, string>): Elem {
    const line = this.line;
    this.advance(1);
    const qname = this.name();
    const raw = this.rawAttributes();
    const own = new Map(scope);
    for (const a of raw) {
      if (a.name === "xmlns") own.set("", a.value);
      else if (a.name.startsWith("xmlns:")) own.set(a.name.slice(6), a.value);
    }
    const attrs: Attr[] = [];
    for (const a of raw) {
      if (a.name === "xmlns" || a.name.startsWith("xmlns:")) continue;
      const r = this.resolveName(a.name, own, true);
      attrs.push({ ns: r.ns, local: r.local, value: a.value });
    }
    const self = this.resolveName(qname, own, false);
    if (this.startsWith("/>")) {
      this.advance(2);
      return { ...self, attrs, children: [], text: "", hasText: false, line };
    }
    if (!this.startsWith(">")) this.fail(`the element ${qname} is not closed with >`);
    this.advance(1);
    const children: Elem[] = [];
    let text = "";
    let hasText = false;
    for (;;) {
      const lt = this.text.indexOf("<", this.pos);
      if (lt < 0) this.fail(`the element ${qname} is never closed`);
      if (lt > this.pos) {
        const chunk = this.text.slice(this.pos, lt);
        this.advance(lt - this.pos);
        const value = this.expand(chunk.replaceAll("\r\n", "\n").replaceAll("\r", "\n"));
        text += value;
        if (value.trim() !== "") hasText = true;
      }
      if (this.startsWith("</")) {
        this.advance(2);
        const close = this.name();
        this.skipSpace();
        if (close !== qname) this.fail(`</${close}> closes <${qname}>`);
        if (this.text[this.pos] !== ">") this.fail("a closing tag with no >");
        this.advance(1);
        return { ...self, attrs, children, text, hasText, line };
      }
      if (this.startsWith("<!--")) this.skipPast("-->", "a comment");
      else if (this.startsWith("<![CDATA[")) {
        const end = this.text.indexOf("]]>", this.pos);
        if (end < 0) this.fail("a CDATA section with no end");
        const chunk = this.text.slice(this.pos + 9, end);
        text += chunk;
        if (chunk.trim() !== "") hasText = true;
        this.advance(end + 3 - this.pos);
      } else if (this.startsWith("<?")) this.skipPast("?>", "a processing instruction");
      else children.push(this.element(own));
    }
  }

  /** The document's root element, after the prolog; whatever follows it must be comments, processing instructions and space. */
  document(): Elem {
    for (;;) {
      this.skipSpace();
      if (this.startsWith("<?")) this.skipPast("?>", "a processing instruction");
      else if (this.startsWith("<!--")) this.skipPast("-->", "a comment");
      else if (this.startsWith("<!DOCTYPE")) this.doctype();
      else break;
    }
    if (!this.startsWith("<")) this.fail("the document has no root element");
    const root = this.element(new Map());
    for (;;) {
      this.skipSpace();
      if (this.pos >= this.text.length) return root;
      if (this.startsWith("<?")) this.skipPast("?>", "a processing instruction");
      else if (this.startsWith("<!--")) this.skipPast("-->", "a comment");
      else this.fail("something after the root element");
    }
  }
}

/** An IRI resolved against a base (RFC 3986 section 5), as text: removes dot segments and keeps the rest as given. */
export function resolveIri(base: string, ref: string): string {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return ref;
  const b = /^(?:([A-Za-z][A-Za-z0-9+.-]*):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#.*)?$/.exec(base);
  if (b === null) return ref;
  const [scheme, authority, basePath, baseQuery] = [b[1], b[2], b[3] ?? "", b[4]];
  const r = /^(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(#.*)?$/.exec(ref);
  if (r === null) return ref;
  const [rAuthority, rPath, rQuery, rFragment] = [r[1], r[2] ?? "", r[3], r[4] ?? ""];
  const head = (a: string | undefined): string => `${scheme === undefined ? "" : `${scheme}:`}${a === undefined ? "" : `//${a}`}`;
  const query = (q: string | undefined): string => (q === undefined ? "" : `?${q}`);
  if (rAuthority !== undefined) return `${head(rAuthority)}${dots(rPath)}${query(rQuery)}${rFragment}`;
  if (rPath === "") return `${head(authority)}${basePath}${query(rQuery ?? baseQuery)}${rFragment}`;
  if (rPath.startsWith("/")) return `${head(authority)}${dots(rPath)}${query(rQuery)}${rFragment}`;
  const merged = authority !== undefined && basePath === "" ? `/${rPath}` : `${basePath.slice(0, basePath.lastIndexOf("/") + 1)}${rPath}`;
  return `${head(authority)}${dots(merged)}${query(rQuery)}${rFragment}`;
}

function dots(path: string): string {
  if (!path.includes(".")) return path;
  const out: string[] = [];
  const parts = path.split("/");
  for (const [i, p] of parts.entries()) {
    const last = i === parts.length - 1;
    if (p === ".") {
      if (last) out.push("");
    } else if (p === "..") {
      if (out.length > 1 || (out.length === 1 && out[0] !== "")) out.pop();
      if (last) out.push("");
    } else out.push(p);
  }
  return out.join("/");
}

const CORE_ELEMENTS = new Set(["RDF", "ID", "about", "bagID", "parseType", "resource", "nodeID", "li", "aboutEach", "aboutEachPrefix"]);

/** The RDF/XML grammar over the elements the XML reader gave. */
class RdfXml {
  readonly triples: RdfTriple[] = [];
  readonly findings: IntegrationFinding[];
  private bnodes = 0;

  constructor(findings: IntegrationFinding[]) {
    this.findings = findings;
  }

  private fail(e: Elem, message: string): never {
    throw new Fail(e.line, message);
  }

  private blank(): RdfTerm {
    return { kind: "blank", label: `genid-${++this.bnodes}` };
  }

  private emit(subject: RdfTerm, predicate: string, object: RdfTerm, line: number): void {
    this.triples.push({ subject, predicate, object, line });
  }

  private unsupported(what: string, about: string): void {
    this.findings.push({ kind: "unsupported", what, about });
  }

  private lit(value: string, lang: string, datatype?: string): RdfTerm {
    if (datatype !== undefined) return { kind: "literal", value, datatype };
    if (lang !== "") return { kind: "literal", value, datatype: `${RDF}langString`, lang: lang.toLowerCase() };
    return { kind: "literal", value, datatype: XSD_STRING };
  }

  private attr(e: Elem, ns: string, local: string): string | undefined {
    return e.attrs.find((a) => a.ns === ns && a.local === local)?.value;
  }

  /** The base and language in scope in an element: its own `xml:base` and `xml:lang` over its parent's. */
  private scoped(e: Elem, base: string, lang: string): { readonly base: string; readonly lang: string } {
    const b = this.attr(e, XML_NS, "base");
    return { base: b === undefined ? base : resolveIri(base, b.replace(/#.*$/, "")), lang: this.attr(e, XML_NS, "lang") ?? lang };
  }

  private subjectOf(e: Elem, base: string): RdfTerm {
    const about = this.attr(e, RDF, "about");
    const id = this.attr(e, RDF, "ID");
    const nodeID = this.attr(e, RDF, "nodeID");
    if (about !== undefined) return { kind: "iri", value: resolveIri(base, about) };
    if (id !== undefined) return { kind: "iri", value: `${base.replace(/#.*$/, "")}#${id}` };
    if (nodeID !== undefined) return { kind: "blank", label: nodeID };
    return this.blank();
  }

  private propertyAttributes(e: Elem, subject: RdfTerm, base: string, lang: string, skip: ReadonlySet<string>): void {
    for (const a of e.attrs) {
      if (a.ns === XML_NS || a.ns === XMLNS_NS) continue;
      if (a.ns === RDF && skip.has(a.local)) continue;
      if (a.ns === RDF && CORE_ELEMENTS.has(a.local)) continue;
      if (a.ns === "") {
        this.unsupported("an attribute with no namespace", `${a.local} on ${e.local}`);
        continue;
      }
      if (a.ns === RDF && a.local === "type") this.emit(subject, `${RDF}type`, { kind: "iri", value: resolveIri(base, a.value) }, e.line);
      else this.emit(subject, a.ns + a.local, this.lit(a.value, lang), e.line);
    }
  }

  /** A node element: its subject, its type, its property attributes and its property elements. */
  node(e: Elem, base0: string, lang0: string): RdfTerm {
    const { base, lang } = this.scoped(e, base0, lang0);
    if (e.ns === RDF && CORE_ELEMENTS.has(e.local)) this.fail(e, `rdf:${e.local} is not a node element`);
    const subject = this.subjectOf(e, base);
    if (!(e.ns === RDF && e.local === "Description")) this.emit(subject, `${RDF}type`, { kind: "iri", value: e.ns + e.local }, e.line);
    this.propertyAttributes(e, subject, base, lang, new Set(["about", "ID", "nodeID"]));
    let li = 0;
    for (const p of e.children) {
      const isLi = p.ns === RDF && p.local === "li";
      if (isLi) li++;
      this.property(p, subject, base, lang, isLi ? `${RDF}_${li}` : p.ns + p.local);
    }
    return subject;
  }

  private property(e: Elem, subject: RdfTerm, base0: string, lang0: string, predicate: string): void {
    const { base, lang } = this.scoped(e, base0, lang0);
    if (e.ns === RDF && CORE_ELEMENTS.has(e.local) && e.local !== "li") this.fail(e, `rdf:${e.local} is not a property element`);
    const parseType = this.attr(e, RDF, "parseType");
    const resource = this.attr(e, RDF, "resource");
    const nodeID = this.attr(e, RDF, "nodeID");
    const datatype = this.attr(e, RDF, "datatype");
    const reified = this.attr(e, RDF, "ID");
    let object: RdfTerm | undefined;
    if (parseType === "Resource") {
      object = this.blank();
      let li = 0;
      for (const p of e.children) {
        const isLi = p.ns === RDF && p.local === "li";
        if (isLi) li++;
        this.property(p, object, base, lang, isLi ? `${RDF}_${li}` : p.ns + p.local);
      }
    } else if (parseType === "Collection") {
      const items = e.children.map((c) => this.node(c, base, lang));
      let rest: RdfTerm = { kind: "iri", value: `${RDF}nil` };
      const cells = items.map(() => this.blank());
      for (let i = items.length - 1; i >= 0; i--) {
        const cell = cells[i];
        const item = items[i];
        if (cell === undefined || item === undefined) continue;
        this.emit(cell, `${RDF}first`, item, e.line);
        this.emit(cell, `${RDF}rest`, rest, e.line);
        rest = cell;
      }
      object = rest;
    } else if (parseType !== undefined) {
      this.unsupported(`an XML literal (rdf:parseType="${parseType}")`, `${predicate} on line ${e.line}`);
      return;
    } else if (e.children.length > 0) {
      if (e.children.length > 1) this.fail(e, `the property ${e.local} has more than one node element`);
      const child = e.children[0];
      if (child === undefined || e.hasText) this.fail(e, `the property ${e.local} mixes text and a node element`);
      object = this.node(child, base, lang);
    } else if (resource !== undefined || nodeID !== undefined || this.hasPropertyAttributes(e)) {
      object =
        resource !== undefined
          ? { kind: "iri", value: resolveIri(base, resource) }
          : nodeID !== undefined
            ? { kind: "blank", label: nodeID }
            : this.blank();
      this.propertyAttributes(e, object, base, lang, new Set(["resource", "nodeID", "ID", "datatype"]));
    } else {
      object = this.lit(e.text, lang, datatype);
    }
    this.emit(subject, predicate, object, e.line);
    if (reified !== undefined) this.reify(subject, predicate, object, `${base.replace(/#.*$/, "")}#${reified}`, e.line);
  }

  private hasPropertyAttributes(e: Elem): boolean {
    const own = new Set(["ID", "resource", "nodeID", "datatype", "parseType"]);
    return e.attrs.some((a) => a.ns !== XML_NS && a.ns !== XMLNS_NS && !(a.ns === RDF && own.has(a.local)));
  }

  private reify(subject: RdfTerm, predicate: string, object: RdfTerm, iri: string, line: number): void {
    const s: RdfTerm = { kind: "iri", value: iri };
    this.emit(s, `${RDF}type`, { kind: "iri", value: `${RDF}Statement` }, line);
    this.emit(s, `${RDF}subject`, subject, line);
    this.emit(s, `${RDF}predicate`, { kind: "iri", value: predicate }, line);
    this.emit(s, `${RDF}object`, object, line);
  }

  document(root: Elem, base: string): void {
    if (root.ns === RDF && root.local === "RDF") {
      const { base: b, lang } = this.scoped(root, base, "");
      for (const n of root.children) this.node(n, b, lang);
    } else this.node(root, base, "");
  }
}

/**
 * RDF/XML text as triples, with the findings of what the typed form cannot hold; a document that is not well-formed XML or not RDF/XML ends the read with one `syntax` finding.
 * `base` is the IRI the document was read from, which a relative `rdf:about` resolves against where the document has no `xml:base`.
 */
export function readRdfXml(text: string, base = ""): Result<Read, readonly IntegrationFinding[]> {
  const xml = new XmlReader(text);
  try {
    const root = xml.document();
    const rdf = new RdfXml(xml.findings);
    rdf.document(root, base);
    return ok({ triples: rdf.triples, findings: xml.findings });
  } catch (e) {
    if (e instanceof Fail) return err([{ kind: "syntax", line: e.line, message: e.message }]);
    throw e;
  }
}
