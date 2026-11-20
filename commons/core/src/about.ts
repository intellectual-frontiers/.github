// Spec: 0001-core FR-008
/**
 * The typed facts of a package of commons that its documentation shows (commons 0011-documentation FR-005, FR-008): what the package is, the specification it implements, its folders and what each may import,
 * the commands that work on it, the rules it keeps and what enforces each, its areas (each with its entry points, its specification, its phases and its examples), its layers and its facts. Each package
 * keeps one `About` value in an `about.ts` at its root, which no entry point exports; prose is TSDoc, and only what has a shape is here, so that a test can hold it to the code. Types only: nothing here runs.
 *
 * @example
 * ```ts
 * import type { About } from "@intellectual-frontiers/core/about";
 * export const about: About = {
 *   title: "Example",
 *   summary: "What the example is, in a sentence.",
 *   spec: { repo: "commons", id: "0009-example" },
 * };
 * ```
 *
 * @module
 */

/** A specification, by its repository and its folder's name (`commons`, `0009-example`). Only the repository's own become links. */
export interface AboutSpec {
  /** The repository whose spec kit holds it. */
  readonly repo: string;
  /** The specification's folder: its number and its slug. */
  readonly id: string;
}

/** A folder of the part, with what it is and what its files may import. */
export interface AboutFolder {
  /** The folder (or file), relative to the `about.ts` that names it, as `kernel/` or `runtime/test.ts`. */
  readonly path: string;
  /** What it holds, in a sentence of Markdown. */
  readonly what: string;
  /** What its files may import, each in a few words (`kernel/ only`, `node: builtins`). */
  readonly mayImport: readonly string[];
}

/** A command that works on the part, run from the folder of its `about.ts`. */
export interface AboutCommand {
  /** The command line, as a person types it. */
  readonly run: string;
  /** What it does, in a sentence. */
  readonly does: string;
}

/** What enforces a rule: a test file, a rule of the lint plugin, an option of the compiler, or a person's review. */
export type AboutEnforcer =
  | { readonly kind: "test"; readonly file: string }
  | { readonly kind: "lint"; readonly rule: string }
  | { readonly kind: "compiler"; readonly option: string }
  | { readonly kind: "review" };

/** A rule the part keeps, and what enforces it. */
export interface AboutRule {
  /** The rule, in a sentence of Markdown. */
  readonly rule: string;
  /** What enforces it. */
  readonly enforcedBy: readonly AboutEnforcer[];
}

/** Whether a phase of the work is done. */
export type AboutPhaseState = "here" | "not yet";

/** A phase of a library that is built a phase at a time. */
export interface AboutPhase {
  /** Its number. */
  readonly n: number;
  /** What it brings, in a line. */
  readonly what: string;
  /** Whether it is done. */
  readonly state: AboutPhaseState;
}

/** An example: a file the compiler checks and a suite runs, and the committed outputs it makes. */
export interface AboutExample {
  /** The file, relative to the `about.ts` that names it. */
  readonly file: string;
  /** What it shows, in a sentence. */
  readonly what: string;
  /** The committed files it makes, relative to the same folder, shown beside it. */
  readonly outputs?: readonly string[];
}

/** An area of a package: a part with an entry point, whose exports are its API and whose entry point's module comment is its overview. */
export interface AboutArea {
  /** Its name, as a title. */
  readonly title: string;
  /** Its name in the site's addresses: lower-case words joined by hyphens. */
  readonly slug: string;
  /** Its entry points, relative to `about.ts`; the first one's module comment is the area's overview. */
  readonly entryPoints: readonly string[];
  /** The folder, relative to `about.ts`, that holds the files of the area; where it is not given, the folder of the first entry point. */
  readonly folder?: string;
  /** The specification it implements, where it has its own. */
  readonly spec?: AboutSpec;
  /** Its phases, where it is built a phase at a time. */
  readonly phases?: readonly AboutPhase[];
  /** Its examples. */
  readonly examples?: readonly AboutExample[];
}

/** The typed facts of a package, or of a repository as a whole. */
export interface About {
  /** Its name, as a title. */
  readonly title: string;
  /** What it is, in a paragraph of Markdown: the first thing a reader sees. */
  readonly summary: string;
  /** The specification it implements, where one does. */
  readonly spec?: AboutSpec;
  /** Its folders and what each may import. */
  readonly folders?: readonly AboutFolder[];
  /** The commands that work on it, run from the folder of its `about.ts`. */
  readonly commands?: readonly AboutCommand[];
  /** The rules it keeps. */
  readonly rules?: readonly AboutRule[];
  /** Its areas. */
  readonly areas?: readonly AboutArea[];
  /** Its examples that belong to no one area. */
  readonly examples?: readonly AboutExample[];
  /** Facts its page shows in a small table beside the summary: a label and its value, as a version or a conformance level. */
  readonly facts?: readonly AboutFact[];
  /** The folders of a library built in layers, each with the layer it is in and what it may import of the others: its page shows them as bands. */
  readonly layers?: readonly AboutLayer[];
}

/** A folder of a library built in layers. */
export interface AboutLayer {
  /** The folder, relative to the library. */
  readonly folder: string;
  /** The layer it is in: `governance`, `logical` or `physical`. */
  readonly layer: string;
  /** The folders of the library that its files may import, where it names them. */
  readonly mayImport?: readonly string[];
}

/** One fact of a package: a label and its value. */
export interface AboutFact {
  /** What it is: `Version`. */
  readonly label: string;
  /** Its value, in Markdown: `0.9.0`. */
  readonly value: string;
}
