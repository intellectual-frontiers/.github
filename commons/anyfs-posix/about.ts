// Spec: 0001-anyfs-posix-layers FR-001
/**
 * The typed facts of AnyFS POSIX, an independent library of commons (commons 0027-commons-libraries) and a plugin of the family of AnyFS: the view of any store as a file system. Its specification is in its own
 * spec kit (`spec-kit/`, `0001-anyfs-posix-layers` to `0005-anyfs-posix-conformance`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** AnyFS POSIX. */
export const about: About = {
  title: "AnyFS POSIX",
  summary:
    "The POSIX view of any AnyFS store: directories derived from prefixes, handles with write-back, and every operation labelled native, emulated or refused, so a command line, a WebDAV or NFS server or a mount can treat any store as a file system without pretending.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the codes of an operation, its fidelity (native, emulated with a reason and a risk, or refused), the paths of POSIX and their resolution, the policy, and the operations by their cases.", mayImport: ["core, by package name", "governance of anyfs, by package name"] },
    { path: "src/logical/", what: "Layer 2: the plan of each operation for the capabilities of a store, the table from a problem to a code, directories derived from a list, modes, the handles of open objects, the contract of the view, and the conformance suite with its reference model. Pure: no input or output.", mayImport: ["governance, by package name", "core, by package name", "governance and logical of anyfs, by package name"] },
    { path: "src/physical/", what: "Layer 3: the view of a store as a file system, made through the handler of the store, and the read cache.", mayImport: ["governance and logical, by package name", "core, by package name", "governance and logical of anyfs, by package name"] },
    { path: "suite/", what: "The tests: every requirement, the conformance of the view over a store in memory, a store of the core capabilities and a store in a folder, and the compile-time check of what a view needs.", mayImport: ["src/", "the test module of commons, by package name", "the stores of anyfs, by package name"] },
    { path: "tools/", what: "The trace check `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
