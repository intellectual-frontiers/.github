/**
 * The package of Docs as `tools/pack.ts` makes it, packed once for the tests that look at it (commons 0001-docs FR-004, FR-005).
 *
 * @module
 */
import { activeMode, MODE_VARIABLE } from "@intellectual-frontiers/libraries/distribution";
import { type Packed, packLibrary } from "@intellectual-frontiers/libraries/pack";
import { path, proc } from "@intellectual-frontiers/system";

/** The folder of the library. */
export const DOCS = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

let packed: Promise<Packed> | undefined;

/** The packed package: built, inspected and packed, once. */
export const packedDocs = (): Promise<Packed> => (packed ??= packLibrary(DOCS, { types: ["node"], launchers: { "ifc-docs": "src/cli.ts" } }));

/** The mode of distribution a run uses: `single` (the mode of the repository) unless `IFC_DISTRIBUTION` names the other. */
export function distribution(): "single" | "per-library" {
  const mode = activeMode(proc.env.get(MODE_VARIABLE));
  if (mode.kind === "err") throw new Error(mode.error);
  return mode.value;
}

/** What a consumer installs to have Docs, by the distribution mode (commons 0036-distribution FR-021, FR-024): the tarball, the name its configuration imports, and the command it runs. */
export type Consumable = {
  /** The tarball to install. */
  readonly tarball: string;
  /** The name a configuration imports: `@intellectual-frontiers/docs` (per-library) or `@intellectual-frontiers/commons/docs` (single). */
  readonly importName: string;
  /** The package the tarball is, which the consumer's `package.json` depends on. */
  readonly packageName: string;
  /** The command's file under the package's folder in `node_modules`. */
  readonly command: string;
};

let consumable: Promise<Consumable> | undefined;

/**
 * The package a consumer of Docs installs. In `single` mode, the mode of the repository, Docs is not a package of its own: it is one library of `@intellectual-frontiers/commons`, so the one package is packed by the program of
 * `commons/commons` (the libraries it holds are one version of each, and `@intellectual-frontiers/lang-sql` is not a package on npm), and the configuration imports `@intellectual-frontiers/commons/docs` and runs `bin/ifc-docs.mjs`.
 * In `per-library` mode it is the package of Docs by itself.
 */
export function consumableDocs(): Promise<Consumable> {
  consumable ??= (async (): Promise<Consumable> => {
    if (distribution() === "per-library") {
      const p = await packedDocs();
      if (p.tarball === undefined) throw new Error(`Docs did not pack: ${p.findings.join("; ")}`);
      return { tarball: p.tarball, importName: "@intellectual-frontiers/docs", packageName: "@intellectual-frontiers/docs", command: "ifc-docs.mjs" };
    }
    const folder = path.join(path.resolve(DOCS, "..", "commons"));
    const installed = await proc.run(["bun", "install", "--frozen-lockfile"], { cwd: folder });
    if (installed.code !== 0) throw new Error(`bun install in commons/commons: ${installed.stdout}${installed.stderr}`);
    const packed = await proc.run(["bun", "tools/pack.ts"], { cwd: folder });
    const tarball = (`${packed.stdout}${packed.stderr}`.match(/\S+\.tgz/g) ?? []).at(-1);
    if (packed.code !== 0 || tarball === undefined) throw new Error(`commons/commons did not pack: ${packed.stdout}${packed.stderr}`.slice(0, 3000));
    return { tarball, importName: "@intellectual-frontiers/commons/docs", packageName: "@intellectual-frontiers/commons", command: "bin/ifc-docs.mjs" };
  })();
  return consumable;
}
