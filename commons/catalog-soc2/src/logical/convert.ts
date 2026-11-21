// Spec: 0002-soc2-package FR-001, FR-004
/**
 * The conversion of the criteria into the controls of the framework (0002-soc2-package FR-001, FR-004): a pure function of the criteria. Each control keeps the identifier of its criterion, its title and its statement, and names its series (`CC6`) as its family.
 * A criterion that repeats an identifier is an error of the source, and the conversion says so rather than choose.
 *
 * @example
 * ```ts
 * import { convert } from "./convert.ts";
 * convert([{ id: "CC1.1", title: "t", statement: "s", family: "CC1" }]).controls.length; // 1
 * ```
 *
 * @module
 */
import type { Criterion } from "@intellectual-frontiers/catalog-soc2/governance";

/** A control of the framework document. */
export type OutControl = { readonly id: string; readonly title: string; readonly statement: string; readonly family: string };

/** The controls, or the identifiers that the source repeats. */
export type Converted = { readonly controls: readonly OutControl[]; readonly repeated: readonly string[] };

/** The controls of the criteria, in the order given. */
export function convert(criteria: readonly Criterion[]): Converted {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const c of criteria) {
    if (seen.has(c.id)) repeated.push(c.id);
    seen.add(c.id);
  }
  return { controls: criteria.map((c) => ({ id: c.id, title: c.title, statement: c.statement, family: c.family })), repeated };
}
