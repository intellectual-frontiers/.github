// Spec: 0001-docs FR-002
/**
 * The program lens (commons 0011-documentation FR-030): the command-line, tool and route programs of a library built on commons headless, as pages for a person and an agent and as a Markdown twin and a JSON file for each. It is
 * given a function that makes `LayeredModel` values (headless's own `describe`, which gives one model for each tier of a program) and knows nothing of headless: what a program says is read from the values. The models of
 * the tiers of one program have the same element ids, so each model is read by itself and never merged with another, and every tier has its own pages.
 *
 * @remarks
 * Pages: the programs and their tiers; for each tier its verbs (what each does, its effect, and which surfaces draw it or why one does not), the problem codes and exit statuses it can give, the plugins that contribute verbs and
 * the findings of the builder; and for each verb its action as governance says it, its options and operands, examples, and the command, tool and route it becomes.
 *
 * @module
 */
import { type Badge, type Block, type Href, type Inline, type LayerElement, type LayeredModel, type Lens, type LensPages, type Page, type SiteFile, slugOf } from "../mod.ts";

/** What the lens is given. */
export interface ProgramLensOptions {
  /** Its name, which the build reports it by. */
  readonly name: string;
  /** The group of the section the pages are in. */
  readonly group?: string;
  /** Makes the models of the programs: one for each tier of each program. */
  readonly source: () => Promise<readonly LayeredModel[]> | readonly LayeredModel[];
}

const t = (text: string): Inline => ({ kind: "text", text });
const c = (text: string): Inline => ({ kind: "code", text });
const para = (...inlines: Inline[]): Block => ({ kind: "paragraph", inlines });
const heading = (level: 2 | 3 | 4, text: string, id = slugOf(text)): Block => ({ kind: "heading", level, id, text: [t(text)] });
const badge = (text: string, tone: Badge["tone"] = "neutral"): Badge => ({ text, tone });
const slug = (s: string): string => slugOf(s.replace(/[^A-Za-z0-9]+/g, "-"));
const value = (v: LayerElement["properties"][string] | undefined): string => (Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v));
const prop = (e: LayerElement, k: string): string => value(e.properties[k]);
const list = (e: LayerElement, k: string): readonly string[] => {
  const v = e.properties[k];
  return Array.isArray(v) ? (v as readonly string[]) : [];
};

/** The properties of an element as a table, leaving out those a page shows in another way. */
function propertiesTable(e: LayerElement, skip: readonly string[] = []): readonly Block[] {
  const rows = Object.entries(e.properties).filter(([k, v]) => !skip.includes(k) && !(Array.isArray(v) && v.length === 0) && v !== null && v !== "");
  return rows.length === 0 ? [] : [{ kind: "table", head: [[t("Property")], [t("Value")]], rows: rows.map(([k, v]) => [[c(k)], [t(value(v))]]) }];
}

/** The program lens. */
export function programLens(options: ProgramLensOptions): Lens {
  let models: readonly LayeredModel[] = [];
  const group = options.group ?? "Programs";
  /** The program a model is of: the name of the model without the tier at its end (`repoctl-contributor` is of `repoctl`). */
  const programOf = (m: LayeredModel): string => m.name.replace(/-[^-]+$/, "");
  /** The tier of a model: what follows the program in its name. */
  const tierOf = (m: LayeredModel): string => `${m.name.slice(programOf(m).length + 1)} tier`;
  const dir = (m: LayeredModel): string => `programs/${slug(m.name)}`;
  const verbPage = (m: LayeredModel, v: LayerElement): string => `${dir(m)}/verb-${slug(v.name)}.html`;
  return {
    name: options.name,
    read: async (): Promise<LensPages> => {
      models = await options.source();
      return (build, after) => {
        const add = (p: Omit<Page, "section">): void => build.add({ ...p, section: "programs" });
        add({
          path: "programs/index.html",
          title: "Programs",
          description: "The command-line programs, tools and routes of the libraries, documented from their own descriptions, one page set for each tier.",
          group,
          order: after,
          blocks: [
            para(t("Each program is described once, in governance, as actions that say what they do and may do, and is drawn as a command, a tool and a route. A program has one description for each tier of its audience: a verb a tier cannot see is listed in that tier with the reason, and is not drawn.")),
            heading(2, "Programs"),
            { kind: "cards", cards: models.map((m) => ({ title: m.title, href: { kind: "page", path: `${dir(m)}/index.html` } as Href, text: [t(m.summary)], badges: [badge(`${m.elements.filter((e) => e.kind === "verb").length} verbs`, "info"), ...(m.findings.length > 0 ? [badge(`${m.findings.length} findings`, "warn")] : [])] })) },
          ],
        });
        let order = after + 1;
        for (const m of models) {
          const byId = new Map(m.elements.map((e) => [e.id, e]));
          const verbs = m.elements.filter((e) => e.kind === "verb");
          const surfaces = (v: LayerElement): readonly LayerElement[] => m.trace.filter((x) => x.from === v.id && x.how === "projects to").map((x) => byId.get(x.to)).filter((e): e is LayerElement => e !== undefined);
          const kindsOfVerb = (v: LayerElement): string[] => [...new Set(surfaces(v).map((s) => s.kind.replace("-command", "").replace("-tool", "").replace("-route", "")))];
          const codes = m.elements.filter((e) => e.kind === "problem-code");
          const outcomes = m.elements.filter((e) => e.kind === "outcome");
          const plugins = m.elements.filter((e) => e.kind === "plugin");
          add({
            path: `${dir(m)}/index.html`,
            title: m.title,
            description: m.summary,
            group: programOf(m),
            order: order++,
            navTitle: tierOf(m),
            blocks: [
              para(t(m.summary)),
              heading(2, "Verbs"),
              { kind: "table", head: [[t("Verb")], [t("What it does")], [t("Effect")], [t("Drawn as")], [t("Not drawn")]], rows: verbs.map((v) => [[{ kind: "link", href: { kind: "page", path: verbPage(m, v) }, children: [c(v.name)] }], [t(v.definition)], [t(prop(v, "effect"))], [t(kindsOfVerb(v).join(", ") || "none")], [t(list(v, "notProjected").join("; "))]]) },
              ...(plugins.length === 0 ? [] : [heading(2, "Plugins"), { kind: "table", head: [[t("Plugin")], [t("Contributes")]], rows: plugins.map((p) => [[c(p.name)], [t(p.definition)]]) } as Block]),
              ...(codes.length === 0 ? [] : [heading(2, "Problem codes"), { kind: "table", head: [[t("Code")], [t("Meaning")]], rows: codes.map((e) => [[c(e.name)], [t(e.definition)]]) } as Block]),
              ...(outcomes.length === 0 ? [] : [heading(2, "Exit statuses"), { kind: "table", head: [[t("Outcome")], [t("Meaning")]], rows: outcomes.map((e) => [[c(e.name)], [t(e.definition)]]) } as Block]),
              ...(m.findings.length === 0 ? [] : [heading(2, "Findings"), { kind: "list", ordered: false, items: m.findings.map((f) => [para(c(f.element), t(` ${f.rule}: ${f.message}`))]) } as Block]),
            ],
          });
          for (const v of verbs) {
            const options_ = m.elements.filter((e) => e.kind === "option" && e.parent === v.id);
            const operands = m.elements.filter((e) => e.kind === "operand" && e.parent === v.id);
            const action = m.trace.filter((x) => x.to === v.id && x.how !== undefined).map((x) => byId.get(x.from)).find((e) => e?.kind === "action");
            const drawn = surfaces(v);
            add({
              path: verbPage(m, v),
              title: v.name,
              description: v.definition,
              group: programOf(m),
              order: order++,
              parent: `${dir(m)}/index.html`,
              navKind: "Verbs",
              navTitle: v.name,
              badges: [badge("verb", "info"), ...(prop(v, "effect") === "" ? [] : [badge(prop(v, "effect"))])],
              blocks: [
                para(t(v.definition)),
                para(t("Program "), { kind: "link", href: { kind: "page", path: `${dir(m)}/index.html` }, children: [c(m.name)] }, t(`. Origin `), c(prop(v, "origin")), t(".")),
                heading(2, "Governance: the action"),
                para(t("What the verb is and may do, as governance says it. Each annotation is expressed by the surfaces or says why it is not.")),
                ...propertiesTable(action ?? v, ["path", "origin", "examples", "offered", "projections", "notProjected"]),
                ...(operands.length === 0 ? [] : [heading(2, "Operands"), { kind: "table", head: [[t("Operand")], [t("Meaning")]], rows: operands.map((o) => [[c(o.name)], [t(o.definition)]]) } as Block]),
                ...(options_.length === 0 ? [] : [heading(2, "Options"), { kind: "table", head: [[t("Option")], [t("Meaning")], [t("Properties")]], rows: options_.map((o) => [[c(o.name)], [t(o.definition)], [t(Object.entries(o.properties).filter(([, x]) => x !== null && x !== "" && !(Array.isArray(x) && x.length === 0)).map(([k, x]) => `${k}=${value(x)}`).join(", "))]]) } as Block]),
                ...(list(v, "examples").length === 0 ? [] : [heading(2, "Examples"), { kind: "code", lang: "sh", text: list(v, "examples").join("\n") } as Block]),
                heading(2, "Physical: what it is drawn as"),
                ...(drawn.length === 0 ? [para(t("Not drawn by any surface for this tier."))] : drawn.flatMap((s): Block[] => [heading(3, s.name, slug(`${s.kind}-${s.name}`)), para(t(`${s.kind}. `), t(s.definition)), ...propertiesTable(s)])),
                ...(list(v, "notProjected").length === 0 ? [] : [heading(3, "Not drawn"), { kind: "list", ordered: false, items: list(v, "notProjected").map((x) => [para(t(x))]) } as Block]),
              ],
            });
          }
        }
        return order;
      };
    },
    files: (): readonly SiteFile[] => [
      ...models.map((m): SiteFile => ({ path: `programs/${slug(m.name)}.json`, text: `${JSON.stringify(m, null, 2)}\n`, what: `the ${m.title} program in layers (governance, logical, surfaces) with its trace and findings` })),
      { path: "programs/index.json", text: `${JSON.stringify(models.map((m) => ({ name: m.name, library: m.library, title: m.title, summary: m.summary, file: `programs/${slug(m.name)}.json`, elements: m.elements.length, findings: m.findings.length })), null, 2)}\n`, what: "the list of programs with the file of each" },
    ],
  };
}
