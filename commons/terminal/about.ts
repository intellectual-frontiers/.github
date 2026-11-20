// Spec: 0001-terminal FR-006
/**
 * The typed facts of Terminal, an independent library of commons (commons 0027-commons-libraries): the command line and the console as pure code, with no host. Its specification is in its own spec kit
 * (`spec-kit/`, `0001-terminal`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library by concern (0032-libraries-by-concern).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Terminal. */
export const about: About = {
  title: "Terminal",
  summary:
    "A typed command-line parser (`args`) whose options are declared once as data, command trees (`commands`) resolved and helped from their declaration, the console's one palette (`palette`), display width " +
    "and the cutting of a text by columns (`width`), and a terminal emulator for snapshot tests (`vt`). It names no host global and runs wherever ECMAScript does. Published to npm as compiled modules with " +
    "their declarations; it depends on Core alone.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The modules, and `mod.ts`, the entry that names them as namespaces.",
      mayImport: ["src/", "core, by package name"],
    },
    {
      path: "suite/",
      what: "The tests: every grammar rule and error kind of the parser, the commands, the palette, the width and the emulator, with properties and type-level tests.",
      mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
