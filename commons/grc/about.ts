// Spec: 0001-grc-engineering FR-001
/**
 * The typed facts of GRC, an independent library of commons (commons 0027-commons-libraries): governance, risk and compliance as code. Its specification is in its own spec kit (`spec-kit/`, `0001-grc-engineering`); this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library of the lift of `commons/ts` (0032-lifting-libraries).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** GRC. */
export const about: About = {
  title: "GRC",
  summary:
    "The primitives of governance, risk and compliance as code: catalogs, controls, verdicts, findings and waivers (`grc`), JSON's canonical form, the hash-chained ledger and the manifests and bundles of evidence (`evidence`), " +
    "coverage, freshness, drift, the change-impact gate and the risk register (`assess`), and the findings, assessments and attestations written as OCSF 1.9.0 (`ocsf`), OSCAL 1.2.3 (`oscal`), CycloneDX 1.6 and in-toto (`attest`); " +
    "and, in `host`, the loaders of the settings of packs, the run of a pack as signals, and the signers. Published to npm as compiled modules with their declarations; it depends on Core, Formats, Crypto, System and Telemetry.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The pure modules (`grc`, `evidence`, `assess`, `ocsf`, `oscal`, `attest`, and the generated OCSF types) and `mod.ts`, the entry that names them as namespaces.",
      mayImport: ["src/", "core, formats and crypto, by package name"],
    },
    {
      path: "src/host/",
      what: "The host: the loaders of settings and the run of a pack as signals, and the signers, with `mod.ts` as its entry.",
      mayImport: ["node: builtins", "src/", "core, formats, crypto, system and telemetry, by package name"],
    },
    {
      path: "suite/",
      what: "The tests: the model, the evidence, the assessments, the formats against the standards' examples, the loaders, the run as signals, and the signers.",
      mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs, and the generator of the OCSF types (`ocsf-gen.ts`, run by hand).",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
