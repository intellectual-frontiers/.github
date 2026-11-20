// Spec: 0001-integrations-layers FR-008
/**
 * The typed facts of Integrations, an independent library of commons (commons 0027-commons-libraries): observation and exchange on one skeleton of layers.
 * Its specification is in its own spec kit (`spec-kit/`, `0001-integrations-layers` to `0009-integrations-verbs`); this repository knows it as one requirement of
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Integrations. */
export const about: About = {
  title: "Integrations",
  summary:
    "Two families on one skeleton of Kanon layers. OBSERVE: read-only connectors to clouds, SaaS, identity, code hosts, HR, endpoints and network devices, writing observations and entities under a read-only contract, a credential reference, a least-privilege scope, a cadence and a denylist of fields. " +
    "EXCHANGE: messages and documents under standards (FHIR, X12, HL7 v2) and partner agreements, in four levels (syntax, schema, profile, terminology) over one abstract typed tree, with mappings that account for every field, acknowledgements and an exchange state machine. " +
    "Vendors and standards are plugin packages behind typed ports and a conformance suite. Governance and logical are pure; effects are at the physical edge.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: identities, the governance of observation and of exchange, standards with licences.", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "Layer 2: ports, the observation and the Connector contract, the tree, validation, mappings, acknowledgements, the plugin contract, the conformance suites.", mayImport: ["governance, by package name", "core, by package name"] },
    { path: "src/physical/http/", what: "Layer 3: the read port of a system over Net's transport (read-only, backoff, paging, signing) and the digest.", mayImport: ["governance and logical, by package name", "core and net, by package name"] },
    { path: "src/physical/transport/", what: "Layer 3: the transports of exchange (HTTPS, the token request of backend services, MLLP framing).", mayImport: ["governance and logical, by package name", "core and net, by package name"] },
    { path: "src/surfaces/headless/", what: "The headless verbs `integrations observe|probe|check|validate|translate|send|receive|explain`.", mayImport: ["governance, logical and the transport, by package name", "core, headless and the terminal, by package name"] },
    { path: "suite/", what: "The tests: every requirement, properties, and the conformance of the reference extensions.", mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The layers check, the trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
