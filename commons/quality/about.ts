// Spec: 0001-quality-evidence FR-001
/**
 * The typed facts of Quality, an independent library of commons (commons 0027-commons-libraries): the quality system. Its specification is in its own spec kit (`spec-kit/`, `0001-quality-evidence`); this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library of the lift of `commons/ts` (0032-lifting-libraries).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Quality. */
export const about: About = {
  title: "Quality",
  summary:
    "The run of a suite of tests as evidence (one OTLP record of the run, its reports as TAP, JUnit, CTRF, SARIF, OSCAL and the documents of ISO/IEC/IEEE 29119-3, and its signed ledger entry), the canonical record of a run " +
    "(`not_run`, the grade E0 to E5, CTRF case bodies) and its renderings, the append-only `quality` branch with its notes and the verifier that walks them, the evidence ladder, freshness, nonconformances and CAPA, objectives, " +
    "the tiers, and the Trust page and the signed assessor pack made from the evidence. It depends on core, crypto, formats, mizan, system, telemetry, terminal and test, and is published to npm as compiled modules with their declarations.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The model of a run (`test-report.ts`), the commands (`quality.ts`, `commands.ts`, `tier2-commands.ts`, `test-cli.ts`), the pure layer (`pure/`), the host layer that runs `git` and reads files (`host/`), and `trust/`, `assessor/` and `attestation/`.",
      mayImport: ["node: builtins", "src/", "core, crypto, formats, mizan, system, telemetry, terminal and test, by package name"],
    },
    {
      path: "suite/",
      what: "The tests of the library, which run a real `git` and, where it is installed, the real `ssh-keygen`.",
      mayImport: ["src/", "the packages above, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
