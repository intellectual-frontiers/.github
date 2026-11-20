// Spec: 0004-headless-cli FR-015
/**
 * The OpenTelemetry adapter of Headless (commons headless 0004-headless-cli FR-015): a run of a command is a `headless.run` span, each phase an event of it,
 * each problem a log record in it, and the status and counts of the run are the span's attributes; a run that did not end with 0 ends its span as an
 * error. It is an optional entry of its own: the command-line surface does not import the telemetry, it gives a port (`RunObserver` of `Io`) and this
 * is what sits behind it, as the telemetry does for `proc.setProcessTracer` of the system.
 *
 * @example
 * ```ts
 * import { headlessSignals, observerOf } from "@intellectual-frontiers/headless/otel";
 * import { createTelemetry } from "@intellectual-frontiers/telemetry/signals";
 * // const observer = observerOf(createTelemetry({ registry: headlessSignals, ...the resource, clock, random and processors }));
 * // await launch(program, { observer });
 * ```
 *
 * @module
 */
import { exitNameOf } from "@intellectual-frontiers/headless/governance";
import type { Problem } from "@intellectual-frontiers/headless/governance";
import type { RunEnd, RunObserver } from "@intellectual-frontiers/headless/cli";
import { SEVERITY } from "@intellectual-frontiers/telemetry/otel";
import { defineSignals, type Telemetry } from "@intellectual-frontiers/telemetry/signals";

/** The signals a run of a command makes. */
export const headlessSignals = defineSignals({
  "headless.run": {
    signal: "span",
    role: "step",
    description: "A run of a command of a headless program.",
    attributes: {
      "headless.program": "string",
      "headless.version": "string",
      "headless.command": "string",
      "headless.exit.code?": "int",
      "headless.exit.name?": "string",
      "headless.problems.fail?": "int",
      "headless.problems.warn?": "int",
      "headless.problems.pending?": "int",
      "headless.problems.action?": "int",
    },
  },
  "headless.problem": {
    signal: "log",
    role: "warning",
    severity: SEVERITY.WARN,
    description: "A problem a run found.",
    attributes: { "headless.problem.level": "string", "headless.problem.code?": "string", "headless.problem.phase?": "string" },
  },
});

/** The telemetry the adapter needs: one whose registry is `headlessSignals`. */
export type HeadlessTelemetry = Telemetry<typeof headlessSignals.kinds>;

const severityOf = (p: Problem): typeof SEVERITY.ERROR | typeof SEVERITY.WARN | typeof SEVERITY.INFO =>
  p.level === "fail" ? SEVERITY.ERROR : p.level === "warn" ? SEVERITY.WARN : SEVERITY.INFO;

/** The observer of runs that reports them through a telemetry. */
export function observerOf(telemetry: HeadlessTelemetry): RunObserver {
  return {
    async observe<T extends RunEnd>(info: { readonly program: string; readonly version: string; readonly command: string }, run: (events: { phase(name: string): void; problem(p: Problem): void }) => Promise<T>): Promise<T> {
      const carried = await telemetry.span(
        "headless.run",
        { "headless.program": info.program, "headless.version": info.version, "headless.command": info.command },
        async (span) => {
          const result = await run({
            phase: (name) => span.event("headless.phase", { "headless.phase.name": name }),
            problem: (p) =>
              span.log(
                "headless.problem",
                { "headless.problem.level": p.level, ...(p.code === undefined ? {} : { "headless.problem.code": p.code }), ...(p.phase === undefined ? {} : { "headless.problem.phase": p.phase }) },
                p.message,
                { severity: severityOf(p) },
              ),
          });
          span.set({
            "headless.exit.code": result.code,
            "headless.exit.name": exitNameOf(result.code) ?? "other",
            "headless.problems.fail": result.counts.fail,
            "headless.problems.warn": result.counts.warn,
            "headless.problems.pending": result.counts.pending,
            "headless.problems.action": result.counts.action,
          });
          return result.code === 0
            ? ({ kind: "ok", value: result } as const)
            : ({ kind: "err", error: { value: result, message: `${info.command} ended with ${result.code}` } } as const);
        },
      );
      return carried.kind === "ok" ? carried.value : carried.error.value;
    },
  };
}
