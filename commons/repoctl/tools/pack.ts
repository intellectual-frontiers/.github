// Spec: 0006-repoctl-surfaces FR-006
/**
 * The package that is published (commons repoctl 0006-repoctl-surfaces FR-006, commons 0027-commons-libraries FR-015, FR-016, commons 0032-lifting-libraries FR-005, FR-013): `bun tools/pack.ts` packs the command and the library API of
 * Repoctl through the packer of commons. The command is one bundled file with commons' kernel, runtime and the libraries it calls inside it (`bin: repoctl`); the library API is the entry `.` of the package, one bundled file of code with
 * the declarations of what the entry reaches (`types`). The `package.json` of this folder stays private, so that nothing is published from it by hand.
 *
 * ```sh
 * bun tools/pack.ts            build, inspect and pack
 * bun tools/pack.ts --check    the same, saying so where nothing is wrong
 * ```
 *
 * @module
 */
import process from "node:process";
import { type PackOptions, main, packLibrary, type Packed } from "@intellectual-frontiers/libraries/pack";
import { path } from "@intellectual-frontiers/system";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

/** The README that is published. */
const README = [
  "# Repoctl",
  "",
  "The operations program of the repository of Intellectual Frontiers Commons: one command, `repoctl`, that operates a checkout of it.",
  "",
  "```sh",
  "bun run repoctl check      # every check of the repository in one report, with codes for `repoctl explain`",
  "bun run repoctl sync       # every generated file, in dependency order, only the stale ones",
  "bun run repoctl commit -m \"Subject\" --refs 10",
  "bun run repoctl release plan",
  "```",
  "",
  "Every verb says what it may change (`--dry-run` shows it, `--check` checks it, `--yes` confirms a destruction), writes its report on standard output and its problems and the one `next:` command on standard error, and ends in the statuses 0 ok, 1 findings, 2 usage, 3 environment. `repoctl mcp` serves the verbs as tools of a tool server, by the audience tier the host holds (`REPOCTL_TIER`: public, contributor, releaser).",
  "",
  "The sources and the specifications are in https://github.com/intellectual-frontiers/.github/tree/main/commons/repoctl",
  "",
].join("\n");

/** How the package is made: the command and the API are bundles, `types` are the declarations of what the entry reaches. */
export const PACK: PackOptions = {
  types: ["node"],
  bundle: {
    bin: { repoctl: "bin/main.ts" },
    readme: README,
    keywords: ["repository", "monorepo", "generated-files", "release", "developer-tools"],
  },
};

/** Builds, inspects and packs the package of this library. */
export const pack = (): Promise<Packed> => packLibrary(ROOT, PACK);

if (import.meta.main) process.exitCode = await main(ROOT, process.argv.slice(2), PACK);
