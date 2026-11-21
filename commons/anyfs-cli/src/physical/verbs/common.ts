// Spec: 0004-anyfs-cli-surfaces FR-006, FR-007
/**
 * How a verb of the program is declared on Headless (commons anyfs-cli 0004-anyfs-cli-surfaces FR-006, FR-007; commons headless 0003-headless-output, 0004-headless-cli): a verb is declared once with its words, options,
 * operands and examples, and its action's traits come from the facts table of the governance (`VERBS`), so that what the command line, the tool server and the documentation say of it is one fact. What every verb
 * that works through the POSIX view shares is here: binding its words to stores, `--explain`, `--strict`, the lines of `-v`, and the walk of a directory.
 *
 * @example
 * ```ts
 * import { traitsOf } from "./common.ts";
 * traitsOf("rm").effect; // "destructive"
 * ```
 *
 * @module
 */
import { defineReach } from "@intellectual-frontiers/headless/governance";
import { type ActionTraits, type Command, command, type Context, type Outcome, outcomeOf, withExit } from "@intellectual-frontiers/headless/logical";
import { flag, type Args, type Operand, type Spec, type SpecCheck } from "@intellectual-frontiers/terminal/args";
import type { Example } from "@intellectual-frontiers/terminal/commands";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { describeFidelity, type DirEntry, joinPosix, type PlanOp, type PosixPath } from "@intellectual-frontiers/anyfs-posix/governance";
import { TIERS, VERBS, type VerbId } from "@intellectual-frontiers/anyfs-cli/governance";
import { describeFailure, emulatedLines, environment, finding, keep, problemOf, strictViolations, type Host, type Trail, usage } from "@intellectual-frontiers/anyfs-cli/logical";
import { type BindProblem, type Bound, bind } from "../bind.ts";

/** The traits of a verb as an action: its facts and its reach, from the one table. */
export function traitsOf(id: VerbId): ActionTraits {
  const f = VERBS[id];
  return {
    kind: f.kind,
    effect: f.effect,
    idempotent: f.idempotent,
    dryRun: f.dryRun,
    check: false,
    tier: TIERS[f.tier],
    humanOnly: [],
    reach: defineReach({ channels: f.channels, readOnly: f.effect === "read", idempotent: f.idempotent, confirmation: f.confirmation }),
  };
}

/** What a verb is declared with. */
export type VerbDefinition<S extends Spec> = {
  readonly name: string;
  readonly id: VerbId;
  readonly options: S;
  readonly operands: readonly Operand[];
  readonly examples: readonly Example[];
  readonly run: (args: Args<S>, ctx: Context, host: Host) => Promise<Outcome>;
};

/** The options as the terminal checks them: a short letter declared twice is refused when the program's model is made (`describe`), and the test of the program holds that none is. */
function checked<S extends Spec>(options: S): S & SpecCheck<S> {
  return options as S & SpecCheck<S>;
}

/** A verb from its declaration: its summary and traits are the table's. */
export function defineVerb<S extends Spec>(host: Host, d: VerbDefinition<S>): Command<S> {
  return command<S>({ name: d.name, summary: VERBS[d.id].summary, options: checked(d.options), operands: d.operands, examples: d.examples, action: traitsOf(d.id), run: (args, ctx) => d.run(args, ctx, host) });
}

/** The options every verb that works through the POSIX view takes. */
export const POSIX_OPTIONS = {
  explain: flag({ help: "Say how the store would carry the operation out (native, emulated or refused), and do nothing else." }),
  strict: flag({ help: "Stop where the store carries an operation out by a means that can lose or change what you meant." }),
};

/** What a verb is told of the two options. */
export type PosixFlags = { readonly explain: boolean; readonly strict: boolean };

/** The ending of a word that could not be bound: a usage error for a word that is no place, the computer's problem otherwise. */
export function bindOutcome(p: BindProblem): Outcome {
  return p.fault === "usage" ? withExit(outcomeOf(null, { problems: [problemOf(p.code, p.message)] }), "usage") : environment(p.code, p.message);
}

/** Binds every word, or ends with the first that cannot be bound. */
export async function bindAll(host: Host, words: readonly string[]): Promise<Result<readonly Bound[], Outcome>> {
  const out: Bound[] = [];
  for (const w of words) {
    const b = await bind(host, w);
    if (b.kind === "err") return err(bindOutcome(b.error));
    out.push(b.value);
  }
  return ok(out);
}

/** Why `--explain` ends the verb: how each operation it uses would be carried out on each store it names. */
export function explainOutcome(bounds: readonly Bound[], ops: readonly PlanOp[]): Outcome {
  const lines: string[] = [];
  const data: { store: string; word: string; op: PlanOp; fidelity: string; steps: readonly string[] }[] = [];
  for (const b of bounds) {
    lines.push(`${b.text} (${b.store.id}):`);
    for (const op of ops) {
      const plan = b.view.explain(op);
      lines.push(`  ${op}: ${describeFidelity(plan.fidelity)}; uses ${plan.steps.length === 0 ? "nothing" : plan.steps.join(", ")}`);
      data.push({ store: b.store.id, word: b.text, op, fidelity: describeFidelity(plan.fidelity), steps: plan.steps });
    }
  }
  return outcomeOf(data, { text: lines.join("\n") });
}

/** The outcome of a verb, with what its trail says: with `--strict` an operation that was emulated by a risky means ends it with a problem, and with `-v` the emulations are written as lines. */
export function withTrail(done: Outcome, trail: Trail, flags: Pick<PosixFlags, "strict">, ctx: Context): Outcome {
  const violations = flags.strict ? strictViolations(trail) : [];
  const extra = ctx.verbosity === "verbose" ? emulatedLines(trail) : [];
  const problems = violations.map((v) => problemOf("E-STRICT", `${v.op} ${v.path}: ${describeFidelity(v.fidelity)}`));
  if (problems.length === 0 && extra.length === 0) return done;
  return { ...done, problems: [...done.problems, ...problems], outcomes: [...done.outcomes, ...extra] };
}

/** A failed operation as the ending of a verb. */
export function failed(e: Parameters<typeof describeFailure>[0]): Outcome {
  return finding("E-FILESYSTEM", describeFailure(e));
}

/** The entries below a directory, depth first, in order of name, each with its path: a directory is listed before what is in it. */
export type Walked = { readonly path: PosixPath; readonly entry: DirEntry; readonly depth: number };

/** Walks a directory through the view, keeping the fidelity of each listing in the trail. A path that is a file is the one entry. */
export async function walk(b: Bound, path: PosixPath, trail: Trail, options: { readonly maxDepth?: number; readonly limit?: number } = {}): Promise<Result<readonly Walked[], Outcome>> {
  const out: Walked[] = [];
  const limit = options.limit ?? 1_000_000;
  const recur = async (dir: PosixPath, depth: number): Promise<Outcome | undefined> => {
    const listed = keep(trail, "readdir", dir, await b.view.readdir(dir));
    if (listed.kind === "err") return failed(listed.error);
    for (const entry of [...listed.value].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0))) {
      const p = joinPosix(dir, entry.name);
      out.push({ path: p, entry, depth });
      if (out.length > limit) return finding("E-PLAN-REFUSED", `more than ${limit} names below ${path}: narrow it down`);
      if (entry.type === "dir" && (options.maxDepth === undefined || depth < options.maxDepth)) {
        const failure = await recur(p, depth + 1);
        if (failure !== undefined) return failure;
      }
    }
    return undefined;
  };
  const failure = await recur(path, 1);
  return failure === undefined ? ok(out) : err(failure);
}

/** A verb that was given the wrong number of operands. */
export function needs(verb: string, what: string): Outcome {
  return usage(`${verb} needs ${what}`);
}
