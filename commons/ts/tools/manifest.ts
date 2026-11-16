/**
 * The package's manifests, read once and checked (commons 0005-typescript-runtime FR-016, FR-029): `commons/ts/package.json`, which is
 * for the development of this folder, and the repository's root `package.json`, which is what a consumer depends on by Git. Both bear the
 * one name, and the root's `./ts/...` entry points are this folder's, from the root.
 *
 * @module
 */
import { json, object, record, string } from "../kernel/decode.ts";
import { formatDecodeError } from "../kernel/decode.ts";
import { err, ok, type Result } from "../kernel/result.ts";

/** The one name of the package, the root's and this folder's. */
export const PACKAGE_NAME = "@intellectual-frontiers/commons";

const decoder = object(
  { name: string, description: string, type: string, exports: record(string) },
  {
    dependencies: record(string),
    devDependencies: record(string),
    bin: record(string),
    repository: object({ type: string, url: string }, { directory: string }),
  },
);

/** The fields of a `package.json` this tooling reads. */
export type Manifest = {
  readonly name: string;
  readonly description: string;
  readonly exports: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>> | undefined;
  readonly bin: Readonly<Record<string, string>> | undefined;
};

/** A `package.json` decoded, or why it is not one of this package's: an ES module package with entry points that are strings. */
export function decodeManifest(text: string): Result<Manifest, string> {
  const r = json(text, decoder);
  if (r.kind === "err") return err(`package.json: ${formatDecodeError(r.error)}`);
  const v = r.value;
  if (v.type !== "module") return err('package.json: "type" must be "module"');
  return ok({
    name: v.name,
    description: v.description,
    exports: v.exports,
    devDependencies: v.devDependencies ?? {},
    dependencies: v.dependencies,
    bin: v.bin,
  });
}

/** This folder's entry points as the root package gives them: each `./ts/...` target, from the repository's root. */
export function rootEntries(m: Pick<Manifest, "exports">): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(m.exports).map(([k, v]) => [k, `./commons/ts/${v.replace(/^\.\//, "")}`]));
}
