/**
 * Tests of the catalog package loader (commons grc 0008-grc-catalogs FR-001 to FR-005) on packages written to temporary folders: a package that loads, a digest that differs, a kind or schema not known, code and unlisted files, a path out of the folder,
 * a crosswalk to a framework that is not held, a crosswalk to a control a held framework does not have, a licence or source not recorded, and content that may not be redistributed. Every name is made up.
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { standardKinds } from "../src/logical/standard-kinds.ts";
import { catalogControlUrns, readCatalogPackage } from "../src/physical/catalog.ts";

const AT = "2026-06-01T00:00:00Z";
const head = (kind: string, id: string, schema = "1"): Record<string, unknown> => ({ kind, schema, id, createdAt: AT, provenance: { producer: { name: "test", version: "1" }, inputs: [] } });
const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

const FW = { ...head("grc.framework", "ex-fw"), version: "1", title: "Example", controls: [{ id: "A-1", title: "One", statement: "S" }, { id: "A-2", title: "Two", statement: "S" }] };
const CW = { ...head("grc.crosswalk", "ex-cw"), mappings: [{ from: "urn:grc:ex:1:A-1", to: "urn:grc:elsewhere:9:Z-1", relationship: "equal", strength: 8 }] };

type Options = { readonly files?: Record<string, string>; readonly extra?: Record<string, string>; readonly manifest?: Record<string, unknown>; readonly wrongDigest?: string };

/** Writes a package of FW (and CW) to a folder, with a manifest whose digests are right unless asked. */
async function withPackage<T>(o: Options, f: (dir: string) => Promise<T>): Promise<T> {
  return fs.withTempDir(async (dir) => {
    const files = o.files ?? { "frameworks/ex.json": json(FW), "crosswalks/cw.json": json(CW) };
    const holds: unknown[] = [];
    for (const [file, text] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
      await fs.writeTextFile(path.join(dir, file), text);
      const d = JSON.parse(text) as Record<string, unknown>;
      holds.push({ kind: d["kind"], id: d["id"], file, digest: o.wrongDigest === file ? "0".repeat(64) : await sha256(new TextEncoder().encode(text)) });
    }
    for (const [file, text] of Object.entries(o.extra ?? {})) {
      await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
      await fs.writeTextFile(path.join(dir, file), text);
    }
    const manifest = { ...head("grc.catalog-package", "ex-pkg"), version: "1", title: "Example", source: { publisher: "Example Publisher", edition: "1", url: "https://example.test/ex" }, licence: "CC0-1.0", redistributable: true, holds, sources: [{ url: "https://example.test/ex.json", sha256: "a".repeat(64) }], ...o.manifest };
    await fs.writeTextFile(path.join(dir, "manifest.json"), json(manifest));
    return f(dir);
  });
}

const reasons = (r: Awaited<ReturnType<typeof readCatalogPackage>>): string => (r.kind === "err" ? r.error.map((p) => `${p.file}: ${p.reason}`).join("\n") : "");

proves(["0008-grc-catalogs FR-001", "0008-grc-catalogs FR-003"], "a package of a manifest and its documents loads, and its controls are addressed by URN under its framework and version", async () => {
  await withPackage({}, async (dir) => {
    const r = await readCatalogPackage(dir, standardKinds());
    assert(r.kind === "ok", reasons(r));
    assertEquals(r.value.documents.map((d) => d.id), ["ex-fw", "ex-cw"]);
    assertEquals(catalogControlUrns(r.value), ["urn:grc:ex-fw:1:A-1", "urn:grc:ex-fw:1:A-2"]);
  });
});

proves(["0008-grc-catalogs FR-002"], "a manifest that lists a document whose digest differs is refused, naming the file", async () => {
  await withPackage({ wrongDigest: "frameworks/ex.json" }, async (dir) => {
    const r = await readCatalogPackage(dir, standardKinds());
    assert(r.kind === "err");
    assert(reasons(r).includes("frameworks/ex.json: the SHA-256 is"), reasons(r));
  });
});

proves(["0008-grc-catalogs FR-002"], "a document of a kind or a schema this release does not know is refused", async () => {
  const unknownKind = json({ ...head("grc.nothing", "n"), x: 1 });
  const newerSchema = json({ ...FW, schema: "99" });
  for (const text of [unknownKind, newerSchema]) {
    await withPackage({ files: { "frameworks/ex.json": text } }, async (dir) => {
      const r = await readCatalogPackage(dir, standardKinds());
      assert(r.kind === "err");
      assert(reasons(r).includes("frameworks/ex.json: the document is not read"), reasons(r));
    });
  }
});

proves(["0008-grc-catalogs FR-002"], "a package with code, an unlisted file or a path out of the folder is refused", async () => {
  await withPackage({ extra: { "tools/run.sh": "echo hi\n", "frameworks/extra.json": "{}" } }, async (dir) => {
    const r = await readCatalogPackage(dir, standardKinds());
    assert(r.kind === "err");
    assert(reasons(r).includes("tools/run.sh: a package holds no code"), reasons(r));
    assert(reasons(r).includes("frameworks/extra.json: the file is not listed"), reasons(r));
  });
  await withPackage({ extra: { "README.md": "about\n", "LICENSE": "terms\n" } }, async (dir) => assert((await readCatalogPackage(dir, standardKinds())).kind === "ok"));
  await withPackage({ manifest: { holds: [{ kind: "grc.framework", id: "ex-fw", file: "../ex.json", digest: "0".repeat(64) }, { kind: "grc.framework", id: "x", file: "a/loader.ts", digest: "0".repeat(64) }] }, files: {} }, async (dir) => {
    const r = await readCatalogPackage(dir, standardKinds());
    assert(r.kind === "err");
    assert(reasons(r).includes("not a relative path inside the package"), reasons(r));
    assert(reasons(r).includes("holds no code"), reasons(r));
  });
});

proves(["0008-grc-catalogs FR-003"], "a crosswalk to a framework the package does not hold is valid, and to a control a held framework does not have is refused", async () => {
  await withPackage({}, async (dir) => assert((await readCatalogPackage(dir, standardKinds())).kind === "ok"));
  const bad = json({ ...CW, mappings: [{ from: "urn:grc:ex:1:A-9", to: "urn:grc:elsewhere:9:Z-1", relationship: "equal", strength: 8 }] });
  await withPackage({ files: { "frameworks/ex.json": json({ ...FW, id: "ex" }), "crosswalks/cw.json": bad } }, async (dir) => {
    const r = await readCatalogPackage(dir, standardKinds());
    assert(r.kind === "err");
    assert(reasons(r).includes("does not have"), reasons(r));
  });
});

proves(["0008-grc-catalogs FR-004", "0008-grc-catalogs FR-005"], "a package without a licence or a source is refused, and content that may not be redistributed holds only identifiers", async () => {
  await withPackage({ manifest: { licence: " " } }, async (dir) => assert(reasons(await readCatalogPackage(dir, standardKinds())).includes("no licence")));
  await withPackage({ manifest: { sources: [] } }, async (dir) => assert(reasons(await readCatalogPackage(dir, standardKinds())).includes("no source file")));
  await withPackage({ manifest: { sources: [{ url: "https://example.test/x", sha256: "abc" }] } }, async (dir) => assert(reasons(await readCatalogPackage(dir, standardKinds())).includes("not 64 hexadecimal")));
  await withPackage({ manifest: { redistributable: false } }, async (dir) => assert(reasons(await readCatalogPackage(dir, standardKinds())).includes("may not be redistributed")));
  const ids = json({ ...FW, controls: [{ id: "A-1", title: "", statement: "" }] });
  await withPackage({ manifest: { redistributable: false }, files: { "frameworks/ex.json": ids } }, async (dir) => assert((await readCatalogPackage(dir, standardKinds())).kind === "ok"));
});

proves(["0008-grc-catalogs FR-006"], "what a package holds is read by its literals and never executed", async () => {
  const text = json({ ...FW, controls: [{ id: "A-1", title: "${process.exit(1)}", statement: "$(touch /tmp/never); import('x')" }] });
  await withPackage({ files: { "frameworks/ex.json": text } }, async (dir) => {
    const r = await readCatalogPackage(dir, standardKinds());
    assert(r.kind === "ok", reasons(r));
    const fw = r.value.documents[0] as unknown as { controls: { title: string; statement: string }[] };
    assertEquals(fw.controls[0]?.title, "${process.exit(1)}");
    assertEquals(fw.controls[0]?.statement, "$(touch /tmp/never); import('x')");
  });
});
