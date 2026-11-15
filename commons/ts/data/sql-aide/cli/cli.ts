/**
 * The command line, as a function a project module calls with its project (commons 0009-sql-aide FR-046): there is no global program
 * that looks for a project. `cli(project, words, io)` parses the words with the kernel's `args`, does what they ask for the project's
 * model, writes through `io` and gives the exit status; it reads and writes no file itself (`runtime/cli.ts` wires it to a process).
 *
 * @module
 */
import { absurd, args } from "../../../kernel/mod.ts";
import { duckdb, postgres, sqlite } from "../dialect/dialects.ts";
import { context, type Docs, type EmitContext, type Plugin } from "../emit/context.ts";
import { renderUnchecked } from "../emit/sql.ts";
import { type Generator, generators } from "../generate/generators.ts";
import { lint, type Linted } from "../govern/lint.ts";
import { definitions, type Entity } from "../model/entity.ts";

/** The dialects a project may be written for. */
export type ProjectDialect = "postgres" | "sqlite" | "duckdb";

/** A project: its name, its model and what it is rendered with. A project module makes one and passes it to {@link cli}. */
export interface Project {
  /** The project's name, as the help says it. */
  readonly name: string;
  /** The entities its SQL defines, in any order: they are emitted in the order their references give. */
  readonly entities: readonly Entity[];
  /** The tables that lint and the generators read; the entities that are tables where not given. */
  readonly tables?: readonly Linted[];
  /** The dialects it is written for; all three where not given. */
  readonly dialects?: readonly ProjectDialect[];
  /** The documentation of its entities. */
  readonly docs?: readonly Docs[];
  /** The plugins its contexts are made with: their naming, lint rules and generators apply. */
  readonly plugins?: readonly Plugin[];
}

/** Where the command line writes. */
export interface Io {
  /** What the command gives. */
  readonly out: (text: string) => void;
  /** What went wrong, and help asked for in error. */
  readonly err: (text: string) => void;
}

const spec = {
  dialect: args.value({
    short: "d",
    help: "The dialect to render for: postgres, sqlite or duckdb.",
    valueName: "DIALECT",
    default: "postgres",
  }),
};
const operands: readonly args.Operand[] = [
  { name: "COMMAND", help: "sql, lint, generate or list.", arity: "one" },
  { name: "GENERATOR", help: "What `generate` makes: mermaid, d2, dictionary, rust, zod, or a plugin's.", arity: "optional" },
];

/** What the command line is asked to do. */
type Command = "sql" | "lint" | "generate" | "list";
const isCommand = (w: string): w is Command => ["sql", "lint", "generate", "list"].includes(w);

const isTable = (e: Entity): e is Entity & Linted => e.entity === "table" && "spec" in e;

/**
 * Runs the command line for a project.
 *
 * - `sql` writes the definitions of the model for the dialect;
 * - `lint` writes what the lint rules find, and fails where they find anything;
 * - `generate NAME` writes what a generator makes (a diagram, the data dictionary, Rust, Zod, or a plugin's);
 * - `list` names the generators.
 *
 * @param project - the project
 * @param words - the words of the command line, after the program's name
 * @param io - where to write
 * @returns the exit status: 0 where it did what was asked, 1 where what it found is wrong, 2 where the command line is
 * @example
 * // in a project module: process.exitCode = await cli(project, process.argv.slice(2), { out: console.log, err: console.error });
 */
export async function cli(project: Project, words: readonly string[], io: Io): Promise<number> {
  const help = args.helpText(project.name, `IFC SQL Aide for ${project.name}.`, spec, operands);
  const parsed = args.parseArgs(words, spec, operands);
  if (parsed.kind === "err") {
    io.err(`${args.formatUsageError(parsed.error, project.name)}\n\n${help}`);
    return 2;
  }
  if (parsed.value.kind === "help") {
    io.out(help);
    return 0;
  }
  const [command = "", generatorName] = parsed.value.positionals;
  if (!isCommand(command)) {
    io.err(`${project.name}: ${command} is not a command: sql, lint, generate or list\n`);
    return 2;
  }
  const dialectName = parsed.value.options.dialect;
  const allowed = project.dialects ?? ["postgres", "sqlite", "duckdb"];
  if (!allowed.some((d) => d === dialectName)) {
    io.err(`${project.name} is written for ${allowed.join(", ")}, not ${dialectName}\n`);
    return 2;
  }
  const dialect = dialectName === "sqlite" ? sqlite() : dialectName === "duckdb" ? duckdb() : postgres();
  const ctx: EmitContext = context({ dialect, docs: project.docs ?? [], plugins: project.plugins ?? [] });
  const tables = project.tables ?? project.entities.filter(isTable);
  const all: readonly Generator[] = [...generators, ...(project.plugins ?? []).flatMap((p) => p.hooks?.generators ?? [])];
  switch (command) {
    case "sql":
      try {
        // the project's dialects are the ones its model has cases for; one it lacks a case for fails here, as rendering it does
        io.out(`${renderUnchecked(definitions(project.entities), ctx)}\n`);
        return 0;
      } catch (thrown) {
        io.err(`${project.name}: ${thrown instanceof Error ? thrown.message : String(thrown)}\n`);
        return 1;
      }
    case "lint": {
      const found = lint(tables, ctx);
      for (const f of found) io.out(`${f.rule}: ${f.table}${f.column === undefined ? "" : `.${f.column}`} ${f.message}\n`);
      return found.length === 0 ? 0 : 1;
    }
    case "list":
      io.out(`${all.map((g) => g.name).join("\n")}\n`);
      return 0;
    case "generate": {
      const g = all.find((x) => x.name === generatorName);
      if (g === undefined) {
        io.err(`${project.name}: generate what? ${all.map((x) => x.name).join(", ")}\n`);
        return 2;
      }
      const files = g.generate(tables, ctx);
      for (const f of files) io.out(files.length === 1 ? f.text : `==> ${f.path} <==\n${f.text}`);
      return 0;
    }
    default:
      return absurd(command);
  }
}
