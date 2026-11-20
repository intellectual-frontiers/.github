// Spec: 0052-sql-quality FR-001, FR-005, FR-006, FR-008
/**
 * SQL-DQ, the SQL data quality library (commons data 0052-sql-quality): the data tests of dbt as an algebra of typed values. Generic tests with typed arguments, at the level of a column or of a model;
 * singular tests; the configuration of a use (severity, thresholds, where, limit, failCalc, stored failures, tags); selection; running through a driver on any dialect; results as a sum and as TAP.
 *
 * @example
 * ```ts
 * const tests = [
 *   ...on("orders").column("id", use(notNull), use(unique)),
 *   ...on("orders").column("status", use(acceptedValues, { values: ["open", "shipped"] }, { severity: "warn" })),
 *   ...on("orders").column("customer_id", use(relationships, { to: { name: "customer" }, field: "id" })),
 *   singular("no_future_orders", "SELECT * FROM orders WHERE placed > now()"),
 * ];
 * const outcomes = await runTests(select(tests, { tags: ["nightly"] }), driver, dialect);
 * tapText(toTap(outcomes));
 * ```
 *
 * @module
 */
export { testsFromState } from "./derive.ts";
export { acceptedRange, acceptedValues, atLeastOne, equalRowcount, equality, expressionIsTrue, notConstant, notEmptyString, notNull, relationships, unique, uniqueCombinationOfColumns } from "./generic.ts";
export { countQuery, type Impact, type Outcome, preview, runTests, storedAs, summary, toTap } from "./run.ts";
export {
  columnTest,
  exactly,
  type Context,
  type DqTest,
  type GenericTest,
  judge,
  type Level,
  meets,
  modelTest,
  on,
  type OnRelation,
  type Relation,
  select,
  type Selection,
  singular,
  type Status,
  type TestConfig,
  testName,
  type Threshold,
  use,
  type Use,
} from "./test.ts";
