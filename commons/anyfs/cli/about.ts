// Spec: 0001-anyfs-cli-layers FR-001
/**
 * The typed facts of the AnyFS command line, an independent library of commons (commons 0027-commons-libraries) and a plugin of the family of AnyFS: the `anyfs` program. Its specification is its own spec kit
 * (`spec-kit/`, `0001-anyfs-cli-layers` to `0005-anyfs-cli-merge-signing`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The AnyFS command line. */
export const about: About = {
  title: "AnyFS command line",
  summary:
    "The `anyfs` program: POSIX-style access to any AnyFS store (ls, cat, cp, rm, find, grep, diff) and the bridge verbs (sync, bisync, mirror, check, merge, sync-medium), `serve` (WebDAV) and the keys of signed merges (keygen, roster) from the command line, a tool server and a REST description, with every operation saying how it was carried out and every destruction a plan first. `merge` and `sync-medium` take `--trust open|allowlist|signed` with a roster of keys and the keys to sign with, named by a file or by an environment variable and never by their text, or the same said by a mount.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the facts of the verbs, the tiers, the problem codes, and the grammar of a place on a command line.", mayImport: ["the kernel and the governance of AnyFS and Headless, by package name"] },
    { path: "src/logical/", what: "Layer 2: the configuration as code, the ports of the world, the pure functions of the verbs (formatting, a line diff, a text search, the trail of fidelity, the text of a plan).", mayImport: ["governance, by name", "the logical layers of AnyFS, its bridge, its POSIX view and Headless, by package name"] },
    { path: "src/physical/", what: "Layer 3: the openers of stores, the world of the process, the configuration loader, the verbs, and the program on Headless.", mayImport: ["governance and logical", "the packages of AnyFS and its plugins, Headless, the terminal and the system, by package name"] },
    { path: "bin/", what: "The `anyfs` command: a file that runs the program on Bun and on Node 26.", mayImport: ["the program of this library"] },
    { path: "suite/", what: "The tests: every requirement, the verbs against stores in a folder and in memory, plans with their hashes, the JSON envelopes, the exits and the tool server's model.", mayImport: ["everything of the library, and its test tools"] },
    { path: "tools/", what: "The trace check `bun run verify` runs.", mayImport: ["the kernel and the runtime of commons, by package name"] },
  ],
};
