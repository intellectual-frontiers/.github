/**
 * The package of IFC Docs, as a release carries it (commons 0011-documentation FR-021): JavaScript and declarations built by TypeScript 7
 * (`tsconfig.build.json`: relative imports rewritten to `.js`, so that Node runs it from `node_modules`, where it strips no types), the
 * theme beside them, its own `package.json` (the entry points and the `bin` built, the same dependencies) and a README made from its
 * `about`, packed by `bun pm pack` into `dist/`, with the tarball's SHA-256 beside it. The lenses, the tests and these tools are left out.
 *
 * `bun tools/pack.ts [--tag ifc-docs-vX.Y.Z]` prints the tarball's path; with `--tag`, it stops unless the tag names `package.json`'s
 * version.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/ifc-ts/runtime";
import { about } from "../about.ts";
import { decodeManifest, type Manifest, packageManifest, tagOf, tarballName } from "./manifest.ts";

/**
 * The README the tarball carries, made from the package's `about` (FR-004): its summary, its command and where its documentation is.
 *
 * @param title - the package's title
 * @param summary - its summary
 * @param version - its version
 */
export function readmeOf(title: string, summary: string, version: string): string {
  return `# ${title} ${version}\n\n${summary}\n\nUsage: \`ifc-docs build [--out DIR] [--config FILE]\` and \`ifc-docs check [--config FILE]\`, ` +
    "with a `docs.config.ts` that exports a `DocsConfig` (`@intellectual-frontiers/ifc-docs/config`).\n\n" +
    "The documentation is at https://intellectual-frontiers.github.io/.github/.\n";
}

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(DIST, "package");

/** Stop with a message and status 1. */
function stop(message: string): never {
  console.error(`pack: ${message}`);
  return proc.exit(1);
}

/** Run a program, and stop where it fails. */
async function step(argv: readonly string[], cwd: string): Promise<string> {
  const r = await proc.run(argv, { cwd });
  if (!r.success) stop(`${argv.join(" ")} failed (${r.code}):\n${r.stdout}${r.stderr}`);
  return r.stdout;
}

if (import.meta.main) {
  const manifest = decodeManifest(await fs.readTextFile(path.join(ROOT, "package.json")));
  if (manifest.kind === "err") stop(manifest.error);
  const m: Manifest = manifest.value;
  const tagAt = proc.args.indexOf("--tag");
  if (tagAt >= 0) {
    const tag = proc.args[tagAt + 1] ?? "";
    if (tag !== tagOf(m.version)) stop(`the tag ${JSON.stringify(tag)} does not name package.json's version ${m.version} (${tagOf(m.version)})`);
  }
  const bun = proc.runtimeName() === "bun" ? proc.execPath() : proc.which("bun");
  if (bun === undefined) stop("bun is not on PATH");
  await fs.remove(DIST, { recursive: true }).catch(() => {});
  await fs.ensureDir(OUT);
  await step([bun, "x", "tsc", "-p", "tsconfig.build.json"], ROOT);
  await fs.ensureDir(path.join(OUT, "theme"));
  for (const f of ["site.css", "site.js"]) await fs.copyFile(path.join(ROOT, "theme", f), path.join(OUT, "theme", f));
  for (const bin of Object.values(m.bin)) await fs.chmod(path.join(OUT, bin.replace(/\.ts$/, ".js")), 0o755);
  await fs.writeTextFile(path.join(OUT, "package.json"), `${JSON.stringify(packageManifest(m), null, 2)}\n`);
  await fs.writeTextFile(path.join(OUT, "README.md"), readmeOf("IFC Docs", about.summary, m.version));
  await step([bun, "pm", "pack", "--destination", DIST, "--quiet"], OUT);
  const tarball = path.join(DIST, tarballName(m));
  const sum = await fs.sha256File(tarball);
  await fs.writeTextFile(`${tarball}.sha256`, `${sum}  ${tarballName(m)}\n`);
  console.log(tarball);
}
