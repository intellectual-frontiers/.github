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
export { type Action, type Applied, applyChange, type Change, diffOf, type FileError, pgpassModeOk, planBlock, type Want } from "./files.ts";
export { type BlockError, blockOf, markers, type Style, withBlock, withoutBlock } from "./blocks.ts";
export { type Chosen, mayAsk, mayWriteHome, type Mode, modeOf, type Read, secretOf, type ServerSettings, serverSettings } from "./server.ts";
export { type Host, isPlatform, type Paths, pathsOf, type Platform, type Profile, profileTargets, type Shell, shellOf, shells } from "./workstation.ts";
export { type Command, commands, envJson, pgoptionsOf, quoteFish, quoteNu, quotePosix, quotePwsh, type ShellInput, shellScript, variablesOf } from "./shell.ts";
export { type Credential, checkCredential, checkInstance, fixModes, type Instance, type Key, type Plan, type PgpassChange, parsePgpass, parseServices, pgpassLine, planPgpass, planPsql, planServices, planUndo, psqlrcBody, readInstances, serviceSection, splitPgpass, type WriteError } from "./libpq.ts";
