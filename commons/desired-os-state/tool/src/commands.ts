// Spec: 0002-tool-command FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The five verbs of `desired-os-state tool`: `list` (what the fleet declares and how each tool is resolved), `show` (one tool: its declaration, the dialect chosen or why none was, and what is installed), `ensure` (the
 * plan, then, where asked, the tools a phase needs), `doctor` (what drifted, by phase) and `clean` (what can be got again). Every one reads the fleet's configuration; none holds a tool or a dialect.
 *
 * @example
 * ```ts
 * import { toolCommands } from "./commands.ts";
 * // toolCommands(config) is the commands of the branch `tool`
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { defineReach, problem, type Problem } from "@intellectual-frontiers/headless/governance";
import { command, outcomeOf, planHash, runPlan, type Node, type Outcome } from "@intellectual-frontiers/headless/logical";
import { localExecutor } from "@intellectual-frontiers/headless/targets/local";
import { resolveTools } from "@intellectual-frontiers/toolchain/logical";
import { flag, value } from "@intellectual-frontiers/terminal/args";
import { analyse, describeProblems, parsePhase, selectNames, writeRendered, type Analysis } from "./analysis.ts";
import type { ToolPluginConfig } from "./config.ts";

const read = defineReach({ channels: ["local", "mcp"], readOnly: true, idempotent: true });
const write = defineReach({ channels: ["local"], idempotent: true });
const remove = defineReach({ channels: ["local"], confirmation: "flag" });

const phaseOption = value({ help: "Only the tools this phase of work needs (core, dev, test, stage, publish).", valueName: "PHASE" });
const names = [{ name: "tool", help: "The tools by name; every tool of the phase where none is named.", arity: "many" }] as const;

function fail(message: string, fix?: string): Outcome<null> {
  return outcomeOf(null, { problems: [problem("fail", message, fix === undefined ? {} : { fix })], exit: "findings" });
}

/** The tools a command line asks for, or the failure that says why not. */
function selection(config: ToolPluginConfig, phaseText: string | undefined, given: readonly string[]): { readonly names: readonly string[] } | { readonly outcome: Outcome<null> } {
  const phase = phaseText === undefined ? undefined : parsePhase(phaseText);
  if (phase !== undefined && phase.kind === "err") return { outcome: outcomeOf(null, { problems: [problem("fail", phase.error, { code: "E-USAGE" })], exit: "usage" }) };
  const chosen = selectNames(config, { phase: phase?.kind === "ok" ? phase.value : undefined, names: given });
  if (chosen.kind === "err") return { outcome: outcomeOf(null, { problems: [problem("fail", chosen.error, { code: "E-USAGE" })], exit: "usage" }) };
  return { names: chosen.value };
}

/** Per tool: what the plan says about it, as the words a person reads. */
function stateOf(a: Analysis, id: string): string {
  const e = a.plan.entries.find((x) => x.id === id);
  if (e === undefined) return "unknown";
  return e.action === "none" ? "as asked" : e.action === "create" ? "missing" : "differs";
}

/** The commands of the branch `tool`, over the fleet's configuration. */
export function toolCommands(config: ToolPluginConfig): readonly Node[] {
  const program = config.program ?? "desired-os-state";
  const list = command({
    name: "list",
    summary: "List the tools the fleet declares, with the phases that need them, how exactly each is pinned, and the dialect and version each resolves to here.",
    options: { phase: phaseOption },
    action: { kind: "report", reach: read },
    run: (args) => {
      const sel = selection(config, args.options.phase, []);
      if ("outcome" in sel) return Promise.resolve(sel.outcome);
      const rows = sel.names.map((n) => {
        const tool = [...config.catalog.tools.values()].find((t) => String(t.name) === n);
        const r = resolveTools(config.catalog, [n], config.runtimes.map((x) => x.tool), config.pins, { ...config.policy, preference: config.preference });
        const chosen = r.kind === "ok" ? r.value.entries.find((e) => String(e.tool.name) === n) : undefined;
        return { tool: n, phases: tool === undefined ? [] : [...tool.phases], pin: tool?.pin ?? "", dialect: chosen === undefined ? null : String(chosen.dialect), version: chosen?.version ?? null, resolved: chosen !== undefined };
      });
      const text = rows.length === 0 ? "no tool is declared" : rows.map((r) => `${r.tool.padEnd(14)} ${r.phases.join(",").padEnd(16)} ${r.pin.padEnd(13)} ${r.resolved ? `${r.dialect}${r.version === null ? "" : ` ${r.version}`}` : "unresolved"}`).join("\n");
      return Promise.resolve(outcomeOf({ tools: rows }, { text }));
    },
  });

  const show = command({
    name: "show",
    summary: "Show one tool: what is declared of it, the dialect chosen for it here or the reason each dialect was not chosen, and what is installed.",
    options: {},
    operands: [{ name: "tool", help: "The name of the tool.", arity: "one" }],
    action: { kind: "report", reach: read },
    run: async (args) => {
      const n = args.positionals[0] ?? "";
      const sel = selection(config, undefined, [n]);
      if ("outcome" in sel) return sel.outcome;
      const tool = [...config.catalog.tools.values()].find((t) => String(t.name) === n);
      if (tool === undefined) return fail(`${n} is not in the catalog`);
      const lines = [`${tool.name}: ${tool.summary}`, `  program ${tool.program}; pin ${tool.pin}; scope ${tool.scope}; phases ${tool.phases.join(", ")}`, `  needs ${tool.needs.length === 0 ? "nothing" : tool.needs.join(", ")}`];
      const resolved = resolveTools(config.catalog, [n], config.runtimes.map((x) => x.tool), config.pins, { ...config.policy, preference: config.preference });
      if (resolved.kind === "err") lines.push(...describeProblems(resolved.error).map((l) => `  ${l}`));
      else {
        const a = await analyse(config, [n]);
        const chosen = resolved.value.entries.find((e) => String(e.tool.name) === n);
        lines.push(`  carried out by ${chosen?.dialect ?? "?"}${chosen?.version === undefined ? "" : ` at ${chosen.version}`}`);
        if (a.kind === "ok") lines.push(`  installed: ${stateOf(a.value, `tool.${n}`)}`);
      }
      return outcomeOf({ tool: n, resolved: resolved.kind === "ok" }, { text: lines.join("\n") });
    },
  });

  const doctor = command({
    name: "doctor",
    summary: "Say which tools are missing or differ from what the fleet asks, by phase, and the command that fixes each. It changes nothing.",
    options: { phase: phaseOption },
    operands: names,
    action: { kind: "report", reach: read },
    run: async (args) => {
      const sel = selection(config, args.options.phase, args.positionals);
      if ("outcome" in sel) return sel.outcome;
      const a = await analyse(config, sel.names);
      if (a.kind === "err") return outcomeOf(null, { problems: a.error.map((m) => problem("fail", m)), exit: "findings" });
      const problems: Problem[] = [];
      const rows = a.value.plan.entries.map((e) => {
        const n = String(e.id).replace(/^tool\./, "");
        const state = e.action === "none" ? "as asked" : e.action === "create" ? "missing" : "differs";
        if (e.action !== "none") problems.push(problem("pending", `${n} is ${state}`, { fix: `${program} tool ensure ${n}`, code: `P-TOOL-${state === "missing" ? "MISSING" : "DIFFERS"}` }));
        return { tool: n, state };
      });
      const text = rows.length === 0 ? "no tool is selected" : rows.map((r) => `${r.state === "as asked" ? "ok     " : r.state === "missing" ? "missing" : "differs"} ${r.tool}`).join("\n");
      return outcomeOf({ tools: rows }, { text, problems, ...(problems.length > 0 ? { exit: "pending" as const } : {}) });
    },
  });

  const ensure = command({
    name: "ensure",
    summary: "Make the tools a phase of work needs be as the fleet asks: the plan and its hash first, then, in apply mode, the install by each tool's dialect. `--check` says what would change; `--dry-run` says it without running anything.",
    options: {
      phase: phaseOption,
      planHash: value({ help: "Only if the plan is the one with this hash (approval of a plan already read).", valueName: "HASH" }),
    },
    operands: names,
    action: { kind: "action", effect: "mutate", idempotent: true, dryRun: true, check: true, reach: write },
    run: async (args, ctx) => {
      const sel = selection(config, args.options.phase, args.positionals);
      if ("outcome" in sel) return sel.outcome;
      const a = await analyse(config, sel.names);
      if (a.kind === "err") return outcomeOf(null, { problems: a.error.map((m) => problem("fail", m)), exit: "findings" });
      const pending = a.value.plan.entries.filter((e) => e.action !== "none");
      const hashes = a.value.shares.flatMap((s) => (s.exec === undefined ? [] : [planHash(s.exec)]));
      const combined = await sha256(hashes.sort().join("\n"));
      const summary = pending.length === 0 ? "every selected tool is as the fleet asks" : `${pending.length} of ${a.value.plan.entries.length} tool${a.value.plan.entries.length === 1 ? "" : "s"} would change: ${pending.map((e) => String(e.id).replace(/^tool\./, "")).join(", ")}`;
      if (pending.length === 0) return outcomeOf({ planHash: combined, changed: 0 }, { text: summary });
      if (ctx.mode === "dry-run") return outcomeOf({ planHash: combined, changed: pending.length }, { text: `${summary}\nplan hash ${combined}`, next: [`${program} tool ensure ${sel.names.join(" ")}`.trim()] });
      const given = args.options.planHash;
      if (given !== undefined && given !== combined) return fail(`the plan is not the one approved: it has the hash ${combined}, and ${given} was given`, "read the plan again with --check, then approve its hash");
      const lines: string[] = [];
      const problems: Problem[] = [];
      for (const share of a.value.shares) {
        if (share.exec === undefined) continue;
        await writeRendered(config.workFolder, share.rendered);
        const result = await runPlan(localExecutor(), share.exec, ctx.mode === "apply" ? { mode: "apply", approval: { kind: "unsigned" } } : { mode: "check" }, { run: { cwd: config.workFolder }, signal: ctx.signal });
        if (result.kind === "err") {
          problems.push(problem("fail", `${share.runtime.tool.id}: the plan changed after it was read`));
          continue;
        }
        lines.push(`${share.runtime.tool.id}: ${result.value.outcome} (${result.value.steps.length} step${result.value.steps.length === 1 ? "" : "s"})`);
        if (result.value.outcome === "failed" || result.value.outcome === "incomplete") problems.push(problem("fail", `${share.runtime.tool.id}: ${result.value.outcome}`, { fix: `${program} tool doctor` }));
        else if (result.value.outcome === "changed") problems.push(problem("pending", `${share.runtime.tool.id}: something would change`, { fix: `${program} tool ensure ${sel.names.join(" ")}`.trim() }));
      }
      const exit = problems.some((p) => p.level === "fail") ? ("findings" as const) : problems.length > 0 ? ("pending" as const) : undefined;
      return outcomeOf({ planHash: combined, changed: pending.length }, { text: [summary, `plan hash ${combined}`, ...lines].join("\n"), problems, ...(exit === undefined ? {} : { exit }) });
    },
  });

  const clean = command({
    name: "clean",
    summary: "Remove what can be got again (downloads kept for a re-install); with `--programs` also the installed tools. It says what it removed.",
    options: { programs: flag({ help: "Also remove the installed tools, which a later `ensure` installs again." }) },
    action: { kind: "action", effect: "destructive", dryRun: true, reach: remove },
    run: async (args, ctx) => {
      const removed: string[] = [];
      if (ctx.mode === "apply") for (const rt of config.runtimes) removed.push(...(rt.clean === undefined ? [] : await rt.clean({ programs: args.options.programs })));
      const text = ctx.mode !== "apply" ? "nothing was removed" : removed.length === 0 ? "nothing to clean" : removed.join("\n");
      return outcomeOf({ removed }, { text });
    },
  });

  return [list, show, ensure, doctor, clean];
}
