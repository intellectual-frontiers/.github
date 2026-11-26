// Spec: 0003-headless-output FR-001, FR-012
// Spec: 0011-credential-prompt FR-005
/**
 * The command model (commons headless 0003-headless-output FR-001): a program is a tree of branches and commands; a command is a verb of the
 * terminal's declaration (its name, summary, options and operands, declared once) with the facts of its action (commons headless
 * 0002-headless-governance) and the function that runs it, which returns a typed outcome and prints nothing. A surface draws the tree: the
 * command line as words and options, a tool server as tools, a REST interface as routes.
 *
 * @remarks
 * The options every command takes by its effect (`--json`, `--quiet`, `--verbose`, `--no-color`, `--non-interactive`; `--dry-run` where it
 * can preview, `--check` where it can check, `--yes` where it destroys) are the model's (`standardOptions`), so that no program redeclares them and
 * none can declare a different meaning for their names.
 *
 * @example
 * ```ts
 * import { branch, command } from "./model.ts";
 * const status = command({ name: "status", summary: "Show the status.", action: { kind: "report" }, options: {}, run: async () => ({}) as never });
 * branch({ name: "repo", summary: "Repositories.", children: [status] }).children.length; // 1
 * ```
 *
 * @module
 */
import { flag, value, type Args, type Operand, type Spec, type SpecCheck } from "@intellectual-frontiers/terminal/args";
import type { UiCaps } from "@intellectual-frontiers/terminal/ui";
import { group, treeProblems, type CommandNode, type Example, type Group, type TreeProblem, type Verb } from "@intellectual-frontiers/terminal/commands";
import { actionProblems, defineAction, reachConformance, type ActionDefinition, type ActionFacts, type ActionProblem, type Mode, type Problem, type ProblemFields, type ReachPolicy, type ReachProblem } from "@intellectual-frontiers/headless/governance";
import { problem } from "@intellectual-frontiers/headless/governance";
import type { Credentials } from "./credentials.ts";
import type { Hint, Outcome } from "./outcome.ts";
import type { Verbosity } from "./verbosity.ts";

/** What a command is as an action, besides its identity (the path of its words and its summary are the tree's). */
export type ActionTraits = Omit<ActionDefinition, "id" | "summary"> & {
  /** Where it may be reached from and run (commons headless 0005-reach-and-targets): required of every action by the conformance rule `model/no-reach-policy`. */
  readonly reach?: ReachPolicy;
};

/** What a command is told about its run. */
export type Context = {
  readonly program: string;
  /** The words of the command as typed (`work build`). */
  readonly command: string;
  readonly facts: ActionFacts;
  readonly mode: Mode;
  readonly verbosity: Verbosity;
  /** Whether the person can be asked a question now. */
  readonly interactive: boolean;
  /** What the output stream, where a report's text is written, can show (colour depth, emoji, columns), decided once by the host: plain where the output is a pipe and in `json`. A command that draws a table or a block of rows gives it to the surface's drawing functions; none where there is no surface to say. */
  readonly ui?: UiCaps;
  /** Where the command tells what it is doing, as it does it. */
  readonly progress: Progress;
  /** A question to the person; each answers `undefined` where there is no one to ask. */
  readonly prompt: Prompt;
  /** The credentials of this one command (0011-credential-prompt): asked once each, held in memory until the command ends, refused where there is no person, never logged. */
  readonly credentials: Credentials;
  /** The environment, as a function. */
  readonly env: (name: string) => string | undefined;
  /** Aborted when the person stops the run (SIGINT, SIGTERM): a command that can stop early listens. */
  readonly signal: AbortSignal;
};

/** A question to the person. */
export type Prompt = {
  readonly ask: (question: string) => Promise<string | undefined>;
  /** `undefined` where there is no person to ask: the decision is then the governance's (`decide`), never a guess. */
  readonly confirm: (question: string) => Promise<boolean | undefined>;
};

/** A prompt that asks no one. */
export const NO_PROMPT: Prompt = { ask: () => Promise.resolve(undefined), confirm: () => Promise.resolve(undefined) };

/** What a command tells while it runs. */
export type ProgressEvent =
  | { readonly kind: "header"; readonly title: string; readonly subtitle: string }
  | { readonly kind: "phase"; readonly name: string }
  | { readonly kind: "step"; readonly n: number; readonly total: number; readonly label: string }
  | { readonly kind: "item"; readonly item: "ok" | "skip" | "change" | "note"; readonly message: string }
  | { readonly kind: "problem"; readonly problem: Problem }
  | { readonly kind: "outcome"; readonly text: string }
  | { readonly kind: "hint"; readonly hint: Hint }
  | { readonly kind: "live"; readonly message: string }
  | { readonly kind: "done"; readonly result: string };

/** Where a command's progress goes. */
export type Progress = (event: ProgressEvent) => void;

/** A progress that is told nothing. */
export const NO_PROGRESS: Progress = () => undefined;

/** The ways to tell a phase's progress, as a person writes them. */
export type PhaseWriter = {
  readonly step: (n: number, total: number, label?: string) => void;
  readonly live: (message: string) => void;
  readonly done: (result: string) => void;
  readonly ok: (message: string) => void;
  readonly skip: (message: string) => void;
  readonly change: (message: string) => void;
  readonly note: (message: string) => void;
  readonly warn: (message: string, fields?: ProblemFields) => void;
  readonly fail: (message: string, fields?: ProblemFields) => void;
  readonly pending: (message: string, next: string, fields?: ProblemFields) => void;
  readonly action: (message: string, next: string, fields?: ProblemFields) => void;
  readonly outcome: (text: string) => void;
  readonly hint: (id: string, message: string, command?: string) => void;
};

/** Says what the run is, before its first phase: a title and, where there is one, a subtitle. */
export function announce(progress: Progress, title: string, subtitle = ""): void {
  progress({ kind: "header", title, subtitle });
}

/** Starts a phase of the run and gives the writer of what happens in it. */
export function startPhase(progress: Progress, name: string): PhaseWriter {
  progress({ kind: "phase", name });
  const raise = (level: Problem["level"], message: string, fields: ProblemFields): void =>
    progress({ kind: "problem", problem: problem(level, message, { phase: name, ...fields }) });
  return {
    step: (n, total, label = "") => progress({ kind: "step", n, total, label }),
    live: (message) => progress({ kind: "live", message }),
    done: (result) => progress({ kind: "done", result }),
    ok: (message) => progress({ kind: "item", item: "ok", message }),
    skip: (message) => progress({ kind: "item", item: "skip", message }),
    change: (message) => progress({ kind: "item", item: "change", message }),
    note: (message) => progress({ kind: "item", item: "note", message }),
    warn: (message, fields = {}) => raise("warn", message, fields),
    fail: (message, fields = {}) => raise("fail", message, fields),
    pending: (message, next, fields = {}) => raise("pending", message, { ...fields, fix: next }),
    action: (message, next, fields = {}) => raise("action", message, { ...fields, fix: next }),
    outcome: (text) => progress({ kind: "outcome", text }),
    hint: (id, message, command) => progress({ kind: "hint", hint: { id, message, ...(command === undefined ? {} : { command }) } }),
  };
}

/** A command: a verb, its action's traits, and what it does. */
export type Command<S extends Spec = Spec> = {
  readonly kind: "command";
  readonly name: string;
  readonly summary: string;
  readonly options: S;
  readonly operands: readonly Operand[];
  readonly examples: readonly Example[];
  readonly action: ActionTraits;
  run(args: Args<S>, ctx: Context): Promise<Outcome>;
};

/** A command, declared with its options checked as the terminal checks them. */
export function command<S extends Spec>(c: {
  readonly name: string;
  readonly summary: string;
  readonly options: S & SpecCheck<S>;
  readonly operands?: readonly Operand[];
  readonly examples?: readonly Example[];
  readonly action: ActionTraits;
  run(args: Args<S>, ctx: Context): Promise<Outcome>;
}): Command<S> {
  return {
    kind: "command",
    name: c.name,
    summary: c.summary,
    options: c.options,
    operands: c.operands ?? [],
    examples: c.examples ?? [],
    action: c.action,
    run: (args, ctx) => c.run(args, ctx),
  };
}

/** A word that names more commands. */
export type Branch = {
  readonly kind: "branch";
  readonly name: string;
  readonly summary: string;
  readonly children: readonly Node[];
};

/** One node of a program's tree. */
export type Node = Branch | Command;

/** A branch of nodes. */
export function branch(b: { readonly name: string; readonly summary: string; readonly children: readonly Node[] }): Branch {
  return { kind: "branch", name: b.name, summary: b.summary, children: b.children };
}

/** A command together with the path of its words. */
export type Placed = { readonly path: readonly string[]; readonly id: string; readonly command: Command; readonly facts: ActionFacts; readonly reach: ReachPolicy | undefined };

/** The commands of a tree, each with its path and the facts of its action (its id is its words below the program, joined by spaces). */
export function placedCommands(children: readonly Node[], path: readonly string[] = []): readonly Placed[] {
  return children.flatMap((n): readonly Placed[] => {
    const here = [...path, n.name];
    if (n.kind === "branch") return placedCommands(n.children, here);
    const id = here.join(" ");
    return [{ path: here, id, command: n, facts: defineAction({ ...n.action, id, summary: n.summary }), reach: n.action.reach }];
  });
}

/** The terminal's tree of a program: what resolves a command line and renders the help of every level. */
export function treeOf(program: { readonly name: string; readonly summary: string; readonly children: readonly Node[] }): Group {
  const convert = (n: Node): CommandNode =>
    n.kind === "branch"
      ? group({ name: n.name, summary: n.summary, children: n.children.map(convert) })
      : verbOf(n);
  return group({ name: program.name, summary: program.summary, children: program.children.map(convert) });
}

/** The verb of a command as the terminal declares it. */
export function verbOf(c: Command): Verb {
  return { kind: "verb", name: c.name, summary: c.summary, options: c.options, operands: c.operands, examples: c.examples };
}

/** The words of the program's own place that the surface answers itself (help, explain, completions, man): a program's tree may not use them for a command. */
export const BUILT_IN_WORDS = ["help", "explain", "completions", "man", "run"] as const;

/** The options of the model, by their keys. */
export const STANDARD_KEYS = ["json", "sarif", "quiet", "verbose", "color", "nonInteractive", "dryRun", "check", "yes", "on", "consent"] as const;

/** The options every command takes, and those its action's facts add: `--dry-run` where it can preview, `--check` where it can check, `--yes` where it destroys. */
export function standardOptions(facts: ActionFacts, reach?: ReachPolicy): Spec {
  return {
    json: flag({ help: "Write one JSON document and nothing else for a person." }),
    ...(facts.kind === "report" ? { sarif: flag({ help: "Write the findings as SARIF 2.1.0 and nothing else." }) } : {}),
    quiet: flag({ short: "q", help: "Show only how it ended." }),
    verbose: flag({ short: "v", help: "Show every step as it happens." }),
    color: flag({ negatable: true, default: true, help: "Use colour where the terminal shows it (--no-color turns it off)." }),
    nonInteractive: flag({ help: "Never ask a question: where one is needed, fail and say so." }),
    ...(reach?.channels.includes("ssh") === true ? { on: value({ help: "Run it on these targets instead of here: ids joined by commas, `class:<class>` or `all`." }) } : {}),
    ...(reach?.confirmation === "consent" && facts.effect !== "read" ? { consent: value({ help: "The identifier of the consent a person gave earlier: it lets this run go on with no terminal, and is recorded in the run log." }) } : {}),
    ...(facts.dryRun ? { dryRun: flag({ help: "Show what would change and change nothing." }) } : {}),
    ...(facts.check ? { check: flag({ help: "Change nothing; end with findings where something would change." }) } : {}),
    ...(facts.effect === "destructive" ? { yes: flag({ short: "y", help: "Confirm the destruction without asking." }) } : {}),
  };
}

/** What is wrong with a program's model. */
export type ModelProblem =
  | { readonly rule: "model/tree"; readonly problem: TreeProblem }
  | { readonly rule: "model/action"; readonly id: string; readonly problem: ActionProblem }
  | { readonly rule: "model/reserved-option"; readonly id: string; readonly option: string }
  | { readonly rule: "model/reserved-short"; readonly id: string; readonly option: string; readonly short: string }
  | { readonly rule: "model/built-in-word"; readonly word: string }
  | { readonly rule: "model/no-reach-policy"; readonly id: string }
  | { readonly rule: "model/reach"; readonly id: string; readonly problem: ReachProblem }
  | { readonly rule: "model/human-only-unknown"; readonly id: string; readonly option: string };

/**
 * Everything wrong with a program's tree: what the terminal finds in its names (a duplicate, a bad name), what the governance finds in each action's
 * facts, an option of a command named as one of the model's standard options, and a human-only option the command does not declare.
 */
export function modelProblems(program: { readonly name: string; readonly summary: string; readonly children: readonly Node[] }, options: { readonly requireReach?: boolean } = {}): readonly ModelProblem[] {
  const out: ModelProblem[] = treeProblems(treeOf(program)).map((problem): ModelProblem => ({ rule: "model/tree", problem }));
  for (const n of program.children) {
    if ((BUILT_IN_WORDS as readonly string[]).includes(n.name)) out.push({ rule: "model/built-in-word", word: n.name });
  }
  for (const p of placedCommands(program.children)) {
    const standard = standardOptions(p.facts, p.reach);
    const taken = new Set(Object.values(standard).flatMap((o) => (o.short === undefined ? [] : [o.short])));
    for (const [key, o] of Object.entries(p.command.options)) {
      if (o.short !== undefined && taken.has(o.short)) out.push({ rule: "model/reserved-short", id: p.id, option: key, short: o.short });
    }
    if (p.reach !== undefined) for (const rp of reachConformance([{ facts: p.facts, reach: p.reach }])) out.push({ rule: "model/reach", id: p.id, problem: rp });
    else if (options.requireReach === true) out.push({ rule: "model/no-reach-policy", id: p.id });
    for (const a of actionProblems(p.facts)) out.push({ rule: "model/action", id: p.id, problem: a });
    for (const key of Object.keys(p.command.options)) {
      if ((STANDARD_KEYS as readonly string[]).includes(key)) out.push({ rule: "model/reserved-option", id: p.id, option: key });
    }
    for (const key of p.facts.humanOnly) {
      if (!(key in p.command.options)) out.push({ rule: "model/human-only-unknown", id: p.id, option: key });
    }
  }
  return out;
}
