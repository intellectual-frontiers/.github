/**
 * The package of a library of commons (commons 0032-libraries-by-concern FR-005, FR-013): the library's sources compiled by the TypeScript 7 compiler into ECMAScript modules and their declarations, the
 * `package.json` that is published (each `exports` entry naming its `types`, the source for Bun and the compiled file for everything else), and the tarball. The same inspection that the packer makes before it
 * packs is `inspectPackage`, which a test runs again on the tarball it unpacks.
 *
 *     bun tools/pack.ts            of a library: pack `dist/<scope>-<name>-<version>.tgz`
 *     bun tools/pack.ts --check    the same, and print what was found; exit 1 where anything was
 *
 * @remarks
 * A library's own `package.json` stays private and names its entries by their sources (`"./src/mod.ts"`); nothing is published from it by hand. A library that depends on another library of commons imports it by package
 * name, and the published package depends on it at the version that library has in this repository. The declarations are written with `.js` specifiers (the compiler leaves `.ts` in a `.d.ts`, which a consumer's
 * compiler cannot read), and only the declarations that the entries reach are published in a bundle. A package is refused where an entry has no declaration, where a declaration reached imports a file that is not in
 * the package or a package that is not a dependency, or where the code imports a package that is not on npm.
 *
 * A package that is also a command, or whose code imports what is not yet on npm, is packed with `bundle`: each entry's code and the command's are one bundle (`bun build`), the declarations are emitted from the
 * sources and only those the entries reach are published, and whatever they import must be a package of npm that the package depends on.
 *
 * @limits
 * It builds a library whose sources are under `src/`, one tarball with one `exports` map.
 *
 * Spec: 0001-libraries FR-007
 *
 * @module
 */
import { chmod, readTextFile, writeTextFile } from "@intellectual-frontiers/system/fs";
import { existsSync, mkdirSync, readDirSync, readTextFileSync, removeSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { decodeLibrarySource, type Library, LIBRARY_FILE } from "./libraries.ts";
import { COMMAND as LICENSE_COMMAND, licenseOf } from "./license.ts";
import { basename, dirname, join, relative, resolve, toPosix } from "@intellectual-frontiers/system/path";
import { env, run, which } from "@intellectual-frontiers/system/proc";

/** The scope of the packages of commons. */
export const SCOPE = "@intellectual-frontiers";

/** What is wrong with a package, one sentence each. */
export type Findings = readonly string[];

type Json = Readonly<Record<string, unknown>>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === "string" ? v : "");
/** A text file copied: every file of a package is text. */
const copyFileSync = (from: string, to: string): void => writeTextFileSync(to, readTextFileSync(from));
const noDot = (p: string): string => toPosix(p).replace(/^\.\//, "");

/** The files under a folder, from the folder, in order (`node_modules` is not looked into). */
export function filesUnder(root: string, dir = ""): readonly string[] {
  const out: string[] = [];
  for (const e of readDirSync(join(root, dir)).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.name === "node_modules") continue;
    const rel = dir === "" ? e.name : `${dir}/${e.name}`;
    if (e.isDirectory) out.push(...filesUnder(root, rel));
    else if (e.isFile) out.push(rel);
  }
  return out;
}

const SPECIFIER = /(?:\bfrom\s+|\bimport\s+|\bimport\(\s*)["']([^"']+)["']/g;

/** The documentation blocks of a source (a block comment that begins a line): an example in one names what a reader may write, not what the module imports. */
const DOC_BLOCK = /^[ \t]*\/\*[\s\S]*?\*\//gm;

/** The specifiers a source names, outside its documentation blocks. */
export const specifiersOf = (source: string): readonly string[] =>
  [...source.replace(DOC_BLOCK, "").matchAll(SPECIFIER)].map((m) => m[1] ?? "").filter((s) => s !== "");

/** The package a bare specifier names (`@scope/name/sub` is `@scope/name`), or undefined for a relative path, a `node:` builtin or a `data:` URL. */
export function packageOf(specifier: string): string | undefined {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("node:") || specifier.startsWith("data:"))
    return undefined;
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** The target of an export entry for each condition: the string, or the `types`, `bun` or `default` of an object. */
function targetsOf(entry: unknown): Readonly<Record<string, string>> {
  if (typeof entry === "string") return { default: entry };
  if (!isObject(entry)) return {};
  return Object.fromEntries(Object.entries(entry).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as const] : [])));
}

/** The declaration file that a relative specifier of a declaration names, from the package's root: `./x.js` is `x.d.ts`. */
function declarationFor(from: string, specifier: string): string {
  const base = toPosix(join(dirname(from), specifier));
  return base.replace(/\.(?:js|ts|mjs)$/, "") + ".d.ts";
}

/** The declarations that the entries of a package reach, by relative imports from the `types` of each entry, and what is wrong on the way (a declaration that is not there). */
export function reachableDeclarations(
  stage: string,
  manifest: Json,
): { readonly reached: ReadonlySet<string>; readonly findings: Findings } {
  const found: string[] = [];
  const name = text(manifest["name"]);
  const files = new Set(filesUnder(stage));
  const entries: string[] = [];
  for (const [key, entry] of Object.entries(isObject(manifest["exports"]) ? manifest["exports"] : {})) {
    const types = targetsOf(entry)["types"];
    if (types === undefined) found.push(`${name}: the export ${key} names no \`types\` file`);
    else if (!files.has(noDot(types))) found.push(`${name}: the export ${key} names ${types}, which is not in the package`);
    else entries.push(noDot(types));
  }
  if (typeof manifest["types"] === "string" && !files.has(noDot(manifest["types"])))
    found.push(`${name}: types names ${manifest["types"]}, which is not in the package`);
  const reached = new Set<string>();
  const todo = [...entries];
  while (todo.length > 0) {
    const d = todo.pop() ?? "";
    if (reached.has(d)) continue;
    reached.add(d);
    for (const s of specifiersOf(readTextFileSync(join(stage, d)))) {
      if (!s.startsWith(".")) continue;
      const next = declarationFor(d, s);
      if (!files.has(next)) found.push(`${d} imports ${s}, whose declaration ${next} is not in the package`);
      else todo.push(next);
    }
  }
  return { reached, findings: found };
}

/** What is wrong with the package staged in a folder (the files of the tarball, `package/` unpacked): see the remarks of this module. */
export function inspectPackage(stage: string): Findings {
  const found: string[] = [];
  const manifestFile = join(stage, "package.json");
  if (!existsSync(manifestFile)) return ["package.json is not in the package"];
  const manifest = JSON.parse(readTextFileSync(manifestFile)) as Json;
  const name = text(manifest["name"]);
  const files = new Set(filesUnder(stage));
  const declared = new Set<string>([
    ...Object.keys(isObject(manifest["dependencies"]) ? manifest["dependencies"] : {}),
    ...Object.keys(isObject(manifest["peerDependencies"]) ? manifest["peerDependencies"] : {}),
    ...Object.keys(isObject(manifest["optionalDependencies"]) ? manifest["optionalDependencies"] : {}),
  ]);
  const exportsMap = isObject(manifest["exports"]) ? manifest["exports"] : {};
  const bin = isObject(manifest["bin"]) ? manifest["bin"] : {};
  if (Object.keys(exportsMap).length === 0 && Object.keys(bin).length === 0) found.push(`${name}: the package has no exports and no bin`);
  for (const [cmd, target] of Object.entries(bin))
    if (typeof target !== "string" || !files.has(noDot(target)))
      found.push(`${name}: the command ${cmd} names ${String(target)}, which is not in the package`);
  // every entry has declarations and the files its conditions name
  for (const [key, entry] of Object.entries(exportsMap)) {
    for (const [cond, target] of Object.entries(targetsOf(entry))) {
      if (cond !== "types" && !files.has(noDot(target)))
        found.push(`${name}: the export ${key} (${cond}) names ${target}, which is not in the package`);
    }
  }
  // the declarations that the entries reach: each import is a file of the package or a package the manifest depends on
  const { reached, findings } = reachableDeclarations(stage, manifest);
  found.push(...findings);
  for (const d of reached) {
    for (const s of specifiersOf(readTextFileSync(join(stage, d)))) {
      const pkg = packageOf(s);
      if (pkg === undefined) continue;
      if (pkg === `${SCOPE}/commons`) found.push(`${d} imports ${s}: the package ${pkg} is a metapackage with no code: import the library that holds what is used`);
      else if (pkg !== name && !declared.has(pkg)) found.push(`${d} imports ${pkg}, which is not a dependency of ${name}`);
    }
  }
  // the compiled code of a library (files under dist/ other than bundles) imports no package that is not a dependency, and none that is not on npm; a declaration never imports a `.ts` path
  for (const f of files) {
    if (!/\.(?:js|mjs|d\.ts)$/.test(f) || !f.startsWith("dist/")) continue;
    const source = readTextFileSync(join(stage, f));
    if (/\.d\.ts$/.test(f)) {
      if (/(?:from\s+|import\(\s*)["']\.[^"']*\.ts["']/.test(source))
        found.push(`${f} imports a \`.ts\` path, which a consumer's compiler cannot read`);
      continue;
    }
    if (isBundle(source)) continue;
    for (const s of specifiersOf(source)) {
      const pkg = packageOf(s);
      if (pkg === undefined) continue;
      if (pkg === `${SCOPE}/commons`) found.push(`${f} imports ${s}: the package ${pkg} is a metapackage with no code: import the library that holds what is used`);
      else if (pkg !== name && !declared.has(pkg)) found.push(`${f} imports ${pkg}, which is not a dependency of ${name}`);
    }
  }
  return found;
}

/** Whether a compiled file is a bundle (`bun build` marks its output): its imports are what it holds, so it is not read for them. */
const isBundle = (source: string): boolean =>
  /^\/\/ @bun\b|^\/\/ @bun\s*$/m.test(source.slice(0, 400)) || source.startsWith("#!") || /\/\/ \.\.\/\.\.\//.test(source.slice(0, 2000));

/** Writes the declarations with `.js` in the place of `.ts` in their relative specifiers. */
export function rewriteDeclarationSpecifiers(source: string): string {
  return source.replace(/((?:from\s+|import\(\s*|import\s+)["'])(\.[^"']*?)\.ts(["'])/g, "$1$2.js$3");
}

/** The tarball's name for a package: `@scope/name` at a version is `scope-name-version.tgz`. */
export const tarballName = (name: string, version: string): string => `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;

/** The version of a library of commons, from its `package.json`, and whether it is published to npm (its manifest names that). */
function libraryOf(commons: string, name: string): { readonly version: string; readonly npm: boolean } | undefined {
  const pkg = join(commons, name, "package.json");
  if (!existsSync(pkg)) return undefined;
  const lib = join(commons, name, "library.ts");
  const npm = existsSync(lib) && /distribution:\s*\[[^\]]*"npm"/.test(readTextFileSync(lib));
  return { version: text((JSON.parse(readTextFileSync(pkg)) as Json)["version"]), npm };
}

/**
 * The declarations of a bundle: from the entries' declarations in the compiler's output, every declaration reached by a relative import is published, those of a file outside the library's own `src/` under `dist/vendor/`
 * with the specifiers that name it rewritten to relative ones. A library of commons that a bundle uses is a dependency and is not vendored.
 */
function vendorDeclarations(
  outRoot: string,
  lib: string,
  entries: readonly string[],
  stageDist: string,
): Findings {
  const found: string[] = [];
  const placed = new Map<string, string>(); // a file of the compiler's output, and where it goes under the stage's dist/
  const place = (file: string): string => {
    const rel = toPosix(relative(outRoot, file));
    const own = `${lib}/src/`;
    return rel.startsWith(own) ? rel.slice(own.length) : `vendor/${rel}`;
  };
  const todo = [...entries];
  while (todo.length > 0) {
    const file = todo.pop() ?? "";
    if (placed.has(file)) continue;
    if (!existsSync(file)) {
      found.push(`the compiler wrote no declaration ${toPosix(relative(outRoot, file))}`);
      continue;
    }
    const dest = place(file);
    placed.set(file, dest);
    for (const s of specifiersOf(readTextFileSync(file))) {
      if (s.startsWith(".")) todo.push(join(dirname(file), s.replace(/\.(?:js|ts|mjs)$/, "") + ".d.ts"));
    }
  }
  for (const [file, dest] of placed) {
    let source = rewriteDeclarationSpecifiers(readTextFileSync(file));
    // a relative import that leaves the library's own tree (a type the compiler named by its path in commons) goes to where that declaration was placed
    source = source.replace(
      /((?:from\s+|import\(\s*|import\s+)["'])(\.[^"']+)(["'])/g,
      (whole, pre: string, spec: string, post: string) => {
        const target = join(dirname(file), spec.replace(/\.(?:js|ts|mjs)$/, "") + ".d.ts");
        const there = placed.get(target);
        if (there === undefined) return whole;
        let rel = toPosix(relative(dirname(dest), there)).replace(/\.d\.ts$/, ".js");
        if (!rel.startsWith(".")) rel = `./${rel}`;
        return `${pre}${rel}${post}`;
      },
    );
    const out = join(stageDist, dest);
    mkdirSync(dirname(out), { recursive: true });
    writeTextFileSync(out, source);
  }
  return found;
}

/** What packing a library made: the staging folder, the tarball, the findings and the manifest. */
export type Packed = { readonly stage: string; readonly tarball: string | undefined; readonly findings: Findings; readonly manifest: Json };

/** What a package adds to the common form. */
/** Whether a declaration of the package names a `node:` module: a package whose types name Node's needs `@types/node` where it is type-checked (a peer dependency, FR-013 of 0032-libraries-by-concern). */
function namesNodeTypes(folder: string): boolean {
  if (!existsSync(folder)) return false;
  for (const e of readDirSync(folder)) {
    const p = join(folder, e.name);
    if (e.isDirectory) {
      if (namesNodeTypes(p)) return true;
    } else if (e.name.endsWith(".d.ts") && /(?:from\s+|import\()"node:/.test(readTextFileSync(p))) return true;
  }
  return false;
}

/** What packing a library is told: its folder, where to stage it and whether to make the tarball. */
export type PackOptions = {
  /** Types the compiler is given (`["node"]` for a library that names Node's). */
  readonly types?: readonly string[];
  /**
   * Commands of a package that is not a bundle: each command's name and the module, in `src/`, whose `main(argv)` gives the exit status; the package gets a one-line launcher for each (`<command>.mjs`, which Node and Bun run), made
   * from the compiled module. The files under `src/` that are not TypeScript (a stylesheet a module reads beside itself) are published beside the sources and beside the compiled modules.
   */
  readonly launchers?: Readonly<Record<string, string>>;
  /** Packages the published package may use where they are installed beside it and does not need (loaded by name at run time): written as optional peer dependencies, name and range. */
  readonly optionalPeers?: Readonly<Record<string, string>>;
  /** A bundled package: the code of each entry and of each command is one file (`bun build`), and only the declarations the entries reach are published. */
  readonly bundle?: {
    /** The commands: their name, and the source that is the command's entry from the library's folder. */
    readonly bin?: Readonly<Record<string, string>>;
    /** The README that is published, where it is more than the common one. */
    readonly readme?: string;
    readonly keywords?: readonly string[];
    /** Files of the library's folder that are published beside the others (`CREDITS.md`). */
    readonly extraFiles?: readonly string[];
  };
};

/** The manifest of the library at `root`, where it has one that can be read. */
function manifestOf(root: string): Library | undefined {
  const file = join(root, LIBRARY_FILE);
  if (!existsSync(file)) return undefined;
  const r = decodeLibrarySource(readTextFileSync(file));
  return r.kind === "ok" ? r.value : undefined;
}

/** Builds and stages the package of the library at `root` (a folder `commons/<name>/` with a `package.json` and sources in `src/`), inspects it and, where nothing is wrong, packs it. */
export async function packLibrary(root: string, options: PackOptions = {}): Promise<Packed> {
  const own = JSON.parse(readTextFileSync(join(root, "package.json"))) as Json;
  const name = text(own["name"]);
  const short = name.replace(`${SCOPE}/`, "");
  const commons = dirname(resolve(root));
  const dist = join(root, "dist");
  const stage = join(dist, "package");
  const bundle = options.bundle;
  if (existsSync(dist)) removeSync(dist, { recursive: true });
  mkdirSync(stage, { recursive: true });
  // the compiler's configuration for this build: the base of commons, emitting modules and declarations of src/ and nothing else
  const base = relative(dist, join(commons, "tsconfig.base.json"));
  writeTextFileSync(
    join(dist, "tsconfig.build.json"),
    JSON.stringify(
      {
        extends: toPosix(base),
        compilerOptions: {
          noEmit: false,
          declaration: true,
          rewriteRelativeImportExtensions: true,
          rootDir: toPosix(relative(dist, commons)),
          outDir: "out",
          types: options.types ?? [],
          skipLibCheck: true,
          // another library of commons is read where the package manager linked it (under node_modules), so that a declaration names it by its package and its entry and never by the path of its sources
          preserveSymlinks: true,
        },
        include: [toPosix(relative(dist, join(root, "src"))) + "/**/*.ts"],
      },
      null,
      2,
    ),
  );
  const bun = which("bun") ?? "bun";
  const built = await run([bun, "x", "tsc", "-p", join(dist, "tsconfig.build.json")], { cwd: root });
  if (built.code !== 0)
    return { stage, tarball: undefined, findings: [`the compiler stopped: ${built.stdout || built.stderr}`.trim()], manifest: {} };
  // what src/ became is in out/<name>/src/: the declarations go to dist/, and the compiled files too unless the package is a bundle
  const out = join(dist, "out", basename(resolve(root)), "src");
  const findings: string[] = [];
  const ownExports = isObject(own["exports"]) ? own["exports"] : {};
  if (bundle === undefined) {
    for (const f of filesUnder(out)) {
      const target = join(stage, "dist", f);
      mkdirSync(dirname(target), { recursive: true });
      if (f.endsWith(".d.ts")) writeTextFileSync(target, rewriteDeclarationSpecifiers(readTextFileSync(join(out, f))));
      else if (f.endsWith(".js")) copyFileSync(join(out, f), target);
    }
  } else {
    const entryFiles = Object.values(ownExports).map((e) =>
      join(out, (targetsOf(e)["default"] ?? text(e)).replace(/^\.\/src\//, "").replace(/\.ts$/, "") + ".d.ts"),
    );
    findings.push(
      ...vendorDeclarations(
        join(dist, "out"),
        basename(resolve(root)),
        entryFiles,
        join(stage, "dist"),
      ),
    );
  }
  // the sources, for the `bun` condition (a bundle has no source to offer: what it imports is not on npm)
  if (bundle === undefined) {
    for (const f of filesUnder(join(root, "src"))) {
      const target = join(stage, "src", f);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(root, "src", f), target);
      if (!f.endsWith(".ts")) {
        // a file that is not TypeScript is read beside the module that reads it, from the sources and from the compiled modules alike
        const compiled = join(stage, "dist", f);
        mkdirSync(dirname(compiled), { recursive: true });
        copyFileSync(join(root, "src", f), compiled);
      }
    }
  }
  // the entries: each names its declarations, its source (Bun) and its compiled file
  const exportsOut: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(ownExports)) {
    const source = targetsOf(entry)["default"] ?? text(entry);
    const rel = toPosix(source)
      .replace(/^\.\/src\//, "")
      .replace(/\.ts$/, "");
    exportsOut[key] =
      bundle === undefined
        ? { types: `./dist/${rel}.d.ts`, bun: `./src/${rel}.ts`, default: `./dist/${rel}.js` }
        : { types: `./dist/${rel}.d.ts`, default: `./dist/${rel}.js` };
    if (bundle !== undefined) {
      const bundled = await run(
        [bun, "build", join(root, source), "--target=node", "--format=esm", "--outfile", join(stage, "dist", `${rel}.js`)],
        { cwd: root },
      );
      if (bundled.code !== 0) findings.push(`bun build stopped on ${source}: ${bundled.stderr || bundled.stdout}`.trim());
    }
  }
  // the commands of a bundle: one file each, with the line that runs it under Node
  const binOut: Record<string, string> = {};
  for (const [cmd, source] of Object.entries(options.launchers ?? {})) {
    const rel = toPosix(source).replace(/^\.?\/?(src\/)?/, "").replace(/\.ts$/, "");
    const file = join(stage, `${cmd}.mjs`);
    await writeTextFile(file, `#!/usr/bin/env node\nimport { main } from "./dist/${rel}.js";\n\nprocess.exit(await main(process.argv.slice(2)));\n`);
    await chmod(file, 0o755);
    binOut[cmd] = `./${cmd}.mjs`;
  }
  for (const [cmd, source] of Object.entries(bundle?.bin ?? {})) {
    const file = join(stage, `${cmd}.mjs`);
    const bundled = await run([bun, "build", join(root, source), "--target=node", "--format=esm", "--outfile", file], { cwd: root });
    if (bundled.code !== 0) {
      findings.push(`bun build stopped on ${source}: ${bundled.stderr || bundled.stdout}`.trim());
      continue;
    }
    const code = await readTextFile(file);
    await writeTextFile(file, code.startsWith("#!") ? code : `#!/usr/bin/env node\n${code}`);
    await chmod(file, 0o755);
    binOut[cmd] = `./${cmd}.mjs`;
  }
  // the dependencies: the packages that the compiled code names (of a bundle, the declarations the entries reach), the libraries of commons at the version they have here, the others as the library declares them
  const declaredDeps = isObject(own["dependencies"]) ? own["dependencies"] : {};
  const dependencies: Record<string, string> = {};
  const scanned: { readonly file: string; readonly source: string }[] = [];
  if (bundle === undefined)
    for (const f of filesUnder(join(stage, "dist"))) scanned.push({ file: `dist/${f}`, source: readTextFileSync(join(stage, "dist", f)) });
  else {
    const draft = {
      name,
      exports: exportsOut,
      ...(typeof exportsOut["."] === "object" ? { types: (exportsOut["."] as Json)["types"] } : {}),
    } as Json;
    const { reached } = reachableDeclarations(stage, draft);
    for (const d of reached) scanned.push({ file: d, source: readTextFileSync(join(stage, d)) });
    // only the declarations the entries reach are published
    for (const f of filesUnder(join(stage, "dist")))
      if (f.endsWith(".d.ts") && !reached.has(`dist/${f}`)) removeSync(join(stage, "dist", f));
  }
  for (const { file, source } of scanned) {
    for (const s of specifiersOf(source)) {
      const pkg = packageOf(s);
      if (pkg === undefined || pkg === name) continue;
      if (pkg.startsWith(`${SCOPE}/`) && pkg !== `${SCOPE}/commons`) {
        const lib = libraryOf(commons, pkg.slice(SCOPE.length + 1));
        if (lib === undefined) findings.push(`${file} imports ${pkg}, which is no library of commons`);
        else if (!lib.npm) findings.push(`${file} imports ${pkg}, which is not published to npm`);
        else dependencies[pkg] = lib.version;
      } else if (pkg !== `${SCOPE}/commons`) {
        const v = declaredDeps[pkg];
        if (typeof v === "string") dependencies[pkg] = v;
        else findings.push(`${file} imports ${pkg}, which the package.json of ${short} does not list under dependencies`);
      }
    }
  }
  const extraFiles = bundle?.extraFiles ?? [];
  for (const f of extraFiles) copyFileSync(join(root, f), join(stage, f));
  const manifest: Json = {
    name,
    version: text(own["version"]),
    description: text(own["description"]),
    license: licenseOf(manifestOf(root)),
    type: "module",
    engines: { node: ">=26" },
    sideEffects: false,
    ...(Object.keys(binOut).length === 0 ? {} : { bin: binOut }),
    ...(exportsOut["."] === undefined ? {} : { types: (exportsOut["."] as Json)["types"] }),
    ...(Object.keys(exportsOut).length === 0 ? {} : { exports: exportsOut }),
    ...(Object.keys(dependencies).length === 0
      ? {}
      : { dependencies: Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => (a < b ? -1 : 1))) }),
    ...(namesNodeTypes(join(stage, "dist")) || options.optionalPeers !== undefined
      ? { peerDependencies: { ...(namesNodeTypes(join(stage, "dist")) ? { "@types/node": ">=26" } : {}), ...(options.optionalPeers ?? {}) } }
      : {}),
    ...(options.optionalPeers === undefined ? {} : { peerDependenciesMeta: Object.fromEntries(Object.keys(options.optionalPeers).map((n) => [n, { optional: true }])) }),
    files: [
      ...(Object.keys(exportsOut).length === 0 ? [] : ["dist"]),
      ...(bundle === undefined ? ["src"] : []),
      ...Object.values(binOut).map(noDot),
      "README.md",
      "LICENSE",
      ...extraFiles,
    ],
    repository: { type: "git", url: "git+https://github.com/intellectual-frontiers/.github.git", directory: `commons/${short}` },
    homepage: `https://github.com/intellectual-frontiers/.github/tree/main/commons/${short}`,
    bugs: { url: "https://github.com/intellectual-frontiers/.github/issues" },
    ...(bundle?.keywords === undefined ? {} : { keywords: bundle.keywords }),
    publishConfig: { access: "public" },
  };
  writeTextFileSync(join(stage, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeTextFileSync(
    join(stage, "README.md"),
    bundle?.readme ??
      [
        `# ${name}`,
        "",
        text(own["description"]),
        "",
        "```sh",
        `bun add ${name}     # or: npm install ${name}`,
        "```",
        "",
        `Sources and specifications: https://github.com/intellectual-frontiers/.github/tree/main/commons/${short}`,
        "",
      ].join("\n"),
  );
  if (existsSync(join(root, "LICENSE"))) copyFileSync(join(root, "LICENSE"), join(stage, "LICENSE"));
  else findings.push(`commons/${short} has no LICENSE; run: ${LICENSE_COMMAND}`);
  findings.push(...inspectPackage(stage));
  if (findings.length > 0) return { stage, tarball: undefined, findings, manifest };
  const packed = await run([bun, "pm", "pack", "--destination", dist], { cwd: stage });
  if (packed.code !== 0)
    return { stage, tarball: undefined, findings: [`bun pm pack stopped: ${packed.stderr || packed.stdout}`.trim()], manifest };
  return { stage, tarball: join(dist, tarballName(name, text(own["version"]))), findings: [], manifest };
}

/** The command line of a library's `tools/pack.ts`: pack, print what was found (or the tarball) and the exit status. */
export async function main(root: string, argv: readonly string[], options: PackOptions = {}): Promise<number> {
  // the check inside `verify` is left out where CI says the exports did not change (`IFC_SKIP_PACK`); the packing for a publication is never skipped
  if (argv.includes("--check") && (env.get("IFC_SKIP_PACK") ?? "") !== "") {
    console.log("pack check skipped: the exports of this library did not change in this push (IFC_SKIP_PACK); the release packs it");
    return 0;
  }
  const r = await packLibrary(root, options);
  for (const f of r.findings) console.error(f);
  if (r.tarball === undefined) return 1;
  console.log(argv.includes("--check") ? `packed ${r.tarball}: nothing wrong` : r.tarball);
  return 0;
}
