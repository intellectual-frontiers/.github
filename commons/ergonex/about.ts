// Spec: 0001-ergonex FR-001
/**
 * The typed facts of Ergonex, an independent library of commons (commons 0027-commons-libraries): the workspaces management of Intellectual Frontiers, one command that sets up, configures and operates a
 * team's software repositories, package registries and builds. Its specifications are in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it as one requirement of
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Ergonex. */
export const about: About = {
  title: "Ergonex",
  summary:
    "The one command, `ergonex`, that manages a team's workspace: the repositories laid out like their remotes on GitHub, GitLab or plain Git behind one interface, with a plan shown before anything changes, " +
    "the pinned tools, the generated files and hooks, the shell, and the checks of a workspace (`doctor`, `status`, `verify`). It runs on Windows, macOS and Linux, on Bun by default and on Node 26 as the backup, " +
    "and is written to be installed from npm by a person who has never set up a repository. The first real program on Headless: its commands are governance actions with reach policies, run through the command-line surface. A library of commons with its own specifications.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The program `ergonex.ts`, its commands (declared on Headless in `commands/`, with the tree in `commands/program.ts`), the plan and the host: the pure core (the plan, the findings, the manifest, the layout) and the host layer that reads files, runs programs and writes evidence.",
      mayImport: ["the kernel, the runtime and the Git host of commons, by package name; Headless only from commands/ and ergonex.ts, by its exports"],
    },
    {
      path: "src/platform/",
      what: "What this library uses of the runtime and the kernel's namespaces, each name once, by package name.",
      mayImport: ["the runtime and the kernel, by package name"],
    },
    {
      path: "bin/",
      what: "The launcher the package's `bin` names: it registers the hook that lets Node 26 run TypeScript, then the controller.",
      mayImport: ["src/"],
    },
    {
      path: "tools/",
      what: "The check `bun run verify` runs: the trace of sources and tests to the specifications.",
      mayImport: ["the kernel and the runtime, by package name"],
    },
    {
      path: "suite/",
      what: "The tests, which run the real programs and a real `git`, never stand-ins.",
      mayImport: ["src/", "the runtime's test module, by package name"],
    },
  ],
};
