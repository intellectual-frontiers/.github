/**
 * The typed facts of Intellectual Frontiers Commons as a whole (commons 0011-documentation FR-005), the home page of its documentation:
 * what commons is and its folders. Its capabilities are its specifications (`spec-kit/registry.tsv`), and its packages keep their own
 * `about.ts` (`ts/about.ts`, `ts/data/about.ts`).
 *
 * @module
 */
import type { About } from "./ts/kernel/mod.ts";

/** Intellectual Frontiers Commons: what any company or harness of Intellectual Frontiers may use. */
export const about: About = {
  title: "Intellectual Frontiers Commons",
  summary:
    "What any company or harness of Intellectual Frontiers may use. A capability goes here when more than one harness (today `archon`, " +
    "tomorrow another) should read the same facts instead of keeping its own copy. It holds no company fact and no secret: this repository " +
    "is public. A harness reads `generated/`, and keeps no fact of its own that the ontology holds.",
  folders: [
    {
      path: "ontology/supply-chain/packaging/",
      what:
        "The packaging vocabulary (`packaging.ts`) and its data (`managers.ts`, `families.ts`, `programs.ts`, `pins.ts`, `rules.ts`, " +
        "`record.ts`), seeded from the tables of [`upt`](https://github.com/sigoden/upt) (MIT or Apache-2.0) and from what `archon` runs. It is " +
        "TypeScript, typed by the RDF library (`rdf/src/mod.ts`, commons 0012-ontology and rdf 0001-rdf); its Turtle is generated, never a source.",
      mayImport: ["rdf/src/mod.ts", "ontology/"],
    },
    {
      path: "tools/",
      what: "The tools, in TypeScript that Bun runs (Node 26 too): the generator of `generated/`, the spec-kit checker and the shell portability checker.",
      mayImport: ["tools/", "ontology/ (the generator, which reads its typed values)", "ts/kernel/toml.ts (the shell portability checker)"],
    },
    {
      path: "generated/",
      what: "The tables made from the ontology, for programs, scripts and a harness's setup, with the pinned downloads, and the ontology's Turtle; never edited by hand.",
      mayImport: ["nothing: generated"],
    },
    {
      path: "data/",
      what: "IFC data, an independent library with a spec kit and a manifest (`library.ts`) of its own (commons 0027-commons-libraries): governance, a logical and a physical schema, and extensions. Proved by `bun run verify` in its folder.",
      mayImport: ["its own about.ts"],
    },
    { path: "ts/", what: "IFC TypeScript, and the data libraries built on it (`ts/data/`).", mayImport: ["see its own about.ts"] },
    {
      path: "docs/",
      what: "The generator of this documentation, IFC Docs, which any repository uses by depending on commons by Git; it reads only commons' TypeScript and the spec kit, as `docs.config.ts` names them.",
      mayImport: ["see its own about.ts"],
    },
    {
      path: "spec-kit/",
      what: "The specifications of the capabilities, the register of their numbers and of what enforces each requirement.",
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
      run: "bun ts/mizan/generate-ontology.ts",
      does: "Writes `generated/mizan.auto.ttl` from Mizan's ontology; with `--check` it fails where the file is stale.",
    },
    {
      run: "bun ts/mizan/oscal-register.ts",
      does: "Writes the proof register of `spec-kit/` as OSCAL 1.2.3 (`generated/mizan-register.auto.oscal.json`, `generated/mizan-register-results.auto.oscal.json`); with `--check` it fails where a file is stale.",
    },
    {
      run: "bun ts/mizan/libraries.ts [--check]",
      does: "Writes the requirements of the libraries (0027-commons-libraries) and their rows of the register from each library's manifest, `commons/<name>/library.ts`; with `--check` it fails where they are stale or a manifest and its folder disagree.",
    },
    {
      run: "bun ts/mizan/check.ts [--level L0|L1|L2|L3] [--all]",
      does: "Checks a folder against the rules Mizan adds, held by a baseline that only shrinks, at the conformance level it declares (0028-conformance-levels); with `--all` it also runs every library's `verify`.",
    },
    {
      run: "bun ts/mizan/newer.ts",
      does: "Fetches the `latest` source of each import manifest and finds a standard whose newest bytes differ from its pin; needs the network, so it is opt-in and `check.ts` never runs it.",
    },
    { run: "bun tools/shell-portability-check.ts FILE...", does: "Finds what only GNU tools have in shell scripts." },
  ],
};
