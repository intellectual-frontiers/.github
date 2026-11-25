// Spec: 0001-workload-layers FR-001
/**
 * The typed facts of Workload, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it as one requirement of
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Workload. */
export const about: About = {
  title: "Workload",
  summary: "Workload: units of operated work (not running software) as typed data of a form, a runbook being one form, with effects, autonomy derived from them, static checks and projections for each harness and for auditors; a Kanon pattern with a governance core, forms as logical modules and executors behind ports.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1, the core: what a workload is, as data and types, and the contract of a form. It imports no form.", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "Layer 2, shared: the pure functions every form uses (autonomy, checks, the dry run, projections, the choice of a dialect). It imports no form.", mayImport: ["governance, by package name", "core, by package name"] },
    { path: "src/logical/forms/", what: "Layer 2, one folder for each form (runbook, reconcile): its nodes, its checks, its dry run and its fold. A form imports no other form.", mayImport: ["governance and shared logical, by package name", "core, by package name"] },
    { path: "src/physical/", what: "Layer 3: the executor of each form behind a port, the attachment of stores and the command.", mayImport: ["governance, logical and the forms, by package name", "core and the system, by package name"] },
    { path: "src/physical/dialects/", what: "Layer 3: one folder for each dialect, a harness or a person, that renders the views of workloads.", mayImport: ["governance and logical, by package name"] },
    { path: "suite/", what: "The tests: every requirement.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
