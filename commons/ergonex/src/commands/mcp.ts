// Spec: 0006-agents FR-020, FR-021, FR-023, FR-036
/**
 * `ergonex mcp` (commons ergonex 0006-agents FR-020, FR-021, FR-023): the verbs of the program that the held tier may see, served as the tools of a tool server on standard input and output through
 * the surface of Headless (`serve`, `stdioTransport`, the revision `2025-06-18`). The tier is the lower of the tier the `agents` policy gives and `ERGONEX_TIER`; `--read-only` (or `ERGONEX_READ_ONLY`)
 * serves only what reads; a verb that changes something is reached by the local channel and so is not a tool at all, and a destructive one goes only as a preview. Every call runs as the persona
 * `agent`, so that the policy of FR-004 holds there too. Nothing but the protocol is written to standard output.
 *
 * @module
 */
import { DEFAULT_LADDER, defineReach, parseTierName, problem, type TierName } from "@intellectual-frontiers/headless/governance";
import { command, outcomeOf, type Command, type Program } from "@intellectual-frontiers/headless/logical";
import { hostIo, run as runCli } from "@intellectual-frontiers/headless/cli";
import { serve, stdioTransport } from "@intellectual-frontiers/headless/mcp";
import { flag } from "../platform/k-args.ts";
import { AREA, loopbackAllowed, readManifest } from "../host/workspace.ts";
import { existsSync } from "../platform/r-fs.ts";
import { join } from "../platform/r-path.ts";
import { AGENT_TIERS, lowerTier, tierOf } from "../agents/policy.ts";
import type { Host } from "./define.ts";

/** The tier of the server: the lower of the policy's and the environment's; or the word that is not a tier. */
export function serverTier(policyTier: string | undefined, envTier: string | undefined): { readonly tier: TierName } | { readonly unknown: string } {
  const fromPolicy = tierOf(policyTier) ?? "public";
  const word = envTier === undefined || envTier === "" ? undefined : envTier;
  const fromEnv = word === undefined ? undefined : tierOf(word);
  if (word !== undefined && fromEnv === undefined) return { unknown: word };
  const held = fromEnv === undefined ? fromPolicy : lowerTier(fromPolicy, fromEnv);
  const parsed = parseTierName(held);
  const tier = parsed.kind === "ok" ? DEFAULT_LADDER.ladder.find((t) => t === parsed.value) : undefined;
  return tier === undefined ? { unknown: held } : { tier };
}

/** `ergonex mcp` for a host, serving the program `program()` returns once it is assembled. */
export function mcpCommand(host: Host, program: () => Program | undefined): Command {
  return command({
    name: "mcp",
    summary: "Serve the verbs the held tier sees as tools of a tool server on standard input and output (MCP); over ssh, a key whose forced command is this one is the way in.",
    options: { readOnly: flag<never>({ help: "Serve only the verbs that read (a key that may only read forces this)." }) },
    examples: [{ args: [], says: `Serve the tools of the tier held (the lower of the agents policy's tier and ERGONEX_TIER, one of ${AGENT_TIERS.join(", ")}).` }],
    action: { kind: "action", effect: "mutate", dryRun: false, idempotent: true, reach: defineReach({ channels: ["local", "ssh"], idempotent: true }) },
    run: async (args) => {
      const served = program();
      if (served === undefined) return outcomeOf(null, { problems: [problem("fail", "the program is not assembled", { code: "E-ENVIRONMENT" })], exit: "environment" });
      const home = host.homeFor(undefined);
      const manifest = home !== undefined && existsSync(join(home, AREA)) ? await readManifest(home, host.today, loopbackAllowed(host.env)) : undefined;
      const policyTier = manifest?.kind === "ok" ? manifest.value.agents?.tier : undefined;
      const held = serverTier(policyTier, host.env["ERGONEX_TIER"]);
      if ("unknown" in held) return outcomeOf(null, { problems: [problem("fail", `${held.unknown} is not a tier: use ${AGENT_TIERS.join(", ")}`, { code: "E-USAGE" })], exit: "usage" });
      // standard output is the protocol's: what a call prints is given back to the caller and never written there
      const { sink: _sink, state: _state, ...io } = hostIo();
      const readOnly = (args.options as Readonly<Record<string, unknown>>)["readOnly"] === true || (host.env["ERGONEX_READ_ONLY"] ?? "") !== "";
      const env = (name: string): string | undefined => (name === "ERGONEX_PERSONA" ? "agent" : name === "ERGONEX_HARNESS" ? (host.env["ERGONEX_HARNESS"] ?? "other") : io.env(name));
      await serve({ program: served, tier: held.tier, mayOnlyRead: readOnly, run: (argv) => runCli(served, argv, { ...io, tier: held.tier, env }) }, stdioTransport());
      return outcomeOf(null);
    },
  });
}
