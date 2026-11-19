// Spec: 0049-sql-assertions FR-001
/**
 * Assertions about a database and the results of running them (commons data 0049-sql-assertions): structural assertions made from a schema's state, `rows` and `fails` assertions of one's own, pgTAP, TAP
 * from a query any dialect runs, and a runner over a driver; results are TAP.
 *
 * @example
 * ```ts
 * const state = must(snapshotOf(schema, { dialect }));
 * const nodes = await runAssertions([...structuralTests(state, dialect), rows("one author", "SELECT count(*) FROM author", [[1]])], driver, dialect);
 * tapText(nodes); // TAP version 14 ...
 * ```
 *
 * @module
 */
export { type Assertion, describeAssertion, fails, type Named, pgTapScript, rows, runAssertions, structuralTests, tapQuery } from "./assert.ts";
export { type Diagnostic, type Directive, failed, fromLines, pass, skipped, tally, type TapNode, tapText } from "./tap.ts";
