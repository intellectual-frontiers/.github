// Spec: 0002-csf2-package FR-001, FR-004
/**
 * The conversion of NIST's CSF 2.0 JSON into the `grc.framework` document (0002-csf2-package FR-001, FR-004): a pure function of the source value. The active subcategories are the ones the source does not withdraw (a withdrawn one has a `WR-<id>` record
 * that it projects to); each becomes a control with its statement, the title of its category and its category as the family.
 *
 * @example
 * ```ts
 * import { convert } from "./convert.ts";
 * const r = convert({ elements: [], relationships: [] }); // { functions: [], categories: [], controls: [] }
 * ```
 *
 * @module
 */

/** A record of the source: what NIST's data service calls an element. */
export type SourceElement = { readonly element_type: string; readonly element_identifier: string; readonly title: string; readonly text: string };
/** A relationship of the source. */
export type SourceRelationship = { readonly source_element_identifier: string; readonly dest_element_identifier: string; readonly relationship_identifier: string };
/** The part of the source this conversion reads. */
export type Source = { readonly elements: readonly SourceElement[]; readonly relationships: readonly SourceRelationship[] };

/** A control of the framework. */
export type ConvertedControl = { readonly id: string; readonly title: string; readonly statement: string; readonly family: string };
/** What the source gives: the identifiers of the functions and active categories, and the controls. */
export type Converted = { readonly functions: readonly string[]; readonly categories: readonly string[]; readonly controls: readonly ConvertedControl[] };

const SUBCATEGORY = /^[A-Z]{2}\.[A-Z]{2}-\d{2}$/;

/** The active controls of the source, sorted by identifier. */
export function convert(source: Source): Converted {
  const withdrawn = new Set(source.relationships.filter((r) => r.relationship_identifier === "projection" && r.dest_element_identifier.startsWith("WR-")).map((r) => r.source_element_identifier));
  const category = new Map(source.elements.filter((e) => e.element_type === "category").map((e) => [e.element_identifier, e]));
  const controls: ConvertedControl[] = [];
  for (const e of source.elements) {
    if (e.element_type !== "subcategory" || withdrawn.has(e.element_identifier) || !SUBCATEGORY.test(e.element_identifier)) continue;
    const family = e.element_identifier.slice(0, e.element_identifier.indexOf("-"));
    controls.push({ id: e.element_identifier, title: category.get(family)?.title ?? family, statement: e.text, family });
  }
  controls.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const categories = [...new Set(controls.map((c) => c.family))];
  const functions = [...new Set(categories.map((c) => c.slice(0, 2)))];
  return { functions, categories, controls };
}
