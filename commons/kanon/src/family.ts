// Spec: 0001-kanon-checker FR-010, FR-011
/**
 * The family of a Kanon library (commons 0033-kanon FR-021): the naming rule of the packages that extend a host, as data of the host's table, and the names that rule makes and reads. A host
 * `@scope/archon` has dialects `@scope/archon-dialect-<tool>` and plugins `@scope/archon-<noun>`; the rule is two templates, never a pattern in a program.
 *
 * @remarks
 * Parse, don't validate: an instance name, a plugin noun and a template are branded types made only by their smart constructors, so a function that takes one never checks it again. The name of a
 * member is derived from the rule (`memberPackage`), never written twice, and read back by `classify`, which returns one case of the closed union `Member`; a dialect is tried before a plugin, so a
 * noun that would read as a dialect (`dialect-x`) is not a plugin, and `memberPackage` refuses it.
 *
 * @example
 * ```ts
 * import { classify, parseNameTemplate, parsePackageName } from "@intellectual-frontiers/kanon";
 * ```
 *
 * @module
 */
import { absurd, type Brand, err, ok, refine, type Result, string } from "@intellectual-frontiers/core";
import { type PackageName, parsePackageName } from "./names.ts";

/** The name of one dialect of a host, as `ansible`: made only by `parseInstanceName`. */
export type InstanceName = Brand<string, "kanon instance name">;
/** The noun of one plugin of a host, as `server`: made only by `parsePluginNoun`. */
export type PluginNoun = Brand<string, "kanon plugin noun">;
/** A template of the name of a family's packages, with `{host}` and `{name}` once each: made only by `parseNameTemplate`. */
export type NameTemplate = Brand<string, "kanon name template">;

const WORD = "[a-z0-9]+(?:-[a-z0-9]+)*";
const instanceDecoder = refine(string, "kanon instance name", (t) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(t));
const nounDecoder = refine(string, "kanon plugin noun", (t) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(t));
const templateDecoder = refine(
  string,
  "kanon name template",
  (t) => /^[a-z0-9{}-]+$/.test(t) && t.split("{host}").length === 2 && t.split("{name}").length === 2,
);

/** An instance name from text, or why the text is not one. */
export function parseInstanceName(text: string): Result<InstanceName, string> {
  const r = instanceDecoder(text, "instance");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not an instance name: lower-case words joined by hyphens, as ansible or cloud-init`);
}

/** A plugin noun from text, or why the text is not one. */
export function parsePluginNoun(text: string): Result<PluginNoun, string> {
  const r = nounDecoder(text, "noun");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a plugin noun: lower-case words joined by hyphens, as server`);
}

/** A name template from text, or why the text is not one: it holds `{host}` once and `{name}` once, and lower-case letters, digits and hyphens. */
export function parseNameTemplate(text: string): Result<NameTemplate, string> {
  const r = templateDecoder(text, "template");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a name template: it holds {host} once, {name} once, and lower-case letters, digits and hyphens, as {host}-dialect-{name}`);
}

/** The naming rule of a family, as data (0033-kanon FR-021): a template for the dialects and one for the plugins, and optionally the export of the host that defines what a plugin is. */
export type FamilyRule = {
  readonly dialect: NameTemplate;
  readonly plugin: NameTemplate;
  /** The subpath of the host's `exports` that is the plugin contract (`./plugin`): each plugin imports it, and the host exports it. */
  readonly contract?: string;
};

/** What a package of a family is: a closed union. */
export type Member =
  | { readonly kind: "host" }
  | { readonly kind: "dialect"; readonly name: InstanceName }
  | { readonly kind: "plugin"; readonly noun: PluginNoun };

/** The scope of a package name (`@scope/`, or empty) and its base. */
export function splitPackage(name: string): { readonly scope: string; readonly base: string } {
  const slash = name.indexOf("/");
  return name.startsWith("@") && slash > 0 ? { scope: name.slice(0, slash + 1), base: name.slice(slash + 1) } : { scope: "", base: name };
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function pattern(template: NameTemplate, host: string): RegExp {
  return new RegExp(`^${escape(template).replace(escape("{host}"), escape(host)).replace(escape("{name}"), `(${WORD})`)}$`);
}

/** The package of a member of the host's family, from the rule: the one way a member's package name is made. A plugin whose noun would read as a dialect is refused. */
export function memberPackage(
  rule: FamilyRule,
  host: PackageName,
  member: Exclude<Member, { readonly kind: "host" }>,
): Result<PackageName, string> {
  const { scope, base } = splitPackage(host);
  switch (member.kind) {
    case "dialect": {
      const name = `${scope}${rule.dialect.replace("{host}", base).replace("{name}", member.name)}`;
      return parsePackageName(name);
    }
    case "plugin": {
      const name = `${scope}${rule.plugin.replace("{host}", base).replace("{name}", member.noun)}`;
      const back = classify(rule, host, name);
      if (back?.kind === "dialect") return err(`${JSON.stringify(member.noun)} would name a dialect, not a plugin: ${name}`);
      return parsePackageName(name);
    }
    default:
      return absurd(member);
  }
}

/** What a package name is in the host's family: the host itself, a dialect, a plugin, or none of them (`undefined`). A dialect is tried before a plugin. */
export function classify(rule: FamilyRule, host: PackageName, candidate: string): Member | undefined {
  const h = splitPackage(host);
  const c = splitPackage(candidate);
  if (c.scope !== h.scope) return undefined;
  if (c.base === h.base) return { kind: "host" };
  const dialect = pattern(rule.dialect, h.base).exec(c.base)?.[1];
  if (dialect !== undefined) {
    const n = parseInstanceName(dialect);
    return n.kind === "ok" ? { kind: "dialect", name: n.value } : undefined;
  }
  const noun = pattern(rule.plugin, h.base).exec(c.base)?.[1];
  if (noun !== undefined) {
    const n = parsePluginNoun(noun);
    return n.kind === "ok" ? { kind: "plugin", noun: n.value } : undefined;
  }
  return undefined;
}

/** The package an import specifier names: `@scope/name/sub` is `@scope/name`. */
export function rootPackage(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}
