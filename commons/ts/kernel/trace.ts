/**
 * Trace: every source file tied to a requirement, every requirement proved, every ontology term citing its specification (commons
 * 0015-trace FR-001 to FR-008). Pure functions over the contents of files a harness passes in: the specifications (`specs/NNN-slug/spec.md`
 * and `reviewed.tsv`), the source files and their `// Spec:` lines, the tests and their `proves([...])` calls and `// Proves:` lines, and
 * the ontology's citations. The findings are data, held against a baseline that may only shrink; the layers check (`layers.ts`) gives its
 * findings in the same shape and is judged the same way.
 *
 * @remarks
 * A citation is `// Spec: 097-controller FR-001, FR-003 to FR-005; 098-pair` (a spec with no requirement cites all of it). A baseline is a
 * plain text file of finding keys, one a line, sorted: the tool writes it, a person only deletes lines from it, and nothing in it runs when
 * it is read (FR-002).
 *
 * @limits
 * It reads TypeScript's text, not its syntax tree: a requirement built at run time (`FR(3)`) is not read, and a `proves(` inside a string
 * is. It runs no test.
 *
 * @example
 * ```ts
 * import { judge, parseSpec, traceFindings } from "./trace.ts";
 * const spec = parseSpec("001-demo", "**Status:** Active\n\n- **FR-001**: It MUST work.\n");
 * const found = traceFindings({ specs: [spec], sources: [{ path: "src/a.ts", text: "// Spec: 001-demo FR-001\n" }], tests: [], ontology: [] });
 * judge(found, []); // { fresh: [the unproved FR-001], stale: [], kept: [] }
 * ```
 *
 * @module
 */
import type { AnyIndividual, Fields } from "./rdf-schema.ts";

/** The rules of the trace check (FR-007). */
export type TraceRule =
  | "trace/no-spec-line"
  | "trace/unknown-spec"
  | "trace/unknown-requirement"
  | "trace/unproved"
  | "trace/term-uncited"
  | "trace/term-unknown-spec";

/** The rules of the layers check (`layers.ts`, FR-009, FR-010). */
export type LayerRule = "layers/unclassified" | "layers/ambiguous" | "layers/above" | "layers/around";

/** Every rule a finding may be of. */
export type Rule = TraceRule | LayerRule;

/** A finding (FR-001): where, by which rule, one sentence, and a key that names it without its line. */
export type Finding = {
  /** The file, relative to the repository, with `/`. */
  readonly file: string;
  /** The line, from 1 (1 for a whole file). */
  readonly line: number;
  /** The rule's id. */
  readonly rule: Rule;
  /** One plain sentence. */
  readonly message: string;
  /** `<rule> <file>`, and what the finding is about where a file holds several of one rule. */
  readonly key: string;
};

/** What a baseline and its judgement need of a finding, whatever its rule: a harness's own rules (commons 0003-mizan FR-015) use the same baseline as the trace and layers checks. */
export type Keyed = {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly message: string;
  readonly key: string;
};

/** A finding, its key made from its rule, its file and what it is about. */
export function finding(rule: Rule, file: string, line: number, message: string, about?: string): Finding {
  return { file, line, rule, message, key: about === undefined || about === "" ? `${rule} ${file}` : `${rule} ${file} ${about}` };
}

/** A file a harness passes in: its path relative to the repository, with `/`, and its text. */
export type SourceFile = { readonly path: string; readonly text: string };

/** Whether a file is generated, so exempt from the trace's rules: its name holds `.auto.` (FR-007). */
export function isGenerated(path: string): boolean {
  return (path.split("/").pop() ?? path).includes(".auto.");
}

// ---- the baseline (FR-002, FR-003)

/** The keys of a baseline file: every line that is not blank and not a `#` comment, trimmed, each once. */
export function parseBaseline(text: string): readonly string[] {
  const out = new Set<string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    out.add(line);
  }
  return [...out];
}

function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A baseline file from findings: the comment lines given (each prefixed `# `), then the keys sorted by code point, each once. */
export function formatBaseline(findings: readonly Keyed[], comments: readonly string[] = []): string {
  const keys = [...new Set(findings.map((f) => f.key))].sort(byCodePoint);
  return [...comments.map((c) => (c === "" ? "#" : `# ${c}`)), ...keys].map((l) => `${l}\n`).join("");
}

/** A judgement of findings against a baseline: the new findings, the stale keys, and the findings the baseline keeps. */
export type Judgement<F extends Keyed = Finding> = {
  /** Findings whose key the baseline does not hold: they fail the check. */
  readonly fresh: readonly F[];
  /** Baseline keys no finding has: they fail the check until they are deleted. */
  readonly stale: readonly string[];
  /** Findings the baseline holds. */
  readonly kept: readonly F[];
};

/** Findings judged against a baseline's keys (FR-002). */
export function judge<F extends Keyed>(findings: readonly F[], baseline: readonly string[]): Judgement<F> {
  const held = new Set(baseline);
  const seen = new Set(findings.map((f) => f.key));
  return {
    fresh: findings.filter((f) => !held.has(f.key)),
    stale: [...held].filter((k) => !seen.has(k)).sort(byCodePoint),
    kept: findings.filter((f) => held.has(f.key)),
  };
}

/** Whether a judgement passes: nothing new and nothing stale. */
export function passes(j: Judgement<Keyed>): boolean {
  return j.fresh.length === 0 && j.stale.length === 0;
}

/** The lines a judgement is told with (FR-003): each new finding, each stale key, then a summary. `name` names the check and its baseline. */
export function report(j: Judgement<Keyed>, name: string, baselineFile: string): readonly string[] {
  const out: string[] = [];
  for (const f of j.fresh) out.push(`${f.file}:${f.line}: ${f.rule}: ${f.message}`);
  for (const k of j.stale) out.push(`${baselineFile}: stale: "${k}" no longer occurs; delete the line, the baseline only shrinks`);
  const verdict = passes(j) ? "passed" : "FAILED";
  out.push(`${name}: ${verdict}: ${j.fresh.length} new, ${j.stale.length} stale, ${j.kept.length} held by ${baselineFile}`);
  return out;
}

// ---- specifications (FR-004)

/** A requirement of a specification and the line of `spec.md` it is on. */
export type SpecRequirement = { readonly id: string; readonly line: number };

/** A specification as the trace reads it (FR-004). */
export type Spec = {
  /** Its folder's name, `NNN-slug`. */
  readonly slug: string;
  /** The first word of its status, where its head states one. */
  readonly status: string | undefined;
  /** Its requirements, in order. */
  readonly requirements: readonly SpecRequirement[];
  /** The requirements its `reviewed.tsv` reviews (`FR-NNN`). */
  readonly reviewed: readonly string[];
};

const FR_LINE = /^\s*-\s*\*\*(FR-\d{3}[a-z]?)\*\*/;
const STATUS = /\*\*Status(?:\*\*:|:\*\*)\s*([A-Za-z][A-Za-z-]*)/;

/** A specification read from its `spec.md` and, where it has one, its `reviewed.tsv` (FR-004). */
export function parseSpec(slug: string, specText: string, reviewedText = ""): Spec {
  const lines = specText.split("\n");
  const requirements: SpecRequirement[] = [];
  let status: string | undefined;
  for (const [i, line] of lines.entries()) {
    if (status === undefined) {
      const s = STATUS.exec(line);
      if (s?.[1] !== undefined) status = s[1];
    }
    const id = FR_LINE.exec(line)?.[1];
    if (id !== undefined) requirements.push({ id, line: i + 1 });
  }
  const reviewed: string[] = [];
  for (const raw of reviewedText.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const req = (line.split("\t")[0] ?? "").trim();
    const m = /^(\S+)\s+(FR-\d{3}[a-z]?)$/.exec(req);
    if (m?.[1] === slug && m[2] !== undefined) reviewed.push(m[2]);
  }
  return { slug, status, requirements, reviewed };
}

/** Whether a spec is held to proofs: its status is neither Draft nor Retired (FR-007). */
export function inForce(spec: Spec): boolean {
  const s = spec.status?.toLowerCase();
  return s !== "draft" && s !== "retired";
}

// ---- citations (FR-005, FR-006)

/** A requirement or a range of them, as a citation writes it. */
export type Cited = { readonly kind: "one"; readonly id: string } | { readonly kind: "range"; readonly from: string; readonly to: string };

/** One group of a citation: a spec, and the requirements it names (none: the whole spec). */
export type Citation = { readonly line: number; readonly spec: string; readonly requirements: readonly Cited[] };

const FR_TOKEN = /^FR-\d{3}[a-z]?$/;

/** The groups of a citation's text (`097-controller FR-001, FR-003 to FR-005; 098-pair`), at a line. */
export function parseCitation(text: string, line: number): readonly Citation[] {
  const out: Citation[] = [];
  for (const group of text.split(";")) {
    const words = group
      .replaceAll(",", " ")
      .split(/\s+/)
      .filter((w) => w !== "");
    const [spec, ...rest] = words;
    if (spec === undefined) continue;
    const requirements: Cited[] = [];
    for (let i = 0; i < rest.length; i++) {
      const w = rest[i] ?? "";
      if (w === "to" || w === "and") continue;
      if (rest[i + 1] === "to" && rest[i + 2] !== undefined) {
        requirements.push({ kind: "range", from: w, to: rest[i + 2] ?? "" });
        i += 2;
        continue;
      }
      requirements.push({ kind: "one", id: w });
    }
    out.push({ line, spec, requirements });
  }
  return out;
}

/** Every citation of a file's `// Spec:` lines (FR-005). */
export function specLines(text: string): readonly Citation[] {
  const out: Citation[] = [];
  for (const [i, raw] of text.split("\n").entries()) {
    const m = /^\s*\/\/ Spec: (.*)$/.exec(raw);
    if (m?.[1] !== undefined) out.push(...parseCitation(m[1], i + 1));
  }
  return out;
}

/** A requirement, or a range of them, a test names, and its line. */
export type Proof = { readonly line: number; readonly spec: string; readonly requirement: Cited };

const REQUIREMENT = /^(\d{3,4}[a-z0-9-]*) (FR-\d{3}[a-z]?)$/;

function literalStrings(text: string): readonly string[] {
  return [...text.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`([^`$\\]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
}

/** The string, or strings of an array, that each `const NAME = ...` of a file gives. */
function constants(text: string): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const m of text.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*/g)) {
    const name = m[1];
    if (name === undefined) continue;
    const rest = text.slice((m.index ?? 0) + m[0].length);
    const first = rest[0];
    if (first === "[") {
      const end = closing(rest, 0);
      if (end > 0) out.set(name, literalStrings(rest.slice(1, end)));
    } else if (first === '"' || first === "'" || first === "`") {
      const lit = literalStrings(rest.split("\n")[0] ?? "")[0];
      if (lit !== undefined) out.set(name, [lit]);
    }
  }
  return out;
}

/** The index of the `]` that closes the `[` at `open`, skipping strings; -1 where there is none. */
function closing(text: string, open: number): number {
  let depth = 0;
  let quote: string | undefined;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote !== undefined) {
      if (c === "\\") i++;
      else if (c === quote) quote = undefined;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function lineAt(text: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") n++;
  return n;
}

function asProof(text: string, line: number): Proof | undefined {
  const m = REQUIREMENT.exec(text.trim());
  return m?.[1] === undefined || m[2] === undefined ? undefined : { line, spec: m[1], requirement: { kind: "one", id: m[2] } };
}

/** Every requirement a test file proves (FR-006): in the array a `proves(` call opens, and on its `// Proves:` lines. */
export function proofsOf(text: string): readonly Proof[] {
  const out: Proof[] = [];
  const consts = constants(text);
  for (const m of text.matchAll(/\bproves\(\s*/g)) {
    const at = (m.index ?? 0) + m[0].length;
    const line = lineAt(text, at);
    if (text[at] === "[") {
      const end = closing(text, at);
      if (end < 0) continue;
      const inner = text.slice(at + 1, end);
      for (const s of literalStrings(inner)) {
        const p = asProof(s, line);
        if (p !== undefined) out.push(p);
      }
      const bare = inner.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`/g, " ");
      for (const id of bare.matchAll(/(?:\.\.\.)?\b([A-Za-z_$][\w$]*)\b(?!\s*\()/g)) {
        for (const s of consts.get(id[1] ?? "") ?? []) {
          const p = asProof(s, line);
          if (p !== undefined) out.push(p);
        }
      }
    } else {
      const id = /^([A-Za-z_$][\w$]*)\b/.exec(text.slice(at))?.[1];
      for (const s of consts.get(id ?? "") ?? []) {
        const p = asProof(s, line);
        if (p !== undefined) out.push(p);
      }
    }
  }
  for (const [i, raw] of text.split("\n").entries()) {
    const m = /^\s*\/\/ Proves: (.*)$/.exec(raw);
    if (m?.[1] === undefined) continue;
    for (const c of parseCitation(m[1], i + 1)) for (const r of c.requirements) out.push({ line: i + 1, spec: c.spec, requirement: r });
  }
  return out;
}

// ---- the ontology's citations (FR-008)

/** An ontology term and what it cites: specs (`NNN-slug`) or requirements (`NNN-slug FR-NNN`), and where it is stated. */
export type OntologyCitation = { readonly term: string; readonly cites: readonly string[]; readonly file: string; readonly line?: number };

/** What `citationsOf` reads of a class schema: its class and its fields. */
export type CitingSchema = { readonly class: { readonly iri: string }; readonly fields: Fields };

/** The citations of the individuals made by schemas that have a field `field` (`spec` by default): its values, or none (FR-008). */
export function citationsOf(
  schemas: readonly CitingSchema[],
  individuals: readonly AnyIndividual[],
  file: string,
  field = "spec",
  termOf: (iri: string) => string = (iri) => iri,
): readonly OntologyCitation[] {
  const properties = new Map<string, string>();
  for (const s of schemas) {
    const f = s.fields[field];
    if (f !== undefined) properties.set(s.class.iri, f.property.iri);
  }
  const out: OntologyCitation[] = [];
  for (const i of individuals) {
    const property = properties.get(i.class.iri);
    if (property === undefined) continue;
    const cites = i.statements.filter((s) => s.predicate.iri === property).flatMap((s) => s.objects.filter((o) => typeof o === "string"));
    out.push({ term: termOf(i.iri), cites, file });
  }
  return out;
}

// ---- the check (FR-007)

/** What the trace check reads (FR-007). */
export type TraceInput = {
  /** The specifications. */
  readonly specs: readonly Spec[];
  /** The source files, each to carry a `// Spec:` line. */
  readonly sources: readonly SourceFile[];
  /** The test files, whose proofs are read. */
  readonly tests: readonly SourceFile[];
  /** The ontology's terms and their citations. */
  readonly ontology: readonly OntologyCitation[];
  /** Where the specifications are, from the repository (`specs` by default). */
  readonly specsFolder?: string;
};

function numberOf(id: string): number {
  return Number.parseInt(id.slice(3, 6), 10);
}

/** The ids a cited requirement names in a spec, or why it names none. */
function expand(spec: Spec, c: Cited): { readonly ids: readonly string[]; readonly missing: readonly string[] } {
  const has = (id: string): boolean => spec.requirements.some((r) => r.id === id);
  if (c.kind === "one") return FR_TOKEN.test(c.id) && has(c.id) ? { ids: [c.id], missing: [] } : { ids: [], missing: [c.id] };
  const missing = [c.from, c.to].filter((id) => !FR_TOKEN.test(id) || !has(id));
  if (missing.length > 0) return { ids: [], missing };
  const lo = numberOf(c.from);
  const hi = numberOf(c.to);
  if (lo > hi) return { ids: [], missing: [`${c.from} to ${c.to}`] };
  return { ids: spec.requirements.filter((r) => numberOf(r.id) >= lo && numberOf(r.id) <= hi).map((r) => r.id), missing: [] };
}

/** Every finding of the trace (FR-007), in the order: sources, specifications, ontology. */
export function traceFindings(input: TraceInput): readonly Finding[] {
  const folder = input.specsFolder ?? "specs";
  const specs = new Map(input.specs.map((s) => [s.slug, s]));
  const out: Finding[] = [];
  for (const file of input.sources) {
    if (isGenerated(file.path)) continue;
    const cites = specLines(file.text);
    if (cites.length === 0) {
      out.push(
        finding(
          "trace/no-spec-line",
          file.path,
          1,
          "it names no requirement: add a line `// Spec: NNN-slug FR-NNN` (or `// Spec: NNN-slug`)",
        ),
      );
      continue;
    }
    for (const c of cites) {
      const spec = specs.get(c.spec);
      if (spec === undefined) {
        out.push(finding("trace/unknown-spec", file.path, c.line, `its Spec: line names ${c.spec}, which is no specification`, c.spec));
        continue;
      }
      for (const r of c.requirements)
        for (const id of expand(spec, r).missing)
          out.push(
            finding(
              "trace/unknown-requirement",
              file.path,
              c.line,
              `its Spec: line names ${c.spec} ${id}, which that specification does not have`,
              `${c.spec} ${id}`,
            ),
          );
    }
  }
  const proved = new Set<string>();
  for (const t of input.tests) {
    for (const p of proofsOf(t.text)) {
      const spec = specs.get(p.spec);
      if (spec === undefined) continue;
      for (const id of expand(spec, p.requirement).ids) proved.add(`${p.spec} ${id}`);
    }
  }
  for (const spec of input.specs) {
    if (!inForce(spec)) continue;
    const reviewed = new Set(spec.reviewed);
    for (const r of spec.requirements) {
      if (proved.has(`${spec.slug} ${r.id}`) || reviewed.has(r.id)) continue;
      out.push(
        finding(
          "trace/unproved",
          `${folder}/${spec.slug}/spec.md`,
          r.line,
          `${spec.slug} ${r.id} is in force, and no test proves it and no reviewed.tsv reviews it`,
          r.id,
        ),
      );
    }
  }
  for (const o of input.ontology) {
    const line = o.line ?? 1;
    if (o.cites.length === 0) {
      out.push(finding("trace/term-uncited", o.file, line, `the term ${o.term} cites no specification`, o.term));
      continue;
    }
    for (const cite of o.cites) {
      const missing = parseCitation(cite, line).flatMap((c) => {
        const spec = specs.get(c.spec);
        if (spec === undefined) return [c.spec];
        return c.requirements.flatMap((r) => expand(spec, r).missing.map((id) => `${c.spec} ${id}`));
      });
      for (const m of missing)
        out.push(finding("trace/term-unknown-spec", o.file, line, `the term ${o.term} cites ${m}, which does not exist`, `${o.term} ${m}`));
    }
  }
  return out;
}
