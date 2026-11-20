/**
 * The typed facts of Intellectual Frontiers Commons as a whole (commons 0011-documentation FR-005), the home page of its documentation:
 * what commons is and its folders. Its capabilities are its specifications (`spec-kit/registry.tsv`), and its packages keep their own
 * `about.ts` (`ts/about.ts`).
 *
 * @module
 */
import type { About } from "./ts/kernel/mod.ts";

/** Intellectual Frontiers Commons: what any company or harness of Intellectual Frontiers may use. */
export const about: About = {
  title: "Intellectual Frontiers Commons",
  summary:
    "Everything that any company or harness of Intellectual Frontiers may use, as independent libraries. Each library is built in layers (Kanon): governance says what a thing is and may do, the logical layer is the model a program reasons with, " +
    "and the physical layer is what runs (tables, commands, tools, routes). Each has its own specifications, tests and package, and is proved by one command, `bun run verify`, in its folder. " +
    "Start with `ergonex`, the front-door command: it sets up a workspace of the repositories, tools and shell a person needs, shows a plan before it changes anything, and checks the result. " +
    "Read the libraries below for what each is for, the API reference to call them, the specifications for what each promises and how it is checked, and the models and programs for what the libraries say about themselves. " +
    "This repository holds no company fact and no secret: it is public.",
  folders: [
    {
      path: "ontology/src/supply-chain/packaging/",
      what:
        "The packaging vocabulary (`packaging.ts`) and its data (`managers.ts`, `families.ts`, `programs.ts`, `pins.ts`, `rules.ts`, `record.ts`), seeded from the tables of [`upt`](https://github.com/sigoden/upt) (MIT or Apache-2.0) and from what `archon` runs. " +
        "It is TypeScript, typed by the RDF library; its Turtle is generated, never a source.",
      mayImport: ["rdf/src/mod.ts", "ontology/"],
    },
    {
      path: "tools/",
      what: "The tools, in TypeScript that Bun runs (Node 26 too): the generator of `generated/`, the spec-kit checker and the shell portability checker.",
      mayImport: ["tools/", "ontology/ (the generator, which reads its typed values)"],
    },
    {
      path: "generated/",
      what: "The tables made from the ontology, for programs, scripts and a harness's setup, with the pinned downloads, and the ontology's Turtle; never edited by hand.",
      mayImport: ["nothing: generated"],
    },
    {
      path: "docs/",
      what: "The generator of this documentation, IFC Docs, which any repository uses by depending on commons; it reads TypeScript and the spec kits as `docs.config.ts` names them.",
      mayImport: ["see its own about.ts"],
    },
    {
      path: "spec-kit/",
      what: "The specifications that belong to commons as a whole, the register of their numbers and of what enforces each requirement. Each library keeps its own in its own `spec-kit/`.",
      mayImport: ["nothing: Markdown and TSV"],
    },
  ],
  commands: [
    {
      run: "bun tools/generate-packaging.ts",
      does: "Writes `generated/` again from the ontology; with `--check` it fails where a file is stale.",
    },
    {
      run: "bun tools/mizan-check.ts [--root DIR] [--register DIR]",
      does: "Checks `spec-kit/` against the format of 0003-mizan; a harness whose registers are in another folder names it with `--register`, and its numbers may have three digits or four.",
    },
    {
      run: "bun libraries/src/generate-ontology.ts",
      does: "Writes `generated/mizan.auto.ttl` from Mizan's ontology; with `--check` it fails where the file is stale.",
    },
    {
      run: "bun libraries/src/oscal-register.ts",
      does: "Writes the proof register of `spec-kit/` as OSCAL 1.2.3 (`generated/mizan-register.auto.oscal.json`, `generated/mizan-register-results.auto.oscal.json`); with `--check` it fails where a file is stale.",
    },
    {
      run: "bun libraries/src/libraries.ts [--check]",
      does: "Writes the requirements of the libraries (0027-commons-libraries) and their rows of the register from each library's manifest, `commons/<name>/library.ts`; with `--check` it fails where they are stale or a manifest and its folder disagree.",
    },
    {
      run: "bun libraries/src/check.ts [--level L0|L1|L2|L3] [--all]",
      does: "Checks a folder against the rules Mizan adds, held by a baseline that only shrinks, at the conformance level it declares (0028-conformance-levels); with `--all` it also runs every library's `verify`.",
    },
    {
      run: "bun libraries/src/newer.ts",
      does: "Fetches the `latest` source of each import manifest and finds a standard whose newest bytes differ from its pin; needs the network, so it is opt-in and `check.ts` never runs it.",
    },
    { run: "bun tools/shell-portability-check.ts FILE...", does: "Finds what only GNU tools have in shell scripts." },
  ],
};
