// Spec: 0046-arcactl FR-011
/**
 * The package that is published from this library (commons data 0046-arcactl FR-011, commons 0027-commons-libraries FR-015, FR-016): `@intellectual-frontiers/arcactl`, a build target of the sources in
 * `sql/cli/` and not a folder of its own. `bun tools/pack.ts` bundles the command into one file for Node and Bun with the kernel, the runtime and this library inside it, writes the `package.json` that
 * is published (the one file as its `bin`, `pg` as an optional dependency for Node, the version of this library), and packs them into `dist/*.tgz`, which the publish workflow of this library sends to
 * npm and to the GitHub package registry. The `package.json` of this folder stays private, so that nothing is published from it by hand, and the library itself is not published.
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

/** The name the package is published under. */
export const PACKAGE = "@intellectual-frontiers/arcactl";

/** The `package.json` that is published, from the one of this folder: what a person who installs it needs and nothing of the repository's own. */
export function publishedManifest(own: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const text = (k: string): string => (typeof own[k] === "string" ? own[k] : "");
  const dev = (own["devDependencies"] ?? {}) as Readonly<Record<string, string>>;
  return {
    name: PACKAGE,
    version: text("version"),
    description: "arcactl: check, set up and maintain the arca data models in PostgreSQL, from a terminal or a pipeline.",
    license: "MIT",
    type: "module",
    bin: { arcactl: "./arcactl.mjs" },
    engines: { node: ">=22" },
    files: ["arcactl.mjs", "README.md", "LICENSE"],
    // `pg` is what Node talks to PostgreSQL with; Bun has its own client built in and never loads it
    optionalDependencies: { pg: `^${(dev["pg"] ?? "8").replace(/^[^\d]*/, "")}` },
    repository: { type: "git", url: "git+https://github.com/intellectual-frontiers/.github.git", directory: "commons/data" },
    homepage: "https://github.com/intellectual-frontiers/.github/tree/main/commons/data",
    bugs: { url: "https://github.com/intellectual-frontiers/.github/issues" },
    keywords: ["postgresql", "postgres", "psql", "cli", "migrations", "data-model", "doctor"],
    publishConfig: { access: "public" },
  };
}

/** The README that is published. */
export const readme = (): string =>
  [
    "# arcactl",
    "",
    "Check, set up and maintain the arca data models in PostgreSQL, from a terminal or a pipeline.",
    "",
    "```sh",
    "bunx @intellectual-frontiers/arcactl doctor --models identityAgent     # with Bun",
    "npx @intellectual-frontiers/arcactl doctor --models identityAgent      # with Node 22 or later",
    "eval \"$(arcactl shell)\"                                               # bash, zsh; fish, PowerShell and nushell too",
    "```",
    "",
    "- `arcactl doctor` is read-only: it checks a database against the models and says what has drifted or been weakened, with an exit code a pipeline can use.",
    "- `arcactl shell` prints the script a shell sources: the `ARCA_*`, `PGSERVICE` and `PGOPTIONS` setup, a few functions and completions. It holds no password and connects to nothing.",
    "- The connection comes from `ARCA_DATABASE_URL` (or `ARCA_DATABASE_URL_FILE`), or from libpq's own environment and files, as `psql` does. A password is never an option and is never printed.",
    "- On Bun it uses Bun's own PostgreSQL client. On Node it uses `pg`, which is installed with it where optional dependencies are.",
    "",
    "The sources and the specifications are in https://github.com/intellectual-frontiers/.github/tree/main/commons/data",
    "",
  ].join("\n");

/** Builds the bundle and stages the package; the folder it staged. */
export async function stage(): Promise<string> {
  await fs.remove(STAGE, { recursive: true }).catch(() => {});
  await fs.mkdir(STAGE, { recursive: true });
  const bun = proc.which("bun") ?? "bun";
  const out = path.join(STAGE, "arcactl.mjs");
  const built = await proc.run([bun, "build", path.join(ROOT, "sql", "cli", "arcactl.ts"), "--target=node", "--format=esm", "--external", "pg", "--outfile", out], { cwd: ROOT });
  if (built.code !== 0) throw new Error(`bun build stopped: ${built.stderr || built.stdout}`);
  const bundle = await fs.readTextFile(out);
  // the file starts from the shebang of Node, which `bunx` runs with Bun
  await fs.writeTextFile(out, `#!/usr/bin/env node\n${bundle.replace(/^#!.*\n/, "")}`);
  await fs.chmod(out, 0o755);
  const own = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as Record<string, unknown>;
  await fs.writeTextFile(path.join(STAGE, "package.json"), `${JSON.stringify(publishedManifest(own), null, 2)}\n`);
  await fs.writeTextFile(path.join(STAGE, "README.md"), readme());
  await fs.writeTextFile(path.join(STAGE, "LICENSE"), await fs.readTextFile(path.join(ROOT, "LICENSE")));
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
