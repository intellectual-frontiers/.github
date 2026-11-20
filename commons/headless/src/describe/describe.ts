// Spec: 0015-describe FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * A headless program as layered models (commons headless 0015-describe): `describe(program)` reads a `Program` and gives one `LayeredModel` of Kanon for each tier of its ladder, so that a documentation
 * generator, a check or a diff can read what the program says without running it. Pure: values in, models out, no input or output.
 *
 * @remarks
 * The layers are those of Kanon. Governance holds the action of each verb (its kind, effect, idempotency, audience, tier, preview, check, human-only options and reach policy), the problem codes with their
 * explanations and the exit statuses by name. The logical layer holds the program, the plugins that contributed verbs (from `Program.origins`), the verbs, their options (the command's own and those the model adds
 * by its action's facts) and operands, with the examples and the problems of the model as findings. The physical layer holds what each surface draws for a caller of the tier: the command of a verb on the command
 * line, its tool on a tool server, its route in the OpenAPI document. A verb the tier does not see has no projection, and the model says so: the dispositions of its annotations of tier and audience are
 * `unexpressed` with the gate's own sentence, and its `notProjected` property lists each surface that does not draw it and why. Every annotation of every action ends in a disposition, so that `droppedFindings` of Kanon finds nothing.
 *
 * @limits
 * The source of an element is where the program's code does not tell: with no `locate` function the file is the name of the program (or of the plugin that contributed the verb) and the line 1. Elements have the same ids in the model of
 * each tier, as the ids agreed with the data library have no tier in them; the models are told apart by their names (`<program>-<tier>`).
 *
 * @example
 * ```ts
 * import { branch, command, programOf } from "@intellectual-frontiers/headless/logical";
 * import { describe } from "@intellectual-frontiers/headless/describe";
 * const status = command({ name: "status", summary: "Show the status.", options: {}, action: { kind: "report" }, run: async () => ({}) as never });
 * const models = describe(programOf({ name: "tool", summary: "A tool.", version: "1.0.0", children: [branch({ name: "all", summary: "All.", children: [status] })] }));
 * models.map((m) => m.name); // ["tool-public", "tool-operator", "tool-administrator"]
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type ActionFacts,
  EXIT_NAMES,
  exitCodeOf,
  exitMeaning,
  PROBLEM_LEVELS,
  type ReachPolicy,
  type TierDecision,
  type TierName,
  tierGate,
  tierMessage,
} from "@intellectual-frontiers/headless/governance";
import {
  catalogueProblems,
  flagOf,
  type ModelProblem,
  modelProblems,
  offeredOptions,
  type Placed,
  placedCommands,
  type Program,
  standardOptions,
} from "@intellectual-frontiers/headless/logical";
import { exposed, methodOf, pathOf, operationId } from "@intellectual-frontiers/headless/rest";
import { listable, toolName, toolOf } from "@intellectual-frontiers/headless/mcp";
import type { Option, Operand } from "@intellectual-frontiers/terminal/args";
import type { Disposition, ElementId, LayeredModel, ModelElement, ModelFinding, ModelLayer, SourceLocation, TraceEdge } from "@intellectual-frontiers/kanon";
import {
  actionIdOf,
  cliIdOf,
  codeIdOf,
  documentIdOf,
  exitIdOf,
  type Kind,
  kindsOf,
  layerOf,
  mcpIdOf,
  operandIdOf,
  optionIdOf,
  pluginIdOf,
  programIdOf,
  restIdOf,
  verbIdOf,
} from "./ids.ts";

/** What a source location is asked for: the closed set of things a model says. */
export type Subject =
  | { readonly kind: "program" }
  | { readonly kind: "plugin"; readonly owner: string }
  | { readonly kind: "verb"; readonly path: readonly string[] }
  | { readonly kind: "problem-code"; readonly code: string }
  | { readonly kind: "outcome"; readonly name: string };

/** What `describe` may be given besides the program. */
export type DescribeOptions = {
  /** Where the subject is written (a file of the repository and a line): the caller's, since a value does not know where it was declared. */
  readonly locate?: (subject: Subject) => SourceLocation | undefined;
};

/** Why no model could be made: the program's own id is not an id. */
export type DescribeProblem = { readonly rule: "describe/program-id"; readonly message: string };

/** The properties of an element. */
type Props = ModelElement["properties"];
/** A value of a property. */
type PropValue = Props[string];

/** The annotations of an action that a model accounts for, by name. */
const ANNOTATIONS = [
  "kind",
  "effect",
  "idempotent",
  "audience",
  "tier",
  "dryRun",
  "check",
  "humanOnly",
  "reachChannels",
  "reachReadOnly",
  "reachNeedsTty",
  "reachRunsAs",
  "reachConfirmation",
] as const;

/** One annotation of an action. */
type Annotation = (typeof ANNOTATIONS)[number];

/** The value of an annotation: `null` for those of a reach policy the action does not have. */
function annotationValue(a: Annotation, f: ActionFacts, r: ReachPolicy | undefined): PropValue {
  switch (a) {
    case "kind":
      return f.kind;
    case "effect":
      return f.effect;
    case "idempotent":
      return f.idempotent;
    case "audience":
      return f.audience;
    case "tier":
      return f.tier;
    case "dryRun":
      return f.dryRun;
    case "check":
      return f.check;
    case "humanOnly":
      return f.humanOnly;
    case "reachChannels":
      return r === undefined ? null : r.channels;
    case "reachReadOnly":
      return r === undefined ? null : r.readOnly;
    case "reachNeedsTty":
      return r === undefined ? null : r.needsTty;
    case "reachRunsAs":
      return r === undefined ? null : r.runsAs;
    case "reachConfirmation":
      return r === undefined ? null : r.confirmation;
    default:
      return absurd(a);
  }
}

/** What the disposition of an action's annotations is told. */
type Account = {
  readonly action: ElementId;
  readonly verb: ElementId;
  readonly cli: ElementId | undefined;
  readonly surface: ElementId | undefined;
  readonly flags: ReadonlyMap<string, ElementId>;
  readonly facts: ActionFacts;
  readonly reach: ReachPolicy | undefined;
  readonly decision: TierDecision;
};

/** How one annotation of an action ends (0033-kanon FR-005): expressed by the element that enforces it, carried by the one that passes it on as data, or unexpressed with its reason. */
function dispose(a: Annotation, c: Account): Disposition {
  const expressed = (target: ElementId): Disposition => ({ element: c.action, annotation: a, outcome: "expressed", target });
  const carried = (target: ElementId): Disposition => ({ element: c.action, annotation: a, outcome: "carried", target });
  const unexpressed = (reason: string): Disposition => ({ element: c.action, annotation: a, outcome: "unexpressed", reason });
  const viaFlag = (flag: string): Disposition => {
    const option = c.flags.get(flag);
    return option === undefined ? carried(c.verb) : expressed(option);
  };
  const viaCommand = (): Disposition => {
    switch (c.decision.kind) {
      case "visible":
        return c.cli === undefined ? carried(c.verb) : expressed(c.cli);
      case "hidden":
        return unexpressed(tierMessage(c.facts.id, c.decision));
      default:
        return absurd(c.decision);
    }
  };
  switch (a) {
    case "kind":
    case "idempotent":
    case "humanOnly":
      return carried(c.verb);
    case "effect":
      return c.facts.effect === "destructive" ? viaFlag("--yes") : carried(c.verb);
    case "dryRun":
      return c.facts.dryRun ? viaFlag("--dry-run") : carried(c.verb);
    case "check":
      return c.facts.check ? viaFlag("--check") : carried(c.verb);
    case "audience":
    case "tier":
      return viaCommand();
    case "reachChannels":
    case "reachReadOnly":
    case "reachNeedsTty":
    case "reachRunsAs":
    case "reachConfirmation":
      if (c.reach === undefined) return unexpressed(`${c.facts.id} declares no reach policy, so no tool server, REST interface or target offers it`);
      return c.surface === undefined ? carried(c.verb) : expressed(c.surface);
    default:
      return absurd(a);
  }
}

/** Why a machine surface does not draw a verb the tier sees. */
function withheld(surface: "mcp" | "rest", p: Placed): string {
  if (p.reach === undefined) return `${p.id} declares no reach policy`;
  if (!p.reach.channels.includes(surface)) return `its reach policy does not name the ${surface} channel`;
  return "it is for a person alone (audience human)";
}

const optionKind = (o: Option): "flag" | "value" | "many" => {
  switch (o.kind) {
    case "flag":
    case "value":
    case "many":
      return o.kind;
    default:
      return absurd(o);
  }
};

/** The default of an option as text, where it has one a person can read. */
function defaultOf(o: Option): string | null {
  switch (o.kind) {
    case "flag":
      return o.fallback.kind === "default" ? String(o.fallback.value) : null;
    case "value": {
      if (o.fallback.kind !== "default") return null;
      const v: unknown = o.fallback.value;
      return typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : null;
    }
    case "many":
      return null;
    default:
      return absurd(o);
  }
}

/** The properties of an option. */
function optionProps(o: Option, standard: boolean, humanOnly: boolean): Props {
  return {
    type: optionKind(o),
    short: o.short ?? null,
    required: o.kind === "value" && o.fallback.kind === "required",
    standard,
    humanOnly,
    valueName: o.kind === "flag" ? null : o.valueName,
    negatable: o.kind === "flag" ? o.negatable : null,
    default: defaultOf(o),
  };
}

/** The properties of an operand. */
const operandProps = (o: Operand): Props => ({ arity: o.arity });

/** The sentence of a problem of the model. */
function problemMessage(p: ModelProblem): string {
  switch (p.rule) {
    case "model/tree":
      switch (p.problem.kind) {
        case "bad-name":
          return `${[...p.problem.path, p.problem.name].join(" ")} is not a name a command may have`;
        case "duplicate":
          return `${[...p.problem.path, p.problem.name].join(" ")} is declared twice`;
        default:
          return absurd(p.problem);
      }
    case "model/action":
      return p.problem.message;
    case "model/reserved-option":
      return `${p.id} declares the option ${p.option}, which is a standard option of the model`;
    case "model/reserved-short":
      return `${p.id} gives the option ${p.option} the short -${p.short}, which a standard option has`;
    case "model/built-in-word":
      return `${p.word} is answered by the program itself and cannot name a command`;
    case "model/no-reach-policy":
      return `${p.id} has no reach policy`;
    case "model/reach":
      return p.problem.message;
    case "model/human-only-unknown":
      return `${p.id} says ${p.option} is for a person alone and does not declare it`;
    default:
      return absurd(p);
  }
}

/** The words of the command a problem is about, where it names one. */
function problemWords(p: ModelProblem): readonly string[] | undefined {
  switch (p.rule) {
    case "model/action":
    case "model/reserved-option":
    case "model/reserved-short":
    case "model/no-reach-policy":
    case "model/reach":
    case "model/human-only-unknown":
      return p.id.split(" ");
    case "model/tree":
    case "model/built-in-word":
      return undefined;
    default:
      return absurd(p);
  }
}

/** The layers of every model: what each is for and the kinds it holds. */
const LAYERS: readonly ModelLayer[] = [
  {
    id: "governance",
    title: "Governance",
    summary: "What each action is and may do (its kind, effect, idempotency, audience, tier, preview, check, human-only options and reach), the problem codes with their explanations and the statuses a run ends with.",
    kinds: kindsOf("governance"),
  },
  {
    id: "logical",
    title: "Logical",
    summary: "The program as a tree: its verbs with their options and operands and examples, who contributed each, and what is wrong with the model.",
    kinds: kindsOf("logical"),
  },
  {
    id: "physical",
    title: "Surfaces",
    summary: "What each surface draws for a caller of the tier: the commands of the command line, the tools of a tool server and the routes of the OpenAPI document of a REST interface.",
    kinds: kindsOf("physical"),
  },
];

/** The model of the program for a caller of one tier. */
function modelFor(program: Program, tier: TierName, anchor: ElementId, options: DescribeOptions): LayeredModel {
  const name = program.name;
  const elements: ModelElement[] = [];
  const trace: TraceEdge[] = [];
  const findings: ModelFinding[] = [];
  const dispositions: Disposition[] = [];
  const seen = new Set<string>();

  const idOf = (r: Result<ElementId, string>): ElementId | undefined => {
    if (r.kind === "ok") return r.value;
    findings.push({ rule: "describe/id", element: anchor, message: r.error });
    return undefined;
  };
  const sourceOf = (s: Subject, origin?: string): SourceLocation => options.locate?.(s) ?? { file: origin ?? name, line: 1 };
  const put = (kind: Kind, id: ElementId, label: string, definition: string, source: SourceLocation, properties: Props, parent?: ElementId): boolean => {
    if (seen.has(id)) {
      findings.push({ rule: "describe/duplicate-id", element: id, message: `${id} names two elements; the first is kept` });
      return false;
    }
    seen.add(id);
    elements.push({ id, layer: layerOf(kind), kind, name: label, definition, ...(parent === undefined ? {} : { parent }), source, properties });
    if (definition.trim() === "") findings.push({ rule: "describe/no-definition", element: id, message: `${id} has no words to define it` });
    return true;
  };
  const edge = (from: ElementId, to: ElementId): void => {
    trace.push({ from, to, how: "projects to" });
  };

  put("program", anchor, name, program.summary, sourceOf({ kind: "program" }), {
    version: program.version,
    envPrefix: program.envPrefix,
    tier,
    tiers: program.tiers.ladder,
    defaultTier: program.tiers.default,
    defaultCommand: program.defaultCommand,
  });

  // governance, the program's own: the codes it explains and the statuses a run ends with
  const catalogueCodes = Object.keys(program.catalogue).sort();
  for (const code of catalogueCodes) {
    const e = program.catalogue[code];
    const id = idOf(codeIdOf(name, code));
    if (e === undefined || id === undefined) continue;
    put("problem-code", id, code, `${e.title}: ${e.what}`, sourceOf({ kind: "problem-code", code }), { why: e.why, fix: e.fix, doc: e.doc ?? null });
  }
  for (const level of PROBLEM_LEVELS) {
    const code = program.generic[level];
    if (catalogueCodes.includes(code)) continue;
    const id = idOf(codeIdOf(name, code));
    if (id !== undefined) put("problem-code", id, code, `The code a problem of the level ${level} carries when its raiser gave none.`, sourceOf({ kind: "problem-code", code }), { level });
  }
  for (const exit of EXIT_NAMES) {
    const id = idOf(exitIdOf(name, exit));
    if (id !== undefined) put("outcome", id, exit, `Status ${exitCodeOf(exit)}: ${exitMeaning(exit)}.`, sourceOf({ kind: "outcome", name: exit }), { status: exitCodeOf(exit) });
  }
  for (const element of elements) {
    switch (element.kind) {
      case "problem-code":
        for (const annotation of Object.keys(element.properties)) {
          dispositions.push({ element: element.id, annotation, outcome: "unexpressed", reason: `it is explained at run time by \`${name} explain\`, which no surface draws as an element` });
        }
        break;
      case "outcome":
        dispositions.push({ element: element.id, annotation: "status", outcome: "unexpressed", reason: "it is the status of the process a run ends with, which every surface reports and none draws as an element" });
        break;
      default:
        break;
    }
  }

  // the verbs, each with its action, its options and operands, and its projections on the surfaces the tier sees
  const owned = new Map<string, ElementId[]>();
  const tools = new Set<string>();
  const routes: ElementId[] = [];
  const documentId = idOf(documentIdOf(name));
  for (const p of placedCommands(program.children)) {
    const verb = idOf(verbIdOf(name, p.path));
    const action = idOf(actionIdOf(name, p.path));
    if (verb === undefined || action === undefined) continue;
    const origin = program.origins[p.id] ?? name;
    const source = sourceOf({ kind: "verb", path: p.path }, origin);
    const decision = tierGate(program.tiers, p.facts.tier, tier);
    const visible = decision.kind === "visible";
    const notProjected: string[] = [];

    // the options and operands
    const flags = new Map<string, ElementId>();
    const declared = Object.entries(p.command.options);
    const added = Object.entries(standardOptions(p.facts, p.reach)).filter(([key]) => !(key in p.command.options));
    for (const [key, o, standard] of [...declared.map(([k, v]) => [k, v, false] as const), ...added.map(([k, v]) => [k, v, true] as const)]) {
      const flag = flagOf(key);
      const id = idOf(optionIdOf(verb, flag));
      if (id !== undefined && put("option", id, flag, o.help, source, optionProps(o, standard, p.facts.humanOnly.includes(key)), verb)) flags.set(flag, id);
    }
    for (const o of p.command.operands) {
      const id = idOf(operandIdOf(verb, o.name));
      if (id !== undefined) put("operand", id, o.name, o.help, source, operandProps(o), verb);
    }

    // its projections
    const projections: string[] = [];
    let cli: ElementId | undefined;
    let surface: ElementId | undefined;
    if (!visible) {
      const why = tierMessage(p.id, decision);
      notProjected.push(`cli: ${why}`, `mcp: ${why}`, `rest: ${why}`);
    } else {
      cli = idOf(cliIdOf(name, p.path));
      if (cli !== undefined && put("cli-command", cli, `${name} ${p.id}`, p.command.summary, source, { usage: `${name} ${p.id}`, words: p.path, tier: p.facts.tier }, undefined)) {
        edge(verb, cli);
        projections.push(cli);
      }
      if (listable(p)) {
        const tool = toolOf(name, p);
        const id = idOf(mcpIdOf(tool.name));
        if (tools.has(tool.name)) findings.push({ rule: "describe/mcp-name-collision", element: verb, message: `${p.id} would be the tool ${tool.name}, which another verb already is` });
        else if (id !== undefined) {
          tools.add(tool.name);
          const props: Props = {
            title: tool.title,
            toolName: toolName(name, p.path),
            readOnlyHint: tool.annotations.readOnlyHint,
            destructiveHint: tool.annotations.destructiveHint,
            idempotentHint: tool.annotations.idempotentHint,
            inputs: Object.keys(tool.inputSchema.properties),
            required: tool.inputSchema.required,
            tier: p.facts.tier,
          };
          if (put("mcp-tool", id, tool.name, tool.description, source, props)) {
            edge(verb, id);
            projections.push(id);
            surface = id;
          }
        }
      } else notProjected.push(`mcp: ${withheld("mcp", p)}`);
      if (exposed(p)) {
        const method = methodOf(p) === "get" ? "GET" : "POST";
        const route = pathOf(p.path);
        const id = idOf(restIdOf(method, route));
        if (id !== undefined) {
          const props: Props = { method, path: route, operationId: operationId(name, p.path), effect: p.facts.effect, tier: p.facts.tier, idempotent: p.facts.idempotent };
          if (put("rest-route", id, `${method} ${route}`, p.command.summary, source, props, documentId)) {
            edge(verb, id);
            projections.push(id);
            routes.push(id);
            surface ??= id;
          }
        }
      } else notProjected.push(`rest: ${withheld("rest", p)}`);
    }

    // its action, in governance, and the verb it is drawn as
    const values = ANNOTATIONS.map((a): [Annotation, PropValue] => [a, annotationValue(a, p.facts, p.reach)]);
    put("action", action, p.id, p.facts.summary, source, Object.fromEntries(values));
    edge(action, verb);
    for (const a of ANNOTATIONS) dispositions.push(dispose(a, { action, verb, cli, surface, flags, facts: p.facts, reach: p.reach, decision }));
    const examples = p.command.examples.map((x) => `${name} ${[...p.path, ...x.args].join(" ")}  # ${x.says}`);
    const parent = origin === name ? anchor : idOf(pluginIdOf(origin));
    put("verb", verb, p.id, p.command.summary, source, { ...Object.fromEntries(values), path: p.path, origin, examples, offered: Object.keys(offeredOptions(p)), projections, notProjected }, parent);
    if (origin !== name && parent !== undefined) owned.set(origin, [...(owned.get(origin) ?? []), verb]);
  }

  // the plugins that contributed verbs
  for (const [owner, verbs] of [...owned.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const id = idOf(pluginIdOf(owner));
    if (id !== undefined) put("plugin", id, owner, `The plugin ${owner}, which contributes ${verbs.length} ${verbs.length === 1 ? "verb" : "verbs"} to ${name}.`, sourceOf({ kind: "plugin", owner }, owner), { verbs }, anchor);
  }

  // the document of the REST surface, which holds the routes
  if (documentId !== undefined && routes.length > 0) {
    put("openapi-document", documentId, `${name} OpenAPI 3.1`, `The OpenAPI 3.1 document of ${name} for a caller of the tier ${tier}.`, sourceOf({ kind: "program" }), { openapi: "3.1.0", version: program.version, tier, paths: routes.length });
  }

  // what is wrong with the model
  for (const p of modelProblems(program)) {
    const words = problemWords(p);
    const verb = words === undefined ? undefined : verbIdOf(name, words);
    findings.push({ rule: p.rule, element: verb !== undefined && verb.kind === "ok" ? verb.value : anchor, message: problemMessage(p) });
  }
  for (const message of catalogueProblems(program.catalogue, program.patterns)) findings.push({ rule: "describe/catalogue", element: anchor, message });

  return {
    name: `${name}-${tier}`,
    library: "headless",
    title: `${name} for the tier ${tier}`,
    summary: program.summary,
    layers: LAYERS,
    elements,
    trace,
    findings,
    dispositions,
    instances: [],
  };
}

/**
 * The models of a program, one for each tier of its ladder, or why none can be made: the id of the program itself is not an id. An element whose own id cannot be made is left out and
 * named by a finding of its model (`describe/id`).
 */
export function describeChecked(program: Program, options: DescribeOptions = {}): Result<readonly LayeredModel[], readonly DescribeProblem[]> {
  const anchor = programIdOf(program.name);
  if (anchor.kind === "err") return err([{ rule: "describe/program-id", message: anchor.error }]);
  return ok(program.tiers.ladder.map((tier) => modelFor(program, tier, anchor.value, options)));
}

/**
 * The layered models of a headless program, one for each tier of its ladder (lowest first), for a documentation generator to read: `describe(program)`. None where the program's name cannot make an id
 * (`describeChecked` says why).
 */
export function describe(program: Program, options: DescribeOptions = {}): readonly LayeredModel[] {
  const r = describeChecked(program, options);
  return r.kind === "ok" ? r.value : [];
}
