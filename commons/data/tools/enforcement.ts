// Spec: 0044-issues FR-007
/**
 * What the tests prove, read from the tests themselves (commons data 0044-issues FR-007): every `proves([tags], "title", ...)` of the suite names the requirements it proves, so the table
 * of enforcement (`spec-kit/enforcement.tsv`) need not paraphrase a test: its note for a requirement that is checked is the list of the tests that carry its tag, and `staleRows` finds a
 * note that names a test that does not exist or does not carry the requirement.
 *
 * ```sh
 * bun tools/enforcement.ts           check the notes against the tests
 * bun tools/enforcement.ts --write   write the notes from the tests
 * ```
 *
 * @module
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** A test that proves requirements. */
export interface Proof {
  readonly file: string;
  readonly title: string;
  readonly tags: readonly string[];
}

const PROVES = /\bproves\(\s*\[([^\]]*)\]\s*,\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;

/** Every test of the suite files, with the requirements it proves. */
export function proofsOf(root: string): readonly Proof[] {
  const out: Proof[] = [];
  for (const name of readdirSync(join(root, "suite")).filter((f) => f.endsWith(".test.ts")).toSorted()) {
    const text = readFileSync(join(root, "suite", name), "utf8");
    for (const m of text.matchAll(PROVES)) {
      const tags = [...(m[1] ?? "").matchAll(/"([^"]+)"/g)].map((t) => t[1] as string);
      const raw = m[2] ?? "";
      out.push({ file: `suite/${name}`, title: JSON.parse(raw.startsWith("`") ? JSON.stringify(raw.slice(1, -1)) : raw) as string, tags });
    }
  }
  return out;
}

/** The note for a requirement: the tests that carry its tag, as `file: title` joined by `; `. */
export function noteOf(proofs: readonly Proof[], requirement: string): string | undefined {
  const mine = proofs.filter((p) => p.tags.includes(requirement));
  return mine.length === 0 ? undefined : mine.map((p) => `${p.file}: ${p.title}`).join("; ");
}

/** The rows of the table: the requirement, its mechanism, who runs it and the note. */
export const rowsOf = (text: string): readonly (readonly string[])[] => text.split("\n").map((l) => l.split("\t"));

/** The requirements whose note is not what the tests say: a `check` row whose note names a test that is not there or does not carry it, or says nothing of one that is. */
export function staleRows(text: string, proofs: readonly Proof[]): readonly string[] {
  const out: string[] = [];
  for (const c of rowsOf(text)) {
    if (c.length < 4 || c[0]?.startsWith("#") || c[0] === "requirement" || c[1] !== "check") continue;
    const want = noteOf(proofs, c[0] as string);
    if (want === undefined) out.push(`${c[0]}: no test carries its tag, and its note names ${(c[3] ?? "").slice(0, 80)}`);
    else if (want !== c[3]) out.push(`${c[0]}: its note is not the tests that carry its tag`);
  }
  return out;
}

if (import.meta.main) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const file = join(root, "spec-kit/enforcement.tsv");
  const text = readFileSync(file, "utf8");
  const proofs = proofsOf(root);
  if (process.argv.includes("--write")) {
    const next = rowsOf(text).map((c) => {
      const note = c.length >= 4 && c[1] === "check" ? noteOf(proofs, c[0] as string) : undefined;
      return note === undefined ? c.join("\t") : [c[0], c[1], c[2], note].join("\t");
    });
    writeFileSync(file, next.join("\n"));
  }
  const stale = staleRows(readFileSync(file, "utf8"), proofs);
  console.log(stale.length === 0 ? "enforcement: every note is what the tests say" : stale.join("\n"));
  process.exit(stale.length === 0 ? 0 : 1);
}
