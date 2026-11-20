/**
 * The impact a commit declares and the release notes made of the capabilities closed since the last tag (commons 0026-works-versioning FR-021, FR-023): a line `Impact: major`, `Impact: minor` or
 * `Impact: patch` in a commit's message, and deterministic Markdown that lists each `Closes #N` line of the commits that touch a work's files, grouped by impact and ordered by issue number, so that
 * the change log and the trace chain of 0020-ifccm are one thing.
 *
 * @remarks
 * Pure. The `Closes` lines are read by `parseMessage` of 0020-ifccm, which reads no `Impact:` trailer (0020-ifccm is not changed), so the trailer is read here: a line of its own, case
 * of the word free, a quoted line (`>`) not read, and the greatest wins where a message has several. The notes hold no date, no author and no clock: the same commits give the same text.
 *
 * @limits
 * It does not read Git, and does not ask whether an issue is closed on a host: the commits' words are the record.
 *
 * @example
 * ```ts
 * import { impactOf } from "./notes.ts";
 * impactOf("Add a thing\n\nCloses #4\nImpact: minor\n"); // "minor"
 * ```
 *
 * @module
 */
import { parseMessage } from "../changes/commit-message.ts";
import { greaterImpact, IMPACTS, type Impact } from "./scheme.ts";

/** A commit as the tools read it: its object name, its subject and whole message, and the paths it touched. */
export type CommitFact = {
  readonly sha: string;
  readonly subject: string;
  readonly message: string;
  readonly files: readonly string[];
};

/** The impact a message declares by `Impact:` lines: the greatest of them, or undefined where it states none. */
export function impactOf(message: string): Impact | undefined {
  let found: Impact | undefined;
  for (const raw of message.replaceAll("\r\n", "\n").split("\n")) {
    const line = raw.trim();
    if (line.startsWith(">")) continue;
    const m = /^impact:\s*(major|minor|patch)\s*$/i.exec(line);
    const word = m?.[1]?.toLowerCase();
    const impact = IMPACTS.find((i) => i === word);
    if (impact !== undefined) found = found === undefined ? impact : greaterImpact(found, impact);
  }
  return found;
}

/** The greatest impact the commits state (the commits given are those that touch the work), or undefined where none does (FR-021: `--impact auto` then exits with 2). */
export function impactOfCommits(commits: readonly CommitFact[]): Impact | undefined {
  let found: Impact | undefined;
  for (const c of commits) {
    const i = impactOf(c.message);
    if (i !== undefined) found = found === undefined ? i : greaterImpact(found, i);
  }
  return found;
}

/** What notes are made of. */
export type NotesInput = {
  readonly slug: string;
  readonly title: string;
  /** The version the notes are for: the record's. */
  readonly version: string | undefined;
  /** The tag the notes start after, or undefined for the whole history. */
  readonly from: string | undefined;
  /** The commits since it that touch the work's files, in any order. */
  readonly commits: readonly CommitFact[];
};

const SECTIONS: readonly { readonly impact: Impact | undefined; readonly heading: string }[] = [
  { impact: "major", heading: "Major" },
  { impact: "minor", heading: "Minor" },
  { impact: "patch", heading: "Patch" },
  { impact: undefined, heading: "Impact not stated" },
];

type Line = { readonly repo: string; readonly number: number; readonly sha: string; readonly subject: string };

/** The release notes as Markdown (FR-023): the capabilities closed, once each commit, grouped by impact (major, minor, patch, not stated) and ordered by issue number, and how many commits closed none. */
export function notesOf(input: NotesInput): string {
  const lines = new Map<Impact | undefined, Line[]>();
  let none = 0;
  for (const c of input.commits) {
    const closes = parseMessage(c.message).refs.filter((r) => r.kind === "closes");
    if (closes.length === 0) {
      none++;
      continue;
    }
    const impact = impactOf(c.message);
    const bucket = lines.get(impact) ?? [];
    for (const r of closes) bucket.push({ repo: r.repo ?? "", number: r.number, sha: c.sha, subject: c.subject });
    lines.set(impact, bucket);
  }
  const out: string[] = [
    `# Release notes: ${input.slug}${input.version === undefined ? "" : ` ${input.version}`}`,
    "",
    `${input.title}.`,
    "",
  ];
  out.push(
    input.from === undefined
      ? "The capabilities closed since the beginning of the history."
      : `The capabilities closed since ${input.from}.`,
    "",
  );
  for (const s of SECTIONS) {
    const bucket = lines.get(s.impact);
    if (bucket === undefined || bucket.length === 0) continue;
    out.push(`## ${s.heading}`, "");
    const sorted = [...bucket].sort((a, b) => a.number - b.number || cmp(a.repo, b.repo) || cmp(a.sha, b.sha));
    for (const l of sorted) out.push(`- ${l.repo === "" ? "" : l.repo}#${l.number} ${l.subject} (${l.sha.slice(0, 7)})`);
    out.push("");
  }
  out.push(`${none} ${none === 1 ? "commit" : "commits"} closed no capability.`, "");
  return out.join("\n");
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
