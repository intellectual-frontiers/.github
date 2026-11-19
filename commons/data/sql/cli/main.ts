// Spec: 0046-arcactl FR-001, FR-002, FR-003, FR-009
/**
 * The command line of `arcactl` (commons data 0046-arcactl): `doctor` first. It is a function of its arguments and environment that returns the exit code and what to print, so that a test runs it
 * on any database; the file `arcactl.ts` only gives it the real process. Exit codes: 0 every check passed, 1 a check warned, failed or could not be made, 2 the command was wrong or the database
 * could not be reached.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type ArcaConfig, type ConfigError, loadConfig, type ModelName, modelNames, schemaOf, settingsOf } from "./config.ts";
import { type Connection, connect as realConnect, type ConnectOptions } from "./connection.ts";
import { checkIds, doctor, renderReport } from "./doctor.ts";
import { passwordOf, redact } from "./redact.ts";
import { modeOf, secretOf } from "./server.ts";

/** What the command line is given besides its arguments. */
export interface Io {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  /** Whether input and output are a terminal, which decides between the workstation and the server (0047-arcactl-init FR-004). */
  readonly tty?: boolean;
  /** Reads a file, for a secret given as `<NAME>_FILE`. */
  readonly read?: (path: string) => string;
  /** Makes the connection; the real one by default, and a test's own where a test gives one. */
  readonly connect?: (o: ConnectOptions) => Promise<Connection>;
}

/** What the command line did. */
export interface Outcome {
  readonly code: 0 | 1 | 2;
  readonly out: string;
  readonly err: string;
}

export const USAGE = `arcactl: manage and check an arca database in PostgreSQL

  arcactl doctor [options]     check the database against the models (read-only)

options:
  --config <file>     arca.config.ts (default: ./arca.config.ts where there is one)
  --models <a,b,...>  the models wanted, where there is no config: ${modelNames.join(", ")}
  --schema <name>     the schema the tables are in (default: arca)
  --check <ids>       only these checks, as ARCA-D001,ARCA-D005
  --json              machine-readable output
  --url <url>         connection URL; prefer ARCA_DATABASE_URL (or ARCA_DATABASE_URL_FILE), since arguments show in the process list
  --non-interactive   run as a server (pipelines, containers): nothing is asked and no home file is written; also ARCA_MODE=server, CI=true, or no terminal
  -h, --help

The connection comes from ARCA_DATABASE_URL, or from libpq's own environment (PGHOST, PGUSER, PGDATABASE, ...) and files (.pgpass, pg_service.conf), as psql does. A password is never an option.`;

const flag = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const says = (e: ConfigError): string =>
  e.kind === "model" ? `the model ${e.name} is not one of: ${modelNames.join(", ")}` : e.kind === "schema" ? `the schema name ${JSON.stringify(e.name)} is not a lower-case name` : e.kind === "compose" ? `the models do not compose: ${JSON.stringify(e.errors).slice(0, 200)}` : `the models do not project: ${e.why}`;

/** Runs `arcactl`. */
export async function main(argv: readonly string[], io: Io): Promise<Outcome> {
  const [command] = argv;
  if (command === undefined || command === "-h" || command === "--help" || command === "help") return { code: command === undefined ? 2 : 0, out: command === undefined ? "" : USAGE, err: command === undefined ? USAGE : "" };
  if (command !== "doctor") return { code: 2, out: "", err: `arcactl has no command ${command}\n\n${USAGE}` };
  const given = argv.slice(1);
  const mode = modeOf(argv, io.env, io.tty ?? false);
  const fromEnv = secretOf(io.env, "ARCA_DATABASE_URL", io.read);
  const url = flag(given, "--url") ?? (fromEnv.kind === "ok" ? fromEnv.value : undefined);
  const secrets = [passwordOf(url), io.env["PGPASSWORD"]].filter((s): s is string => s !== undefined);
  const fail = (m: string): Outcome => ({ code: 2, out: "", err: `${redact(m, secrets)}\n` });
  if (fromEnv.kind === "err") return fail(fromEnv.error);
  // the configuration: the file, then the flags over it
  const file = flag(given, "--config") ?? (existsSync(resolve(io.cwd, "arca.config.ts")) ? "arca.config.ts" : undefined);
  let base: ArcaConfig | undefined;
  if (file !== undefined) {
    const loaded = await loadConfig(resolve(io.cwd, file));
    if (loaded.kind === "err") return fail(loaded.error);
    base = loaded.value;
  }
  const models = flag(given, "--models")?.split(",").map((m) => m.trim()).filter((m) => m !== "") as ModelName[] | undefined;
  const schema = flag(given, "--schema");
  if (base === undefined && models === undefined) return fail("name the models: write arca.config.ts, or give --models (for example --models identityAgent)");
  const config = settingsOf({ ...(base ?? { models: [] }), ...(models === undefined ? {} : { models }), ...(schema === undefined ? {} : { schema }) });
  if (config.kind === "err") return fail(config.error.map(says).join("\n"));
  const made = schemaOf(config.value);
  if (made.kind === "err") return fail(made.error.map(says).join("\n"));
  const only = flag(given, "--check")?.split(",").map((s) => s.trim());
  const unknown = (only ?? []).filter((c) => !checkIds.includes(c));
  if (unknown.length > 0) return fail(`no such check: ${unknown.join(", ")} (they are ${checkIds.join(", ")})`);
  let connection: Connection;
  try {
    connection = await (io.connect ?? realConnect)({ ...(url === undefined ? {} : { url }) });
  } catch (thrown) {
    return fail(`could not connect: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
  try {
    const report = await doctor(connection.driver, config.value, made.value.schema, { secrets, ...(only === undefined ? {} : { only }) });
    const text = given.includes("--json") ? JSON.stringify({ ...report, mode: mode.mode, schema: config.value.schema, models: config.value.models }, null, 2) : renderReport(report);
    return { code: report.code, out: `${redact(text, secrets)}\n`, err: "" };
  } finally {
    await connection.close();
  }
}
