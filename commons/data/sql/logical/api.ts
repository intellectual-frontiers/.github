// Spec: 0001-layers FR-002, FR-009; 0006-logical FR-001, FR-002, FR-003, FR-012
/**
 * The public surface of the logical schema (`@intellectual-frontiers/data/sql/logical`), the second layer: a relational schema as data, made from a governance domain by a projection that
 * names its elements as lists of words, traces each to what it was made from, and reports where every annotation went; and the types of the rows of a concept. It names no engine; the
 * physical schema is made from it.
 *
 * @module
 */
import { type Composition, point } from "@intellectual-frontiers/data/engine";
import { type Projection } from "./project.ts";

export {
  type Disposition,
  type FlowEntry,
  normalized,
  normalizedProjection,
  type Projected,
  type Projection,
  type ProjectionError,
  type ProjectionOptions,
  projectDomain,
  referenceWords,
} from "./project.ts";
export type { AttributeValue, InsertOf, KeyOf, RelationshipValue, RowOf, TargetOf, ValueOf } from "./rows.ts";
export {
  carriedOf,
  type Check,
  type CheckExpression,
  type CodeRow,
  type Column,
  type ColumnRole,
  columnId,
  type ConstraintKind,
  constraintId,
  type ForeignKey,
  type Index,
  type LogicalDefault,
  type LogicalId,
  type LogicalSchema,
  type LogicalType,
  sameWords,
  columnNamed,
  featureId,
  type FeatureKind,
  tableNamed,
  schemaId,
  type Table,
  tableId,
  type TableRole,
  type Unique,
  type ValueSet,
  valueSetId,
} from "./schema.ts";

/** The contribution point an extension fills to add a projection. */
export const projectionPoint = point<Projection>("logical.projection");

/**
 * The projections of a composition, in its order.
 *
 * @param composition - the project's composition
 * @returns the projections its extensions contribute
 */
export function projectionsFrom(composition: Composition): readonly Projection[] {
  return composition.contributions(projectionPoint);
}
