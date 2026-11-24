// Spec: 0004-anyfs-cli-surfaces FR-015
/**
 * The program `anyfs` as Headless' tree (commons anyfs-cli 0004-anyfs-cli-surfaces FR-015; commons headless 0003-headless-output, 0009-composition, 0010-audience-tiers, 0013-mcp-surface): its verbs and the facts of their
 * actions, their options, operands and examples, and the data Headless configures itself with (the name and version, the prefix of the variables, the codes it explains, the tiers). This is the one place the tree is made;
 * the command line runs it, the tool server serves it by tier (`anyfs mcp`), and anything that describes a program (a documentation lens, the REST description) reads it. A tool server lets an agent browse and move
 * files across stores with the same typed operations and the same reach policy: it sees only what its tier sees, and a destruction from it is a preview, never an apply.
 *
 * @example
 * ```ts
 * import { anyfsProgram, INERT_HOST } from "@intellectual-frontiers/anyfs-cli/physical";
 * anyfsProgram(INERT_HOST).name; // "anyfs"
 * ```
 *
 * @module
 */
import { err } from "@intellectual-frontiers/core";
import { serve, stdioTransport } from "@intellectual-frontiers/headless/mcp";
import { hostIo, run as runCli } from "@intellectual-frontiers/headless/cli";
import { problem, type TierName } from "@intellectual-frontiers/headless/governance";
import { command, type Node, outcomeOf, type Program, programOf } from "@intellectual-frontiers/headless/logical";
import type { RunLocal } from "@intellectual-frontiers/headless/targets/ssh";
import { output } from "@intellectual-frontiers/system/proc";
import { ANYFS_CLI_VERSION, CATALOGUE, LADDER, tierOf } from "@intellectual-frontiers/anyfs-cli/governance";
import { EMPTY_CONFIG, type Host } from "@intellectual-frontiers/anyfs-cli/logical";
import { bridgeVerbs } from "./verbs/bridge.ts";
import { mergeVerbs } from "./verbs/merge.ts";
import { traitsOf } from "./verbs/common.ts";
import { readVerbs } from "./verbs/read.ts";
import { keyVerbs } from "./verbs/keys.ts";
import { serveVerbs } from "./verbs/serve.ts";
import { setupVerbs } from "./verbs/setup.ts";
import { writeVerbs } from "./verbs/write.ts";

/** A host that does nothing: the tree of a program is made from it without opening anything, and `describe` never runs a verb. */
export const INERT_HOST: Host = {
  env: () => undefined,
  config: EMPTY_CONFIG,
  world: {
    cwd: "/",
    stateDir: "/nonexistent-anyfs-state",
    json: false,
    open: () => Promise.resolve(err({ code: "E-ENVIRONMENT", message: "the program is only described: no store is opened" })),
    local: (path) => ({ root: "/", inner: path.startsWith("/") ? path : `/${path}` }),
    readStdin: () => Promise.resolve(new Uint8Array()),
    writeStdout: () => undefined,
    readLocalFile: () => Promise.resolve(err("the program is only described")),
    state: { read: () => Promise.resolve(undefined), write: () => Promise.resolve() },
    notice: () => undefined,
  },
};

/** The held tier of a host: the one the variable names, the ladder's default where it says nothing, or the word that is no tier. */
export function heldTier(env: (name: string) => string | undefined): { readonly tier: TierName } | { readonly unknown: string } {
  const word = env("ANYFS_TIER");
  if (word === undefined || word === "") return { tier: LADDER.default };
  const tier = tierOf(word);
  return tier === undefined ? { unknown: word } : { tier };
}

const systemRun: RunLocal = (argv, opts) => output(argv, opts);

/** `anyfs` as a Headless program, for the host it runs on. */
export function anyfsProgram(host: Host, run: RunLocal = systemRun): Program {
  const verbs: readonly Node[] = [...readVerbs(host), ...writeVerbs(host), ...bridgeVerbs(host), ...mergeVerbs(host), ...serveVerbs(host), ...keyVerbs(host), ...setupVerbs(host, run)];
  const mcp = command({
    name: "mcp",
    summary: "Serve the verbs the held tier sees as tools of a tool server on standard input and output.",
    options: {},
    examples: [{ args: [], says: "Serve the tools of the tier the host holds (ANYFS_TIER=reader serves only what reads)." }],
    action: traitsOf("places"),
    run: async () => {
      const held = heldTier(host.env);
      if ("unknown" in held) return outcomeOf(null, { problems: [problem("fail", `${held.unknown} is not a tier`, { code: "E-USAGE", fix: "ANYFS_TIER=reader or writer" })] });
      // standard output is the protocol's: a call's output is given back to the caller, never written there, and a call keeps no log of its own
      const { sink: _sink, state: _state, ...io } = hostIo();
      await serve({ program, tier: held.tier, mayOnlyRead: (host.env("ANYFS_READ_ONLY") ?? "") !== "", run: (argv) => runCli(program, argv, { ...io, tier: held.tier, env: (n) => host.env(n) }) }, stdioTransport());
      return outcomeOf(null);
    },
  });
  const program: Program = programOf({
    name: "anyfs",
    summary: "POSIX-style access to any AnyFS store: ls, cat, cp, rm, find, grep and diff over a folder, a host reached by SSH or whatever a library brings, and sync, bisync and mirror between them, with every operation saying how it was carried out and every destruction a plan first.",
    version: ANYFS_CLI_VERSION,
    children: [...verbs, mcp],
    envPrefix: "ANYFS",
    stateApp: "anyfs",
    catalogue: CATALOGUE,
    fix: { commands: ["anyfs", "ssh", "bun"], own: ["anyfs"] },
    secrets: () => [],
    secretKeys: [],
    tiers: LADDER,
  });
  return program;
}
