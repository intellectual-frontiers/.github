/**
 * The command line of both utilities (commons lang-sql 0011-acceptance FR-003, FR-006, FR-008): the options, the output and the exit status (0 for a query that runs, 1 for a query that is wrong, 2 for a usage error). A command is a function of its
 * arguments that gives what to print and the status, so that it is run by a test without a process and by `main.ts` with one.
 *
 * Spec: 0011-acceptance FR-003, FR-006, FR-008
 *
 * @module
 */
import { statSync } from "node:fs";
import { describeDiagnostics, format } from "./language.ts";

/** What a command line holds. */
export interface Options {
  readonly root: string;
  readonly explain: boolean;
  readonly format: "table" | "json" | "paths";
  readonly maxRows: number;
  readonly maxDepth: number;
  readonly emit: "argv" | "shell" | undefined;
  readonly flavor: "gnu" | "bsd" | "auto";
  readonly now: number | undefined;
  readonly query: string;
}

/** What a command gives. */
export interface Outcome {
  readonly code: 0 | 1 | 2;
  readonly out: string;
  readonly err: string;
}

/** The options of a command line; an error value is a usage message. */
export function parseArgs(argv: readonly string[], program: string): { readonly options: Options } | { readonly usage: string } {
  const usage = `usage: ${program} [--root DIR] [--explain] [--format table|json|paths] [--max-rows N] [--max-depth N]${program === "sqlfind" ? " [--emit argv|shell] [--flavor gnu|bsd]" : ""} 'SELECT ...'`;
  let root = ".";
  let explain = false;
  let fmt: Options["format"] = "table";
  let maxRows = 10000;
  let maxDepth = 64;
  let emit: Options["emit"];
  let flavor: Options["flavor"] = "auto";
  let now: number | undefined;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    const next = (): string | undefined => argv[++i];
    if (a === "--root") root = next() ?? "";
    else if (a === "--explain") explain = true;
    else if (a === "--format") {
      const v = next();
      if (v !== "table" && v !== "json" && v !== "paths") return { usage };
      fmt = v;
    } else if (a === "--max-rows" || a === "--max-depth" || a === "--now") {
      const v = Number(next());
      if (!Number.isInteger(v) || v < 0) return { usage };
      if (a === "--max-rows") maxRows = v;
      else if (a === "--max-depth") maxDepth = v;
      else now = v;
    } else if (a === "--emit" && program === "sqlfind") {
      const v = next();
      if (v !== "argv" && v !== "shell") return { usage };
      emit = v;
    } else if (a === "--flavor" && program === "sqlfind") {
      const v = next();
      if (v !== "gnu" && v !== "bsd") return { usage };
      flavor = v;
    } else if (a === "--help" || a === "-h") return { usage };
    else if (a.startsWith("--")) return { usage };
    else rest.push(a);
  }
  if (rest.length !== 1 || root === "") return { usage };
  return { options: { root, explain, format: fmt, maxRows, maxDepth, emit, flavor, now, query: rest[0] ?? "" } };
}

/** Whether a root is a directory. */
export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** The outcome of a query that did not run: its errors with line and caret, and status 1. */
export function failed(query: string, diagnostics: readonly { readonly start: number; readonly end: number; readonly message: string }[]): Outcome {
  return { code: 1, out: "", err: describeDiagnostics(query, diagnostics) };
}

/** The outcome of a query that ran. */
export function succeeded(result: Parameters<typeof format>[0], options: Options, explained: string, warnings: readonly string[], truncated: boolean): Outcome {
  const err = [...warnings.map((w) => `warning: ${w}`), ...(truncated ? [`warning: only ${options.maxRows} rows are given; raise --max-rows to see more`] : [])].join("\n");
  const body = options.explain ? explained : format(result, options.format);
  return { code: 0, out: body, err };
}
