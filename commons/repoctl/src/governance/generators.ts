// Spec: 0002-repoctl-governance FR-005
/**
 * The generators of the repository, declared once as data (commons repoctl 0002-repoctl-governance FR-005): each is a program of commons that makes files from sources and checks that they are what it makes, with the globs of what
 * it reads and the globs of what it writes. `repoctl sync` runs them in the order these facts give (a generator after every generator that writes what it reads), `repoctl merge` knows a generated file by them, and `repoctl check`
 * runs each one's check. A generator that is added to the repository is added here, and nowhere else.
 *
 * @example
 * ```ts
 * import { GENERATORS } from "./generators.ts";
 * GENERATORS.map((g) => g.id).includes("readme"); // true
 * GENERATORS.find((g) => g.id === "readme")?.outputs; // ["README.md"]
 * ```
 *
 * @module
 */

/** The name of every generator: a closed union. */
export type GeneratorId = "libraries" | "metapackages" | "packaging" | "ontology" | "workflows" | "register" | "readme" | "license" | "installers";

/** A generator: what it is, the command that makes its files, and what it reads and writes. */
export type Generator = {
  readonly id: GeneratorId;
  readonly summary: string;
  /** The arguments of `bun`, from the repository's root: the program and its own options. It writes the files; with `--check` added it writes nothing and ends with 1 where a file is not what it makes. */
  readonly command: readonly string[];
  /** What it reads, as globs from the repository's root (`*` is one segment's characters, `**` any number of segments). */
  readonly inputs: readonly string[];
  /** What it writes, as globs from the repository's root. */
  readonly outputs: readonly string[];
  /** The outputs (globs, a subset of `outputs`) that also hold text a person wrote and that the generator leaves as it finds it, so that a merge keeps the lines of both sides of them before it makes the generated part again. */
  readonly mixed?: readonly string[];
};

/** Every generator of the repository, in the order that is kept where the facts do not order two of them. */
export const GENERATORS: readonly Generator[] = [
  {
    id: "libraries",
    summary: "The section of the libraries of commons: one requirement and one row of the register for each library, from its manifest.",
    command: ["commons/libraries/src/libraries.ts"],
    inputs: ["commons/*/library.ts", "commons/*/package.json"],
    outputs: ["commons/spec-kit/specs/0027-commons-libraries/spec.md", "commons/spec-kit/enforcement.tsv"],
    mixed: ["commons/spec-kit/specs/0027-commons-libraries/spec.md", "commons/spec-kit/enforcement.tsv"],
  },
  {
    id: "metapackages",
    summary: "The exact dependencies of each metapackage, from the manifests of the libraries of its set.",
    command: ["commons/libraries/src/pack-metapackage.ts"],
    inputs: ["commons/*/library.ts", "commons/libraries/src/metapackages.ts", "commons/libraries/src/readme.ts"],
    outputs: ["commons/*/dependencies.auto.json"],
  },
  {
    id: "packaging",
    summary: "The packaging tables (TOML, shell, TypeScript, pins and rules) from the packaging ontology.",
    command: ["commons/tools/generate-packaging.ts"],
    inputs: ["commons/ontology/src/supply-chain/packaging/**", "commons/tools/**"],
    outputs: [
      "commons/generated/packaging.auto.*",
      "commons/generated/pins.auto.env",
      "commons/generated/rules.auto.toml",
      "commons/generated/install-record.auto.toml",
    ],
  },
  {
    id: "ontology",
    summary: "The ontologies as Turtle, OWL, RDF, schemas, shapes, code lists, mappings and pages, from their TypeScript.",
    command: ["commons/libraries/src/generate-ontology.ts"],
    inputs: ["commons/ontology/src/**", "commons/libraries/src/generate-ontology.ts"],
    outputs: [
      "commons/generated/*.auto.ttl",
      "commons/generated/*.auto.ofn",
      "commons/generated/*.auto.rdf",
      "commons/generated/*-ontology.auto.html",
      "commons/generated/*-schemas.auto.json",
      "commons/generated/*-shapes.auto.ttl",
      "commons/generated/*-code-lists.auto.*",
      "commons/generated/*-mappings.auto.sssom.tsv",
    ],
  },
  {
    id: "workflows",
    summary: "The workflows and actions of GitHub Actions from their typed model.",
    command: ["commons/libraries/src/generate-workflows.ts"],
    inputs: ["commons/libraries/src/workflows/**", "commons/*/library.ts", "commons/*/tools/pack.ts", "commons/generated/pins.auto.env"],
    outputs: [".github/workflows/*.auto.yml", ".github/actions/*/action.yml"],
  },
  {
    id: "register",
    summary: "The proof register of the specifications as OSCAL, from every enforcement register and the tests that name their requirements.",
    command: ["commons/libraries/src/oscal-register.ts"],
    inputs: ["commons/**/spec-kit/enforcement.tsv", "commons/**/spec-kit/registry.tsv", "commons/**/suite/**", "commons/spec-kit/**", "tests/**"],
    outputs: ["commons/generated/mizan-register.auto.oscal.json", "commons/generated/mizan-register-results.auto.oscal.json"],
  },
  {
    id: "readme",
    summary: "The table of the libraries in README.md, from the manifests and the summaries of their about.ts.",
    command: ["commons/libraries/src/readme.ts"],
    inputs: ["commons/*/library.ts", "commons/*/about.ts"],
    outputs: ["README.md"],
    mixed: ["README.md"],
  },
  {
    id: "license",
    summary: "The LICENSE of the root and of every library, and THIRD_PARTY_NOTICES.md, from the one official text.",
    command: ["commons/libraries/src/license.ts"],
    inputs: ["commons/*/library.ts", "commons/libraries/src/license/**"],
    outputs: ["LICENSE", "commons/*/LICENSE", "THIRD_PARTY_NOTICES.md"],
  },
  {
    id: "installers",
    summary: "The installers of Ergonex (shell and PowerShell), from its pins and its version.",
    command: ["commons/ergonex/tools/generate-installers.ts"],
    inputs: ["commons/ergonex/src/install/**", "commons/ergonex/src/state-record.ts"],
    outputs: ["commons/ergonex/install/*.auto.sh", "commons/ergonex/install/*.auto.ps1"],
  },
];
