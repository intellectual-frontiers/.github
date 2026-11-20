// Spec: 0001-formats FR-020
/**
 * The typed facts of Formats, an independent library of commons (commons 0027-commons-libraries): the foundation of the rest, with no dependency and no host. Its specification is in its own spec kit
 * (`spec-kit/`, `0001-formats`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as the first library of the lift of `commons/ts`
 * (0032-lifting-libraries).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Formats. */
export const about: About = {
  title: "Formats",
  summary:
    "The file and wire formats of commons, read and written in pure code: JSON5, YAML, TOML, XML, CSV, base64, hexadecimal, ASN.1 DER, CBOR, tar, gzip and zip archives, PNG and ICO pictures, TypeScript literals, glob patterns, semantic versions, media types and HTTP headers; one dependency, core.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "The modules, and `mod.ts`, the one entry of the package.", mayImport: ["src/ only"] },
    {
      path: "suite/",
      what: "The tests: examples and fast-check properties for every law and round trip, and the type-level tests.",
      mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
