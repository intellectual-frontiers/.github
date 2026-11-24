// Spec: 0001-anyfs-ssh-layers FR-001
/**
 * The typed facts of AnyFS SSH, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it as one requirement of
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** AnyFS SSH. */
export const about: About = {
  title: "AnyFS SSH",
  summary: "The SSH backend of AnyFS: a store over a folder on a host reached by SSH, the fleet's system of record, with a revision on every read and a stated expectation on every write, reached only through the safe executor of headless.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "Layer 3: the store on a host, the protocol of the helper as pure functions, and the dialects of the host's shell.", mayImport: ["anyfs, by its exports", "headless, by its exports", "crypto and core, by package name"] },
    { path: "src/helper/", what: "The helper that runs on the host: the script of the posix dialect and the module made from it, with its pinned SHA-256.", mayImport: ["nothing: a shell script and the text it is carried as"] },
    { path: "suite/", what: "The tests: every requirement, over an executor that runs the real helper on this computer by the path an ssh executor takes.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check, the maker of the helper module and the packer `bun run verify` runs, and the throwaway OpenSSH server of the tests of the store.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
