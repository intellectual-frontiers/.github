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
import { type Arca, type ArcaConfig, type ConfigError, loadConfig, type ModelName, modelNames, schemaOf, settingsOf } from "./config.ts";
import { type Connection, connect as realConnect, type ConnectOptions } from "./connection.ts";
import { checkIds, doctor, renderReport } from "./doctor.ts";
import { passwordOf, redact } from "./redact.ts";
import { modeOf, secretOf } from "./server.ts";
import { envJson, shellScript } from "./shell.ts";
import { runInit } from "./init.ts";
import { scopeCommand } from "./scope.ts";
import { fromModule, projectCommand, type ProjectCommand, projectCommands } from "./project.ts";
import type { Prompter } from "./prompt.ts";
import { readState } from "./state.ts";
import { workstationChecks, workstationIds } from "./workstation-checks.ts";
import { type Platform, pathsOf, type Shell, shellOf, shells } from "./workstation.ts";
import type { CheckResult, Report } from "./doctor.ts";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";

/** What the command line is given besides its arguments. */
export interface Io {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  /** Whether input and output are a terminal, which decides between the workstation and the server (0047-arcactl-init FR-004). */
  readonly tty?: boolean;
  /** Reads a file, for a secret given as `<NAME>_FILE`. */
  readonly read?: (path: string) => string;
  /** The platform whose files `init` and the workstation checks use; this machine's by default. */
  readonly platform?: Platform;
  /** What a person at a terminal can be asked (`init`). */
  readonly prompt?: Prompter;
  /** Reads standard input to its end (`init --password-stdin`). */
  readonly stdin?: () => Promise<string>;
  /** How `psql --version` is asked (a test's own). */
  readonly psqlVersion?: () => string | undefined;
  /** Makes the connection; the real one by default, and a test's own where a test gives one. */
  readonly connect?: (o: ConnectOptions) => Promise<Connection>;
}

/** What the command line did. */
export interface Outcome {
  readonly code: 0 | 1 | 2;
  readonly out: string;
  readonly err: string;
}

/** The text that `arcactl --help` prints: its commands, options and exit statuses. */
export const USAGE = `arcactl: manage and check an arca database in PostgreSQL

  arcactl doctor [options]     check the database against the models (read-only)
  arcactl shell [options]      print the script that sets up this shell (source it; writes nothing)
  arcactl sql [options]        write the DDL of the models for a dialect (to standard output); --access, --protect OWNER, --seal, --reach set, --wildcard add row security
  arcactl scope [options]      print the statement that sets a sealed scope for a session: --tenant a,b, --subtree T or --all (the key is ARCA_SEAL_KEY)
  arcactl lint [options]       hold the models (and their operations) to governance's rules
  arcactl generate NAME        write what a generator makes: mermaid, d2, dictionary, rust, zod, register
  arcactl list [WHAT]          generators (default), models, dialects, tables, codes, invariants, operations
  arcactl init [options]       set up your workstation (not a database): find your instances, .pgpass, pg_service.conf, psql and shell profiles

options:
  --config <file>     arca.config.ts (default: ./arca.config.ts where there is one)
  --models <a,b,...>  the models wanted, where there is no config: ${modelNames.join(", ")}
  --schema <name>     the schema the tables are in (default: arca)
  --module <file>     a module of your own whose default export is a domain, a module or a list of modules (sql, lint, generate, list, doctor)
  --access            sql: grants and row-level policies of security.access and security.scope
  --protect <role>    sql: the protected layer (tables in --schema, views in api), owned by this role; implies --access
  --seal              sql, doctor: the scope is sealed; the key is ARCA_SEAL_KEY and the unlock secret ARCA_UNLOCK_SECRET, never arguments; implies --access
  --reach <r>         sql: exact (default) or set: a scope may list tenants, separated by commas
  --wildcard          sql: with --reach set, the scope * reaches every row (a platform operator)
  --prefix <p>        sql: the prefix of the scope setting (default app)
  --dialect <d>       postgres (default), sqlite or duckdb (sql, generate)
  --no-invariants     sql: leave out the triggers of the invariants
  --strict            lint: a warning fails too
  --check <ids>       only these checks, as ARCA-D001,ARCA-D005 (ARCA-W001... are the workstation's)
  --scope <s>         instance (the database, the default), workstation (your files and tools) or all
  --json              machine-readable output
  --url <url>         connection URL; prefer ARCA_DATABASE_URL (or ARCA_DATABASE_URL_FILE), since arguments show in the process list
  --driver <bun|pg>   the client: Bun's own (default on Bun) or pg (default on Node); also ARCA_DRIVER
  --non-interactive   run as a server (pipelines, containers): nothing is asked and no home file is written; also ARCA_MODE=server, CI=true, or no terminal
  -h, --help

The connection comes from ARCA_DATABASE_URL, or from libpq's own environment (PGHOST, PGUSER, PGDATABASE, ...) and files (.pgpass, pg_service.conf), as psql does. A password is never an option.`;

/** `arcactl shell`: the script for a shell, from the options and the environment, and nothing else; it connects to nothing and writes nothing. */
function shellCommand(given: readonly string[], io: Io): Outcome {
  const bad = (m: string): Outcome => ({ code: 2, out: "", err: `${m}\n` });
  const named = flag(given, "--shell");
  const detected: Shell | undefined =
    shellOf(named) ?? (named === undefined ? (shellOf(io.env["SHELL"]) ?? (io.env["PSModulePath"] !== undefined && io.env["SHELL"] === undefined ? "pwsh" : io.env["NU_VERSION"] !== undefined ? "nu" : undefined)) : undefined);
  if (detected === undefined) return bad(named === undefined ? `which shell? give --shell (${shells.join(", ")})` : `${named} is not a shell this is made for (${shells.join(", ")})`);
  const models = flag(given, "--models")?.split(",").map((m) => m.trim()).filter((m) => m !== "") ?? (io.env["ARCA_MODELS"]?.split(","));
  // what belongs to an instance (its label, its service) is not carried from the one the shell is on to the one it is switched to
  const switching = flag(given, "--instance") !== undefined;
  const input = {
    shell: detected,
    schema: flag(given, "--schema") ?? io.env["ARCA_SCHEMA"] ?? "arca",
    ...opt("instance", flag(given, "--instance") ?? io.env["ARCA_INSTANCE"]),
    ...opt("env", flag(given, "--env") ?? (switching ? undefined : io.env["ARCA_ENV"])),
    ...opt("service", flag(given, "--service") ?? flag(given, "--instance") ?? io.env["ARCA_SERVICE"]),
    ...opt("config", flag(given, "--config") ?? io.env["ARCA_CONFIG"]),
    ...opt("home", io.env["ARCA_HOME"]),
    ...(models === undefined ? {} : { models }),
    ...(given.includes("--prompt") ? { prompt: true } : {}),
  };
  const r = given.includes("--env-json") ? envJson(input) : shellScript(input);
  return r.kind === "err" ? bad(r.error.join("\n")) : { code: 0, out: r.value.endsWith("\n") ? r.value : `${r.value}\n`, err: "" };
}
const MARKS = { pass: "PASS", warn: "WARN", fail: "FAIL", unknown: "?   " } as const;
const renderWorkstation = (results: readonly CheckResult[], r: Report): string =>
  [...results.flatMap((x) => [`${MARKS[x.status]}  ${x.id}  ${x.title}`, `      ${x.detail}`, ...(x.next === undefined ? [] : [`      next: ${x.next}`])]), "", `${r.summary.pass} passed, ${r.summary.warn} warned, ${r.summary.fail} failed, ${r.summary.unknown} could not be checked`].join("\n");

const opt = <K extends string>(k: K, v: string | undefined): { [P in K]?: string } => (v === undefined || v === "" ? {} : ({ [k]: v } as { [P in K]?: string }));

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
  if (command === "shell") return shellCommand(argv.slice(1), io);
  if (command === "scope") return scopeCommand(argv.slice(1), io);
  if ((projectCommands as readonly string[]).includes(command)) return projectCommand(command as ProjectCommand, argv.slice(1), { cwd: io.cwd, env: io.env, ...(io.read === undefined ? {} : { read: io.read }) });
  if (command === "init") {
    const plat = io.platform ?? ((process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux") as Platform);
    return runInit(argv.slice(1), { env: io.env, platform: plat, cwd: io.cwd, tty: io.tty ?? false, ...(io.prompt === undefined ? {} : { prompt: io.prompt }), ...(io.stdin === undefined ? {} : { stdin: io.stdin }), ...(io.connect === undefined ? {} : { connect: io.connect }), ...(io.psqlVersion === undefined ? {} : { psqlVersion: io.psqlVersion }) });
  }
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
  const scope = flag(given, "--scope") ?? "instance";
  if (scope !== "instance" && scope !== "workstation" && scope !== "all") return fail(`--scope is instance, workstation or all, not ${scope}`);
  let workstation: Report | undefined;
  if (scope !== "instance") {
    if (mode.mode === "server") return fail("the workstation checks are for a person's workstation: this run is a server (the checks of the database are --scope instance)");
    const plat = io.platform ?? ((process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux") as Platform);
    const paths = pathsOf({ platform: plat, env: io.env });
    if (paths.kind === "err") return fail(paths.error);
    const st = readState(paths.value);
    if (st.kind === "err") return fail(st.error);
    const only = flag(given, "--check")?.split(",").map((x) => x.trim()).filter((x) => workstationIds.includes(x));
    workstation = await workstationChecks({ paths: paths.value, state: st.value, connect: io.connect ?? realConnect, ...(io.psqlVersion === undefined ? {} : { psqlVersion: io.psqlVersion }) }, scope === "workstation" ? only : only);
    if (scope === "workstation") {
      const text = given.includes("--json") ? JSON.stringify({ ...workstation, mode: mode.mode, scope }, null, 2) : renderWorkstation(workstation.results, workstation);
      return { code: workstation.code, out: `${redact(text, secrets)}\n`, err: "" };
    }
  }
  const models = flag(given, "--models")?.split(",").map((m) => m.trim()).filter((m) => m !== "") as ModelName[] | undefined;
  const schema = flag(given, "--schema");
  const moduleFile = flag(given, "--module");
  if (moduleFile !== undefined && (models !== undefined || file !== undefined)) return fail("give the models (--models or --config) or a module of your own (--module), not both");
  if (base === undefined && models === undefined && moduleFile === undefined) return fail("name the models: write arca.config.ts, or give --models (for example --models identityAgent), or a module of your own with --module");
  // a project's own module is held as it is: the tables of its schema, with no invariant guard (as `sql` writes it), sealed where the seal is expected
  let config: { readonly value: Arca };
  let made: { readonly value: { readonly schema: LogicalSchema } };
  if (moduleFile !== undefined) {
    const project = await fromModule(resolve(io.cwd, moduleFile));
    if (project.kind === "err") return fail(project.error);
    config = { value: { schema: schema ?? "arca", models: [], invariants: true, guard: false, seal: given.includes("--seal"), unmanaged: "hold", ledgerTable: "lifecycle_ledger" } };
    made = { value: { schema: project.value.schema } };
  } else {
    const settled = settingsOf({ ...(base ?? { models: [] }), ...(models === undefined ? {} : { models }), ...(schema === undefined ? {} : { schema }) });
    if (settled.kind === "err") return fail(settled.error.map(says).join("\n"));
    const picked = schemaOf(settled.value);
    if (picked.kind === "err") return fail(picked.error.map(says).join("\n"));
    config = settled;
    made = picked;
  }
  const only = flag(given, "--check")?.split(",").map((s) => s.trim());
  const unknown = (only ?? []).filter((c) => !checkIds.includes(c) && !workstationIds.includes(c));
  if (unknown.length > 0) return fail(`no such check: ${unknown.join(", ")} (they are ${checkIds.join(", ")})`);
  let connection: Connection;
  try {
    const driver = flag(given, "--driver") ?? io.env["ARCA_DRIVER"];
    if (driver !== undefined && driver !== "bun" && driver !== "pg") return fail(`--driver is bun or pg, not ${driver}`);
    connection = await (io.connect ?? realConnect)({ ...(url === undefined ? {} : { url }), ...(driver === undefined ? {} : { driver }) });
  } catch (thrown) {
    return fail(`could not connect: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
  try {
    const instance = await doctor(connection.driver, config.value, made.value.schema, { secrets, ...(only === undefined ? {} : { only: only.filter((c) => checkIds.includes(c)) }) });
    const report: Report = workstation === undefined ? instance : { results: [...workstation.results, ...instance.results], summary: { pass: workstation.summary.pass + instance.summary.pass, warn: workstation.summary.warn + instance.summary.warn, fail: workstation.summary.fail + instance.summary.fail, unknown: workstation.summary.unknown + instance.summary.unknown }, code: workstation.code === 0 && instance.code === 0 ? 0 : 1 };
    const text = given.includes("--json") ? JSON.stringify({ ...report, mode: mode.mode, schema: config.value.schema, models: config.value.models }, null, 2) : renderReport(report);
    return { code: report.code, out: `${redact(text, secrets)}\n`, err: "" };
  } finally {
    await connection.close();
  }
}
