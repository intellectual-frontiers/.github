// Spec: 0001-kanon-checker FR-001
/**
 * The table of a library that is Kanon (commons 0033-kanon FR-010): its units, each in one of the three layers or the library's own checking, as data a manifest declares and a program reads. This
 * module holds the types of the table, the ranks of the layers and the decoder that reads a table from the `kanon` field of a manifest.
 *
 * @remarks
 * Parse, don't validate: a folder and a package name are branded types made only by their smart constructors (`parseFolder`, `parsePackageName`), and a `Table` holds nothing else, so a function that
 * takes one never checks again. A unit is a sum, `LayeredUnit | OwnUnit`: a layered unit has a `layer`, an own unit (the library's tests and tools) has none and may import any file of the library by
 * a relative path, so that no unit is both or neither. A unit with `instances` is one unit for each folder under it (a dialect, a surface, a model). What a unit may import of the library's other
 * units is, by default, every unit of a layer above its own; where `mayImport` is given it is the exact list of the other units it may import. What it may import by package name is open where
 * `packages` is absent, and exactly the listed packages where it is given.
 *
 * @limits
 * It checks the form of the table, not that its folders exist: the check of a library's files finds a file that no unit holds (`layers/unclassified`).
 *
 * @example
 * ```ts
 * import { decodeTable } from "@intellectual-frontiers/kanon";
 * const r = decodeTable({ package: "@intellectual-frontiers/x", units: [{ folder: "src/governance/", layer: "governance" }] });
 * r.kind; // "ok"
 * ```
 *
 * @module
 */
import {
  array,
  boolean,
  type Brand,
  type Decoder,
  describe,
  err,
  formatDecodeError,
  literal,
  object,
  ok,
  oneOf,
  refine,
  type Result,
  string,
} from "@intellectual-frontiers/core";

/** The layers of Kanon, from the top (0033-kanon FR-001). */
export const LAYERS = ["governance", "logical", "physical"] as const;
/** One of the three layers: a closed union. */
export type Layer = (typeof LAYERS)[number];

/** How far down a layer stands: Governance 1, Logical 2, Physical 3; a higher rank imports a lower (0033-kanon FR-007). A registry: one entry for each layer, which the compiler holds. */
export const RANK: Readonly<Record<Layer, number>> = { governance: 1, logical: 2, physical: 3 };

/** A folder of a library from its root, with a trailing `/` (`./` for the files at the root): made only by `parseFolder`. */
export type FolderName = Brand<string, "kanon folder">;
/** A package's name, as `@scope/name` or `name`: made only by `parsePackageName`. */
export type PackageName = Brand<string, "kanon package name">;

const folderDecoder = refine(
  string,
  "kanon folder",
  (t) => t === "./" || (/^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\/$/.test(t) && !t.split("/").includes("..")),
);
const packageDecoder = refine(string, "kanon package name", (t) => /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(t));

/** A folder from text, or why the text is not one: the one way a `FolderName` is made. */
export function parseFolder(text: string): Result<FolderName, string> {
  const r = folderDecoder(text, "folder");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a folder: it ends with a slash, as ./ or src/governance/`);
}

/** A package name from text, or why the text is not one: the one way a `PackageName` is made. */
export function parsePackageName(text: string): Result<PackageName, string> {
  const r = packageDecoder(text, "package");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a package name, as @scope/name`);
}

/** A package a unit may import, with the subpaths it may reach: `any` (the package and every entry of it), `[]` (the package's own entry only) or the listed subpaths. */
export type Allowed = { readonly name: string; readonly subpaths: "any" | readonly string[] };

/** What every unit has. */
type UnitBase = {
  readonly folder: FolderName;
  /** True where each folder under `folder` is a unit of its own. */
  readonly instances: boolean;
  /** The exact list of the other units it may import (a unit's name is its folder); the layers above its own where absent. */
  readonly mayImport?: readonly FolderName[];
  /** The packages it may import by name; any where absent. */
  readonly packages?: readonly Allowed[];
};

/** A unit in one of the three layers. */
export type LayeredUnit = UnitBase & { readonly kind: "layered"; readonly layer: Layer };
/** The library's own checking (its tests, tools and examples): in no layer, and it may import any file of the library by a relative path. */
export type OwnUnit = UnitBase & { readonly kind: "own" };
/** A unit of the table: a sum, so that a unit is a layered one or an own one and never both or neither. */
export type Unit = LayeredUnit | OwnUnit;

/** The table of a library that is Kanon. */
export type Table = {
  /** The package's own name, which a unit uses to import another unit. */
  readonly package: PackageName;
  readonly units: readonly Unit[];
};

const nonEmpty: Decoder<string> = (input, path = "$") => {
  const r = string(input, path);
  if (r.kind === "err") return r;
  return r.value.trim() === "" ? err({ kind: "decode", path, expected: "a non-empty string", found: describe(input) }) : r;
};
const allowed: Decoder<Allowed> = object({ name: nonEmpty, subpaths: oneOf(literal("any"), array(nonEmpty)) });
const unitForm = object(
  { folder: nonEmpty },
  { layer: literal(...LAYERS), instances: boolean, own: boolean, mayImport: array(nonEmpty), packages: array(allowed) },
);
const body = object({ package: nonEmpty, units: array(unitForm) });

/** The table read from the `kanon` field of a manifest, or one sentence saying what is wrong with it (0033-kanon FR-010). */
export function decodeTable(input: unknown): Result<Table, string> {
  const r = body(input, "kanon");
  if (r.kind === "err") return err(formatDecodeError(r.error));
  const pkg = parsePackageName(r.value.package);
  if (pkg.kind === "err") return err(`kanon.package: ${pkg.error}`);
  const units: Unit[] = [];
  const seen = new Set<string>();
  for (const [i, u] of r.value.units.entries()) {
    const at = `kanon.units[${i}]`;
    const folder = parseFolder(u.folder);
    if (folder.kind === "err") return err(`${at}.folder: ${folder.error}`);
    if (seen.has(u.folder)) return err(`${at}.folder ${JSON.stringify(u.folder)} is in the table twice`);
    seen.add(u.folder);
    const base = { folder: folder.value, instances: u.instances === true };
    if (u.own === true) {
      if (u.layer !== undefined) return err(`${at} is the library's own checking and is in no layer: it declares ${u.layer}`);
      units.push({ kind: "own", ...base });
    } else if (u.layer === undefined) {
      return err(`${at} (${u.folder}) is in no layer: it declares a layer of ${LAYERS.join(", ")} or is own`);
    } else units.push({ kind: "layered", layer: u.layer, ...base });
  }
  const names = new Set(units.map((u) => u.folder as string));
  const out: Unit[] = [];
  for (const [i, u] of units.entries()) {
    const form = r.value.units[i];
    const list: FolderName[] | undefined = form?.mayImport === undefined ? undefined : [];
    for (const m of form?.mayImport ?? []) {
      const f = parseFolder(m);
      if (f.kind === "err" || !names.has(m))
        return err(`kanon.units[${i}].mayImport names ${JSON.stringify(m)}, which is no unit of the table`);
      list?.push(f.value);
    }
    out.push({
      ...u,
      ...(list === undefined ? {} : { mayImport: list }),
      ...(form?.packages === undefined ? {} : { packages: form.packages }),
    });
  }
  return ok({ package: pkg.value, units: out });
}
