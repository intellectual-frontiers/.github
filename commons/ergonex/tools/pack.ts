// Spec: 0004-onboarding FR-001
/**
 * The package that is published (commons ergonex 0004-onboarding FR-001, commons 0027-commons-libraries FR-015, FR-016): `bun tools/pack.ts` bundles the command into one file with commons' kernel and runtime
 * inside it, writes the `package.json` that is published (no dependency, the one file as its `bin`, the repository and the folder it is in), and packs them into `dist/ergonex-<version>.tgz`, which is what
 * the publish workflow sends to npm and to the GitHub package registry. The `package.json` of this folder stays private, so that nothing is published from it by hand.
 *
 * ```sh
 * bun tools/pack.ts            build and pack
 * bun tools/pack.ts --stage    build and stage the files and stop before the tarball
 * ```
 *
 * @module
 */
import process from "node:process";
import { fs, path, proc } from "@intellectual-frontiers/commons/ts/runtime";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const STAGE = path.join(ROOT, "dist", "package");

/** The `package.json` that is published, from the one of this folder: what a person who installs it needs and nothing of the repository's own. */
export function publishedManifest(own: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const text = (k: string): string => (typeof own[k] === "string" ? own[k] : "");
  return {
    name: text("name"),
    version: text("version"),
    description: text("description"),
    license: "UNLICENSED",
    type: "module",
    bin: { ergonex: "./ergonex.mjs" },
    engines: { node: ">=26" },
    files: ["ergonex.mjs", "README.md", "CREDITS.md"],
    repository: {
      type: "git",
      url: "git+https://github.com/intellectual-frontiers/.github.git",
      directory: "commons/ergonex",
    },
    homepage: "https://github.com/intellectual-frontiers/.github/tree/main/commons/ergonex",
    bugs: { url: "https://github.com/intellectual-frontiers/.github/issues" },
    keywords: ["workspace", "git", "repositories", "monorepo", "developer-tools"],
    publishConfig: { access: "public" },
  };
}

/** Builds the bundle and stages the package; the folder it staged. */
export async function stage(): Promise<string> {
  await fs.remove(STAGE, { recursive: true }).catch(() => {});
  await fs.mkdir(STAGE, { recursive: true });
  const bun = proc.which("bun") ?? "bun";
  const out = path.join(STAGE, "ergonex.mjs");
  const built = await proc.run([bun, "build", path.join(ROOT, "bin", "main.ts"), "--target=node", "--format=esm", "--outfile", out], {
    cwd: ROOT,
  });
  if (built.code !== 0) throw new Error(`bun build stopped: ${built.stderr || built.stdout}`);
  const bundle = await fs.readTextFile(out);
  await fs.writeTextFile(out, bundle.startsWith("#!") ? bundle : `#!/usr/bin/env node\n${bundle}`);
  await fs.chmod(out, 0o755);
  const own = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as Record<string, unknown>;
  await fs.writeTextFile(path.join(STAGE, "package.json"), `${JSON.stringify(publishedManifest(own), null, 2)}\n`);
  await fs.writeTextFile(
    path.join(STAGE, "README.md"),
    [
      "# Ergonex",
      "",
      "The workspaces management of Intellectual Frontiers: one command, `ergonex`, that sets up and operates a team's repositories, tools and shell on Windows, macOS and Linux.",
      "",
      "```sh",
      "bunx @intellectual-frontiers/ergonex init     # with Bun; with Node 26: npx @intellectual-frontiers/ergonex init",
      "```",
      "",
      "It makes the workspace folder, puts `ergonex` on your path and says what to do next. `ergonex doctor` checks the workspace and says what to fix.",
      "",
      "The sources and the specifications are in https://github.com/intellectual-frontiers/.github/tree/main/commons/ergonex",
      "",
    ].join("\n"),
  );
  await fs.writeTextFile(path.join(STAGE, "CREDITS.md"), await fs.readTextFile(path.join(ROOT, "CREDITS.md")));
  return STAGE;
}

if (import.meta.main) {
  const dir = await stage();
  if (process.argv.includes("--stage")) {
    console.log(`staged ${dir}`);
    process.exit(0);
  }
  const bun = proc.which("bun") ?? "bun";
  const packed = await proc.run([bun, "pm", "pack", "--destination", path.join(ROOT, "dist")], { cwd: dir });
  if (packed.code !== 0) {
    console.error(`bun pm pack stopped: ${packed.stderr || packed.stdout}`);
    process.exit(1);
  }
  console.log(packed.stdout.trim());
}
