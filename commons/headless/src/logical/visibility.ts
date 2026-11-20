// Spec: 0010-audience-tiers FR-003, FR-004, FR-005
/**
 * What a caller of a tier may see of a program (commons headless 0010-audience-tiers): the tree with the verbs of a higher tier left out, so that every surface draws from the
 * same visible tree (the help, the completion script, the man page, the list of tools of a tool server, the routes of a REST interface), and the typed refusal of a verb that is
 * there but not for this caller. Pure: it asks `tierGate` of governance and nothing else.
 *
 * @remarks
 * A branch with no visible verb below it is itself left out, so that a word that would lead to nothing is not offered. A hidden verb is absent from what is drawn and refused with
 * a typed reason where it is invoked (`hiddenVerb`); a word that is no verb of the program at all is not that refusal, it is unknown.
 *
 * @example
 * ```ts
 * import { programOf, visibleProgram } from "./mod.ts";
 * import { OPERATOR } from "@intellectual-frontiers/headless/governance";
 * visibleProgram(programOf({ name: "tool", summary: "T.", version: "1", children: [] }), OPERATOR).children; // []
 * ```
 *
 * @module
 */
import { PUBLIC, tierGate, type TierDecision, type TierName } from "@intellectual-frontiers/headless/governance";
import type { Node } from "./model.ts";
import type { Program } from "./program.ts";

/** The nodes a caller who holds `held` may see: a command whose tier the gate lets through, and a branch that keeps at least one such command below it. */
export function visibleNodes(program: Pick<Program, "tiers">, nodes: readonly Node[], held: TierName): readonly Node[] {
  return nodes.flatMap((n): readonly Node[] => {
    if (n.kind === "command") return tierGate(program.tiers, n.action.tier ?? PUBLIC, held).kind === "visible" ? [n] : [];
    const children = visibleNodes(program, n.children, held);
    return children.length === 0 ? [] : [{ ...n, children }];
  });
}

/** The program as a caller who holds `held` sees it: the same program with only the visible tree, so that one help, one completion and one man page are drawn from it. */
export function visibleProgram(program: Program, held: TierName): Program {
  return { ...program, children: visibleNodes(program, program.children, held) };
}

/** The refusal of a verb that exists and is not for the caller: the words, and the decision of the gate. */
export type HiddenVerb = { readonly id: string; readonly decision: Extract<TierDecision, { kind: "hidden" }> };

/** The command at the words, if there is one that is hidden from a caller who holds `held`; `undefined` where there is none (the words are unknown, or the command is visible). */
export function hiddenVerb(program: Program, words: readonly string[], held: TierName): HiddenVerb | undefined {
  const find = (nodes: readonly Node[], path: readonly string[]): Node | undefined => {
    const head = path[0];
    const n = nodes.find((c) => c.name === head);
    if (n === undefined) return undefined;
    if (path.length === 1) return n;
    return n.kind === "branch" ? find(n.children, path.slice(1)) : undefined;
  };
  const n = find(program.children, words);
  if (n === undefined || n.kind !== "command") return undefined;
  const id = words.join(" ");
  const decision = tierGate(program.tiers, n.action.tier ?? PUBLIC, held);
  return decision.kind === "hidden" ? { id, decision } : undefined;
}
