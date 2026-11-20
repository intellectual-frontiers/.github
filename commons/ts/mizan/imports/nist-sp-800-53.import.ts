/**
 * The import of the controls of NIST SP 800-53 Rev. 5.2.0 that Mizan's specifications cite (commons 0019-mizan-integrations FR-005, FR-006, FR-009, FR-014, 0018-standards-first FR-001):
 * the OSCAL catalog NIST publishes, fetched from the versioned URL of its tagged release and held to the SHA-256 pinned here, so that the control identifiers a specification names
 * are typed values that rest on bytes that cannot change unseen. Its provenance is `nist-sp-800-53.auto.prov.ttl` beside this file. Run
 * `bun commons/mizan/src/integrations/host/import.ts commons/ts/mizan/imports/nist-sp-800-53.import.ts` to write the module again, with `--check` to see whether it is current
 * (offline; with `--fetch` it fetches the source and compares fully).
 *
 * The slice is the configuration management controls IFCCM cites (CM-2, CM-3, CM-4, CM-5, CM-9) and the ones the workspace and quality specifications cite (CM-6, CM-7, CM-8,
 * CM-10, SA-10, SI-7, IA-5).
 *
 * @module
 */
export const manifest = {
  standard: {
    id: "nist-sp-800-53",
    issuer: "National Institute of Standards and Technology",
    name: "NIST SP 800-53 Rev. 5.2.0 (OSCAL catalog)",
    version: "5.2.0",
    location:
      "https://raw.githubusercontent.com/usnistgov/oscal-content/f0de6d8d8c059d374f15e0ae07508d82e370fc1d/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json",
    license: "Public domain (a work of the United States Government, 17 U.S.C. 105)",
    redistributable: true,
    sha256: "64ca6b4161de51ab6af098a7d101d326f14c95e1abf721396cd8a049e8115eeb",
  },
  source:
    "https://raw.githubusercontent.com/usnistgov/oscal-content/f0de6d8d8c059d374f15e0ae07508d82e370fc1d/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json",
  // the URL that always serves the newest release: only `newer.ts` reads it (0018-standards-first FR-014); an import never does (0019-mizan-integrations FR-014)
  latest: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json",
  format: "oscal-catalog",
  slice: ["cm-2", "cm-3", "cm-4", "cm-5", "cm-6", "cm-7", "cm-8", "cm-9", "cm-10", "sa-10", "si-7", "ia-5"],
  out: "../../../ontology/src/standards/nist-sp-800-53/controls.auto.ts",
  provOut: "nist-sp-800-53.auto.prov.ttl",
  rdfImport: "@intellectual-frontiers/rdf",
} as const;
