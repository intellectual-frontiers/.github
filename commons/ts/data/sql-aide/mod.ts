/**
 * IFC SQL Aide: the public entry point (commons 0009-sql-aide). A schema is written once as TypeScript algebraic types and rendered as
 * SQL for PostgreSQL, SQLite and DuckDB; a library built with it (Arca, Data Vault) imports this module and nothing else of it.
 *
 * @example
 * ```ts
 * import { context, date, fk, pk, postgres, render, SQL, table, text } from "./mod.ts";
 * const party = table("party", { party_id: pk.ulid(), name: text() });
 * const person = table("person", { party_id: fk(party.c.party_id).primaryKey(), born: date().nullable() });
 * render(SQL`${party.ddl}\n${person.ddl}`, context({ dialect: postgres() }));
 * ```
 *
 * @module
 */
export type { Brand, Result } from "../../kernel/mod.ts";
export {
  arrayOf,
  bigint,
  boolean,
  bytes,
  column,
  date,
  fk,
  integer,
  json,
  jsonb,
  numeric,
  oneOf,
  pk,
  real,
  self,
  text,
  timestamp,
  timestamptz,
  uuid,
} from "./algebra/column.ts";
export type {
  AnyColumn,
  Column,
  ColumnSpec,
  Fill,
  FillOf,
  NullOf,
  PdTerm,
  Personal,
  Referable,
  Reference,
  ReferentialAction,
  ReqOfColumn,
  SelfColumn,
  ValueOf,
} from "./algebra/column.ts";
export {
  arrayDomain,
  bigintDomain,
  booleanDomain,
  bytesDomain,
  dateDomain,
  domain,
  enumDomain,
  integerDomain,
  jsonDomain,
  numericDomain,
  realDomain,
  textDomain,
  timestampDomain,
  timestamptzDomain,
  uuidDomain,
} from "./algebra/domain.ts";
export type { Domain, DomainKind, DomainSpec, Json, SqlValue } from "./algebra/domain.ts";
export { partitionBy, table } from "./algebra/table.ts";
export type {
  AnyTable,
  ColumnMap,
  ColumnRef,
  InsertRow,
  KeyValues,
  NewRowOf,
  Partition,
  PartitionBounds,
  PartitionedTable,
  PartitionStrategy,
  PkKeys,
  PatchOf,
  RowOf,
  Refs,
  ReqOfColumns,
  SelectRow,
  SelfTargetsExist,
  Table,
  TableCheck,
  TableOptions,
  TableSpec,
  UpdateRow,
  ValueIn,
} from "./algebra/table.ts";
export { fitName, token, unindent } from "./core/text.ts";
export type { Token } from "./core/text.ts";
export { index } from "./ddl/index.ts";
export type { BareColumns, Index, IndexMethod } from "./ddl/index.ts";
export { enumType, extension, pgDomain, policy, rowLevelSecurity, schema, sequence } from "./ddl/objects.ts";
export type { DbObject, EnumType, PgDomain, PolicyOptions } from "./ddl/objects.ts";
export { view } from "./ddl/view.ts";
export type { View, ViewOptions, ViewRefs } from "./ddl/view.ts";
export { describeAssertion, fails, notRun, pgTapScript, rows, runAssertions, structuralTests, tapQuery } from "./test/assert.ts";
export type { Assertion, Runner, Structure } from "./test/assert.ts";
export { csvModule } from "./integrate/codegen.ts";
export type { CsvModuleError, CsvModuleOptions } from "./integrate/codegen.ts";
export { fromAdapter, fromAttached, fromCsv, fromSource, readAdapter, seed } from "./integrate/integration.ts";
export type {
  AdapterError,
  AdapterPending,
  AnyIntegration,
  Covers,
  InsertColumn,
  Integration,
  LandingRow,
  LineageEdge,
  LoadOptions,
  Plain,
  RequiredColumn,
  SourceAdapter,
  SourceKind,
  SourceSpec,
  Strategy,
} from "./integrate/integration.ts";
export { lineageOf, lineageTable, recordLineage, upstream } from "./integrate/lineage.ts";
export { inspect, LEDGER } from "./islm/catalog.ts";
export type { Catalog, CatalogColumn, InspectError } from "./islm/catalog.ts";
export { differences, ISLM_COMPARED, readObjects } from "./islm/deep.ts";
export type { CatalogObject, ObjectKind } from "./islm/deep.ts";
export { apply, ledgerTable, lintPlan, plan, planScript, shadow, step, teardown, undo } from "./islm/islm.ts";
export type {
  Applied,
  ApplyError,
  ApplyOptions,
  Change,
  ChangeKind,
  Classification,
  Desired,
  Plan,
  PlanFinding,
  PlanOptions,
  Shadow,
  Step,
  TeardownRefused,
} from "./islm/islm.ts";
export { cte, deleteFrom, domainOf, except, from, insertInto, intersect, union, unionAll, update, withCtes } from "./query/builder.ts";
export type {
  BrandsIn,
  Cte,
  Insert,
  Joinable,
  JoinsByKey,
  Nullable,
  Query,
  Relation,
  Returning,
  RowOfColumns,
  SetOf,
  Shaped,
  Which,
  Writable,
  YieldOf,
} from "./query/builder.ts";
export { desc, rowsAs, select, valueAs } from "./query/select.ts";
export type { Select } from "./query/select.ts";
export { fn, nothing, proc, rowsOf, scalar, setOf, trigger } from "./routine/routine.ts";
export type {
  ArgMap,
  ArgRefs,
  ArgValue,
  Block,
  BodyFits,
  BodyKind,
  CallableIn,
  CallArgs,
  DefinedFor,
  Pl,
  Returns,
  Routine,
  RoutineOptions,
  Stmt,
  Template,
  Trigger,
  TriggerOptions,
  Variable as BlockVariable,
} from "./routine/routine.ts";
export { duckdb, postgres, sqlite } from "./dialect/dialects.ts";
export type {
  CommonFeature,
  Duckdb,
  DuckdbFeature,
  Postgres,
  PostgresFeature,
  Sqlite,
  SqliteFeature,
  TierOne,
} from "./dialect/dialects.ts";
export { decode, duckdbDriver, pgliteDriver, postgresDriver, sqliteDriver } from "./driver/driver.ts";
export type {
  Driver,
  DriverError,
  DuckdbConnection,
  DuckdbParam,
  PgClient,
  PgliteClient,
  RunsIn,
  SqliteClient,
  SqliteParam,
} from "./driver/driver.ts";
export { buildSql, clientCommand, dataOf, naturalKey, sizeFindings } from "./target/build.ts";
export type { EphemeralBuild, TableData } from "./target/build.ts";
export { cli } from "./cli/cli.ts";
export type { Io, Project, ProjectBuild, ProjectDialect } from "./cli/cli.ts";
export { docsModule, docsOf, extractDocs, parseComment } from "./docs/tsdoc.ts";
export { d2Erd, dataDictionary, generators, mermaidErd, rustStructs, zodSchemas } from "./generate/generators.ts";
export type { GeneratedFile, Generator } from "./generate/generators.ts";
export { PGVECTOR_MAX_INDEXED, pgvectorExtension, pgvectorPlugin, vector } from "./plugins/pgvector.ts";
export type { PgvectorFeature } from "./plugins/pgvector.ts";
export type { ParsedComment } from "./docs/tsdoc.ts";
export { bracketNaming, context, emitted, prefixedNaming, qualifiedNaming, typicalNaming } from "./emit/context.ts";
export type {
  ChangeClass,
  ConstraintKind,
  Dialect,
  DialectExtension,
  Durability,
  Docs,
  EmitContext,
  EmitEvent,
  EntityDoc,
  Execution,
  FeaturesOf,
  Hooks,
  NameOf,
  Naming,
  Plugin,
} from "./emit/context.ts";
export { emitFiles, variable, VERSION } from "./emit/coordinator.ts";
export type { EmittedFile, FilePart, Variable } from "./emit/coordinator.ts";
export { and, call, eq, gt, gte, inList, isNotNull, isNull, lt, lte, ne, not, now, or } from "./emit/expr.ts";
export type { Expr, Operand } from "./emit/expr.ts";
export {
  asKind,
  bind,
  byDialect,
  empty,
  join,
  name,
  raw,
  render,
  renderUnchecked,
  SQL,
  sql,
  statement,
  statementUnchecked,
} from "./emit/sql.ts";
export type { AnySql, Chunk, DxOf, Fits, Interpolation, ReqOf, Sql, SqlKind, Statement } from "./emit/sql.ts";
export { DPV_NAMESPACE, DPV_VERSION, pd, PD_NAMESPACE } from "./govern/dpv.auto.ts";
export { housekeeping } from "./govern/housekeeping.ts";
export type { Housekeeping } from "./govern/housekeeping.ts";
export { descriptionRule, lint, namingRule, ownerRule, personalDataRule, primaryKeyRule, typicalRules } from "./govern/lint.ts";
export type { Finding, Linted, LintRule } from "./govern/lint.ts";
export { definitions, entityKey, ordered } from "./model/entity.ts";
export type { CycleError, Entity, EntityName } from "./model/entity.ts";
export { failed, fromLines, pass, skipped, tally, tapText } from "./test/tap.ts";
export {
  acceptedValues,
  custom,
  failingRows,
  findingsTable,
  notNull,
  recordFindings,
  relationship,
  reportFindings,
  unique,
} from "./transform/checks.ts";
export type { Check, Tested } from "./transform/checks.ts";
export { model } from "./transform/transform.ts";
export type { AnyModel, Materialization, MaterializationReq, Model, ModelOptions, ModelQuery } from "./transform/transform.ts";
export type { Diagnostic, Directive, TapNode } from "./test/tap.ts";
