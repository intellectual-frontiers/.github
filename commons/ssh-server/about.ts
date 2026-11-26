// Spec: 0001-ssh-server-layers FR-001
/**
 * The typed facts of SSH Server, an independent library of commons (commons 0027-commons-libraries): the SSH server of enrollment, a server and never a client. Its specification is in its own spec kit (`spec-kit/`, `0001-ssh-server-layers`).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** SSH Server. */
export const about: About = {
  title: "SSH Server",
  summary:
    "The SSH server of enrollment, built in three layers (Kanon). Governance says what it is: fingerprints, the closed grammar of service commands and their registry, the facts of a device, the session and its states, the install plan and the audit event. " +
    "Logical is the pure model: the decision of an authentication, the dialogue state machine, the source-network policy, rate limits and penalties, tokens and pairing codes, the enrollment policy and identity resolution, and the renderers of the bootstrap scripts for POSIX sh and PowerShell 7. " +
    "Physical is the only layer that touches the world, and the only one that imports `ssh2`: the server on a port, the host key, the store port with its in-memory and JSON-file implementations. It never gives a shell.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "What it is, as data and decoders.", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "The pure model: decisions, the state machine, policy and the script renderers.", mayImport: ["src/governance/", "core, by package name"] },
    { path: "src/physical/", what: "The server on ssh2, the host key and the stores.", mayImport: ["src/governance/", "src/logical/", "ssh2", "node: builtins"] },
    { path: "suite/", what: "The tests: real OpenSSH clients against the server, the dialogue, the refusals, the scripts and a Debian container.", mayImport: ["src/", "ssh2 (a test client)", "fast-check", "the test module of commons, by package name"] },
    { path: "tools/", what: "The trace check `bun run verify` runs.", mayImport: ["the kernel and the runtime of commons, by package name"] },
  ],
};
