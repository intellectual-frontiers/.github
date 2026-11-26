// Spec: 0004-actor-trailers FR-001, FR-002, FR-003, FR-004
/**
 * The trailers of a commit that name the actors (commons 0048-actors FR-063, FR-064): `Prepared-by`, `Directive` and `Reviewed-by`, in the form `git interpret-trailers` reads. The codec is pure: it encodes the actors of a
 * commit into lines, decodes the trailers of a message, and lints a commit for the rules that an agent is never the author of record, a reviewer or an approver and that an agent's draft names its directive.
 *
 * @example
 * ```ts
 * import { decodeMessage, encodeTrailers } from "./trailers.ts";
 * const lines = encodeTrailers({ preparedBy: { kind: "agent", id: "claude-code", model: { name: "m", assurance: "reported" } } });
 * lines[0]; // "Prepared-by: claude-code (agent, model m reported)"
 * decodeMessage(`Subject\n\n${lines.join("\n")}\n`).actors.preparedBy?.kind; // "agent"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Actor, PersonActor } from "@intellectual-frontiers/actor/governance";

/** A reference to a directive as a commit names it: its id, version and the digest of its text. */
export interface DirectiveRef {
  readonly id: string;
  readonly version: string;
  readonly digest: string;
}

/** What the trailers of a commit say about its actors. */
export interface CommitActors {
  readonly preparedBy?: Actor;
  readonly directive?: DirectiveRef;
  readonly reviewedBy?: PersonActor;
}

/** A trailer: its key and its value. */
export interface Trailer {
  readonly key: string;
  readonly value: string;
}

/** The lines for the trailers of a commit, in the order `Prepared-by`, `Directive`, `Reviewed-by`. */
export function encodeTrailers(actors: CommitActors): readonly string[] {
  const lines: string[] = [];
  const p = actors.preparedBy;
  if (p !== undefined) lines.push(`Prepared-by: ${p.id} (${p.kind === "agent" ? `agent, model ${p.model.name} ${p.model.assurance}` : p.kind})`);
  const d = actors.directive;
  if (d !== undefined) lines.push(`Directive: ${d.id}@${d.version} sha256:${d.digest}`);
  const r = actors.reviewedBy;
  if (r !== undefined) lines.push(`Reviewed-by: ${r.id} (person)`);
  return lines;
}

const TRAILER_LINE = /^([A-Za-z][A-Za-z0-9-]*):[ \t]+(.*\S)[ \t]*$/;
const PREPARED = /^(\S+) \((person|system|agent)(?:, model (.+) reported)?\)$/;
const DIRECTIVE = /^([^\s@]+)@(\S+) sha256:([0-9a-f]{64})$/;
const REVIEWED = /^(\S+) \(person\)$/;

/** The trailers of a message: those of its last paragraph, where every line is a trailer (git's rule, with a folded line joined to the one before it); none where the last paragraph is not a block of trailers. */
export function trailersOf(message: string): readonly Trailer[] {
  const paragraphs = message.replace(/\r\n/g, "\n").trimEnd().split(/\n[ \t]*\n/);
  if (paragraphs.length < 2) return [];
  const last = paragraphs[paragraphs.length - 1] ?? "";
  const out: Trailer[] = [];
  for (const line of last.split("\n")) {
    if (/^[ \t]+\S/.test(line) && out.length > 0) {
      const before = out[out.length - 1];
      if (before !== undefined) out[out.length - 1] = { key: before.key, value: `${before.value} ${line.trim()}` };
      continue;
    }
    const m = TRAILER_LINE.exec(line);
    if (m === null) return [];
    out.push({ key: m[1] ?? "", value: m[2] ?? "" });
  }
  return out;
}

/** A trailer of this library that does not say what it must. */
export interface TrailerError {
  readonly key: string;
  readonly value: string;
  readonly expected: string;
}

/** What a message says about its actors, and the trailers of this library that are malformed. */
export interface Decoded {
  readonly trailers: readonly Trailer[];
  readonly actors: CommitActors;
  readonly errors: readonly TrailerError[];
}

/** The actors a message names in its trailers. */
export function decodeMessage(message: string): Decoded {
  const trailers = trailersOf(message);
  const errors: TrailerError[] = [];
  let actors: CommitActors = {};
  for (const t of trailers) {
    switch (t.key) {
      case "Prepared-by": {
        const m = PREPARED.exec(t.value);
        const kind = m?.[2];
        if (m === null || kind === undefined) {
          errors.push({ ...t, expected: "ID (person), ID (system) or ID (agent, model NAME reported)" });
        } else if (kind === "agent") {
          if (m[3] === undefined) errors.push({ ...t, expected: "ID (agent, model NAME reported)" });
          else actors = { ...actors, preparedBy: { kind: "agent", id: m[1] ?? "", model: { name: m[3], assurance: "reported" } } };
        } else if (kind === "person" || kind === "system") {
          actors = { ...actors, preparedBy: { kind, id: m[1] ?? "" } };
        }
        break;
      }
      case "Directive": {
        const m = DIRECTIVE.exec(t.value);
        if (m === null) errors.push({ ...t, expected: "ID@VERSION sha256:DIGEST" });
        else actors = { ...actors, directive: { id: m[1] ?? "", version: m[2] ?? "", digest: m[3] ?? "" } };
        break;
      }
      case "Reviewed-by": {
        const m = REVIEWED.exec(t.value);
        if (m === null) errors.push({ ...t, expected: "ID (person)" });
        else actors = { ...actors, reviewedBy: { kind: "person", id: m[1] ?? "" } };
        break;
      }
      default:
        break;
    }
  }
  return { trailers, actors, errors };
}

/** A finding about the actors a commit names. */
export interface TrailerFinding {
  readonly rule: "agent-author" | "agent-signoff" | "agent-reviewer" | "undirected-draft" | "malformed-trailer";
  readonly text: string;
}

/** The findings for a commit (commons 0048-actors FR-063, FR-064): an agent as the author of record, an agent named in a review, an approval or a sign-off, a draft by an agent with no directive, and a malformed trailer of this library. The author is the kind of the actor that Git records. */
export function lintCommit(input: { readonly message: string; readonly author?: Actor | undefined }): readonly TrailerFinding[] {
  const d = decodeMessage(input.message);
  const found: TrailerFinding[] = d.errors.map((e) => ({ rule: "malformed-trailer", text: `${e.key}: expected ${e.expected}` }));
  if (input.author?.kind === "agent") found.push({ rule: "agent-author", text: `the author of record is an agent (${input.author.id}): the author is the accountable initiating person` });
  const agent = d.actors.preparedBy?.kind === "agent" ? d.actors.preparedBy : undefined;
  for (const t of d.trailers) {
    const names = ["Reviewed-by", "Approved-by", "Signed-off-by", "Acked-by"].includes(t.key);
    if (!names) continue;
    if (/\((?:agent)\b/.test(t.value) || (agent !== undefined && t.value.split(/\s+/).includes(agent.id))) {
      found.push({ rule: t.key === "Signed-off-by" ? "agent-signoff" : "agent-reviewer", text: `${t.key} names an agent (${t.value}): only a person reviews, approves or signs off` });
    }
  }
  if (agent !== undefined && d.actors.directive === undefined) found.push({ rule: "undirected-draft", text: `${agent.id} prepared this and the commit names no Directive` });
  return found;
}

/** An actor from the text of one trailer value, or why it is not one: the use of the codec for a single value. */
export function actorFromTrailer(value: string): Result<Actor, string> {
  const d = decodeMessage(`s\n\nPrepared-by: ${value}\n`);
  const p = d.actors.preparedBy;
  return p === undefined ? err(`${JSON.stringify(value)} is not an actor: ID (person), ID (system) or ID (agent, model NAME reported)`) : ok(p);
}
