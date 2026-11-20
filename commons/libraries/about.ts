/**
 * The typed facts of Libraries, an independent library of commons (commons 0027-commons-libraries): the tools that manage the libraries of a repository of commons and hold it to Mizan. Its specification is in
 * its own spec kit (`spec-kit/`, `0001-libraries`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library by concern (0032-libraries-by-concern).
 *
 * Spec: 0001-libraries FR-010
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Libraries. */
export const about: About = {
  title: "Libraries",
  summary:
    "The tools of a repository of commons: the manifest of a library and the check that it and its folder agree, the libraries a change affects, the typed workflows of GitHub Actions and their generator, the pinned Bun, " +
    "the packer that builds, inspects and packs a library for npm with its declarations, and the commands that hold the whole repository to Mizan (`check`, `changes`, `versions`, `newer`, the register of proofs and the " +
    "generators of the ontologies). It depends on core, crypto, formats, githost, grc, mizan, net, ontology, rdf, system and terminal. Published to npm as compiled modules with their declarations.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The manifest and its checks, which libraries a change affects, the workflows and their generator, the pins and the pinned Bun's installer, the packer, the commands that hold a repository to Mizan and the importers of standards.",
      mayImport: ["node: builtins", "src/", "the libraries of commons below it, by package name"],
    },
    {
      path: "suite/",
      what: "The tests of the library, run on real manifests, workflows and folders of this repository.",
      mayImport: ["src/", "core, system and test, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the packer of this library, by relative path, and the libraries of commons, by package name"],
    },
  ],
};
