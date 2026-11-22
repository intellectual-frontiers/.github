// Spec: 0001-anyfs-serve-layers FR-001
/**
 * The typed facts of AnyFS Serve, an independent library of commons (commons 0027-commons-libraries) and a plugin of the family of AnyFS: any store served as WebDAV. Its specification is in its own spec kit
 * (`spec-kit/`, `0001-anyfs-serve-layers` to `0005-anyfs-serve-conformance`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** AnyFS Serve. */
export const about: About = {
  title: "AnyFS Serve",
  summary:
    "AnyFS over HTTP and NFS: any AnyFS store served as WebDAV, class 1 and 2, or as NFS version 3 on the loopback, on the POSIX view, so an operating system mounts it, and every response says whether it was native, emulated or refused.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the facts of NFS (programs, procedures, statuses, the table from a code of the view to a status), the methods, the table from a code of the view to an HTTP status, the options (exposure, limits, junk, directories, authentication) and the content types.", mayImport: ["core, anyfs and anyfs-posix governance, by package name"] },
    { path: "src/logical/", what: "Layer 2: XDR, ONC RPC and the NFS service over the view, the strict XML reader and writer, the mapping of an address to a path, the table of locks, the If header, the properties and the handler from a request to a response.", mayImport: ["governance", "core, crypto, anyfs and anyfs-posix, by package name"] },
    { path: "src/physical/", what: "Layer 3: the HTTP server that hosts the handler, binds the loopback and starts with a token, and the TCP server of NFS on the loopback.", mayImport: ["governance and logical", "net, by package name"] },
    { path: "suite/", what: "The tests: every requirement, a model of the view against the POSIX view, hostile XML, locks, the quirks of Finder and Windows and a real socket.", mayImport: ["everything of the library", "the test library of commons"] },
    { path: "tools/", what: "The trace check `bun run verify` runs.", mayImport: ["the kernel and the runtime of commons, by package name"] },
  ],
};
