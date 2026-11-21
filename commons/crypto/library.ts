// Spec: 0001-crypto FR-009
/**
 * The manifest of Crypto, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "crypto",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.2.1",
  distribution: ["github", "npm"],
  exports: [".", "./cms", "./cose", "./crypt", "./dsse", "./md5", "./sha256", "./sigv4", "./uuid", "./webauthn"],
  summary:
    "The digests, signatures and envelopes of commons in pure code on Web Crypto: SHA-256 (branded), MD5, SHA-512 crypt, UUIDs, AWS Signature Version 4, CMS encrypted content, in-toto statements in DSSE envelopes, COSE keys and WebAuthn for a relying party; dependencies: core and formats.",
};
