// Spec: 0001-kanon-checker FR-001, FR-010
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
  absurd,
  array,
  boolean,
  type Decoded,
  type Decoder,
  describe,
  err,
  formatDecodeError,
  literal,
  object,
  ok,
  oneOf,
  type Result,
  string,
} from "@intellectual-frontiers/core";
import {
  classify,
  type FamilyRule,
  type InstanceName,
  memberPackage,
  parseInstanceName,
  parseNameTemplate,
  parsePluginNoun,
  type PluginNoun,
} from "./family.ts";
import { type FolderName, type PackageName, parseFolder, parsePackageName } from "./names.ts";

export { type FolderName, type PackageName, parseFolder, parsePackageName };

/** The layers of Kanon, from the top (0033-kanon FR-001). */
export const LAYERS = ["governance", "logical", "physical"] as const;
/** One of the three layers: a closed union. */
export type Layer = (typeof LAYERS)[number];

/** How far down a layer stands: Governance 1, Logical 2, Physical 3; a higher rank imports a lower (0033-kanon FR-007). A registry: one entry for each layer, which the compiler holds. */
export const RANK: Readonly<Record<Layer, number>> = { governance: 1, logical: 2, physical: 3 };

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

/**
 * One instance of a unit kind that a host declares (0033-kanon FR-019): a dialect, in a folder under the unit it is an instance of or in a package of its own. A sum, so that an instance is in a folder or
 * in a package and never both; the package of a package instance is made by the family's rule.
 */
export type Instance =
  | { readonly kind: "folder"; readonly name: InstanceName; readonly instanceOf: FolderName; readonly folder: FolderName }
  | { readonly kind: "package"; readonly name: InstanceName; readonly instanceOf: FolderName; readonly package: PackageName };

/** One plugin of a host (0033-kanon FR-020): a package of its own, named by the family's rule, with the plugins it declares it depends on. */
export type Plugin = {
  readonly noun: PluginNoun;
  readonly package: PackageName;
  readonly dependsOn: readonly PackageName[];
};

/** The table of a library that is Kanon. */
export type Table = {
  /** The package's own name, which a unit uses to import another unit. */
  readonly package: PackageName;
  readonly units: readonly Unit[];
  /** The naming rule of the packages that extend this library, where it has any (0033-kanon FR-021). */
  readonly family?: FamilyRule;
  /** The instances of its units that it declares (0033-kanon FR-019). */
  readonly instances: readonly Instance[];
  /** The plugins it declares (0033-kanon FR-020). */
  readonly plugins: readonly Plugin[];
  /** The host library this package extends, as a dialect or a plugin of it: a package is a host or an extension, never both (0033-kanon FR-020). */
  readonly extends?: PackageName;
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
const familyForm = object({ dialect: nonEmpty, plugin: nonEmpty }, { contract: nonEmpty });
const instanceForm = object({ name: nonEmpty, instanceOf: nonEmpty, placement: literal("folder", "package") });
const pluginForm = object({ noun: nonEmpty }, { dependsOn: array(nonEmpty) });
const body = object(
  { package: nonEmpty, units: array(unitForm) },
  { family: familyForm, instances: array(instanceForm), plugins: array(pluginForm), extends: nonEmpty },
);

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
  const members = decodeMembers(r.value, pkg.value, out);
  if (members.kind === "err") return members;
  const extended = r.value.extends === undefined ? undefined : parsePackageName(r.value.extends);
  if (extended?.kind === "err") return err(`kanon.extends: ${extended.error}`);
  if (extended !== undefined && (members.value.family !== undefined || members.value.instances.length + members.value.plugins.length > 0))
    return err("kanon: a package is a host (family, instances, plugins) or an extension (extends), never both");
  return ok({ package: pkg.value, units: out, ...members.value, ...(extended === undefined ? {} : { extends: extended.value }) });
}

type Form = Decoded<typeof body>;

/** The family, instances and plugins of a table: what each names must exist, no name is declared twice, and the dependencies among plugins are a graph with no loop. */
function decodeMembers(
  form: Form,
  host: PackageName,
  units: readonly Unit[],
): Result<{ readonly family?: FamilyRule; readonly instances: readonly Instance[]; readonly plugins: readonly Plugin[] }, string> {
  const declared = (form.instances ?? []).length + (form.plugins ?? []).length;
  if (form.family === undefined) {
    return declared === 0 ? ok({ instances: [], plugins: [] }) : err("kanon.family: instances and plugins need a naming rule (family)");
  }
  const dialect = parseNameTemplate(form.family.dialect);
  if (dialect.kind === "err") return err(`kanon.family.dialect: ${dialect.error}`);
  const plugin = parseNameTemplate(form.family.plugin);
  if (plugin.kind === "err") return err(`kanon.family.plugin: ${plugin.error}`);
  if (dialect.value === plugin.value) return err("kanon.family: the dialect and the plugin templates are the same, so a package would be both");
  const contract = form.family.contract;
  if (contract !== undefined && !/^\.\/[A-Za-z0-9_./-]+$/.test(contract))
    return err(`kanon.family.contract: ${JSON.stringify(contract)} is not an export subpath, as ./plugin`);
  const family: FamilyRule = { dialect: dialect.value, plugin: plugin.value, ...(contract === undefined ? {} : { contract }) };
  const instances: Instance[] = [];
  const seen = new Set<string>();
  for (const [i, f] of (form.instances ?? []).entries()) {
    const at = `kanon.instances[${i}]`;
    const name = parseInstanceName(f.name);
    if (name.kind === "err") return err(`${at}.name: ${name.error}`);
    const unit = parseFolder(f.instanceOf);
    if (unit.kind === "err") return err(`${at}.instanceOf: ${unit.error}`);
    const row = units.find((u) => u.folder === unit.value);
    if (row === undefined || row.kind !== "layered") return err(`${at}.instanceOf ${JSON.stringify(f.instanceOf)} is no layered unit of the table`);
    if (seen.has(name.value)) return err(`${at}.name ${JSON.stringify(f.name)} is declared twice`);
    seen.add(name.value);
    switch (f.placement) {
      case "folder": {
        if (!row.instances) return err(`${at}: ${f.instanceOf} has no instances: true, so a folder under it is no instance`);
        const folder = parseFolder(`${unit.value}${name.value}/`);
        if (folder.kind === "err") return err(`${at}: ${folder.error}`);
        instances.push({ kind: "folder", name: name.value, instanceOf: unit.value, folder: folder.value });
        break;
      }
      case "package": {
        const pkg = memberPackage(family, host, { kind: "dialect", name: name.value });
        if (pkg.kind === "err") return err(`${at}: ${pkg.error}`);
        instances.push({ kind: "package", name: name.value, instanceOf: unit.value, package: pkg.value });
        break;
      }
      default:
        return absurd(f.placement);
    }
  }
  const nouns = new Map<string, { readonly noun: PluginNoun; readonly package: PackageName; readonly deps: readonly string[] }>();
  for (const [i, f] of (form.plugins ?? []).entries()) {
    const noun = parsePluginNoun(f.noun);
    if (noun.kind === "err") return err(`kanon.plugins[${i}].noun: ${noun.error}`);
    if (nouns.has(noun.value)) return err(`kanon.plugins[${i}].noun ${JSON.stringify(f.noun)} is declared twice`);
    const pkg = memberPackage(family, host, { kind: "plugin", noun: noun.value });
    if (pkg.kind === "err") return err(`kanon.plugins[${i}]: ${pkg.error}`);
    nouns.set(noun.value, { noun: noun.value, package: pkg.value, deps: f.dependsOn ?? [] });
  }
  const plugins: Plugin[] = [];
  for (const [noun, p] of nouns) {
    const dependsOn: PackageName[] = [];
    for (const d of p.deps) {
      const target = nouns.get(d);
      if (d === noun) return err(`kanon.plugins ${noun} depends on itself`);
      if (target === undefined) return err(`kanon.plugins ${noun} depends on ${JSON.stringify(d)}, which is no plugin of the table`);
      dependsOn.push(target.package);
    }
    plugins.push({ noun: p.noun, package: p.package, dependsOn });
  }
  const loop = dependencyLoop(plugins);
  if (loop !== undefined) return err(`kanon.plugins depend on each other in a loop: ${loop.join(" -> ")}`);
  if (classify(family, host, host)?.kind !== "host") return err("kanon.family: the host's own name is not read as the host");
  return ok({ family, instances, plugins });
}

/** The first loop among the plugins' declared dependencies, as the packages in order; none where there is no loop. */
function dependencyLoop(plugins: readonly Plugin[]): readonly string[] | undefined {
  const by = new Map(plugins.map((p) => [p.package as string, p.dependsOn]));
  const state = new Map<string, "visiting" | "done">();
  const walk = (from: string, path: readonly string[]): readonly string[] | undefined => {
    state.set(from, "visiting");
    for (const to of by.get(from) ?? []) {
      if (state.get(to) === "visiting") return [...path.slice(path.indexOf(to)), to];
      if (state.get(to) === undefined) {
        const found = walk(to, [...path, to]);
        if (found !== undefined) return found;
      }
    }
    state.set(from, "done");
    return undefined;
  };
  for (const p of plugins) {
    if (state.get(p.package) !== undefined) continue;
    const found = walk(p.package, [p.package]);
    if (found !== undefined) return found;
  }
  return undefined;
}
