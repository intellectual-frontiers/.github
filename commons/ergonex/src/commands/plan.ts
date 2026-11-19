// Spec: 0001-ergonex FR-012
/**
 * `ergonex plan` and `ergonex apply` (commons 0001-ergonex FR-012, 0002-workspace-model FR-021 to FR-030): `plan` shows the typed plan the manifest and what was observed make, and changes nothing; `apply` carries
 * it out, one action at a time, observing each repository again first, by fast-forward only, never deleting what holds local work, and never an action that changes the host, which only `ergonex setup`
 * does. Neither uses the network unless `--fetch` is given, which updates the remote-tracking references and nothing else.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import { flag } from "../platform/k-args.ts";
import { applyPlan } from "../host/apply.ts";
import { type Loaded, situate } from "../host/workspace.ts";
import type { Context, Outcome } from "../modules/types.ts";
import { describeAction, isSettled } from "../plan.ts";
import { defineCommand, GLOBAL_OPTIONS, type ErgonexModule } from "../modules/types.ts";
import { jsonOf, planFindings, textOf, withWorkspace } from "./common.ts";

const FETCH = flag({
  help: "Fetch each repository's remote first, so that ahead and behind are against the remote as it is now (the only use of the network).",
});

const plan = defineCommand({
  name: "plan",
  summary: "Show the plan the manifest and what is on disk make, and change nothing.",
  options: { ...GLOBAL_OPTIONS, fetch: FETCH },
  run: (ctx, args) =>
    withWorkspace(ctx, async (loaded) => {
      const s = await situate(ctx, loaded, { fetch: args.options.fetch });
      if (s.kind === "err")
        return err({
          kind: "environment",
          message: `git cannot be run (${s.error.program} is not installed or not on the PATH)`,
        });
      const findings = planFindings(s.value.plan, ctx.today);
      const lines = s.value.plan.actions.map((a) => `  ${describeAction(a)}`);
      const head = isSettled(s.value.plan)
        ? "nothing to do: every action is a skip"
        : `${s.value.plan.actions.filter((a) => a.kind !== "Skip").length} to do`;
      return ok({
        text: textOf([`plan ${s.value.planSha.slice(0, 12)}: ${head}`, ...lines], findings),
        data: {
          planSha256: s.value.planSha,
          settled: isSettled(s.value.plan),
          actions: jsonOf(s.value.plan.actions),
        },
        findings,
        facts: { planSha256: s.value.planSha },
      });
    }),
});

const APPLY_OPTIONS = {
  ...GLOBAL_OPTIONS,
  fetch: FETCH,
  allowDestructive: flag({
    help: "Carry out a destructive action (removing a generated file that is no longer generated); without it the action is reported as skipped.",
  }),
  force: flag({ help: "Replace a generated file that was edited by hand." }),
  wait: flag({
    help: "Wait for another run of ergonex on this workspace instead of refusing.",
  }),
};

/** What `apply` does on a loaded workspace: the plan, observed again before each action, carried out. `add --apply` and `adopt --apply` end with it. */
export async function applyLoaded(
  ctx: Context,
  loaded: Loaded,
  flags: { readonly fetch: boolean; readonly allowDestructive: boolean; readonly force: boolean; readonly wait: boolean },
): Promise<Outcome> {
  const s = await situate(ctx, loaded, { fetch: flags.fetch });
  if (s.kind === "err")
    return err({
      kind: "environment",
      message: `git cannot be run (${s.error.program} is not installed or not on the PATH)`,
    });
  const done = await applyPlan(s.value, ctx, {
    allowDestructive: flags.allowDestructive,
    force: flags.force,
    wait: flags.wait,
  });
  if (done.kind === "err")
    return err({
      kind: "environment",
      message: `another run of ergonex holds the workspace: ${done.error.holder}; run again when it ends, or give --wait`,
    });
  const steps = done.value.steps;
  const lines = steps
    .filter((x) => x.status !== "skipped" || x.action.kind !== "Skip")
    .map((x) => `  ${x.status.padEnd(7)} ${describeAction(x.action)}${x.detail === "" ? "" : ` (${x.detail})`}`);
  const changed = steps.filter((x) => x.status === "done").length;
  const findings = done.value.findings;
  return ok({
    text: textOf(
      [`apply ${s.value.planSha.slice(0, 12)}: ${changed} done, ${steps.filter((x) => x.status === "failed").length} failed`, ...lines],
      findings,
    ),
    data: {
      planSha256: s.value.planSha,
      steps: jsonOf(
        steps.map((x) => ({
          kind: x.action.kind,
          status: x.status,
          detail: x.detail,
        })),
      ),
    },
    findings,
    facts: {
      planSha256: s.value.planSha,
      stateSha256: done.value.recordSha,
    },
  });
}

const apply = defineCommand({
  name: "apply",
  summary: "Carry out the plan: clone, fast-forward, configure and write generated files; never delete work, never change the host.",
  options: APPLY_OPTIONS,
  run: (ctx, args) => withWorkspace(ctx, (loaded) => applyLoaded(ctx, loaded, args.options)),
});

/** The module `ergonex plan`. */
export const planModule: ErgonexModule = {
  name: "plan",
  summary: plan.summary,
  commands: [plan],
};

/** The module `ergonex apply`. */
export const applyModule: ErgonexModule = {
  name: "apply",
  summary: apply.summary,
  commands: [apply],
};
