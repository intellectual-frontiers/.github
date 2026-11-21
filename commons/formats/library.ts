// Spec: 0001-formats FR-020
/**
 * The manifest of Formats, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "formats",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.2.3",
  distribution: ["github", "npm"],
  exports: [
    ".",
    "./archive",
    "./base64",
    "./cbor",
    "./csv",
    "./der",
    "./glob",
    "./hex",
    "./http",
    "./json5",
    "./media-types",
    "./png",
    "./semver",
    "./toml",
    "./ts-literal",
    "./xml",
    "./xz",
    "./yaml",
  ],
  summary:
    "The file and wire formats of commons, read and written in pure code: JSON5, YAML, TOML, XML, CSV, base64, hexadecimal, ASN.1 DER, CBOR, tar, gzip, xz and zip archives, PNG and ICO pictures, TypeScript literals, glob patterns, semantic versions, media types and HTTP headers; one dependency, core.",
};
