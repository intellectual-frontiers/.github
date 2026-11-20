// Spec: 0010-repoctl-docs FR-001
/**
 * The documentation verbs' reasoning (commons repoctl 0010-repoctl-docs FR-001 to FR-004): what `repoctl docs build`, `serve` and `check` ask of the documentation generator `ifc-docs` of `@intellectual-frontiers/docs`, as arguments of its command
 * line, and what a missing generator or a failed run is as a finding. The generator is not carried by repoctl: the Physical layer loads it by its package name where it is installed, through the port below, and a test fills the port with its own.
 *
 * @example
 * ```ts
 * import { docsArguments } from "./docs.ts";
 * docsArguments("build", { config: "docs.config.ts", out: "_site" }, "/r"); // ["build", "--out", "/r/_site", "--config", "/r/docs.config.ts"]
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { DocsSettings } from "@intellectual-frontiers/repoctl/governance";
import { finding, type Finding } from "./findings.ts";

/** The command line of the generator `ifc-docs` is the program's `main`: its arguments to the status it ends with. */
export type DocsGenerator = { readonly main: (argv: readonly string[]) => Promise<number> };

/** The port that loads the generator from the repository's own dependencies, or says why it cannot. */
export type DocsPort = { readonly load: (repo: string) => Promise<Result<DocsGenerator, string>> };

/** What the generator is asked: build into a folder, or check. */
export type DocsAsk = "build" | "check";

/** The arguments of the generator for a request: `build` writes into the folder given (the settings' by default), `check` writes nothing; both read the settings' configuration file. Paths are made absolute from the repository's root. */
export function docsArguments(ask: DocsAsk, settings: DocsSettings, repo: string, out?: string): readonly string[] {
  const config = `${repo}/${settings.config}`;
  return ask === "build" ? ["build", "--out", out ?? `${repo}/${settings.out}`, "--config", config] : ["check", "--config", config];
}

/** The finding of a generator that is not installed. */
export function missingGenerator(why: string): Finding {
  return finding("fail", "E-DOCS-GENERATOR-MISSING", `the documentation generator is not installed: ${why}`, "bun add --dev @intellectual-frontiers/docs");
}

/** The finding of a generator that ended with a status other than 0. */
export function failedGenerator(ask: DocsAsk | "serve", status: number): Finding {
  return finding("fail", "E-DOCS-FAILED", `the documentation generator ended with ${status} while it ${ask === "check" ? "checked" : "built"} the site`, "repoctl docs check");
}
