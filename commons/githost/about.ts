// Spec: 0001-githost FR-010
/**
 * The typed facts of Githost, an independent library of commons (commons 0027-commons-libraries): the Git hosts behind one typed interface. Its specification is in its own spec kit (`spec-kit/`, `0001-githost`); this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library by concern (0032-libraries-by-concern).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Githost. */
export const about: About = {
  title: "Githost",
  summary:
    "The one interface to a Git host, `GitHostClient`, for GitHub (public and private repositories), GitLab (groups to any depth, `gitlab.com` or a self-managed host) and plain Git, held to the same conformance tests so that a " +
    "check of change control and a workspace never name a host's own word; the table of what each kind of host offers; and the reading of a remote written as a person writes it (`github.com/owner/repo`, `owner/repo`, " +
    "`git@host:path.git`, an https address, the address of a branch's page). A token is read only from the environment it is handed and sent only to the host it serves. " +
    "It depends on core, net and system. Published to npm as compiled modules with their declarations.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The types, the table of capabilities and the reader of a remote (pure), the three adapters (`github.ts`, `gitlab.ts`, `git.ts`), and `mod.ts`, which makes a client for a reference and reads a token.",
      mayImport: [
        "node: builtins",
        "src/",
        "core, net and system, by package name (the types, the table and the reader import core alone)",
      ],
    },
    {
      path: "suite/",
      what: "The tests: the shared conformance tests run on each adapter, recorded exchanges, a real plain Git repository, a live transport against a local server, and the reading of every spelling of a remote.",
      mayImport: [
        "src/",
        "core, net, system and test, by package name",
        "the ontology of change control, for the table of what each kind offers",
      ],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
