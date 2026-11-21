// Spec: 0051-project-cli FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The project commands of `arcactl` (commons data 0051-project-cli): `sql` writes the DDL of a project's models for a dialect, `lint` holds the models to governance's rules (and the operations to theirs),
 * `generate` writes what a generator makes (a diagram, the data dictionary, Rust, Zod) and `list` says what there is. They read no database and write no file: what they make goes to standard output, so that a
 * pipeline redirects it. A project is the models of an `arca.config.ts` or `--models`, or a module of the project's own (`--module`) whose default export is a domain, a module or a list of modules.
 *
 * @module
 */
import { resolve } from "node:path";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { composeModules, defaultVocabularies, type Domain, lint, lintOperations, type Module } from "@intellectual-frontiers/data/governance";
import { agentOperations } from "@intellectual-frontiers/data/models/identity-agent";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { accessSource, type AccessSettings } from "@intellectual-frontiers/data/sql/extensions/access";
import { generators } from "@intellectual-frontiers/data/sql/extensions/generators";
import { invariants, invariantsOf } from "@intellectual-frontiers/data/sql/extensions/invariants";
import { sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";
import { projectDomain, type LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { protection } from "@intellectual-frontiers/data/sql/extensions/protected-access";
import { bind, type Dialect, naming } from "@intellectual-frontiers/data/sql/physical";
import { loadConfig, type ModelName, modelNames, schemaOf, settingsOf } from "./config.ts";
import type { Outcome } from "./main.ts";
import { secretOf } from "./server.ts";

/** The commands of this file. */
export type ProjectCommand = "sql" | "lint" | "generate" | "list";
export const projectCommands: readonly ProjectCommand[] = ["sql", "lint", "generate", "list"];

const DIALECTS: Readonly<Record<string, Dialect>> = { postgres, sqlite, duckdb };

/** What a project is. */
export interface Project {
  readonly label: string;
  readonly domain: Domain;
  readonly schema: LogicalSchema;
  readonly models: readonly string[];
  readonly name: string;
}

/** What a project command is given besides its arguments: where a relative path is from, and the environment a secret is read from. */
export interface ProjectIo {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly read?: (path: string) => string;
}

/** The flags that take a value, so that a positional argument is not mistaken for one. */
const VALUE_FLAGS = ["--models", "--config", "--module", "--schema", "--dialect", "--protect", "--reach", "--prefix"];

const flag = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const isDomain = (x: unknown): x is Domain => typeof x === "object" && x !== null && "concepts" in x && "codeLists" in x && !("requires" in x);
const isModule = (x: unknown): x is Module => typeof x === "object" && x !== null && "requires" in x && "concepts" in x;

/** The project a module of the project's own gives: its default export, as a domain, a module or a list of modules, or a result of one. */
export async function fromModule(path: string): Promise<Result<Project, string>> {
  let mod: { default?: unknown };
  try {
    mod = (await import(path)) as { default?: unknown };
  } catch (thrown) {
    return err(`${path} could not be read: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
  let x = mod.default;
  if (typeof x === "object" && x !== null && "kind" in x && (x as { kind: string }).kind === "ok") x = (x as unknown as { value: unknown }).value;
  if (typeof x === "object" && x !== null && "kind" in x && (x as { kind: string }).kind === "err") return err(`${path}: the default export is an error: ${JSON.stringify((x as unknown as { error: unknown }).error).slice(0, 300)}`);
  let domain: Domain | undefined;
  if (isDomain(x)) domain = x;
  else if (isModule(x) || (Array.isArray(x) && x.every(isModule))) {
    const composed = composeModules("project", { definition: `The models of ${path}` }, Array.isArray(x) ? (x as Module[]) : [x as Module]);
    if (composed.kind === "err") return err(`${path}: the modules do not compose: ${JSON.stringify(composed.error).slice(0, 300)}`);
    domain = composed.value;
  }
  if (domain === undefined) return err(`${path}: the default export is not a domain, a module or a list of modules`);
  const projected = projectDomain(domain);
  if (projected.kind === "err") return err(`${path}: the domain does not project: ${JSON.stringify(projected.error).slice(0, 300)}`);
  return ok({ label: path, domain, schema: projected.value.schema, models: [], name: "project" });
}

/** The project the arguments name. */
async function load(given: readonly string[], cwd: string): Promise<Result<Project, string>> {
  const module = flag(given, "--module");
  const models = flag(given, "--models");
  const file = flag(given, "--config");
  if (module !== undefined && (models !== undefined || file !== undefined)) return err("give the models (--models or --config) or a module of your own (--module), not both");
  if (module !== undefined) return fromModule(resolve(cwd, module));
  let list = models?.split(",").map((m) => m.trim()).filter((m) => m !== "") as ModelName[] | undefined;
  let schema: string | undefined = flag(given, "--schema");
  if (list === undefined) {
    const path = resolve(cwd, file ?? "arca.config.ts");
    const loaded = await loadConfig(path);
    if (loaded.kind === "err") return err(file === undefined ? "name the models: --models identityAgent, a module of your own with --module, or an arca.config.ts" : loaded.error);
    list = [...loaded.value.models];
    schema = schema ?? loaded.value.schema;
  }
  const config = settingsOf({ models: list, ...(schema === undefined ? {} : { schema }) });
  if (config.kind === "err") return err(config.error.map((e) => (e.kind === "model" ? `the model ${e.name} is not one of: ${modelNames.join(", ")}` : `${e.kind}`)).join("\n"));
  const made = schemaOf(config.value);
  if (made.kind === "err") return err(`the models do not compose: ${JSON.stringify(made.error).slice(0, 300)}`);
  return ok({ label: list.join(", "), domain: made.value.domain, schema: made.value.schema, models: list, name: config.value.schema });
}

const names = (xs: readonly { readonly id: string; readonly describe: string }[]): string => xs.map((g) => `${g.id}  ${g.describe}`).join("\n");

/** What `sql` is asked of access: the settings of the access source, and the owner of the protected layer where it is asked for. */
interface AccessAsked {
  readonly settings: AccessSettings;
  readonly protect: string | undefined;
}

/** The access the flags ask for (`--access`, `--protect OWNER`, `--seal`, `--reach`, `--wildcard`, `--prefix`), with the seal's key and unlock secret read from the environment and never from an argument. */
async function accessOf(given: readonly string[], env: Readonly<Record<string, string | undefined>>, read: ProjectIo["read"]): Promise<Result<AccessAsked | undefined, string>> {
  const protect = flag(given, "--protect");
  const seal = given.includes("--seal");
  const reach = flag(given, "--reach");
  const wildcard = given.includes("--wildcard");
  const prefix = flag(given, "--prefix");
  const asked = given.includes("--access") || seal || protect !== undefined;
  if (!asked) return reach === undefined && !wildcard && prefix === undefined ? ok(undefined) : err("--reach, --wildcard and --prefix are for row security: add --access");
  if (reach !== undefined && reach !== "exact" && reach !== "set") return err(`--reach is exact or set, not ${reach}`);
  if (wildcard && reach !== "set") return err("--wildcard needs --reach set");
  if (protect !== undefined && !/^[a-z_][a-z0-9_]*$/.test(protect)) return err(`--protect names the role that owns the tables: a lower-case name, not ${JSON.stringify(protect)}`);
  let sealed: AccessSettings["seal"];
  if (seal) {
    const key = secretOf(env, "ARCA_SEAL_KEY", read);
    if (key.kind === "err") return err(key.error);
    if (key.value === undefined || key.value.length < 16) return err("--seal needs a key of at least 16 characters in ARCA_SEAL_KEY (or in the file ARCA_SEAL_KEY_FILE names): it is never an argument");
    const unlock = secretOf(env, "ARCA_UNLOCK_SECRET", read);
    if (unlock.kind === "err") return err(unlock.error);
    sealed = { key: key.value, ...(unlock.value === undefined ? {} : { unlock: sha256Hex(unlock.value) }) };
  }
  return ok({
    protect,
    settings: { ...(sealed === undefined ? {} : { seal: sealed }), ...(reach === undefined ? {} : { reach }), ...(wildcard ? { wildcard } : {}), ...(prefix === undefined ? {} : { settingPrefix: prefix }) },
  });
}

/**
 * Runs a project command.
 *
 * @param command - `sql`, `lint`, `generate` or `list`
 * @param given - the arguments after the command
 * @param cwd - where a relative path is from
 * @returns the exit status (0 done, 1 what it found is wrong, 2 the command is wrong) and what to print
 */
export async function projectCommand(command: ProjectCommand, given: readonly string[], io: ProjectIo | string): Promise<Outcome> {
  const { cwd, env = {}, read } = typeof io === "string" ? { cwd: io } as ProjectIo : io;
  const fail = (m: string): Outcome => ({ code: 2, out: "", err: `${m}\n` });
  const positional = given.filter((g, i) => !g.startsWith("--") && !VALUE_FLAGS.includes(given[i - 1] ?? ""));
  const project = await load(given, cwd);
  if (project.kind === "err" && command !== "list") return fail(project.error);
  const dialectName = flag(given, "--dialect") ?? "postgres";
  const dialect = DIALECTS[dialectName];
  if (dialect === undefined) return fail(`--dialect is ${Object.keys(DIALECTS).join(", ")}, not ${dialectName}`);
  switch (command) {
    case "list": {
      const what = positional[0] ?? "generators";
      if (what === "generators") return { code: 0, out: `${names(generators)}\n`, err: "" };
      if (what === "models") return { code: 0, out: `${modelNames.join("\n")}\n`, err: "" };
      if (what === "dialects") return { code: 0, out: `${Object.keys(DIALECTS).join("\n")}\n`, err: "" };
      if (!["tables", "codes", "invariants", "operations"].includes(what)) return fail(`list what? generators, models, dialects, tables, codes, invariants or operations (not ${what})`);
      if (project.kind === "err") return fail(project.error);
      const p = project.value;
      const text =
        what === "tables"
          ? p.schema.tables.map((t) => `${t.name.join("_")}  ${t.comment}`)
          : what === "codes"
            ? p.domain.codeLists.map((c) => `${c.name}  ${Object.keys(c.codes).length} codes`)
            : what === "invariants"
              ? invariantsOf(p.schema.tables).map((i) => `${i.table}  ${i.kind}  ${i.says}`)
              : p.models.includes("identityAgent")
                ? agentOperations.map((o) => `${o.name}  ${o.spec.definition}`)
                : [];
      return { code: 0, out: text.length === 0 ? "" : `${text.join("\n")}\n`, err: "" };
    }
    case "sql": {
      if (project.kind === "err") return fail(project.error);
      const p = project.value;
      const sources = given.includes("--no-invariants") ? [] : [invariants({ unsupported: "carry", guard: false })];
      const access = await accessOf(given, env, read);
      if (access.kind === "err") return fail(access.error);
      const a = access.value;
      const schemaName = flag(given, "--schema") === undefined && p.models.length === 0 ? undefined : (flag(given, "--schema") ?? p.name);
      if (a !== undefined && dialectName !== "postgres") return fail("row security, the protected layer and the seal are PostgreSQL's: --dialect postgres");
      const kit = a?.protect === undefined ? undefined : protection({ owner: a.protect, ...(schemaName === undefined ? {} : { tablesSchema: schemaName }) });
      if (a !== undefined) sources.push(accessSource({ ...a.settings, ...(kit === undefined ? {} : { viewsSchema: kit.settings.viewsSchema }) }));
      if (kit !== undefined) sources.push(...kit.bind.sources);
      const bound = bind(p.schema, { dialect, ...(kit !== undefined ? { schema: kit.settings.tablesSchema } : schemaName === undefined ? {} : { schema: schemaName }), sources });
      if (bound.kind === "err") return { code: 1, out: "", err: `${p.label}: ${JSON.stringify(bound.error).slice(0, 600)}\n` };
      return { code: 0, out: `${bound.value.statements.map((s) => s.sql).join("\n\n")}\n`, err: "" };
    }
    case "lint": {
      if (project.kind === "err") return fail(project.error);
      const p = project.value;
      const findings = [...lint(p.domain, defaultVocabularies), ...(p.models.includes("identityAgent") ? lintOperations(p.domain, agentOperations) : [])];
      const lines = findings.map((f) => `${f.severity}  ${f.rule}  ${String(f.element)}  ${f.message}`);
      const errors = findings.filter((f) => f.severity === "error").length;
      const warnings = findings.length - errors;
      const summary = `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`;
      return { code: errors > 0 || (given.includes("--strict") && warnings > 0) ? 1 : 0, out: `${[...lines, summary].join("\n")}\n`, err: "" };
    }
    case "generate": {
      if (project.kind === "err") return fail(project.error);
      const name = positional[0];
      // the short names the usage gives (dictionary, mermaid, d2, rust, zod, register, html) are the ids without their prefix, as `list` shows them
      const short = name === "mermaid" ? "erd-mermaid" : name === "d2" ? "erd-d2" : name;
      const g = generators.find((x) => x.id === name || x.id === `sql.generate.${short}`);
      if (g === undefined) return fail(`generate what? ${generators.map((x) => x.id).join(", ")}`);
      const made = g.generate({ schema: project.value.schema, naming: naming(), dialect });
      if (made.kind === "err") return { code: 1, out: "", err: `${project.value.label}: ${JSON.stringify(made.error).slice(0, 600)}\n` };
      const files = made.value;
      return { code: 0, out: files.map((f) => (files.length === 1 ? f.text : `==> ${f.path} <==\n${f.text}`)).join(files.length === 1 ? "" : "\n"), err: "" };
    }
  }
}
