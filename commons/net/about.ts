// Spec: 0001-net FR-017, FR-018
/**
 * The typed facts of Net, an independent library of commons (commons 0027-commons-libraries): the network as one typed library. Its specification is in its own spec kit (`spec-kit/`, `0001-net`); this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library by concern (0032-libraries-by-concern).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Net. */
export const about: About = {
  title: "Net",
  summary:
    "The network as one typed library, the same on Bun and Node 26 and on Windows, macOS and Linux: a download that classifies a failure, retries and resumes and keeps a file only when its SHA-256 is the expected one (`net`), " +
    "an HTTP server over web `Request` and `Response`, with a safe read-only handler for a published folder (`serve`, `folderHandler`, `serveFolder`), typed HTTP clients with a live or recorded transport, a read-only guard and AWS signing (`http-client`), TCP and TLS listeners and connections (`tcp`), " +
    "DNS records as `Result`s (`dns`), and ACME certificates by the DNS-01 challenge (`acme`). It depends on core, formats, crypto, system and telemetry, which traces its requests and its server. " +
    "Published to npm as compiled modules with their declarations.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The modules, and `mod.ts`, the entry that names them as namespaces.",
      mayImport: ["node: builtins", "src/", "core, formats, crypto, system and telemetry, by package name"],
    },
    {
      path: "suite/",
      what: "The tests: servers the tests start, real sockets and temporary folders, recorded exchanges, the retries and the refusals, and the signals that the client and the server make.",
      mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
