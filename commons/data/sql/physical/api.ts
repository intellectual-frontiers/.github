// Spec: 0001-layers FR-003, FR-009; 0005-naming FR-004, FR-005, FR-006; 0007-physical FR-001, FR-002, FR-004, FR-006, FR-011
/**
 * The public surface of the physical schema (`@intellectual-frontiers/data/sql/physical`), the third layer: a logical schema bound to one engine. A dialect says how the engine writes, a
 * case style how a name is written, and `bind` makes the statements that create the schema and load its reference data, in an order the engine accepts, each traced to the logical element
 * it was made from. The dialects are extensions of `sql/dialects/`; what a dialect cannot express is an error value.
 *
 * @module
 */
export { bind, type BindOptions } from "./bind.ts";
export { camel, type CaseStyle, caseStylePoint, caseStylesFrom, naming, type Naming, pascal, snake, writeCode } from "./case.ts";
export {
  type Dialect,
  dialectExtension,
  dialectPoint,
  dialectsFrom,
  type Feature,
  type IfExistsForm,
  type Locks,
  type Rebuild,
  type Probes,
  type Literal,
  quoteName,
  standardLiteral,
} from "./dialect.ts";
export {
  type Artifact,
  generate,
  type GenerateContext,
  type GenerateError,
  type GenerateOptions,
  type Generator,
  generatorsFrom,
  generatorsPoint,
} from "./generate.ts";
export { type Expressor, expressor, type Names, writeNames } from "./express.ts";
export { qualified } from "./qualify.ts";
export { upsert } from "./upsert.ts";
export {
  type BindContext,
  GROUPS,
  type Group,
  type Origin,
  type Physical,
  type PhysicalError,
  clausesFrom,
  render,
  sourcesFrom,
  type TableClause,
  tableClausesPoint,
  type Statement,
  type StatementSource,
  statementsPoint,
  type Written,
} from "./statement.ts";
