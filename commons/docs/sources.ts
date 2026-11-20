/**
 * The packages a site is made from (commons 0011-documentation FR-004, FR-005, FR-027), each read from its `about.ts` or from the
 * `About` value its configuration gives, and the findings of holding an `about` to the code: a folder, an entry point or an example that
 * does not exist, a command that is not a script of the package, a rule enforced by a test, a lint rule or a compiler option that does not
 * exist.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { fs, path } from "../ts/runtime/mod.ts";
import type { Finding } from "./check.ts";
import { type About, type AboutArea, type AboutEnforcer, isAbout, type PackageSource, under } from "./config.ts";

/** A package read: where it is, its `About`, and the file that holds it, from the root. */
export interface Package {
  /** Its folder, from the root: `""` for the root itself. */
  readonly dir: string;
  /** Its name in the site's addresses. */
  readonly slug: string;
  /** Its `About`. */
  readonly about: About;
  /** The file its `About` is written in, from the root: its `about.ts`, or the configuration. */
  readonly file: string;
}

/** An area of a package, with the package it is in. */
export interface Area extends AboutArea {
  /** The package. */
  readonly pkg: Package;
  /** The folder of its first entry point, from the root: the files of the area. */
  readonly dir: string;
}

/**
 * Whether a file, from the root, is inside a folder, from the root (`""` holds everything).
 *
 * @param dir - the folder
 * @param file - the file
 */
export const inside = (dir: string, file: string): boolean => dir === "" || file.startsWith(`${dir}/`);

/**
 * A package's `About`: the value its configuration gives, or the one its `about.ts` exports.
 *
 * @param root - the repository's root
 * @param src - the package
 * @param configFile - the configuration's file, from the root, which holds an `About` value
 * @param found - where findings go
 */
export async function readPackage(root: string, src: PackageSource, configFile: string, found: Finding[]): Promise<Package | undefined> {
  const { dir, slug } = src;
  if (src.about.kind === "value") return { dir, slug, about: src.about.value, file: configFile };
  const where = src.about.file;
  const file = path.join(root, where);
  if (!fs.existsSync(file)) {
    found.push({ where, problem: { kind: "no-about" } });
    return undefined;
  }
  try {
    const mod: unknown = await import(path.toFileUrl(file).href);
    const about = typeof mod === "object" && mod !== null && "about" in mod ? mod.about : undefined;
    if (!isAbout(about)) {
      found.push({ where, problem: { kind: "no-about" } });
      return undefined;
    }
    return { dir, slug, about, file: where };
  } catch (e) {
    found.push({ where, problem: { kind: "import-failed", error: e instanceof Error ? e.message : String(e) } });
    return undefined;
  }
}

/** The areas of the packages, in order. */
export function areasOf(packages: readonly Package[]): Area[] {
  return packages.flatMap((pkg) => (pkg.about.areas ?? []).map((a) => ({ ...a, pkg, dir: under(pkg.dir, (a.entryPoints[0] ?? "").split("/").slice(0, -1).join("/")) })));
}

/** The scripts of a package's `package.json`. */
function scriptsOf(root: string, dir: string): ReadonlySet<string> {
  try {
    const pkg: unknown = JSON.parse(fs.readTextFileSync(path.join(root, under(dir, "package.json"))));
    const scripts = typeof pkg === "object" && pkg !== null && "scripts" in pkg ? pkg.scripts : undefined;
    return new Set(typeof scripts === "object" && scripts !== null ? Object.keys(scripts) : []);
  } catch {
    return new Set();
  }
}

/** Whether what a rule names as its enforcer exists, and how to name it in a finding. */
function enforcerExists(root: string, pkg: Package, e: AboutEnforcer, lintRules: string | undefined): readonly [boolean, string] {
  switch (e.kind) {
    case "test":
      return [fs.existsSync(path.join(root, pkg.dir, e.file)), e.file];
    case "lint":
      return [lintRules === undefined || fs.existsSync(path.join(root, lintRules, `${e.rule}.ts`)), `the lint rule ${e.rule}`];
    case "compiler": {
      const config = ["tsconfig.json", "../tsconfig.json"].map((f) => path.join(root, pkg.dir, f)).filter((f) => fs.existsSync(f));
      return [config.some((f) => fs.readTextFileSync(f).includes(`"${e.option}"`)), `the compiler option ${e.option}`];
    }
    case "review":
      return [true, "review"];
    default:
      return absurd(e);
  }
}

/**
 * What a package's `about` says that the code does not hold.
 *
 * @param root - the repository's root
 * @param pkg - the package
 * @param lintRules - the folder of the lint rules, from the root; a lint rule is not checked without it
 */
export function checkAbout(root: string, pkg: Package, lintRules?: string): Finding[] {
  const where = pkg.file;
  const found: Finding[] = [];
  const at = (rel: string): boolean => fs.existsSync(path.join(root, pkg.dir, rel));
  for (const f of pkg.about.folders ?? []) if (!at(f.path)) found.push({ where, problem: { kind: "folder-missing", folder: f.path } });
  const scripts = scriptsOf(root, pkg.dir);
  for (const c of pkg.about.commands ?? []) {
    const script = /^bun run ([\w:.-]+)/.exec(c.run)?.[1];
    if (script !== undefined && !scripts.has(script)) found.push({ where, problem: { kind: "command-missing", command: c.run } });
  }
  for (const r of pkg.about.rules ?? []) {
    for (const e of r.enforcedBy) {
      const [ok, name] = enforcerExists(root, pkg, e, lintRules);
      if (!ok) found.push({ where, problem: { kind: "enforcer-missing", enforcer: name } });
    }
  }
  const examples = [...(pkg.about.examples ?? []), ...(pkg.about.areas ?? []).flatMap((a) => a.examples ?? [])];
  for (const x of examples) if (!at(x.file)) found.push({ where, problem: { kind: "example-missing", file: x.file } });
  for (const a of pkg.about.areas ?? []) {
    for (const e of a.entryPoints) if (!at(e)) found.push({ where, problem: { kind: "entry-point-missing", file: e } });
  }
  return found;
}

/**
 * The TypeScript files of an area's folder that document it: everything but tests and generated files.
 *
 * @param root - the repository's root
 * @param dir - the area's folder, from the root
 */
export function areaFiles(root: string, dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    const entries = [...fs.readDirSync(path.join(root, rel))].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const child = under(rel, e.name);
      if (e.isDirectory && e.name !== "node_modules" && !e.name.startsWith(".")) walk(child);
      else if (e.isFile && e.name.endsWith(".ts") && !e.name.includes(".test.") && !e.name.includes(".auto.")) out.push(child);
    }
  };
  walk(dir);
  return out;
}
