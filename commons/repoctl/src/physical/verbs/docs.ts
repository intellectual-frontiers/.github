// Spec: 0011-repoctl-docs FR-001
/**
 * `repoctl docs build`, `serve` and `check` on Headless (commons repoctl 0011-repoctl-docs FR-001 to FR-005): the verbs that wrap the documentation generator `ifc-docs` of `@intellectual-frontiers/docs`, which a repository installs beside repoctl
 * and which is loaded where it is, by its package name, never carried. `build` writes the site into the folder the configuration's `docs.out` names, `check` builds it into a temporary folder and says every finding, and `serve` builds it and serves it
 * on a loopback port of this computer until it is stopped. Nothing is uploaded anywhere.
 *
 * @example
 * ```ts
 * import { docsBuildVerb } from "@intellectual-frontiers/repoctl/physical";
 * typeof docsBuildVerb; // "function"
 * ```
 *
 * @module
 */
import { failedGenerator, docsArguments, missingGenerator, type Finding, type DocsAsk, type World } from "@intellectual-frontiers/repoctl/logical";
import type { DocsSettings } from "@intellectual-frontiers/repoctl/governance";
import { value } from "@intellectual-frontiers/terminal/args";
import { type Host, defineVerb, outcomeOfDone, outcomeOfEnvironment, outcomeOfUsage } from "../define.ts";
import { serveFolder } from "../adapters.ts";

/** Runs the generator for a request: the findings (none where it ended with 0). */
async function ask(w: World, what: DocsAsk, settings: DocsSettings, out?: string): Promise<readonly Finding[]> {
  const generator = await w.docs.load(w.repo);
  if (generator.kind === "err") return [missingGenerator(generator.error)];
  const status = await generator.value.main(docsArguments(what, settings, w.repo, out));
  return status === 0 ? [] : [failedGenerator(what, status)];
}

const settingsOf = (host: Host): DocsSettings | undefined => host.config.docs;

/** `repoctl docs build`. */
export const docsBuildVerb = defineVerb({
  name: "build",
  id: "docs build",
  options: { out: value<never>({ help: "The folder to build into (the configuration's docs.out by default).", valueName: "DIR" }) },
  examples: [
    { args: [], says: "Build the site into the folder the configuration names." },
    { args: ["--dry-run"], says: "Say what the generator would be asked, and build nothing." },
  ],
  run: async (args, ctx, w, host) => {
    const settings = settingsOf(host);
    if (settings === undefined) return outcomeOfEnvironment("this repository's configuration has no docs settings");
    const out = args.options.out === undefined ? undefined : `${w.repo}/${args.options.out}`;
    const argv = docsArguments("build", settings, w.repo, out);
    if (ctx.mode !== "apply") return outcomeOfDone({ data: { argv }, text: `would run ifc-docs ${argv.join(" ")}`, findings: [], title: "Previewed" });
    const findings = await ask(w, "build", settings, out);
    return outcomeOfDone({ data: { out: out ?? `${w.repo}/${settings.out}` }, text: findings.length === 0 ? `built ${out ?? `${w.repo}/${settings.out}`}` : "the site was not built", findings, next: findings.length === 0 ? ["repoctl docs serve"] : [findings[0]?.fix ?? "repoctl doctor"], title: "Site built" });
  },
});

/** `repoctl docs check`. */
export const docsCheckVerb = defineVerb({
  name: "check",
  id: "docs check",
  options: {},
  examples: [{ args: [], says: "Build the site into a temporary folder and say every finding; nothing is written in the repository." }],
  run: async (_args, _ctx, w, host) => {
    const settings = settingsOf(host);
    if (settings === undefined) return outcomeOfEnvironment("this repository's configuration has no docs settings");
    const findings = await ask(w, "check", settings);
    return outcomeOfDone({ data: { ok: findings.length === 0 }, text: findings.length === 0 ? "the site has no finding" : "the site has findings (above)", findings, title: "The documentation has no finding" });
  },
});

/** `repoctl docs serve`. */
export const docsServeVerb = defineVerb({
  name: "serve",
  id: "docs serve",
  options: {
    port: value<never>({ help: "The loopback port to serve on (0 lets the system choose).", valueName: "PORT", default: "4173" }),
    for: value<never>({ help: "Stop after this many seconds (else it serves until it is interrupted).", valueName: "SECONDS" }),
  },
  examples: [
    { args: [], says: "Build the site and serve it on http://127.0.0.1:4173/ until Ctrl-C." },
    { args: ["--port", "0", "--for", "30"], says: "Serve on a port the system chooses, and stop after 30 seconds." },
  ],
  run: async (args, ctx, w, host) => {
    const settings = settingsOf(host);
    if (settings === undefined) return outcomeOfEnvironment("this repository's configuration has no docs settings");
    const port = Number(args.options.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) return outcomeOfUsage(`${args.options.port} is not a port`, "E-USAGE", "repoctl docs serve --help");
    const seconds = args.options.for === undefined ? undefined : Number(args.options.for);
    if (seconds !== undefined && (!Number.isFinite(seconds) || seconds < 0)) return outcomeOfUsage(`${args.options.for} is not a number of seconds`, "E-USAGE", "repoctl docs serve --help");
    if (ctx.mode !== "apply") return outcomeOfDone({ data: { port }, text: `would build the site and serve ${w.repo}/${settings.out} on 127.0.0.1:${port}`, findings: [], title: "Previewed" });
    const built = await ask(w, "build", settings);
    if (built.length > 0) return outcomeOfDone({ data: null, text: "the site was not built, so nothing is served", findings: built });
    const server = await serveFolder(`${w.repo}/${settings.out}`, port);
    process.stderr.write(`serving ${server.url} (this computer only; Ctrl-C stops it)\n`);
    await new Promise<void>((resolve) => {
      if (seconds !== undefined) setTimeout(resolve, seconds * 1000);
      else process.once("SIGINT", () => resolve());
    });
    await server.close();
    return outcomeOfDone({ data: { url: server.url }, text: `served ${server.url}`, findings: [], title: "Served" });
  },
});
