// Spec: 0033-kanon FR-010
/**
 * The table of the example library `reminders` (commons 0033-kanon FR-010): its units, each in one layer, and what each may import. A library that is Kanon writes this as the field `kanon` of its manifest
 * `library.ts`; a package that only consumes the pattern writes it as `kanon.ts`, as here.
 *
 * @module
 */
export const kanon = {
  package: "@example/reminders",
  units: [
    { folder: "./", own: true },
    { folder: "src/governance/", layer: "governance" },
    { folder: "src/logical/", layer: "logical" },
    { folder: "src/physical/cli/", layer: "physical", mayImport: ["src/governance/", "src/logical/"] },
    { folder: "src/physical/tool/", layer: "physical", mayImport: ["src/governance/", "src/logical/"] },
  ],
};
