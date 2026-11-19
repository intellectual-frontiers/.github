// Spec: 0003-host FR-017
/**
 * The shell snippet of `ergonex` and the one marked block of a start-up file (commons 0003-host FR-017 to FR-019): the snippet for each of five shells, the start-up file each reads, and the functions that
 * install the block and remove exactly it. All pure: the files are read and written by `commands/shell.ts`.
 *
 * @module
 */
export { BEGIN, type BlockError, blockText, describeBlockError, type Edit, END, installBlock, removeBlock } from "./block.ts";
export {
  type Completions,
  createCommand,
  type HomeSpec,
  isShell,
  type RcFacts,
  rcFileFor,
  type Shell,
  SHELLS,
  snippetFor,
  type SnippetFacts,
} from "./snippet.ts";
