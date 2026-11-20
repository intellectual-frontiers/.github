// Spec: 0001-quality-evidence FR-030
/**
 * The files of a requirement's trace chain (commons 0001-quality-evidence FR-030, 0020-ifccm FR-014): its specification, the code that cites it with a
 * `// Spec:` line, the tests that prove it with `proves`, and the ontology files that define a term for it. A change to any of them after the
 * revision of a run makes the proof stale; this file only says which they are. It reads text it is given and uses the readers of
 * `kernel/trace.ts`, so that no stage needs an annotation of its own.
 *
 * @remarks
 * Also here: the tests a repository holds, by name (`testsOf`), which a CAPA names (FR-033), and the line of a requirement in its specification
 * (`requirementLine`), so that a change to the requirement's own text is told from a change to its neighbours' (FR-030's "its text").
 *
 * @module
 */
import { type Cited, parseSpec, proofsOf, specLines } from "@intellectual-frontiers/mizan/trace";
import type { KnownTest } from "./ledger.ts";

/** A file of the repository and its text. */
export type SourceText = { readonly path: string; readonly text: string };

const numberOf = (id: string): number => Number(/(\d+)/.exec(id)?.[1] ?? Number.NaN);

/** Whether a citation of a specification names the requirement `fr`, alone or inside a range. */
function names(cited: Cited, fr: string): boolean {
  return cited.kind === "one" ? cited.id === fr : numberOf(cited.from) <= numberOf(fr) && numberOf(fr) <= numberOf(cited.to);
}

/** The requirements, `NNNN-slug FR-nnn`, of each specification's text, by slug. */
export function requirementsOf(specs: readonly { readonly slug: string; readonly text: string }[]): ReadonlyMap<string, readonly string[]> {
  return new Map(specs.map((s) => [s.slug, parseSpec(s.slug, s.text).requirements.map((r) => `${s.slug} ${r.id}`)]));
}

/**
 * For each requirement, the files of its chain (FR-030): the specification at `specPaths`, every file whose `// Spec:` line or `proves` call
 * names it (alone or in a range), and every file that holds its identifier as text where it is an ontology file (`mz:definedBy`).
 */
export function chainFiles(
  requirements: readonly string[],
  sources: readonly SourceText[],
  specPaths: ReadonlyMap<string, string>,
): ReadonlyMap<string, readonly string[]> {
  const bySlug = new Map<string, string[]>();
  for (const r of requirements) {
    const [slug = ""] = r.split(" ");
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), r]);
  }
  const out = new Map<string, Set<string>>(requirements.map((r) => [r, new Set<string>()]));
  const add = (requirement: string, path: string): void => void out.get(requirement)?.add(path);
  for (const r of requirements) {
    const [slug = ""] = r.split(" ");
    const spec = specPaths.get(slug);
    if (spec !== undefined) add(r, spec);
  }
  for (const f of sources) {
    const cites = [
      ...specLines(f.text).flatMap((c) => c.requirements.map((x) => ({ spec: c.spec, cited: x }))),
      ...proofsOf(f.text).map((p) => ({ spec: p.spec, cited: p.requirement })),
    ];
    for (const c of cites) for (const r of bySlug.get(c.spec) ?? []) if (names(c.cited, r.split(" ")[1] ?? "")) add(r, f.path);
    if (f.path.includes("ontology/")) for (const r of requirements) if (f.text.includes(r)) add(r, f.path);
  }
  return new Map([...out].map(([r, set]) => [r, [...set].sort()]));
}

/** The line of a requirement in its specification's text (`- **FR-nnn**: ...`), trimmed; undefined where there is none. */
export function requirementLine(specText: string, fr: string): string | undefined {
  const line = specText
    .replaceAll("\r\n", "\n")
    .split("\n")
    .find((l) => l.trimStart().startsWith(`- **${fr}**`));
  return line?.trim();
}

/** The tests a text holds that name the requirements they prove: `proves(["0001-quality-evidence FR-013"], "the name", ...)`. */
export function testsOf(text: string): readonly KnownTest[] {
  const out: KnownTest[] = [];
  const call = /\bproves\(\s*\[([^\]]*)\]\s*,\s*(["'`])((?:\\.|(?!\2)[^\\])*)\2/g;
  for (const m of text.matchAll(call)) {
    const requirements = [...(m[1] ?? "").matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1] ?? "");
    out.push({ requirements, name: (m[3] ?? "").replace(/\\(["'`\\])/g, "$1") });
  }
  return out;
}
