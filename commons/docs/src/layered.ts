// Spec: 0001-docs FR-001
/**
 * The layered model (commons 0011-documentation FR-029): what a library that is built in layers (governance, logical, physical or surface) gives the generator to document it, as plain data and types only. A library keeps
 * its own pure builder that makes a `LayeredModel` from its values; the generator's lens turns it into pages, a Markdown twin for each and the model as JSON. The generator depends on no library it shows: a builder's
 * result is checked against these types where a configuration passes it, and by their shape alone.
 *
 * @remarks
 * An element has a stable id (the same across builds, the key of a link and of a diff), a kind, a name, a definition (the words the model gives it), where it is written (a source location) and what is said of it as
 * properties. A trace edge says that an element of one layer is made into an element of the next: a governance concept into a table, a table into the statements that make it and into the typed table that reads it.
 * Operations are an element kind of their own that several libraries share: a governance action, a headless verb, and what they become (a SQL routine, a command, a tool, a route).
 *
 * @module
 */

/** Where an element is written: a file of the repository and a line. */
export interface SourceLocation {
  /** The path from the repository's root. */
  readonly file: string;
  /** The line, from 1, where it is declared. */
  readonly line?: number;
}

/** A layer of a model: what it is called, what it is for and the kinds of element it holds. */
export interface Layer {
  /** Its name, as `governance`. */
  readonly id: string;
  /** What the layer is, in a sentence. */
  readonly title: string;
  /** What a reader may and may not do at this layer, in a sentence or two. */
  readonly summary: string;
  /** The kinds of element it holds. */
  readonly kinds: readonly string[];
}

/** One thing a layer says: a module, a concept, an attribute, a table, a column, a statement, a command. */
export interface LayerElement {
  /** Stable across builds: `governance:identity/principal`, `logical:table:principal`. */
  readonly id: string;
  /** The layer it is in. */
  readonly layer: string;
  /** What kind of thing it is, one of the layer's kinds. */
  readonly kind: string;
  /** What it is called. */
  readonly name: string;
  /** The words the model gives it; empty where it has none, which is a finding. */
  readonly definition: string;
  /** The element that holds it (an attribute's concept, a column's table). */
  readonly parent?: string;
  /** Where it is written. */
  readonly source?: SourceLocation;
  /** What is said of it, by name: types, multiplicity, annotations, the text of a statement. */
  readonly properties: { readonly [name: string]: string | number | boolean | readonly string[] | null };
}

/** An element of one layer made into an element of another. */
export interface TraceEdge {
  readonly from: string;
  readonly to: string;
  /** How: `projects to`, `written as`, `read by`. */
  readonly how: string;
}

/** What the model's builder found wrong. */
export interface LayeredFinding {
  /** A rule's code, as `undescribed`. */
  readonly rule: string;
  readonly element: string;
  readonly message: string;
}

/** What a model applies to. */
export interface LayeredSubject {
  /** Its id. */
  readonly id: string;
  /** Its title. */
  readonly title: string;
  /** What its models apply to, in a sentence. */
  readonly about: string;
  /** Its place among the subjects: lower first. */
  readonly order: number;
}

/** A model that is built in layers, as the generator documents it. */
export interface LayeredModel {
  /** Its name and the library it is of, as `arca`, `data`. */
  readonly name: string;
  readonly library: string;
  readonly title: string;
  readonly summary: string;
  /** What the model applies to, where it has a subject: models are grouped by it. */
  readonly subject?: LayeredSubject;
  readonly layers: readonly Layer[];
  readonly elements: readonly LayerElement[];
  readonly trace: readonly TraceEdge[];
  readonly findings: readonly LayeredFinding[];
}

/** A function that makes the layered models of a repository, and may be told where each element is written. */
export type LayeredSource = (locate: Locate) => Promise<readonly LayeredModel[]> | readonly LayeredModel[];

/** Where a value is written (and, for a member of it such as an attribute of a concept, where that is), found by the lens from the exports it knows: by the value's identity. */
export type Locate = (value: unknown, member?: string) => SourceLocation | undefined;
