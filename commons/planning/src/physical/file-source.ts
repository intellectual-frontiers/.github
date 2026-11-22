// Spec: 0004-planning-sources FR-005
/**
 * A source over the files of an AnyFS store (0037-planning FR-029): it is written against a store that has read, write, list and cas, so the same source works over a folder, Git, S3, SSH, SQL or memory. A file
 * lens says how a kind of file reads (`parse`) and how a patch changes it (`edit`, `create`); this makes the source of it: it lists and reads the files under a prefix, finds the file that holds the thing a patch is
 * about, and writes the new text expecting the revision it read, so a file that changed in between is a conflict value and nothing is written.
 *
 * @example
 * ```ts
 * import { fileSource } from "./file-source.ts";
 * // fileSource(memoryStore(), markdownLens(), { place: "docs/" })
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Expect, expectAbsent, expectRev, parsePath, parsePrefix, parseRevision, type Path, type Prefix, describeProblem } from "@intellectual-frontiers/anyfs/governance";
import type { Capability, Observation, Patch } from "@intellectual-frontiers/planning/governance";
import type { Plan } from "@intellectual-frontiers/planning/logical";
import { type Acquired, type DefineProblem, defineSource, type Source, type SourceFinding, type SourceProblem } from "./source.ts";
import { isJournalPath } from "./catalog.ts";
import type { PlanningStoreBackend } from "./store.ts";

/** A file as the source read it. */
export type FileRead = { readonly path: string; readonly text: string; readonly rev: string; readonly observations: readonly Observation[] };

/** What a kind of file is to the source. */
export type FileLens = {
  readonly name: string;
  readonly capabilities: readonly Capability[];
  /** Whether a path is a file this source reads. */
  reads(path: string): boolean;
  /** The observations of a file and what could not be read in it. */
  parse(path: string, text: string): Promise<{ readonly observations: readonly Observation[]; readonly findings: readonly SourceFinding[] }>;
  /** The new text of a file for a patch about one of its observations: nothing where nothing changes. */
  edit(file: FileRead, patch: Patch): Result<string | undefined, SourceProblem>;
  /** The path and new text of a patch that names no observation (a new item), or an anchor for an item the place holds: nothing where nothing changes. */
  create?(patch: Patch, files: readonly FileRead[]): Result<{ readonly path: string; readonly text: string } | undefined, SourceProblem>;
  /** Reads the whole folder at once, where one thing is spread over files (an issue file and the event objects of its store): the observations, each with the path of the file it is written in as its locator. Used instead of `parse` and `across`. */
  parseAll?(files: readonly { readonly path: string; readonly text: string }[]): Promise<{ readonly observations: readonly Observation[]; readonly findings: readonly SourceFinding[] }>;
  /** Findings that need the whole folder (a barrel that lists a file that is not there). */
  across?(files: readonly { readonly path: string; readonly text: string }[]): readonly SourceFinding[];
};

/** The folder of a store that a place names: `.` is the root of the store, and a trailing slash is not part of it. */
export const folderOf = (place: string): string => place.replace(/^\.\/?/u, "").replace(/\/$/u, "");

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** A source of the files under `place` (a prefix of the store, empty for its root) read by `lens`. */
export function fileSource(backend: PlanningStoreBackend, lens: FileLens, place: string): Result<Source, DefineProblem> {
  const prefix: Result<Prefix, string> = parsePrefix(folderOf(place));
  const readAll = async (): Promise<Result<{ readonly files: readonly FileRead[]; readonly findings: readonly SourceFinding[] }, SourceProblem>> => {
    if (prefix.kind === "err") return err({ kind: "read", message: prefix.error });
    const paths: Path[] = [];
    let after: Parameters<PlanningStoreBackend["list"]>[1];
    for (;;) {
      const page = await backend.list(prefix.value, after);
      if (page.kind === "err") return err({ kind: "read", message: describeProblem(page.error) });
      paths.push(...page.value.entries.map((e) => e.path));
      if (page.value.next === undefined) break;
      after = { after: page.value.next };
    }
    let files: FileRead[] = [];
    const findings: SourceFinding[] = [];
    const raw: { path: string; text: string }[] = [];
    for (const path of paths.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (isJournalPath(path) || !lens.reads(path)) continue;
      const read = await backend.read(path);
      if (read.kind === "err") {
        findings.push({ path, message: describeProblem(read.error) });
        continue;
      }
      const text = decoder.decode(read.value.bytes);
      raw.push({ path, text });
      if (lens.parseAll === undefined) {
        const parsed = await lens.parse(path, text);
        findings.push(...parsed.findings);
        files.push({ path, text, rev: read.value.rev, observations: parsed.observations });
      } else files.push({ path, text, rev: read.value.rev, observations: [] });
    }
    if (lens.parseAll !== undefined) {
      const all = await lens.parseAll(raw);
      findings.push(...all.findings);
      files = files.map((f) => ({ ...f, observations: all.observations.filter((o) => o.locator.kind === "file-span" && o.locator.path === f.path) }));
    }
    findings.push(...(lens.across?.(raw) ?? []));
    return ok({ files, findings });
  };
  const acquire = async (): Promise<Result<Acquired, SourceProblem>> => {
    const all = await readAll();
    if (all.kind === "err") return all;
    return ok({ observations: all.value.files.flatMap((f) => f.observations), findings: all.value.findings });
  };
  const writing = lens.capabilities.some((c) => c !== "read");
  return defineSource({
    name: lens.name,
    place,
    capabilities: lens.capabilities,
    acquire,
    ...(writing
      ? {
          preview: async (patch: Patch): Promise<Result<Plan, SourceProblem>> => {
            const all = await readAll();
            if (all.kind === "err") return all;
            const plan = (effects: Plan["effects"]): Plan => ({ source: lens.name, place, patch, effects });
            if (patch.fingerprint === undefined) {
              if (lens.create === undefined) return err({ kind: "unexpressed", reason: `${lens.name} cannot make an item` });
              const made = lens.create(patch, all.value.files);
              if (made.kind === "err") return made;
              if (made.value === undefined) return ok(plan([]));
              const have = all.value.files.find((f) => f.path === made.value?.path);
              return ok(plan([{ target: made.value.path, expect: have?.rev ?? null, after: made.value.text, summary: `${have === undefined ? "make" : "change"} ${made.value.path}` }]));
            }
            const file = all.value.files.find((f) => f.observations.some((o) => o.fingerprint === patch.fingerprint));
            if (file === undefined) return err({ kind: "refused", message: `no thing with the fingerprint ${patch.fingerprint} is read in ${place}` });
            const after = lens.edit(file, patch);
            if (after.kind === "err") return after;
            if (after.value === undefined || after.value === file.text) return ok(plan([]));
            return ok(plan([{ target: file.path, expect: file.rev, after: after.value, summary: `change ${file.path}` }]));
          },
          write: async (plan: Plan): Promise<Result<Acquired, SourceProblem>> => {
            for (const e of plan.effects) {
              if (isJournalPath(e.target)) return err({ kind: "refused", message: `${e.target} is a journal: no source changes it` });
              const path = parsePath(e.target);
              if (path.kind === "err") return err({ kind: "refused", message: path.error });
              let expect: Expect = expectAbsent;
              if (e.expect !== null) {
                const rev = parseRevision(e.expect);
                if (rev.kind === "err") return err({ kind: "refused", message: rev.error });
                expect = expectRev(rev.value);
              }
              const w = await backend.write(path.value, encoder.encode(e.after), expect);
              if (w.kind === "err") return w.error.kind === "conflict" ? err({ kind: "conflict", path: e.target, message: `${e.target} changed since it was read: ${describeProblem(w.error)}` }) : err({ kind: "refused", message: describeProblem(w.error) });
            }
            return acquire();
          },
        }
      : {}),
  });
}
