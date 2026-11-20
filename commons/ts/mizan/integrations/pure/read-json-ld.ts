/**
 * A reader of JSON-LD (commons 0019-mizan-integrations FR-020, FR-021): the text of an outside ontology published as JSON-LD, in its expanded or its compacted form, as triples,
 * with what the typed form cannot hold named as findings and never dropped silently. It lives here and not in the kernel, which reads no RDF syntax (0012-ontology FR-007).
 *
 * @remarks
 * It reads the JSON once, with its own small parser that keeps each number's text (JSON-LD tells `1` from `1.0`, which `JSON.parse` does not) and each object's line, then expands
 * it by the JSON-LD 1.1 algorithm for what vocabularies use: an inline `@context` (an object, an array of them, `null`, in the document or in a node) with `@vocab`, `@base`,
 * `@language`, terms given as an IRI, a compact IRI or an object (`@id`, `@type` as `@id`, `@vocab` or a datatype, `@language`, `@container` of `@set`, `@list`, `@language` or
 * `@index`, `@reverse`, `@prefix`) and the aliases of keywords; `@id`, `@type`, `@graph` at the top, `@included`, `@value` with `@type` and `@language`, `@set`, `@list`, `@reverse`,
 * nested node objects (a blank node where there is no `@id`, `genid-N` in document order) and numbers and booleans as typed literals. A `@list` is read as the `rdf:first` and
 * `rdf:rest` triples it stands for. Each of these is `unsupported`, named with its line and not read, where it appears: a remote context (a string, which this layer cannot fetch),
 * `@import`, a scoped context (on a term or a type), a named graph, `@nest`, a JSON literal (`@type: @json`), a container of `@graph`, `@id` or `@type`, and a key that expands to no IRI.
 *
 * @limits
 * It does not fetch a context, does not compact, frame or flatten, and keeps no named graph. A number's datatype follows its text (no `.` or `e`: `xsd:integer`, else `xsd:double`).
 *
 * @example
 * ```ts
 * import { readJsonLd } from "./read-json-ld.ts";
 * const r = readJsonLd('{"@context":{"@vocab":"https://example.org/"},"@id":"https://example.org/a","@type":"B","n":3}');
 * r.kind === "ok" && r.value.triples.length; // 2
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { RdfTerm, RdfTriple, Read } from "./read-rdf.ts";
import { resolveIri } from "./read-rdf-xml.ts";
import type { IntegrationFinding } from "./types.ts";

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XSD = "http://www.w3.org/2001/XMLSchema#";

class Fail extends Error {
  readonly line: number;
  constructor(line: number, message: string) {
    super(message);
    this.line = line;
  }
}

/** A number as the JSON text wrote it. */
type JNum = { readonly kind: "number"; readonly lexical: string };
/** An object of the JSON, its entries in document order and the line it starts on. */
type JObj = { readonly kind: "object"; readonly entries: readonly (readonly [string, JVal])[]; readonly line: number };
/** A JSON value as this reader keeps it. */
type JVal = null | boolean | string | JNum | readonly JVal[] | JObj;

const isObj = (v: JVal | undefined): v is JObj => typeof v === "object" && v !== null && !Array.isArray(v) && "entries" in v;
const isNum = (v: JVal | undefined): v is JNum => typeof v === "object" && v !== null && !Array.isArray(v) && "lexical" in v;
const isList = (v: JVal | undefined): v is readonly JVal[] => Array.isArray(v);

class JsonReader {
  private pos = 0;
  private line = 1;
  private readonly text: string;

  constructor(text: string) {
    this.text = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }

  private fail(message: string): never {
    throw new Fail(this.line, message);
  }

  private space(): void {
    for (;;) {
      const c = this.text[this.pos];
      if (c === "\n") this.line++;
      else if (c !== " " && c !== "\t" && c !== "\r") return;
      this.pos++;
    }
  }

  private string(): string {
    this.pos++;
    let out = "";
    for (;;) {
      const c = this.text[this.pos];
      if (c === undefined) this.fail("a string with no end");
      if (c === '"') {
        this.pos++;
        return out;
      }
      if (c === "\n") this.fail("a newline in a string");
      if (c !== "\\") {
        out += c;
        this.pos++;
        continue;
      }
      const e = this.text[this.pos + 1] ?? "";
      const simple: Readonly<Record<string, string>> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
      const plain = simple[e];
      if (plain !== undefined) {
        out += plain;
        this.pos += 2;
      } else if (e === "u") {
        const hex = this.text.slice(this.pos + 2, this.pos + 6);
        if (!/^[0-9A-Fa-f]{4}$/.test(hex)) this.fail("a bad \\u escape");
        out += String.fromCharCode(parseInt(hex, 16));
        this.pos += 6;
      } else this.fail(`an unknown escape \\${e}`);
    }
  }

  value(): JVal {
    this.space();
    const c = this.text[this.pos];
    if (c === "{") {
      const line = this.line;
      this.pos++;
      const entries: (readonly [string, JVal])[] = [];
      this.space();
      if (this.text[this.pos] === "}") {
        this.pos++;
        return { kind: "object", entries, line };
      }
      for (;;) {
        this.space();
        if (this.text[this.pos] !== '"') this.fail("expected a key");
        const key = this.string();
        this.space();
        if (this.text[this.pos] !== ":") this.fail("expected :");
        this.pos++;
        entries.push([key, this.value()]);
        this.space();
        const d = this.text[this.pos];
        this.pos++;
        if (d === "}") return { kind: "object", entries, line };
        if (d !== ",") this.fail("expected , or }");
      }
    }
    if (c === "[") {
      this.pos++;
      const items: JVal[] = [];
      this.space();
      if (this.text[this.pos] === "]") {
        this.pos++;
        return items;
      }
      for (;;) {
        items.push(this.value());
        this.space();
        const d = this.text[this.pos];
        this.pos++;
        if (d === "]") return items;
        if (d !== ",") this.fail("expected , or ]");
      }
    }
    if (c === '"') return this.string();
    const word = /^(?:true|false|null)/.exec(this.text.slice(this.pos, this.pos + 5))?.[0];
    if (word !== undefined) {
      this.pos += word.length;
      return word === "null" ? null : word === "true";
    }
    const n = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(this.text.slice(this.pos, this.pos + 400))?.[0];
    if (n === undefined) this.fail("expected a JSON value");
    this.pos += n.length;
    return { kind: "number", lexical: n };
  }

  document(): JVal {
    const v = this.value();
    this.space();
    if (this.pos < this.text.length) this.fail("something after the JSON value");
    return v;
  }
}

/** What an active context says about a term. */
type TermDef = {
  /** The IRI or keyword the term stands for; `null` where the context turned the term off. */
  readonly id: string | null;
  readonly type?: string;
  readonly container: ReadonlySet<string>;
  readonly lang?: string | null;
  readonly reverse: boolean;
  readonly prefix: boolean;
};

type Ctx = {
  readonly terms: ReadonlyMap<string, TermDef>;
  readonly vocab: string | undefined;
  readonly base: string;
  readonly lang: string | undefined;
};

const KEYWORDS = new Set([
  "@context",
  "@id",
  "@type",
  "@graph",
  "@value",
  "@language",
  "@list",
  "@set",
  "@reverse",
  "@included",
  "@index",
  "@nest",
  "@json",
  "@none",
  "@vocab",
  "@base",
  "@container",
  "@version",
  "@propagate",
  "@protected",
  "@import",
  "@prefix",
]);
const GEN_DELIMS = new Set([":", "/", "?", "#", "[", "]", "@"]);
const NO_CONTAINER: ReadonlySet<string> = new Set();

const ABSOLUTE = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/** The reader of a document's JSON-LD: contexts, expansion and the triples. */
class JsonLd {
  readonly triples: RdfTriple[] = [];
  readonly findings: IntegrationFinding[] = [];
  private bnodes = 0;
  private readonly base: string;

  constructor(base: string) {
    this.base = base;
  }

  private unsupported(what: string, line: number, key = ""): void {
    this.findings.push({ kind: "unsupported", what, about: `line ${line}${key === "" ? "" : `, ${key}`}` });
  }

  private blank(): RdfTerm {
    return { kind: "blank", label: `genid-${++this.bnodes}` };
  }

  private emit(subject: RdfTerm, predicate: string, object: RdfTerm, line: number): void {
    this.triples.push({ subject, predicate, object, line });
  }

  /** An IRI from a string by the rules of JSON-LD: a keyword, a term, a compact IRI or an absolute IRI, then the vocabulary or the base. `local` lets a context under construction define a term it needs first. */
  private expandIri(
    value: string,
    ctx: Ctx,
    how: { readonly vocab: boolean; readonly relative: boolean },
    local?: { readonly define: (term: string) => void; readonly has: (term: string) => boolean },
  ): string | null {
    if (KEYWORDS.has(value)) return value;
    if (local?.has(value) === true) local.define(value);
    const direct = ctx.terms.get(value);
    if (how.vocab && direct !== undefined) return direct.id;
    const colon = value.indexOf(":");
    if (colon > 0) {
      const prefix = value.slice(0, colon);
      const suffix = value.slice(colon + 1);
      if (prefix === "_" || suffix.startsWith("//")) return value;
      if (local?.has(prefix) === true) local.define(prefix);
      const def = ctx.terms.get(prefix);
      if (def?.id !== undefined && def.id !== null && def.prefix) return def.id + suffix;
      if (ABSOLUTE.test(value)) return value;
    }
    if (how.vocab && ctx.vocab !== undefined) return ctx.vocab + value;
    if (how.relative) return value.startsWith("_:") ? value : resolveIri(ctx.base, value);
    return value;
  }

  /** A context applied over an active one. */
  context(active: Ctx, local: JVal, line: number): Ctx {
    if (isList(local)) return local.reduce<Ctx>((c, x) => this.context(c, x, line), active);
    if (local === null) return { terms: new Map(), vocab: undefined, base: this.base, lang: undefined };
    if (typeof local === "string") {
      this.unsupported("a remote context, which is not fetched", line, local);
      return active;
    }
    if (!isObj(local)) throw new Fail(line, "a context is an object, an array, null or a string");
    const own = new Map(local.entries);
    let ctx: Ctx = active;
    if (own.has("@import")) this.unsupported("an @import in a context", local.line);
    const base = own.get("@base");
    if (typeof base === "string") ctx = { ...ctx, base: resolveIri(ctx.base, base) };
    else if (base === null) ctx = { ...ctx, base: "" };
    const lang = own.get("@language");
    if (typeof lang === "string") ctx = { ...ctx, lang: lang.toLowerCase() };
    else if (lang === null) ctx = { ...ctx, lang: undefined };
    const vocab = own.get("@vocab");
    if (typeof vocab === "string") ctx = { ...ctx, vocab: this.expandIri(vocab, ctx, { vocab: true, relative: true }) ?? undefined };
    else if (vocab === null) ctx = { ...ctx, vocab: undefined };
    const terms = new Map(ctx.terms);
    const defined = new Map<string, boolean>();
    const define = (term: string): void => {
      const state = defined.get(term);
      if (state === true) return;
      if (state === false) throw new Fail(local.line, `the term ${term} is defined by itself`);
      defined.set(term, false);
      const value = own.get(term);
      const current: Ctx = { ...ctx, terms };
      const helper = { define, has: (t: string) => own.has(t) && !defined.has(t) && !t.startsWith("@") };
      terms.set(term, this.termDefinition(term, value ?? null, current, helper, local.line));
      defined.set(term, true);
    };
    for (const [key] of local.entries) if (!key.startsWith("@")) define(key);
    return { ...ctx, terms };
  }

  private termDefinition(
    term: string,
    value: JVal,
    ctx: Ctx,
    helper: { readonly define: (term: string) => void; readonly has: (term: string) => boolean },
    line: number,
  ): TermDef {
    const off: TermDef = { id: null, container: NO_CONTAINER, reverse: false, prefix: false };
    if (value === null) return off;
    const object = typeof value === "string" ? new Map<string, JVal>([["@id", value]]) : isObj(value) ? new Map(value.entries) : undefined;
    if (object === undefined) throw new Fail(line, `the term ${term} has a definition that is not a string, an object or null`);
    if (object.has("@context")) this.unsupported("a scoped context on a term", line, term);
    const container = new Set<string>();
    const c = object.get("@container");
    for (const x of isList(c) ? c : c === undefined ? [] : [c]) if (typeof x === "string") container.add(x);
    const reverse = object.get("@reverse");
    const idValue = typeof reverse === "string" ? reverse : object.get("@id");
    let id: string | null;
    if (typeof idValue === "string" && idValue !== term) id = this.expandIri(idValue, ctx, { vocab: true, relative: false }, helper);
    else if (term.includes(":")) id = this.expandIri(term, ctx, { vocab: true, relative: false }, helper);
    else if (ctx.vocab !== undefined) id = ctx.vocab + term;
    else {
      this.unsupported("a term with no IRI (it has no @id and the context has no @vocab)", line, term);
      return off;
    }
    const t = object.get("@type");
    const type = typeof t === "string" ? this.expandIri(t, ctx, { vocab: true, relative: false }, helper) : null;
    const lang = object.get("@language");
    const simple = typeof value === "string";
    const explicit = object.get("@prefix");
    const prefix = typeof explicit === "boolean" ? explicit : simple && !term.includes(":") && id !== null && GEN_DELIMS.has(id.slice(-1));
    return {
      id,
      ...(type === null ? {} : { type }),
      container,
      ...(typeof lang === "string" ? { lang: lang.toLowerCase() } : lang === null && object.has("@language") ? { lang: null } : {}),
      reverse: typeof reverse === "string",
      prefix,
    };
  }

  /** What a key of a node stands for in a context: a keyword (through an alias), or the term and its IRI. */
  private key(k: string, ctx: Ctx): { readonly iri: string | null; readonly def: TermDef | undefined } {
    const def = ctx.terms.get(k);
    if (def !== undefined) return { iri: def.id, def };
    return { iri: this.expandIri(k, ctx, { vocab: true, relative: false }), def: undefined };
  }

  private literal(value: string, datatype: string | undefined, lang: string | undefined): RdfTerm {
    if (datatype !== undefined) return { kind: "literal", value, datatype };
    if (lang !== undefined) return { kind: "literal", value, datatype: `${RDF}langString`, lang };
    return { kind: "literal", value, datatype: `${XSD}string` };
  }

  private number(n: JNum): RdfTerm {
    if (/^-?[0-9]+$/.test(n.lexical)) return { kind: "literal", value: n.lexical === "-0" ? "0" : n.lexical, datatype: `${XSD}integer` };
    const [m = "0", e = "0"] = Number(n.lexical).toExponential().split("e");
    const mantissa = m.includes(".") ? m : `${m}.0`;
    return { kind: "literal", value: `${mantissa}E${e.replace("+", "")}`, datatype: `${XSD}double` };
  }

  private nodeRef(id: string): RdfTerm {
    return id.startsWith("_:") ? { kind: "blank", label: id.slice(2) } : { kind: "iri", value: id };
  }

  /** An item of a property's value as an RDF term, or `undefined` where it stands for no term (null, and what is not read). */
  private item(v: JVal, ctx: Ctx, def: TermDef | undefined, line: number, key: string): RdfTerm | undefined {
    if (v === null) return undefined;
    if (def?.type === "@json") {
      this.unsupported("a JSON literal", line, key);
      return undefined;
    }
    if (typeof v === "string") {
      if (def?.type === "@id" || def?.type === "@vocab") {
        const iri = this.expandIri(v, ctx, { vocab: def.type === "@vocab", relative: true });
        return iri === null ? undefined : this.nodeRef(iri);
      }
      const lang = def !== undefined && def.lang !== undefined ? (def.lang ?? undefined) : ctx.lang;
      return this.literal(
        v,
        def?.type === undefined || def.type === "@none" ? undefined : def.type,
        def?.type === undefined ? lang : undefined,
      );
    }
    if (typeof v === "boolean") {
      return this.literal(String(v), def?.type !== undefined && !def.type.startsWith("@") ? def.type : `${XSD}boolean`, undefined);
    }
    if (isNum(v)) {
      if (def?.type !== undefined && !def.type.startsWith("@")) return this.literal(v.lexical, def.type, undefined);
      return this.number(v);
    }
    if (isList(v)) {
      this.unsupported("an array inside an array", line, key);
      return undefined;
    }
    return this.objectValue(v, ctx, def, key);
  }

  private objectValue(o: JObj, ctx0: Ctx, def: TermDef | undefined, key: string): RdfTerm | undefined {
    const ctxEntry = o.entries.find(([k]) => k === "@context")?.[1];
    const ctx = ctxEntry === undefined ? ctx0 : this.context(ctx0, ctxEntry, o.line);
    const keywords = new Map<string, JVal>();
    for (const [k, v] of o.entries) {
      const r = this.key(k, ctx);
      if (r.iri === "@value" || r.iri === "@list" || r.iri === "@set" || r.iri === "@type" || r.iri === "@language") keywords.set(r.iri, v);
    }
    if (keywords.has("@value")) {
      const v = keywords.get("@value") ?? null;
      const t = keywords.get("@type");
      const l = keywords.get("@language");
      const datatype = typeof t === "string" ? this.expandIri(t, ctx, { vocab: true, relative: false }) : null;
      if (v === null) return undefined;
      if (datatype === "@json") {
        this.unsupported("a JSON literal", o.line, key);
        return undefined;
      }
      if (typeof l === "string" && typeof v === "string") return this.literal(v, undefined, l.toLowerCase());
      if (typeof v === "string") return this.literal(v, datatype ?? undefined, undefined);
      if (typeof v === "boolean") return this.literal(String(v), datatype ?? `${XSD}boolean`, undefined);
      if (isNum(v)) return datatype === null ? this.number(v) : this.literal(v.lexical, datatype, undefined);
      this.unsupported("a value that is not a string, a number or a boolean", o.line, key);
      return undefined;
    }
    if (keywords.has("@list")) return this.list(keywords.get("@list") ?? null, ctx, def, o.line, key);
    if (keywords.has("@set")) {
      this.unsupported("a @set nested as a single value", o.line, key);
      return undefined;
    }
    return this.node(o, ctx0);
  }

  private list(v: JVal, ctx: Ctx, def: TermDef | undefined, line: number, key: string): RdfTerm {
    const items = (isList(v) ? v : [v]).map((x) => this.item(x, ctx, def, line, key)).filter((x): x is RdfTerm => x !== undefined);
    const cells = items.map(() => this.blank());
    let rest: RdfTerm = { kind: "iri", value: `${RDF}nil` };
    for (let i = items.length - 1; i >= 0; i--) {
      const cell = cells[i];
      const item = items[i];
      if (cell === undefined || item === undefined) continue;
      this.emit(cell, `${RDF}first`, item, line);
      this.emit(cell, `${RDF}rest`, rest, line);
      rest = cell;
    }
    return rest;
  }

  /** A node object: its subject, the triples of its types and properties. */
  node(o: JObj, ctx0: Ctx): RdfTerm {
    const ctxEntry = o.entries.find(([k]) => k === "@context")?.[1];
    const ctx = ctxEntry === undefined ? ctx0 : this.context(ctx0, ctxEntry, o.line);
    let subject: RdfTerm | undefined;
    for (const [k, v] of o.entries) {
      if (this.key(k, ctx).iri === "@id" && typeof v === "string") {
        const iri = this.expandIri(v, ctx, { vocab: false, relative: true });
        if (iri !== null) subject = this.nodeRef(iri);
      }
    }
    const s = subject ?? this.blank();
    for (const [k, v] of o.entries) this.entry(s, k, v, ctx, o);
    return s;
  }

  private entry(s: RdfTerm, k: string, v: JVal, ctx: Ctx, o: JObj): void {
    const { iri, def } = this.key(k, ctx);
    if (iri === null) return;
    if (iri === "@id" || iri === "@context" || iri === "@index") return;
    if (iri === "@type") {
      for (const t of isList(v) ? v : [v]) {
        if (typeof t !== "string") continue;
        const tdef = ctx.terms.get(t);
        const type = tdef !== undefined ? tdef.id : this.expandIri(t, ctx, { vocab: true, relative: true });
        if (type !== null) this.emit(s, `${RDF}type`, this.nodeRef(type), o.line);
      }
      return;
    }
    if (iri === "@graph") {
      if (o.entries.some(([x]) => this.key(x, ctx).iri === "@id")) this.unsupported("a named graph", o.line);
      else this.topLevel(v, ctx);
      return;
    }
    if (iri === "@included") {
      this.topLevel(v, ctx);
      return;
    }
    if (iri === "@reverse") {
      if (!isObj(v)) throw new Fail(o.line, "@reverse is an object");
      for (const [rk, rv] of v.entries) {
        const r = this.key(rk, ctx);
        if (r.iri === null || r.iri.startsWith("@")) continue;
        for (const x of isList(rv) ? rv : [rv]) {
          const t = isObj(x)
            ? this.node(x, ctx)
            : typeof x === "string"
              ? this.nodeRef(this.expandIri(x, ctx, { vocab: false, relative: true }) ?? x)
              : undefined;
          if (t !== undefined) this.emit(t, r.iri, s, o.line);
        }
      }
      return;
    }
    if (iri === "@nest") {
      this.unsupported("a @nest", o.line, k);
      return;
    }
    if (iri.startsWith("@")) return;
    if (!ABSOLUTE.test(iri) && !iri.startsWith("_:")) {
      this.unsupported("a key that expands to no IRI, so JSON-LD drops it", o.line, k);
      return;
    }
    const container = def?.container ?? NO_CONTAINER;
    for (const c of container) {
      if (c === "@graph" || c === "@id" || c === "@type") {
        this.unsupported(`a ${c} container`, o.line, k);
        return;
      }
    }
    const values = this.containerItems(v, container, ctx, def, o.line, k);
    for (const x of values) {
      const t = x.term;
      if (t === undefined) continue;
      if (def?.reverse === true) this.emit(t, iri, s, o.line);
      else this.emit(s, iri, t, o.line);
    }
  }

  private containerItems(
    v: JVal,
    container: ReadonlySet<string>,
    ctx: Ctx,
    def: TermDef | undefined,
    line: number,
    key: string,
  ): { readonly term: RdfTerm | undefined }[] {
    const out: { term: RdfTerm | undefined }[] = [];
    const flat = (x: JVal, d: TermDef | undefined, lang?: string): void => {
      if (isList(x)) {
        for (const y of x) flat(y, d, lang);
        return;
      }
      if (isObj(x)) {
        const set = x.entries.find(([k]) => this.key(k, ctx).iri === "@set");
        if (set !== undefined) {
          flat(set[1], d, lang);
          return;
        }
      }
      if (lang !== undefined && typeof x === "string") out.push({ term: this.literal(x, undefined, lang.toLowerCase()) });
      else out.push({ term: this.item(x, ctx, d, line, key) });
    };
    if (container.has("@list") && !(isObj(v) && v.entries.some(([k]) => this.key(k, ctx).iri === "@list"))) {
      out.push({ term: this.list(v, ctx, def, line, key) });
      return out;
    }
    if (container.has("@language") && isObj(v)) {
      for (const [lang, x] of v.entries) flat(x, def, lang);
      return out;
    }
    if (container.has("@index") && isObj(v)) {
      for (const [, x] of v.entries) flat(x, def);
      return out;
    }
    flat(v, def);
    return out;
  }

  /** Nodes at the top of a document, or of an `@graph` or `@included`. */
  topLevel(v: JVal, ctx: Ctx): void {
    if (isList(v)) {
      for (const x of v) this.topLevel(x, ctx);
      return;
    }
    if (isObj(v)) {
      const own = v.entries.find(([k]) => k === "@context")?.[1];
      const active = own === undefined ? ctx : this.context(ctx, own, v.line);
      const keys = v.entries.map(([k]) => this.key(k, active).iri);
      const graph = v.entries.find(([k]) => this.key(k, active).iri === "@graph");
      if (graph !== undefined && keys.every((k) => k === "@context" || k === "@graph")) this.topLevel(graph[1], active);
      else this.node(v, active);
    }
  }
}

/**
 * JSON-LD text as triples, with the findings of what the typed form cannot hold; JSON that is not well formed, or a context that is not one, ends the read with one `syntax`
 * finding and its line. `base` is the IRI the document was read from, which a relative `@id` resolves against where the context has no `@base`.
 */
export function readJsonLd(text: string, base = ""): Result<Read, readonly IntegrationFinding[]> {
  try {
    const json = new JsonReader(text).document();
    const reader = new JsonLd(base);
    const start: Ctx = { terms: new Map(), vocab: undefined, base, lang: undefined };
    reader.topLevel(json, start);
    return ok({ triples: reader.triples, findings: reader.findings });
  } catch (e) {
    if (e instanceof Fail) return err([{ kind: "syntax", line: e.line, message: e.message }]);
    throw e;
  }
}
