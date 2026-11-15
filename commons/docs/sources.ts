/**
 * The packages of commons the site is made from (commons 0011-documentation FR-004, FR-005), each read from its `about.ts`, and the
 * findings of holding an `about` to the code: a folder, an entry point or an example that does not exist, a command that is not a script
 * of the package, a rule enforced by a test, a lint rule or a compiler option that does not exist.
 *
 * @module
 */
import type { About, AboutArea, AboutEnforcer } from "../ts/kernel/mod.ts";
import { absurd } from "../ts/kernel/mod.ts";
import { fs, path } from "../ts/runtime/mod.ts";
import type { Finding } from "./check.ts";

/** A package of commons: where it is, from the checkout's root, and its name in the site's addresses. */
export interface PackageSource {
  /** Its folder, from the checkout's root. */
  readonly dir: string;
  /** Its name in the site's addresses. */
  readonly slug: string;
}

/** Commons as a whole, whose `about` is the home page. */
export const COMMONS: PackageSource = { dir: "commons", slug: "commons" };

/** The packages, in the order the site shows them. */
export const PACKAGES: readonly PackageSource[] = [
  { dir: "commons/ts", slug: "ifc-typescript" },
  { dir: "commons/ts/data", slug: "data" },
  { dir: "commons/docs", slug: "docs" },
];

/** A package read: where it is, and its `about`. */
export interface Package extends PackageSource {
  /** Its `about`. */
  readonly about: About;
}

/** An area of a package, with the package it is in. */
export interface Area extends AboutArea {
  /** The package. */
  readonly pkg: Package;
  /** The folder of its first entry point, from the checkout's root: the files of the area. */
  readonly dir: string;
}

/** Whether a value is an `About` (the fields every `about` has). */
function isAbout(v: unknown): v is About {
  return typeof v === "object" && v !== null && "title" in v && typeof v.title === "string" && "summary" in v && typeof v.summary === "string";
}

/**
 * A package's `about`, imported from its `about.ts`.
 *
 * @param root - the checkout's root
 * @param src - the package
 * @param found - where findings go
 */
export async function readPackage(root: string, src: PackageSource, found: Finding[]): Promise<Package | undefined> {
  const file = path.join(root, src.dir, "about.ts");
  const where = `${src.dir}/about.ts`;
  if (!fs.existsSync(file)) {
    found.push({ where, problem: { kind: "no-about" } });
    return undefined;
  }
  try {
    const mod: unknown = await import(file);
    const about = typeof mod === "object" && mod !== null && "about" in mod ? mod.about : undefined;
    if (!isAbout(about)) {
      found.push({ where, problem: { kind: "no-about" } });
      return undefined;
    }
    return { ...src, about };
  } catch (e) {
    found.push({ where, problem: { kind: "import-failed", error: e instanceof Error ? e.message : String(e) } });
    return undefined;
  }
}

/** The areas of the packages, in order. */
export function areasOf(packages: readonly Package[]): Area[] {
  return packages.flatMap((pkg) =>
    (pkg.about.areas ?? []).map((a) => ({ ...a, pkg, dir: [pkg.dir, ...(a.entryPoints[0] ?? "").split("/").slice(0, -1)].join("/") }))
  );
}

/** The scripts of a package's `package.json`. */
function scriptsOf(root: string, dir: string): ReadonlySet<string> {
  try {
    const pkg: unknown = JSON.parse(fs.readTextFileSync(path.join(root, dir, "package.json")));
    const scripts = typeof pkg === "object" && pkg !== null && "scripts" in pkg ? pkg.scripts : undefined;
    return new Set(typeof scripts === "object" && scripts !== null ? Object.keys(scripts) : []);
  } catch {
    return new Set();
  }
}

/** Whether what a rule names as its enforcer exists, and how to name it in a finding. */
function enforcerExists(root: string, pkg: Package, e: AboutEnforcer): readonly [boolean, string] {
  switch (e.kind) {
    case "test":
      return [fs.existsSync(path.join(root, pkg.dir, e.file)), e.file];
    case "lint":
      return [fs.existsSync(path.join(root, "commons/ts/lint/rules", `${e.rule}.ts`)), `the lint rule ${e.rule}`];
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
 * @param root - the checkout's root
 * @param pkg - the package
 */
export function checkAbout(root: string, pkg: Package): Finding[] {
  const where = `${pkg.dir}/about.ts`;
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
      const [ok, name] = enforcerExists(root, pkg, e);
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
 * @param root - the checkout's root
 * @param dir - the area's folder, from the root
 */
export function areaFiles(root: string, dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    const entries = [...fs.readDirSync(path.join(root, rel))].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory && e.name !== "node_modules") walk(child);
      else if (e.isFile && e.name.endsWith(".ts") && !e.name.includes(".test.") && !e.name.includes(".auto.")) out.push(child);
    }
  };
  walk(dir);
  return out;
}
