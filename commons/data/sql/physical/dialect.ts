// Spec: 0007-physical FR-004, FR-005
/**
 * The dialect (commons data 0007-physical FR-004): how one engine writes what a logical schema says. A dialect is a value: how a name is quoted and a literal written, the type of each logical
 * type, how the moment of the insert is a default, whether it can say a pattern, whether it has `COMMENT ON`, and how long a name may be. The library's three are extensions of `sql/dialects/`,
 * which contribute themselves through the engine's point `physical.dialect`; what a dialect cannot express is an error of `bind`, never SQL its engine refuses.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import {
  type Composition,
  contribute,
  defineExtension,
  type Extension,
  extensionId,
  type IdError,
  point,
} from "@intellectual-frontiers/data/engine";
import type { LogicalType } from "@intellectual-frontiers/data/sql/logical";

/** What a dialect can do beyond the common ground. */
export type Feature = "comment-on" | "regex-check" | "add-constraint";

/** A literal a statement may hold. */
export type Literal = string | number | boolean | null;

/** One engine's way of writing. */
export interface Dialect {
  readonly name: string;
  readonly features: readonly Feature[];
  /** The longest a name may be. */
  readonly maxName: number;
  /** The default that is the moment of the insert. */
  readonly now: string;
  quote(name: string): string;
  literal(value: Literal): string;
  type(type: LogicalType): string;
  /** A check that a column matches a regular expression, or none where the engine has no way to say it. */
  pattern?(column: string, pattern: string): string;
}

/** A name in double quotes, a quote in it doubled: how SQL's standard writes an identifier. */
export const quoteName = (name: string): string => `"${name.replaceAll('"', '""')}"`;

/** A literal as SQL's standard writes it: text in single quotes with a quote doubled, true and false, a number as it is, null. */
export function standardLiteral(value: Literal): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

/** The contribution point an extension fills to add a dialect. */
export const dialectPoint = point<Dialect>("physical.dialect");

/**
 * The dialects of a composition, in its order.
 *
 * @param composition - the project's composition
 * @returns the dialects its extensions contribute
 */
export function dialectsFrom(composition: Composition): readonly Dialect[] {
  return composition.contributions(dialectPoint);
}

/**
 * An extension that contributes a dialect, named `sql.dialect.<name>`.
 *
 * @param d - the dialect
 * @param version - the extension's version
 * @returns the extension, or why its identifier is not one
 */
export function dialectExtension(d: Dialect, version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId(`sql.dialect.${d.name}`);
  return id.kind === "err" ? err(id.error) : ok(defineExtension({ id: id.value, version, contributes: [contribute(dialectPoint, d)] }));
}
