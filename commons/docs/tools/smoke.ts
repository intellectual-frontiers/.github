/**
 * IFC Docs installed as a Git dependency and used, as another repository uses it (commons 0011-documentation FR-021, FR-022, SC-003): an
 * empty project that holds the fixture repository (`suite/fixture-repo/`: a package with a documented module and no `about.ts`, and a
 * plain spec kit with a constitution) depends on the repository's root package at one commit by a `git+file:` URL; Bun installs it;
 * `ifc-docs check` (which finds `docs.config.ts` by itself) and `ifc-docs build` run there on Bun and on Node 26, through the package's
 * command, which registers the Node hook itself; the pages are checked, and the two runtimes must write the same bytes; and the
 * configuration is checked by TypeScript 7 against the sources. Any failure, or a runtime that is not on `PATH`, ends with status 1.
 *
 * `bun tools/smoke.ts [--repo DIR] [--commit SHA]`: by default the checkout this file is in, at its `HEAD`; the commit must be committed.
 *
 * @module
 */
import { fs, path, proc } from "../../ts/runtime/mod.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const FIXTURE = path.join(ROOT, "suite/fixture-repo");

/** The pages the fixture's site must have. */
export const PAGES: readonly string[] = [
  "index.html",
  "overview/fixture.html",
  "api/index.html",
  "api/greeting/index.html",
  "api/greeting/mod.html",
  "specs/index.html",
  "specs/matrix.html",
  "specs/constitution.html",
  "specs/001-greeting.html",
  "specs/002-farewell.html",
  "assets/site.css",
  "assets/site.js",
  "assets/mermaid.min.js",
  "search.json",
];

/** The package's name, which the fixture's configuration imports its types by. */
const NAME = "@intellectual-frontiers/commons";

const TSCONFIG = {
  compilerOptions: {
    module: "nodenext",
    target: "es2024",
    strict: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    types: ["node"],
    skipLibCheck: false,
  },
  files: ["docs.config.ts"],
};

/** The value after a flag of the command line, if it is given. */
function option(flag: string): string | undefined {
  const at = proc.args.indexOf(flag);
  return at < 0 ? undefined : proc.args[at + 1];
}

/** Stop with a message and status 1. */
function stop(message: string): never {
  console.error(`smoke: ${message}`);
  return proc.exit(1);
}

/** A folder copied into another, dot folders too. */
function copyTree(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readDirSync(from)) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory) copyTree(a, b);
    else if (e.isFile) fs.writeFileSync(b, fs.readFileSync(a));
  }
}

/** Every file under a folder, from it, sorted. */
function filesOf(dir: string, rel = ""): string[] {
  return [...fs.readDirSync(path.join(dir, rel))]
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap((e) => (e.isDirectory ? filesOf(dir, rel === "" ? e.name : `${rel}/${e.name}`) : [rel === "" ? e.name : `${rel}/${e.name}`]));
}

if (import.meta.main) {
  const bun = proc.runtimeName() === "bun" ? proc.execPath() : proc.which("bun");
  if (bun === undefined) stop("bun is not on PATH");
  const repo = path.resolve(option("--repo") ?? path.join(ROOT, "..", ".."));
  const head = await proc.run(["git", "rev-parse", "HEAD"], { cwd: repo });
  const commit = option("--commit") ?? (head.success ? head.stdout.trim() : stop(`git rev-parse HEAD failed in ${repo}`));
  const url = `git+${path.toFileUrl(repo).href}#${commit}`;
  const node = proc.env.get("IFCDOCS_NODE") ?? proc.which("node");
  const dir = await fs.makeTempDir({ prefix: "ifc-docs-smoke-" });
  let failed = false;
  const fail = (message: string): void => {
    console.error(message);
    failed = true;
  };
  try {
    copyTree(FIXTURE, dir);
    fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
    // @types/node is the repository's own, as FR-010 reads it: the generator's types for Node come from where it runs.
    const types = JSON.parse(fs.readTextFileSync(path.join(ROOT, "package.json"))) as { devDependencies?: Record<string, string> };
    const dependencies = { [NAME]: url, "@types/node": types.devDependencies?.["@types/node"] ?? "" };
    await fs.writeTextFile(path.join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true, type: "module", dependencies }));
    await fs.writeTextFile(path.join(dir, "tsconfig.json"), JSON.stringify(TSCONFIG));
    const install = await proc.run([bun, "install"], { cwd: dir });
    if (!install.success) stop(`bun install ${url} failed:\n${install.stdout}${install.stderr}`);
    if (fs.readTextFileSync(path.join(dir, "bun.lock")).includes(commit)) console.log(`bun.lock holds the commit ${commit}`);
    else fail(`smoke: bun.lock does not hold the commit ${commit}`);
    // The command's own file, as the package's bin names it: the same on every system, where node_modules/.bin holds a shim on Windows.
    const pkg = path.join(dir, "node_modules", ...NAME.split("/"));
    const manifest = JSON.parse(fs.readTextFileSync(path.join(pkg, "package.json"))) as { bin?: Record<string, string> };
    const bin = path.join(pkg, ...(manifest.bin?.["ifc-docs"] ?? "").replace(/^\.\//, "").split("/"));
    const runtimes: readonly (readonly [string, string | undefined])[] = [["bun", bun], ["node", node]];
    const built = new Map<string, string>();
    for (const [name, exe] of runtimes) {
      if (exe === undefined) {
        fail(`smoke: ${name} is not on PATH`);
        continue;
      }
      if (name === "node") {
        const v = await proc.run([exe, "--version"]);
        if (!/^v(2[6-9]|[3-9]\d)\./.test(v.stdout.trim())) fail(`smoke: node is ${v.stdout.trim()}, not 26 or later`);
      }
      const check = await proc.run([exe, bin, "check"], { cwd: dir });
      if (!check.success) fail(`${name}: ifc-docs check failed (${check.code})\n${check.stdout}${check.stderr}`);
      else console.log(`${name}: ifc-docs check: ${check.stderr.trim().split("\n").pop() ?? ""}`);
      const out = path.join(dir, `site-${name}`);
      const build = await proc.run([exe, bin, "build", "--out", out], { cwd: dir });
      if (!build.success) {
        fail(`${name}: ifc-docs build failed (${build.code})\n${build.stdout}${build.stderr}`);
        continue;
      }
      const missing = PAGES.filter((p) => !fs.existsSync(path.join(out, p)));
      if (missing.length > 0) fail(`${name}: the site has no ${missing.join(", ")}`);
      else console.log(`${name}: ifc-docs build: ${filesOf(out).length} files`);
      built.set(name, out);
    }
    const [a, b] = [built.get("bun"), built.get("node")];
    if (a !== undefined && b !== undefined) {
      const fa = filesOf(a);
      const same = fa.join("\n") === filesOf(b).join("\n") && fa.every((f) => fs.readTextFileSync(path.join(a, f)) === fs.readTextFileSync(path.join(b, f)));
      if (same) console.log("bun and node wrote the same bytes");
      else fail("smoke: bun and node wrote different sites");
    }
    const tsc = await proc.run([bun, path.join(dir, "node_modules/typescript/bin/tsc"), "-p", dir], { cwd: dir });
    if (tsc.success) console.log("tsc: the configuration type-checks against the sources");
    else fail(`tsc: failed (${tsc.code})\n${tsc.stdout}${tsc.stderr}`);
  } finally {
    await fs.remove(dir, { recursive: true }).catch(() => {});
  }
  if (failed) proc.exit(1);
}
