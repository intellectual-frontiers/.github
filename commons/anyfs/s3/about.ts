// Spec: 0001-anyfs-s3-layers FR-001
/**
 * The typed facts of AnyFS S3, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it by
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** AnyFS S3. */
export const about: About = {
  title: "AnyFS S3",
  summary: "The S3 backend of AnyFS: a store over a bucket and a prefix of any S3-compatible service, with a revision on every read and a stated expectation on every write, signed by Signature Version 4 and held to the same conformance suite as every backend.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "Layer 3: the store on a bucket, the client that signs and sends, the reading of the XML that S3 answers with, the table of its errors, the probe of what an endpoint keeps, and the pinned download of the server the tests run against.", mayImport: ["anyfs, by its exports", "crypto, by its exports", "core, by its exports", "headless, by its credential port"] },
    { path: "suite/", what: "The tests: every requirement, over a server of S3 made in process and, where it can be run, over the real RustFS, both held to the same contract.", mayImport: ["src/", "the test module of commons", "the packages of commons by name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs, and the pinned download of RustFS.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] }
  ],
};
