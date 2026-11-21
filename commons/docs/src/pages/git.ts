// Spec: 0001-docs FR-020
/**
 * What the history of the repository says (docs 0001-docs FR-020): where the work is (the files changed most in the last 90 days, the commits and the authors of each library, its bus factor: how few authors made half of its
 * commits, counted and never named), and which specifications changed after the tests that prove them (a proof that may no longer say what the requirement says). Read from `git log` at the build, in one pass; where the
 * history is not there (no repository, a shallow clone) the page says so and shows nothing made up.
 *
 * @module
 */
import { proc } from "@intellectual-frontiers/system";
import type { Build } from "../build.ts";
import { specPage } from "../links.ts";
import type { Block, Inline } from "../model.ts";

const text = (t: string): Inline => ({ kind: "text", text: t });
const code = (t: string): Inline => ({ kind: "code", text: t });
const th = (...hs: string[]): Inline[][] => hs.map((h) => [text(h)]);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** One commit of the log: its day, a stand-in for its author (a hash, never shown) and the files it changed. */
export interface Commit {
  readonly day: string;
  readonly who: string;
  readonly files: readonly string[];
}

const SEP = "\u0001";

/** The commits of `git log --name-only --pretty=format:%x01%cs%x01%ae` (newest first). */
export function parseLog(out: string): Commit[] {
  return out.split(SEP).slice(1).reduce<Commit[]>((acc, chunk, i, all) => {
    if (i % 2 === 1) return acc;
    const day = chunk;
    const rest = all[i + 1] ?? "";
    const [who = "", ...files] = rest.split("\n");
    acc.push({ day, who, files: files.filter((f) => f !== "") });
    return acc;
  }, []);
}

/** The library a path of the repository is in. */
export const libraryOfPath = (p: string): string => /^commons\/([a-z0-9-]+)\//.exec(p)?.[1] ?? (/^(tests|bin|agora)\//.test(p) ? "repository" : "");

/** How few authors made at least half of the commits: the bus factor, of a list of commits. */
export function busFactor(commits: readonly { readonly who: string }[]): number {
  const by = new Map<string, number>();
  for (const c of commits) by.set(c.who, (by.get(c.who) ?? 0) + 1);
  const sorted = [...by.values()].sort((a, b) => b - a);
  let n = 0;
  let sum = 0;
  for (const v of sorted) {
    sum += v;
    n += 1;
    if (sum * 2 >= commits.length) break;
  }
  return commits.length === 0 ? 0 : n;
}

const daysBetween = (a: string, z: string): number => Math.round((Date.parse(z) - Date.parse(a)) / 86_400_000);

/** The last day each file changed, from the log (newest first). */
export function lastChanged(commits: readonly Commit[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of commits) for (const f of c.files) if (!m.has(f)) m.set(f, c.day);
  return m;
}

async function readLog(b: Build): Promise<{ readonly commits: Commit[]; readonly shallow: boolean } | undefined> {
  try {
    const top = (await proc.run(["git", "rev-parse", "--show-toplevel"], { cwd: b.root })).stdout.trim();
    if (top === "") return undefined;
    const shallow = (await proc.run(["git", "rev-parse", "--is-shallow-repository"], { cwd: top })).stdout.trim() === "true";
    const r = await proc.run(["git", "log", "-n", "6000", "--name-only", `--pretty=format:${SEP}%cs${SEP}%an|%ae`, "--no-renames"], { cwd: top });
    if (!r.success) return undefined;
    return { commits: parseLog(r.stdout).map((c) => ({ ...c, who: hash(c.who) })), shallow };
  } catch {
    return undefined;
  }
}

const hash = (s: string): string => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};

/** The page: hotspots and ownership, and the specifications that changed after their tests. */
export async function gitPage(b: Build): Promise<void> {
  if (b.config.evidence === undefined) return;
  const log = await readLog(b);
  const blocks: Block[] = [];
  if (log === undefined || log.commits.length === 0) {
    blocks.push({ kind: "callout", tone: "note", title: "No history", blocks: [{ kind: "paragraph", inlines: [text("The history of the repository is not available to this build, so nothing is shown here.")] }] });
  } else {
    const { commits, shallow } = log;
    if (shallow || commits.length < 50) blocks.push({ kind: "callout", tone: "note", title: "Short history", blocks: [{ kind: "paragraph", inlines: [text(`This build has only ${plural(commits.length, "commit")} of history${shallow ? " (a shallow clone)" : ""}, so the numbers below are of that and not of the repository's whole life.`)] }] });
    const newest = commits[0]?.day ?? "";
    const recent = commits.filter((c) => daysBetween(c.day, newest) <= 90);
    const libs = new Map<string, Commit[]>();
    const files = new Map<string, number>();
    for (const c of recent) {
      const seen = new Set<string>();
      for (const f of c.files) {
        files.set(f, (files.get(f) ?? 0) + 1);
        const l = libraryOfPath(f);
        if (l !== "" && !seen.has(l)) {
          seen.add(l);
          libs.set(l, [...(libs.get(l) ?? []), c]);
        }
      }
    }
    blocks.push({ kind: "paragraph", inlines: [text(`${plural(recent.length, "commit")} in the 90 days to ${newest}. Authors are counted from their commits and are never named; the bus factor is how few of them made half of a library's commits.`)] });
    blocks.push({
      kind: "table",
      filter: "Filter the libraries",
      head: th("Library", "Commits", "Authors", "Bus factor", "Last change"),
      rows: [...libs].sort(([, x], [, y]) => y.length - x.length).map(([lib, cs]) => [
        [b.pages.some((p) => p.path === `overview/${lib}.html`) ? { kind: "link", href: { kind: "page", path: `overview/${lib}.html` }, children: [text(lib)] } : text(lib)],
        [text(String(cs.length))],
        [text(String(new Set(cs.map((c) => c.who)).size))],
        [text(String(busFactor(cs)))],
        [text(cs[0]?.day ?? "")],
      ]),
    });
    blocks.push({ kind: "heading", level: 2, id: "files", text: [text("Where the work is")] });
    blocks.push({ kind: "paragraph", inlines: [text("The files changed in the most commits of the last 90 days, generated files and lockfiles left out.")] });
    blocks.push({
      kind: "table",
      filter: "Filter the files",
      head: th("File", "Commits"),
      rows: [...files].filter(([f]) => !/(\.auto\.|bun\.lock|package-lock|\.baseline\.|enforcement\.tsv|registry\.tsv|\.generated\.)/.test(f)).sort(([a, x], [c, y]) => y - x || (a < c ? -1 : 1)).slice(0, 40).map(([f, n]) => [[{ kind: "link", href: { kind: "external", url: b.index.blob(f) }, children: [code(f)] }], [text(String(n))]]),
    });
    // a specification that changed after the tests that prove it
    const last = lastChanged(commits);
    const trace = b.trace;
    const drift: { id: string; spec: string; tests: string; n: number }[] = [];
    if (trace !== undefined) {
      for (const s of b.kit.specs) {
        const day = last.get(s.file);
        if (day === undefined) continue;
        const tests = [...trace.tests].filter(([k]) => k.startsWith(`${s.id} `)).flatMap(([, fs]) => fs);
        const days = [...new Set(tests)].map((f) => last.get(f)).filter((d): d is string => d !== undefined);
        if (days.length === 0) continue;
        const newestTest = days.sort().at(-1) ?? "";
        if (day > newestTest) drift.push({ id: s.id, spec: day, tests: newestTest, n: daysBetween(newestTest, day) });
      }
    }
    blocks.push({ kind: "heading", level: 2, id: "drift", text: [text("Specifications that changed after their tests")] });
    blocks.push({ kind: "paragraph", inlines: [text(drift.length === 0 ? "No specification was changed after the newest of the tests that prove it." : `${plural(drift.length, "specification")} were changed after the newest test that proves them: the requirements may now say what the tests no longer prove. The days between are how stale the proof may be.`)] });
    if (drift.length > 0) blocks.push({ kind: "table", filter: "Filter the specifications", head: th("Specification", "Specification changed", "Its tests changed", "Days"), rows: drift.sort((x, y) => y.n - x.n || (x.id < y.id ? -1 : 1)).slice(0, 80).map((d) => [[{ kind: "link", href: { kind: "page", path: specPage(d.id) }, children: [text(d.id)] }], [text(d.spec)], [text(d.tests)], [text(String(d.n))]]) });
  }
  b.add({ path: "quality/hotspots.html", title: "Hotspots and ownership", description: "Where the work is, how many authors each library has, and the specifications that changed after their tests.", section: "quality", group: "Quality", order: 7, blocks });
}
