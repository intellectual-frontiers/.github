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

/** What the command line is given besides its arguments. */
export interface Io {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
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
  --url <url>         connection URL; prefer ARCA_DATABASE_URL, since arguments show in the process list
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
  const url = flag(given, "--url") ?? io.env["ARCA_DATABASE_URL"];
  const secrets = [passwordOf(url), io.env["PGPASSWORD"]].filter((s): s is string => s !== undefined);
  const fail = (m: string): Outcome => ({ code: 2, out: "", err: `${redact(m, secrets)}\n` });
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
    const text = given.includes("--json") ? JSON.stringify({ ...report, schema: config.value.schema, models: config.value.models }, null, 2) : renderReport(report);
    return { code: report.code, out: `${redact(text, secrets)}\n`, err: "" };
  } finally {
    await connection.close();
  }
}
