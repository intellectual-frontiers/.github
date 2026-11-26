/**
 * A harness's declaration for the `changes` check (commons 0020-ifccm FR-010 to FR-013, FR-019, FR-020): the regulated domains it claims (`ifccm:RegulatedDomain`) and the day it declares
 * production, the phase that follows (warn before the day, gate from it), the Decisions that authorize departures, and the judgement that a declaration was relaxed in Git history.
 *
 * @remarks
 * Pure: the day it is judged on, the earlier versions of the declaration and the Decisions are arguments. The record a harness writes is a TypeScript file of object literals
 * (`export const declaration = { ... }`, `export const decisions = [ ... ]`, `export const roles = { ... }`) read as data and never run, so that an earlier version from Git reads the same
 * way as the present one (`kernel/ts-literal.ts`). The names of the regulated domains are the keys of `ifccm:RegulatedDomain`; a test holds the two lists equal.
 *
 * @limits
 * It does not read Git: `git-log.ts` gives it the versions. A role is the name a harness gives; no standard of roles is adopted (0020-ifccm FR-020 asks only that two roles differ).
 *
 * @example
 * ```ts
 * import { decodeDeclaration, phaseOf } from "./declaration.ts";
 * const d = decodeDeclaration({ regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2027-01-01" });
 * if (d.kind === "ok") phaseOf(d.value, "2027-01-01"); // "gate"
 * ```
 *
 * @module
 */
import {
  absurd,
  array,
  type DecodeError,
  type Decoder,
  formatDecodeError,
  integer,
  literal,
  object,
  record,
  refine,
  string,
  err,
  ok,
  type Result,
} from "@intellectual-frontiers/core";
import type { Brand } from "@intellectual-frontiers/core";
import { type Literal, exportedLiteral } from "@intellectual-frontiers/formats/ts-literal";

/** The names of the regulated domains a harness may claim: the keys of `ifccm:RegulatedDomain` (a test holds the two lists equal). */
export const REGULATED_DOMAINS = ["FederalSecurity", "DeviceQuality", "ElectronicRecords", "DeviceSoftware", "TrustServices"] as const;

/** A regulated domain a harness claims. */
export type RegulatedDomainName = (typeof REGULATED_DOMAINS)[number];

/** A calendar day, `YYYY-MM-DD`, made only by `dayOf`; the days compare as text. */
export type Day = Brand<string, "Day">;

/** Text as a day, or undefined where it is not a real calendar day written `YYYY-MM-DD`. */
export function dayOf(text: string): Day | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (m === null) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  const real = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  return real ? (text as Day) : undefined; // checked just now: the brand's one constructor
}

/** A number of days a harness keeps its evidence for: a whole number of at least one, made only by the decoder. */
export type RetentionDays = Brand<number, "RetentionDays">;

/** The evidence tiers a harness may name as the tier it releases on: the keys of `ifqs:QualityTier` (0021-ifqs FR-036; a test holds the two lists equal). */
export const RELEASE_TIERS = ["Tier0", "Tier1", "Tier2"] as const;

/** An evidence tier (0021-ifqs). */
export type ReleaseTier = (typeof RELEASE_TIERS)[number];

/** A harness's declaration (`ifccm:HarnessDeclaration`). */
export type Declaration = {
  readonly regulatedDomains: readonly RegulatedDomainName[];
  /** The day it declares production; absent where it declares none. */
  readonly productionDeclaredOn?: Day;
  /** How long the harness keeps its evidence on the `quality` branch, in days (0021-ifqs FR-047); absent where it states none. */
  readonly retentionDays?: RetentionDays;
  /** The evidence tier the harness releases on, the least tier a regulated harness may release at (0026-works-versioning FR-026); absent where it names none. */
  readonly releaseTier?: ReleaseTier;
};

/** What an enforcement phase is (`ifccm:EnforcementPhase`): `warn` is held by a baseline that only shrinks, `gate` fails whatever the baseline holds. */
export type Phase = "warn" | "gate";

/** A Decision (`mz:Decision`) as the check reads it: who approved it, what it authorizes, and the issue that records it where there is one. */
export type DecisionRecord = {
  readonly id: string;
  /** The role that approved it (0020-ifccm FR-019). */
  readonly approvedBy: string;
  /** What it authorizes: requirements as `NNNN-slug FR-nnn` for a departure, `gate-relaxed <revision>` for a relaxed declaration, or `no-issue <revision>` for the one commit the owner exempts from naming a change request. */
  readonly covers: readonly string[];
  /** Why it was made; a Decision that covers `no-issue <revision>` MUST state it. */
  readonly reason?: string;
  /** The day it was made, `YYYY-MM-DD`; a Decision that covers `no-issue <revision>` MUST state it. */
  readonly decidedOn?: string;
  /** The change request that records it (`mz:record`), by number. */
  readonly record?: number;
};

/** Everything a harness states for the check: its declaration, its Decisions and the role of each author by email. */
export type HarnessRecord = {
  readonly declaration: Declaration | undefined;
  readonly decisions: readonly DecisionRecord[];
  readonly roles: Readonly<Record<string, string>>;
};

const day: Decoder<Day> = refine(string, "Day", (s) => dayOf(s) !== undefined);
const domain = literal(...REGULATED_DOMAINS);
const retention: Decoder<RetentionDays> = refine(integer, "RetentionDays", (n) => n >= 1);
const tier = literal(...RELEASE_TIERS);
const declarationDecoder = object(
  { regulatedDomains: array(domain) },
  { productionDeclaredOn: day, retentionDays: retention, releaseTier: tier },
);
const decisionDecoder = object({ id: string, approvedBy: string, covers: array(string) }, { record: integer, reason: string, decidedOn: string });

/** A declaration decoded from data read from a file. */
export function decodeDeclaration(input: unknown): Result<Declaration, DecodeError> {
  const r = declarationDecoder(input, "declaration");
  if (r.kind === "err") return r;
  const { regulatedDomains, productionDeclaredOn, retentionDays, releaseTier } = r.value;
  return ok({
    regulatedDomains: [...new Set(regulatedDomains)],
    ...(productionDeclaredOn === undefined ? {} : { productionDeclaredOn }),
    ...(retentionDays === undefined ? {} : { retentionDays }),
    ...(releaseTier === undefined ? {} : { releaseTier }),
  });
}

/** The Decisions decoded from data. */
export function decodeDecisions(input: unknown): Result<readonly DecisionRecord[], DecodeError> {
  const r = array(decisionDecoder)(input, "decisions");
  if (r.kind === "err") return r;
  return ok(
    r.value.map((d) => ({ id: d.id, approvedBy: d.approvedBy, covers: d.covers,
      ...(d.record === undefined ? {} : { record: d.record }),
      ...(d.reason === undefined ? {} : { reason: d.reason }),
      ...(d.decidedOn === undefined ? {} : { decidedOn: d.decidedOn }),
    })),
  );
}

/** Why a record could not be read. */
export type RecordError =
  { readonly kind: "decode"; readonly message: string } | { readonly kind: "literal"; readonly name: string; readonly expected: string };

/** A record error as a sentence. */
export function formatRecordError(e: RecordError): string {
  switch (e.kind) {
    case "decode":
      return e.message;
    case "literal":
      return `${e.name} cannot be read as data: expected ${e.expected}`;
    default:
      return absurd(e);
  }
}

/**
 * The record of a harness read from the text of its file (`export const declaration = ...`, and optionally `decisions` and `roles`). A file with no `declaration` is a harness that declares
 * nothing (not regulated, not in production), which is not an error (0020-ifccm FR-010).
 */
export function decodeHarnessRecord(source: string): Result<HarnessRecord, RecordError> {
  const read = (name: string): Result<Literal | undefined, RecordError> => {
    if (!new RegExp(`export const ${name}\\b`).test(source)) return ok(undefined);
    const r = exportedLiteral(source, name);
    return r.kind === "ok" ? ok(r.value) : err({ kind: "literal", name, expected: r.error.expected });
  };
  const d = read("declaration");
  const ds = read("decisions");
  const rs = read("roles");
  if (d.kind === "err") return d;
  if (ds.kind === "err") return ds;
  if (rs.kind === "err") return rs;
  const declaration = d.value === undefined ? ok(undefined) : decodeDeclaration(d.value);
  if (declaration.kind === "err") return err({ kind: "decode", message: formatDecodeError(declaration.error) });
  const decisions = ds.value === undefined ? ok([]) : decodeDecisions(ds.value);
  if (decisions.kind === "err") return err({ kind: "decode", message: formatDecodeError(decisions.error) });
  const roles = rs.value === undefined ? ok({}) : record(string)(rs.value, "roles");
  if (roles.kind === "err") return err({ kind: "decode", message: formatDecodeError(roles.error) });
  return ok({ declaration: declaration.value, decisions: decisions.value, roles: roles.value });
}

/** The phase a harness is in on `today`: `gate` from the day it declared production (that day included), else `warn` (0020-ifccm FR-011). */
export function phaseOf(declaration: Declaration | undefined, today: string): Phase {
  const on = declaration?.productionDeclaredOn;
  return on !== undefined && on <= today ? "gate" : "warn";
}

/** Whether a declaration claims a regulated domain. */
export function isRegulated(declaration: Declaration | undefined): boolean {
  return (declaration?.regulatedDomains.length ?? 0) > 0;
}

/**
 * The rungs of the ladder that a declaration requires on `today` beyond the rungs every harness has (0020-ifccm FR-013, 0016-ladder FR-011): rungs 9 and 10 from the day a harness that claims a
 * regulated domain declares production, and none before it or for a harness that claims none.
 */
export function rungsRequired(declaration: Declaration | undefined, today: string): readonly number[] {
  return isRegulated(declaration) && phaseOf(declaration, today) === "gate" ? [9, 10] : [];
}

/** What is wrong with a declaration by itself (0020-ifccm FR-010): a regulated domain claimed with no production day. */
export function declarationProblem(declaration: Declaration | undefined): string | undefined {
  return isRegulated(declaration) && declaration?.productionDeclaredOn === undefined
    ? `the declaration claims ${(declaration?.regulatedDomains ?? []).join(", ")} and states no production day (productionDeclaredOn)`
    : undefined;
}

/** One version of a declaration file in Git: the revision that wrote it, the day of that commit, and the declaration then (undefined where the file was absent or declared nothing). */
export type DeclarationVersion = { readonly revision: string; readonly day: Day; readonly declaration: Declaration | undefined };

/** A relaxation: the revision that made it and how. */
export type Relaxation = {
  readonly revision: string;
  readonly how: "day-moved-later" | "day-removed" | "domain-dropped";
  readonly detail: string;
};

/**
 * The relaxations in a history of a declaration, oldest version first (0020-ifccm FR-012): a production day that had passed on the day of the change and was moved later or removed, and
 * a regulated domain dropped.
 */
export function relaxations(history: readonly DeclarationVersion[]): readonly Relaxation[] {
  const out: Relaxation[] = [];
  for (let i = 1; i < history.length; i++) {
    const before = history[i - 1];
    const after = history[i];
    if (before === undefined || after === undefined) continue;
    const was = before.declaration?.productionDeclaredOn;
    const now = after.declaration?.productionDeclaredOn;
    if (was !== undefined && was <= after.day) {
      if (now === undefined)
        out.push({ revision: after.revision, how: "day-removed", detail: `the production day ${was} was removed after it had passed` });
      else if (now > was)
        out.push({
          revision: after.revision,
          how: "day-moved-later",
          detail: `the production day was moved from ${was} to ${now} after it had passed`,
        });
    }
    const kept = new Set(after.declaration?.regulatedDomains ?? []);
    for (const d of before.declaration?.regulatedDomains ?? [])
      if (!kept.has(d)) out.push({ revision: after.revision, how: "domain-dropped", detail: `the regulated domain ${d} was dropped` });
  }
  return out;
}

/** The word a `covers` entry starts with when the owner exempts one commit from naming a change request: `no-issue <revision>` (0020-ifccm FR-046). */
export const NO_ISSUE = "no-issue";

/** The words of a `covers` entry that names one revision, `gate-relaxed <revision>` or `no-issue <revision>`. */
const REVISION_ENTRY = /^(gate-relaxed|no-issue) ([0-9a-f]{7,64})$/;

/** Whether a Decision covers a thing (a requirement, `gate-relaxed <revision>` or `no-issue <revision>`): a covered revision may be named by a prefix of at least 7 characters. */
export function covers(decision: DecisionRecord, thing: string): boolean {
  return decision.covers.some((c) => {
    if (c === thing) return true;
    const m = REVISION_ENTRY.exec(c);
    return m?.[1] !== undefined && m[2] !== undefined && thing.startsWith(`${m[1]} `) && thing.slice(m[1].length + 1).startsWith(m[2]);
  });
}

/** The entries of a Decision that exempt a commit (`no-issue ...`): each with its revision where it is well formed (`no-issue` and 7 to 64 lowercase hexadecimal characters), none where it is not. */
export function noIssueEntries(decision: DecisionRecord): readonly { readonly entry: string; readonly revision: string | undefined }[] {
  return decision.covers
    .filter((c) => c === NO_ISSUE || c.startsWith(`${NO_ISSUE} `))
    .map((entry) => {
      const m = REVISION_ENTRY.exec(entry);
      return { entry, revision: m?.[1] === NO_ISSUE ? m[2] : undefined };
    });
}

/**
 * What is wrong with a Decision that exempts a commit (0020-ifccm FR-046), as sentences; none for a Decision that covers no `no-issue` entry or one whose entries, person, day and reason are all sound.
 * The person is `approvedBy`: it MUST name someone, and MUST NOT be a role of `roles`, because a role is not a person.
 */
export function noIssueProblems(decision: DecisionRecord, roles: Readonly<Record<string, string>>): readonly string[] {
  const entries = noIssueEntries(decision);
  if (entries.length === 0) return [];
  const out: string[] = [];
  for (const e of entries)
    if (e.revision === undefined) out.push(`its entry "${e.entry}" is not "no-issue" and a revision of 7 to 64 lowercase hexadecimal characters`);
  if (decision.approvedBy.trim() === "" || Object.values(roles).includes(decision.approvedBy))
    out.push("approvedBy does not name a person (it is empty or is a role)");
  if (decision.decidedOn === undefined || dayOf(decision.decidedOn) === undefined) out.push("decidedOn is not a day (YYYY-MM-DD)");
  if (decision.reason === undefined || decision.reason.trim() === "") out.push("it states no reason");
  return out;
}

/** The word a Decision's `covers` entry starts with when it waives the signed-commit rule for a bot account that signs through the host: `signing-waiver <account> <key>`. */
export const SIGNING_WAIVER = "signing-waiver";

/** A waiver of the signed-commit rule for one account and one key, with the Decision that authorizes it. */
export type SigningWaiver = {
  /** The Decision that names the account and the key. */
  readonly decision: string;
  /** The role that approved it (0020-ifccm FR-019). */
  readonly approvedBy: string;
  /** The account that signs, as its commits' committer address is written: `noreply@github.com` for GitHub's own. */
  readonly account: string;
  /** The key, by its fingerprint or its key id, as Git reports it for a signed commit. */
  readonly key: string;
};

