// Spec: 0002-dns-command FR-002, FR-003, FR-004
/**
 * The verbs `plan` and `apply` over the zone a fleet gave the plugin. `plan` reads the zone and says what the records wanted would change, with the hash of the plan to approve; `apply` carries out exactly the plan of that hash, then plans again and finds it empty. A plan that removes a
 * record also needs `--allow-removal yes`.
 *
 * @example
 * ```ts
 * import { dnsCommands } from "./commands.ts";
 * // dnsCommands(config) is the list of nodes the branch `dns` holds
 * ```
 *
 * @module
 */
import { defineReach, problem } from "@intellectual-frontiers/headless/governance";
import { command, outcomeOf, type Node } from "@intellectual-frontiers/headless/logical";
import { value } from "@intellectual-frontiers/terminal/args";
import type { DnsPluginConfig } from "./config.ts";
import { describe, planZone } from "./plan.ts";

const zone = value<never>({ help: "The zone to plan or apply.", valueName: "ZONE", required: true });

/** The commands of the branch `dns`. */
export function dnsCommands(config: DnsPluginConfig): readonly Node[] {
  const fleet = config.options ?? {};
  const program = config.program ?? "desired-os-state";
  const optionsOf = (o: Readonly<Record<string, unknown>>): Record<string, string> => Object.fromEntries(Object.keys(fleet).map((k) => [k, String(o[k] ?? "")]));

  const plan = command({
    name: "plan",
    summary: "Read a zone and say what the records the fleet wants would change in it, with the hash of the plan to approve. It changes nothing.",
    options: { zone, ...fleet },
    examples: [{ args: ["--zone", "example.org"], says: "Plan the zone example.org." }],
    action: { kind: "report", reach: defineReach({ channels: ["local", "ssh", "mcp"], readOnly: true, idempotent: true }) },
    run: async (args) => {
      const o = args.options as Readonly<Record<string, unknown>>;
      const name = String(o["zone"]);
      const subject = await config.subject(name, optionsOf(o));
      if (subject.kind === "err") return outcomeOf(null, { problems: [problem("fail", subject.error.message, { code: subject.error.code })], exit: subject.error.exit });
      try {
        const planned = await planZone(subject.value);
        const changes = planned.plan.create.length + planned.plan.update.length + planned.plan.remove.length;
        return outcomeOf({ hash: planned.hash ?? null, changes }, { text: describe(planned.plan, planned.hash), ...(planned.hash === undefined ? {} : { next: [`${program} dns apply --zone ${name} --plan-hash ${planned.hash}`], exit: "pending" as const }) });
      } catch (e) {
        return outcomeOf(null, { problems: [problem("fail", (e as Error).message, { code: "E-DNS-READ" })], exit: "environment" });
      }
    },
  });

  const apply = command({
    name: "apply",
    summary: "Carry out exactly the plan you approved by its hash, then plan again: the plan after an apply must be empty. A plan that removes a record also needs --allow-removal yes.",
    options: {
      zone,
      ...fleet,
      planHash: value<never>({ help: "The hash that `dns plan` printed.", valueName: "sha256:...", required: true }),
      allowRemoval: value<never>({ help: "Allow a plan that removes a record: `yes`.", valueName: "yes", default: "" }),
    },
    examples: [{ args: ["--zone", "example.org", "--plan-hash", "sha256:..."], says: "Apply the approved plan to example.org." }],
    action: { kind: "action", effect: "mutate", dryRun: false, idempotent: true, reach: defineReach({ channels: ["local"], idempotent: true }) },
    run: async (args) => {
      const o = args.options as Readonly<Record<string, unknown>>;
      const name = String(o["zone"]);
      const subject = await config.subject(name, optionsOf(o));
      if (subject.kind === "err") return outcomeOf(null, { problems: [problem("fail", subject.error.message, { code: subject.error.code })], exit: subject.error.exit });
      try {
        const planned = await planZone(subject.value);
        if (planned.hash === undefined) return outcomeOf({ outcome: "unchanged", planAfterIsEmpty: true }, { text: "the plan is empty: nothing to do" });
        if (planned.hash !== String(o["planHash"])) return outcomeOf(null, { problems: [problem("fail", `the plan changed: you approved ${String(o["planHash"])} and it is now ${planned.hash}; read it again with plan`, { code: "E-PLAN-CHANGED" })], exit: "findings" });
        if (planned.plan.remove.length > 0 && String(o["allowRemoval"]) !== "yes") return outcomeOf(null, { problems: [problem("fail", `the plan removes ${planned.plan.remove.length} record(s): approve that too with --allow-removal yes`, { code: "E-REMOVAL" })], exit: "usage" });
        await subject.value.provider.apply(planned.plan);
        const after = await planZone(subject.value);
        const empty = after.hash === undefined;
        return outcomeOf({ outcome: "applied", planAfterIsEmpty: empty }, { text: `applied\n${empty ? "the plan after the apply is empty" : `the plan after the apply is not empty:\n${describe(after.plan, after.hash)}`}`, ...(empty ? {} : { problems: [problem("fail", "the plan after the apply is not empty", { code: "E-NOT-EMPTY" })], exit: "findings" as const }) });
      } catch (e) {
        return outcomeOf(null, { problems: [problem("fail", (e as Error).message, { code: "E-DNS-APPLY" })], exit: "environment" });
      }
    },
  });
  return [plan, apply];
}
