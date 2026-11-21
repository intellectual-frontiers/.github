/**
 * Made-up records of the monorepo's issue schema for the tests (commons planning 0002-planning-core FR-010, FR-011): ULIDs made here, an issue file written the way the monorepo's writer writes one (a comment, then
 * the issue as JSON with two spaces of indent, the events in the order of their time and then their id), and the events of a made-up work. The real files are private and are not here.
 *
 * @module
 */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A ULID of a time in milliseconds and 80 bits, as the ULID text lays it out. */
export function ulidOf(ms: number, random: bigint): string {
  let out = "";
  for (let i = 9; i >= 0; i--) out += CROCKFORD[Math.floor(ms / 2 ** (5 * i)) % 32];
  for (let i = 15; i >= 0; i--) out += CROCKFORD[Number((random >> BigInt(5 * i)) & 31n)];
  return out;
}

const T0 = 1_762_500_000_000;

/** Made-up ULIDs for an item and four events. */
export const ULIDS = {
  item: ulidOf(T0, 0x1111_2222_3333_4444_5555n),
  first: ulidOf(T0, 0x1234_5678_9abc_def0_1234n),
  second: ulidOf(T0 + 300_000, 0x0fed_cba9_8765_4321_0fedn),
  third: ulidOf(T0 + 360_000, 0x2222_3333_4444_5555_6666n),
  fourth: ulidOf(T0 + 420_000, 0x7777_8888_9999_aaaa_bbbbn),
} as const;

/** An event as the monorepo writes it. */
export type FixtureEvent = {
  readonly id: string;
  readonly at: string;
  readonly actor: { readonly type: string; readonly id: string; readonly name?: string };
  readonly type: string;
  readonly data?: unknown;
};

/** The comment that heads an issue file. */
export const HEADER = "// An issue of book/example: its events, append-only, each naming its author (229-erga-issues). Merged from the repository and the renditions store by ergactl work issue sync.\n";

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The text of an issue file, written as the monorepo's writer writes it. */
export function issueText(id: string, events: readonly FixtureEvent[], work = "book/example", header = HEADER): string {
  const sorted = [...events].sort((a, b) => byText(a.at, b.at) || byText(a.id, b.id));
  const value = {
    schema: "erga/issue@1",
    id,
    work,
    events: sorted.map((e) => ({ id: e.id, at: e.at, actor: e.actor, type: e.type, ...(e.data === undefined ? {} : { data: e.data }) })),
  };
  return `${header}${JSON.stringify(value, null, 2)}\n`;
}

/** The text of an event object of the store, written as the monorepo's writer writes it. */
export function storeEventText(issue: string, work: string, e: FixtureEvent): string {
  return `${JSON.stringify({ schema: "erga/issue-event@1", issue, work, event: { id: e.id, at: e.at, actor: e.actor, type: e.type, ...(e.data === undefined ? {} : { data: e.data }) } }, null, 2)}\n`;
}

const ADA = { type: "person", id: "ada@example.test", name: "Ada" } as const;
const SCANNER = { type: "tool", id: "agora work build" } as const;

/** A made-up issue with all ten types of event and every field of the opening. */
export function fullIssue(): { readonly id: string; readonly events: readonly FixtureEvent[] } {
  const u = (n: number, r: bigint) => ulidOf(T0 + n * 60_000, r);
  const at = (n: number) => new Date(T0 + n * 60_000).toISOString().slice(0, 19) + "Z";
  return {
    id: ULIDS.item,
    events: [
      { id: u(0, 1n), at: at(0), actor: ADA, type: "opened", data: { title: "Key rotation is not audited", body: "The audit code is never written.", labels: ["audit"], assignees: ["ada@example.test"], severity: "warning", type: "assessing", blocker: true, target: { file: "doc/keys.md", page: 3, quote: "a quoted text" }, source: { tool: "lint", rule: "R1", file: "src/keys.ts", line: 12 } } },
      { id: u(1, 2n), at: at(1), actor: ADA, type: "commented", data: { body: "Seen again." } },
      { id: u(2, 3n), at: at(2), actor: ADA, type: "edited", data: { title: "Key rotation is not audited or listed", body: "More." } },
      { id: u(3, 4n), at: at(3), actor: ADA, type: "labeled", data: { add: ["security"], remove: ["audit"] } },
      { id: u(4, 5n), at: at(4), actor: ADA, type: "assigned", data: { add: ["bob@example.test"], remove: ["ada@example.test"] } },
      { id: u(5, 6n), at: at(5), actor: ADA, type: "severity", data: { severity: "error" } },
      { id: u(6, 7n), at: at(6), actor: ADA, type: "blocker", data: { blocker: false } },
      { id: u(7, 8n), at: at(7), actor: ADA, type: "decided", data: { decision: "minor-revision", note: "Add the list." } },
      { id: u(8, 9n), at: at(8), actor: SCANNER, type: "closed", data: { reason: "not_planned" } },
      { id: u(9, 10n), at: at(9), actor: ADA, type: "reopened" },
      { id: u(10, 11n), at: at(10), actor: ADA, type: "closed", data: { reason: "duplicate" } },
    ],
  };
}
