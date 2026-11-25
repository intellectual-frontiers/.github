// Spec: 0001-terminal FR-006
/**
 * The terminal, as pure code (commons terminal 0001-terminal): a typed command-line parser (`args`) and command trees (`commands`), the one palette of colour roles and marks (`palette`), display width
 * and the cutting of a text by columns (`width`), a small terminal emulator for snapshot tests (`vt`), and the guided flow (`guide`, commons terminal 0002-guide). Each is a namespace of this entry and an entry of its own (`@intellectual-frontiers/terminal/args`,
 * and so on), so that a program imports what it uses; nothing here touches the host.
 *
 * @example
 * ```ts
 * import { args } from "@intellectual-frontiers/terminal";
 * const options = { verbose: args.flag({ help: "Say more." }) };
 * args.parseArgs(["--verbose"], { options, operands: [] }); // an Args value with options.verbose true
 * ```
 *
 * @module
 */
export * as args from "./args.ts";
export * as commands from "./commands.ts";
export * as guide from "./guide.ts";
export * as palette from "./palette.ts";
export * as vt from "./vt.ts";
export * as width from "./width.ts";
