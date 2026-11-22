// Spec: 0006-agents FR-015
/**
 * The adapter `herdr` (commons ergonex 0006-agents FR-015, OQ-4): herdr is the runtime that hosts agents. It runs `herdr integration install <agent>` for each coding agent on the `PATH` that herdr
 * names, and writes none of herdr's own files. It does not install herdr: where herdr is not on the `PATH` the step says so and the person installs it by herdr's checked installer or by `mise`.
 *
 * @module
 */
import { type HarnessAdapter, type Step } from "./port.ts";

/** The agents of herdr that Ergonex looks for on the `PATH`, as herdr names them and as their programs are named. */
export const HERDR_AGENTS: readonly { readonly herdr: string; readonly program: string }[] = [
  { herdr: "claude", program: "claude" },
  { herdr: "codex", program: "codex" },
];

/** The adapter. */
export const herdr: HarnessAdapter = {
  harness: "herdr",
  steps: (site) => {
    const steps: Step[] = [];
    if (site.which("herdr") === undefined) return Promise.resolve(steps);
    for (const a of HERDR_AGENTS) {
      if (site.which(a.program) === undefined) continue;
      // herdr says by itself whether an integration is current: then there is nothing to do
      steps.push({ kind: "command", argv: ["herdr", "integration", "install", a.herdr], what: `herdr integration for ${a.herdr}`, probe: ["herdr", "integration", "status"], probeContains: `${a.herdr}: current` });
    }
    return Promise.resolve(steps);
  },
};
