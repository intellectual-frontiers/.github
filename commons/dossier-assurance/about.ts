// Spec: 0001-dossier-assurance-layers FR-001
/**
 * The typed facts of Dossier Assurance, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it as one requirement of
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Dossier Assurance. */
export const about: About = {
  title: "Dossier Assurance",
  summary: "The lenses of an assurance dossier, as a plugin of the dossier family: the acceptance of a case with each step's result and who attested it, the findings with a plan of action and milestones, how each requirement stands with counts and never a percentage, and the negative space (what has no evidence, has gone stale, is not met or is only partly met), each plate citing its sources and saying how old they are.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the shapes of the sources the lenses read, as data and types.", mayImport: ["core, by package name", "dossier governance, by package name"] },
    { path: "src/logical/", what: "Layer 2: the lenses, as pure functions.", mayImport: ["governance, by package name", "core, by package name", "dossier governance and logical, by package name"] },
    { path: "suite/", what: "The tests: every requirement.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
