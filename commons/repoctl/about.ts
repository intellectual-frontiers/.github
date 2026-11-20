// Spec: 0001-repoctl-layers FR-001
/**
 * The typed facts of Repoctl, an independent library of commons (commons 0027-commons-libraries): the operations program of this repository. Its specifications are in its own spec kit (`spec-kit/`), numbered from 0001; this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Repoctl. */
export const about: About = {
  title: "Repoctl",
  summary:
    "The operations program of this repository, `repoctl`: one command that makes every generated file in dependency order and reruns only the stale ones (`sync`, and `sync --check` for CI and hooks), merges a reference and makes a conflicting generated file again instead of resolving it by hand (`merge`), " +
    "runs every check in one calm report with problem codes that `repoctl explain` explains (`check`), tells each library's version in the repository, on npm and in its tag (`status`), plans, makes and publishes a release behind the releaser tier and a typed confirmation (`release plan|apply|publish`), " +
    "scaffolds a library of commons (`new library`), makes the commit with the repository's identity and trailers and refuses what must not be committed (`commit`), and says what is wrong with a checkout (`doctor`). " +
    "It is a headless program in the layers of Kanon: its verbs are governance actions with reach policies and audience tiers (public, contributor, releaser), run through the command line, and served as tools by `repoctl mcp`, so that a person and an AI agent run the same deterministic repository operations. A library of commons with its own specifications.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/governance/",
      what: "Layer 1: what Repoctl is, as data and types that cannot be made wrong: the identities (a library, a version, an issue, a session, a subject), the audience tiers, the verbs with their facts and reach, the problem codes and their explanations, the table of generators with what each reads and writes, and the table of checks.",
      mayImport: ["core and the governance of headless, by package name"],
    },
    {
      path: "src/logical/",
      what: "Layer 2: what each verb reasons with, as pure functions and the ports of the world: the order of the generators, sync, merge, check, the version constants, the status, the publication, the scaffold of a library, the commit and the diagnosis.",
      mayImport: ["governance, by package name", "core and the governance and logical layers of headless, by package name"],
    },
    {
      path: "src/physical/",
      what: "Layer 3: what touches the world: the adapters of the ports (programs, files, the registry of npm, the credential), the verbs on Headless with their options, operands and examples, the tree of the program and the tool server.",
      mayImport: ["governance and logical, by package name", "core, headless, the parser of the terminal, the system and the libraries of commons, by package name"],
    },
    { path: "src/", what: "The entry of the program, `repoctl.ts`: the command line, the tier the host holds and the checkout it finds.", mayImport: ["the three layers"] },
    { path: "bin/", what: "The launcher the package's `bin` names: it registers the hook that lets Node 26 run TypeScript, then the program.", mayImport: ["src/"] },
    { path: "tools/", what: "The check `bun run verify` runs: the trace of sources and tests to the specifications.", mayImport: ["the kernel and the runtime, by package name"] },
    { path: "suite/", what: "The tests, which run the real programs and a real `git`, never stand-ins.", mayImport: ["src/", "the runtime's test module, by package name"] },
  ],
};
