// Spec: 0001-desired-os-state-layers FR-001
/**
 * The typed facts of Desired OS State, an independent library of commons (commons 0027-commons-libraries): what a subject must be, the order and plan made from it, and the port of the dialects.
 * Its specification is in its own spec kit (`spec-kit/`, `0001-desired-os-state-layers` to `0004-desired-os-state-dialects`); this repository knows it as one requirement of 0027-commons-libraries, proved by
 * `bun run verify` in this folder. The decisions that made it are commons 0034-desired-os-state.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Desired OS State. */
export const about: About = {
  title: "Desired OS State",
  summary:
    "A Kanon library that orders subjects: a machine, a device, a workstation or a cloud account. GOVERNANCE: requirements (what must hold, why, for whom, of which kind of resource, how much a change to it matters, how it is verified), the catalogue of kinds, the guard against a secret in a model and the assurance profiles (solo, team, regulated) with the floor that none lowers. " +
    "LOGICAL: the order of a subject from layers of requirements, and the plan between what is observed and the order (workload's diff and hash), the order as a workload of the reconcile form, and the approvals that are Desired OS State's and not workload's. PHYSICAL: the port that a dialect (Ansible, OpenTofu, Microsoft DSC) implements, the matrix of what each expresses, and the plan of steps for the executor of headless. " +
    "It builds no convergence engine: the tools are the engines.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: identities, kinds, requirements, the guard against a secret, the assurance of a fleet.", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "Layer 2: the order, the plan, the approvals a plan needs.", mayImport: ["governance, by package name", "core and the digest of crypto, by package name"] },
    { path: "src/physical/dialect/", what: "Layer 3: the port of the dialects, what each expresses, the plan of steps for the executor.", mayImport: ["governance and logical, by package name", "core, crypto and the logical layer of headless, by package name"] },
    { path: "suite/", what: "The tests: every requirement and properties.", mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
