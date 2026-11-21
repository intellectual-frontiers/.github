/**
 * The generator and the packer of the metapackages (commons 0036-distribution FR-007, FR-008): the file of each set that records its exact dependencies, and the tarball of its package.
 *
 *     bun commons/libraries/src/pack-metapackage.ts            write the file `dependencies.auto.json` of every metapackage again from the manifests
 *     bun commons/libraries/src/pack-metapackage.ts --check    write nothing and exit 1 where a file is not what the manifests make
 *     bun tools/pack.ts [--check]                              (in the folder of a metapackage) stage, inspect and pack its package
 *     other flags: --repo DIR (the repository, the working folder by default)
 *
 * @remarks
 * A metapackage is a folder `commons/<set>/` whose manifest names `bundle`; the folder holds the manifest, a private `package.json`, the `LICENSE` and `tools/pack.ts`, and nothing that is code. Its members come from the manifests
 * ({@link membersOf}) and are written to `dependencies.auto.json` in its folder, so that a change of the set is a change of the folder, which the release sees. The packer writes the staged package (`package.json` with the
 * exact dependencies, an empty `index.js` and its declaration, the README, the `LICENSE`), inspects it with the same inspection as every library's and packs it with `bun pm pack`.
 *
 * @limits
 * It writes the files named above and runs `bun pm pack`; it asks no registry.
 *
 * @example
 * ```ts
 * import { synchronize } from "./pack-metapackage.ts";
 * synchronize(".", false).problems; // []
 * ```
 *
 * Spec: 0001-libraries FR-023
 *
 * @module
 */
import process from "node:process";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { stdio } from "@intellectual-frontiers/system";
import { existsSync, mkdirSync, readTextFileSync, removeSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join, resolve } from "@intellectual-frontiers/system/path";
import { env, run, which } from "@intellectual-frontiers/system/proc";
import { activeMode, type DistributionMode, MODE_VARIABLE } from "./distribution.ts";
import { decodeLibrarySource, type Library, LIBRARY_FILE, readLibraries } from "./libraries.ts";
import { licenseOf } from "./license.ts";
import { ENTRY_DTS, ENTRY_JS, membersOf, publishedManifest, readmeOf, readSetFile, SET_FILE, setFileText } from "./metapackages.ts";
import { inspectPackage, tarballName } from "./pack-library.ts";

/** The metapackages of a repository: the libraries whose manifest names a set. */
export function metapackagesOf(repo: string): readonly (Library & { readonly bundle: NonNullable<Library["bundle"]> })[] {
  return readLibraries(repo).flatMap((f) => {
    if (!("library" in f)) return [];
    const l = f.library;
    return l.bundle === undefined ? [] : [{ ...l, bundle: l.bundle }];
  });
}

/** The files that are not what the manifests make (from the repository's root), and what is wrong with reading them; with `write`, the files are written. */
export function synchronize(repo: string, write: boolean, mode?: DistributionMode): { readonly stale: readonly string[]; readonly problems: readonly string[] } {
  const root = repo.replace(/[\\/]$/, "");
  const active = mode ?? (() => { const m = activeMode(env.get(MODE_VARIABLE)); return m.kind === "ok" ? m.value : undefined; })();
  if (active === undefined) return { stale: [], problems: [`${MODE_VARIABLE} is not a distribution mode`] };
  if (active === "single") {
    // the metapackages are not built in single mode (0036-distribution FR-020): a file of a set that is there is what no manifest makes
    const left = metapackagesOf(root).map((m) => `commons/${m.name}/${SET_FILE}`).filter((p) => existsSync(join(root, p)));
    if (write) for (const p of left) removeSync(join(root, p));
    return { stale: left, problems: [] };
  }
  const libraries = readLibraries(root).flatMap((f) => ("library" in f ? [f.library] : []));
  const stale: string[] = [];
  const problems: string[] = [];
  for (const m of metapackagesOf(root)) {
    const members = membersOf(m.bundle, libraries);
    if (members.kind === "err") {
      problems.push(members.error);
      continue;
    }
    const path = `commons/${m.name}/${SET_FILE}`;
    const file = join(root, path);
    const want = setFileText(m.bundle, members.value);
    if (existsSync(file) && readTextFileSync(file) === want) continue;
    stale.push(path);
    if (write) writeTextFileSync(file, want);
  }
  return { stale, problems };
}

/** What packing a metapackage gave: the staged folder, the tarball where nothing was wrong, and what was wrong. */
export type PackedSet = { readonly stage: string; readonly tarball: string | undefined; readonly findings: readonly string[] };

/** The manifest of the metapackage at `root`, or why it is none. */
function manifestAt(root: string): Result<Library, string> {
  const file = join(root, LIBRARY_FILE);
  if (!existsSync(file)) return err(`${file} is missing`);
  const r = decodeLibrarySource(readTextFileSync(file));
  if (r.kind === "err") return err(r.error);
  return r.value.bundle === undefined ? err(`${file} names no bundle: it is not a metapackage`) : ok(r.value);
}

/** Stages, inspects and packs the metapackage in the folder `root` (`commons/<set>/`). */
export async function packMetapackage(root: string): Promise<PackedSet> {
  const own = manifestAt(root);
  const dist = join(root, "dist");
  const stage = join(dist, "package");
  if (own.kind === "err") return { stage, tarball: undefined, findings: [own.error] };
  const l = own.value;
  const bundle = l.bundle;
  if (bundle === undefined) return { stage, tarball: undefined, findings: [`${l.name} names no bundle`] };
  const setFile = join(root, SET_FILE);
  if (!existsSync(setFile)) return { stage, tarball: undefined, findings: [`${SET_FILE} is missing: run bun commons/libraries/src/pack-metapackage.ts`] };
  const deps = readSetFile(readTextFileSync(setFile));
  if (deps.kind === "err") return { stage, tarball: undefined, findings: [deps.error] };
  if (existsSync(dist)) removeSync(dist, { recursive: true });
  mkdirSync(stage, { recursive: true });
  const members = Object.entries(deps.value).map(([pkg, version]) => ({ library: pkg.slice(pkg.indexOf("/") + 1), package: pkg, version }));
  const manifest = publishedManifest(bundle, l.version, deps.value, licenseOf(l));
  writeTextFileSync(join(stage, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeTextFileSync(join(stage, "index.js"), ENTRY_JS);
  writeTextFileSync(join(stage, "index.d.ts"), ENTRY_DTS);
  writeTextFileSync(join(stage, "README.md"), readmeOf(bundle, members));
  const findings: string[] = [];
  if (existsSync(join(root, "LICENSE"))) writeTextFileSync(join(stage, "LICENSE"), readTextFileSync(join(root, "LICENSE")));
  else findings.push(`commons/${l.name} has no LICENSE; run: bun commons/libraries/src/license.ts`);
  if (Object.keys(deps.value).length === 0) findings.push(`${l.name}: the set has no member`);
  findings.push(...inspectPackage(stage));
  if (findings.length > 0) return { stage, tarball: undefined, findings };
  const packed = await run([which("bun") ?? "bun", "pm", "pack", "--destination", dist], { cwd: stage });
  if (packed.code !== 0) return { stage, tarball: undefined, findings: [`bun pm pack stopped: ${packed.stderr || packed.stdout}`.trim()] };
  return { stage, tarball: join(dist, tarballName(`@intellectual-frontiers/${bundle}`, l.version)), findings: [] };
}

/** The command line of a metapackage's `tools/pack.ts`: pack, print what was found (or the tarball) and the exit status. */
export async function main(root: string, argv: readonly string[]): Promise<number> {
  const mode = activeMode(env.get(MODE_VARIABLE));
  if (mode.kind === "err") {
    stdio.stderr.writeSync(`${mode.error}\n`);
    return 2;
  }
  if (mode.value === "single") {
    stdio.stderr.writeSync(`the distribution is single: a metapackage is not packed (${MODE_VARIABLE}=per-library packs it)\n`);
    return argv.includes("--check") ? 0 : 1;
  }
  if (argv.includes("--check") && (env.get("IFC_SKIP_PACK") ?? "") !== "") {
    stdio.stdout.writeSync("pack check skipped: the set did not change in this push (IFC_SKIP_PACK); the release packs it\n");
    return 0;
  }
  const r = await packMetapackage(root);
  for (const f of r.findings) stdio.stderr.writeSync(`${f}\n`);
  if (r.tarball === undefined) return 1;
  stdio.stdout.writeSync(`${argv.includes("--check") ? `packed ${r.tarball}: nothing wrong` : r.tarball}\n`);
  return 0;
}

/** The command line of the generator: 0, or 1 where a file is not what the manifests make (with `--check`) or a manifest is wrong. */
export function generate(argv: readonly string[]): number {
  const at = argv.indexOf("--repo");
  const repo = at >= 0 ? resolve(argv[at + 1] ?? ".") : resolve(".");
  const check = argv.includes("--check");
  const r = synchronize(repo, !check);
  for (const p of r.problems) stdio.stderr.writeSync(`${p}\n`);
  for (const s of r.stale) stdio.stderr.writeSync(check ? `${s} is not what the manifests make; run: bun commons/libraries/src/pack-metapackage.ts\n` : `wrote ${s}\n`);
  return r.problems.length > 0 || (check && r.stale.length > 0) ? 1 : 0;
}

if (import.meta.main) process.exitCode = generate(process.argv.slice(2));
