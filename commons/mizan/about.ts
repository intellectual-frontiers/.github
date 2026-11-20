// Spec: 0001-harness FR-001
/**
 * The typed facts of Mizan, an independent library of commons (commons 0027-commons-libraries): Mizan, the IF Spec Profile, as code. The harness holds the rules of a folder of specifications against a baseline that only shrinks; the rules are plugins, and  Its specification is in its own spec kit (`spec-kit/`, `0001-harness`); this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library of the lift of `commons/ts` (0032-lifting-libraries).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Mizan. */
export const about: About = {
  title: "Mizan",
  summary:
    "Mizan, the IF Spec Profile, as code. The harness holds the rules of a folder of specifications against a baseline that only shrinks; the rules are plugins, and the change-control rules (IFCCM) and the release rules (IFR) are plugins of the same harness, so they are subpaths of this library (`changes`, `versions`), not libraries above it. The trace of requirements to code and tests, the layers of a ladder, the levels of conformance, the integrations of standards are here too. It depends on core, crypto, formats, githost, ontology, rdf and system. Published to npm as compiled modules with their declarations.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The harness and the rules of Mizan: the rules of a specification as plugins, the levels, the standards and terms rules, the integrations (importers and exporters), the change-control rules (`changes/`) and the release rules (`versions/`) as plugins of the same harness, the trace of sources and tests to requirements and the layers of a ladder (`trace.ts`, `layers.ts`, with its host in `host/trace.ts`).",
      mayImport: ["node: builtins", "src/", "core, crypto, formats, githost, ontology, rdf and system, by package name"],
    },
    {
      path: "suite/",
      what: "The tests.",
      mayImport: ["src/", "the libraries it depends on and the library `test`, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
