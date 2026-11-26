// Spec: 0002-assurance-lenses FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The lenses of an assurance dossier (commons dossier-assurance 0002-assurance-lenses FR-002 to FR-006): `acceptance` (a case with each step's result and who attested it), `findings` (a plan of action and milestones of what is open), `posture` (how each requirement
 * stands, with counts and never a percentage) and `negative-space` (what has no evidence, has gone stale, is not met or is only partly met). Each cites its sources, says how old they are, and says so where it has none.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Block, Inline, Json, Lens, Source } from "@intellectual-frontiers/dossier/governance";
import { ageDays, cite, code, defineLens, emptyPlate, erase, freshness, plateOf, slugOf, text } from "@intellectual-frontiers/dossier/logical";
import { decodeFindings, decodeGaps, decodeReading, decodeRecord, decodeRun, type Finding, GAP_KIND, KINDS, LEDGER_KINDS, type Reading } from "@intellectual-frontiers/dossier-assurance/governance";

/** The parameters of a lens: a title. */
export interface TitleParams {
  readonly title: string;
}

const title = (raw: unknown): Result<TitleParams, string> => (typeof raw === "object" && raw !== null && "title" in raw && typeof raw.title === "string" && raw.title !== "" ? ok({ title: raw.title }) : err("the parameters are { title }"));

const t = (s: string): readonly Inline[] => [text(s)];

const decoded = <T>(ss: readonly Source[], f: (j: Json) => Result<T, string>): Result<readonly { readonly source: Source; readonly value: T }[], string> => {
  const out: { source: Source; value: T }[] = [];
  for (const s of ss) {
    const r = f(s.body);
    if (r.kind === "err") return err(`source ${s.id}: ${r.error}`);
    out.push({ source: s, value: r.value });
  }
  return ok(out);
};

const refuse = (code_: string, message: string) => err({ code: code_, message });

/** The acceptance of cases: for each run, its steps with the result and who made each, and whether a person approved it. */
export const acceptanceLens: Lens<TitleParams> = defineLens<TitleParams>({
  id: "acceptance",
  version: "1.0.0",
  title: "Acceptance",
  inputs: [KINDS.acceptance],
  ceiling: "internal",
  decode: title,
  plate: ({ sources, params, asOf }) => {
    const runs = decoded(sources, decodeRun);
    if (runs.kind === "err") return refuse("acceptance-body", runs.error);
    if (runs.value.length === 0) return ok(emptyPlate({ id: "acceptance", ceiling: "internal" }, params.title, "an acceptance run"));
    const ordered = [...runs.value].sort((a, b) => (a.value.case < b.value.case ? -1 : a.value.case > b.value.case ? 1 : a.source.observedAt < b.source.observedAt ? -1 : 1));
    const blocks: Block[] = [];
    for (const { source, value: r } of ordered) {
      const count = (x: "pass" | "fail" | "not-run") => r.steps.filter((s) => s.result === x).length;
      const body: Block[] = [
        { t: "para", inlines: [text(`${r.title}${r.os === undefined ? "" : ` on ${r.os}`}: ${count("pass")} passed, ${count("fail")} failed, ${count("not-run")} not run. Evidence `), cite(source.id), text(` (${freshness(source.observedAt, asOf)}).`)] },
        { t: "table", head: ["Step", "Result", "By", "Note"], rows: r.steps.map((s) => [t(s.title), t(s.result), t(s.by), t(s.note ?? "")]) },
        r.approvedBy === undefined
          ? { t: "note", tone: "warning", inlines: t(`No person has approved ${r.case}: it is a record of a run and not yet an acceptance.`) }
          : { t: "note", tone: "note", inlines: t(`Approved by ${r.approvedBy}.`) },
      ];
      if (r.steps.some((s) => s.by === "person" && s.result === "not-run")) body.push({ t: "note", tone: "warning", inlines: t("A step that only a person can do has not been done.") });
      blocks.push({ t: "section", level: 2, id: `${slugOf(params.title)}-${slugOf(r.case)}-${slugOf(source.id)}`, title: r.case, blocks: body });
    }
    return ok(plateOf({ lens: { id: "acceptance", ceiling: "internal" }, title: params.title, blocks, cites: ordered.map((o) => o.source.id) }));
  },
});

const SEVERITY = ["critical", "high", "medium", "low"] as const;

/** The findings: the count of each standing, and the plan of action and milestones of what is open. The latest set that holds a finding gives its state. */
export const findingsLens: Lens<TitleParams> = defineLens<TitleParams>({
  id: "findings",
  version: "1.0.0",
  title: "Findings and plan of action",
  inputs: [KINDS.findings],
  ceiling: "internal",
  decode: title,
  plate: ({ sources, params }) => {
    const sets = decoded(sources, decodeFindings);
    if (sets.kind === "err") return refuse("findings-body", sets.error);
    const latest = new Map<string, { finding: Finding; source: Source }>();
    for (const { source, value } of sets.value) for (const f of value.findings) {
      const old = latest.get(f.id);
      if (old === undefined || old.source.observedAt <= source.observedAt) latest.set(f.id, { finding: f, source });
    }
    if (latest.size === 0) return ok(emptyPlate({ id: "findings", ceiling: "internal" }, params.title, "a finding, or of a test that looked for one"));
    const all = [...latest.values()];
    const count = (s: Finding["status"]) => all.filter((x) => x.finding.status === s).length;
    const open = all.filter((x) => x.finding.status === "open").sort((a, b) => SEVERITY.indexOf(a.finding.severity) - SEVERITY.indexOf(b.finding.severity) || (a.finding.id < b.finding.id ? -1 : 1));
    const blocks: Block[] = [
      { t: "para", inlines: t(`${all.length} findings: ${count("open")} open, ${count("accepted")} accepted, ${count("fixed")} fixed.`) },
      open.length === 0
        ? { t: "note", tone: "note", inlines: t("No finding is open.") }
        : { t: "table", head: ["Finding", "Severity", "Control", "Milestone", "Due", "Evidence"], rows: open.map(({ finding: f, source }) => [t(`${f.id}: ${f.title}`), t(f.severity), t(f.control ?? ""), t(f.milestone ?? "no milestone"), t(f.due ?? "no date"), [cite(source.id)]]) },
    ];
    const noPlan = open.filter((x) => x.finding.milestone === undefined || x.finding.due === undefined);
    if (noPlan.length > 0) blocks.push({ t: "note", tone: "warning", inlines: t(`${noPlan.length} open findings have no milestone or no date: ${noPlan.map((x) => x.finding.id).join(", ")}.`) });
    return ok(plateOf({ lens: { id: "findings", ceiling: "internal" }, title: params.title, blocks, cites: all.map((x) => x.source.id) }));
  },
});

const latestReadings = (ss: readonly Source[]): Result<ReadonlyMap<string, { reading: Reading; source: Source }>, string> => {
  const rs = decoded(ss, decodeReading);
  if (rs.kind === "err") return rs;
  const m = new Map<string, { reading: Reading; source: Source }>();
  for (const { source, value } of rs.value) {
    const old = m.get(value.requirement);
    if (old === undefined || old.source.observedAt <= source.observedAt) m.set(value.requirement, { reading: value, source });
  }
  return ok(m);
};

/** How each requirement stands: one row each from its latest reading, and the count of each standing (never a percentage). */
export const postureLens: Lens<TitleParams> = defineLens<TitleParams>({
  id: "posture",
  version: "1.1.0",
  title: "Posture",
  inputs: [KINDS.reading],
  ceiling: "internal",
  decode: title,
  plate: ({ sources, params, asOf }) => {
    const m = latestReadings(sources);
    if (m.kind === "err") return refuse("reading-body", m.error);
    if (m.value.size === 0) return ok(emptyPlate({ id: "posture", ceiling: "internal" }, params.title, "how a requirement stands"));
    const rows = [...m.value.values()].sort((a, b) => (a.reading.requirement < b.reading.requirement ? -1 : 1));
    const n = (s: Reading["standing"]) => rows.filter((r) => r.reading.standing === s).length;
    const titled = rows.some((r) => r.reading.title !== undefined);
    const answered = rows.some((r) => r.reading.answers !== undefined);
    return ok(
      plateOf({
        lens: { id: "posture", ceiling: "internal" },
        title: params.title,
        blocks: [
          { t: "para", inlines: t(`Of ${rows.length} requirements: ${n("met")} met, ${n("partial")} partly met, ${n("not-met")} not met, ${n("no-evidence")} with no evidence.`) },
          {
            t: "table",
            head: ["Requirement", ...(titled ? ["Title"] : []), "Standing", ...(answered ? ["Answers"] : []), "Evidence"],
            rows: rows.map((r) => [[code(r.reading.requirement)], ...(titled ? [t(r.reading.title ?? "")] : []), t(r.reading.standing), ...(answered ? [t(r.reading.answers ?? "")] : []), [cite(r.source.id), text(`, ${freshness(r.source.observedAt, asOf)}`)]]),
          },
        ],
        cites: rows.map((r) => r.source.id),
      }),
    );
  },
});

/** The parameters of the negative space: the requirements that should have a reading, and how old a reading may be. */
export interface GapParams extends TitleParams {
  readonly requirements: readonly string[];
  readonly maxAgeDays: number;
}

const gapParams = (raw: unknown): Result<GapParams, string> => {
  const base = title(raw);
  if (base.kind === "err" || typeof raw !== "object" || raw === null) return err("the parameters are { title, requirements, maxAgeDays }");
  const reqs = "requirements" in raw ? raw.requirements : undefined;
  const age = "maxAgeDays" in raw ? raw.maxAgeDays : undefined;
  if (!Array.isArray(reqs) || !reqs.every((r) => typeof r === "string") || typeof age !== "number" || !Number.isInteger(age) || age < 0) return err("the parameters are { title, requirements, maxAgeDays }");
  return ok({ title: base.value.title, requirements: [...new Set(reqs as string[])].sort(), maxAgeDays: age });
};

/** What is wrong or missing: each requirement that has no reading, a reading older than the limit, or a standing that is not met; and how many show no gap. It hides nothing that another lens shows as met. */
export const negativeSpaceLens: Lens<GapParams> = defineLens<GapParams>({
  id: "negative-space",
  version: "1.0.0",
  title: "What is missing",
  inputs: [KINDS.reading],
  ceiling: "internal",
  decode: gapParams,
  plate: ({ sources, params, asOf }) => {
    const m = latestReadings(sources);
    if (m.kind === "err") return refuse("reading-body", m.error);
    const gaps: { requirement: string; why: string; source?: Source }[] = [];
    for (const r of params.requirements) {
      const got = m.value.get(r);
      if (got === undefined) gaps.push({ requirement: r, why: "no reading at all" });
      else if (got.reading.standing === "no-evidence") gaps.push({ requirement: r, why: "the reading says there is no evidence", source: got.source });
      else if (got.reading.standing === "not-met") gaps.push({ requirement: r, why: "not met", source: got.source });
      else if (got.reading.standing === "partial") gaps.push({ requirement: r, why: "only partly met", source: got.source });
      else if (ageDays(got.source.observedAt, asOf) > params.maxAgeDays) gaps.push({ requirement: r, why: `stale: ${ageDays(got.source.observedAt, asOf)} days old, and no more than ${params.maxAgeDays} is allowed`, source: got.source });
    }
    const blocks: Block[] = [
      { t: "para", inlines: t(`${gaps.length} of ${params.requirements.length} requirements show a gap; ${params.requirements.length - gaps.length} show none.`) },
      gaps.length === 0
        ? { t: "note", tone: "note", inlines: t("No requirement of the list has a gap.") }
        : { t: "table", head: ["Requirement", "Gap", "Evidence"], rows: gaps.map((g) => [[code(g.requirement)], t(g.why), g.source === undefined ? t("none") : [cite(g.source.id)]]) },
    ];
    return ok(plateOf({ lens: { id: "negative-space", ceiling: "internal" }, title: params.title, blocks, cites: gaps.flatMap((g) => (g.source === undefined ? [] : [g.source.id])) }));
  },
});

const KIND_TITLES: Readonly<Record<string, string>> = {
  "boundary-coverage": "Boundaries and what they hold",
  "asset-observation": "Assets as last observed",
  enrollment: "Enrollments",
  "apply-run": "Changes applied",
  "access-decision": "Access decisions",
  "audit-head": "The audit chain",
  "assessment-status": "Assessment status",
};

/** The ledger: every record of a thing observed, a section for each kind, each row with what it says, how old it is and the source it cites, and at the end what the collection looked for and did not find. */
export const ledgerLens: Lens<TitleParams> = defineLens<TitleParams>({
  id: "ledger",
  version: "1.0.0",
  title: "Evidence ledger",
  inputs: [...LEDGER_KINDS, GAP_KIND],
  ceiling: "internal",
  decode: title,
  plate: ({ sources, params, asOf }) => {
    const records = sources.filter((s) => s.kind !== GAP_KIND);
    const gapSources = sources.filter((s) => s.kind === GAP_KIND);
    if (records.length === 0 && gapSources.length === 0) return ok(emptyPlate({ id: "ledger", ceiling: "internal" }, params.title, "a record of something observed"));
    const blocks: Block[] = [];
    for (const kind of LEDGER_KINDS) {
      const of = records.filter((s) => s.kind === kind).sort((a, b) => (a.observedAt < b.observedAt ? 1 : a.observedAt > b.observedAt ? -1 : a.id < b.id ? -1 : 1));
      if (of.length === 0) continue;
      const rows: (readonly Inline[])[][] = [];
      for (const s of of) {
        const r = decodeRecord(s.body);
        if (r.kind === "err") return refuse("record-body", `source ${s.id}: ${r.error}`);
        const facts = Object.entries(r.value.facts).map(([k, v]) => `${k}: ${String(v)}`).join("; ");
        rows.push([t(r.value.subject), t(r.value.summary + (facts === "" ? "" : ` (${facts})`)), t(freshness(s.observedAt, asOf)), [cite(s.id)]]);
      }
      blocks.push({ t: "section", level: 2, id: `${slugOf(params.title)}-${slugOf(kind)}`, title: KIND_TITLES[kind] ?? kind, blocks: [{ t: "table", head: ["Subject", "What it says", "Age", "Evidence"], rows }] });
    }
    const missing: { collector: string; kind: string; reason: string }[] = [];
    for (const s of gapSources) {
      const g = decodeGaps(s.body);
      if (g.kind === "err") return refuse("gap-body", `source ${s.id}: ${g.error}`);
      missing.push(...g.value);
    }
    if (missing.length > 0) {
      blocks.push({
        t: "section",
        level: 2,
        id: `${slugOf(params.title)}-not-found`,
        title: "Looked for and not found",
        blocks: [{ t: "table", head: ["Kind", "Looked for by", "Why nothing"], rows: missing.map((g) => [[code(g.kind)], t(g.collector), t(g.reason)]) }, { t: "note", tone: "warning", inlines: t(`${missing.length} kind${missing.length === 1 ? "" : "s"} of evidence ${missing.length === 1 ? "was" : "were"} looked for and not found. This dossier says nothing about ${missing.length === 1 ? "it" : "them"}.`) }],
      });
    }
    return ok(plateOf({ lens: { id: "ledger", ceiling: "internal" }, title: params.title, blocks, cites: [...records, ...gapSources].map((s) => s.id) }));
  },
});

/** The lenses of this plugin, erased for a registry. */
export const ASSURANCE_LENSES: readonly Lens<unknown>[] = [erase(acceptanceLens), erase(findingsLens), erase(postureLens), erase(negativeSpaceLens), erase(ledgerLens)];
