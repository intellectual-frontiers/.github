// Spec: 0002-converge-command FR-002, FR-003, FR-004, FR-005
/**
 * The verbs `plan` and `apply` over what a fleet gave the plugin. `plan` observes (reading only) and says what the requirements would change, with the hash of the plan to approve; `apply` carries out exactly the plan of that hash, with the fleet's dialect, then plans again and finds
 * it empty. A plan that removes something also needs `--allow-removal yes`.
 *
 * @example
 * ```ts
 * import { convergeCommands } from "./commands.ts";
 * // convergeCommands(config) is the list of nodes the branch `converge` holds
 * ```
 *
 * @module
 */
import { defineReach, problem } from "@intellectual-frontiers/headless/governance";
import { command, outcomeOf, type Node } from "@intellectual-frontiers/headless/logical";
import { value } from "@intellectual-frontiers/terminal/args";
import type { ConvergePluginConfig } from "./config.ts";
import { applyPlan, describe, planFor } from "./run.ts";

const asset = value<never>({ help: "The asset to converge.", valueName: "ASSET", required: true });

/** The commands of the branch `converge`. */
export function convergeCommands(config: ConvergePluginConfig): readonly Node[] {
  const fleet = config.options ?? {};
  const optionsOf = (o: Readonly<Record<string, unknown>>): Record<string, string> => Object.fromEntries(Object.keys(fleet).map((k) => [k, String(o[k] ?? "")]));

  const plan = command({
    name: "plan",
    summary: "Observe a managed machine (reading only) and say what the requirements would change, with the hash of the plan to approve. It changes nothing.",
    options: { asset, ...fleet },
    examples: [{ args: ["--asset", "synthetic-server-02"], says: "Plan synthetic-server-02." }],
    action: { kind: "report", reach: defineReach({ channels: ["local", "ssh", "mcp"], readOnly: true, idempotent: true }) },
    run: async (args) => {
      const o = args.options as Readonly<Record<string, unknown>>;
      const name = String(o["asset"]);
      const subject = await config.subject(name, optionsOf(o));
      if (subject.kind === "err") return outcomeOf(null, { problems: [problem("fail", subject.error.message, { code: subject.error.code })], exit: subject.error.exit });
      const planned = await planFor({ dialect: config.dialect, asset: name, subject: subject.value });
      if (planned.kind === "err") return outcomeOf(null, { problems: [problem("fail", planned.error, { code: "E-PLAN" })], exit: "findings" });
      return outcomeOf({ hash: planned.value.hash ?? null, changes: planned.value.plan.entries.filter((e) => e.action !== "none").length }, { text: describe(planned.value), ...(planned.value.hash === undefined ? {} : { next: [`${config.program ?? "archon"} converge apply --asset ${name} --plan-hash ${planned.value.hash}`], exit: "pending" as const }) });
    },
  });

  const apply = command({
    name: "apply",
    summary: "Carry out exactly the plan you approved by its hash, with the fleet's dialect, then plan again: the plan after an apply must be empty. A plan that removes something also needs --allow-removal yes.",
    options: {
      asset,
      ...fleet,
      planHash: value<never>({ help: "The hash that `converge plan` printed.", valueName: "sha256:...", required: true }),
      allowRemoval: value<never>({ help: "Allow a plan that removes something (a destructive plan): `yes`.", valueName: "yes", default: "" }),
    },
    examples: [{ args: ["--asset", "synthetic-server-02", "--plan-hash", "sha256:..."], says: "Apply the approved plan to synthetic-server-02." }],
    action: { kind: "action", effect: "mutate", dryRun: false, idempotent: true, reach: defineReach({ channels: ["local"], idempotent: true }) },
    run: async (args) => {
      const o = args.options as Readonly<Record<string, unknown>>;
      const name = String(o["asset"]);
      const subject = await config.subject(name, optionsOf(o));
      if (subject.kind === "err") return outcomeOf(null, { problems: [problem("fail", subject.error.message, { code: subject.error.code })], exit: subject.error.exit });
      const done = await applyPlan({ dialect: config.dialect, asset: name, subject: subject.value, renderRoot: config.renderRoot, toolVersion: config.toolVersion, approvedHash: String(o["planHash"]), destroy: String(o["allowRemoval"]) === "yes" });
      if (done.kind === "err") return outcomeOf(null, { problems: [problem("fail", done.error, { code: "E-APPLY" })], exit: "findings" });
      const { result, output, after } = done.value;
      const tail = output.slice(-12).join("\n");
      if (result.outcome === "failed" || result.outcome === "incomplete") return outcomeOf({ outcome: result.outcome }, { text: tail, problems: [problem("fail", `the apply ${result.outcome}`, { code: "E-APPLY" })], exit: "findings" });
      const empty = after === undefined || after.exec === undefined;
      return outcomeOf({ outcome: result.outcome, planAfterIsEmpty: empty }, { text: `${result.outcome}\n${tail}\n${empty ? "the plan after the apply is empty" : `the plan after the apply is not empty:\n${describe(after)}`}`, ...(empty ? {} : { problems: [problem("fail", "the plan after the apply is not empty", { code: "E-NOT-EMPTY" })], exit: "findings" as const }) });
    },
  });
  return [plan, apply];
}
