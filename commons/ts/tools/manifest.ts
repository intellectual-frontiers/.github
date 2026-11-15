/**
 * The package's manifest, read once and checked (commons 0005-typescript-runtime FR-016, FR-029): the source `package.json` decoded, the
 * manifest the packed package carries (its entry points as JavaScript with declarations, and no development dependency), and the name
 * `bun pm pack` gives the tarball.
 *
 * @module
 */
import { json, object, record, string } from "../kernel/decode.ts";
import { formatDecodeError } from "../kernel/decode.ts";
import { err, ok, type Result } from "../kernel/result.ts";

const decoder = object(
  { name: string, version: string, description: string, type: string, exports: record(string), devDependencies: record(string) },
  { dependencies: record(string), repository: object({ type: string, url: string, directory: string }) },
);

/** The fields of the source `package.json` this tooling reads. */
export type Manifest = {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly exports: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>> | undefined;
  readonly repository: { readonly type: string; readonly url: string; readonly directory: string } | undefined;
};

/** The source `package.json` decoded, or why it is not one this tooling can pack. */
export function decodeManifest(text: string): Result<Manifest, string> {
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
    devDependencies: v.devDependencies,
    dependencies: v.dependencies,
    repository: v.repository,
  });
}

/** An entry point of the source (`./kernel/mod.ts`) as the built package has it: the JavaScript and its declarations. */
export function builtEntry(source: string): { readonly types: string; readonly default: string } {
  const base = source.replace(/\.ts$/, "");
  return { types: `${base}.d.ts`, default: `${base}.js` };
}

/** The manifest the packed package carries: the same name, version and entry points, built; no script and no dependency. */
export function packageManifest(m: Manifest): Readonly<Record<string, unknown>> {
  return {
    name: m.name,
    version: m.version,
    description: m.description,
    type: "module",
    exports: Object.fromEntries(Object.entries(m.exports).map(([k, v]) => [k, builtEntry(v)])),
    ...(m.repository === undefined ? {} : { repository: m.repository }),
    engines: { node: ">=26" },
    sideEffects: false,
  };
}

/** The file name `bun pm pack` gives the tarball: the name without `@`, its `/` made `-`, then the version. */
export function tarballName(m: Pick<Manifest, "name" | "version">): string {
  return `${m.name.replace(/^@/, "").replace("/", "-")}-${m.version}.tgz`;
}
