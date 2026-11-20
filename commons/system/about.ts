// Spec: 0001-system FR-020
/**
 * The typed facts of System, an independent library of commons (commons 0027-commons-libraries): the host as one typed library. Its specification is in its own spec kit (`spec-kit/`, `0001-system`);
 * this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library of the lift of `commons/ts` (0032-lifting-libraries).
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** System. */
export const about: About = {
  title: "System",
  summary:
    "The host as one typed library, the same on Bun and Node 26 and on Windows, macOS and Linux: typed errors (`errors`), files (`fs`), paths (`path`) and the folders a program keeps its files in (`dirs`), one run at a time (`lock`), " +
    "file watching (`watch`), programs found by the prefix of their name (`discover`), the process and the programs it runs (`proc`), Git read by running it (`git`), a program built into one binary (`compile`), " +
    "the operating system's scheduled jobs planned (`jobPlan`) and installed (`jobs`), and the terminal's streams (`tty`, `stdio`). It depends on core, formats and crypto, and on no telemetry: " +
    "the telemetry of commons installs the function that traces the programs `proc` runs. Published to npm as compiled modules with their declarations.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The modules, and `mod.ts`, the entry that names them as namespaces.",
      mayImport: ["node: builtins", "src/", "core, formats and crypto, by package name"],
    },
    {
      path: "suite/",
      what: "The tests: every call on a real temporary folder, real programs and a real Git, the refusals and the platform's rules, with properties and type-level tests.",
      mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
