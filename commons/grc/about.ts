// Spec: 0001-grc-layers FR-001
/**
 * The typed facts of GRC, an independent library of commons (commons 0027-commons-libraries): governance, risk and compliance as three layers and the extensions that plug into them. Its specification is in its own spec kit (`spec-kit/`, `0001-grc-layers` to `0012-grc-subtenants`); this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** GRC. */
export const about: About = {
  title: "GRC",
  summary:
    "Governance, risk and compliance in layers: governance (frameworks, crosswalks, policies, checks, requirements, evidence policy and exceptions, and groups of entities, with subtenants as a tree of parents, and the scope of each control inherited down it, as data that names no framework, runner or store), the logical model (results, findings, evidence, attestations, assessments and risks as self-describing versioned documents, with the pure computations over them: freshness, drift, change impact, coverage, roll-up, the group view over per-entity readers with each subtenant rolled up into its parent, and the as-of view of every control at an instant) and the physical layer (registries of typed ports, each with a conformance suite, for runners, evidence stores and signers, and the verification of a whole evidence bundle offline), with serializers as plugins (OSCAL, OCSF, SARIF, CycloneDX, in-toto) and the headless verbs `grc check`, `assess`, `explain`, `evidence` and `bundle verify`. " +
    "Published to npm as compiled modules with their declarations; it depends on Core, Formats, Crypto, System, Headless and Terminal. It is the shape commons calls Kanon, stated in 0001-grc-layers until that work lands.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the documents of governance, the envelope they share, the registry every port takes, durations and globs, and the group of entities as a tree of parents with the scope of its controls (branded entity, port and secret references, never values).", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "Layer 2: the documents of results, findings, evidence, attestations, assessments and risks, the pure computations, the group view and the as-of view, the ledger and the serializer port.", mayImport: ["governance", "core, crypto and formats, by package name"] },
    { path: "src/physical/", what: "Layer 3: the ports of runners, evidence stores and signers, the ports of one entity, their registries, the helpers that run through them and the offline verification of an evidence bundle (a pure core and a file adapter).", mayImport: ["logical and governance", "core, crypto, formats and system, by package name"] },
    { path: "src/serializers/", what: "One folder for each exchange format written (`oscal`, `ocsf`, `sarif`, `cyclonedx`, `intoto`).", mayImport: ["logical and governance", "core, crypto and formats, by package name"] },
    { path: "src/runners/", what: "One folder for each kind of runner (`sql`, `file`, `api`, `remote`, `manual`, `external`).", mayImport: ["physical, logical and governance", "core, crypto, formats and system, by package name"] },
    { path: "src/stores/", what: "One folder for each evidence store (`memory`, `files`, `git`, `object`).", mayImport: ["physical, logical and governance", "core, crypto, formats and system, by package name"] },
    { path: "src/signers/", what: "One folder for each signer (`dsse`).", mayImport: ["physical, logical and governance", "core, crypto, formats and system, by package name"] },
    { path: "src/conformance/", what: "The conformance suites of the ports and of a group's readers over per-entity ports that cannot see each other, which a third party runs against its own extension.", mayImport: ["every unit below", "core, crypto and formats, by package name"] },
    { path: "src/surfaces/", what: "The headless verbs of GRC (`check`, `assess`, `explain`, `evidence`, `bundle verify`) and the explanations of the codes of `bundle verify`.", mayImport: ["every unit below", "headless, terminal and system, by package name"] },
    { path: "suite/", what: "The tests: layers, governance, the logical model, documents and serializers, runners, evidence and attestation, and the verbs.", mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The layers check and the trace check `bun run verify` runs, and the packer.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
