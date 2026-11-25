// Spec: 0002-workbench-terms FR-001
/**
 * The four concepts of the workbench, each said once. A **workstation** is where the operator, a person or an agent, orchestrates from; a **workshop** is where the work happens (a machine, a virtual machine or a container); a
 * **workspace** is the repositories and other stores the work is about, laid out predictably; a **workbench** is everything a role needs to do its job with a repository. Every requirement and every error belongs to one of them.
 *
 * @example
 * ```ts
 * import { CONCEPTS, DEFINITIONS } from "./terms.ts";
 * CONCEPTS.length; // 4
 * DEFINITIONS.workshop; // "Where the work happens: a machine, a virtual machine or a container."
 * ```
 *
 * @module
 */

/** The four concepts: a closed list. */
export const CONCEPTS = ["workstation", "workshop", "workspace", "workbench"] as const;
/** One of the four concepts. */
export type Concept = (typeof CONCEPTS)[number];

/** What each concept is, in a sentence. */
export const DEFINITIONS: Readonly<Record<Concept, string>> = {
  workstation: "Where the operator, a person or an agent, orchestrates from: the harness, the operator's identity and keys, and the tool client configuration.",
  workshop: "Where the work happens: a machine, a virtual machine or a container, with its toolchain, runtimes and network.",
  workspace: "The repositories and other stores the work is about, laid out predictably so that a path means the same everywhere.",
  workbench: "Everything a role needs to do its job with a repository: programs and runtimes, credential names, network needs, Git settings and the authority it has.",
};

/** Whether a text names a concept. */
export function isConcept(text: string): text is Concept {
  return (CONCEPTS as readonly string[]).includes(text);
}
