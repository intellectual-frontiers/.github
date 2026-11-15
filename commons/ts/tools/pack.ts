/**
 * The package of IFC TypeScript, as a release carries it (commons 0005-typescript-runtime FR-029): JavaScript and declarations built by
 * TypeScript 7 from `kernel/` and `runtime/` (relative imports rewritten to `.js`, so Node runs it from `node_modules`, where it strips no
 * types), its own `package.json` with the three entry points, packed by `bun pm pack` into `dist/`, with the tarball's SHA-256 beside it.
 *
 * `bun tools/pack.ts [--tag ifc-ts-vX.Y.Z]` prints the tarball's path; with `--tag`, it stops unless the tag names `package.json`'s version.
 *
 * @module
 */
import { about } from "../about.ts";
import { decodeManifest, type Manifest, packageManifest, tarballName } from "./manifest.ts";
import { ensureDir, readTextFile, remove, sha256File, writeTextFile } from "../runtime/fs.ts";
import { dirname, fromFileUrl, join, resolve } from "../runtime/path.ts";
import { args, execPath, exit, run, runtimeName, which } from "../runtime/proc.ts";

/** The README the tarball carries, made from the package's `about` (commons 0011-documentation FR-004): its summary and where its documentation is. */
export function readmeOf(title: string, summary: string, version: string): string {
  return `# ${title} ${version}\n\n${summary}\n\nThe documentation is at https://intellectual-frontiers.github.io/.github/.\n`;
}

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const OUT = join(DIST, "package");

/** Stop with a message and status 1. */
function stop(message: string): never {
  console.error(`pack: ${message}`);
  return exit(1);
}

/** Run a program in front of the person, and stop where it fails. */
async function step(argv: readonly string[], cwd: string): Promise<string> {
  const r = await run(argv, { cwd });
  if (!r.success) stop(`${argv.join(" ")} failed (${r.code}):\n${r.stdout}${r.stderr}`);
  return r.stdout;
}

const manifest = decodeManifest(await readTextFile(join(ROOT, "package.json")));
if (manifest.kind === "err") stop(manifest.error);
const m: Manifest = manifest.value;

const tagAt = args.indexOf("--tag");
if (tagAt >= 0) {
  const tag = args[tagAt + 1] ?? "";
  if (tag !== `ifc-ts-v${m.version}`)
    stop(`the tag ${JSON.stringify(tag)} does not name package.json's version ${m.version} (ifc-ts-v${m.version})`);
}

const bun = runtimeName() === "bun" ? execPath() : which("bun");
if (bun === undefined) stop("bun is not on PATH");

await remove(DIST, { recursive: true }).catch(() => {});
await ensureDir(OUT);
await step([bun, "x", "tsc", "-p", "tsconfig.build.json"], ROOT);
await writeTextFile(join(OUT, "package.json"), `${JSON.stringify(packageManifest(m), null, 2)}\n`);
await writeTextFile(join(OUT, "README.md"), readmeOf(about.title, about.summary, m.version));
await step([bun, "pm", "pack", "--destination", DIST, "--quiet"], OUT);
const tarball = join(DIST, tarballName(m));
const sum = await sha256File(tarball);
await writeTextFile(`${tarball}.sha256`, `${sum}  ${tarballName(m)}\n`);
console.log(tarball);
