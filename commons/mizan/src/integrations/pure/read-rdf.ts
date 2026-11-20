/**
 * A reader of Turtle and N-Triples, the first importer's input (commons 0019-mizan-integrations FR-004, FR-007): the text of an outside ontology as triples, with what the
 * typed form cannot hold named as findings and never dropped silently. It lives here and not in the kernel, which reads no RDF syntax (0012-ontology FR-007).
 *
 * @remarks
 * It reads `@prefix` and `@base` (and the SPARQL forms `PREFIX` and `BASE`), IRIs, prefixed names, `a`, `;` and `,` lists, plain, language and datatyped literals (short and
 * long strings, with the usual escapes), numbers and booleans, blank node labels and comments. A bracketed blank node (`[ ... ]`) or a collection (`( ... )`) is skipped with
 * a `loss` finding that names the line, and everything else is still read. A syntax it does not understand ends the read with a `syntax` finding and its line.
 *
 * @limits
 * It does not resolve relative IRIs against a base beyond `@base` joined as text, does not read RDF/XML, JSON-LD or TriG, and keeps no blank-node structure.
 *
 * @example
 * ```ts
 * import { readTurtle } from "./read-rdf.ts";
 * const r = readTurtle('@prefix ex: <https://example.org/> .\nex:a a ex:B ; ex:n 3 .\n');
 * r.kind === "ok" && r.value.triples.length; // 2
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { IntegrationFinding } from "./types.ts";

/** A term of a triple as the reader gives it: an IRI, a blank node label, or a literal with its datatype and language. */
export type RdfTerm =
  | { readonly kind: "iri"; readonly value: string }
  | { readonly kind: "blank"; readonly label: string }
  | { readonly kind: "literal"; readonly value: string; readonly datatype: string; readonly lang?: string };

/** A triple and the line it starts on. */
export type RdfTriple = { readonly subject: RdfTerm; readonly predicate: string; readonly object: RdfTerm; readonly line: number };

/** What a read gives: the triples, and what the typed form cannot hold. */
export type Read = { readonly triples: readonly RdfTriple[]; readonly findings: readonly IntegrationFinding[] };

const XSD = "http://www.w3.org/2001/XMLSchema#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDF_LANG = "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString";

/** `rdf:type`, which `a` stands for. */
export const TYPE = RDF_TYPE;

class Fail extends Error {
  readonly line: number;
  constructor(line: number, message: string) {
    super(message);
    this.line = line;
  }
}

const PN_LOCAL = /^[A-Za-z0-9_:%-]+(?:\.+[A-Za-z0-9_:%-]+)*/;

function escapeIn(raw: string, line: number): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i] ?? "";
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = raw[++i] ?? "";
    if (n === "t") out += "\t";
    else if (n === "n") out += "\n";
    else if (n === "r") out += "\r";
    else if (n === "b") out += "\b";
    else if (n === "f") out += "\f";
    else if (n === '"' || n === "'" || n === "\\") out += n;
    else if (n === "u" || n === "U") {
      const len = n === "u" ? 4 : 8;
      const hex = raw.slice(i + 1, i + 1 + len);
      if (!/^[0-9A-Fa-f]+$/.test(hex) || hex.length !== len) throw new Fail(line, "a bad \\u escape");
      out += String.fromCodePoint(parseInt(hex, 16));
      i += len;
    } else throw new Fail(line, `an unknown escape \\${n}`);
  }
  return out;
}

class Parser {
  private pos = 0;
  private line = 1;
  private readonly prefixes = new Map<string, string>();
  private base = "";
  readonly triples: RdfTriple[] = [];
  readonly findings: IntegrationFinding[] = [];
  private context = "";

  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  fail(message: string): never {
    throw new Fail(this.line, message);
  }

  private peek(): string {
    return this.text[this.pos] ?? "";
  }

  private skip(): void {
    for (;;) {
      const c = this.peek();
      if (c === "\n") {
        this.line++;
        this.pos++;
      } else if (c === " " || c === "\t" || c === "\r") this.pos++;
      else if (c === "#") {
        while (this.pos < this.text.length && this.peek() !== "\n") this.pos++;
      } else return;
    }
  }

  private rest(): string {
    return this.text.slice(this.pos);
  }

  private expect(c: string): void {
    this.skip();
    if (this.peek() !== c) this.fail(`expected ${c}`);
    this.pos++;
  }

  private iriRef(): string {
    this.skip();
    if (this.peek() !== "<") this.fail("expected an IRI in <>");
    const end = this.text.indexOf(">", this.pos);
    if (end < 0) this.fail("an IRI with no >");
    const raw = this.text.slice(this.pos + 1, end);
    this.pos = end + 1;
    const value = escapeIn(raw, this.line);
    return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) || this.base === "" ? value : this.base + value;
  }

  private prefixedName(): string | undefined {
    const m = /^([A-Za-z][A-Za-z0-9_-]*(?:\.+[A-Za-z0-9_-]+)*)?:/.exec(this.rest());
    if (m === null) return undefined;
    const prefix = m[1] ?? "";
    const ns = this.prefixes.get(prefix);
    if (ns === undefined) this.fail(`the prefix ${prefix}: is not declared`);
    const afterColon = this.rest().slice(m[0].length);
    const local = PN_LOCAL.exec(afterColon)?.[0] ?? "";
    this.pos += m[0].length + local.length;
    return ns + local.replace(/\\(.)/g, "$1");
  }

  private literal(): RdfTerm {
    const long = this.rest().startsWith('"""') || this.rest().startsWith("'''");
    const quote = this.peek();
    const open = long ? quote.repeat(3) : quote;
    this.pos += open.length;
    let raw = "";
    for (;;) {
      if (this.pos >= this.text.length) this.fail("a string with no end");
      const c = this.peek();
      if (c === "\\") {
        raw += c + (this.text[this.pos + 1] ?? "");
        this.pos += 2;
        continue;
      }
      if (this.rest().startsWith(open)) {
        this.pos += open.length;
        break;
      }
      if (c === "\n") {
        if (!long) this.fail("a newline in a short string");
        this.line++;
      }
      raw += c;
      this.pos++;
    }
    const value = escapeIn(raw, this.line);
    if (this.peek() === "@") {
      const m = /^@([A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)/.exec(this.rest());
      if (m === null) this.fail("a bad language tag");
      this.pos += m[0].length;
      return { kind: "literal", value, datatype: RDF_LANG, lang: (m[1] ?? "").toLowerCase() };
    }
    if (this.rest().startsWith("^^")) {
      this.pos += 2;
      this.skip();
      const datatype = this.peek() === "<" ? this.iriRef() : this.prefixedName();
      if (datatype === undefined) this.fail("a datatype with no IRI");
      return { kind: "literal", value, datatype };
    }
    return { kind: "literal", value, datatype: `${XSD}string` };
  }

  private skipBalanced(open: string, close: string, what: "blank-node" | "collection"): void {
    const startLine = this.line;
    let depth = 0;
    do {
      this.skip();
      const c = this.peek();
      if (c === "") this.fail(`a ${what} with no end`);
      if (c === '"' || c === "'") {
        this.literal();
        continue;
      }
      if (c === "<") {
        this.iriRef();
        continue;
      }
      if (c === open) depth++;
      if (c === close) depth--;
      this.pos++;
    } while (depth > 0);
    this.findings.push({ kind: "loss", what, line: startLine, about: this.context });
  }

  private subject(): RdfTerm | undefined {
    this.skip();
    const c = this.peek();
    if (c === "<") return { kind: "iri", value: this.iriRef() };
    if (c === "[") {
      this.skipBalanced("[", "]", "blank-node");
      return undefined;
    }
    if (c === "(") {
      this.skipBalanced("(", ")", "collection");
      return undefined;
    }
    if (this.rest().startsWith("_:")) {
      const m = /^_:([A-Za-z0-9_][A-Za-z0-9_\-.]*)/.exec(this.rest());
      if (m === null) this.fail("a bad blank node label");
      this.pos += m[0].length;
      return { kind: "blank", label: m[1] ?? "" };
    }
    const name = this.prefixedName();
    return name === undefined ? this.fail("expected a subject") : { kind: "iri", value: name };
  }

  private predicate(): string {
    this.skip();
    if (this.peek() === "a" && /^a[\s<]/.test(this.rest())) {
      this.pos++;
      return RDF_TYPE;
    }
    if (this.peek() === "<") return this.iriRef();
    const name = this.prefixedName();
    return name === undefined ? this.fail("expected a predicate") : name;
  }

  private object(): RdfTerm | undefined {
    this.skip();
    const c = this.peek();
    if (c === "<") return { kind: "iri", value: this.iriRef() };
    if (c === '"' || c === "'") return this.literal();
    if (c === "[") {
      this.skipBalanced("[", "]", "blank-node");
      return undefined;
    }
    if (c === "(") {
      this.skipBalanced("(", ")", "collection");
      return undefined;
    }
    if (this.rest().startsWith("_:")) {
      const m = /^_:([A-Za-z0-9_][A-Za-z0-9_\-.]*)/.exec(this.rest());
      if (m === null) this.fail("a bad blank node label");
      this.pos += m[0].length;
      return { kind: "blank", label: m[1] ?? "" };
    }
    const num = /^[+-]?(?:[0-9]+\.[0-9]*(?:[eE][+-]?[0-9]+)|\.[0-9]+(?:[eE][+-]?[0-9]+)|[0-9]+[eE][+-]?[0-9]+)/.exec(this.rest());
    if (num !== null) return this.numeric(num[0], "double");
    const dec = /^[+-]?[0-9]*\.[0-9]+/.exec(this.rest());
    if (dec !== null) return this.numeric(dec[0], "decimal");
    const int = /^[+-]?[0-9]+/.exec(this.rest());
    if (int !== null) return this.numeric(int[0], "integer");
    const bool = /^(true|false)(?![A-Za-z0-9_:-])/.exec(this.rest());
    if (bool !== null) {
      this.pos += bool[0].length;
      return { kind: "literal", value: bool[0], datatype: `${XSD}boolean` };
    }
    const name = this.prefixedName();
    return name === undefined ? this.fail("expected an object") : { kind: "iri", value: name };
  }

  private numeric(text: string, type: "integer" | "decimal" | "double"): RdfTerm {
    this.pos += text.length;
    return { kind: "literal", value: text, datatype: `${XSD}${type}` };
  }

  private statement(): void {
    const line = this.line;
    this.context = "";
    const s = this.subject();
    let more = true;
    while (more) {
      const p = this.predicate();
      this.context = `${s === undefined ? "" : s.kind === "iri" ? s.value : `_:${s.kind === "blank" ? s.label : ""}`} ${p}`;
      for (;;) {
        const o = this.object();
        if (s !== undefined && o !== undefined) this.triples.push({ subject: s, predicate: p, object: o, line });
        this.skip();
        if (this.peek() === ",") {
          this.pos++;
          continue;
        }
        break;
      }
      this.skip();
      if (this.peek() === ";") {
        while (this.peek() === ";") {
          this.pos++;
          this.skip();
        }
        more = this.peek() !== "." && this.peek() !== "]";
      } else more = false;
    }
    this.expect(".");
  }

  private directive(): boolean {
    this.skip();
    const r = this.rest();
    const at = r.startsWith("@prefix");
    const sparqlPrefix = /^PREFIX\b/i.test(r);
    if (at || sparqlPrefix) {
      this.pos += at ? 7 : 6;
      this.skip();
      const m = /^([A-Za-z][A-Za-z0-9_\-.]*)?:/.exec(this.rest());
      if (m === null) this.fail("a prefix with no name and colon");
      this.pos += m[0].length;
      this.prefixes.set(m[1] ?? "", this.iriRef());
      if (at) this.expect(".");
      return true;
    }
    const atBase = r.startsWith("@base");
    if (atBase || /^BASE\b/i.test(r)) {
      this.pos += atBase ? 5 : 4;
      this.base = this.iriRef();
      if (atBase) this.expect(".");
      return true;
    }
    return false;
  }

  run(): void {
    for (;;) {
      this.skip();
      if (this.pos >= this.text.length) return;
      if (!this.directive()) this.statement();
    }
  }
}

/** Turtle's text as triples, with the findings of what the typed form cannot hold; a syntax it does not understand ends the read with one `syntax` finding. */
export function readTurtle(text: string): Result<Read, readonly IntegrationFinding[]> {
  const p = new Parser(text);
  try {
    p.run();
  } catch (e) {
    if (e instanceof Fail) return err([{ kind: "syntax", line: e.line, message: e.message }]);
    throw e;
  }
  return ok({ triples: p.triples, findings: p.findings });
}

/** N-Triples' text as triples: the same reader, which takes N-Triples as the Turtle it is a subset of. */
export function readNTriples(text: string): Result<Read, readonly IntegrationFinding[]> {
  return readTurtle(text);
}

function termKey(t: RdfTerm): string {
  switch (t.kind) {
    case "iri":
      return `<${t.value}>`;
    case "blank":
      return `_:${t.label}`;
    case "literal": {
      const escaped = t.value
        .replaceAll("\\", "\\\\")
        .replaceAll('"', '\\"')
        .replaceAll("\n", "\\n")
        .replaceAll("\r", "\\r")
        .replaceAll("\t", "\\t");
      if (t.lang !== undefined) return `"${escaped}"@${t.lang}`;
      return t.datatype === `${XSD}string` ? `"${escaped}"` : `"${escaped}"^^<${t.datatype}>`;
    }
    default:
      return absurd(t);
  }
}

/** A triple as one N-Triples line, in one form whatever the syntax it was read from: a set of these is a graph, comparable with another. */
export function tripleKey(t: RdfTriple): string {
  return `${termKey(t.subject)} <${t.predicate}> ${termKey(t.object)} .`;
}
