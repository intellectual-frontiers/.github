/**
 * What a commit's message says of the change requests it serves (commons 0020-ifccm FR-005 to FR-008, FR-033): the lines `Refs #N` and `Closes #N` (or `owner/repo#N` for another
 * repository), the words a Git host reads as closing an issue other than `Closes`, and the lines `Departs:` and `Decision:` that say a commit departs from a specification and which
 * Decision authorizes it, and the line `Impact:` that says how much the change raises a version (`major`, `minor` or `patch`; commons 0026-works-versioning FR-021), which is read here so that a line that is none of the three can be found.
 *
 * @remarks
 * Pure text in, data out. A reference is read only from a line of its own: `Closes #10` in the middle of a sentence is not read. The closing words a host reads (`Fixes`, `Resolves`,
 * `Closed`, ...) are read wherever they stand, because the host reads them wherever they stand; the rule that reports them is `rules.ts`, never this module.
 *
 * @limits
 * It does not ask whether an issue exists or is closed (`strict.ts` does, through the host interface) and does not read trailers other than `Departs:`, `Decision:` and `Impact:`.
 *
 * @example
 * ```ts
 * import { parseMessage } from "./commit-message.ts";
 * parseMessage("Add the check\n\nRefs #10\n").refs; // [{ kind: "refs", repo: undefined, number: 10, line: 3 }]
 * ```
 *
 * @module
 */

/** How a line names a change request (`ifccm:IssueReferenceKind`): `refs` while the capability is in progress, `closes` on the commit that finishes it. */
export type ReferenceKind = "refs" | "closes";

/** A change request a commit names on a line of its own: its kind, the repository (`owner/repo`) where it is another's, its number and the line of the message. */
export type IssueRef = { readonly kind: ReferenceKind; readonly repo: string | undefined; readonly number: number; readonly line: number };

/** A closing word a host reads that is not `Closes`: the word as written, the change request it names and the line. */
export type WrongWord = { readonly word: string; readonly repo: string | undefined; readonly number: number; readonly line: number };

/** A message as the check reads it. */
export type ParsedMessage = {
  /** The `Refs` and `Closes` lines, in order. */
  readonly refs: readonly IssueRef[];
  /** The closing words other than `Closes`, in order. */
  readonly wrongWords: readonly WrongWord[];
  /** The requirements (`NNNN-slug FR-nnn`) the `Departs:` lines name. */
  readonly departs: readonly string[];
  /** The identifiers the `Decision:` lines name. */
  readonly decisions: readonly string[];
  /** The `Impact:` lines whose value is not `major`, `minor` or `patch`: the value as written and the line. */
  readonly badImpacts: readonly { readonly value: string; readonly line: number }[];
};

const TARGET = String.raw`((?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?)#(\d+)`;
const OWN_LINE = new RegExp(String.raw`^(refs|closes):?\s+${TARGET}\s*$`, "i");
const CLOSING_WORD = new RegExp(String.raw`\b(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved):?\s+${TARGET}`, "gi");

/** The requirements a `Departs:` value names: `0020-ifccm FR-008, FR-009; 0016-ladder FR-003` gives three. */
function requirementsOf(value: string): readonly string[] {
  const out: string[] = [];
  for (const group of value.split(";")) {
    const spec = /^\s*(\d{3,4}[a-z0-9-]*)\s/.exec(group)?.[1];
    if (spec === undefined) continue;
    for (const m of group.matchAll(/FR-\d{3}[a-z]?/g)) out.push(`${spec} ${m[0]}`);
  }
  return out;
}

/** A message's change requests, closing words, departures and Decisions. A line is read from its first non-space character; a quoted line (`>`) is not read. */
export function parseMessage(message: string): ParsedMessage {
  const refs: IssueRef[] = [];
  const wrongWords: WrongWord[] = [];
  const departs: string[] = [];
  const decisions: string[] = [];
  const badImpacts: { value: string; line: number }[] = [];
  for (const [i, raw] of message.replaceAll("\r\n", "\n").split("\n").entries()) {
    const line = raw.trim();
    if (line === "" || line.startsWith(">")) continue;
    const own = OWN_LINE.exec(line);
    if (own !== null) {
      const word = (own[1] ?? "").toLowerCase();
      refs.push({
        kind: word === "closes" ? "closes" : "refs",
        repo: own[2] === "" ? undefined : own[2],
        number: Number(own[3]),
        line: i + 1,
      });
      continue;
    }
    for (const m of line.matchAll(CLOSING_WORD)) {
      const word = m[1] ?? "";
      // `Closes #N` in the middle of a line is not read (FR-005); the other words are, because the host reads them wherever they stand (FR-008)
      if (word.toLowerCase() === "closes") continue;
      wrongWords.push({ word, repo: m[2] === "" ? undefined : m[2], number: Number(m[3]), line: i + 1 });
    }
    const departure = /^departs:\s*(.*)$/i.exec(line);
    if (departure?.[1] !== undefined) departs.push(...requirementsOf(departure[1]));
    const decision = /^decision:\s*(\S+)\s*$/i.exec(line);
    if (decision?.[1] !== undefined) decisions.push(decision[1]);
    const impact = /^impact:\s*(.*)$/i.exec(line);
    if (impact?.[1] !== undefined && !/^(major|minor|patch)$/i.test(impact[1].trim())) badImpacts.push({ value: impact[1].trim(), line: i + 1 });
  }
  return { refs, wrongWords, departs: [...new Set(departs)], decisions: [...new Set(decisions)], badImpacts };
}

/** Every change request a message names, by a proper line or by a closing word, as `owner/repo#N` or `#N`, each once. */
export function namedIssues(m: ParsedMessage): readonly string[] {
  return [...new Set([...m.refs, ...m.wrongWords].map((r) => `${r.repo ?? ""}#${r.number}`))];
}
