// Spec: 0002-dossier-core FR-010, FR-011
/**
 * The files of a dossier (0046-dossiers FR-061, FR-062, FR-121): writing a built dossier under a folder (every file whole or not at all, none outside the folder), reading it back, and the offline verify: each rendition's hash against the manifest, and where the sources are carried and the lenses are
 * given, a rebuild that must give the same bytes. It reaches no network and reads no clock.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { Built, Declaration, Manifest, Source } from "@intellectual-frontiers/dossier/governance";
import { build, manifestText, type Registry, withRendition } from "@intellectual-frontiers/dossier/logical";
import { canonicalize } from "@intellectual-frontiers/grc/logical";
import { fs, path } from "@intellectual-frontiers/system";

/** The names a folder of a dossier holds. */
export const FILES = { adoc: "dossier.adoc", manifest: "manifest.json", declaration: "declaration.json", sources: "sources" } as const;

/** The file name of a source: its id with the slashes written as double underscores. */
export const sourceFile = (id: string): string => `${id.replaceAll("/", "__")}.json`;

/** What is written besides the AsciiDoc and the manifest. */
export interface WriteOptions {
  /** Carry the sources, so that a stranger can rebuild (0046-dossiers FR-062). */
  readonly carrySources?: boolean;
  /** Renditions made from the AsciiDoc, by file name: their hashes are put in the manifest. */
  readonly renditions?: ReadonlyMap<string, Uint8Array>;
}

const inside = (root: string, p: string): boolean => {
  const rel = path.relative(root, p);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
};

/** Write a dossier under a folder: the AsciiDoc, the manifest (with the hash of each rendition), the declaration, and the sources where they are carried. Each file is written to a name of its own and then renamed, so a failure leaves none of the new files; a path that leaves the folder is refused. */
export async function writeDossier(root: string, b: Built, o: WriteOptions = {}): Promise<Result<Manifest, string>> {
  let manifest = b.manifest;
  const files = new Map<string, Uint8Array>([[FILES.adoc, new TextEncoder().encode(b.adoc)]]);
  for (const [name, bytes] of o.renditions ?? []) {
    files.set(name, bytes);
    manifest = withRendition(manifest, name, await sha256(bytes));
  }
  files.set(FILES.manifest, new TextEncoder().encode(manifestText(manifest)));
  files.set(FILES.declaration, new TextEncoder().encode(`${canonicalize(b.declaration)}\n`));
  if (o.carrySources === true) for (const s of b.sources) files.set(`${FILES.sources}/${sourceFile(s.id)}`, new TextEncoder().encode(`${canonicalize(s)}\n`));
  const target = path.resolve(root);
  for (const name of files.keys()) if (!inside(target, path.resolve(target, name))) return err(`${name} is outside the folder of the dossier`);
  const done: string[] = [];
  try {
    for (const [name, bytes] of files) {
      const to = path.resolve(target, name);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.writeFile(`${to}.part`, bytes);
      done.push(to);
    }
    for (const to of done) await fs.rename(`${to}.part`, to);
  } catch (e) {
    for (const to of done) await fs.remove(`${to}.part`).catch(() => undefined);
    return err(`the dossier was not written: ${e instanceof Error ? e.message : String(e)}`);
  }
  return ok(manifest);
}

/** What the offline verify found. */
export interface Verdict {
  readonly ok: boolean;
  readonly reasons: readonly string[];
  /** Whether the AsciiDoc was rebuilt from the carried sources and was the same bytes. */
  readonly rebuilt: "same" | "different" | "not possible";
}

/** The offline verify of a folder of a dossier (0046-dossiers FR-061): each rendition against the hash in the manifest, and a rebuild where the sources are carried and the lenses are given. It says which it could not do. */
export async function verifyFolder(root: string, registry?: Registry): Promise<Verdict> {
  const reasons: string[] = [];
  let manifest: Manifest;
  try {
    manifest = JSON.parse(await fs.readTextFile(path.join(root, FILES.manifest))) as Manifest;
  } catch (e) {
    return { ok: false, reasons: [`the manifest cannot be read: ${e instanceof Error ? e.message : String(e)}`], rebuilt: "not possible" };
  }
  for (const [name, want] of Object.entries(manifest.renditions)) {
    try {
      const got = await sha256(await fs.readFile(path.join(root, name)));
      if (got !== want) reasons.push(`${name} is not what the manifest holds (${got} now, ${want} then)`);
    } catch {
      reasons.push(`${name} is missing`);
    }
  }
  let rebuilt: Verdict["rebuilt"] = "not possible";
  const carried: Source[] = [];
  try {
    for await (const e of fs.readDir(path.join(root, FILES.sources))) if (e.isFile) carried.push(JSON.parse(await fs.readTextFile(path.join(root, FILES.sources, e.name))) as Source);
  } catch {
    /* no sources are carried */
  }
  if (carried.length > 0 && registry !== undefined) {
    try {
      const decl = JSON.parse(await fs.readTextFile(path.join(root, FILES.declaration))) as Declaration;
      const again = await build(decl, registry, carried);
      if (again.kind === "err") reasons.push(`the rebuild failed: ${again.error.message}`);
      else {
        const same = again.value.adoc === (await fs.readTextFile(path.join(root, FILES.adoc)));
        rebuilt = same ? "same" : "different";
        if (!same) reasons.push("the rebuild from the carried sources gives other AsciiDoc than the file");
      }
    } catch (e) {
      reasons.push(`the rebuild could not be tried: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (carried.length === 0) reasons.push("the sources are not carried, so the rebuild is not possible");
  return { ok: reasons.filter((r) => !r.startsWith("the sources are not carried")).length === 0, reasons, rebuilt };
}
