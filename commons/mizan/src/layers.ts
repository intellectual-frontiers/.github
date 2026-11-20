/**
 * Layers: every file on one rung of a harness's ladder, and every relative import climbing it only the way the ladder allows (commons
 * 0015-trace FR-009, FR-010). Pure functions over a ladder (rungs with their homes and the rungs each may rely on) and the contents of
 * files; the findings are `trace.ts`'s, judged against a baseline the same way.
 *
 * @remarks
 * A path is on the rung of the home that matches it most specifically: one path beats every glob, a glob whose last segment names files
 * beats a folder, and among the rest the one with more literal characters wins. So `src/**\/mod.ts` (the guides) takes
 * `src/archon/model/mod.ts` from the folder `src/archon/model/`, and `src/archon/model/types.ts` takes it from both.
 *
 * @limits
 * It reads relative imports only: a package by its name is another repository's ladder. It reads the text, not the syntax tree.
 *
 * @example
 * ```ts
 * import { layerFindings, type Ladder } from "./layers.ts";
 * const ladder: Ladder = [
 *   { number: 0, name: "Ontology", homes: ["ontology/"], mayRelyOn: [] },
 *   { number: 1, name: "Code", homes: ["src/"], mayRelyOn: [0] },
 * ];
 * layerFindings(ladder, [{ path: "ontology/a.ts", text: 'import { b } from "../src/b.ts";\n' }]); // one layers/above finding
 * ```
 *
 * @module
 */
import { globToRegExp, isGlob } from "@intellectual-frontiers/formats/glob";
import { finding, type Finding, type SourceFile } from "./trace.ts";

/** A rung of a ladder: its number, its name, its homes (globs; a trailing `/` is everything under a folder) and the rungs it may rely on. */
export type Rung = {
  readonly number: number;
  readonly name: string;
  readonly homes: readonly string[];
  readonly mayRelyOn: readonly number[];
};

/** A ladder: its rungs. */
export type Ladder = readonly Rung[];

/** Where a path is on a ladder: one rung, none, or a tie between rungs whose homes match it equally. */
export type Placement =
  | { readonly kind: "one"; readonly rung: Rung; readonly home: string }
  | { readonly kind: "none" }
  | { readonly kind: "tie"; readonly rungs: readonly Rung[]; readonly homes: readonly string[] };

/** How specific a home is for a path it matches: [class, literal characters], compared in order (higher wins). */
function specificity(home: string): readonly [number, number] {
  const literal = home.replace(/\*\*|[*?[\]{}()!@+]/g, "").length;
  if (!home.endsWith("/") && !isGlob(home)) return [3, literal];
  const last = home.endsWith("/") ? "**" : (home.split("/").pop() ?? "");
  return last === "**" || last === "" ? [1, literal] : [2, literal];
}

function matches(home: string, path: string): boolean {
  if (home.endsWith("/")) return path.startsWith(home);
  if (!isGlob(home)) return path === home;
  const re = globToRegExp(home);
  return re.kind === "ok" && re.value.test(path);
}

function compare(a: readonly [number, number], b: readonly [number, number]): number {
  return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1];
}

/** The rung a path is on (FR-009). */
export function placeOf(ladder: Ladder, path: string): Placement {
  let best: readonly [number, number] | undefined;
  let at: { rung: Rung; home: string }[] = [];
  for (const rung of ladder)
    for (const home of rung.homes) {
      if (!matches(home, path)) continue;
      const s = specificity(home);
      const c = best === undefined ? 1 : compare(s, best);
      if (c > 0) {
        best = s;
        at = [{ rung, home }];
      } else if (c === 0) at.push({ rung, home });
    }
  const rungs = [...new Map(at.map((x) => [x.rung.number, x.rung])).values()];
  const first = at[0];
  if (first === undefined) return { kind: "none" };
  if (rungs.length === 1) return { kind: "one", rung: first.rung, home: first.home };
  return { kind: "tie", rungs, homes: at.map((x) => x.home) };
}

/** A relative import of a file: the specifier as written and its line. */
export type Import = { readonly line: number; readonly specifier: string };

/** Every relative import of a file's text (FR-010): static, side-effect, re-export and dynamic `import()`, `import type` included. */
export function importsOf(text: string): readonly Import[] {
  const out: Import[] = [];
  for (const [i, raw] of text.split("\n").entries()) {
    const t = raw.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    const specs = [
      ...raw.matchAll(/^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/g),
      ...raw.matchAll(/^\s*import\s*["']([^"']+)["']/g),
      ...raw.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
      ...raw.matchAll(/^\s*\}\s*from\s*["']([^"']+)["']/g),
    ];
    for (const m of specs) {
      const s = m[1];
      if (s !== undefined && (s.startsWith("./") || s.startsWith("../"))) out.push({ line: i + 1, specifier: s });
    }
  }
  return out;
}

/** A relative specifier resolved against the file that imports it, as a path from the repository with `/`. */
export function resolveImport(from: string, specifier: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const p of specifier.split("/")) {
    if (p === "" || p === ".") continue;
    if (p === "..") parts.pop();
    else parts.push(p);
  }
  return parts.join("/");
}

function rungName(r: Rung): string {
  return `rung ${r.number} (${r.name})`;
}

/** Every finding of the layers check (FR-009, FR-010): each file's placement, then each import that climbs the ladder wrongly. */
export function layerFindings(ladder: Ladder, files: readonly SourceFile[]): readonly Finding[] {
  const out: Finding[] = [];
  for (const file of files) {
    const here = placeOf(ladder, file.path);
    if (here.kind === "none") {
      out.push(finding("layers/unclassified", file.path, 1, "no home of the ladder holds it: place it on a rung"));
      continue;
    }
    if (here.kind === "tie") {
      const names = here.rungs.map(rungName).join(" and ");
      out.push(
        finding("layers/ambiguous", file.path, 1, `it is on ${names} alike (${here.homes.join(", ")}): make one home more specific`),
      );
      continue;
    }
    for (const imp of importsOf(file.text)) {
      const target = resolveImport(file.path, imp.specifier);
      const there = placeOf(ladder, target);
      if (there.kind !== "one" || there.rung.number === here.rung.number) continue;
      const about = `-> ${target}`;
      if (there.rung.number > here.rung.number)
        out.push(
          finding(
            "layers/above",
            file.path,
            imp.line,
            `${rungName(here.rung)} imports ${target}, on ${rungName(there.rung)} above it`,
            about,
          ),
        );
      else if (!here.rung.mayRelyOn.includes(there.rung.number))
        out.push(
          finding(
            "layers/around",
            file.path,
            imp.line,
            `${rungName(here.rung)} imports ${target}, on ${rungName(there.rung)}, which it may not rely on (it relies on ${here.rung.mayRelyOn.join(", ") || "nothing"})`,
            about,
          ),
        );
    }
  }
  return out;
}
