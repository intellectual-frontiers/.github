// Spec: 0001-crypto FR-009
/**
 * The typed facts of Crypto, an independent library of commons (commons 0027-commons-libraries): the foundation of the rest, with no dependency and no host. Its specification is in its own spec kit
 * (`spec-kit/`, `0001-crypto`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as the first library of the lift of `commons/ts`
 * (0032-lifting-libraries).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Crypto. */
export const about: About = {
  title: "Crypto",
  summary:
    "The digests, signatures and envelopes of commons in pure code on Web Crypto: SHA-256 (branded), MD5, SHA-512 crypt, UUIDs, AWS Signature Version 4, CMS encrypted content, in-toto statements in DSSE envelopes, COSE keys and WebAuthn for a relying party; dependencies: core and formats.",
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
