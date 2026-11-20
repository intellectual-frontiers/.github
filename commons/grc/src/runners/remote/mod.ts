// Spec: 0005-grc-runners FR-007
/**
 * The `remote` runner (0005-grc-runners FR-007): the input is `{ target, argv }` and the command is run on a remote the host gives, of the shape `{ exec(target, argv) -> { code, stdout, stderr } }`;
 * the targets of Headless satisfy it by shape and this unit imports nothing of it. The value is the code and the output.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Check, objectOf } from "@intellectual-frontiers/grc/governance";
import type { Observation, RunContext, Runner, RunnerProblem } from "@intellectual-frontiers/grc/physical";

/** What the host gives. */
export type Remote = { exec(target: string, argv: readonly string[]): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> };

/** The `remote` runner over a remote. */
export function remoteRunner(remote: Remote): Runner {
  return {
    id: "remote",
    async run(check: Check, ctx: RunContext): Promise<Result<Observation, RunnerProblem>> {
      const i = objectOf(check.runner.input);
      if (i === undefined || typeof i["target"] !== "string" || !Array.isArray(i["argv"]) || !i["argv"].every((a) => typeof a === "string")) {
        return err({ kind: "refused", message: "the input of a remote check is { target, argv: string[] }" });
      }
      const t0 = Date.now();
      const r = await remote.exec(i["target"], i["argv"] as readonly string[]);
      return ok({ value: { code: r.code, stdout: r.stdout, stderr: r.stderr }, observedAt: ctx.now(), via: `remote ${i["target"]}`, tookMs: Date.now() - t0 });
    },
  };
}
