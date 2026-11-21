/**
 * sqlfind (commons lang-sql 0011-acceptance FR-004 to FR-006): the language of sqlfs compiled to the argument list of a `find` command, never a shell string. What `find` can say (type, name and its patterns, path, size in bytes, modification time,
 * owner, permissions, depth) is pushed to it; what it cannot (sorting, limits, functions) is the residual that the process runs on what `find` gives, so that the rows are those of sqlfs. The flavors differ in what they push (GNU reads the columns
 * with `-printf`, BSD with `lstat`), and the arguments hold none of the flags that write or run.
 *
 * @example
 * ```ts
 * const c = compileFind("SELECT path FROM files WHERE ext = 'ts' AND size > 10 KB", "/srv/code", "gnu");
 * // argv: find /srv/code -mindepth 1 -maxdepth 64 -name '*.ts' -size +10240c -printf ...
 * ```
 *
 * Spec: 0011-acceptance FR-004, FR-005, FR-006
 *
 * @module
 */
import { spawn } from "node:child_process";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Expr } from "../../src/mod.ts";
import { type Environment, type Fn, run } from "../../src/aide/exec/mod.ts";
import { conjuncts } from "../../src/aide/normalize/mod.ts";
import { type Capabilities, explain, type Plan, split, type Split } from "../../src/aide/plan/mod.ts";
import { type Analyzed, analyze, columnsOf, type Diagnostic, type Entry, entryOf, toRow } from "../shared/language.ts";
import { knownOwner, ownerName, statEntry } from "../shared/walk.ts";
import type { Searched } from "../sqlfs/mod.ts";

/** The flavors of `find`. */
export type Flavor = "gnu" | "bsd";

/** The flags that write or run, which no argument list holds. */
export const FORBIDDEN: readonly string[] = ["-exec", "-execdir", "-ok", "-okdir", "-delete", "-fprint", "-fprint0", "-fprintf", "-fls"];

const RESERVED: ReadonlySet<string> = new Set(["(", ")", "!", ",", "-o", "-a", "-and", "-or", "-not", ...FORBIDDEN]);

/** A text with the characters of a glob made literal. */
export function escapeGlob(s: string): string {
  return s.replace(/[*?[\]\\]/g, "\\$&");
}

const safeLiteral = (s: string): boolean => s !== "" && !s.startsWith("-") && !RESERVED.has(s) && !s.includes("\0");

/** Arguments of `find`, and whether they are one test, tests that all must hold, or tests of which one must. */
interface T {
  readonly t: readonly string[];
  readonly c: "atom" | "and" | "or";
}

const atom = (...t: string[]): T => ({ t, c: "atom" });
/** The arguments of an operand of `-a`: an `-o` group is parenthesized. */
const forAnd = (x: T): readonly string[] => (x.c === "or" ? ["(", ...x.t, ")"] : x.t);
/** The arguments of an operand of `!`: anything that is not one test is parenthesized. */
const forNot = (x: T): readonly string[] => (x.c === "atom" ? x.t : ["(", ...x.t, ")"]);
const notT = (x: T): T => ({ t: ["!", ...forNot(x)], c: "atom" });

const flip: Readonly<Record<string, string>> = { "<": ">", ">": "<", "<=": ">=", ">=": "<=", "=": "=", "<>": "<>", "!=": "<>" };

function colOf(e: Expr): string | undefined {
  return e.kind === "name" ? e.parts[e.parts.length - 1]?.name.toLowerCase() : undefined;
}

/** A comparison as `[column, operator, literal]` with the column on the left. */
function comparison(e: Expr): { readonly col: string; readonly op: string; readonly lit: string | number } | undefined {
  if (e.kind !== "binary") return undefined;
  const lc = colOf(e.left);
  const rc = colOf(e.right);
  const lv = e.left.kind === "number" ? Number(e.left.text) : e.left.kind === "string" ? e.left.value : undefined;
  const rv = e.right.kind === "number" ? Number(e.right.text) : e.right.kind === "string" ? e.right.value : undefined;
  const op = e.op === "!=" ? "<>" : e.op;
  if (lc !== undefined && rv !== undefined) return { col: lc, op, lit: rv };
  if (rc !== undefined && lv !== undefined) return { col: rc, op: flip[op] ?? op, lit: lv };
  return undefined;
}


/** A glob of the pattern of `LIKE` (`%` and `_`), the characters of a glob made literal; `undefined` where it has an escape. */
function likeToGlob(p: string): string {
  let out = "";
  for (const c of p) out += c === "%" ? "*" : c === "_" ? "?" : escapeGlob(c);
  return out;
}

const GLOB_OK = /^[^[]*(\[!?[^\]\\[]+\][^[]*)*$/;

class Compiler {
  readonly flavor: Flavor;
  readonly root: string;
  constructor(flavor: Flavor, root: string) {
    this.flavor = flavor;
    this.root = root;
  }

  /** The arguments that say an expression to `find`, or `undefined` where `find` cannot say it exactly. */
  pred(e: Expr, top: boolean): T | undefined {
    switch (e.kind) {
      case "binary": {
        if (e.op === "OR") {
          const l = this.pred(e.left, false);
          const r = this.pred(e.right, false);
          return l === undefined || r === undefined ? undefined : { t: [...l.t, "-o", ...r.t], c: "or" };
        }
        if (e.op === "AND") {
          const l = this.pred(e.left, false);
          const r = this.pred(e.right, false);
          return l === undefined || r === undefined ? undefined : { t: [...forAnd(l), ...forAnd(r)], c: "and" };
        }
        const c = comparison(e);
        return c === undefined ? undefined : this.compare(c.col, c.op, c.lit, top);
      }
      case "like": {
        if (e.escape !== undefined || e.pattern.kind !== "string") return undefined;
        const c = colOf(e.arg);
        if (c !== "name" && c !== "path") return undefined;
        const word = e.op.toUpperCase();
        const caseless = word === "ILIKE";
        if (word !== "LIKE" && word !== "ILIKE" && word !== "GLOB") return undefined;
        const raw = e.pattern.value;
        if (caseless && !/^[\x20-\x7e]*$/.test(raw)) return undefined;
        const glob = word === "GLOB" ? raw : likeToGlob(raw);
        if (word === "GLOB" && (raw.includes("\\") || !GLOB_OK.test(raw))) return undefined;
        if (!safeLiteral(glob)) return undefined;
        let t: T;
        if (c === "name") {
          if (glob.includes("/")) return undefined;
          t = atom(caseless ? "-iname" : "-name", glob);
        } else t = atom(caseless ? "-ipath" : "-path", `${this.prefix()}/${glob}`);
        return e.negated ? notT(t) : t;
      }
      default:
        return undefined;
    }
  }

  prefix(): string {
    return this.root === "/" ? "" : escapeGlob(this.root);
  }

  compare(col: string, op: string, lit: string | number, top: boolean): T | undefined {
    const eq = op === "=" ? false : op === "<>" ? true : undefined;
    switch (col) {
      case "name":
        if (eq === undefined || typeof lit !== "string" || !safeLiteral(lit) || lit.includes("/")) return undefined;
        return this.neg(atom("-name", escapeGlob(lit)), eq);
      case "ext":
        if (eq === undefined || typeof lit !== "string" || !safeLiteral(lit) || lit.includes(".") || lit.includes("/")) return undefined;
        return this.neg(atom("-name", `*.${escapeGlob(lit)}`), eq);
      case "path":
        if (eq === undefined || typeof lit !== "string" || !safeLiteral(lit)) return undefined;
        return this.neg(atom("-path", `${this.prefix()}/${escapeGlob(lit)}`), eq);
      case "kind":
        if (eq === undefined || (lit !== "f" && lit !== "d" && lit !== "l")) return undefined;
        return this.neg(atom("-type", lit), eq);
      case "owner":
        if (eq === undefined || typeof lit !== "string" || !safeLiteral(lit) || /^\d+$/.test(lit) || !knownOwner(lit)) return undefined;
        return this.neg(atom("-user", lit), eq);
      case "mode":
        if (eq === undefined || typeof lit !== "number" || !Number.isInteger(lit) || lit < 0 || lit > 0o7777) return undefined;
        return this.neg(atom("-perm", lit.toString(8)), eq);
      case "size": {
        if (typeof lit !== "number" || !Number.isSafeInteger(lit) || lit < 0) return undefined;
        const n = lit;
        switch (op) {
          case ">":
            return atom("-size", `+${n}c`);
          case ">=":
            return n === 0 ? undefined : atom("-size", `+${n - 1}c`);
          case "<":
            return n === 0 ? undefined : atom("-size", `-${n}c`);
          case "<=":
            return atom("-size", `-${n + 1}c`);
          case "=":
            return atom("-size", `${n}c`);
          case "<>":
            return notT(atom("-size", `${n}c`));
          default:
            return undefined;
        }
      }
      case "mtime": {
        if (this.flavor !== "gnu" || typeof lit !== "number" || !Number.isSafeInteger(lit) || lit < 1) return undefined;
        const after = (n: number): T => atom("-newermt", `@${n}.999999999`);
        const between = (lo: number, hi: number): T => ({ t: [...after(lo).t, ...notT(after(hi)).t], c: "and" });
        switch (op) {
          case ">":
            return after(lit);
          case ">=":
            return after(lit - 1);
          case "<":
            return notT(after(lit - 1));
          case "<=":
            return notT(after(lit));
          case "=":
            return between(lit - 1, lit);
          case "<>":
            return notT(between(lit - 1, lit));
          default:
            return undefined;
        }
      }
      case "depth":
        return top && typeof lit === "number" && Number.isInteger(lit) && ["<", "<=", ">", ">=", "="].includes(op) ? atom() : undefined;
      default:
        return undefined;
    }
  }

  neg(t: T, negated: boolean): T {
    return negated ? notT(t) : t;
  }
}

/** A query compiled to `find`. */
export interface Compiled {
  readonly flavor: Flavor;
  readonly root: string;
  /** The command and its arguments, one element each: for a program that runs it, never for a shell. */
  readonly argv: readonly string[];
  readonly analyzed: Analyzed;
  readonly split: Split;
}

/** The root as `find` takes it: a path that cannot be read as a flag. */
function normalizeRoot(root: string): string {
  const r = root.length > 1 ? root.replace(/\/+$/, "") : root;
  return r.startsWith("/") || r.startsWith("./") || r === "." ? r : `./${r}`;
}

/** What a flavor of `find` can evaluate. */
export function capabilities(flavor: Flavor, root: string): Capabilities {
  const c = new Compiler(flavor, normalizeRoot(root));
  return { canEval: (e) => c.pred(e, true) !== undefined, sort: false, limit: false };
}

/** Compiles a query to the arguments of `find`; the errors of the query as values. */
export function compileFind(text: string, root: string, flavor: Flavor, maxDepth = 64): Result<Compiled, readonly Diagnostic[]> {
  const analyzed = analyze(text);
  if (analyzed.kind === "err") return analyzed;
  const r = normalizeRoot(root);
  const c = new Compiler(flavor, r);
  const s = split(analyzed.value.plan, { canEval: (e) => c.pred(e, true) !== undefined, sort: false, limit: false });
  let min = 1;
  let max = maxDepth;
  const tests: string[] = [];
  for (const conj of s.pushed.predicate === undefined ? [] : conjuncts(s.pushed.predicate)) {
    const cmp = comparison(conj);
    if (cmp !== undefined && cmp.col === "depth" && typeof cmp.lit === "number") {
      const n = cmp.lit;
      if (cmp.op === ">") min = Math.max(min, n + 1);
      else if (cmp.op === ">=") min = Math.max(min, n);
      else if (cmp.op === "<") max = Math.min(max, n - 1);
      else if (cmp.op === "<=") max = Math.min(max, n);
      else if (cmp.op === "=") {
        min = Math.max(min, n);
        max = Math.min(max, n);
      }
      continue;
    }
    const one = c.pred(conj, true);
    if (one !== undefined) tests.push(...forAnd(one));
  }
  const out = flavor === "gnu" ? ["-printf", "%P\\0%y\\0%s\\0%Ts\\0%m\\0%u\\0"] : ["-print0"];
  const argv = ["find", r, "-mindepth", String(min), "-maxdepth", String(Math.max(max, 0)), ...tests, ...out];
  return ok({ flavor, root: r, argv, analyzed: analyzed.value, split: s });
}

/** An argument as a POSIX shell reads it. */
export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`;
}

/** The argument list as one line for a POSIX shell. */
export function toShell(argv: readonly string[]): string {
  return argv.map(shellQuote).join(" ");
}

/** What running a command gives. */
export interface Ran {
  readonly code: number;
  readonly stdout: Buffer;
  readonly stderr: string;
}

/** Runs a command with no shell. */
export function exec(argv: readonly string[]): Promise<Ran> {
  return new Promise((resolve) => {
    const [cmd, ...args] = argv;
    if (cmd === undefined) {
      resolve({ code: 2, stdout: Buffer.alloc(0), stderr: "no command" });
      return;
    }
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let errText = "";
    child.stdout.on("data", (b: Buffer) => out.push(b));
    child.stderr.on("data", (b: Buffer) => {
      errText += b.toString("utf8");
    });
    child.on("error", (e) => resolve({ code: 127, stdout: Buffer.alloc(0), stderr: e.message }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout: Buffer.concat(out), stderr: errText }));
  });
}

/** The flavor of the `find` of the system. */
export async function detectFlavor(run: (argv: readonly string[]) => Promise<Ran> = exec): Promise<Flavor> {
  const r = await run(["find", "--version"]);
  return r.code === 0 && r.stdout.toString("utf8").includes("GNU") ? "gnu" : "bsd";
}

/** What running a compiled query may be given. */
export interface RunOptions {
  readonly exec?: (argv: readonly string[]) => Promise<Ran>;
  readonly now?: number;
  readonly maxRows?: number;
  readonly warn?: (message: string) => void;
}

/** The entries that the output of `find` stands for. */
export function parseFind(c: Compiled, out: Buffer): readonly Entry[] {
  const parts = out.toString("utf8").split("\0");
  parts.pop();
  const entries: Entry[] = [];
  if (c.flavor === "gnu") {
    for (let i = 0; i + 5 < parts.length; i += 6) {
      const [p, y, s, t, m, u] = [parts[i], parts[i + 1], parts[i + 2], parts[i + 3], parts[i + 4], parts[i + 5]];
      if (p === undefined || y === undefined) continue;
      entries.push(entryOf(p, y === "f" || y === "d" || y === "l" ? y : "o", Number(s), Number(t), Number.parseInt(m ?? "0", 8), u ?? ownerName(0)));
    }
  } else {
    const prefix = c.root === "/" ? "/" : `${c.root}/`;
    for (const p of parts) {
      const rel = p.startsWith(prefix) ? p.slice(prefix.length) : p;
      const e = statEntry(c.root, rel);
      if (e !== undefined) entries.push(e);
    }
  }
  return entries;
}

/** Runs a compiled query: `find` gives the rows of the pushed part and the process runs the rest. */
export async function runFind(c: Compiled, options: RunOptions = {}): Promise<Result<Searched, readonly Diagnostic[]>> {
  const ran = await (options.exec ?? exec)(c.argv);
  for (const line of ran.stderr.split("\n")) if (line.trim() !== "") options.warn?.(line.trim());
  if (ran.code !== 0 && ran.stdout.length === 0 && ran.stderr !== "" && !/Permission denied|No such file|Not a directory/.test(ran.stderr)) return err([{ start: 0, end: 0, message: ran.stderr.split("\n")[0] ?? "find failed" }]);
  const entries = parseFind(c, ran.stdout);
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const env: Environment = { functions: new Map<string, Fn>([["now", () => now]]) };
  const rows = await run(c.split.residual, entries.map(toRow), env);
  if (rows.kind === "err") return err(rows.error);
  const maxRows = options.maxRows ?? 10000;
  const truncated = rows.value.length > maxRows;
  return ok({ columns: columnsOf(c.analyzed), rows: truncated ? rows.value.slice(0, maxRows) : rows.value, explained: describe(c), truncated });
}

/** What a compiled query pushed and what it left, as text. */
export function describe(c: Compiled): string {
  const lines = [`find (${c.flavor}): ${toShell(c.argv)}`, "process:", ...explain(c.split.residual as Plan).split("\n").map((l) => `  ${l}`)];
  return lines.join("\n");
}
