// Spec: 0007-physical FR-001, FR-002
/**
 * Case styles and naming (commons data 0007-physical FR-001, FR-002): how a list of words is written as a name. `snake`, `camel` and `pascal` are the library's own, snake case is the
 * default, and an extension adds another through the engine's point `physical.caseStyle`. The stored value of a code is written by a style too, so that `employedBy` is stored as `employed_by`
 * in a snake case database and the data already there stays what it was; a project may keep the codes as their names.
 *
 * @module
 */
import { type Composition, point } from "@intellectual-frontiers/data/engine";
import { type Words, words } from "@intellectual-frontiers/data/governance";

/** A case style: a name, and how it writes words. */
export interface CaseStyle {
  readonly name: string;
  readonly write: (words: Words) => string;
}

const capital = (w: string): string => (w === "" || /^[0-9]/.test(w) ? w : (w[0] ?? "").toUpperCase() + w.slice(1));

/** Words joined by an underscore: `given_name`, `line_1`. */
export const snake: CaseStyle = { name: "snake", write: (w) => w.join("_") };
/** Words joined, each after the first with a capital: `givenName`, `line1`. */
export const camel: CaseStyle = { name: "camel", write: (w) => w.map((x, i) => (i === 0 ? x : capital(x))).join("") };
/** Words joined, each with a capital: `GivenName`, `Line1`. */
export const pascal: CaseStyle = { name: "pascal", write: (w) => w.map(capital).join("") };

/** The contribution point an extension fills to add a case style. */
export const caseStylePoint = point<CaseStyle>("physical.caseStyle");

/**
 * The case styles of a composition, in its order.
 *
 * @param composition - the project's composition
 * @returns the styles its extensions contribute
 */
export function caseStylesFrom(composition: Composition): readonly CaseStyle[] {
  return composition.contributions(caseStylePoint);
}

/** How names, and the stored values of codes, are written. */
export interface Naming {
  /** The style of the names of tables, columns, constraints and indexes. */
  readonly names: CaseStyle;
  /** The style of the stored values of codes, or `name` to store a code as its name. */
  readonly codes: CaseStyle | "name";
}

/**
 * A naming.
 *
 * @param names - the style of the names; snake case where none is given
 * @param codes - the style of the stored codes; the style of the names where none is given
 * @returns the naming
 */
export function naming(names: CaseStyle = snake, codes: CaseStyle | "name" = names): Naming {
  return { names, codes };
}

/** The stored value of a code. */
export function writeCode(n: Naming, code: string): string {
  return n.codes === "name" ? code : n.codes.write(words(code));
}
