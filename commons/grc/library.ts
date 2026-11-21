// Spec: 0001-grc-layers FR-001
/**
 * The manifest of GRC, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun commons/libraries/src/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "grc",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.3.7",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./physical", "./conformance", "./standard", "./serializers/oscal", "./serializers/ocsf", "./serializers/sarif", "./serializers/cyclonedx", "./serializers/intoto", "./runners/sql", "./runners/file", "./runners/api", "./runners/remote", "./runners/manual", "./runners/external", "./stores/memory", "./stores/files", "./stores/git", "./stores/gitref", "./stores/object", "./signers/dsse", "./signers/sshsig", "./surfaces/headless", "./surfaces/query"],
  summary:
    "Governance, risk and compliance in three layers: governance (frameworks, crosswalks, policies, checks, requirements, evidence policy and exceptions as data), the logical model (results, findings, evidence, attestations, assessments and the pure computations over them, as self-describing versioned documents) and the physical layer (registries of typed ports with conformance suites: runners, evidence stores, signers, serializers), with the headless verbs grc check, assess, explain and evidence.",
};
