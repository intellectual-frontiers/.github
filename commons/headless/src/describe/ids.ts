// Spec: 0015-describe FR-002, FR-003
/**
 * The vocabulary of a described program (commons headless 0015-describe FR-002, FR-003): the closed union of the kinds of element a model of Headless holds, the layer each kind is in, and the smart
 * constructors of the id of each kind. Every id is an `ElementId` of Kanon, made only by a constructor that returns a `Result`, so that an element is never given a text that is not an id.
 *
 * @remarks
 * The kinds agreed with the data library are `action`, `verb`, `option`, `operand`, `problem-code` and `outcome` for what a program says, and `cli-command`, `mcp-tool` and `rest-route` for what a surface
 * projects it into; Headless adds `program` and `plugin` (who contributes a verb) and `openapi-document` (the document of a REST surface, which holds its routes). The ids of the agreed kinds are
 * `headless:<program>/<verb path>`, `cli:<program> <verb path>`, `mcp:<tool name>`, `rest:<METHOD> <path>`, and `<verb id>#--flag` or `<verb id>#<operand>`; the others are
 * `action:<program>/<verb path>`, `problem-code:<program>/<code>`, `outcome:<program>/<exit name>`, `plugin:<owner>` and `openapi:<program>`.
 *
 * @example
 * ```ts
 * import { verbIdOf } from "./ids.ts";
 * verbIdOf("tool", ["repos", "add"]).kind; // "ok"
 * ```
 *
 * @module
 */
import { absurd, type Result } from "@intellectual-frontiers/core";
import { cliId, type ElementId, headlessId, type Layer, mcpId, operandId, optionId, parseElementId, restId } from "@intellectual-frontiers/kanon";

/** The kinds of element of a described program: a closed union. */
export const KINDS = ["program-definition", "action", "problem-code", "outcome", "program", "plugin", "verb", "option", "operand", "cli-command", "mcp-tool", "rest-route", "openapi-document"] as const;

/** A kind of element. */
export type Kind = (typeof KINDS)[number];

/** The layer a kind of element is in: governance says what an action is and may do, the logical layer is the program's own tree, and the surfaces are the physical layer. */
export function layerOf(kind: Kind): Layer {
  switch (kind) {
    case "program-definition":
    case "action":
    case "problem-code":
    case "outcome":
      return "governance";
    case "program":
    case "plugin":
    case "verb":
    case "option":
    case "operand":
      return "logical";
    case "cli-command":
    case "mcp-tool":
    case "rest-route":
    case "openapi-document":
      return "physical";
    default:
      return absurd(kind);
  }
}

/** The kinds of each layer, in the order of `KINDS`. */
export function kindsOf(layer: Layer): readonly Kind[] {
  return KINDS.filter((k) => layerOf(k) === layer);
}

/** The id of the program. */
export const programIdOf = (program: string): Result<ElementId, string> => parseElementId(`headless:${program}`);
/** The id of the plugin that contributes verbs (the owner's name, `<program>-<noun>`). */
export const pluginIdOf = (owner: string): Result<ElementId, string> => parseElementId(`plugin:${owner}`);
/** The id of the action of a verb, in governance. */
export const actionIdOf = (program: string, words: readonly string[]): Result<ElementId, string> => parseElementId(`action:${program}/${words.join(" ")}`);
/** The id of a verb. */
export const verbIdOf = (program: string, words: readonly string[]): Result<ElementId, string> => headlessId(program, words.join(" "));
/** The id of the command of a verb on the command line. */
export const cliIdOf = (program: string, words: readonly string[]): Result<ElementId, string> => cliId(program, words.join(" "));
/** The id of the tool of a verb. */
export const mcpIdOf = (toolName: string): Result<ElementId, string> => mcpId(toolName);
/** The id of a route. */
export const restIdOf = (method: "GET" | "POST", path: string): Result<ElementId, string> => restId(method, path);
/** The id of the OpenAPI document of the program. */
export const documentIdOf = (program: string): Result<ElementId, string> => parseElementId(`openapi:${program}`);
/** The id of a code of the program's catalogue. */
export const codeIdOf = (program: string, code: string): Result<ElementId, string> => parseElementId(`problem-code:${program}/${code}`);
/** The id of an exit status, by its name. */
export const exitIdOf = (program: string, name: string): Result<ElementId, string> => parseElementId(`outcome:${program}/${name}`);
/** The id of an option of a verb, by its flag (`--force`). */
export const optionIdOf = (verb: ElementId, flag: string): Result<ElementId, string> => optionId(verb, flag);
/** The id of an operand of a verb. */
export const operandIdOf = (verb: ElementId, name: string): Result<ElementId, string> => operandId(verb, name);
