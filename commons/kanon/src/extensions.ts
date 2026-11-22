// Spec: 0001-kanon-checker FR-012; 0002-kanon-content-checks FR-006
/**
 * The check of a package that extends a host (commons 0033-kanon FR-019, FR-020, FR-021): a dialect or a plugin, a package of its own, reaches the host only through the host's public `exports`, and
 * reaches no other member of the host's family but a declared dependency. Given the host's table and `exports`, the extension's table, files and `exports`, it returns findings in the form of the import
 * check, so that one baseline holds all of them.
 *
 * @remarks
 * Pure. What the extension is comes from the host's table, never from the extension: a package is a dialect where the host declares an instance of package placement with its name, a plugin where the host
 * declares it, and neither is `family/name`. A dialect may reach the units of the host that its instance's unit may import (the layers above it, and what that unit's row lists, which is the dialect port);
 * a plugin may reach any unit of the host that its `exports` names, and the plugin contract where the family has one. An import of the extension's own files by a relative path that leaves the package
 * is `layers/relative`, as in any library.
 *
 * @example
 * ```ts
 * import { extensionFindings } from "@intellectual-frontiers/kanon";
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { classify, type Member, rootPackage, splitPackage } from "./family.ts";
import {
  climbs,
  entryOf,
  type ExportsMap,
  type Finding,
  finding,
  importFindings,
  layerOf,
  mayReach,
  type Placed,
  type SourceFile,
  specifiersOf,
  unitOf,
} from "./imports.ts";
import type { Table } from "./table.ts";

/** What the host says an extension is: a dialect of one of its units, or a plugin with its declared dependencies. */
type Role =
  | { readonly kind: "dialect"; readonly from: Placed }
  | { readonly kind: "plugin"; readonly dependsOn: readonly string[] };

/** The role the host's table gives a package, or `undefined` where the host declares it as nothing. */
export function roleOf(host: Table, packageName: string): Role | undefined {
  const dialect = host.instances.find((i) => i.kind === "package" && i.package === packageName);
  if (dialect !== undefined) {
    const unit = host.units.find((u) => u.folder === dialect.instanceOf);
    return unit === undefined ? undefined : { kind: "dialect", from: { name: unit.folder, unit } };
  }
  const plugin = host.plugins.find((p) => p.package === packageName);
  return plugin === undefined ? undefined : { kind: "plugin", dependsOn: plugin.dependsOn };
}

/**
 * The role of an extension of another scope, from its own table (0033-kanon FR-027): the role it declares, where it is the one its package name reads as by the host's rule and, for a dialect, where the unit it is
 * an instance of is a layered unit of the host. `undefined` where it declares none or one that its name does not bear out.
 */
export function roleOfForeign(host: Table, ext: Table): Role | undefined {
  const declared = ext.role;
  if (declared === undefined || host.family === undefined) return undefined;
  const member = classify(host.family, host.package, ext.package);
  switch (declared.kind) {
    case "dialect": {
      if (member?.kind !== "dialect" || member.name !== declared.name) return undefined;
      const unit = host.units.find((u) => u.folder === declared.instanceOf);
      return unit === undefined || unit.kind !== "layered" ? undefined : { kind: "dialect", from: { name: unit.folder, unit } };
    }
    case "plugin":
      return member?.kind === "plugin" && member.noun === declared.noun ? { kind: "plugin", dependsOn: [] } : undefined;
    default:
      return absurd(declared);
  }
}

/** Whether a member of the family is one a dialect or a plugin may not import: a sibling dialect for a dialect, any other member for a plugin that does not depend on it. */
function memberFinding(role: Role, member: Exclude<Member, { readonly kind: "host" }>, root: string): "instances/sibling" | "plugins/undeclared" | undefined {
  switch (role.kind) {
    case "dialect":
      return member.kind === "dialect" ? "instances/sibling" : "plugins/undeclared";
    case "plugin":
      return role.dependsOn.includes(root) ? undefined : "plugins/undeclared";
    default:
      return absurd(role);
  }
}

/**
 * Every finding of a package that extends a host: the import check over its own table, and the rules of an extension.
 *
 * @param host - the host library's table
 * @param hostExports - the `exports` of the host's package
 * @param ext - the extension's table, which names the host it extends
 * @param files - the extension's files, from its root with `/`
 * @param exportsMap - the `exports` of the extension's package
 */
export function extensionFindings(
  host: Table,
  hostExports: ExportsMap,
  ext: Table,
  files: readonly SourceFile[],
  exportsMap: ExportsMap,
): readonly Finding[] {
  const out: Finding[] = [...importFindings(ext, files, exportsMap)];
  const name = (message: string): Finding => finding("family/name", "library.ts", 1, message, ext.package);
  const other = host.family !== undefined && splitPackage(ext.package).scope !== splitPackage(host.package).scope;
  const role = host.family === undefined ? undefined : other ? roleOfForeign(host, ext) : roleOf(host, ext.package);
  if (ext.extends !== host.package) {
    out.push(name(`${ext.package} extends ${ext.extends ?? "nothing"}, and it is checked against ${host.package}`));
    return out;
  }
  if (other && host.family?.scope !== "any") {
    out.push(name(`${ext.package} is of another scope than ${host.package}, and the family of ${host.package} takes only its own (scope: own)`));
    return out;
  }
  if (host.family === undefined || role === undefined || classify(host.family, host.package, ext.package) === undefined) {
    out.push(name(`${ext.package} is no dialect or plugin that ${host.package} declares: its table names it by the family's rule and declares it`));
    return out;
  }
  const contract = host.family.contract;
  let importsContract = false;
  for (const file of files) {
    const here = unitOf(ext, file.path);
    if (here === undefined || here.unit.kind === "own") continue;
    for (const { line, specifier } of specifiersOf(file.text)) {
      if (specifier.startsWith(".")) continue;
      const root = rootPackage(specifier);
      if (root === ext.package) continue;
      if (root === host.package) {
        if (contract !== undefined && specifier === `${host.package}${contract.slice(1)}`) importsContract = true;
        const entry = entryOf(hostExports, `.${specifier.slice(host.package.length)}`);
        const target = entry === undefined ? undefined : unitOf(host, entry.replace(/^\.\//, ""));
        if (entry === undefined || target === undefined || target.unit.kind === "own") {
          out.push(
            finding("layers/private", file.path, line, `it imports ${specifier}, which the exports of ${host.package} do not name as a unit of its layers`, specifier),
          );
          continue;
        }
        if (role.kind === "dialect" && !mayReach(role.from, target)) {
          const up = climbs(role.from, target);
          out.push(
            finding(
              up ? "layers/above" : "layers/around",
              file.path,
              line,
              `${ext.package} (a dialect of ${role.from.name}, ${layerOf(role.from.unit) ?? "own"}) imports ${specifier}, ${target.name}, which it ${up ? "stands below" : "may not reach"}`,
              specifier,
            ),
          );
        }
        continue;
      }
      const member = classify(host.family, host.package, root);
      if (member === undefined || member.kind === "host") continue;
      const code = memberFinding(role, member, root);
      if (code !== undefined)
        out.push(
          finding(
            code,
            file.path,
            line,
            `${ext.package} imports ${specifier}, a ${member.kind} of ${host.package}'s family: an extension imports no other member but a plugin it declares a dependency on`,
            specifier,
          ),
        );
    }
  }
  if (role.kind === "plugin" && contract !== undefined && !importsContract)
    out.push(finding("plugins/contract", "library.ts", 1, `${ext.package} is a plugin and does not import the plugin contract ${host.package}${contract.slice(1)}`, contract));
  return out;
}
