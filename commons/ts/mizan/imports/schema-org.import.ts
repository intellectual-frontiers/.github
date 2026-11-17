/**
 * The import of the slice of schema.org that the packaging ontology specializes (commons 0019-mizan-integrations FR-005, FR-006, FR-009, FR-014): its source is fetched from the
 * versioned URL and held to the SHA-256 pinned here, so that what `schema.auto.ts` says rests on bytes that cannot change unseen, and its provenance is `schema-org.auto.prov.ttl`
 * beside this file. Run `bun commons/ts/mizan/integrations/host/import.ts commons/ts/mizan/imports/schema-org.import.ts` to write the module again, with `--check` to see whether
 * it is current (offline; with `--fetch` it fetches the source and compares fully).
 *
 * @module
 */
export const manifest = {
  standard: {
    id: "schema-org",
    issuer: "Schema.org Community Group",
    name: "schema.org",
    version: "30.1",
    location: "https://schema.org/version/30.1/schemaorg-current-https.ttl",
    license: "CC-BY-SA-3.0",
    redistributable: true,
    sha256: "7f15ca89398c4f235f478a4b3b8d1f975d63c5a860b77c8a8fce01f791b7ae2f",
  },
  source: "https://schema.org/version/30.1/schemaorg-current-https.ttl",
  // the URL that always serves the newest version: only `newer.ts` reads it (0018-standards-first FR-014); an import never does (0019-mizan-integrations FR-014)
  latest: "https://schema.org/version/latest/schemaorg-current-https.ttl",
  format: "turtle",
  namespace: { prefix: "schema", iri: "https://schema.org/" },
  slice: ["Action", "SoftwareApplication", "Thing", "name", "operatingSystem", "processorRequirements", "softwareVersion"],
  out: "../../../ontology/supply-chain/packaging/schema.auto.ts",
  provOut: "schema-org.auto.prov.ttl",
  rdfImport: "../../../ts/kernel/rdf.ts",
} as const;
