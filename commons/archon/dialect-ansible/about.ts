// Spec: 0001-ansible-layers FR-001
/**
 * The typed facts of the dialect that converges a Linux host with Ansible, a library of commons and a dialect of Archon. Its specification is in its own spec kit (`spec-kit/`, `0001-ansible-layers` and
 * `0002-ansible-dialect`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The dialect for Ansible. */
export const about: About = {
  title: "Archon dialect: Ansible",
  summary:
    "The dialect of Archon that converges a Linux host with Ansible: it renders an order and its plan to a generated inventory, configuration and playbook of the modules of ansible-core, gives the steps that check with the difference and apply, and says what it guarantees as data. " +
    "A package on the port of Archon; the tool runs on the machine that converges itself.",
  folders: [
    { path: "spec-kit/", what: "The package's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "Layer 3: the dialect: its guarantees, its render and its steps.", mayImport: ["archon, by its exports"] },
    { path: "suite/", what: "The tests: every requirement, with made-up commands.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
