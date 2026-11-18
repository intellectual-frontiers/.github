// Spec: 0014-sql-protected-access FR-001
/**
 * What the files of this extension take from the physical schema, in one place.
 *
 * @module
 */
export { type Dialect, type Naming, type PhysicalError, qualified, type Statement } from "@intellectual-frontiers/data/sql/physical";
export { featureId } from "@intellectual-frontiers/data/sql/logical";
