// Spec: 0015-describe FR-001
/**
 * The description of a headless program as layered models (commons headless 0015-describe): `describe(program)` gives one `LayeredModel` of Kanon for each tier of the program's ladder, with the action,
 * problem codes and exit statuses of governance, the verbs, options, operands and plugins of the logical layer, and the command, tool and route that each surface draws.
 *
 * @example
 * ```ts
 * import { describe } from "@intellectual-frontiers/headless/describe";
 * import { programOf } from "@intellectual-frontiers/headless/logical";
 * describe(programOf({ name: "tool", summary: "A tool.", version: "1.0.0", children: [] })).length; // 3
 * ```
 *
 * @module
 */
export * from "./describe.ts";
export * from "./ids.ts";
