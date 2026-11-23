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
    id: "single-tools",
    summary: "The devDependencies of commons/commons and its bun.lock: every third-party package that compiling the libraries needs, from their manifests and the sources they pack.",
    command: ["bun", "commons/libraries/src/pack-commons.ts", "--tools"],
    inputs: ["commons/*/library.ts", "commons/*/src/**", "commons/libraries/src/pack-tools.ts"],
    outputs: ["commons/commons/package.json", "commons/commons/bun.lock"],
    mixed: ["commons/commons/package.json"],
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

/**
 * Merge commits that were made before `repoctl hygiene` checked them, by a `git pull` where no `user.name` and `user.email` were set (68 authored as Claude, 36 as another address of the owner, 3 as a third): held by the first twelve characters of their hashes. History is never rewritten
 * (commons repoctl 0007-repoctl-hygiene FR-007), so this list only shrinks; a new merge by another identity is a finding, and a hash here that matches no merge is a warning.
 */
const HELD_MERGES = [
  "7edb0b2ea3a5", "26dd63e6bc9a", "558e3e86d045", "36bc191848a8", "86425c129a91", "0f2a7e2a46da",
  "7ae74cf7d89c", "dd0c192714ba", "3b162c4685c1", "79257638f295", "3464e88f0ffa", "056a6018a475",
  "413756f2843e", "10a2b285c171", "b2f9e8c59337", "2661651a6421", "6086c6732d33", "a414ed922034",
  "bc47bb91ed00", "24810573a16a", "a2b68e6323fe", "8a5d28fd9daf", "e6687e4bbebf", "e7becc115224",
  "ad8fa60e9915", "e3dec9065c90", "5c6022bedf4b", "404369ead5c2", "67e2ba0a50a7", "cd0d23e7ae3b",
  "cafd3640e16d", "51c457fbeb4a", "fa5c42bdd19a", "f62c972cdce5", "c7d3e381a63f", "df7a7668a03b",
  "2916e7278433", "ad3705cabf6c", "3d857395dca1", "936dda3072bb", "d86a1e066b5a", "4cdfa08268ef",
  "6b7b0679d50b", "83a4ebc917a8", "8320c89136fd", "810400a8de86", "3465f1f84d38", "f349c6efbfea",
  "401b3a1a8b4f", "d9a010b9ef1b", "b479c756f9a9", "6e6f49d35a51", "d81f17036cca", "d862b08f53ff",
  "a54b0d7956b5", "0c60a05c988e", "1cff13b47b9a", "1a5b2af7477e", "ebcb61a6639a", "f87fdc634cbf",
  "35e4a6655b09", "b2d1f9127e58", "21d308308a93", "318ff299309c", "1619eac26209", "7e357f82ba46",
  "8b12d9f02563", "414df6a59aab", "7dd38c6116fc", "cfa9a66d91d3", "64e4197ea560", "4afeac1fab5b",
  "12958f5dee6a", "30ef02da6b24", "5b18e419d4d6", "8be70335379c", "8b901e14e361", "4314a7549cc8",
  "209aefbf2659", "b59d9ff83d2e", "8371f0d93dc0", "35ea42fdce06", "e9c3b8c702fa", "403ce6a1da41",
  "5b6c42864adb", "55b29e508fb4", "cd0d846a6b6b", "2c3043e69cfa", "7eb19873acac", "46ae573d560d",
  "10d471e7860e", "49d418a01adf", "75e2e685bf61", "ecbbc699248a", "da361307be00", "d4ad353d044e",
  "ccb4cb779354", "0fc109ddc308", "910c1c7d7e08", "5012971602d5", "02c17b68e11e", "821cd4be17e5",
  "16bb50016b3a", "b8ce4feeed68", "a6ff63b5f352", "ae8bdfaa547a", "ad702429cb8f",
] as const;

export default defineConfig({
  repo: "intellectual-frontiers/.github",
  commit: {
    identity: { name: "Shahid Shah", email: "47497+shah@users.noreply.github.com" },
    heldMerges: HELD_MERGES,
    issue: { prefix: "Refs #", required: false },
    trailers: ["issue", "impact", "co-author"],
    coAuthor: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>",
    forbidden: { paths: DEFAULT_FORBIDDEN_PATHS, allow: DEFAULT_ALLOWED_PATHS, secrets: DEFAULT_SECRET_PATTERNS },
  },
  generators,
  checks: [
    { id: "specs", summary: "The format of the specification kit of commons.", command: ["bun", "commons/tools/mizan-check.ts"], code: "E-SPEC-KIT" },
    { id: "rules", summary: "The rules Mizan adds to the format, held by the baseline that only shrinks.", command: ["bun", "commons/libraries/src/check.ts"], code: "E-MIZAN-RULE" },
    { id: "accepted-findings", summary: "The accepted risks of the build's findings: a reason, an end within 366 days, an approver of the list, a name that is the finding's id (commons 0038-build-policy FR-008).", command: ["bun", "commons/libraries/src/ci/accepted.ts"], code: "E-ACCEPTANCE" },
    { id: "versions", summary: "The version records: a record that is wrong, an identity that changed and a version that went back.", command: ["bun", "commons/libraries/src/versions.ts", "check"], code: "E-VERSIONS" },
    { id: "types", summary: "TypeScript 7 on the tests of the root.", command: ["bun", "node_modules/typescript/bin/tsc", "-p", "tests/tsconfig.json"], code: "E-TYPES" },
    { id: "tools-types", summary: "TypeScript 7 on the tools of commons.", command: ["bun", "node_modules/typescript/bin/tsc", "-p", "commons/tools/tsconfig.json"], code: "E-TYPES" },
  ],
  capabilities: { release: true, newLibrary: true, status: true, prove: true, query: true, ci: true },
  libraries: {
    folder: "commons",
    specKit: { format: ["bun", "commons/tools/mizan-check.ts", "--root", "{kit}"], rules: ["bun", "commons/libraries/src/check.ts", "--root", "{kit}", "--level", "{level}"] },
    versionConstants: true,
    declaredDependencies: true,
    linker: ["bun", "commons/libraries/src/link.ts"],
    roleFile: "commons/libraries/src/readme.ts",
    docsFile: "commons/docs.config.ts",
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
