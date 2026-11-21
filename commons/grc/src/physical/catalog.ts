// Spec: 0008-grc-catalogs FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * Reading a catalog package from a folder (0008-grc-catalogs): the manifest (`manifest.json`, a `grc.catalog-package`), then each document it holds through the registry of kinds, after the SHA-256 of its file is checked against the manifest. A package is data and
 * nothing else: a file that is not listed (but a README, a LICENSE or a NOTICE), a file that could run, a path that leaves the folder, a document of a kind or a schema this release does not know, a digest that differs, a document that is not what the manifest says
 * and a crosswalk that names a control a held framework does not have are each refused, naming the file. The package says where its content came from and under what licence, and a package whose content may not be redistributed is held to identifiers and mappings.
 *
 * @example
 * ```ts
 * import { readCatalogPackage } from "./catalog.ts";
 * // const loaded = await readCatalogPackage("./catalog-nist-csf-2/data");
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { catalogPackage, controlUrn, parseControlUrn, readDocument, type CatalogPackage, type Document, type Framework, type Crosswalk, type Kinds } from "@intellectual-frontiers/grc/governance";
import { fs, path } from "@intellectual-frontiers/system";

/** A package read: its manifest and the documents it holds, in the order of the manifest. */
export type LoadedCatalog = { readonly manifest: CatalogPackage; readonly documents: readonly Document[] };

/** Why a package was refused: the file (or the manifest) and the reason. */
export type CatalogProblem = { readonly file: string; readonly reason: string };

const EXECUTABLE = /\.(?:[cm]?[jt]sx?|sh|bash|zsh|ps1|bat|cmd|py|rb|pl|exe|dll|so|dylib|wasm|jar|class)$/i;
const ALLOWED_EXTRA = /^(?:README(?:\.md)?|LICENSE(?:\.md|\.txt)?|NOTICE(?:\.md|\.txt)?)$/i;
const HEX64 = /^[0-9a-f]{64}$/;

async function filesUnder(dir: string, base = dir): Promise<readonly string[]> {
  const out: string[] = [];
  for await (const e of fs.readDir(dir)) {
    const full = path.join(dir, e.name);
    if (e.isDirectory) out.push(...(await filesUnder(full, base)));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out.sort();
}

/** The framework documents among documents, and the crosswalks. */
function frameworksOf(docs: readonly Document[]): readonly Framework[] {
  return docs.filter((d) => d.kind === "grc.framework") as unknown as readonly Framework[];
}

/**
 * Reads a package: the manifest first, then every file it lists; a folder that holds anything else, or whose content does not match its manifest, is refused with every problem found (so that a person fixes the package once).
 */
export async function readCatalogPackage(dir: string, kinds: Kinds): Promise<Result<LoadedCatalog, readonly CatalogProblem[]>> {
  const problems: CatalogProblem[] = [];
  const manifestFile = path.join(dir, "manifest.json");
  if (!(await fs.exists(manifestFile))) return err([{ file: "manifest.json", reason: "the package has no manifest" }]);
  const read = readDocument(kinds, await fs.readTextFile(manifestFile));
  if (read.kind === "err") return err([{ file: "manifest.json", reason: JSON.stringify(read.error) }]);
  if (read.value.kind !== catalogPackage.kind) return err([{ file: "manifest.json", reason: `the manifest is a ${read.value.kind}, and a package needs a ${catalogPackage.kind}` }]);
  const manifest = read.value as unknown as CatalogPackage;

  if (manifest.licence.trim() === "") problems.push({ file: "manifest.json", reason: "the package records no licence" });
  if (manifest.source.publisher.trim() === "" || manifest.source.url.trim() === "" || manifest.source.edition.trim() === "") problems.push({ file: "manifest.json", reason: "the package records no source: the publisher, the edition and the address are needed" });
  if (manifest.sources.length === 0) problems.push({ file: "manifest.json", reason: "the package records no source file with its SHA-256, so a change of the source cannot be found" });
  for (const s of manifest.sources) if (!HEX64.test(s.sha256)) problems.push({ file: "manifest.json", reason: `the SHA-256 of the source ${s.url} is not 64 hexadecimal digits` });

  const listed = new Set<string>(["manifest.json"]);
  const docs: Document[] = [];
  for (const h of manifest.holds) {
    listed.add(h.file);
    if (h.file.startsWith("/") || h.file.split("/").some((p) => p === ".." || p === "") || h.file.includes("\\")) {
      problems.push({ file: h.file, reason: "the path is not a relative path inside the package" });
      continue;
    }
    if (EXECUTABLE.test(h.file)) {
      problems.push({ file: h.file, reason: "a package holds no code and no executable input" });
      continue;
    }
    const full = path.join(dir, h.file);
    if (!(await fs.exists(full))) {
      problems.push({ file: h.file, reason: "the file the manifest lists is not there" });
      continue;
    }
    const bytes = await fs.readFile(full);
    const digest = await sha256(bytes);
    if (digest !== h.digest) {
      problems.push({ file: h.file, reason: `the SHA-256 is ${digest}, and the manifest says ${h.digest}` });
      continue;
    }
    const doc = readDocument(kinds, new TextDecoder().decode(bytes));
    if (doc.kind === "err") {
      problems.push({ file: h.file, reason: `the document is not read: ${JSON.stringify(doc.error)}` });
      continue;
    }
    if (doc.value.kind !== h.kind || doc.value.id !== h.id) {
      problems.push({ file: h.file, reason: `the document is ${doc.value.kind} ${doc.value.id}, and the manifest says ${h.kind} ${h.id}` });
      continue;
    }
    docs.push(doc.value);
  }
  for (const file of await filesUnder(dir)) {
    if (listed.has(file) || ALLOWED_EXTRA.test(path.basename(file)) && !file.includes("/")) continue;
    problems.push({ file, reason: EXECUTABLE.test(file) ? "a package holds no code and no executable input" : "the file is not listed in the manifest" });
  }

  // a crosswalk may name a framework the package does not hold, but not a control a held framework does not have
  const frameworks = frameworksOf(docs);
  const held = new Map(frameworks.map((f) => [`${f.id}:${f.version}`, new Set(f.controls.map((c) => c.id))]));
  for (const d of docs.filter((x) => x.kind === "grc.crosswalk") as unknown as readonly Crosswalk[]) {
    for (const m of d.mappings) {
      for (const urn of [m.from, m.to]) {
        const ref = parseControlUrn(urn);
        if (ref.kind === "err") {
          problems.push({ file: d.id, reason: ref.error });
          continue;
        }
        const controls = held.get(`${ref.value.framework}:${ref.value.version}`);
        if (controls !== undefined && !controls.has(ref.value.control)) problems.push({ file: d.id, reason: `${urn} is a control that the held framework ${ref.value.framework} ${ref.value.version} does not have` });
      }
    }
  }
  for (const f of frameworks) {
    const ids = f.controls.map((c) => c.id);
    if (new Set(ids).size !== ids.length) problems.push({ file: f.id, reason: "a control of the framework is held twice" });
    if (!manifest.redistributable) for (const c of f.controls) if (c.statement !== "" || c.title !== "") problems.push({ file: f.id, reason: `the content of this package may not be redistributed, and ${c.id} has a title or a statement: only identifiers and mappings` });
  }
  return problems.length > 0 ? err(problems) : ok({ manifest, documents: docs });
}

/** The URNs of the controls of a loaded package's frameworks. */
export function catalogControlUrns(loaded: LoadedCatalog): readonly string[] {
  return frameworksOf(loaded.documents).flatMap((f) => f.controls.map((c) => controlUrn(f.id, f.version, c.id)));
}
