/**
 * The capability view and the trace, offline (commons 0020-ifccm FR-035 to FR-038): for each capability a range of commits serves, the requirements it concerns, and for each requirement the
 * terms, the code and the tests that link it, placed on the rungs of the ladder, with the stage where its chain ends. No Git host is asked: a capability is a change request a commit's `Refs #N` or
 * `Closes #N` line names, and everything else is read from files.
 *
 * @remarks
 * Pure: the commits (their messages, the files they changed and the requirements their changes to a `spec.md` added or edited), the specifications, the ontology's citations (`mz:definedBy`),
 * the source and test files (`Spec:` and `Proves:` lines, `proves` calls) and the cases of a quality run are arguments, and so are the bodies and titles of the change requests, where a harness
 * has kept them as a JSON file (`parseIssues`). A requirement concerns a capability when a commit of it names the requirement in its message, a commit changed the requirement's line in its
 * specification, the change request's `Done when` names it, or a source or test file a commit changed cites it. The chain of each requirement is {@link traceOf}'s, so that the stages are the
 * ones of `ifccm:TraceStage`; each artefact is then placed on the rung whose home matches it most specifically (`kernel/layers.ts`), and an artefact no home matches is on the rung `-`.
 * Output is data ({@link traceJson}, deterministic: sorted, no clock, LF) and a table of text ({@link traceTable}).
 *
 * @limits
 * It reads text, not syntax, as `kernel/trace.ts` does; the files it reads are those of the tree it is given, so a file a commit deleted is not a link; and a capability is only what a commit
 * names, so work that no commit refers to is listed apart (`unreferenced`) and in no capability.
 *
 * @example
 * ```ts
 * import { capabilityTrace, traceTable } from "./capability-trace.ts";
 * const t = capabilityTrace({
 *   commits: [{ sha: "a".repeat(40), subject: "Add it", message: "Add it\n\nRefs #3\n", files: ["src/a.ts"], requirements: ["0001-x FR-001"] }],
 *   issues: [], specs: [{ slug: "0001-x", spec: "- **FR-001**: It MUST work.\n" }], terms: [], sources: [], tests: [], cases: [], rungs: [],
 * });
 * traceTable(t).split("\n")[2]?.startsWith("#3"); // true
 * ```
 *
 * @module
 */
import { absurd, array, formatDecodeError, integer, object, string, err, ok, type Result } from "@intellectual-frontiers/core";
import { type Ladder, placeOf } from "../../kernel/layers.ts";
import { type Cited, type OntologyCitation, parseSpec, proofsOf, type SourceFile, specLines } from "../../kernel/trace.ts";
import { parseMessage } from "./commit-message.ts";
import { doneWhenRequirements, parseIssueBody, requirementsIn } from "./issue-body.ts";
import { firstBreak, type RunCase, type SpecSource, type Stage, type StageResult, traceOf } from "./trace.ts";

/** A commit as the trace reads it: its object name, subject, whole message, the files it changed and the requirements (`NNNN-slug FR-nnn`) whose lines in a `spec.md` it added or edited. */
export type CapabilityCommit = {
  readonly sha: string;
  readonly subject: string;
  readonly message: string;
  readonly files: readonly string[];
  readonly requirements: readonly string[];
};

/** A change request as a harness keeps it offline: its number and, where it has them, its title and body. */
export type IssueFact = { readonly number: number; readonly title?: string; readonly body?: string };

/** A rung as the trace places files on it: its identifier, its label and its homes (globs; a trailing `/` is everything under a folder). */
export type TraceRung = { readonly id: string; readonly label: string; readonly homes: readonly string[] };

/** What the trace reads. */
export type CapabilityTraceInput = {
  readonly commits: readonly CapabilityCommit[];
  readonly issues: readonly IssueFact[];
  readonly specs: readonly SpecSource[];
  /** The ontology's citations: each term, the requirements it cites (`mz:definedBy`) and, where known, the file that states it. */
  readonly terms: readonly OntologyCitation[];
  readonly sources: readonly SourceFile[];
  readonly tests: readonly SourceFile[];
  readonly cases: readonly RunCase[];
  readonly rungs: readonly TraceRung[];
  /** Where a specification's `spec.md` is, from the root of the repository (`specs/<slug>/spec.md` where not given), so that it is placed on a rung. */
  readonly specPath?: (slug: string) => string;
};

/** The id of the rung of an artefact no rung's home matches. */
export const NO_RUNG = "-";

/** Why a requirement concerns a capability. */
export type Basis = "commit" | "spec" | "issue" | "code" | "test";

/** What links a requirement, on one rung. */
export type RungLinks = {
  readonly rung: string;
  readonly spec: readonly string[];
  readonly terms: readonly string[];
  readonly code: readonly string[];
  readonly tests: readonly string[];
};

/** One requirement of one capability. */
export type RequirementTrace = {
  readonly requirement: string;
  readonly basis: readonly Basis[];
  /** The stages of the chain, each linked or not (`ifccm:TraceStage`). */
  readonly stages: readonly StageResult[];
  /** The first stage with no link, or `undefined` where the chain is whole. */
  readonly endsAt: Stage | undefined;
  /** Terms, code and tests on each rung that has any, in the order of the rungs; one row on the rung `-` where nothing links the requirement. */
  readonly rungs: readonly RungLinks[];
};

/** One capability: a change request the commits name. */
export type CapabilityTrace = {
  readonly number: number;
  readonly title: string | undefined;
  /** The commits that name it, oldest first, by their object names. */
  readonly commits: readonly string[];
  /** Whether a commit of it says `Closes`. */
  readonly closed: boolean;
  /** The rungs its changed files are on. */
  readonly rungs: readonly string[];
  readonly requirements: readonly RequirementTrace[];
};

/** The trace of a range. */
export type CapabilityTraceResult = {
  readonly rungs: readonly { readonly id: string; readonly label: string }[];
  readonly capabilities: readonly CapabilityTrace[];
  /** The commits that name no change request of this repository. */
  readonly unreferenced: readonly string[];
};

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const numberOf = (id: string): number => Number(/(\d+)/.exec(id)?.[1] ?? Number.NaN);

/** The requirements (`NNNN-slug FR-nnn`) a cited requirement or range names in a specification. */
function expand(slug: string, have: readonly string[], c: Cited): readonly string[] {
  const ids =
    c.kind === "one"
      ? have.filter((id) => id === c.id)
      : have.filter((id) => numberOf(c.from) <= numberOf(id) && numberOf(id) <= numberOf(c.to));
  return ids.map((id) => `${slug} ${id}`);
}

/** The ladder of a list of rungs, for `placeOf`: the rungs are numbered in the order given and rely on nothing (the trace places files, it does not judge imports). */
function ladderOf(rungs: readonly TraceRung[]): Ladder {
  return rungs.map((r, i) => ({ number: i, name: r.id, homes: r.homes, mayRelyOn: [] }));
}

/** The trace of the capabilities a range of commits serves (0020-ifccm FR-035). */
export function capabilityTrace(input: CapabilityTraceInput): CapabilityTraceResult {
  const ladder = ladderOf(input.rungs);
  const rungOf = (path: string): string => {
    const p = placeOf(ladder, path);
    return p.kind === "one" ? p.rung.name : NO_RUNG;
  };
  const order = new Map(input.rungs.map((r, i) => [r.id, i]));
  const rungOrder = (a: string, b: string): number =>
    (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER) || byText(a, b);
  const requirementsOfSpec = new Map(input.specs.map((s) => [s.slug, parseSpec(s.slug, s.spec).requirements.map((r) => r.id)]));
  const known = (requirement: string): boolean => {
    const [slug = "", fr = ""] = requirement.split(" ");
    return requirementsOfSpec.get(slug)?.includes(fr) === true;
  };
  const termFile = new Map(input.terms.map((t) => [t.term, t.file]));
  const issue = new Map(input.issues.map((i) => [i.number, i]));
  const sourceText = new Map([...input.sources, ...input.tests].map((s) => [s.path, s.text]));

  // the capabilities: a commit belongs to each change request of this repository its message names on a line of its own
  const byNumber = new Map<number, { commits: CapabilityCommit[]; closed: boolean }>();
  const unreferenced: string[] = [];
  for (const c of input.commits) {
    const own = parseMessage(c.message).refs.filter((r) => r.repo === undefined);
    if (own.length === 0) unreferenced.push(c.sha);
    for (const r of own) {
      const entry = byNumber.get(r.number) ?? { commits: [], closed: false };
      if (!entry.commits.includes(c)) entry.commits.push(c);
      if (r.kind === "closes") entry.closed = true;
      byNumber.set(r.number, entry);
    }
  }

  const capabilities = [...byNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, entry]): CapabilityTrace => {
      const basis = new Map<string, Set<Basis>>();
      const add = (requirement: string, why: Basis): void => {
        if (!known(requirement)) return;
        const set = basis.get(requirement) ?? new Set<Basis>();
        set.add(why);
        basis.set(requirement, set);
      };
      const files = new Set<string>();
      for (const c of entry.commits) {
        for (const r of requirementsIn(c.message)) add(r, "commit");
        for (const r of c.requirements) add(r, "spec");
        for (const f of c.files) files.add(f);
      }
      const body = issue.get(number)?.body;
      if (body !== undefined) for (const r of doneWhenRequirements(parseIssueBody(body))) add(r, "issue");
      for (const f of files) {
        const text = sourceText.get(f);
        if (text === undefined) continue;
        const isTest = input.tests.some((t) => t.path === f);
        const cited = isTest
          ? proofsOf(text).map((p) => ({ spec: p.spec, requirement: p.requirement }))
          : specLines(text).flatMap((c) => c.requirements.map((requirement) => ({ spec: c.spec, requirement })));
        for (const c of cited)
          for (const r of expand(c.spec, requirementsOfSpec.get(c.spec) ?? [], c.requirement)) add(r, isTest ? "test" : "code");
      }
      const requirements = [...basis.entries()]
        .sort(([a], [b]) => byText(a, b))
        .map(([requirement, why]): RequirementTrace => {
          const chain = traceOf(requirement, {
            specs: input.specs,
            terms: input.terms,
            sources: input.sources,
            tests: input.tests,
            cases: input.cases,
          });
          const by = (stage: Stage): readonly string[] => chain.stages.find((s) => s.stage === stage)?.by ?? [];
          const placed = new Map<string, { spec: string[]; terms: string[]; code: string[]; tests: string[] }>();
          const slot = (rung: string): { spec: string[]; terms: string[]; code: string[]; tests: string[] } => {
            const have = placed.get(rung) ?? { spec: [], terms: [], code: [], tests: [] };
            placed.set(rung, have);
            return have;
          };
          if (by("StageRequirement").length > 0) {
            const path = input.specPath?.(requirement.split(" ")[0] ?? "") ?? by("StageRequirement")[0] ?? "";
            slot(rungOf(path)).spec.push(path);
          }
          for (const t of by("StageTerm")) {
            const file = termFile.get(t);
            slot(file === undefined ? NO_RUNG : rungOf(file)).terms.push(t);
          }
          for (const f of by("StageCode")) slot(rungOf(f)).code.push(f);
          for (const f of by("StageTest")) slot(rungOf(f)).tests.push(f);
          if (placed.size === 0) slot(NO_RUNG);
          return {
            requirement,
            basis: [...why].sort(byText),
            stages: chain.stages,
            endsAt: firstBreak(chain),
            rungs: [...placed.entries()]
              .sort(([a], [b]) => rungOrder(a, b))
              .map(([rung, v]) => ({
                rung,
                spec: v.spec.sort(byText),
                terms: v.terms.sort(byText),
                code: v.code.sort(byText),
                tests: v.tests.sort(byText),
              })),
          };
        });
      return {
        number,
        title: issue.get(number)?.title ?? entry.commits[0]?.subject,
        commits: entry.commits.map((c) => c.sha),
        closed: entry.closed,
        rungs: [...new Set([...files].map(rungOf))].sort(rungOrder),
        requirements,
      };
    });
  return { rungs: input.rungs.map((r) => ({ id: r.id, label: r.label })), capabilities, unreferenced };
}

/** The trace as deterministic JSON (2-space indent, LF, one newline at the end): the same text for the same input, so that it can be kept and compared. */
export function traceJson(t: CapabilityTraceResult): string {
  const view = {
    rungs: t.rungs,
    capabilities: t.capabilities.map((c) => ({
      number: c.number,
      title: c.title ?? null,
      closed: c.closed,
      commits: c.commits,
      rungs: c.rungs,
      requirements: c.requirements.map((r) => ({
        requirement: r.requirement,
        basis: r.basis,
        endsAt: r.endsAt ?? null,
        stages: r.stages.map((s) => ({ stage: s.stage, linked: s.linked, by: s.by })),
        rungs: r.rungs.map((x) => ({ rung: x.rung, spec: x.spec, terms: x.terms, code: x.code, tests: x.tests })),
      })),
    })),
    unreferenced: t.unreferenced,
  };
  return `${JSON.stringify(view, null, 2)}\n`;
}

/** A list in a cell: its first item and how many more, or `-` where there are none. */
function cell(items: readonly string[]): string {
  const first = items[0];
  return first === undefined ? "-" : items.length === 1 ? first : `${first} (+${items.length - 1})`;
}

/** The trace as a table of text, one line for each requirement on each rung, with the stage where its chain ends (`whole` where it does not). */
export function traceTable(t: CapabilityTraceResult): string {
  const header = ["CAPABILITY", "REQUIREMENT", "RUNG", "SPEC", "TERMS", "CODE", "TESTS", "ENDS AT"];
  const rows: string[][] = [];
  for (const c of t.capabilities) {
    const title = `#${c.number}${c.closed ? "" : "*"}`;
    if (c.requirements.length === 0) rows.push([title, "-", c.rungs.join(",") || NO_RUNG, "-", "-", "-", "-", "no requirement"]);
    for (const r of c.requirements)
      for (const x of r.rungs)
        rows.push([title, r.requirement, x.rung, cell(x.spec), cell(x.terms), cell(x.code), cell(x.tests), r.endsAt ?? "whole"]);
  }
  const width = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = (r: readonly string[]): string =>
    r
      .map((v, i) => v.padEnd(width[i] ?? 0))
      .join("  ")
      .trimEnd();
  const out = [line(header), line(width.map((w) => "-".repeat(w))), ...rows.map(line)];
  if (t.capabilities.some((c) => !c.closed)) out.push("", "* the capability is open: no commit of it says Closes");
  if (t.unreferenced.length > 0)
    out.push("", `${t.unreferenced.length} commit(s) name no change request: ${t.unreferenced.map((s) => s.slice(0, 7)).join(", ")}`);
  return `${out.join("\n")}\n`;
}

const issueDecoder = object({ number: integer }, { title: string, body: string });

/** The change requests of a JSON file a harness keeps offline: an array of `{ number, title?, body? }`, or an object with that array as `issues`. */
export function parseIssues(text: string): Result<readonly IssueFact[], string> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return err(`not JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const list: unknown = typeof json === "object" && json !== null && !Array.isArray(json) ? Reflect.get(json, "issues") : json;
  const r = array(issueDecoder)(list, "issues");
  if (r.kind === "err") return err(formatDecodeError(r.error));
  return ok(
    r.value.map((i) => ({
      number: i.number,
      ...(i.title === undefined ? {} : { title: i.title }),
      ...(i.body === undefined ? {} : { body: i.body }),
    })),
  );
}

/** The kinds of output the command gives. */
export type TraceFormat = "text" | "json";

/** The trace in a format. */
export function traceOutput(t: CapabilityTraceResult, format: TraceFormat): string {
  switch (format) {
    case "json":
      return traceJson(t);
    case "text":
      return traceTable(t);
    default:
      return absurd(format);
  }
}
