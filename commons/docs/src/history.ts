// Spec: 0001-docs FR-016
/**
 * The history of the evidence (docs 0001-docs FR-016): the runs that `tools/history.ts` kept, read from `history/runs/*.json` beside the results, and what they say of a library over time: how its tests, its pass rate and its
 * duration moved, which tests began to fail in the latest run, which were fixed, which have been failing and which flap (they failed in some runs and passed in others). A test is known by the hash of its file and name; only
 * the failures of a run are kept, so a test that passed is a test that is not in the list of a run in which its library ran.
 *
 * @module
 */
import type { Evidence } from "./evidence.ts";

/** The counts and the failures of one library in one run. */
export interface HistoryLibrary {
  readonly tests: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly durationMs: number;
  readonly failing: readonly { readonly id: string; readonly name: string }[];
}

/** One run of the evidence. */
export interface HistoryRun {
  readonly at: string;
  readonly commit: string;
  readonly url: string;
  readonly libraries: Readonly<Record<string, HistoryLibrary>>;
  /** The libraries that left no report in the run. */
  readonly missing: readonly string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** A run read from its file, or why it cannot be. */
export function parseHistoryRun(text: string): { readonly value: HistoryRun } | { readonly error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { error: `is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!isRecord(json) || !isRecord(json["libraries"]) || typeof json["at"] !== "string") return { error: "is not a run of the history: it has no time and no libraries" };
  const libraries: Record<string, HistoryLibrary> = {};
  for (const [name, l] of Object.entries(json["libraries"])) {
    if (!isRecord(l)) continue;
    libraries[name] = {
      tests: num(l["tests"]),
      passed: num(l["passed"]),
      failed: num(l["failed"]),
      skipped: num(l["skipped"]),
      durationMs: num(l["durationMs"]),
      failing: (Array.isArray(l["failing"]) ? l["failing"] : []).filter(isRecord).map((f) => ({ id: String(f["id"] ?? ""), name: String(f["name"] ?? "") })),
    };
  }
  return { value: { at: json["at"], commit: typeof json["commit"] === "string" ? json["commit"] : "", url: typeof json["url"] === "string" ? json["url"] : "", libraries, missing: (Array.isArray(json["missing"]) ? json["missing"] : []).filter((m): m is string => typeof m === "string") } };
}

/** The runs in which a library ran, oldest first, at most the last `n`. */
export function runsOf(ev: Pick<Evidence, "history">, library: string, n = 30): readonly { readonly run: HistoryRun; readonly lib: HistoryLibrary }[] {
  return ev.history.flatMap((run) => (run.libraries[library] === undefined ? [] : [{ run, lib: run.libraries[library] as HistoryLibrary }])).slice(-n);
}

/** A test that moved: its identity and name. */
export interface Moved {
  readonly id: string;
  readonly name: string;
}

/** What the last runs of a library say of its tests that failed. */
export interface Movements {
  /** Failing in the latest run and not in the one before. */
  readonly newlyFailing: readonly Moved[];
  /** Failing in the run before and not in the latest. */
  readonly fixed: readonly Moved[];
  /** Failing in both. */
  readonly persistent: readonly Moved[];
  /** Flapping: failed in more than one separate stretch of the last runs, with passing runs between, and passing in the latest. */
  readonly flaky: readonly (Moved & { readonly episodes: number })[];
  /** The commits of the run before and of the latest, for the range between them. */
  readonly from: string | undefined;
  readonly to: string | undefined;
}

/**
 * How the failures of a library moved over its last runs.
 *
 * @param ev - the evidence
 * @param library - the library
 * @param window - how many of its last runs are looked at
 */
export function movementsOf(ev: Pick<Evidence, "history">, library: string, window = 20): Movements {
  const runs = runsOf(ev, library, window);
  const names = new Map<string, string>();
  for (const { lib } of runs) for (const f of lib.failing) names.set(f.id, f.name);
  const ids = (i: number): Set<string> => new Set(runs[i]?.lib.failing.map((f) => f.id) ?? []);
  const last = runs.length - 1;
  const now = last >= 0 ? ids(last) : new Set<string>();
  const before = last >= 1 ? ids(last - 1) : new Set<string>();
  const moved = (xs: Iterable<string>): Moved[] => [...xs].map((id) => ({ id, name: names.get(id) ?? id })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const flaky: (Moved & { episodes: number })[] = [];
  for (const id of names.keys()) {
    const seq = runs.map((_, i) => ids(i).has(id));
    const episodes = seq.filter((v, i) => v && (i === 0 || !seq[i - 1])).length;
    if (episodes >= 2 && !now.has(id)) flaky.push({ id, name: names.get(id) ?? id, episodes });
  }
  return {
    newlyFailing: last >= 1 ? moved([...now].filter((id) => !before.has(id))) : [],
    fixed: last >= 1 ? moved([...before].filter((id) => !now.has(id))) : [],
    persistent: last >= 1 ? moved([...now].filter((id) => before.has(id))) : moved(now),
    flaky: flaky.sort((a, b) => b.episodes - a.episodes || (a.name < b.name ? -1 : 1)),
    from: runs[last - 1]?.run.commit,
    to: runs[last]?.run.commit,
  };
}
