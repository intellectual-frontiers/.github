// Spec: 0001-kanon-checker FR-008
/**
 * The typed facts of Kanon, an independent library of commons (commons 0027-commons-libraries): the pattern of a library built in layers. Its specification is in its own spec kit
 * (`spec-kit/`, `0001-kanon-checker`) and the pattern is `0033-kanon` of commons; this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Kanon. */
export const about: About = {
  title: "Kanon",
  summary:
    "The pattern of a library built in three layers, Governance, Logical and Physical (commons 0033-kanon): the type of a library's table of layers, read from the field `kanon` of its manifest; the import check that holds the table " +
    "(one finding code for each way an import can break it); the check that no annotation of Governance is dropped; and the types-only contract LayeredModel, the shape of the layered model the documentation generator reads. " +
    "A utility library of a single level: it is not itself built in layers. Published to npm as compiled modules with their declarations; it depends on Core, the formats and the system.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The table (`table.ts`), the import check (`imports.ts`), the check of dropped annotations (`dropped.ts`), the types of the model (`model.ts`), the host side that reads a library's folder (`host.ts`) and the command (`check.ts`).",
      mayImport: ["core, the formats and the system, by package name"],
    },
    {
      path: "suite/",
      what: "The tests: every requirement of the specification, each code of the check found from a table.",
      mayImport: ["src/", "fast-check", "the test module of commons, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
