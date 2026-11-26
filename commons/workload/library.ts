// Spec: 0001-workload-layers FR-001
/**
 * The manifest of Workload, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`. The forms are instances of a logical unit, so that a form imports the core and the shared logical layer and never another form, and the core and the shared logical layer
 * import no form.
 *
 * @module
 */
export const library = {
  name: "workload",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  maturity: "stable",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./physical", "./forms/runbook", "./forms/reconcile", "./forms/graph", "./dialects/claude-code", "./dialects/codex", "./dialects/human", "./runners/bash", "./runners/pwsh", "./runners/github-actions"],
  summary: "Workload: units of operated work (not running software) as typed data of a form, a runbook being one form, with effects, autonomy derived from them, static checks and projections for each harness and for auditors; a Kanon pattern with a governance core, forms as logical modules and runners behind ports.",
  kanon: {
    package: "@intellectual-frontiers/workload",
    units: [
      {
        folder: "src/governance/",
        layer: "governance",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/grc", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/planning", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/workbench", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/grc", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/planning", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/workload", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/workbench", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/logical/forms/",
        layer: "logical",
        instances: true,
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/grc", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/planning", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/workload", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/workbench", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/physical/dialects/",
        layer: "physical",
        instances: true,
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/workload", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/physical/runners/",
        layer: "physical",
        instances: true,
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/libraries", subpaths: ["workflows/model", "workflows/render"] },
          { name: "@intellectual-frontiers/workload", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/", "src/logical/forms/", "src/physical/dialects/", "src/physical/runners/"],
        packages: [
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/planning", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
          { name: "@intellectual-frontiers/workbench", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/workload", subpaths: ["governance", "logical", "forms/runbook", "forms/reconcile", "forms/graph", "dialects/claude-code", "dialects/codex", "dialects/human", "runners/bash", "runners/pwsh", "runners/github-actions"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
