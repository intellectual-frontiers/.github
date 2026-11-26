// Spec: 0001-telemetry FR-026
/**
 * The typed facts of Telemetry, an independent library of commons (commons 0027-commons-libraries): OpenTelemetry-native signals written from the specification itself. Its specification is in its own spec kit
 * (`spec-kit/`, `0001-telemetry`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library by concern (0032-libraries-by-concern).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Telemetry. */
export const about: About = {
  title: "Telemetry",
  summary:
    "The OpenTelemetry data model, W3C Trace Context, OTLP/HTTP JSON (`otel`, `otlp`), typed signals declared once with spans, log events and metrics (`signals`), and a pure reducer that renders them for a terminal " +
    "(`render`); and, in `host`, the exporter over `fetch` with its journal and its probe, the pipeline a process installs, and the console that writes for a person. It uses no OpenTelemetry package. " +
    "Published to npm as compiled modules with their declarations; it depends on Core, Formats, Terminal and System.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the table of semantic conventions as data, with its version.", mayImport: ["nothing"] },
    {
      path: "src/logical/",
      what: "Layer 2: the pure modules (`otel`, `otlp`, `signals`, `render`, `queue`, `envelope`, `exporter`, `query`).",
      mayImport: ["core, crypto, formats, lang-sql and terminal, by package name"],
    },
    {
      path: "src/physical/",
      what: "Layer 3: the host: the exporter, the journal, the installed pipeline, the receiver and the console, with `mod.ts` as its entry.",
      mayImport: ["node: builtins", "governance and logical, by package name", "core, formats and system, by package name"],
    },
    { path: "src/", what: "`mod.ts`, the entry that names the pure modules as namespaces.", mayImport: ["src/"] },
    {
      path: "suite/",
      what: "The tests: the model, the encoding, the signals, the renderer, the exporter against servers the tests start, the console as a child process, and the conformance with the OpenTelemetry Collector.",
      mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
