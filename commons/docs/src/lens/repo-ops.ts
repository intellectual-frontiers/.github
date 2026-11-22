// Spec: 0001-docs FR-029
/**
 * The Repo Ops lens (commons 0001-docs FR-029): the section that says how a repository is operated. Its pages are written by people in Markdown, beside the code, and say what a reader needs once; the lens appends to a
 * page what can be read from the repository's own typed facts, so that it stays true: the workflows (from the typed definitions their files are made from), the commands of the operations program (from its verb definitions,
 * with each one's options and examples) and the facts of the release. It knows nothing of the repository's tools: what it shows is given to it as values, and a page that links elsewhere in the site does so by a Markdown link.
 *
 * @remarks
 * A page names the file it is written in, its address and its order; `generated` says which typed facts follow its words. A page that cannot be read is a finding and the others are made. The section is in the top bar when it has a page.
 *
 * @limits
 * It does not read a workflow file or run a program: the facts are the configuration's to make, and a fact it is not given is a table that says there is none, never a made-up row.
 *
 * @example
 * ```ts
 * import { repoOpsLens } from "@intellectual-frontiers/docs/lens/repo-ops";
 * repoOpsLens({ name: "repo-ops", pages: [{ file: "guides/ops-index.md", path: "repo-ops/index.html", order: 0 }] });
 * ```
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import type { Block, Inline, Lens, LensPages } from "../mod.ts";

/** One workflow, as the typed definitions say it. */
export interface OpsWorkflow {
  /** Its file, from the repository's root. */
  readonly file: string;
  /** Its name. */
  readonly name: string;
  /** What starts it: `push`, `pull_request`, `workflow_dispatch`, `schedule: 0 * * * *`. */
  readonly triggers: readonly string[];
  /** Its jobs, by id (the name of a job in a matrix is an expression, and the id is what a person looks for). */
  readonly jobs: readonly { readonly id: string; readonly name?: string }[];
  /** What it is for, in a sentence. */
  readonly purpose: string;
}

/** One verb of the operations program, as its own definition says it. */
export interface OpsVerb {
  /** The words a person types after the command: `release plan`. */
  readonly words: string;
  readonly summary: string;
  /** `read`, `mutate` or `destructive`. */
  readonly effect: string;
  /** The lowest tier that sees it. */
  readonly tier: string;
  readonly idempotent: boolean;
  /** Whether `--dry-run` previews it. */
  readonly dryRun: boolean;
  /** Whether `--check` ends with findings where it would change something. */
  readonly check: boolean;
  /** The options with what each means. */
  readonly options: readonly { readonly name: string; readonly meaning: string }[];
  /** Command lines with a comment, as the program gives them. */
  readonly examples: readonly string[];
  /** The page that documents the verb in full, where the site has one. */
  readonly page?: string;
}

/** One fact the page of the release states. */
export interface OpsFact {
  readonly label: string;
  readonly value: string;
}

/** What follows a page's words. */
export type OpsGenerated = "workflows" | "verbs" | "facts";

/** One page of the section: the Markdown file, its address and what is generated after it. */
export interface RepoOpsPage {
  /** The Markdown file, from the repository's root. Its first heading is the page's title. */
  readonly file: string;
  /** The page's address on the site, as `repo-ops/ci-cd.html`. */
  readonly path: string;
  /** Its place in the section, lowest first. */
  readonly order: number;
  /** The typed facts that follow its words. */
  readonly generated?: OpsGenerated;
}

/** What the Repo Ops lens is given. */
export interface RepoOpsOptions {
  /** Its name, which the build reports it by. */
  readonly name: string;
  /** The pages. */
  readonly pages: readonly RepoOpsPage[];
  /** The workflows. */
  readonly workflows?: () => readonly OpsWorkflow[];
  /** The verbs of the operations program. */
  readonly verbs?: () => readonly OpsVerb[];
  /** The facts of the release. */
  readonly facts?: () => readonly OpsFact[];
  /** The command the verbs are run with (`repoctl`), for the usage lines. */
  readonly command?: string;
}

const t = (text: string): Inline => ({ kind: "text", text });
const c = (text: string): Inline => ({ kind: "code", text });
const heading = (text: string, id: string): Block => ({ kind: "heading", level: 2, id, text: [t(text)] });
const para = (...inlines: Inline[]): Block => ({ kind: "paragraph", inlines });
const yes = (b: boolean): string => (b ? "yes" : "no");

/** The first sentence of a text, cut at 200 characters. */
function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const s = /^(.+?[.!?])(\s|$)/.exec(flat)?.[1] ?? flat;
  return s.length <= 200 ? s : `${s.slice(0, 199)}…`;
}

function workflowBlocks(ws: readonly OpsWorkflow[]): Block[] {
  if (ws.length === 0) return [heading("The workflows", "the-workflows"), para(t("No workflow was given to this page."))];
  return [
    heading("The workflows", "the-workflows"),
    para(t("Read from the typed definitions the workflow files are made from, so this table is the workflows as they are: the files are generated and are never edited by hand.")),
    { kind: "table", head: [[t("Workflow")], [t("File")], [t("Starts on")], [t("Jobs")], [t("What it is for")]], rows: ws.map((w) => [[t(w.name)], [c(w.file)], [t(w.triggers.join(", "))], [t(w.jobs.map((j) => j.id).join(", "))], [t(w.purpose)]]) },
  ];
}

function factBlocks(fs_: readonly OpsFact[]): Block[] {
  if (fs_.length === 0) return [heading("The release at this commit", "the-release-at-this-commit"), para(t("No fact was given to this page."))];
  return [
    heading("The release at this commit", "the-release-at-this-commit"),
    para(t("Read from the typed constants of the release, not written here.")),
    { kind: "table", head: [[t("Fact")], [t("Value")]], rows: fs_.map((f) => [[t(f.label)], [c(f.value)]]) },
  ];
}

function verbBlocks(vs: readonly OpsVerb[], command: string): Block[] {
  if (vs.length === 0) return [heading("The commands", "the-commands"), para(t("No verb was given to this page."))];
  const idOf = (v: OpsVerb): string => `verb-${v.words.replace(/[^A-Za-z0-9]+/g, "-")}`;
  const out: Block[] = [
    heading("The commands", "the-commands"),
    para(t("Read from the program's own typed verb definitions: each is declared once, and the command line, the tool server and these pages read that one table.")),
    {
      kind: "table",
      head: [[t("Command")], [t("What it does")], [t("Effect")], [t("Tier")], [t("Preview")], [t("Check")], [t("Safe to repeat")]],
      rows: vs.map((v) => [[{ kind: "link", href: { kind: "page", path: "repo-ops/repoctl.html", anchor: idOf(v) }, children: [c(`${command} ${v.words}`)] }], [t(v.summary)], [t(v.effect)], [t(v.tier)], [t(yes(v.dryRun))], [t(yes(v.check))], [t(yes(v.idempotent))]]),
    },
  ];
  for (const v of vs) {
    out.push({ kind: "heading", level: 3, id: idOf(v), text: [c(`${command} ${v.words}`)] });
    out.push(para(t(v.summary)));
    if (v.options.length > 0) out.push({ kind: "table", head: [[t("Option")], [t("Meaning")]], rows: v.options.map((o) => [[c(o.name)], [t(o.meaning)]]) });
    if (v.examples.length > 0) out.push({ kind: "code", lang: "sh", text: v.examples.join("\n") });
    if (v.page !== undefined) out.push(para(t("The full page of this verb: "), { kind: "link", href: { kind: "page", path: v.page }, children: [c(`${command} ${v.words}`)] }, t(".")));
  }
  return out;
}

/** The Repo Ops lens. */
export function repoOpsLens(options: RepoOpsOptions): Lens {
  return {
    name: options.name,
    read: async (b): Promise<LensPages> => {
      const texts = new Map<string, string>();
      for (const p of options.pages) {
        try {
          texts.set(p.file, await fs.readTextFile(path.join(b.root, p.file)));
        } catch {
          b.found.push({ where: p.file, problem: { kind: "undescribed", entity: `the Repo Ops page ${p.file}, which the lens is told of, cannot be read` } });
        }
      }
      for (const p of options.pages) if (texts.has(p.file)) b.files.set(p.file, p.path);
      return (build, after) => {
        const command = options.command ?? "repoctl";
        for (const p of options.pages) {
          const text = texts.get(p.file);
          if (text === undefined) continue;
          const m = /^#\s+(.+)\n+/.exec(text);
          const title = m?.[1]?.trim() ?? p.path;
          const body = m === null ? text : text.slice(m[0].length);
          const generated: Block[] = p.generated === "workflows" ? workflowBlocks(options.workflows?.() ?? []) : p.generated === "verbs" ? verbBlocks(options.verbs?.() ?? [], command) : p.generated === "facts" ? factBlocks(options.facts?.() ?? []) : [];
          const lead = /^(?![#>|`\-*\d])[^\n]+/m.exec(body)?.[0] ?? title;
          build.add({ path: p.path, title, description: firstSentence(lead.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*_]/g, "")), section: "repoops", group: "Repo Ops", order: p.order, blocks: [...build.md(body, { page: p.path, file: p.file }), ...generated] });
        }
        return after;
      };
    },
  };
}
