/**
 * A program of the tests, launched as a process of its own: it is what a consumer's entry is, `launch(program)` and the status it gives.
 *
 * @module
 */
import { command, outcomeOf, programOf, startPhase } from "../../src/logical/mod.ts";
import { launch } from "../../src/surfaces/cli/host.ts";
import type { StartupFailure } from "../../src/surfaces/cli/launcher.ts";

const program = programOf({
  name: "fixture",
  summary: "A program started by the tests.",
  version: "9.9.9",
  children: [
    command({ name: "status", summary: "Say hello.", options: {}, action: { kind: "report" }, run: () => Promise.resolve(outcomeOf(null, { text: "hello" })) }),
    command({
      name: "wait",
      summary: "Wait to be stopped.",
      options: {},
      action: { kind: "action" },
      run: (_a, ctx) =>
        new Promise((resolve) => {
          startPhase(ctx.progress, "Waiting").ok("started");
          setTimeout(() => process.stdout.write("ready\n"), 50); // after the run has listeners for the signals
          const timer = setTimeout(() => resolve(outcomeOf(null)), 20_000);
          ctx.signal.addEventListener("abort", () => (clearTimeout(timer), resolve(outcomeOf(null))));
        }),
    }),
  ],
});

const failure = process.env["FIXTURE_FAIL"] as StartupFailure["kind"] | undefined;
process.exitCode = await launch(program, {
  ready: () => (failure === undefined ? undefined : { kind: failure, message: `cannot start: ${failure}`, ...(failure === "osfile" ? { fix: "fixture init" } : {}) }),
});
