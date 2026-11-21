// Spec: 0002-estate-iac-model FR-001, FR-002, FR-003
/**
 * What an importer gives: assets and links of the estate, each asset with where it came from. An importer reads a file (or the text of one) and runs no tool; it copies only the attributes the estate's catalog names (never the values of a resource, which hold secrets in state), and says in `problems`
 * what it could not read, so that nothing is dropped without a word.
 *
 * @example
 * ```ts
 * import { slug } from "./model.ts";
 * slug("tf", "aws_instance.web[0]"); // "tf-aws-instance-web-0"
 * ```
 *
 * @module
 */
import type { AttributeValue } from "@intellectual-frontiers/estate/governance";

/** The tools whose files are read. */
export const TOOLS = ["opentofu", "terraform", "cloudformation", "kubernetes", "compose", "pulumi"] as const;
/** A tool whose files are read. */
export type Tool = (typeof TOOLS)[number];

/** An asset an importer found: its identity, kind and attributes (with `provenance` among them). The state of the asset is `discovered`: reading code adopts nothing. */
export type Imported = { readonly id: string; readonly kind: string; readonly attributes: Readonly<Record<string, AttributeValue>> };

/** A link an importer found, between the identities of two imported assets. */
export type ImportedLink = { readonly from: string; readonly to: string; readonly kind: string };

/** What an importer gives for one file. */
export type Imports = { readonly tool: Tool; readonly source: string; readonly assets: readonly Imported[]; readonly links: readonly ImportedLink[]; readonly problems: readonly string[] };

/** Where an asset was read from, as `tool:file#address`. */
export function provenanceOf(tool: Tool, source: string, address: string): string {
  return `${tool}:${source}#${address}`;
}

/** An asset identity from words: lower case, letters and digits joined by hyphens, starting with the first word (a prefix that begins with a letter), at most 100 characters. */
export function slug(...parts: readonly string[]): string {
  const text = parts.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return text.slice(0, 100).replace(/-+$/g, "");
}

/** A set of identities in use, that gives the first free one: the identity, then it with `-2`, `-3` and so on. */
export class IdPool {
  readonly #used = new Set<string>();
  take(base: string): string {
    let id = base;
    for (let n = 2; this.#used.has(id); n += 1) id = `${base}-${n}`.slice(-100);
    this.#used.add(id);
    return id;
  }
}

/** The link between two imported assets where the first needs the second, named by the kinds of both: an endpoint that needs a resource is exposed by it, an endpoint that needs a certificate is secured by it, a name that needs an asset resolves to it, and any other is a dependency. */
export function linkFor(needs: Imported, needed: Imported): ImportedLink {
  if (needs.kind === "endpoint" && needed.kind === "cloud-resource") return { from: needed.id, to: needs.id, kind: "exposes" };
  if ((needs.kind === "endpoint" || needs.kind === "domain") && needed.kind === "certificate") return { from: needs.id, to: needed.id, kind: "secured-by" };
  if (needs.kind === "domain" && (needed.kind === "endpoint" || needed.kind === "cloud-resource")) return { from: needs.id, to: needed.id, kind: "resolves-to" };
  return { from: needs.id, to: needed.id, kind: "depends-on" };
}

/** The attributes without the ones that have no value. */
export function present(a: Readonly<Record<string, AttributeValue | undefined>>): Readonly<Record<string, AttributeValue>> {
  return Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined && v !== "")) as Record<string, AttributeValue>;
}

/** Links without the ones that repeat or join an asset to itself, in order. */
export function distinctLinks(links: readonly ImportedLink[]): readonly ImportedLink[] {
  const seen = new Set<string>();
  const out: ImportedLink[] = [];
  for (const l of links) {
    const key = `${l.from}\u0000${l.to}\u0000${l.kind}`;
    if (l.from === l.to || seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}
