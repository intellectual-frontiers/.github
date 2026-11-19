// Spec: 0046-arcactl FR-002, FR-003
/**
 * `arcactl` as a library (commons data 0046-arcactl): the configuration and the models it knows, the connection, the checks of `doctor` and the command line as a function.
 *
 * @module
 */
export { type Arca, type ArcaConfig, allModules, type ConfigError, defineArca, loadConfig, type ModelName, modelNames, schemaOf, settingsOf } from "./config.ts";
export { connect, type Connection, type ConnectOptions } from "./connection.ts";
export { type CheckResult, checkIds, doctor, renderReport, type Report, type Status } from "./doctor.ts";
export { type Io, main, type Outcome, USAGE } from "./main.ts";
export { passwordOf, redact } from "./redact.ts";
