// Spec: 0001-net FR-026
/**
 * The manifest of Net, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "net",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.2.7",
  maturity: "stable",
  distribution: ["github", "npm"],
  exports: [".", "./net", "./tcp", "./dns", "./http-client", "./serve", "./acme"],
  summary:
    "The network as one typed library: downloads that retry and resume, an HTTP server over web Request and Response, typed HTTP clients with recorded transports and AWS signing, TCP and TLS, DNS records, and ACME certificates by DNS-01.",
};
