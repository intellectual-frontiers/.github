// Spec: 0006-repoctl-surfaces FR-001
/**
 * How a verb of `repoctl` is declared on Headless (commons repoctl 0006-repoctl-surfaces FR-001, FR-004; commons headless 0003-headless-output, 0004-headless-cli): a verb is declared once with its words, options, operands and examples, and its
 * action's traits come from the facts table of Governance (`VERBS`), so that what the command line, the tool server and the documentation say of it is one fact. The body returns the findings and the data of the run; this turns them into
 * Headless' outcome, with the code and the fix of each finding as the problem it is.
 *
 * @example
 * ```ts
 * import { traitsOf } from "@intellectual-frontiers/repoctl/physical";
 * traitsOf("release publish").reach?.confirmation; // "person"
 * ```
 *
 * @module
 */
import { defineReach, problem, type Problem } from "@intellectual-frontiers/headless/governance";
import { type ActionTraits, type Command, command, type Context, type Outcome, outcomeOf, withExit } from "@intellectual-frontiers/headless/logical";
import type { Args, Operand, Spec, SpecCheck } from "@intellectual-frontiers/terminal/args";
import type { Example } from "@intellectual-frontiers/terminal/commands";
import { TIERS, VERBS, type VerbId } from "@intellectual-frontiers/repoctl/governance";
import type { Finding, World } from "@intellectual-frontiers/repoctl/logical";
import type { Result } from "@intellectual-frontiers/core";
import type { Host as ReleasingHost } from "@intellectual-frontiers/libraries/releasing";
import type { Config, Generator } from "@intellectual-frontiers/repoctl/governance";

/** What the program holds for every run of its verbs: the environment, and the world, made where it is needed (it needs the repository's root, which a documentation lens has not got). */
export type Host = {
  readonly env: (name: string) => string | undefined;
  readonly world: () => Result<World, string>;
  /** The repository's configuration, read and checked: everything the verbs know of it. Where there is none (or it is wrong) it is the bare one and `configProblem` says why. */
  readonly config: Config;
  /** Why the configuration could not be had: a verb that needs it ends with this, and `doctor` reports it. */
  readonly configProblem?: { readonly code: "E-CONFIG-MISSING" | "E-CONFIG-LOAD" | "E-CONFIG-INVALID"; readonly message: string };
  /** What `release apply` runs besides the planner (the generators of the release and the tests that pack): the real ones where it is not given. */
  readonly releasing?: ReleasingHost;
};

/** The generators a host runs: those of the configuration, in the order it declared them. */
export function generatorsOf(host: Host): readonly Generator[] {
  return host.config.generators;
}

/** A verb, once it is given the host it runs on. */
export type Make = (host: Host) => Command;

/** The traits of a verb as an action: its facts and its reach, from the one table. */
export function traitsOf(id: VerbId): ActionTraits {
  const f = VERBS[id];
  return {
    kind: f.kind,
    effect: f.effect,
    idempotent: f.idempotent,
    dryRun: f.dryRun,
    check: f.check,
    tier: TIERS[f.tier],
    humanOnly: f.humanOnly,
    reach: defineReach({ channels: f.channels, readOnly: f.effect === "read", idempotent: f.idempotent, confirmation: f.confirmation }),
  };
}

/** A finding as the problem of a run: its level, its code and the fix (a note of level `info` is a warning of Headless, which no exit status counts). */
export function problemOf(f: Finding): Problem {
  return problem(f.level === "info" ? "warn" : f.level, f.message, { code: f.code, fix: f.fix });
}

/** What a verb's body gives: the data (what `--json` carries), the text for a person, the findings, and what to run next. */
export type Done = {
  readonly data: unknown;
  readonly text: string;
  readonly findings: readonly Finding[];
  readonly next?: readonly string[];
  readonly title?: string;
};

/** A run that ends well or with its findings. */
export function outcomeOfDone(d: Done): Outcome {
  return outcomeOf(d.data, {
    text: d.text,
    problems: d.findings.map(problemOf),
    ...(d.next === undefined ? {} : { next: d.next.map((n) => `next: ${n}`) }),
    ...(d.title === undefined || d.findings.length > 0 ? {} : { title: d.title }),
  });
}

/** A run that could not be made: the checkout is not found, or the host cannot do it. */
export function outcomeOfEnvironment(message: string): Outcome {
  return withExit(outcomeOf(null, { problems: [problem("fail", message, { code: "E-ENVIRONMENT", fix: "repoctl doctor" })] }), "environment");
}

/** A run that cannot be made because the repository has no usable configuration. */
export function outcomeOfConfig(p: NonNullable<Host["configProblem"]>): Outcome {
  return withExit(outcomeOf(null, { problems: [problem("fail", p.message, { code: p.code, fix: p.code === "E-CONFIG-MISSING" ? "write repoctl.config.ts at the root of the repository" : "repoctl doctor" })] }), "environment");
}

/** A run whose command line does not fit what the verb takes. */
export function outcomeOfUsage(message: string, code: "E-USAGE" | "E-COMMIT-SUBJECT" | "E-COMMIT-REFS" | "E-COMMIT-IMPACT" | "E-COMMIT-SESSION" | "E-LIBRARY-NAME" = "E-USAGE", fix = "repoctl help"): Outcome {
  return withExit(outcomeOf(null, { problems: [problem("fail", message, { code, fix })] }), "usage");
}

/** What a verb is declared with. */
export type VerbDefinition<S extends Spec> = {
  readonly name: string;
  readonly id: VerbId;
  readonly options: S & SpecCheck<S>;
  readonly operands?: readonly Operand[];
  readonly examples: readonly Example[];
  readonly run: (args: Args<S>, ctx: Context, world: World, host: Host) => Promise<Outcome>;
  /** Whether the verb is run only where the repository has a valid configuration (the default); `doctor` is not, since it is what says there is none. */
  readonly needsConfig?: boolean;
};

/** A verb from its declaration: its summary and traits are the table's, and its body runs in the world of the host, or ends with the sentence that says the checkout was not found. */
export function defineVerb<S extends Spec>(d: VerbDefinition<S>): Make {
  return (host) =>
    command<S>({
      name: d.name,
      summary: VERBS[d.id].summary,
      options: d.options,
      ...(d.operands === undefined ? {} : { operands: d.operands }),
      examples: d.examples,
      action: traitsOf(d.id),
      run: (args, ctx) => {
        if (host.configProblem !== undefined && d.needsConfig !== false) return Promise.resolve(outcomeOfConfig(host.configProblem));
        const world = host.world();
        return world.kind === "err" ? Promise.resolve(outcomeOfEnvironment(world.error)) : d.run(args, ctx, world.value, host);
      },
    });
}
