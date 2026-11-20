// Spec: 0001-test FR-007
/**
 * The typed facts of Test, an independent library of commons (commons 0027-commons-libraries): tests as evidence. Its specification is in its own spec kit (`spec-kit/`, `0001-test`); this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library of the lift of `commons/ts` (0032-lifting-libraries).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Test. */
export const about: About = {
  title: "Test",
  summary:
    "Tests that run unchanged under `bun test` and `node --test`: registration on `node:test`, the assertions under short plain names, `proves`, which names the requirements a test proves and keeps them for a report, " +
    "`only` and steps. Every test is recorded by this library's own code, not by a runner's reporter: its id, file, requirements, risk, times, outcome and reason, as an OpenTelemetry span and log record on the " +
    "installation record, appended to `IFC_TEST_RECORD` as OTLP JSON lines (`record`). It depends on core, crypto, system and telemetry. Published to npm as compiled modules with their declarations.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "`test.ts`, the registration and the assertions, and `record.ts`, the pure model of a test's record and its OpenTelemetry form.",
      mayImport: ["node: builtins", "src/", "core, crypto, system and telemetry, by package name"],
    },
    {
      path: "suite/",
      what: "The tests of the library, run on its own runner and in child processes where `only` and steps must fail.",
      mayImport: ["src/", "the kernel of commons for the reports of a record, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
