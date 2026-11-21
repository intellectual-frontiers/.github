// Spec: 0001-anyfs-layers FR-001
/**
 * The typed facts of AnyFS, an independent library of commons (commons 0027-commons-libraries): one interface to the places bytes live. Its specification is in its own spec kit (`spec-kit/`, `0001-anyfs-layers`
 * to `0006-anyfs-documents`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** AnyFS. */
export const about: About = {
  title: "AnyFS",
  summary:
    "One typed interface to the places bytes live: a path is a normalized key, a place is a typed address, every read returns a revision and every write states what it expects, and the capabilities of a store are in its type, so that code which needs one cannot be handed a store without it.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: paths, prefixes, revisions, expectations, capabilities, places and the problems a store reports.", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "Layer 2: the operations as data, the store type, the laws, attenuation, mounts, the layers and the conformance suite. Pure: no input or output.", mayImport: ["governance, by package name", "core, by package name"] },
    { path: "src/merge/", what: "The pure algebra of a merge: UUID version 7 ids made by a hybrid clock, version rows that are their own checksums, the state of a replica and the view of a path as the heads of its rows, deltas with trust, deferral and findings, the check of a replica's rows, and the layout laws of a SQL database that can be dumped and replayed.", mayImport: ["governance, by package name", "core and the SHA-256 of crypto"] },
    { path: "src/physical/memory-merge/", what: "Layer 3: the store in memory that merges, the reference every backend that merges is held to.", mayImport: ["governance, logical and merge, by package name", "core and the SHA-256 of crypto"] },
    { path: "src/docs/", what: "Typed documents over a store: codecs with canonical bytes, schemas with versions and migrations as code, layouts as code, and collections whose documents come with their revisions. Pure: it is a function of the operations of a store.", mayImport: ["governance and logical, by package name", "core, by package name"] },
    { path: "src/docs/formats/", what: "The codecs of documents that need the file formats of commons: JSON5 and YAML trees.", mayImport: ["docs, by package name", "core and the JSON5 and YAML formats of formats"] },
    { path: "src/physical/memory/", what: "Layer 3: the store in memory.", mayImport: ["governance and logical, by package name", "core and the SHA-256 of crypto"] },
    { path: "src/physical/local/", what: "Layer 3: the store in a folder of the local file system.", mayImport: ["governance and logical, by package name", "core, the SHA-256 of crypto, and files, paths, locks and errors of system"] },
    { path: "src/physical/", what: "Layer 3: the entry of the stores, and the tracer of the traced layer, made from the telemetry of commons.", mayImport: ["governance, logical, memory and local, by package name", "core and telemetry"] },
    { path: "suite/", what: "The tests: every requirement, with the compile-time checks of the store type and the conformance of each backend.", mayImport: ["src/", "the test module of commons, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the trace of mizan, system and the packer of commons, by package name"] },
  ],
};
