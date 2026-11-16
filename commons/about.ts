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
  summary: "What any company or harness of Intellectual Frontiers may use. A capability goes here when more than one harness (today `archon`, " +
    "tomorrow another) should read the same facts instead of keeping its own copy. It holds no company fact and no secret: this repository " +
    "is public. A harness reads `generated/`, and keeps no fact of its own that the ontology holds.",
  folders: [
    {
      path: "ontology/supply-chain/packaging/",
      what: "The packaging vocabulary (`packaging.ttl`) and its data (`managers.ttl`, `families.ttl`, `programs.ttl`, `pins.ttl`, `rules.ttl`, " +
        "`record.ttl`), seeded from the tables of [`upt`](https://github.com/sigoden/upt) (MIT or Apache-2.0) and from what `archon` runs.",
      mayImport: ["nothing: Turtle"],
    },
    {
      path: "tools/",
      what: "The tools, in TypeScript that Deno runs: the generator of `generated/`, the spec-kit checker and the shell portability checker.",
      mayImport: ["tools/", "@std/toml (the shell portability checker)"],
    },
    {
      path: "generated/",
      what: "The tables made from the ontology, for programs, scripts and the machine setup, with the pinned downloads; never edited by hand.",
      mayImport: ["nothing: generated"],
    },
    { path: "ts/", what: "IFC TypeScript, and the data libraries built on it (`ts/data/`).", mayImport: ["see its own about.ts"] },
    { path: "docs/", what: "The generator of this documentation, IFC Docs, which any repository uses by depending on commons by Git; it reads only commons' TypeScript and the spec kit, as `docs.config.ts` names them.", mayImport: ["see its own about.ts"] },
    { path: "spec-kit/", what: "The specifications of the capabilities, the register of their numbers and of what enforces each requirement.", mayImport: ["nothing: Markdown and TSV"] },
  ],
  commands: [
    { run: "deno run --allow-read --allow-write tools/generate-packaging.ts", does: "Writes `generated/` again from the ontology; with `--check` it fails where a file is stale." },
    { run: "deno run --no-config --allow-read tools/spec-kit-check.ts", does: "Checks `spec-kit/` against the format of 0003-spec-kit." },
    { run: "deno run --allow-read tools/shell-portability-check.ts FILE...", does: "Finds what only GNU tools have in shell scripts." },
  ],
};
