// Spec: 0006-agents FR-011
/**
 * The adapters, a closed set (commons ergonex 0006-agents FR-011): one instance of the port for each harness.
 *
 * @module
 */
import { type Harness, HARNESSES } from "../../persona.ts";
import { claudeCode } from "./claude-code.ts";
import { codex } from "./codex.ts";
import { herdr } from "./herdr.ts";
import { other } from "./other.ts";
import type { HarnessAdapter } from "./port.ts";

/** The adapter of a harness. */
export function adapterOf(harness: Harness): HarnessAdapter {
  switch (harness) {
    case "claude-code":
      return claudeCode;
    case "codex":
      return codex;
    case "herdr":
      return herdr;
    case "other":
      return other;
  }
}

/** Every adapter, in the order of the harnesses. */
export const ADAPTERS: readonly HarnessAdapter[] = HARNESSES.map(adapterOf);
