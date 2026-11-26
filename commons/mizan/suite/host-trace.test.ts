/**
 * Tests of `runtime/trace.ts` (commons 0015-trace FR-011): a fixture tree on disk read into specifications and sources, and its findings
 * held against a baseline file: written, passing, failing on a new finding and on a stale entry.
 *
 * @module
 */
import { traceFindings } from "../src/trace.ts";
import { mkdir, readTextFile, withTempDir, writeTextFile } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { holdBaseline, posixPath, readSources, readSpecs } from "../src/host/trace.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

async function put(root: string, rel: string, text: string): Promise<void> {
  await mkdir(join(root, ...rel.split("/").slice(0, -1)), { recursive: true });
  await writeTextFile(join(root, rel), text);
}

proves(["0015-trace FR-011"], "a tree read, its findings held against a baseline that only shrinks", async () => {
  await withTempDir(async (root) => {
    await put(root, "specs/001-demo/spec.md", "**Status**: Active\n\n- **FR-001** It works.\n");
    await put(root, "specs/001-demo/reviewed.tsv", "001-demo FR-001\treviewed\n");
    await put(root, "specs/notes.md", "not a spec\n");
    await put(root, "src/a.ts", "// Spec: 001-demo FR-001\r\n");
    await put(root, "src/b.ts", "export const b = 1;\n");
    await put(root, "src/c.md", "not code\n");
    await put(root, "src/node_modules/x/d.ts", "export const d = 1;\n");
    const specs = await readSpecs(root, "specs");
    assertEquals(
      specs.map((s) => [s.slug, s.status, s.reviewed]),
      [["001-demo", "Active", ["FR-001"]]],
    );
    const sources = await readSources(root, ["src", "src/a.ts"]);
    assertEquals(
      sources.map((s) => s.path),
      ["src/a.ts", "src/b.ts", "src/a.ts"],
    );
    assertEquals(sources[0]?.text, "// Spec: 001-demo FR-001\n");
    const findings = traceFindings({ specs, sources, tests: [], ontology: [] });
    const name = "trace";
    const file = "tools/trace.baseline.txt";
    const missing = await holdBaseline({ root, file, findings, name });
    assertEquals(missing.code, 1, "no baseline: every finding is new");
    const wrote = await holdBaseline({ root, file, findings, name, write: true, comments: ["The trace's baseline."] });
    assertEquals(wrote, { code: 0, lines: ["trace: wrote tools/trace.baseline.txt (1 findings held)"] });
    assertEquals(await readTextFile(join(root, file)), "# The trace's baseline.\ntrace/no-spec-line src/b.ts\n");
    assertEquals((await holdBaseline({ root, file, findings, name })).code, 0);
    const fixed = await holdBaseline({ root, file, findings: [], name });
    assertEquals(fixed.code, 1, "a fixed finding leaves a stale entry");
    assertStringIncludes(fixed.lines.join("\n"), "stale");
  });
});

proves(["0015-trace FR-011"], "every path is relative and /-separated on every system, Windows included", async () => {
  assertEquals(posixPath("desired-os-state\\core\\x.ts"), "desired-os-state/core/x.ts");
  assertEquals(posixPath("desired-os-state/core/x.ts"), "desired-os-state/core/x.ts");
  await withTempDir(async (root) => {
    await mkdir(join(root, "src", "a", "b"), { recursive: true });
    await writeTextFile(join(root, "src", "a", "b", "c.ts"), "export {};\n");
    const sources = await readSources(root, ["src"]);
    assertEquals(
      sources.map((s) => s.path),
      ["src/a/b/c.ts"],
    );
    assert(sources.every((s) => !s.path.includes("\\")));
  });
});
