// Spec: 0005-archon-assembly FR-001, FR-002, FR-003, FR-004
/**
 * The assembled command: one `archon` program made from the plugins a fleet gives it (`archon-tool`, `archon-server`, ...), through the composition of Headless. The host is `archon`: the program, its
 * ladder of tiers (public, operator, administrator) and one verb of its own, `plugins`, which lists what was assembled. A conflict between plugins is a value, never a winner, and a run says which plugin
 * contributed the command it ran. A fleet is the composition root: it imports the plugins it wants and calls `main`.
 *
 * @example
 * ```ts
 * import { assemble } from "./mod.ts";
 * assemble([], "1.0.0").kind; // "ok"
 * ```
 *
 * @module
 */
import { type Result } from "@intellectual-frontiers/core";
import { DEFAULT_LADDER, defineReach, parseTierName, type TierName } from "@intellectual-frontiers/headless/governance";
import { command, compose, outcomeOf, type Composed, type CompositionError, type Plugin, type ProgramConfig } from "@intellectual-frontiers/headless/logical";
import { launch } from "@intellectual-frontiers/headless/cli";

/** The name of the program. */
export const PROGRAM = "archon";

/** The variable that says which tier the caller holds. */
export const TIER_VARIABLE = "ARCHON_TIER";

/** The host: the program `archon` with the one verb `plugins`, which lists the plugins assembled. */
export function archonHost(version: string, plugins: readonly Plugin[]): ProgramConfig {
  const listed = [...plugins].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((p) => ({ id: String(p.id), version: p.version, summary: p.summary }));
  const list = command({
    name: "plugins",
    summary: "List the plugins assembled into this command, with the version and purpose of each.",
    options: {},
    action: { kind: "report", reach: defineReach({ channels: ["local", "mcp"], readOnly: true, idempotent: true }) },
    run: () => Promise.resolve(outcomeOf({ plugins: listed }, { text: listed.length === 0 ? "no plugin is assembled" : listed.map((p) => `${p.id} ${p.version}  ${p.summary}`).join("\n") })),
  });
  return { name: PROGRAM, summary: "The fleet: what a server, a device, a workstation or a cloud account must be, planned and approved before it is carried out.", version, children: [list], envPrefix: "ARCHON", stateApp: "archon", tiers: DEFAULT_LADDER };
}

/** The program `archon` from its plugins, or every conflict between them. */
export function assemble(plugins: readonly Plugin[], version: string): Result<Composed, readonly CompositionError[]> {
  return compose(archonHost(version, plugins), plugins);
}

/** The tier a caller holds from the environment, or the word that is not a tier of the ladder. */
export function heldTier(env: (name: string) => string | undefined): { readonly tier: TierName } | { readonly unknown: string } {
  const word = env(TIER_VARIABLE);
  if (word === undefined || word === "") return { tier: DEFAULT_LADDER.default };
  const parsed = parseTierName(word);
  const tier = parsed.kind === "ok" ? DEFAULT_LADDER.ladder.find((t) => t === parsed.value) : undefined;
  return tier === undefined ? { unknown: word } : { tier };
}

/** What `main` is given: the environment, and where the report and the problems go. The program of a fleet reads them from its process; a test passes its own. */
export type MainDeps = {
  readonly env: (name: string) => string | undefined;
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
};

/** A conflict as a sentence. */
function sentence(e: CompositionError): string {
  return JSON.stringify(e);
}

/** Runs `archon` with the plugins and the words after its name; returns the exit status (2 for a tier that is not one, 3 where the plugins cannot be assembled). */
export async function main(plugins: readonly Plugin[], version: string, argv: readonly string[], deps: MainDeps): Promise<number> {
  const env = (name: string): string | undefined => {
    const v = deps.env(name);
    return v === "" ? undefined : v;
  };
  const held = heldTier(env);
  if ("unknown" in held) {
    deps.err(`archon: ${held.unknown} is not a tier (${DEFAULT_LADDER.ladder.join(", ")})\n`);
    return 2;
  }
  const composed = assemble(plugins, version);
  if (composed.kind === "err") {
    deps.err(`archon: the plugins cannot be assembled:\n${composed.error.map((e) => `  ${sentence(e)}`).join("\n")}\n`);
    return 3;
  }
  return await launch(composed.value.program, { argv, io: { env, tier: held.tier, sink: { out: deps.out, err: deps.err } } });
}
