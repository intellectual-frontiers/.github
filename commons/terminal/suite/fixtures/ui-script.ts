/**
 * A tiny program that runs a guide on the real standard streams, for the process test (commons 0002-ui FR-009): the same file runs under
 * Bun and under Node 26. The scenario is the first argument: `flow` (a question, a verb and the end), `human` (a step for a person) and `wait`
 * (a step that waits for ever, until the process is interrupted). It writes the typed end of the guide on the standard error.
 *
 * @module
 */
import process from "node:process";
import { ok } from "@intellectual-frontiers/core";
import { capabilitiesOf, exitCodeOf, lineReader, runFlow } from "../../src/ui.ts";

const scenario = process.argv[2] ?? "flow";
const steps: Record<string, readonly unknown[]> = {
  flow: [
    { id: "synthetic-step-01", kind: "question", summary: "Choose a folder", say: "", ask: [{ field: "folder", prompt: "Which folder?", hint: "a path" }] },
    { id: "synthetic-step-02", kind: "run", summary: "Install", say: "", verb: { id: "synthetic-install", inputs: { root: "./works" } } },
    { id: "synthetic-step-03", kind: "done", summary: "All set", say: "Nothing more to do." },
  ],
  human: [
    { id: "synthetic-step-04", kind: "human", summary: "Approve the key", say: "Approve it yourself.", gate: { who: "person" } },
    { id: "synthetic-step-03", kind: "done", summary: "All set", say: "" },
  ],
  wait: [{ id: "synthetic-step-05", kind: "wait", summary: "Waiting for the host", say: "" }],
};
const script = steps[scenario] ?? [];
let i = 0;

const controller = new AbortController();
process.on("SIGINT", () => controller.abort());

const result = await runFlow({
  next: () => Promise.resolve(script[Math.min(i++, script.length - 1)]),
  run: ({ step, answers }) => Promise.resolve(ok({ summary: `did ${step.id}`, lines: Object.entries(answers).map(([k, v]) => `${k}=${v}`) })),
  out: process.stdout,
  in: lineReader(process.stdin, process.stdin.isTTY === true),
  caps: capabilitiesOf(process.env, process.stdout),
  signal: controller.signal,
  poll: { initialMs: 50, maxMs: 50, plainEveryMs: 100 },
});
if (result.kind === "err") process.stderr.write(`${result.error.code}\n`);
process.exitCode = exitCodeOf(result);
process.stdin.destroy();
