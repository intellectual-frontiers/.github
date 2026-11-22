// Spec: 0004-planning-sources FR-011
/**
 * What the sources of Planning are, as data (0037-planning FR-015, FR-031, FR-046, FR-047): the names of the sources built and of the sources reserved for the later phase (a source of the list is not registered
 * until the specification of the standard or the service it reads has been read and cited), the row of each source in the matrix of what a source can hold, with an outcome and a reason for every field, and the
 * rule that a journal of Evidence Capture is not read as items by any source, only cited by a locator and the digest of an entry.
 *
 * @example
 * ```ts
 * import { BUILT_SOURCES, RESERVED_SOURCES } from "./catalog.ts";
 * BUILT_SOURCES.some((n) => RESERVED_SOURCES.includes(n)); // false
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Locator } from "@intellectual-frontiers/planning/governance";
import type { Cell, SourceRow } from "@intellectual-frontiers/planning/logical";
import type { Source } from "./source.ts";

/** The sources built. */
export const BUILT_SOURCES = ["issues", "event-files", "markdown", "comments", "githost"] as const;

/** The sources whose names are reserved: not written until the specification of what each reads has been read and cited (0037-planning FR-031). */
export const RESERVED_SOURCES = ["sarif", "tests", "dependabot", "renovate", "icalendar", "linear", "jira", "quality-system", "pentest"] as const;

/** Why a source cannot be registered. */
export type RegisterProblem = { readonly kind: "reserved" | "duplicate"; readonly name: string };

/** A list of sources with `source` added, or why it cannot be: a name reserved for the later phase, or one already there. */
export function registerSource(list: readonly Source[], source: Source): Result<readonly Source[], RegisterProblem> {
  if ((RESERVED_SOURCES as readonly string[]).includes(source.name)) return err({ kind: "reserved", name: source.name });
  if (list.some((s) => s.name === source.name)) return err({ kind: "duplicate", name: source.name });
  return ok([...list, source]);
}

const ex: Cell = { outcome: "expressed" };
const ca = (how: string): Cell => ({ outcome: "carried", how });
const un = (reason: string): Cell => ({ outcome: "unexpressed", reason });

/** The rows of the matrix, one for each source built: every field ends expressed, carried or unexpressed with its reason. */
export const SOURCE_ROWS: readonly SourceRow[] = [
  {
    source: "markdown",
    cells: {
      id: un("a task list item holds no id: its fingerprint is its text, its file and its place among equal ones"), kind: ca("always a task"), title: ex, body: ex, labels: un("a list item holds no label"), assignees: un("a list item holds no assignee"),
      severity: un("a list item holds no severity"), origin: ca("always derived"), external: un("a list item holds no id of another scheme"), links: ex, state: ex,
      comments: un("a list item holds no comment"), decisions: un("a list item holds no decision"), events: un("a task list holds no history"), principal: un("a task list holds no actor"),
      sourceSeverity: un("a list item holds no severity"), motivation: un("a list item holds no motivation"), blocker: un("a list item holds no blocker flag"), target: un("a list item holds no target"), source: un("a list item holds no finding source"),
      priority: un("a list item holds no priority"), size: un("a list item holds no size"), goals: un("a list item holds no goals"), engines: un("a list item holds no engines"), cites: un("a list item holds no citation field"),
      evidence: un("a list item holds no evidence field"), raised: un("a list item holds no day raised"),
    },
  },
  {
    source: "comments",
    cells: {
      id: ex, kind: ca("always a todo"), title: ex, body: un("a marker comment is one line"), labels: ca("the marker is the label"), assignees: un("the text in parentheses after a marker is not read as an assignee"),
      severity: un("a comment holds no severity"), origin: ca("always derived"), external: un("a comment holds no id of another scheme"), links: un("a comment holds no link"),
      state: un("a comment that is there is open and one removed is closed by a derived close; the comment holds no state"), comments: un("a comment holds no comment"), decisions: un("a comment holds no decision"),
      events: un("a comment holds no history"), principal: un("a comment holds no actor"), sourceSeverity: un("a comment holds no severity"), motivation: un("a comment holds no motivation"), blocker: un("a comment holds no blocker flag"),
      target: ca("the file the comment is in"), source: un("a comment holds no finding source"), priority: un("a comment holds no priority"), size: un("a comment holds no size"), goals: un("a comment holds no goals"),
      engines: un("a comment holds no engines"), cites: un("a comment holds no citation field"), evidence: un("a comment holds no evidence field"), raised: un("a comment holds no day raised"),
    },
  },
  {
    source: "issues",
    cells: {
      id: ca("the external id of the library and the number of the file"), kind: ca("always an issue"), title: ex, body: ca("the summary"), labels: un("an issue holds no label"), assignees: ca("the one who has it in progress"),
      severity: un("an issue has four levels (critical, high, medium, low) and the model three: no level is an exact expression, so the item carries the source's own value"), origin: ca("always declared"), external: ex, links: ca("the links of the issue are in the record as read"), state: ex,
      comments: un("an issue file holds no comment"), decisions: un("an issue file holds no decision"), events: un("an issue file holds a status and not a history: its history is its commits"), principal: un("an issue file holds no actor"),
      sourceSeverity: ex, motivation: un("an issue holds no motivation"), blocker: un("an issue holds no blocker flag"), target: un("an issue holds no target"), source: un("an issue holds no finding source"), priority: ex, size: ex, goals: ex, engines: ex, cites: ex, evidence: ex,
      raised: ca("the day raised is the time of the opening and is in the record as read"),
    },
  },
  {
    source: "event-files",
    cells: {
      id: ca("the ULID of the file as an external id, and the id of the library made from it"), kind: ca("always an issue"), title: ex, body: ex, labels: ex, assignees: ex, severity: ex, origin: ca("declared, or derived where a tool opened it"), external: ex, links: un("the schema has no event for a link"),
      state: un("open and closed with three reasons: started and deferred are not in the schema"), comments: ex, decisions: ex, events: ex,
      principal: un("the schema has no field for the person an agent acts for (OQ-10 of commons 0037-planning): an event of an agent is not written"), sourceSeverity: un("the severity of the schema is the three of the model"), motivation: ex, blocker: ex, target: ex, source: ex,
      priority: un("the schema has no priority"), size: un("the schema has no size"), goals: un("the schema has no goals"), engines: un("the schema has no engines"), cites: un("the schema has no citation field"), evidence: un("the schema has no evidence field"), raised: ca("the time of the opening"),
    },
  },
  {
    source: "githost",
    cells: {
      id: ca("the issue number as an external id"), kind: ca("always an issue"), title: ex, body: ex, labels: ex, assignees: un("the Git host contract holds no assignee"), severity: un("a Git host issue holds no severity"), origin: ca("always declared"),
      external: ex, links: ex, state: ca("open or closed: the contract holds no close reason, so a closed issue is read as completed"), comments: un("the Git host contract holds no comment"), decisions: un("a Git host issue holds no decision"),
      events: un("the Git host contract holds no event"), principal: un("a Git host issue holds no actor"), sourceSeverity: un("a Git host issue holds no severity"), motivation: un("a Git host issue holds no motivation"), blocker: un("a Git host issue holds no blocker flag"),
      target: un("a Git host issue holds no target"), source: un("a Git host issue holds no finding source"), priority: un("a Git host issue holds no priority"), size: un("a Git host issue holds no size"), goals: un("a Git host issue holds no goals"),
      engines: un("a Git host issue holds no engines"), cites: un("a Git host issue holds no citation field"), evidence: ca("the commits that name the issue"), raised: un("the Git host contract holds no creation time"),
    },
  },
];

/** The place of the journal of a day of Evidence Capture: `journal/YYYY/MM/DD.jsonl`. */
const JOURNAL = /(?:^|\/)journal\/\d{4}\/\d{2}\/\d{2}\.jsonl$/u;

/** Whether a path is a day's journal of Evidence Capture: no source reads it as items and none changes it. */
export const isJournalPath = (path: string): boolean => JOURNAL.test(path);

/** Why an entry cannot be cited. */
export type CitationProblem = { readonly kind: "not-a-journal" | "bad-line" | "bad-digest"; readonly message: string };

/** The locator and the fingerprint of the citation of one entry of a journal: the day's file and the line, and the entry's own digest. A journal is cited and never read as items. */
export function citeJournalEntry(path: string, line: number, digest: string): Result<{ readonly locator: Locator; readonly fingerprint: string }, CitationProblem> {
  if (!isJournalPath(path)) return err({ kind: "not-a-journal", message: `${path} is not the file of a day of a journal (journal/YYYY/MM/DD.jsonl)` });
  if (!Number.isInteger(line) || line < 1) return err({ kind: "bad-line", message: "a line is a whole number from 1" });
  if (!/^[0-9a-f]{64}$/u.test(digest)) return err({ kind: "bad-digest", message: "the digest of an entry is 64 lower case hexadecimal digits" });
  return ok({ locator: { kind: "file-span", path, startLine: line, endLine: line }, fingerprint: digest });
}
