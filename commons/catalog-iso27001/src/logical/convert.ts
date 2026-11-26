// Spec: 0002-iso27001-package FR-001, FR-004
/**
 * The conversion of the entries of this package into the documents it holds (0002-iso27001-package FR-001, FR-004): pure functions of the entries. Each entry becomes a control with the identifier it is known by, its title, its statement and its group as family;
 * an identifier that a framework repeats is an error of the source, and the conversion says so rather than choose.
 *
 * @example
 * ```ts
 * import { convert } from "./convert.ts";
 * convert([{ id: "A.5.1", title: "t", statement: "s", family: "organizational" }]).controls.length; // 1
 * ```
 *
 * @module
 */
import type { Entry } from "@intellectual-frontiers/catalog-iso27001/governance";

/** A control of a framework document. */
export type OutControl = { readonly id: string; readonly title: string; readonly statement: string; readonly family: string };

/** The controls, or the identifiers that the source repeats. */
export type Converted = { readonly controls: readonly OutControl[]; readonly repeated: readonly string[] };

/** The controls of the entries, in the order given. */
export function convert(entries: readonly Entry[]): Converted {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const e of entries) {
    if (seen.has(e.id)) repeated.push(e.id);
    seen.add(e.id);
  }
  return { controls: entries.map((e) => ({ id: e.id, title: e.title, statement: e.statement, family: e.family })), repeated };
}
