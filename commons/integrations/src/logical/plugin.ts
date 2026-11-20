// Spec: 0008-integrations-plugins FR-001, FR-002, FR-003, FR-004
/**
 * The plugin contract of standards (commons integrations 0008-integrations-plugins): a standard is a package that gives the library a codec (parse and serialize
 * one syntax to the abstract tree) and loaders (read the machine-readable definitions of schemas, profiles and terminologies from data the user supplies or the
 * issuer publishes), behind typed ports, and registers its standards with their licences. The library embeds none of any standard.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { sourceAllowed, type Ref, type Source, type Standard, type StandardUrn } from "@intellectual-frontiers/integrations/governance";
import type { Profile, Schema, Terminology } from "./constraints.ts";
import type { Acknowledgement } from "./exchange.ts";
import type { Interchange } from "./tree.ts";

/** Why a text is not of a syntax: a code and an offset, never the text. */
export type SyntaxCode = "empty" | "bad-envelope" | "bad-delimiter" | "bad-character" | "bad-structure" | "unbalanced" | "too-long" | "unexpected-end";
/** A problem of the first level of validation: the offset at which the text could not be read. */
export type SyntaxProblem = { readonly kind: "syntax"; readonly code: SyntaxCode; readonly offset: number };

/** The codec port of one syntax: parse a text to the tree and serialize the tree to a text. */
export type Codec = {
  readonly syntax: Ref<"syntax">;
  readonly parse: (text: string) => Result<Interchange, SyntaxProblem>;
  readonly serialize: (i: Interchange) => Result<string, SyntaxProblem>;
};

/** What a loader is given: where the text came from, which standard it defines and the text. */
export type Supplied = { readonly origin: Source; readonly standard: StandardUrn; readonly text: string };

/** Why a definition is not loaded. */
export type LoadError =
  | { readonly kind: "source-not-allowed"; readonly standard: StandardUrn; readonly origin: Source }
  | { readonly kind: "malformed"; readonly standard: StandardUrn; readonly code: "not-json" | "not-xml" | "wrong-resource" | "no-elements" }
  | { readonly kind: "unknown-standard"; readonly standard: StandardUrn };

/** What a definition gives. */
export type Definitions = { readonly schemas: readonly Schema[]; readonly profiles: readonly Profile[]; readonly terminologies: readonly Terminology[] };

/** The loader port: a definition in, schemas, profiles and terminologies out. */
export type Loader = { readonly standard: StandardUrn; readonly load: (supplied: Supplied) => Result<Definitions, LoadError> };

/** The port that makes and reads the acknowledgements of a standard. */
export type AckPort = {
  readonly acknowledge: (received: Interchange, status: "accepted" | "accepted-with-errors" | "rejected") => Result<Interchange, SyntaxProblem>;
  readonly read: (i: Interchange) => Result<readonly Acknowledgement[], SyntaxProblem>;
};

/** A plugin: the standards it registers and the ports it gives. */
export type StandardsPlugin = {
  readonly id: string;
  readonly standards: readonly Standard[];
  readonly codec: Codec;
  readonly loaders: readonly Loader[];
  readonly acks: AckPort | undefined;
};

/** Plugins by the urn of the syntax they parse. */
export type PluginRegistry = ReadonlyMap<StandardUrn, StandardsPlugin>;

/** Why a plugin is not registered. */
export type PluginError =
  | { readonly kind: "syntax-taken"; readonly urn: StandardUrn; readonly by: string }
  | { readonly kind: "no-such-standard"; readonly urn: StandardUrn }
  | { readonly kind: "loader-for-unlisted"; readonly urn: StandardUrn };

/** The registry with a plugin: its codec's syntax must be one of its standards at the level `syntax`, and each loader's standard one of its own. */
export function registerPlugin(reg: PluginRegistry, p: StandardsPlugin): Result<PluginRegistry, PluginError> {
  const taken = reg.get(p.codec.syntax.urn);
  if (taken !== undefined) return err({ kind: "syntax-taken", urn: p.codec.syntax.urn, by: taken.id });
  const own = new Map(p.standards.map((s) => [s.urn, s] as const));
  const syntax = own.get(p.codec.syntax.urn);
  if (syntax === undefined || syntax.level !== "syntax") return err({ kind: "no-such-standard", urn: p.codec.syntax.urn });
  for (const l of p.loaders) if (!own.has(l.standard)) return err({ kind: "loader-for-unlisted", urn: l.standard });
  return ok(new Map([...reg, [p.codec.syntax.urn, p]]));
}

/** A definition taken from a source only where the licence of its standard lets that source be used. */
export function loadFrom(plugin: StandardsPlugin, supplied: Supplied): Result<Definitions, LoadError> {
  const standard = plugin.standards.find((s) => s.urn === supplied.standard);
  if (standard === undefined) return err({ kind: "unknown-standard", standard: supplied.standard });
  if (!sourceAllowed(standard.license, supplied.origin)) return err({ kind: "source-not-allowed", standard: supplied.standard, origin: supplied.origin });
  const loader = plugin.loaders.find((l) => l.standard === supplied.standard);
  if (loader === undefined) return err({ kind: "unknown-standard", standard: supplied.standard });
  return loader.load(supplied);
}

/** The first plugin that parses a text, with its tree: the syntaxes are tried in the order of the registry. */
export function detect(reg: PluginRegistry, text: string): Result<{ readonly plugin: StandardsPlugin; readonly tree: Interchange }, SyntaxProblem> {
  let last: SyntaxProblem = { kind: "syntax", code: "empty", offset: 0 };
  for (const plugin of reg.values()) {
    const r = plugin.codec.parse(text);
    switch (r.kind) {
      case "ok":
        return ok({ plugin, tree: r.value });
      case "err":
        last = r.error;
        break;
      default:
        return absurd(r);
    }
  }
  return err(last);
}
