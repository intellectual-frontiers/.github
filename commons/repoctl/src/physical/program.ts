// Spec: 0006-repoctl-surfaces FR-001
/**
 * The program `repoctl` as Headless' tree (commons repoctl 0006-repoctl-surfaces FR-001 to FR-005; commons headless 0003-headless-output, 0009-composition, 0010-audience-tiers, 0013-mcp-surface): its verbs and branches, each declared with the
 * facts of its action, its options, operands and examples, and the data Headless configures itself with (the name and version, the prefix of the variables, the codes it explains, the secrets it redacts, the tiers). `repoctlProgram(host)` is
 * the one place the tree is made; the command line runs it (`repoctl.ts`), the tool server serves it by tier (`repoctl mcp`), and anything that describes a program (a documentation lens) reads it.
 *
 * @example
 * ```ts
 * import { INERT_HOST, repoctlProgram } from "@intellectual-frontiers/repoctl/physical";
 * repoctlProgram(INERT_HOST).name; // "repoctl"
 * ```
 *
 * @module
 */
import { err } from "@intellectual-frontiers/core";
import { serve, stdioTransport } from "@intellectual-frontiers/headless/mcp";
import { hostIo, run as runCli } from "@intellectual-frontiers/headless/cli";
import { problem, type TierName } from "@intellectual-frontiers/headless/governance";
import { branch, command, type Node, outcomeOf, type Program, programOf } from "@intellectual-frontiers/headless/logical";
import { CATALOGUE, LADDER, REPOCTL_VERSION, tierOf, type Config } from "@intellectual-frontiers/repoctl/governance";
import { NPM_TOKEN_VARIABLE } from "./adapters.ts";
import { type Host, traitsOf } from "./define.ts";
import { describedConfig } from "./config-load.ts";
import { checkVerb, doctorVerb, hygieneVerb, statusVerb } from "./verbs/check.ts";
import { docsBuildVerb, docsCheckVerb, docsServeVerb } from "./verbs/docs.ts";
import { commitVerb, newLibraryVerb } from "./verbs/library.ts";
import { proveVerb } from "./verbs/prove.ts";
import { releaseApplyVerb, releasePlanVerb, releasePublishVerb } from "./verbs/releasing.ts";
import { mergeVerb, syncVerb } from "./verbs/sync.ts";

/** A host that does nothing: the tree of a program is made from it without reading anything, and `describe` never runs a verb. Its configuration is the bare one, so the verbs of every repository are in the tree; a repository's capabilities add theirs. */
export const INERT_HOST: Host = { env: () => undefined, world: () => err("the program is only described: there is no checkout"), config: describedConfig() };

/** The held tier of a host: the one the configuration's variable names, the ladder's default where it says nothing, or the word that is no tier. */
export function heldTier(env: (name: string) => string | undefined, config: Pick<Config, "tierVariable">): { readonly tier: TierName } | { readonly unknown: string } {
  const word = env(config.tierVariable);
  if (word === undefined || word === "") return { tier: LADDER.default };
  const tier = tierOf(word);
  return tier === undefined ? { unknown: word } : { tier };
}

/** `repoctl` as a Headless program, for the host it runs on. */
export function repoctlProgram(host: Host): Program {
  const on = host.config.capabilities;
  const verbs: readonly Node[] = [
    checkVerb(host),
    syncVerb(host),
    mergeVerb(host),
    ...(on.status ? [statusVerb(host)] : []),
    ...(host.config.hygiene === undefined ? [] : [hygieneVerb(host)]),
    ...(on.release ? [branch({ name: "release", summary: "Plan a release of the libraries, make it, and send it to npm.", children: [releasePlanVerb(host), releaseApplyVerb(host), releasePublishVerb(host)] })] : []),
    ...(on.newLibrary ? [branch({ name: "new", summary: "Make something new in the repository.", children: [newLibraryVerb(host)] })] : []),
    commitVerb(host),
    doctorVerb(host),
    ...(on.prove ? [proveVerb(host)] : []),
    ...(host.config.docs === undefined ? [] : [branch({ name: "docs", summary: "Build, check and serve the documentation site with the documentation generator.", children: [docsBuildVerb(host), docsCheckVerb(host), docsServeVerb(host)] })]),
  ];
  const mcp = command({
    name: "mcp",
    summary: "Serve the verbs the held tier sees as tools of a tool server on standard input and output.",
    options: {},
    examples: [{ args: [], says: "Serve the tools of the tier the host holds (REPOCTL_TIER; REPOCTL_READ_ONLY=1 serves only what reads)." }],
    action: traitsOf("mcp"),
    run: async () => {
      const held = heldTier(host.env, host.config);
      if ("unknown" in held) return outcomeOf(null, { problems: [problem("fail", `${held.unknown} is not a tier`, { code: "E-USAGE", fix: "REPOCTL_TIER=public, contributor or releaser" })] });
      // standard output is the protocol's: a call's output is given back to the caller, never written there, and a call keeps no log of its own
      const { sink: _sink, state: _state, ...io } = hostIo();
      await serve({ program, tier: held.tier, mayOnlyRead: (host.env(host.config.readOnlyVariable) ?? "") !== "", run: (argv) => runCli(program, argv, { ...io, tier: held.tier, env: (n) => host.env(n) }) }, stdioTransport());
      return outcomeOf(null);
    },
  });
  const program: Program = programOf({
    name: "repoctl",
    summary: "The operations program of a repository, driven by its repoctl.config.ts: it makes the generated files, merges, checks, commits and says what is wrong with a checkout, and where the configuration turns them on tells the versions, releases, scaffolds a library, proves a change and builds the documentation.",
    version: REPOCTL_VERSION,
    children: [...verbs, mcp],
    envPrefix: "REPOCTL",
    stateApp: "repoctl",
    catalogue: CATALOGUE,
    fix: { commands: ["repoctl", "bun", "git", "npm", "cd"], own: ["repoctl"] },
    secrets: () => {
      const token = host.env(NPM_TOKEN_VARIABLE);
      return token === undefined || token === "" ? [] : [token];
    },
    secretKeys: [NPM_TOKEN_VARIABLE],
    tiers: LADDER,
  });
  return program;
}
