// Spec: 0001-headless-layers FR-008
/**
 * The typed facts of Headless, an independent library of commons (commons 0027-commons-libraries): the contract of a program that has no window. Its
 * specification is in its own spec kit (`spec-kit/`, `0001-headless-layers` to `0004-headless-cli`); this repository knows it as one requirement of
 * 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library of the lift of `commons/ts` (0032-lifting-libraries).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Headless. */
export const about: About = {
  title: "Headless",
  summary:
    "The contract of a program that has no window, in layers: governance (what an action is and may do: its kind, effect, audience, confirmation, the problems it finds, the one table of exit statuses, redaction), " +
    "the logical layer (the command model, the typed outcome, the closing block, JSON and SARIF, explain, hints, nested runs) and surfaces that draw it, of which the command line is the first " +
    "(calm output, prompts, the run log, signals, generated help, completions and man pages; a tool server and a REST surface slot in beside it). An optional OpenTelemetry adapter has an entry of its own. " +
    "Published to npm as compiled modules with their declarations; it depends on Core, the terminal and the system, and on the telemetry only for the adapter.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the facts of an action, the decision, the problems, the exit statuses, redaction.", mayImport: ["core, by package name"] },
    {
      path: "src/logical/",
      what: "Layer 2: the command model, the outcome, verbosity, the closing block, JSON and SARIF, explain, hints, nested runs, the redaction of an outcome.",
      mayImport: ["governance, by package name", "core and the terminal's args and commands, by package name"],
    },
    {
      path: "src/surfaces/cli/",
      what: "Layer 3: the command-line surface (the renderer, prompts, the run log and hints store, signals, help, completions, man, the run boundary, the launcher).",
      mayImport: ["governance and logical, by package name", "core, the terminal and the system, by package name"],
    },
    {
      path: "src/otel/",
      what: "The OpenTelemetry adapter of the command line's observer port.",
      mayImport: ["the layers below, by package name", "core and the telemetry, by package name"],
    },
    {
      path: "suite/",
      what: "The tests: every requirement of the four specifications, with golden outputs ported from the programs that gave the behaviour, properties and a real-process check.",
      mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"],
    },
    {
      path: "tools/",
      what: "The layers check, the trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
