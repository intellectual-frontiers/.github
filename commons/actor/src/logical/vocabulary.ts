// Spec: 0004-actor-trailers FR-005, FR-006
/**
 * The vocabulary lint (commons 0048-actors FR-014, FR-064): in a text, the words that must not be used of an agent (`wrote`, `completed`, `approved`, `signed`, `confirmed`, `initiated`, `owns`) where an agent is their
 * subject, in the active (`the agent approved`) and in the passive (`approved by the agent`). It looks at what a text says, never at its style (FR-065): it does not try to tell that an agent wrote a text. Code, in a block or
 * in backticks, is not read, and neither is a sentence that denies it (`Nothing is approved by an agent.`): that states the rule.
 *
 * @example
 * ```ts
 * import { lintVocabulary } from "./vocabulary.ts";
 * lintVocabulary("The agent approved the plan.")[0]?.word; // "approved"
 * lintVocabulary("The agent prepared the plan.").length; // 0
 * ```
 *
 * @module
 */
import { FORBIDDEN_AGENT_WORDS, type ForbiddenWord } from "@intellectual-frontiers/actor/governance";

/** A forbidden word used of an agent. */
export interface VocabularyFinding {
  readonly word: ForbiddenWord;
  readonly line: number;
  readonly text: string;
}

const AGENT = "(?:AI agents?|agents?|AI assistants?|assistants?|AI|LLMs?|bots?|Claude|Codex|models?)";
const WORDS = FORBIDDEN_AGENT_WORDS.join("|");
/** A sentence that says what an agent does not do, or that nothing is done by one, states the rule and is not a breach of it. */
const NEGATED = /\b(?:no|nothing|never|not|cannot|without|neither|nor)\b|n't/i;
const PASSIVE_WORDS = "wrote|written|completed|approved|signed|confirmed|initiated|owned";
const ACTIVE = new RegExp(`\\b${AGENT}\\b(?:\\s+(?!and\\b|or\\b)[\\w'-]+){0,2}?\\s+(${WORDS})\\b`, "gi");
const PASSIVE = new RegExp(`\\b(${PASSIVE_WORDS})\\s+by\\s+(?:the\\s+|an?\\s+|our\\s+)?${AGENT}\\b`, "gi");

function normal(word: string): ForbiddenWord | undefined {
  const w = word.toLowerCase();
  const map: Readonly<Record<string, ForbiddenWord>> = { wrote: "wrote", written: "wrote", completed: "completed", approved: "approved", signed: "signed", confirmed: "confirmed", initiated: "initiated", own: "owns", owns: "owns", owned: "owns" };
  const hit = map[w];
  return hit !== undefined && FORBIDDEN_AGENT_WORDS.includes(hit) ? hit : undefined;
}

/** The sentences of a text that use a forbidden word of an agent, with their line; code is skipped. */
export function lintVocabulary(text: string): readonly VocabularyFinding[] {
  const found: VocabularyFinding[] = [];
  let fenced = false;
  for (const [i, raw] of text.split("\n").entries()) {
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const line = raw.replace(/`[^`]*`/g, " ");
    for (const sentence of line.split(/(?<=[.!?;:])\s+/)) {
      if (NEGATED.test(sentence)) continue;
      const hits = [...sentence.matchAll(ACTIVE), ...sentence.matchAll(PASSIVE)].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      for (const m of hits) {
        const word = normal(m[1] ?? "");
        if (word !== undefined) found.push({ word, line: i + 1, text: sentence.trim() });
      }
    }
  }
  return found;
}
