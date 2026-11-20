// Spec: 0001-headless-layers FR-001
/**
 * Layer 3 of Headless, the command-line surface (commons headless 0004-headless-cli): the calm renderer (marks from the terminal's palette only, colour
 * and width by the terminal's look, a spinner and a progress bar on a terminal and plain lines elsewhere), the prompts, the run log and the memory of hints in the
 * program's folder of state, the signals, the help, completions and man page generated from the tree, the run boundary `run(program, argv, io)`, and
 * the launcher. It imports the terminal, the system and Core, and the layers below; it does not import the telemetry (an adapter, `./otel`, reports a
 * run through the observer port of `Io`).
 *
 * @example
 * ```ts
 * import { launch } from "@intellectual-frontiers/headless/cli";
 * import { programOf } from "@intellectual-frontiers/headless/logical";
 * process.exitCode = await launch(programOf({ name: "tool", summary: "A tool.", version: "1.0.0", children: [] }));
 * ```
 *
 * @module
 */
export * from "./help.ts";
export * from "./host.ts";
export * from "./io.ts";
export * from "./launcher.ts";
export * from "./prompts.ts";
export * from "./render.ts";
export * from "./reporter.ts";
export * from "./run.ts";
export * from "./signals.ts";
export * from "./state.ts";
export * from "./style.ts";
