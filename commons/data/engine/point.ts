// Spec: 0002-engine FR-001, FR-002
/**
 * A contribution point: a named, typed place that a layer lets extensions fill (commons data 0002-engine FR-002). The layer that offers a point
 * declares it with `point`; an extension's manifest names it and says what it contributes, typed by `T`. The engine declares no point of a layer.
 *
 * @example
 * ```ts
 * import { point } from "@intellectual-frontiers/data/engine";
 * export const vocabulary = point<{ readonly term: string }>("governance.vocabulary");
 * ```
 *
 * @module
 */

/** The name of a contribution point: a namespace, a dot and a name (`governance.vocabulary`); a name with no namespace does not compile. */
export type PointName = `${string}.${string}`;

/** A contribution point: what an extension may contribute to it is `T`, which the point's value carries for the compiler and never holds. */
export interface ContributionPoint<T> {
  /** The point's name. */
  readonly name: PointName;
  /** Never set: carries what may be contributed, for the compiler. */
  readonly __contributes?: T;
}

/**
 * Declares a contribution point.
 *
 * @param name - its namespace and name, such as `governance.vocabulary`
 * @returns the point, frozen
 */
export function point<T>(name: PointName): ContributionPoint<T> {
  return Object.freeze({ name });
}
