/**
 * The configuration of this repository for `repoctl` (commons repoctl 0009-repoctl-config): the generators of its generated files, its checks, its commit rules, its hygiene policy and the optional verbs it turns on (the release of the libraries,
 * a new library, the status of the packages, the proof of a change by its blast radius and the documentation). Every fact `repoctl` knows of this repository is here, and the host knows none.
 *
 * @module
 */
import { DEFAULT_ALLOWED_PATHS, DEFAULT_FORBIDDEN_PATHS, DEFAULT_SECRET_PATTERNS, defineConfig, type GeneratorInput } from "./commons/repoctl/src/governance/mod.ts";

const generators: readonly GeneratorInput[] = [
  {
    id: "libraries",
    summary: "The section of the libraries of commons: one requirement and one row of the register for each library, from its manifest.",
    command: ["bun", "commons/libraries/src/libraries.ts"],
    inputs: ["commons/*/library.ts", "commons/*/package.json"],
    outputs: ["commons/spec-kit/specs/0027-commons-libraries/spec.md", "commons/spec-kit/enforcement.tsv"],
    mixed: ["commons/spec-kit/specs/0027-commons-libraries/spec.md", "commons/spec-kit/enforcement.tsv"],
  },
  {
    id: "metapackages",
    summary: "The exact dependencies of each metapackage, from the manifests of the libraries of its set.",
    command: ["bun", "commons/libraries/src/pack-metapackage.ts"],
    inputs: ["commons/*/library.ts", "commons/libraries/src/metapackages.ts", "commons/libraries/src/readme.ts"],
    outputs: ["commons/*/dependencies.auto.json"],
  },
  {
    id: "packaging",
    summary: "The packaging tables (TOML, shell, TypeScript, pins and rules) from the packaging ontology.",
    command: ["bun", "commons/tools/generate-packaging.ts"],
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
    command: ["bun", "commons/libraries/src/generate-ontology.ts"],
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
    command: ["bun", "commons/libraries/src/generate-workflows.ts"],
    inputs: ["commons/libraries/src/workflows/**", "commons/*/library.ts", "commons/*/tools/pack.ts", "commons/generated/pins.auto.env"],
    outputs: [".github/workflows/*.auto.yml", ".github/actions/*/action.yml"],
  },
  {
    id: "register",
    summary: "The proof register of the specifications as OSCAL, from every enforcement register and the tests that name their requirements.",
    command: ["bun", "commons/libraries/src/oscal-register.ts"],
    inputs: ["commons/**/spec-kit/enforcement.tsv", "commons/**/spec-kit/registry.tsv", "commons/**/suite/**", "commons/spec-kit/**", "tests/**"],
    outputs: ["commons/generated/mizan-register.auto.oscal.json", "commons/generated/mizan-register-results.auto.oscal.json"],
  },
  {
    id: "readme",
    summary: "The table of the libraries in README.md, from the manifests and the summaries of their about.ts.",
    command: ["bun", "commons/libraries/src/readme.ts"],
    inputs: ["commons/*/library.ts", "commons/*/about.ts"],
    outputs: ["README.md"],
    mixed: ["README.md"],
  },
  {
    id: "license",
    summary: "The LICENSE of the root and of every library, and THIRD_PARTY_NOTICES.md, from the one official text.",
    command: ["bun", "commons/libraries/src/license.ts"],
    inputs: ["commons/*/library.ts", "commons/libraries/src/license/**"],
    outputs: ["LICENSE", "commons/*/LICENSE", "THIRD_PARTY_NOTICES.md"],
  },
  {
    id: "installers",
    summary: "The installers of Ergonex (shell and PowerShell), from its pins and its version.",
    command: ["bun", "commons/ergonex/tools/generate-installers.ts"],
    inputs: ["commons/ergonex/src/install/**", "commons/ergonex/src/state-record.ts"],
    outputs: ["commons/ergonex/install/*.auto.sh", "commons/ergonex/install/*.auto.ps1"],
  },
];

export default defineConfig({
  repo: "intellectual-frontiers/.github",
  commit: {
    identity: { name: "Shahid Shah", email: "47497+shah@users.noreply.github.com" },
    issue: { prefix: "Refs #", required: false },
    trailers: ["issue", "co-author", "session"],
    coAuthor: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>",
    forbidden: { paths: DEFAULT_FORBIDDEN_PATHS, allow: DEFAULT_ALLOWED_PATHS, secrets: DEFAULT_SECRET_PATTERNS },
  },
  generators,
  checks: [
    { id: "specs", summary: "The format of the specification kit of commons.", command: ["bun", "commons/tools/mizan-check.ts"], code: "E-SPEC-KIT" },
    { id: "rules", summary: "The rules Mizan adds to the format, held by the baseline that only shrinks.", command: ["bun", "commons/libraries/src/check.ts"], code: "E-MIZAN-RULE" },
    { id: "versions", summary: "The version records: a record that is wrong, an identity that changed and a version that went back.", command: ["bun", "commons/libraries/src/versions.ts", "check"], code: "E-VERSIONS" },
    { id: "types", summary: "TypeScript 7 on the tests of the root.", command: ["bun", "node_modules/typescript/bin/tsc", "-p", "tests/tsconfig.json"], code: "E-TYPES" },
    { id: "tools-types", summary: "TypeScript 7 on the tools of commons.", command: ["bun", "node_modules/typescript/bin/tsc", "-p", "commons/tools/tsconfig.json"], code: "E-TYPES" },
  ],
  capabilities: { release: true, newLibrary: true, status: true, prove: true },
  libraries: {
    folder: "commons",
    specKit: { format: ["bun", "commons/tools/mizan-check.ts", "--root", "{kit}"], rules: ["bun", "commons/libraries/src/check.ts", "--root", "{kit}", "--level", "{level}"] },
    versionConstants: true,
    declaredDependencies: true,
    linker: ["bun", "commons/libraries/src/link.ts"],
    roleFile: "commons/libraries/src/readme.ts",
  },
  hygiene: { scope: "@intellectual-frontiers/", gitSources: ["intellectual-frontiers/.github"], pathSegment: "commons", sourceMarker: "commons/libraries/library.ts" },
  doctor: {
    minNode: 26,
    bunPin: { file: "commons/generated/pins.auto.env", variable: "BUN_VERSION" },
    links: { folder: "commons/node_modules/@intellectual-frontiers", fix: ["bun", "commons/libraries/src/link.ts"] },
    install: "bun install --frozen-lockfile",
  },
  docs: { config: "commons/docs.config.ts", out: "_site", generator: "commons/docs/src/cli.ts" },
});
