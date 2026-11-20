// Spec: 0001-kanon-checker FR-006
/**
 * The layered model of a Kanon library (commons 0033-kanon FR-013): what a library that is built in layers gives to be documented, checked and traced, as types and the names of its kinds and
 * the builders of its ids, and no code that a program runs beyond them. It is the shape of the layered model of the documentation generator (`commons/docs`, 0011-documentation FR-029): the
 * layers, the elements of each, the trace edges between them and the findings, so that the generator reads a `LayeredModel` of Kanon as its own; it adds `dispositions`, the account of each
 * annotation of Governance (0033-kanon FR-005).
 *
 * @remarks
 * The kinds are those agreed by Data and Headless: `action`, `verb`, `option`, `operand`, `problem-code` and `outcome` for what a program says, and the projections `cli-command`, `mcp-tool` and
 * `rest-route`. The ids are `headless:<program>/<verb-path>`, `cli:<program> <verb path>`, `mcp:<tool_name>` and `rest:<METHOD> <path>`; an option or an operand is its verb's id, a `#` and
 * `--flag` or the operand's name.
 *
 * Algebraic types throughout: an `ElementId` is a branded string made only by `parseElementId` (parse, don't validate), a layer is the closed union `Layer`, a `Disposition` is a sum with one case for
 * each way an annotation can end, everything is `readonly`, and an id builder returns a `Result` where its parts can be wrong.
 *
 * @module
 */
import { type Brand, err, ok, refine, type Result, string } from "@intellectual-frontiers/core";
import type { InstanceName } from "./family.ts";
import type { Layer } from "./table.ts";

/** The identity of an element, stable across builds: a scheme, a colon and what names it (`headless:arcactl/db migrate`). Made only by `parseElementId`. */
export type ElementId = Brand<string, "kanon element id">;

const elementIdDecoder = refine(string, "kanon element id", (t) => /^[a-z][a-z0-9-]*:\S(?:.*\S)?$/.test(t));

/** An element id from text, or why the text is not one: the one way an `ElementId` is made. */
export function parseElementId(text: string): Result<ElementId, string> {
  const r = elementIdDecoder(text, "id");
  return r.kind === "ok"
    ? ok(r.value)
    : err(`${JSON.stringify(text)} is not an element id: a scheme, a colon and a name, with no space at either end`);
}

/** Where an element is written: a file of the repository and the line where it is declared. */
export interface SourceLocation {
  readonly file: string;
  readonly line: number;
}

/** A layer of a model: what it is called, what it is for and the kinds of element it holds. */
export interface ModelLayer {
  /** Its name: `governance`, `logical` or `physical` (a library's own words for a surface or a dialect are kinds of its Physical layer). */
  readonly id: Layer;
  readonly title: string;
  readonly summary: string;
  readonly kinds: readonly string[];
}

/** One thing a layer says: an action, a verb, an option, a table, a command, a tool, a route. */
export interface ModelElement {
  /** Stable across builds (0033-kanon FR-003): the key of a link, a trace edge and a diff. */
  readonly id: ElementId;
  /** The layer it is in. */
  readonly layer: Layer;
  readonly kind: string;
  readonly name: string;
  /** The words the model gives it; empty where it has none, which is a finding of the builder. */
  readonly definition: string;
  /** The element that holds it (an option's verb, a column's table). */
  readonly parent?: ElementId;
  /** The instance (a dialect) of a unit kind that it belongs to, for an element of a physical layer that is one instance's (0033-kanon FR-019). */
  readonly instance?: InstanceName;
  readonly source: SourceLocation;
  /** What is said of it, by name: for an element of Governance, each property is an annotation that must end expressed, carried or unexpressed (`dispositions`). */
  readonly properties: { readonly [name: string]: string | number | boolean | readonly string[] | null };
}

/** An element of one layer made into an element of the layer below it. */
export interface TraceEdge {
  readonly from: ElementId;
  readonly to: ElementId;
  /** How: `projects to`, `written as`, `read by`. */
  readonly how: string;
}

/** What a model's builder or a check found wrong. */
export interface ModelFinding {
  /** A rule's code, as `kanon/dropped`. */
  readonly rule: string;
  readonly element: ElementId;
  readonly message: string;
}

/** What every disposition says: which annotation of which element, and for which instance (0033-kanon FR-022); with no instance it holds for every instance of the model. */
type DispositionBase = { readonly element: ElementId; readonly annotation: string; readonly instance?: InstanceName };

/**
 * How an annotation of Governance ends (0033-kanon FR-005, FR-022): expressed by a lower element, carried as data of one, or named as unexpressed with the reason. A sum with one case for each way,
 * which a model gives for each instance, or once for all of them.
 */
export type Disposition =
  | (DispositionBase & { readonly outcome: "expressed"; readonly target: ElementId })
  | (DispositionBase & { readonly outcome: "carried"; readonly target: ElementId })
  | (DispositionBase & { readonly outcome: "unexpressed"; readonly reason: string });

/** The layered model of a Kanon library. */
export interface LayeredModel {
  /** Its name and the library it is of, as `arca`, `data`. */
  readonly name: string;
  readonly library: string;
  readonly title: string;
  readonly summary: string;
  /** The layers, from Governance down. */
  readonly layers: readonly ModelLayer[];
  readonly elements: readonly ModelElement[];
  readonly trace: readonly TraceEdge[];
  readonly findings: readonly ModelFinding[];
  readonly dispositions: readonly Disposition[];
  /** The instances (dialects) the model has, each of which every annotation of Governance is accounted for (0033-kanon FR-022); none where the model has no instances of a unit kind. */
  readonly instances: readonly InstanceName[];
}

/** The kinds of element that a program says (0033-kanon FR-013). */
export const PROGRAM_KINDS = ["action", "verb", "option", "operand", "problem-code", "outcome"] as const;
/** The kinds of element that a surface projects them into. */
export const PROJECTION_KINDS = ["cli-command", "mcp-tool", "rest-route"] as const;
/** A kind of the agreed kinds. */
export type AgreedKind = (typeof PROGRAM_KINDS)[number] | (typeof PROJECTION_KINDS)[number];

/** The id of a verb of a headless program. */
export const headlessId = (program: string, verbPath: string): Result<ElementId, string> =>
  parseElementId(`headless:${program}/${verbPath}`);
/** The id of the command of a verb on the command line. */
export const cliId = (program: string, verbPath: string): Result<ElementId, string> => parseElementId(`cli:${program} ${verbPath}`);
/** The id of the tool of a verb on a tool server. */
export const mcpId = (toolName: string): Result<ElementId, string> => parseElementId(`mcp:${toolName}`);
/** The id of the route of a verb on a REST surface. */
export const restId = (method: string, path: string): Result<ElementId, string> => parseElementId(`rest:${method} ${path}`);
/** The id of an option of a verb: the verb's id, a `#` and the flag, as `--force`. */
export const optionId = (verb: ElementId, flag: string): Result<ElementId, string> => parseElementId(`${verb}#${flag}`);
/** The id of an operand of a verb: the verb's id, a `#` and the operand's name. */
export const operandId = (verb: ElementId, operand: string): Result<ElementId, string> => parseElementId(`${verb}#${operand}`);
