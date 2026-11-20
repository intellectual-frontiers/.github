// Spec: 0001-quality-evidence FR-015
/**
 * The ledger of nonconformances and CAPA (commons 0001-quality-evidence FR-015, FR-029, FR-031 to FR-036, FR-046): typed events, each kept as one new
 * file on the `quality` branch, folded into the state of every nonconformance and corrective and preventive action.
 *
 * - A **nonconformance** (`ifqs:Nonconformance`) is opened by the system (or a role) from a failed or stale proof or a spent error budget;
 *   it carries its requirement, the evidence it arises from, its reason and who opened it, and is linked to a Problem change request.
 *   There is no event that edits its state: it is closed only by `nonconformance-closed`, which the fold accepts only after the CAPA of it
 *   is closed (FR-032).
 * - A **CAPA** (`ifqs:Capa`) states the corrective action, names the test that verifies it (a test that exists and proves the requirement,
 *   FR-033) and goes `CapaOpen`, `CapaVerified`, `CapaClosed` in that order. It is verified only by `verifyFromRun`, from a run that passed
 *   the named test after the last commit of the corrective change (FR-034), and closed only from verified, by a named person's Decision
 *   (FR-035): an automated run or an agent that tries is refused, and where the harness is regulated the person is not the author of the
 *   corrective change (0020-ifccm FR-020, FR-012).
 * - A **statement**, a **review** and a **probe** are the evidence of grades `E1`, `E2` and `E5` (FR-026, FR-029), kept the same way.
 *
 * @remarks
 * Pure: no clock (a day is an argument), no file, no Git. `ledgerFile` and `readLedgerFile` are the file's text and its reading; the host
 * layer (`host/ledger-branch.ts`) keeps them on the branch. Every text of an event is redacted of secrets before it is written (FR-025's
 * rule applies to a committed file); an event names a person only where it must (a Decision's approver, a review's reviewer).
 *
 * @example
 * ```ts
 * import { emptyLedger, openNonconformance, foldLedger } from "./ledger.ts";
 * const opened = openNonconformance(emptyLedger, { requirement: "0001-quality-evidence FR-013", cause: "failed", reason: "a case failed", evidence: {} }, "2026-11-17");
 * ```
 *
 * @module
 */
import {
  absurd,
  boolean,
  type Decoded,
  type Decoder,
  formatDecodeError,
  integer,
  json,
  literal,
  object,
  refine,
  string,
  tagged,
  err,
  ok,
  type Result,
} from "@intellectual-frontiers/core";
import { canonicalize as jcs, GENESIS } from "./primitives.ts";
import { type Sha256, sha256 } from "@intellectual-frontiers/crypto/sha256";
import { redactEvidence } from "./record.ts";
import { TIER2_EVENTS } from "./tier2-events.ts";
import { type Day, dayDecoder } from "./time.ts";

// ---------------------------------------------------------------------------------------------------------------------------- the events

const text: Decoder<string> = string;
const requirement = refine(string, "RequirementId", (s) => /^\S+ (?:FR|SC)-\d{3}[a-z]?$/.test(s) || /^objective:[a-z0-9.-]+$/.test(s));
const opener = tagged({
  system: object({ kind: literal("system") }),
  agent: object({ kind: literal("agent"), name: string }),
  role: object({ kind: literal("role"), role: string }),
});
const evidenceRef = object({}, { traceId: string, path: string, revision: string });
const cause = literal("failed", "stale", "probe-failed", "budget-spent");
const decision = object({ id: string, person: string, day: dayDecoder }, { role: string });
const by = literal("person", "agent");

const events = tagged({
  "nonconformance-opened": object(
    {
      kind: literal("nonconformance-opened"),
      id: string,
      requirement,
      cause,
      reason: text,
      evidence: evidenceRef,
      openedBy: opener,
      day: dayDecoder,
    },
    {},
  ),
  "nonconformance-linked": object({
    kind: literal("nonconformance-linked"),
    id: string,
    problem: object({ number: integer }, { repo: string }),
    day: dayDecoder,
  }),
  "capa-opened": object(
    {
      kind: literal("capa-opened"),
      id: string,
      nonconformance: string,
      action: text,
      test: object({ requirement, name: string }),
      correctiveRevision: string,
      openedBy: opener,
      day: dayDecoder,
    },
    { author: string },
  ),
  "capa-verified": object({ kind: literal("capa-verified"), id: string, traceId: string, revision: string, day: dayDecoder }),
  "capa-closed": object({ kind: literal("capa-closed"), id: string, decision, day: dayDecoder }),
  "nonconformance-closed": object({ kind: literal("nonconformance-closed"), id: string, capa: string, day: dayDecoder }),
  statement: object({ kind: literal("statement"), requirement, by, who: string, day: dayDecoder }, { note: text }),
  review: object({ kind: literal("review"), requirement, by, who: string, day: dayDecoder }, { sample: boolean }),
  probe: object({ kind: literal("probe"), requirement, outcome: literal("pass", "fail"), source: string, day: dayDecoder }),
  ...TIER2_EVENTS,
});

/** One event of the ledger. */
export type LedgerEvent = Decoded<typeof events>;

/** The kinds of event, as a union of words. */
export type EventKind = LedgerEvent["kind"];

/** Who opened a nonconformance or a CAPA: the system itself, an agent or a role (FR-031). */
export type Opener = Decoded<typeof opener>;

/** A Decision that closes a CAPA: its identifier, the named person, the day and the person's role where stated (FR-035). */
export type CapaDecision = Decoded<typeof decision>;

// ---------------------------------------------------------------------------------------------------------------------------- the file

/** One file of the ledger as kept: its place in the sequence, the digest of the file before it (64 zeros for the first) and the event. */
export type LedgerFile = { readonly schema: "ifqs-record/1"; readonly seq: number; readonly previous: Sha256; readonly event: LedgerEvent };

const fileDecoder = object({
  schema: literal("ifqs-record/1"),
  seq: integer,
  previous: refine(string, "Sha256", (s) => /^[0-9a-f]{64}$/.test(s)),
  event: events,
});

/** The folder of the ledger's files on the `quality` branch (FR-046). */
export const RECORDS_ROOT = "quality/records";

/** The path of the file that keeps an event: its sequence number, six digits, and its kind. */
export function recordPath(seq: number, kind: EventKind): string {
  return `${RECORDS_ROOT}/${String(seq).padStart(6, "0")}-${kind}.json`;
}

const RECORD_PATH = new RegExp(`^${RECORDS_ROOT}/(\\d{6})-([a-z-]+)\\.json$`);

/** A path as a ledger file's sequence number and kind, or undefined where it is not one. */
export function parseRecordPath(path: string): { readonly seq: number; readonly kind: string } | undefined {
  const m = RECORD_PATH.exec(path);
  return m?.[1] === undefined || m[2] === undefined ? undefined : { seq: Number(m[1]), kind: m[2] };
}

/** An opener with its texts redacted (the agent's name and the role are texts a person typed). */
function redactOpener(o: Opener, r: (s: string) => string): Opener {
  switch (o.kind) {
    case "system":
      return o;
    case "agent":
      return { ...o, name: r(o.name) };
    case "role":
      return { ...o, role: r(o.role) };
    default:
      return absurd(o);
  }
}

/** A person as a record names them: the name is data and stays, an e-mail address in it or in the role does not. */
function redactPerson(
  p: { readonly name: string; readonly role?: string },
  r: (s: string) => string,
): { readonly name: string; readonly role?: string } {
  return { name: r(p.name), ...(p.role === undefined ? {} : { role: r(p.role) }) };
}

/**
 * The event as it is kept: every text of it, whatever its kind, redacted of secrets and e-mail addresses (0001-quality-evidence FR-025, 0001-quality-evidence FR-067:
 * redaction is at the source, because a kept file cannot be changed without breaking its chain). A person's name is data and stays; an e-mail
 * address does not. Digests, days, sequence numbers and kinds hold no text a person typed and are as they were. The writer folds the event as
 * it is redacted, so that what the ledger judges is what it keeps.
 */
export function redactEvent(e: LedgerEvent): LedgerEvent {
  const r = redactEvidence;
  switch (e.kind) {
    case "nonconformance-opened":
      return {
        ...e,
        reason: r(e.reason),
        openedBy: redactOpener(e.openedBy, r),
        evidence: { ...e.evidence, ...(e.evidence.path === undefined ? {} : { path: r(e.evidence.path) }) },
      };
    case "nonconformance-linked":
      return { ...e, problem: { ...e.problem, ...(e.problem.repo === undefined ? {} : { repo: r(e.problem.repo) }) } };
    case "capa-opened":
      return {
        ...e,
        action: r(e.action),
        test: { ...e.test, name: r(e.test.name) },
        openedBy: redactOpener(e.openedBy, r),
        ...(e.author === undefined ? {} : { author: r(e.author) }),
      };
    case "capa-verified":
    case "nonconformance-closed":
      return e;
    case "capa-closed":
      return {
        ...e,
        decision: { ...e.decision, person: r(e.decision.person), ...(e.decision.role === undefined ? {} : { role: r(e.decision.role) }) },
      };
    case "statement":
      return { ...e, who: r(e.who), ...(e.note === undefined ? {} : { note: r(e.note) }) };
    case "review":
      return { ...e, who: r(e.who) };
    case "probe":
      return { ...e, source: r(e.source) };
    case "plan-registered":
      return {
        ...e,
        plan: {
          title: r(e.plan.title),
          cases: e.plan.cases.map((c) => ({
            ...c,
            name: r(c.name),
            acceptance: r(c.acceptance),
            ...(c.file === undefined ? {} : { file: r(c.file) }),
          })),
        },
        by: redactPerson(e.by, r),
      };
    case "sample-drawn":
      return { ...e, by: redactPerson(e.by, r) };
    case "sample-attested":
      return {
        ...e,
        results: e.results.map((x) => ({ ...x, ...(x.note === undefined ? {} : { note: r(x.note) }) })),
        person: redactPerson(e.person, r),
      };
    case "mutation-run":
      return { ...e, tool: { name: r(e.tool.name), ...(e.tool.version === undefined ? {} : { version: r(e.tool.version) }) } };
    default:
      return absurd(e);
  }
}

/** The text of a file of the ledger: the canonical JSON (RFC 8785) of its content, redacted, with a final newline. */
export function ledgerFile(file: LedgerFile): Result<string, string> {
  const c = jcs({ ...file, event: redactEvent(file.event) });
  return c.kind === "ok" ? ok(`${c.value}\n`) : err(c.error.reason);
}

/** A file of the ledger read back, or why it is not one. */
export function readLedgerFile(input: string): Result<LedgerFile, string> {
  const r = json(input, fileDecoder);
  if (r.kind === "err") return err(formatDecodeError(r.error));
  return ok({ schema: r.value.schema, seq: r.value.seq, previous: r.value.previous, event: r.value.event });
}

/** The first thing wrong with the files of a ledger (FR-022's rule for the ledger): the file, and what. */
export type LedgerChainBreak = { readonly path: string; readonly reason: string };

/** Whether files, in the order they were kept, form the chain: contiguous sequence numbers from 1, each naming the digest of the file before it. */
export async function verifyLedgerChain(
  files: readonly { readonly path: string; readonly text: string }[],
): Promise<Result<Sha256, LedgerChainBreak>> {
  let previous: Sha256 = GENESIS;
  for (const [i, f] of files.entries()) {
    const p = parseRecordPath(f.path);
    if (p === undefined) return err({ path: f.path, reason: `it is not ${RECORDS_ROOT}/NNNNNN-<kind>.json` });
    const read = readLedgerFile(f.text);
    if (read.kind === "err") return err({ path: f.path, reason: `it does not read as a record: ${read.error}` });
    if (read.value.seq !== i + 1 || p.seq !== i + 1)
      return err({
        path: f.path,
        reason: `its name says number ${p.seq} and it holds number ${read.value.seq}, where number ${i + 1} is next`,
      });
    if (p.kind !== read.value.event.kind)
      return err({ path: f.path, reason: `its name says ${p.kind} and it holds ${read.value.event.kind}` });
    if (read.value.previous !== previous)
      return err({ path: f.path, reason: `it names ${read.value.previous} as the digest of the file before it, which is ${previous}` });
    previous = await sha256(f.text);
  }
  return ok(previous);
}

// ---------------------------------------------------------------------------------------------------------------------------- the state

/** The state of a nonconformance (`ifqs:NonconformanceState`). */
export type NonconformanceState = "NonconformanceOpen" | "NonconformanceClosed";

/** The state of a CAPA (`ifqs:CapaState`), in order. */
export type CapaState = "CapaOpen" | "CapaVerified" | "CapaClosed";

/** What a nonconformance is, folded from its events (FR-031). */
export type Nonconformance = {
  readonly id: string;
  readonly requirement: string;
  readonly cause: Decoded<typeof cause>;
  readonly reason: string;
  readonly evidence: Decoded<typeof evidenceRef>;
  readonly openedBy: Opener;
  readonly openedOn: Day;
  readonly state: NonconformanceState;
  /** The Problem change request it is linked to (0020-ifccm FR-021); none until the link is recorded. */
  readonly problem?: { readonly number: number; readonly repo?: string };
  readonly closedOn?: Day;
  readonly capas: readonly string[];
};

/** What a CAPA is, folded from its events (FR-033 to FR-035). */
export type Capa = {
  readonly id: string;
  readonly nonconformance: string;
  readonly action: string;
  readonly test: { readonly requirement: string; readonly name: string };
  readonly correctiveRevision: string;
  readonly author?: string;
  readonly openedBy: Opener;
  readonly openedOn: Day;
  readonly state: CapaState;
  readonly verified?: { readonly traceId: string; readonly revision: string; readonly day: Day };
  readonly closed?: { readonly decision: CapaDecision; readonly day: Day };
};

/** A statement, a review or a probe as evidence of a requirement. */
export type Attestation =
  | { readonly kind: "statement"; readonly requirement: string; readonly by: "person" | "agent"; readonly who: string; readonly day: Day }
  | {
      readonly kind: "review";
      readonly requirement: string;
      readonly by: "person" | "agent";
      readonly who: string;
      readonly day: Day;
      readonly sample: boolean;
    }
  | { readonly kind: "probe"; readonly requirement: string; readonly outcome: "pass" | "fail"; readonly source: string; readonly day: Day };

/** The ledger as folded: nonconformances and CAPA in the order they were opened, and the attestations in the order they were kept. */
export type Ledger = {
  readonly nonconformances: readonly Nonconformance[];
  readonly capas: readonly Capa[];
  readonly attestations: readonly Attestation[];
  /** The number of files folded: the next event is this number plus one. */
  readonly seq: number;
};

/** A ledger with no event. */
export const emptyLedger: Ledger = { nonconformances: [], capas: [], attestations: [], seq: 0 };

/** Why an event cannot follow the ledger it is given. */
export type LedgerError = { readonly seq: number; readonly kind: EventKind; readonly reason: string };

/** A ledger error as one sentence. */
export function formatLedgerError(e: LedgerError): string {
  return `record ${e.seq} (${e.kind}): ${e.reason}`;
}

const replace = <T extends { readonly id: string }>(list: readonly T[], next: T): readonly T[] =>
  list.map((x) => (x.id === next.id ? next : x));

/** The ledger after one more event, or why the event does not follow it (FR-032 to FR-035). */
export function applyEvent(l: Ledger, e: LedgerEvent): Result<Ledger, LedgerError> {
  const seq = l.seq + 1;
  const refuse = (reason: string): Result<Ledger, LedgerError> => err({ seq, kind: e.kind, reason });
  const next = (patch: Partial<Ledger>): Result<Ledger, LedgerError> => ok({ ...l, ...patch, seq });
  switch (e.kind) {
    case "nonconformance-opened": {
      if (l.nonconformances.some((n) => n.id === e.id)) return refuse(`${e.id} is already opened`);
      return next({
        nonconformances: [
          ...l.nonconformances,
          {
            id: e.id,
            requirement: e.requirement,
            cause: e.cause,
            reason: e.reason,
            evidence: e.evidence,
            openedBy: e.openedBy,
            openedOn: e.day,
            state: "NonconformanceOpen",
            capas: [],
          },
        ],
      });
    }
    case "nonconformance-linked": {
      const n = l.nonconformances.find((x) => x.id === e.id);
      if (n === undefined) return refuse(`${e.id} is not opened`);
      return next({ nonconformances: replace(l.nonconformances, { ...n, problem: e.problem }) });
    }
    case "capa-opened": {
      const n = l.nonconformances.find((x) => x.id === e.nonconformance);
      if (n === undefined) return refuse(`${e.nonconformance} is not opened`);
      if (n.state === "NonconformanceClosed") return refuse(`${n.id} is closed`);
      if (l.capas.some((c) => c.id === e.id)) return refuse(`${e.id} is already opened`);
      if (e.action.trim() === "") return refuse("a CAPA states its corrective action");
      const capa: Capa = {
        id: e.id,
        nonconformance: n.id,
        action: e.action,
        test: e.test,
        correctiveRevision: e.correctiveRevision,
        ...(e.author === undefined ? {} : { author: e.author }),
        openedBy: e.openedBy,
        openedOn: e.day,
        state: "CapaOpen",
      };
      return next({ capas: [...l.capas, capa], nonconformances: replace(l.nonconformances, { ...n, capas: [...n.capas, e.id] }) });
    }
    case "capa-verified": {
      const c = l.capas.find((x) => x.id === e.id);
      if (c === undefined) return refuse(`${e.id} is not opened`);
      if (c.state !== "CapaOpen") return refuse(`${e.id} is ${c.state}, and only an open CAPA is verified`);
      return next({
        capas: replace(l.capas, { ...c, state: "CapaVerified", verified: { traceId: e.traceId, revision: e.revision, day: e.day } }),
      });
    }
    case "capa-closed": {
      const c = l.capas.find((x) => x.id === e.id);
      if (c === undefined) return refuse(`${e.id} is not opened`);
      if (c.state !== "CapaVerified") return refuse(`${e.id} is ${c.state}, and only a verified CAPA is closed`);
      if (e.decision.person.trim() === "") return refuse("a CAPA is closed by a named person");
      return next({ capas: replace(l.capas, { ...c, state: "CapaClosed", closed: { decision: e.decision, day: e.day } }) });
    }
    case "nonconformance-closed": {
      const n = l.nonconformances.find((x) => x.capas.includes(e.capa) && x.id === e.id);
      const c = l.capas.find((x) => x.id === e.capa);
      if (n === undefined) return refuse(`${e.id} has no CAPA ${e.capa}`);
      if (c?.state !== "CapaClosed")
        return refuse(`${e.id} is closed only through a closed CAPA, and ${e.capa} is ${c?.state ?? "unknown"}`);
      return next({ nonconformances: replace(l.nonconformances, { ...n, state: "NonconformanceClosed", closedOn: e.day }) });
    }
    case "statement":
      return next({
        attestations: [...l.attestations, { kind: "statement", requirement: e.requirement, by: e.by, who: e.who, day: e.day }],
      });
    case "review":
      return next({
        attestations: [
          ...l.attestations,
          { kind: "review", requirement: e.requirement, by: e.by, who: e.who, day: e.day, sample: e.sample === true },
        ],
      });
    case "probe":
      return next({
        attestations: [...l.attestations, { kind: "probe", requirement: e.requirement, outcome: e.outcome, source: e.source, day: e.day }],
      });
    // the records of Tier 2 (0001-quality-evidence FR-041 to FR-044) are folded by attestation/rules.ts; here they take their place in the sequence
    case "plan-registered":
    case "sample-drawn":
    case "sample-attested":
    case "mutation-run":
      return next({});
    default:
      return absurd(e);
  }
}

/** The ledger folded from its events, oldest first; the first event that does not follow is named. */
export function foldLedger(events: readonly LedgerEvent[]): Result<Ledger, LedgerError> {
  let l = emptyLedger;
  for (const e of events) {
    const r = applyEvent(l, e);
    if (r.kind === "err") return r;
    l = r.value;
  }
  return ok(l);
}

// ---------------------------------------------------------------------------------------------------------------------------- what a person or a check does

const pad = (n: number): string => String(n).padStart(4, "0");

/** What a nonconformance is opened from. */
export type NonconformanceInput = {
  readonly requirement: string;
  readonly cause: Nonconformance["cause"];
  readonly reason: string;
  readonly evidence: Nonconformance["evidence"];
  /** Who opens it; the system where not given (FR-015). */
  readonly openedBy?: Opener;
};

/** The event that opens a nonconformance, with the next identifier; refused where one is already open for the same requirement and cause (FR-015 does not open it twice). */
export function openNonconformance(l: Ledger, input: NonconformanceInput, day: string): Result<LedgerEvent, string> {
  const d = dayDecoder(day);
  if (d.kind === "err") return err(`${day} is not a day`);
  const subject = requirement(input.requirement);
  if (subject.kind === "err") return err(`${JSON.stringify(input.requirement)} is not a requirement (NNNN-slug FR-nnn) or an objective`);
  const same = l.nonconformances.find(
    (n) => n.requirement === input.requirement && n.cause === input.cause && n.state === "NonconformanceOpen",
  );
  if (same !== undefined) return err(`${same.id} is already open for ${input.requirement} (${input.cause})`);
  return ok({
    kind: "nonconformance-opened",
    id: `NC-${pad(l.nonconformances.length + 1)}`,
    requirement: subject.value,
    cause: input.cause,
    reason: input.reason,
    evidence: input.evidence,
    openedBy: input.openedBy ?? { kind: "system" },
    day: d.value,
  });
}

/** The event that links a nonconformance to its Problem change request (FR-031). */
export function linkProblem(
  l: Ledger,
  id: string,
  problem: { readonly number: number; readonly repo?: string },
  day: string,
): Result<LedgerEvent, string> {
  const d = dayDecoder(day);
  if (d.kind === "err") return err(`${day} is not a day`);
  if (!l.nonconformances.some((n) => n.id === id)) return err(`${id} is not opened`);
  if (!Number.isInteger(problem.number) || problem.number < 1) return err(`${problem.number} is not a change request number`);
  return ok({ kind: "nonconformance-linked", id, problem, day: d.value });
}

/** A test as the repository holds it: the requirements it proves and its name. */
export type KnownTest = { readonly requirements: readonly string[]; readonly name: string };

/** What a CAPA is opened with. */
export type CapaInput = {
  readonly nonconformance: string;
  readonly action: string;
  /** The test that verifies it (FR-033). */
  readonly test: { readonly requirement: string; readonly name: string };
  /** The last commit of the corrective change (FR-034). */
  readonly correctiveRevision: string;
  /** The author of the corrective change, as the harness names authors (an e-mail address). */
  readonly author?: string;
  readonly openedBy?: Opener;
};

/**
 * The event that opens a CAPA (FR-033): it states a corrective action and names a test that exists and proves the requirement of the
 * nonconformance (or, for the nonconformance of an objective, the requirement the test names). A test that does not exist is refused.
 */
export function openCapa(l: Ledger, input: CapaInput, tests: readonly KnownTest[], day: string): Result<LedgerEvent, string> {
  const d = dayDecoder(day);
  if (d.kind === "err") return err(`${day} is not a day`);
  const n = l.nonconformances.find((x) => x.id === input.nonconformance);
  if (n === undefined) return err(`${input.nonconformance} is not opened`);
  if (n.state === "NonconformanceClosed") return err(`${n.id} is closed`);
  if (input.action.trim() === "") return err("a CAPA states its corrective action");
  if (input.correctiveRevision.trim() === "") return err("a CAPA names the last commit of its corrective change");
  const proves = requirement(input.test.requirement);
  if (proves.kind === "err") return err(`${JSON.stringify(input.test.requirement)} is not a requirement (NNNN-slug FR-nnn)`);
  const objective = n.requirement.startsWith("objective:");
  if (!objective && input.test.requirement !== n.requirement)
    return err(`the test must prove ${n.requirement}, and ${input.test.requirement} is another requirement`);
  const exists = tests.some((t) => t.name === input.test.name && t.requirements.includes(input.test.requirement));
  if (!exists)
    return err(`no test named ${JSON.stringify(input.test.name)} proves ${input.test.requirement}: a CAPA names a test that exists`);
  return ok({
    kind: "capa-opened",
    id: `CAPA-${pad(l.capas.length + 1)}`,
    nonconformance: n.id,
    action: input.action,
    test: { requirement: proves.value, name: input.test.name },
    correctiveRevision: input.correctiveRevision,
    ...(input.author === undefined ? {} : { author: input.author }),
    openedBy: input.openedBy ?? { kind: "system" },
    day: d.value,
  });
}

/** A run as the verification of a CAPA reads it: which run, at which revision, on which day, and the cases it holds. */
export type RunFacts = {
  readonly traceId: string;
  readonly revision: string;
  readonly day: string;
  readonly cases: readonly { readonly name: string; readonly requirements: readonly string[]; readonly outcome: string }[];
};

/**
 * The events that verify CAPA (FR-034): each open CAPA whose named test passed in this run, at a revision after the last commit of its
 * corrective change (`isAfter(corrective, run)`). A test that failed, did not run or ran at an earlier revision verifies nothing, and the CAPA
 * (and its nonconformance) stays open. Nothing else verifies a CAPA.
 */
export function verifyFromRun(
  l: Ledger,
  run: RunFacts,
  isAfter: (corrective: string, revision: string) => boolean,
): readonly LedgerEvent[] {
  const d = dayDecoder(run.day);
  if (d.kind === "err") return [];
  const out: LedgerEvent[] = [];
  for (const c of l.capas) {
    if (c.state !== "CapaOpen") continue;
    const mine = run.cases.filter((x) => x.name === c.test.name && x.requirements.includes(c.test.requirement));
    if (mine.length === 0 || !mine.every((x) => x.outcome === "pass")) continue;
    if (!isAfter(c.correctiveRevision, run.revision)) continue;
    out.push({ kind: "capa-verified", id: c.id, traceId: run.traceId, revision: run.revision, day: d.value });
  }
  return out;
}

/** Who approves a closure: a person who is named, or something that is not a person and is refused (FR-035). */
export type Approver =
  | { readonly kind: "person"; readonly name: string; readonly role?: string }
  | { readonly kind: "agent"; readonly name: string }
  | { readonly kind: "automated"; readonly run?: string };

/** What closing a CAPA is judged against. */
export type ClosureInput = {
  readonly capa: string;
  readonly approver: Approver;
  /** The identifier of the Decision that records the approval. */
  readonly decision: string;
  /** Whether 0020-ifccm FR-020 applies: the harness claims a regulated domain. */
  readonly regulated: boolean;
  /** The author of the corrective change as Git has it now (an e-mail address), where known. */
  readonly author?: string;
};

/**
 * The events that close a CAPA and, with it, its nonconformance (FR-032, FR-035): only from `CapaVerified` and only by a named person's
 * Decision. An automated run or an agent is refused; the person is not the one that opened the nonconformance or the CAPA (FR-012); and where
 * a regulated domain is declared (0020-ifccm FR-020) the person is not the author of the corrective change.
 */
export function closeCapa(l: Ledger, input: ClosureInput, day: string): Result<readonly LedgerEvent[], string> {
  const d = dayDecoder(day);
  if (d.kind === "err") return err(`${day} is not a day`);
  const c = l.capas.find((x) => x.id === input.capa);
  if (c === undefined) return err(`${input.capa} is not opened`);
  const n = l.nonconformances.find((x) => x.id === c.nonconformance);
  if (n === undefined) return err(`${c.nonconformance} is not opened`);
  const a = input.approver;
  switch (a.kind) {
    case "automated":
      return err("an automated run closes the verification step and a person closes the CAPA: a run cannot close it");
    case "agent":
      return err(`${a.name} is an agent, and a CAPA is closed by a named person`);
    case "person":
      break;
    default:
      return absurd(a);
  }
  if (a.name.trim() === "") return err("a CAPA is closed by a named person");
  if (c.state !== "CapaVerified") return err(`${c.id} is ${c.state}: it is closed only from CapaVerified, after its named test passed`);
  for (const who of [n.openedBy, c.openedBy]) {
    if ((who.kind === "agent" && who.name === a.name) || (who.kind === "role" && who.role === a.name))
      return err(`${a.name} opened it and cannot approve its closure: nothing authorizes itself`);
  }
  const author = input.author ?? c.author;
  if (input.regulated && author !== undefined && author === a.name)
    return err(`${a.name} is the author of the corrective change, and a regulated harness has a Decision approved by another person`);
  return ok([
    {
      kind: "capa-closed",
      id: c.id,
      decision: { id: input.decision, person: a.name, day: d.value, ...(a.role === undefined ? {} : { role: a.role }) },
      day: d.value,
    },
    { kind: "nonconformance-closed", id: n.id, capa: c.id, day: d.value },
  ]);
}

/** What is attested: a statement (`E1`), a review (`E2`) or a probe's typed result (`E5`). */
export type AttestationInput =
  | { readonly kind: "statement"; readonly requirement: string; readonly by: "person" | "agent"; readonly who: string }
  | {
      readonly kind: "review";
      readonly requirement: string;
      readonly by: "person" | "agent";
      readonly who: string;
      readonly sample?: boolean;
    }
  | { readonly kind: "probe"; readonly requirement: string; readonly outcome: "pass" | "fail"; readonly source: string };

/** The event that records a person's or an agent's statement (`E1`) or review (`E2`) of a requirement, or a probe (`E5`). */
export function attest(input: AttestationInput, day: string): Result<LedgerEvent, string> {
  const d = dayDecoder(day);
  if (d.kind === "err") return err(`${day} is not a day`);
  const subject = requirement(input.requirement);
  if (subject.kind === "err") return err(`${JSON.stringify(input.requirement)} is not a requirement (NNNN-slug FR-nnn)`);
  const r = subject.value;
  switch (input.kind) {
    case "statement":
      return input.who.trim() === ""
        ? err("a statement names who made it")
        : ok({ kind: "statement", requirement: r, by: input.by, who: input.who, day: d.value });
    case "review":
      return input.who.trim() === ""
        ? err("a review names who made it")
        : ok({ kind: "review", requirement: r, by: input.by, who: input.who, day: d.value, ...(input.sample ? { sample: true } : {}) });
    case "probe":
      return ok({ kind: "probe", requirement: r, outcome: input.outcome, source: input.source, day: d.value });
    default:
      return absurd(input);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------- reading the ledger

/** The nonconformances still open, in the order they were opened. */
export function openNonconformances(l: Ledger): readonly Nonconformance[] {
  return l.nonconformances.filter((n) => n.state === "NonconformanceOpen");
}

/** The nonconformances open that no Problem change request is linked to (FR-031): each is a finding until the link is recorded. */
export function unlinked(l: Ledger): readonly Nonconformance[] {
  return openNonconformances(l).filter((n) => n.problem === undefined);
}

/** The age in days of the oldest open nonconformance on `today`, or 0 where none is open (FR-039). */
export function oldestOpenDays(l: Ledger, today: string): number {
  const ages = openNonconformances(l).map((n) => daysBetween(n.openedOn, today));
  return ages.length === 0 ? 0 : Math.max(...ages);
}

/** Whole days from one day to a later one (negative where it is earlier). */
export function daysBetween(from: string, to: string): number {
  const ms = (s: string): number => Date.parse(`${s}T00:00:00Z`);
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/** Every kind of event the ledger keeps. */
export const EVENT_KINDS: readonly EventKind[] = [
  "nonconformance-opened",
  "nonconformance-linked",
  "capa-opened",
  "capa-verified",
  "capa-closed",
  "nonconformance-closed",
  "statement",
  "review",
  "probe",
];
