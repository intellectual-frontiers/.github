// Spec: 0001-docs FR-028
/**
 * What a change touches and what proves it (docs 0001-docs FR-028): the files changed since the commit the tests of the evidence ran on (or, where that commit is not in the history, in the last thirty commits), by library, and for each
 * changed source file the line coverage, the mutation score and the open issues that name it. A file that was added or changed and that no test reaches is the new code with nothing to prove it. It is read from `git diff` at the
 * build; where the history is not there the page says so.
 *
 * @module
 */
import { proc } from "@intellectual-frontiers/system";
import type { Build } from "../build.ts";
import { specPage } from "../links.ts";
import type { Block, Inline } from "../model.ts";
import { percent } from "../coverage.ts";
import { scoreOf } from "../mutation.ts";
import { libraryOfPath } from "./git.ts";
import { issuesNamingFile } from "./quality.ts";

const text = (t: string): Inline => ({ kind: "text", text: t });
const code = (t: string): Inline => ({ kind: "code", text: t });
const th = (...hs: string[]): Inline[][] => hs.map((h) => [text(h)]);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** One changed path: `A` added, `M` modified, `D` deleted. */
export interface Change {
  readonly status: "A" | "M" | "D";
  readonly path: string;
}

/** The changes of `git diff --name-status --no-renames`. */
export function parseNameStatus(out: string): Change[] {
  return out.split("\n").flatMap((l): Change[] => {
    const [s, ...rest] = l.split("\t");
    const path = rest.join("\t");
    return (s === "A" || s === "M" || s === "D") && path !== "" ? [{ status: s, path }] : [];
  });
}

/** What a changed path is: source of a library, a test, a specification, or anything else (generated files and lockfiles are left out). */
export function kindOfPath(p: string): "source" | "test" | "spec" | "other" {
  if (/(\.auto\.|bun\.lock|package-lock|\.baseline\.|enforcement\.tsv|registry\.tsv|\.generated\.)/.test(p)) return "other";
  if (/\/spec-kit\/specs\/[^/]+\/spec\.md$/.test(p) || /^spec-kit\/specs\/[^/]+\/spec\.md$/.test(p)) return "spec";
  if (/(^|\/)(suite|tests)\//.test(p) || /\.test\.[cm]?[jt]sx?$/.test(p)) return "test";
  if (/^commons\/[a-z0-9-]+\/src\/.+\.ts$/.test(p)) return "source";
  return "other";
}

async function git(root: string, ...args: string[]): Promise<string | undefined> {
  try {
    const r = await proc.run(["git", ...args], { cwd: root });
    return r.success ? r.stdout : undefined;
  } catch {
    return undefined;
  }
}

/** The changes since a commit, or in the last thirty commits where it is not known; with how many commits and what the base was. */
async function changesOf(b: Build): Promise<{ readonly changes: Change[]; readonly commits: number; readonly base: string; readonly fromTests: boolean } | undefined> {
  const top = (await git(b.root, "rev-parse", "--show-toplevel"))?.trim();
  if (top === undefined || top === "") return undefined;
  // a site made of a folder inside another repository has no history of its own
  if ((await git(b.root, "rev-parse", "--show-prefix"))?.trim() !== "") return undefined;
  const tested = b.evidence.run?.commit;
  let base: string | undefined;
  let fromTests = false;
  if (tested !== undefined && tested !== "" && (await git(top, "cat-file", "-e", `${tested}^{commit}`)) !== undefined) {
    base = tested;
    fromTests = true;
  } else if ((await git(top, "rev-parse", "--verify", "-q", "HEAD~30")) !== undefined) base = "HEAD~30";
  if (base === undefined) return undefined;
  const diff = await git(top, "diff", "--name-status", "--no-renames", `${base}..HEAD`);
  const count = await git(top, "rev-list", "--count", `${base}..HEAD`);
  if (diff === undefined) return undefined;
  return { changes: parseNameStatus(diff), commits: Number(count?.trim() ?? "0") || 0, base: base === "HEAD~30" ? "the last thirty commits" : base.slice(0, 10), fromTests };
}

/** The page of what changed and what proves it. */
export async function impactPage(b: Build): Promise<void> {
  if (b.config.evidence === undefined) return;
  const ev = b.evidence;
  const found = await changesOf(b);
  const blocks: Block[] = [];
  if (found === undefined) {
    blocks.push({ kind: "callout", tone: "note", title: "No history", blocks: [{ kind: "paragraph", inlines: [text("The history of the repository is not available to this build (or has fewer than thirty commits), so what changed is not shown.")] }] });
  } else {
    const live = found.changes.filter((c) => c.status !== "D");
    const kinds = (k: ReturnType<typeof kindOfPath>) => live.filter((c) => kindOfPath(c.path) === k);
    blocks.push({ kind: "paragraph", inlines: [text(found.fromTests
      ? `${plural(found.commits, "commit")} since ${found.base}, the commit the tests of the evidence ran on: ${plural(kinds("source").length, "source file")}, ${plural(kinds("test").length, "test file")} and ${plural(kinds("spec").length, "specification")} changed. The test results elsewhere on this site do not include these changes.`
      : `${plural(found.commits, "commit")} in ${found.base}: ${plural(kinds("source").length, "source file")}, ${plural(kinds("test").length, "test file")} and ${plural(kinds("spec").length, "specification")} changed. The commit the tests ran on is not in this history, so the window is a fixed one.`)] });
    const byLib = new Map<string, Change[]>();
    for (const c of live) {
      const l = libraryOfPath(c.path);
      if (l !== "" && kindOfPath(c.path) !== "other") byLib.set(l, [...(byLib.get(l) ?? []), c]);
    }
    const hasPage = (l: string): boolean => b.pages.some((p) => p.path === `quality/${l}.html`);
    blocks.push({
      kind: "table",
      filter: "Filter the libraries",
      head: th("Library", "Source", "Tests", "Specifications", "Source changed with no test changed"),
      rows: [...byLib].sort(([x], [y]) => (x < y ? -1 : 1)).map(([l, cs]) => {
        const n = (k: ReturnType<typeof kindOfPath>): number => cs.filter((c) => kindOfPath(c.path) === k).length;
        return [[hasPage(l) ? { kind: "link", href: { kind: "page", path: `quality/${l}.html` }, children: [text(l)] } : text(l)], [text(String(n("source")))], [text(String(n("test")))], [text(String(n("spec")))], [text(n("source") > 0 && n("test") === 0 ? "yes" : "")]];
      }),
    });
    const sources = kinds("source");
    const rows = sources.map((c) => {
      const lib = libraryOfPath(c.path);
      const cov = ev.coverage.get(lib)?.files.find((f) => f.path === c.path);
      const mut = [...ev.mutation.values()].flatMap((m) => m.files).find((f) => f.path === c.path);
      const open = issuesNamingFile(b, c.path);
      return { c, cov, mut, issues: open.issues.length + open.tickets.length, covered: cov === undefined ? undefined : percent([cov]) };
    }).sort((x, y) => (x.covered ?? -1) - (y.covered ?? -1) || (x.c.path < y.c.path ? -1 : 1));
    blocks.push({ kind: "heading", level: 2, id: "files", text: [text("Changed source files")] });
    blocks.push({ kind: "paragraph", inlines: [text("Least covered first. Coverage is of the file as the tests ran, before these changes; a file added since then has none (shown as new), which is the new code that nothing proves yet.")] });
    blocks.push({
      kind: "table",
      filter: "Filter the files",
      head: th("File", "Change", "Coverage", "Mutation score", "Open issues"),
      rows: rows.slice(0, 80).map(({ c, cov, mut, issues, covered }) => [
        [{ kind: "link", href: { kind: "external", url: b.index.blob(c.path) }, children: [code(c.path)] }],
        [text(c.status === "A" ? "added" : "changed")],
        [text(cov === undefined ? (c.status === "A" ? "new" : "none recorded") : `${covered}%`)],
        [text(mut === undefined || scoreOf([mut]) === undefined ? "" : `${scoreOf([mut])}%`)],
        [text(issues === 0 ? "" : String(issues))],
      ]),
    });
    const specs = kinds("spec");
    if (specs.length > 0) {
      blocks.push({ kind: "heading", level: 2, id: "specifications", text: [text("Specifications changed")] });
      blocks.push({ kind: "list", ordered: false, items: specs.slice(0, 60).map((c) => {
        const id = /\/specs\/([^/]+)\/spec\.md$/.exec(c.path)?.[1] ?? "";
        return [{ kind: "paragraph" as const, inlines: [id === "" || !b.pages.some((p) => p.path === specPage(id)) ? code(id === "" ? c.path : id) : { kind: "link" as const, href: { kind: "page" as const, path: specPage(id) }, children: [text(id)] }, text(c.status === "A" ? " (new)" : "")] }];
      }) });
    }
  }
  b.add({ path: "quality/changes.html", title: "What changed", description: "The files changed since the tests last ran, by library, with the coverage, mutation score and open issues of each source file.", section: "quality", group: "Quality", order: 9, blocks });
}
