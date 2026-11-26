// Spec: 0001-quality-evidence FR-021
/**
 * The primitives the quality system's evidence is made of (commons 0001-quality-evidence FR-018 to FR-026): an instant, an ISO 8601 duration, a role, JSON's canonical form (RFC 8785) with the digest
 * it gives, the hash-chained ledger of what a run produced, and the freshness of evidence against a cadence. They are the quality system's own, with the formats it has always written (a
 * ledger entry has `seq`, `prev`, `at`, `kind`, `subject`, `evidence` and `digest`), so that the ledgers and records already kept still verify; the library GRC, redesigned in 0.2, no longer holds them.
 *
 * @module
 */
import { type Decoder, type DecodeError, err, formatDecodeError, integer, object, ok, refine, string, type Result, type Brand } from "@intellectual-frontiers/core";
import { type Sha256, sha256, sha256Of } from "@intellectual-frontiers/crypto/sha256";

export type Instant = Brand<string, "Instant">;

const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/i;
const CANONICAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * ISO 8601 date-time text with a `Z` or a `±HH:MM` offset as an `Instant` in UTC (fractions past milliseconds dropped), or undefined where
 * it is not one: a day the month does not have, an hour past 23, a leap second, or a year outside 0000 to 9999 once in UTC.
 */
export function instantOf(text: string): Instant | undefined {
  const m = INSTANT.exec(text.trim());
  if (m === null) return undefined;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map((x) => Number(x ?? ""));
  if (y === undefined || mo === undefined || d === undefined || h === undefined || mi === undefined || s === undefined) return undefined;
  const ms = Number((m[7] ?? "").padEnd(3, "0").slice(0, 3));
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo) || h > 23 || mi > 59 || s > 59) return undefined;
  const zone = (m[8] ?? "Z").toUpperCase();
  let offset = 0;
  if (zone !== "Z") {
    const oh = Number(zone.slice(1, 3));
    const om = Number(zone.slice(4, 6));
    if (oh > 23 || om > 59) return undefined;
    offset = (zone.startsWith("-") ? -1 : 1) * (oh * 60 + om) * 60_000;
  }
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  date.setUTCHours(h, mi, s, ms);
  return instantFromEpochMs(date.getTime() - offset);
}

/** Milliseconds since 1970-01-01T00:00:00Z as an `Instant`, or undefined where it is not finite or falls outside the years 0000 to 9999. */
export function instantFromEpochMs(ms: number): Instant | undefined {
  if (!Number.isFinite(ms)) return undefined;
  const date = new Date(Math.trunc(ms));
  if (Number.isNaN(date.getTime())) return undefined;
  const text = date.toISOString();
  return CANONICAL_INSTANT.test(text) ? (text as Instant) : undefined;
}

/** An instant as milliseconds since 1970-01-01T00:00:00Z. */
export function epochMs(instant: Instant): number {
  return Date.parse(instant);
}

/** Negative where `a` is before `b`, zero where they are the same instant, positive where `a` is after. */
export function compareInstants(a: Instant, b: Instant): number {
  return epochMs(a) - epochMs(b);
}

/** The latest of some instants, or undefined where there are none. */
export function latestInstant(instants: Iterable<Instant>): Instant | undefined {
  let best: Instant | undefined;
  for (const i of instants) if (best === undefined || compareInstants(i, best) > 0) best = i;
  return best;
}

function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** An ISO 8601 duration (`P1D`, `P30D`, `P1Y`, `PT15M`, `P1Y2M3W4DT5H6M7.5S`), its text kept for what renders it. */
export type Duration = {
  readonly text: string;
  readonly years: number;
  readonly months: number;
  readonly weeks: number;
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
};

/** Why text is not an ISO 8601 duration. */
export type DurationError = { readonly kind: "duration"; readonly text: string };

const DURATION = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/;

/** ISO 8601 duration text as a `Duration`: whole years, months, weeks, days, hours and minutes, and seconds with an optional fraction. */
export function parseDuration(text: string): Result<Duration, DurationError> {
  const m = DURATION.exec(text);
  if (m === null || text === "P" || text.endsWith("T")) return err({ kind: "duration", text });
  const n = (i: number): number => Number((m[i] ?? "0").replace(",", "."));
  return ok({ text, years: n(1), months: n(2), weeks: n(3), days: n(4), hours: n(5), minutes: n(6), seconds: n(7) });
}

/** A duration from a literal in code, such as a control's cadence; it throws where the literal is not one (a mistake in the code, not in data). */
export function duration(text: string): Duration {
  const r = parseDuration(text);
  if (r.kind === "err") throw new Error(`not an ISO 8601 duration: ${JSON.stringify(text)}`);
  return r.value;
}

/**
 * The instant a duration after another, in UTC: years and months first (a day the month lacks becomes its last, so 31 January plus `P1M`
 * is 28 or 29 February), then weeks, days, hours, minutes and seconds; undefined past the year 9999.
 */
export function addDuration(start: Instant, d: Duration): Instant | undefined {
  const date = new Date(epochMs(start));
  const months = date.getUTCFullYear() * 12 + date.getUTCMonth() + d.years * 12 + d.months;
  const year = Math.floor(months / 12);
  const month = months - year * 12;
  if (year > 9999) return undefined;
  date.setUTCFullYear(year, month, Math.min(date.getUTCDate(), daysInMonth(year, month + 1)));
  const span = ((d.weeks * 7 + d.days) * 24 * 3600 + d.hours * 3600 + d.minutes * 60 + d.seconds) * 1000;
  return instantFromEpochMs(date.getTime() + Math.round(span));
}

// ---------------------------------------------------------------------------------------------------------------------------- roles and globs

/** A role (`security-lead`, `platform/owner`), never a person: who approves a waiver, owns a risk or gives a review. */
export type Role = Brand<string, "Role">;

const ROLE = /^[a-z][a-z0-9]*(?:[-_./][a-z0-9]+)*$/;

/** Text as a `Role` where it is one (lower-case words joined by `-`, `_`, `.` or `/`), else undefined. An e-mail address is not a role. */
export function roleOf(text: string): Role | undefined {
  return ROLE.test(text) ? (text as Role) : undefined;
}

/** A subject as the ledger names it: a kind and an id. */
export type SubjectRef = { readonly kind: string; readonly id: string };

/** Text as an `Instant`, or a decode error. */
export const instantDecoder: Decoder<Instant> = refine(string, "an ISO 8601 date-time with a zone", (t) => instantOf(t) !== undefined) as unknown as Decoder<Instant>;

export type CanonicalError = { readonly kind: "canonical"; readonly path: string; readonly reason: string };

function memberPath(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function isPlainObject(v: object): boolean {
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function canonicalText(value: unknown, path: string, parents: Set<object>, out: string[]): CanonicalError | undefined {
  const fail = (reason: string): CanonicalError => ({ kind: "canonical", path, reason });
  if (value === null) out.push("null");
  else if (typeof value === "boolean") out.push(value ? "true" : "false");
  else if (typeof value === "number") {
    if (!Number.isFinite(value)) return fail(`${String(value)} is not a JSON number`);
    out.push(JSON.stringify(value));
  } else if (typeof value === "string") {
    if (!value.isWellFormed()) return fail("the string holds a lone surrogate");
    out.push(JSON.stringify(value));
  } else if (typeof value === "object") {
    if (parents.has(value)) return fail("the value refers to itself");
    parents.add(value);
    if (Array.isArray(value)) {
      out.push("[");
      for (let i = 0; i < value.length; i++) {
        if (i > 0) out.push(",");
        const item: unknown = value[i];
        if (item === undefined) return { kind: "canonical", path: `${path}[${i}]`, reason: "an array holds nothing here" };
        const e = canonicalText(item, `${path}[${i}]`, parents, out);
        if (e !== undefined) return e;
      }
      out.push("]");
    } else {
      if (!isPlainObject(value)) return fail("only plain objects are JSON objects");
      const keys = Object.keys(value).sort();
      out.push("{");
      let first = true;
      for (const key of keys) {
        const member: unknown = Reflect.get(value, key);
        if (member === undefined) continue;
        if (!key.isWellFormed()) return fail(`the member name ${JSON.stringify(key)} holds a lone surrogate`);
        out.push(first ? "" : ",", JSON.stringify(key), ":");
        first = false;
        const e = canonicalText(member, memberPath(path, key), parents, out);
        if (e !== undefined) return e;
      }
      out.push("}");
    }
    parents.delete(value);
  } else return fail(`a ${typeof value} is not JSON`);
  return undefined;
}

/**
 * A value's canonical JSON text (RFC 8785): plain objects, arrays, strings, finite numbers, booleans and `null`. An object member whose
 * value is `undefined` is left out, as `JSON.stringify` leaves it; anything else that is not JSON (a non-finite number, a lone surrogate,
 * a `Date`, a class instance, a cycle, a hole) is an error naming where it is.
 */
export function canonicalize(value: unknown): Result<string, CanonicalError> {
  const out: string[] = [];
  const e = canonicalText(value, "$", new Set(), out);
  return e === undefined ? ok(out.join("")) : err(e);
}

/** The address of a piece of evidence: the SHA-256 of its canonical JSON, the same on every runtime. */
export async function evidenceDigest(value: unknown): Promise<Result<Sha256, CanonicalError>> {
  const r = canonicalize(value);
  return r.kind === "ok" ? ok(await sha256(r.value)) : r;
}

// ---------------------------------------------------------------------------------------------------------------------------- ledger (FR-007)

/** The digest the first entry of a ledger names as the one before it: 64 zeros. */
export const GENESIS: Sha256 = "0".repeat(64) as Sha256; // 64 hexadecimal digits by construction

/** What is appended to a ledger: when, what kind of record (`observation`, `assessment`), about what, and the digest of the evidence. */
export type LedgerRecord = { readonly at: Instant; readonly kind: string; readonly subject: SubjectRef; readonly evidence: Sha256 };

/** One entry of a ledger: a record with its place, the digest of the entry before it and its own digest. */
export type LedgerEntry = LedgerRecord & { readonly seq: number; readonly prev: Sha256; readonly digest: Sha256 };

/** The last entry a ledger is known to have reached (what a signature covers): `{ seq: 0, digest: GENESIS }` for an empty one. */
export type LedgerHead = { readonly seq: number; readonly digest: Sha256 };

/** The digest an entry must carry: the SHA-256 of the canonical JSON of every field but `digest`. */
export async function entryDigest(e: Omit<LedgerEntry, "digest">): Promise<Result<Sha256, CanonicalError>> {
  return evidenceDigest({
    seq: e.seq,
    prev: e.prev,
    at: e.at,
    kind: e.kind,
    subject: { kind: e.subject.kind, id: e.subject.id },
    evidence: e.evidence,
  });
}

/** The head of a ledger: its last entry's place and digest. */
export function ledgerHead(entries: readonly LedgerEntry[]): LedgerHead {
  const last = entries.at(-1);
  return last === undefined ? { seq: 0, digest: GENESIS } : { seq: last.seq, digest: last.digest };
}

/** The ledger with one record appended; an error where the record has no canonical form (a lone surrogate in its kind or subject). */
export async function appendEntry(
  entries: readonly LedgerEntry[],
  record: LedgerRecord,
): Promise<Result<readonly LedgerEntry[], CanonicalError>> {
  const head = ledgerHead(entries);
  const body = {
    seq: head.seq + 1,
    prev: head.digest,
    at: record.at,
    kind: record.kind,
    subject: record.subject,
    evidence: record.evidence,
  };
  const d = await entryDigest(body);
  return d.kind === "ok" ? ok([...entries, { ...body, digest: d.value }]) : d;
}

/** A ledger as JSON lines: each entry's canonical JSON and a line feed. */
export function ledgerLines(entries: readonly LedgerEntry[]): string {
  return entries
    .map((e) => {
      const r = canonicalize(e);
      return `${r.kind === "ok" ? r.value : JSON.stringify(e)}\n`;
    })
    .join("");
}

const sha256Decoder: Decoder<Sha256> = (input, path = "$") => {
  const s = typeof input === "string" && /^[0-9a-f]{64}$/.test(input) ? sha256Of(input) : undefined;
  return s === undefined
    ? err({ kind: "decode", path, expected: "a SHA-256 (64 lower-case hexadecimal digits)", found: typeof input })
    : ok(s);
};

/** A ledger entry as its JSON holds it. */
export const ledgerEntryDecoder: Decoder<LedgerEntry> = object({
  seq: refine(integer, "positive", (n) => n >= 1),
  prev: sha256Decoder,
  at: instantDecoder,
  kind: string,
  subject: object({ kind: string, id: string }),
  evidence: sha256Decoder,
  digest: sha256Decoder,
});

/** Why the text of a ledger could not be read: the line (from 1) and what is wrong there. */
export type LedgerParseError = { readonly kind: "ledger-line"; readonly line: number; readonly error: DecodeError };

/** A ledger parse error as one sentence. */
export function formatLedgerParseError(e: LedgerParseError): string {
  return `line ${e.line}: ${formatDecodeError(e.error)}`;
}

/** A ledger from its JSON lines (blank lines skipped), each decoded; the chain is checked by `verifyLedger`. */
export function parseLedger(text: string): Result<readonly LedgerEntry[], LedgerParseError> {
  const entries: LedgerEntry[] = [];
  const lines = text.split("\n");
  for (const [i, raw] of lines.entries()) {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (e) {
      return err({
        kind: "ledger-line",
        line: i + 1,
        error: { kind: "decode", path: "$", expected: "JSON", found: e instanceof Error ? e.message : String(e) },
      });
    }
    const r = ledgerEntryDecoder(value);
    if (r.kind === "err") return err({ kind: "ledger-line", line: i + 1, error: r.error });
    entries.push(r.value);
  }
  return ok(entries);
}

/** The kind of tampering a broken ledger shows. */
export type Tampering = "changed" | "removed" | "inserted" | "reordered";

/** Where a ledger breaks: the place (from 1) of the first entry that was changed, removed, inserted or reordered, and why that is said. */
export type LedgerBreak = { readonly kind: Tampering; readonly seq: number; readonly reason: string };

/** A ledger break as one sentence. */
export function formatLedgerBreak(b: LedgerBreak): string {
  return `entry ${b.seq} was ${b.kind}: ${b.reason}`;
}

/**
 * The ledger's head where every entry's digest is the digest of its content, its `seq` its place and its `prev` the digest of the entry
 * before it (and, where a `head` is given, the ledger reaches it with that digest); else the first break. Entry N edited in place is
 * `changed` at N (edited and re-hashed, it is found at N + 1's link and still named N); entry N gone is `removed` at N; a forged entry
 * slipped in at N is `inserted` at N; two entries swapped are `reordered` at the first of them.
 */
export async function verifyLedger(entries: readonly LedgerEntry[], head?: LedgerHead): Promise<Result<LedgerHead, LedgerBreak>> {
  const brk = (kind: Tampering, seq: number, reason: string): Result<never, LedgerBreak> => err({ kind, seq, reason });
  for (const [i, e] of entries.entries()) {
    const place = i + 1;
    const d = await entryDigest(e);
    if (d.kind === "err" || d.value !== e.digest) return brk("changed", place, "its digest is not the SHA-256 of its content");
    if (e.seq > place) {
      return entries.slice(i + 1).some((x) => x.seq === place)
        ? brk("reordered", place, `entry ${e.seq} stands where entry ${place} should`)
        : brk("removed", place, e.seq === place + 1 ? `entry ${place} is missing` : `entries ${place} to ${e.seq - 1} are missing`);
    }
    if (e.seq < place) {
      const beforePrevious = i >= 2 ? entries[i - 2]?.digest : GENESIS;
      return e.prev === beforePrevious
        ? brk("inserted", Math.max(place - 1, 1), `it is not in the chain: entry ${place} links past it`)
        : brk("inserted", place, `it repeats the place ${e.seq}`);
    }
    const previous = i === 0 ? GENESIS : (entries[i - 1]?.digest ?? GENESIS);
    if (e.prev !== previous)
      return i === 0
        ? brk("changed", 1, "it does not begin the chain")
        : brk("changed", place - 1, `entry ${place} names another digest for it`);
  }
  if (head !== undefined) {
    if (entries.length < head.seq) return brk("removed", entries.length + 1, `the ledger ends before its head, entry ${head.seq}`);
    const at = head.seq === 0 ? GENESIS : entries[head.seq - 1]?.digest;
    if (at !== head.digest) return brk("changed", Math.max(head.seq, 1), "its digest is not the head's");
  }
  return ok(ledgerHead(entries));
}

// ---------------------------------------------------------------------------------------------------------------------------- manifest (FR-008)

// ---------------------------------------------------------------------------------------------------------------------------- freshness (FR-011)

/** Whether evidence is recent enough for its cadence. */
export type FreshnessStatus = "fresh" | "due" | "stale";

/** How fresh evidence is: its status, the newest evidence, when it falls due (`null` past the year 9999) and when the `due` window opens. */
export type Freshness = {
  readonly status: FreshnessStatus;
  readonly cadence: string;
  readonly newest: Instant | null;
  readonly dueAt: Instant | null;
  readonly dueFrom: Instant | null;
};

/**
 * The freshness at `at` of evidence observed at the given instants, held to a cadence: it falls due one cadence after the newest; it is
 * `stale` after that instant, `due` in the last tenth of the cadence up to and at it, `fresh` before. No evidence at all is `stale`, due at `at`.
 */
export function freshness(cadence: Duration, evidence: readonly Instant[], at: Instant): Freshness {
  const newest = latestInstant(evidence);
  if (newest === undefined) return { status: "stale", cadence: cadence.text, newest: null, dueAt: at, dueFrom: at };
  const dueAt = addDuration(newest, cadence);
  if (dueAt === undefined) return { status: "fresh", cadence: cadence.text, newest, dueAt: null, dueFrom: null };
  const length = epochMs(dueAt) - epochMs(newest);
  const dueFrom = instantFromEpochMs(epochMs(dueAt) - length / 10) ?? newest;
  const status: FreshnessStatus = compareInstants(at, dueAt) > 0 ? "stale" : compareInstants(at, dueFrom) >= 0 ? "due" : "fresh";
  return { status, cadence: cadence.text, newest, dueAt, dueFrom };
}

