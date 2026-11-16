/**
 * The package's manifest, read once and checked (commons 0011-documentation FR-001, FR-021): the source `package.json` decoded, the
 * manifest the packed package carries (its entry points and its `bin` as JavaScript with declarations, the same `dependencies`, and no
 * script or development dependency), and the name `bun pm pack` gives the tarball.
 *
 * @module
 */
import { err, formatDecodeError, json, object, ok, record, type Result, string } from "@intellectual-frontiers/ifc-ts/kernel";

const decoder = object(
  {
    name: string,
    version: string,
    description: string,
    type: string,
    exports: record(string),
    bin: record(string),
    dependencies: record(string),
    devDependencies: record(string),
  },
  { repository: object({ type: string, url: string, directory: string }) },
);

/** The fields of the source `package.json` this tooling reads. */
export interface Manifest {
  /** The package's name. */
  readonly name: string;
  /** Its version, `major.minor.patch`. */
  readonly version: string;
  /** What it is. */
  readonly description: string;
  /** Its entry points, as the source has them (`./mod.ts`). */
  readonly exports: Readonly<Record<string, string>>;
  /** Its commands, as the source has them (`./main.ts`). */
  readonly bin: Readonly<Record<string, string>>;
  /** What it depends on when it runs. */
  readonly dependencies: Readonly<Record<string, string>>;
  /** What it is built and tested with. */
  readonly devDependencies: Readonly<Record<string, string>>;
  /** Where its source is. */
  readonly repository: { readonly type: string; readonly url: string; readonly directory: string } | undefined;
}

/**
 * The source `package.json` decoded, or why it is not one this tooling can pack.
 *
 * @param text - its text
 */
export function decodeManifest(text: string): Result<Manifest, string> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return err(`package.json: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (typeof raw === "object" && raw !== null && "private" in raw && raw.private === true) return err("package.json: a released package is not private");
  const r = json(text, decoder);
  if (r.kind === "err") return err(`package.json: ${formatDecodeError(r.error)}`);
  const v = r.value;
  if (v.type !== "module") return err('package.json: "type" must be "module"');
  if (!/^\d+\.\d+\.\d+$/.test(v.version)) return err(`package.json: the version ${v.version} is not major.minor.patch`);
  return ok({
    name: v.name,
    version: v.version,
    description: v.description,
    exports: v.exports,
    bin: v.bin,
    dependencies: v.dependencies,
    devDependencies: v.devDependencies,
    repository: v.repository,
  });
}

/**
 * An entry point of the source (`./mod.ts`) as the built package has it: the JavaScript and its declarations.
 *
 * @param source - the source's path
 */
export function builtEntry(source: string): { readonly types: string; readonly default: string } {
  const base = source.replace(/\.ts$/, "");
  return { types: `${base}.d.ts`, default: `${base}.js` };
}

/**
 * The manifest the packed package carries: the same name, version, entry points and dependencies, built; no script and no development
 * dependency.
 *
 * @param m - the source's manifest
 */
export function packageManifest(m: Manifest): Readonly<Record<string, unknown>> {
  return {
    name: m.name,
    version: m.version,
    description: m.description,
    type: "module",
    exports: Object.fromEntries(Object.entries(m.exports).map(([k, v]) => [k, builtEntry(v)])),
    bin: Object.fromEntries(Object.entries(m.bin).map(([k, v]) => [k, builtEntry(v).default])),
    dependencies: m.dependencies,
    ...(m.repository === undefined ? {} : { repository: m.repository }),
    engines: { node: ">=26" },
  };
}

/**
 * The file name `bun pm pack` gives the tarball: the name without `@`, its `/` made `-`, then the version.
 *
 * @param m - the name and the version
 */
export function tarballName(m: Pick<Manifest, "name" | "version">): string {
  return `${m.name.replace(/^@/, "").replace("/", "-")}-${m.version}.tgz`;
}

/** The tag a release of this version is made from. */
export const tagOf = (version: string): string => `ifc-docs-v${version}`;
