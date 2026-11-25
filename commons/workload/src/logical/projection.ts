// Spec: 0004-workload-projections FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-009
/**
 * What is made from a workload for each reader, from the one source, the same bytes each time. Each form gives a `WorkloadView` of its workload (its nodes with the autonomy derived for each, the verbs it calls, the controls
 * it cites, the evidence it yields); this module makes from views, whatever their form, the index `SKILLS.md`, one `SKILL.md` for each workload as Claude Code documents it, a checklist for a person, an implementation statement
 * for each control in the shape of the statement of a system security plan (in Markdown; OSCAL JSON is not written, because its field names were not read), the rules of a harness from the effects (allow, ask and deny) and the
 * scenario of the specification. Every dialect says the same autonomy for each node because they all render the same lines of `nodeLines`. Pure.
 *
 * @example
 * ```ts
 * import { nodeLines } from "./projection.ts";
 * // nodeLines(view): ["- `claim-order`: verb, agent-acts-human-reviews", ...]
 * ```
 *
 * @module
 */
import { type Crosswalk, type ControlRef, controlUrn, mappedControls } from "@intellectual-frontiers/grc/governance";
import { type Autonomy, AUTONOMY } from "@intellectual-frontiers/workbench/governance";
import type { RenderedFile } from "@intellectual-frontiers/workbench/logical";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type BuiltFormId, citeText, type Finding, finding, type DialectInfo, type DialectRegistry, DIALECTS, type Expectation, type InputSpec, type SpecCite, type Trigger, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { lessAutonomous } from "./autonomy.ts";

/** The command a harness runs to call a verb: one program of the library, never a shell string built from a node. It is the default of the option `verbCommand`; a host that has a program of its own says it (0004-workload-projections FR-011). */
export const VERB_COMMAND = "bun run workload verb";

/** What a projection may be asked: the command a harness runs to call a verb, by default `VERB_COMMAND`. */
export type ProjectionOptions = { readonly verbCommand?: string };

/** The refusal of a command that is not words and a path: the finding, with the code `E-WL-HARNESS-COMMAND-INVALID`. */
export class VerbCommandError extends Error {
  readonly finding: Finding;
  constructor(f: Finding) {
    super(`${f.code}: ${f.message}`);
    this.name = "VerbCommandError";
    this.finding = f;
  }
}

const COMMAND_WORDS = /^[A-Za-z0-9_./-]+( [A-Za-z0-9_./-]+)*$/u;

/** The command of a projection: the one given if it is words and a path with no shell syntax (single spaces, at most 200 characters), the default if none is given, or the finding `E-WL-HARNESS-COMMAND-INVALID`. */
export function verbCommandOf(options: ProjectionOptions = {}): Result<string, Finding> {
  const c = options.verbCommand;
  if (c === undefined) return ok(VERB_COMMAND);
  if (c.length > 200 || !COMMAND_WORDS.test(c)) return err(finding("E-WL-HARNESS-COMMAND-INVALID", "", `the verb command ${JSON.stringify(c)} is not words and a path with no shell syntax in it`));
  return ok(c);
}

/** The command of a projection, or the refusal thrown as a `VerbCommandError`. */
function commandOrThrow(options: ProjectionOptions): string {
  const r = verbCommandOf(options);
  if (r.kind === "err") throw new VerbCommandError(r.error);
  return r.value;
}

/** The marks between which the block of `AGENTS.md` is kept. */
export const WORKLOAD_MARKS = { begin: "<!-- workload:begin -->", end: "<!-- workload:end -->" } as const;

/** One node as a reader sees it, in the words of its form. */
export type ViewNode = {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly derived: Autonomy;
  readonly autonomy: Autonomy;
  readonly raisedBy?: string;
  /** Who acts: a person, the agent, or the agent proposing for a person. */
  readonly who: string;
  /** What to keep, as a phrase that follows `who`, or empty. */
  readonly keep: string;
  /** The verb the node calls, where it calls one. */
  readonly verb?: string;
  readonly controls: readonly ControlRef[];
  readonly spec: readonly SpecCite[];
  /** What the node yields as evidence, in a line, where it yields any. */
  readonly evidence?: string;
  /** The place of the node in the scenario: a node that is done, a node that is asserted, or neither. */
  readonly scenario: "when" | "then" | "none";
  /** What the scenario says of it. */
  readonly says: string;
};

/** A workload as a reader sees it: the same shape for every form. */
export type WorkloadView = {
  readonly id: string;
  readonly form: BuiltFormId;
  readonly title: string;
  readonly version: string;
  readonly summary: string;
  readonly trigger: Trigger;
  readonly expect?: Expectation;
  readonly inputs: readonly InputSpec[];
  readonly given: readonly string[];
  readonly nodes: readonly ViewNode[];
  /** Whether a gate or an ask stops the run for a person. */
  readonly needsPerson: boolean;
  /** What the form tells an agent that runs it, in a sentence or two. */
  readonly howToRun: string;
};

type Part = string | readonly Part[];
const flat = (p: Part): readonly string[] => (typeof p === "string" ? [p] : p.flatMap(flat));
const lines = (...parts: readonly Part[]): string => `${flat(parts).join("\n")}\n`;
const word = (s: string): string => s.replace(/\s+/gu, " ").trim();
const byId = <T extends { readonly id: string }>(list: readonly T[]): readonly T[] => [...list].sort((a, b) => (a.id < b.id ? -1 : 1));

/** What starts a workload, in words. */
export function triggerText(t: Trigger): string {
  switch (t.kind) {
    case "manual":
      return "manual";
    case "schedule":
      return `a schedule, ${t.cadence}`;
    case "event":
      return `the event ${t.name}`;
    case "alert":
      return `the alert ${t.name}`;
    default:
      return t satisfies never;
  }
}

/** The line every dialect writes for a node: its id, its kind and the autonomy derived for it. */
export const nodeLines = (view: WorkloadView): readonly string[] => view.nodes.map((n) => `- \`${n.id}\`: ${n.kind}, ${n.autonomy}`);

/** The controls a workload cites, once each, as the URNs of grc, in order. */
export const controlsOf = (view: WorkloadView): readonly string[] => [...new Set(view.nodes.flatMap((n) => n.controls.map((c) => controlUrn(c.framework, c.version, c.control))))].sort();

/** The verbs a workload calls, each with the strictest autonomy of its nodes. */
export function verbLevels(view: WorkloadView): ReadonlyMap<string, Autonomy> {
  const out = new Map<string, Autonomy>();
  for (const n of view.nodes) if (n.verb !== undefined) out.set(n.verb, lessAutonomous(out.get(n.verb) ?? "agent-autonomous", n.autonomy));
  return out;
}

/** The rules of a harness from the effects: the verbs an agent may call, those it asks about and those it never calls. */
export type Rules = { readonly allow: readonly string[]; readonly ask: readonly string[]; readonly deny: readonly string[] };

/** The rules for some workloads: a verb takes the strictest level of every node that calls it, in every workload. */
export function rulesOf(views: readonly WorkloadView[], options: ProjectionOptions = {}): Rules {
  const command = commandOrThrow(options);
  const all = new Map<string, Autonomy>();
  for (const v of views) for (const [verb, l] of verbLevels(v)) all.set(verb, lessAutonomous(all.get(verb) ?? "agent-autonomous", l));
  const rule = (v: string): string => `Bash(${command} ${v} *)`;
  const pick = (f: (l: Autonomy) => boolean): readonly string[] => [...all].filter(([, l]) => f(l)).map(([v]) => rule(v)).sort();
  return {
    allow: pick((l) => l === "agent-autonomous" || l === "agent-acts-human-reviews"),
    ask: pick((l) => l === "agent-proposes"),
    deny: pick((l) => l === "human-only"),
  };
}

/** The statement of a skill: one `SKILL.md` as Claude Code reads it. */
export function skillMd(view: WorkloadView, verbs: VerbRegistry = VERBS, options: ProjectionOptions = {}): string {
  const command = commandOrThrow(options);
  const rules = rulesOf([view], options);
  const header = ["---", `name: ${view.id}`, `description: ${JSON.stringify(word(`${view.summary} Version ${view.version}.`))}`, `disable-model-invocation: ${view.needsPerson ? "true" : "false"}`, ...(rules.allow.length === 0 ? [] : [`allowed-tools: ${rules.allow.join(" ")}`]), "---"];
  const verbList = [...verbLevels(view)].sort(([a], [b]) => (a < b ? -1 : 1)).map(([v, l]) => `- \`${v}\`${verbs.get(v) === undefined ? "" : ` (${verbs.get(v)?.package}): ${verbs.get(v)?.summary}`}; the strictest autonomy of its nodes is ${l}`);
  const evidence = view.nodes.flatMap((n) => (n.evidence === undefined ? [] : [`- \`${n.id}\`: ${n.evidence}`]));
  return lines(
    header,
    `# ${view.title}`,
    "",
    "## When to use",
    "",
    view.summary,
    "",
    `Form: ${view.form}. Started by: ${triggerText(view.trigger)}.${view.expect === undefined ? "" : ` A run is expected to ${view.expect.outcome === "completes" ? "complete" : view.expect.outcome === "parks" ? "park for a person" : "fail"}.`}`,
    "",
    "## How to run it",
    "",
    `You orchestrate: every effect is a verb of the pinned packages, called by its id as \`${command} <id>\` and never by a command built from the text of a node. A \`judge\` only proposes: record what it proposes and apply nothing from it. At an ask or a gate stop and hand back: a person answers, and you never approve your own work. ${view.howToRun}`,
    "",
    "## Inputs",
    "",
    ...(view.inputs.length === 0 ? ["- none"] : view.inputs.map((i) => `- \`${i.name}\` (${i.type}${i.required ? ", required" : ""})`)),
    "",
    "## Verbs",
    "",
    verbList,
    "",
    "## Nodes and the autonomy derived for each",
    "",
    nodeLines(view),
    "",
    "## Controls",
    "",
    ...(controlsOf(view).length === 0 ? ["- none cited"] : controlsOf(view).map((c) => `- \`${c}\``)),
    "",
    "## Evidence",
    "",
    ...(evidence.length === 0 ? ["- none"] : evidence),
    "",
    "## Links",
    "",
    "- [The index of skills](../../../SKILLS.md)",
    `- [The checklist of a person](../../../workload/${view.id}.md)`,
  );
}

/** The index of the skills: one row for each workload. */
export function skillsIndex(views: readonly WorkloadView[]): string {
  const top = (v: WorkloadView): Autonomy => v.nodes.map((n) => n.autonomy).reduce((a, b) => (AUTONOMY.indexOf(a) >= AUTONOMY.indexOf(b) ? a : b), "human-only");
  return lines(
    "# Skills",
    "",
    "Generated from the workloads of the library; do not edit it. An agent orchestrates and every effect is a verb of the pinned packages; what a person must do is a gate or an ask.",
    "",
    "| Skill | Form | When to use | Nodes | Checklist |",
    "|---|---|---|---|---|",
    byId(views).map((v) => `| \`${v.id}\` | ${v.form} | ${word(v.summary)} | ${v.nodes.length} (most autonomous: ${top(v)}) | [${v.id}](workload/${v.id}.md) |`),
  );
}

/** The checklist of a person for one workload: each node with its kind, its autonomy, who acts and what to keep. */
export function checklist(view: WorkloadView): string {
  const items = view.nodes.map((n) => `- [ ] \`${n.id}\`: ${n.kind}, ${n.autonomy} - ${n.title} (${n.who}${n.keep})`);
  return lines(`# Checklist: ${view.title}`, "", `Generated from the ${view.form} workload \`${view.id}\` ${view.version}; do not edit it. It is started by ${triggerText(view.trigger)}. Each line is a node, its kind, the autonomy derived for it and who acts.`, "", "## Nodes and the autonomy derived for each", "", items, "", "## Controls", "", ...(controlsOf(view).length === 0 ? ["- none cited"] : controlsOf(view).map((c) => `- \`${c}\``)));
}

/** One run a statement links to: the workload and the id of the work order. */
export type RunLink = { readonly workload: string; readonly run: string };

/** The implementation statement of each control the workloads cite, with the runs that recorded them, and the controls a crosswalk relates to it. */
export function statements(views: readonly WorkloadView[], runs: readonly RunLink[] = [], crosswalks: readonly Crosswalk[] = []): string {
  const byControl = new Map<string, { readonly view: WorkloadView; readonly node: ViewNode }[]>();
  for (const v of views) for (const n of v.nodes) for (const c of n.controls) byControl.set(controlUrn(c.framework, c.version, c.control), [...(byControl.get(controlUrn(c.framework, c.version, c.control)) ?? []), { view: v, node: n }]);
  const urns = [...byControl.keys()].sort();
  if (urns.length === 0) return lines("# Implementation statements", "", "No control is cited by the workloads.");
  return lines(
    "# Implementation statements",
    "",
    "Generated from the workloads; do not edit it. Each statement is in the shape of the statement of a system security plan, in Markdown: the control, how the workloads meet it, the evidence and the runs. The events of a run record an activity, the agent that took part and the person it acted for (the terms of W3C PROV-O: Activity, wasAssociatedWith, actedOnBehalfOf).",
    "",
    urns.flatMap((u) => {
      const where = byControl.get(u) ?? [];
      const ids = [...new Set(where.map((w) => w.view.id))];
      const related = mappedControls(crosswalks, u);
      const yields = where.filter((w) => w.node.evidence !== undefined);
      return [
        `## \`${u}\``,
        "",
        "Implemented by:",
        ...where.map((w) => `- \`${w.view.id}\` node \`${w.node.id}\` (${w.node.kind}, ${w.node.autonomy}): ${w.node.title}`),
        "",
        "Evidence:",
        ...yields.map((w) => `- node \`${w.node.id}\`: ${w.node.evidence}`),
        ...(yields.length > 0 ? [] : ["- none yet from these nodes"]),
        "",
        "Runs:",
        ...runs.filter((r) => ids.some((x) => x === r.workload)).map((r) => `- run \`${r.run}\` of \`${r.workload}\``),
        ...(runs.some((r) => ids.some((x) => x === r.workload)) ? [] : ["- no run recorded yet"]),
        ...(related.length === 0 ? [] : ["", "Related controls (by a crosswalk):", ...related.map((m) => `- \`${m.urn}\`: ${m.relationship}, strength ${m.strength}`)]),
        "",
      ];
    }),
  );
}

/** A workload as the scenario of a specification: its Given is the requirements it needs, its When the nodes in order, its Then the nodes that assert, each citing the requirements the nodes cite. */
export function scenario(view: WorkloadView): string {
  const cites = (n: ViewNode): string => (n.spec.length === 0 ? "" : ` per ${n.spec.map(citeText).join(" and ")}`);
  const given = view.given.map((g, i) => `  ${i === 0 ? "Given" : "And"} the workbench requirement ${g} is met`);
  const when = view.nodes.filter((n) => n.scenario === "when").map((n, i) => `  ${i === 0 ? "When" : "And"} ${n.says}${cites(n)}`);
  const then = view.nodes.filter((n) => n.scenario === "then").map((n, i) => `  ${i === 0 ? "Then" : "And"} ${n.says}${cites(n)}`);
  return lines(`Scenario: ${view.title}`, given.length === 0 ? ["  Given nothing is required of the workbench"] : given, when, then.length === 0 ? ["  Then the run ends with every store detached"] : then);
}

/** A dialect with its renderer: adding a harness is registering one. It renders the views of workloads of any form. */
export type DialectImpl = { readonly info: DialectInfo; render(views: readonly WorkloadView[], options?: ProjectionOptions): readonly RenderedFile[] };

/** A dialect registered: the list with one more, or why not (an id twice, or a dialect the registry does not hold). */
export function registerDialect(impls: readonly DialectImpl[], impl: DialectImpl, registry: DialectRegistry = DIALECTS): Result<readonly DialectImpl[], string> {
  if (impls.some((i) => i.info.id === impl.info.id)) return err(`the dialect ${impl.info.id} has a renderer already`);
  if (!registry.has(impl.info.id)) return err(`the dialect ${impl.info.id} is not in the registry of dialects`);
  return ok([...impls, impl]);
}

/** The files of every dialect given from the one source, by dialect id. */
export function projectAll(views: readonly WorkloadView[], impls: readonly DialectImpl[], options: ProjectionOptions = {}): Readonly<Record<string, readonly RenderedFile[]>> {
  commandOrThrow(options);
  return Object.fromEntries(impls.map((i) => [i.info.id, i.render(views, options)]));
}
