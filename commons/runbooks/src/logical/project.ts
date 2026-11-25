// Spec: 0004-runbooks-projections FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * What is made from a runbook for each reader, from the one source, the same bytes each time: the index `SKILLS.md`, one `SKILL.md` for each runbook as Claude Code documents it, a checklist for a person, an implementation
 * statement for each control in the shape of the statement of a system security plan (in Markdown; OSCAL JSON is not written, because its field names were not read), the rules of a harness from the effects (allow, ask and deny),
 * and the scenario of the specification. A dialect is one `DialectImpl`: it is added by registering one, and every dialect says the same autonomy for each step because they all render the same lines of `stepLines`.
 *
 * @example
 * ```ts
 * import { stepLines } from "./project.ts";
 * // stepLines(runbook): ["- `claim-order`: verb, agent-acts-human-reviews", ...]
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Crosswalk, controlUrn, mappedControls } from "@intellectual-frontiers/grc/governance";
import type { Autonomy } from "@intellectual-frontiers/workbench/governance";
import { AUTONOMY } from "@intellectual-frontiers/workbench/governance";
import type { RenderedFile } from "@intellectual-frontiers/workbench/logical";
import { citeText, DIALECTS, type DialectInfo, type DialectRegistry, flatten, type Runbook, type Step, VERBS, type VerbRegistry } from "@intellectual-frontiers/runbooks/governance";
import { lessAutonomous, levelsOf } from "./autonomy.ts";

/** The command a harness runs to call a verb: one program of the library, never a shell string built from a step. */
export const VERB_COMMAND = "bun run runbooks verb";

/** The marks between which the block of `AGENTS.md` is kept. */
export const RUNBOOKS_MARKS = { begin: "<!-- runbooks:begin -->", end: "<!-- runbooks:end -->" } as const;

type Part = string | readonly Part[];
const flat = (p: Part): readonly string[] => (typeof p === "string" ? [p] : p.flatMap(flat));
const lines = (...parts: readonly Part[]): string => `${flat(parts).join("\n")}\n`;
const word = (s: string): string => s.replace(/\s+/gu, " ").trim();

/** The line every dialect writes for a step: its id, its kind and the autonomy derived for it. */
export function stepLines(runbook: Runbook): readonly string[] {
  return levelsOf(runbook).map((l) => `- \`${l.id}\`: ${l.kind}, ${l.autonomy}`);
}

const titles = (runbook: Runbook): ReadonlyMap<string, Step> => new Map(flatten(runbook.steps).map((s) => [String(s.id), s]));

/** The controls a runbook cites, once each, as the URNs of grc, in order. */
export function controlsOf(runbook: Runbook): readonly string[] {
  return [...new Set(flatten(runbook.steps).flatMap((s) => (s.controls ?? []).map((c) => controlUrn(c.framework, c.version, c.control))))].sort();
}

/** The verbs a runbook calls, each with the strictest autonomy of its steps. */
export function verbLevels(runbook: Runbook): ReadonlyMap<string, Autonomy> {
  const level = new Map(levelsOf(runbook).map((l) => [String(l.id), l.autonomy]));
  const out = new Map<string, Autonomy>();
  for (const s of flatten(runbook.steps)) {
    const v = s.kind === "verb" || s.kind === "undo" ? s.verb : s.kind === "check" ? s.using : undefined;
    if (v === undefined) continue;
    const l = s.kind === "check" ? "agent-autonomous" : (level.get(s.id) ?? "human-only");
    out.set(v, lessAutonomous(out.get(v) ?? "agent-autonomous", l));
  }
  return out;
}

/** The rules of a harness from the effects: the verbs an agent may call, those it asks about and those it never calls. */
export type Rules = { readonly allow: readonly string[]; readonly ask: readonly string[]; readonly deny: readonly string[] };

/** The rules for some runbooks: a verb takes the strictest level of every step that calls it, in every runbook. */
export function rulesOf(runbooks: readonly Runbook[]): Rules {
  const all = new Map<string, Autonomy>();
  for (const r of runbooks) for (const [v, l] of verbLevels(r)) all.set(v, lessAutonomous(all.get(v) ?? "agent-autonomous", l));
  const rule = (v: string): string => `Bash(${VERB_COMMAND} ${v} *)`;
  const pick = (f: (l: Autonomy) => boolean): readonly string[] => [...all].filter(([, l]) => f(l)).map(([v]) => rule(v)).sort();
  return {
    allow: pick((l) => l === "agent-autonomous" || l === "agent-acts-human-reviews"),
    ask: pick((l) => l === "agent-proposes"),
    deny: pick((l) => l === "human-only"),
  };
}

/** The statement of a skill: one `SKILL.md` as Claude Code reads it. */
export function skillMd(runbook: Runbook, verbs: VerbRegistry = VERBS): string {
  const rules = rulesOf([runbook]);
  const needsPerson = flatten(runbook.steps).some((s) => s.kind === "gate" || s.kind === "ask");
  const header = ["---", `name: ${runbook.id}`, `description: ${JSON.stringify(word(`${runbook.summary} Version ${runbook.version}.`))}`, `disable-model-invocation: ${needsPerson ? "true" : "false"}`, ...(rules.allow.length === 0 ? [] : [`allowed-tools: ${rules.allow.join(" ")}`]), "---"];
  const verbList = [...verbLevels(runbook)].sort(([a], [b]) => (a < b ? -1 : 1)).map(([v, l]) => `- \`${v}\`${verbs.get(v) === undefined ? "" : ` (${verbs.get(v)?.package}): ${verbs.get(v)?.summary}`}; the strictest autonomy of its steps is ${l}`);
  const evidence = flatten(runbook.steps).flatMap((s) => (s.kind === "check" ? [`- \`${s.id}\`: ${s.evidence}: ${s.asserts}`] : s.kind === "verb" && s.verb === "work.record" ? [`- \`${s.id}\`: a record on the work order`] : []));
  return lines(
    header,
    `# ${runbook.title}`,
    "",
    "## When to use",
    "",
    runbook.summary,
    "",
    "## How to run it",
    "",
    `You orchestrate: every effect is a verb of the pinned packages, called by its id as \`${VERB_COMMAND} <id>\` and never by a command built from the text of a step. A \`judge\` step only proposes: record what it proposes and apply nothing from it. At an \`ask\` or a \`gate\` stop and hand back: a person answers, and you never approve your own work.`,
    "",
    "## Inputs",
    "",
    ...(runbook.inputs.length === 0 ? ["- none"] : runbook.inputs.map((i) => `- \`${i.name}\` (${i.type}${i.required ? ", required" : ""})`)),
    "",
    "## Verbs",
    "",
    verbList,
    "",
    "## Steps and the autonomy derived for each",
    "",
    stepLines(runbook),
    "",
    "## Controls",
    "",
    ...(controlsOf(runbook).length === 0 ? ["- none cited"] : controlsOf(runbook).map((c) => `- \`${c}\``)),
    "",
    "## Evidence",
    "",
    ...(evidence.length === 0 ? ["- none"] : evidence),
    "",
    "## Links",
    "",
    "- [The index of skills](../../../SKILLS.md)",
    `- [The checklist of a person](../../../runbooks/${runbook.id}.md)`,
  );
}

/** The index of the skills: one row for each runbook. */
export function skillsIndex(runbooks: readonly Runbook[]): string {
  const sorted = [...runbooks].sort((a, b) => (a.id < b.id ? -1 : 1));
  const top = (r: Runbook): Autonomy => levelsOf(r).map((l) => l.autonomy).reduce((a, b) => (AUTONOMY.indexOf(a) >= AUTONOMY.indexOf(b) ? a : b), "human-only");
  return lines(
    "# Skills",
    "",
    "Generated from the runbooks of the library; do not edit it. An agent orchestrates and every effect is a verb of the pinned packages; what a person must do is a gate or an ask.",
    "",
    "| Skill | When to use | Steps | Checklist |",
    "|---|---|---|---|",
    sorted.map((r) => `| \`${r.id}\` | ${word(r.summary)} | ${flatten(r.steps).length} (most autonomous: ${top(r)}) | [${r.id}](runbooks/${r.id}.md) |`),
  );
}

/** The checklist of a person for one runbook: each step with its kind, its autonomy, who acts and what to keep. */
export function checklist(runbook: Runbook): string {
  const by = titles(runbook);
  const items = levelsOf(runbook).map((l) => {
    const s = by.get(l.id);
    const who = s === undefined ? "" : s.kind === "gate" || s.kind === "ask" ? "a person acts" : s.kind === "judge" ? "the agent proposes, a person decides" : l.autonomy === "human-only" ? "a person acts" : l.autonomy === "agent-proposes" ? "the agent proposes and a person applies" : "the agent acts";
    const keep = s === undefined ? "" : s.kind === "check" ? `; keep the ${s.evidence} as evidence` : s.kind === "gate" ? `; approver ${s.approver}, never the author` : s.kind === "ask" ? `; approver ${s.approver}, within ${s.deadlineHours} hours` : "";
    return `- [ ] \`${l.id}\`: ${l.kind}, ${l.autonomy} - ${s?.title ?? ""} (${who}${keep})`;
  });
  return lines(`# Checklist: ${runbook.title}`, "", `Generated from the runbook \`${runbook.id}\` ${runbook.version}; do not edit it. Each line is a step, its kind, the autonomy derived for it and who acts.`, "", "## Steps and the autonomy derived for each", "", items, "", "## Controls", "", ...(controlsOf(runbook).length === 0 ? ["- none cited"] : controlsOf(runbook).map((c) => `- \`${c}\``)));
}

/** One run a statement links to: the runbook and the id of the work order. */
export type RunLink = { readonly runbook: string; readonly run: string };

/** The implementation statement of each control the runbooks cite, with the runs that recorded them, and the controls a crosswalk relates to it. */
export function statements(runbooks: readonly Runbook[], runs: readonly RunLink[] = [], crosswalks: readonly Crosswalk[] = []): string {
  const byControl = new Map<string, { readonly runbook: Runbook; readonly step: Step }[]>();
  for (const r of runbooks) for (const s of flatten(r.steps)) for (const c of s.controls ?? []) byControl.set(controlUrn(c.framework, c.version, c.control), [...(byControl.get(controlUrn(c.framework, c.version, c.control)) ?? []), { runbook: r, step: s }]);
  const urns = [...byControl.keys()].sort();
  if (urns.length === 0) return lines("# Implementation statements", "", "No control is cited by the runbooks.");
  const level = (rb: Runbook, id: string): string => levelsOf(rb).find((l) => l.id === id)?.autonomy ?? "";
  return lines(
    "# Implementation statements",
    "",
    "Generated from the runbooks; do not edit it. Each statement is in the shape of the statement of a system security plan, in Markdown: the control, how the runbooks meet it, the evidence and the runs. The events of a run record an activity, the agent that took part and the person it acted for (the terms of W3C PROV-O: Activity, wasAssociatedWith, actedOnBehalfOf).",
    "",
    urns.flatMap((u) => {
      const where = byControl.get(u) ?? [];
      const rbs = [...new Set(where.map((w) => w.runbook.id))];
      const related = mappedControls(crosswalks, u);
      return [
        `## \`${u}\``,
        "",
        "Implemented by:",
        ...where.map((w) => `- \`${w.runbook.id}\` step \`${w.step.id}\` (${w.step.kind}, ${level(w.runbook, w.step.id)}): ${w.step.title}`),
        "",
        "Evidence:",
        ...where.filter((w) => w.step.kind === "check" || (w.step.kind === "verb" && w.step.verb === "work.record")).map((w) => `- step \`${w.step.id}\`: ${w.step.kind === "check" ? `${w.step.evidence} of ${w.step.asserts}` : "the record on the work order"}`),
        ...(where.some((w) => w.step.kind === "check" || (w.step.kind === "verb" && w.step.verb === "work.record")) ? [] : ["- none yet from these steps"]),
        "",
        "Runs:",
        ...(runs.filter((r) => rbs.some((x) => x === r.runbook)).map((r) => `- run \`${r.run}\` of \`${r.runbook}\``)),
        ...(runs.some((r) => rbs.some((x) => x === r.runbook)) ? [] : ["- no run recorded yet"]),
        ...(related.length === 0 ? [] : ["", "Related controls (by a crosswalk):", ...related.map((m) => `- \`${m.urn}\`: ${m.relationship}, strength ${m.strength}`)]),
        "",
      ];
    }),
  );
}

/** A runbook as the scenario of a specification: its Given is the requirements it needs, its When the steps, its Then the checks, each citing the requirements the steps cite. */
export function scenario(runbook: Runbook): string {
  const cites = (s: Step): string => (s.spec.length === 0 ? "" : ` per ${s.spec.map(citeText).join(" and ")}`);
  const flat = flatten(runbook.steps);
  const given = runbook.given.map((g, i) => `  ${i === 0 ? "Given" : "And"} the workbench requirement ${g} is met`);
  const when = flat.filter((s) => s.kind !== "check" && s.kind !== "undo").map((s, i) => `  ${i === 0 ? "When" : "And"} ${s.title}${cites(s)}`);
  const then = flat.filter((s) => s.kind === "check").map((s, i) => `  ${i === 0 ? "Then" : "And"} ${s.kind === "check" ? s.asserts : ""}${cites(s)}`);
  return lines(`Scenario: ${runbook.title}`, given.length === 0 ? ["  Given nothing is required of the workbench"] : given, when, then.length === 0 ? ["  Then the run ends with every store detached"] : then);
}

/** A dialect with its renderer: adding a harness is registering one. */
export type DialectImpl = { readonly info: DialectInfo; render(runbooks: readonly Runbook[]): readonly RenderedFile[] };

const claude = DIALECTS.get("claude-code");
const codex = DIALECTS.get("codex");
const human = DIALECTS.get("human");

/** The dialect of Claude Code: the index, a skill for each runbook and the permissions of its settings. */
export const claudeCode: DialectImpl | undefined =
  claude === undefined
    ? undefined
    : {
        info: claude,
        render: (rbs) => {
          const r = rulesOf(rbs);
          return [
            { path: "SKILLS.md", text: skillsIndex(rbs) },
            ...[...rbs].sort((a, b) => (a.id < b.id ? -1 : 1)).map((rb) => ({ path: `.claude/skills/${rb.id}/SKILL.md`, text: skillMd(rb) })),
            { path: ".claude/runbooks.settings.json", text: `${JSON.stringify({ permissions: { allow: r.allow, ask: r.ask, deny: r.deny } }, null, 2)}\n` },
          ];
        },
      };

/** The dialect of Codex: a block of `AGENTS.md`, which Codex reads, with the same autonomy for each step and the rules in words. */
export const codexDialect: DialectImpl | undefined =
  codex === undefined
    ? undefined
    : {
        info: codex,
        render: (rbs) => {
          const r = rulesOf(rbs);
          const sorted = [...rbs].sort((a, b) => (a.id < b.id ? -1 : 1));
          const text = lines(
            RUNBOOKS_MARKS.begin,
            "## Runbooks",
            "",
            `Generated from the runbooks of the library; do not edit between the marks. You orchestrate; every effect is a verb of the pinned packages, called as \`${VERB_COMMAND} <id>\`. A judge only proposes. At an ask or a gate stop and hand back.`,
            "",
            `Verbs you may call: ${r.allow.length === 0 ? "none" : r.allow.map((x) => x.replace(/^Bash\(|\)$/gu, "")).join("; ")}.`,
            `Verbs you propose and a person applies: ${r.ask.length === 0 ? "none" : r.ask.map((x) => x.replace(/^Bash\(|\)$/gu, "")).join("; ")}.`,
            `Verbs a person alone calls: ${r.deny.length === 0 ? "none" : r.deny.map((x) => x.replace(/^Bash\(|\)$/gu, "")).join("; ")}.`,
            "",
            sorted.flatMap((rb) => [`### ${rb.id}`, "", word(rb.summary), "", stepLines(rb), ""]),
            RUNBOOKS_MARKS.end,
          );
          return [{ path: "AGENTS.md", text }];
        },
      };

/** The dialect of a person: the checklist of each runbook. */
export const humanDialect: DialectImpl | undefined = human === undefined ? undefined : { info: human, render: (rbs) => [...rbs].sort((a, b) => (a.id < b.id ? -1 : 1)).map((rb) => ({ path: `runbooks/${rb.id}.md`, text: checklist(rb) })) };

/** The dialects the library renders today. */
export const DIALECT_IMPLS: readonly DialectImpl[] = [claudeCode, codexDialect, humanDialect].filter((d): d is DialectImpl => d !== undefined);

/** A dialect registered: the list with one more, or why not (an id twice, or a dialect the registry does not hold). */
export function registerDialect(impls: readonly DialectImpl[], impl: DialectImpl, registry: DialectRegistry = DIALECTS): Result<readonly DialectImpl[], string> {
  if (impls.some((i) => i.info.id === impl.info.id)) return err(`the dialect ${impl.info.id} has a renderer already`);
  if (!registry.has(impl.info.id)) return err(`the dialect ${impl.info.id} is not in the registry of dialects`);
  return ok([...impls, impl]);
}

/** The files of every registered dialect from the one source, by dialect id. */
export function projectAll(runbooks: readonly Runbook[], impls: readonly DialectImpl[] = DIALECT_IMPLS): Readonly<Record<string, readonly RenderedFile[]>> {
  return Object.fromEntries(impls.map((i) => [i.info.id, i.render(runbooks)]));
}
