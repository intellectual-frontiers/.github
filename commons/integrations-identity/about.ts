// Spec: 0001-integrations-identity-layers FR-001
/**
 * The typed facts of Integrations Identity, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it as one requirement of
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Integrations Identity. */
export const about: About = {
  title: "Integrations Identity",
  summary: "Read-only connectors for the identity and device posture of a managed service provider's customers: a Microsoft Entra tenant (who has multifactor authentication, whether a policy requires it), Microsoft Intune managed devices (compliance, encryption, staleness) and a Google Workspace domain (two-step verification, administrators), each written against the read port of Integrations, with its governance as data and a conformance run over recorded answers.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: what the library is, as data and types.", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "Layer 2: the model the library reasons with.", mayImport: ["governance, by package name", "core, by package name"] },
    { path: "src/physical/", what: "Layer 3: what reads files, runs programs and reaches the network.", mayImport: ["governance and logical, by package name", "core and the system, by package name"] },
    { path: "suite/", what: "The tests: every requirement.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
