/**
 * The map of the libraries in the root README (0001-libraries FR-017) and the README's own rules (FR-018): the summary of an `about.ts` and the first clause are read as data, a row is made from each manifest,
 * the table is sorted by role and name, `--check` writes nothing and fails where the README is stale, and the real README is what the real manifests make, holds none of the words of history and links
 * only to paths that exist.
 *
 * @module
 */
import { firstClause, firstSentence, main, parseLibraryName, rowOf, rowsOf, summaryOf, synchronize, tableOf, withTable } from "../src/readme.ts";
import { decodeLibrarySource } from "../src/libraries.ts";
import { existsSync, mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const ROOT = resolve(fromFileUrl(new URL("../../..", import.meta.url)));
const SPEC = "0001-libraries";

const manifest = (name: string, extra = ""): string =>
  `export const library = { name: "${name}", verify: "bun run verify", maturity: "stable", version: "0.1.0", exports: ["."], ${extra} };\n`;
const about = (summary: string): string => `export const about = {\n  title: "X",\n  summary:\n    ${summary},\n  folders: [],\n};\n`;

proves([`${SPEC} FR-017`], "a summary is read as data from its literals joined by +, and the first clause is the first sentence cut at a clause", () => {
  const s = summaryOf(about('"First part, " +\n    "second part. Next sentence."'));
  assert(s.kind === "ok" && s.value === "First part, second part. Next sentence.");
  assertEquals(summaryOf("export const about = {};\n").kind, "err");
  assertEquals(summaryOf("export const about = { summary: make() };\n").kind, "err");
  assertEquals(firstSentence("Uses `a.b` and (e.g. this). Then more."), "Uses `a.b` and (e.g. this)");
  assertEquals(firstClause("Mizan, the IF Spec Profile, as code. The harness holds the rules."), "Mizan, the IF Spec Profile, as code");
  const long = "The one interface to a Git host, for GitHub and GitLab and plain Git, held to the same conformance tests so that nothing names a host's own word.";
  assertEquals(firstClause(long), "The one interface to a Git host");
  assertEquals(parseLibraryName("Not Lower").kind, "err");
});

proves([`${SPEC} FR-017`], "a row is made from a manifest, a library with no role is a problem, and rows are sorted by role and then by name", () => {
  const lib = (name: string, extra = ""): Parameters<typeof rowOf>[0] => {
    const r = decodeLibrarySource(manifest(name, extra));
    assert(r.kind === "ok");
    return r.value;
  };
  const a = rowOf(lib("core", 'distribution: ["github", "npm"],'), "Errors as values. More.");
  const b = rowOf(lib("kanon", 'distribution: ["github"],'), "The pattern.");
  const c = rowOf(lib("repoctl"), "The command.");
  const d = rowOf(lib("data"), "Governed data.");
  assert(a.kind === "ok" && b.kind === "ok" && c.kind === "ok" && d.kind === "ok");
  assertEquals(a.value.shape, "-");
  const table = tableOf([c.value, b.value, d.value, a.value]);
  const names = table.split("\n").slice(2).map((l) => /`@intellectual-frontiers\/([a-z-]+)`/.exec(l)?.[1]);
  assertEquals(names, ["core", "kanon", "data", "repoctl"]);
  assertStringIncludes(table, "[`@intellectual-frontiers/kanon`](commons/kanon)");
  assertStringIncludes(table, "https://www.npmjs.com/package/@intellectual-frontiers/core");
  const none = rowOf(lib("brand-new"), "A new one.");
  assert(none.kind === "err");
  assertStringIncludes(none.error, "has no role");
});

/** A repository of one library `core` with a README that has the markers, in a temporary folder. */
function repo(dir: string, readme: string): string {
  mkdirSync(join(dir, "commons", "core"), { recursive: true });
  writeTextFileSync(join(dir, "commons", "core", "library.ts"), manifest("core"));
  writeTextFileSync(join(dir, "commons", "core", "about.ts"), about('"Errors as values. More."'));
  writeTextFileSync(join(dir, "README.md"), readme);
  return dir;
}

proves([`${SPEC} FR-017`], "--check writes nothing and fails where the README is stale; without it the table is written between the markers", async () => {
  await withTempDir(async (dir) => {
    const text = "# T\n\n<!-- libraries-map:begin -->\nold\n<!-- libraries-map:end -->\n\nafter\n";
    repo(dir, text);
    const quiet = { stale: true };
    assertEquals(synchronize(dir, false).stale, quiet.stale);
    assertEquals(main(["--repo", dir, "--check"]), 1);
    assertEquals(readTextFileSync(join(dir, "README.md")), text);
    assertEquals(main(["--repo", dir]), 0);
    const written = readTextFileSync(join(dir, "README.md"));
    assertStringIncludes(written, "Errors as values");
    assert(written.startsWith("# T\n") && written.endsWith("\nafter\n"));
    assertEquals(main(["--repo", dir, "--check"]), 0);
    writeTextFileSync(join(dir, "README.md"), "# no markers\n");
    assertEquals(main(["--repo", dir, "--check"]), 1);
    assertEquals(withTable("# no markers\n", "x").kind, "err");
  });
});

proves([`${SPEC} FR-017`], "the real README is what the real manifests make, with a role for every library", () => {
  const r = synchronize(ROOT, false);
  assertEquals(r.problems, []);
  assertEquals(r.stale, false);
  assert(rowsOf(ROOT).rows.length >= 20);
});

const HISTORY = ["formerly", "previously", "legacy", "deprecated", "backward", "migration", "UAT", "acceptance test", "agora"] as const;

proves([`${SPEC} FR-018`], "the README holds none of the words of history and links only to paths that exist", () => {
  const text = readTextFileSync(join(ROOT, "README.md"));
  for (const w of HISTORY) assert(!new RegExp(`\\b${w}`, "i").test(text), `README.md says "${w}": describe what is, not what was`);
  const targets = [...text.matchAll(/\]\(([^)\s]+)\)/g), ...text.matchAll(/(?:src|srcset)="([^"]+)"/g)].map((m) => m[1] ?? "");
  assert(targets.length > 5);
  for (const t of targets) {
    if (/^(https?:|mailto:|#)/.test(t)) continue;
    const path = t.split("#")[0] ?? "";
    assert(existsSync(join(ROOT, path)), `README.md links to ${t}, which is not in the repository`);
  }
});
