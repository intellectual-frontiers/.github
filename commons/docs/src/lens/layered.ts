// Spec: 0001-docs FR-002
/**
 * The layered-model lens (commons 0011-documentation FR-029): the models of a library that is built in layers (governance, logical, physical or surface), as pages for a developer and an agent and as a Markdown twin
 * and a JSON file for each. It is given a function that makes `LayeredModel` values (a library's own pure builder, such as commons data's `describeModels`) and knows nothing of the library: what the models say
 * is read from the values, where they are written is found from the files that export them (by the identity of the value), and each page says which layer it is of and how that layer is used.
 *
 * @remarks
 * Pages: the models and the layers (what each layer is for, which code writes it, what may be edited, how to change a model and regenerate what follows); for each model its overview and a diagram of its concepts; for each
 * concept its definition, where it is written (a link to the line), its attributes and relationships, what it projects to and the SQL and the typed table it is written as; for each code list its codes; and registers of
 * what the models annotate (personal data, security, ownership). Every element has an anchor that is its id, so that a link and a diff can name it.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { type Badge, type Block, type Build, type Href, type Inline, type LayerElement, type LayeredModel, type LayeredSource, type Lens, type LensPages, type Page, type SiteFile, slugOf, type SourceLocation } from "../mod.ts";

/** What the lens is given. */
export interface LayeredLensOptions {
  /** Its name, which the build reports it by. */
  readonly name: string;
  /** The group of the Models section the pages are in. */
  readonly group?: string;
  /** Makes the models; it is told how to find where a value is written. */
  readonly source: LayeredSource;
  /** The files, from the repository's root, whose exports are the values the models are made of: where an element is written is found from them. */
  readonly exports: readonly string[];
  /** The command that regenerates what follows the top layer, and the file a person edits first, written into the page that says how to change a model. */
  readonly regenerate?: readonly string[];
}

/** A name as a path: `identityAgent` is `identity-agent`. */
const kebab = (name: string): string => slugOf(name.replace(/([a-z0-9])([A-Z])/g, "$1-$2"));

const t = (text: string): Inline => ({ kind: "text", text });
const c = (text: string): Inline => ({ kind: "code", text });
const para = (...inlines: Inline[]): Block => ({ kind: "paragraph", inlines });
const heading = (level: 2 | 3 | 4, text: string, id = slugOf(text)): Block => ({ kind: "heading", level, id, text: [t(text)] });
const badge = (text: string, tone: Badge["tone"] = "neutral"): Badge => ({ text, tone });
const page = (b: Build, p: Omit<Page, "section">): void => b.add({ ...p, section: "models" });

/** The line of the declaration of an export in a file, from 1. */
function lineOf(text: string, name: string): number | undefined {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => new RegExp(`^export (const|function|let) ${name}\\b`).test(l));
  return i < 0 ? undefined : i + 1;
}

/** The line of a member (`attribute:` in an object) after the declaration, from 1. */
function memberLine(text: string, from: number, member: string): number | undefined {
  const lines = text.split("\n");
  for (let i = from; i < Math.min(lines.length, from + 400); i++) if (new RegExp(`^\\s*${member}\\s*[:(]`).test(lines[i] ?? "")) return i + 1;
  return undefined;
}

/** A locator that also finds the line of a member, from the same files. */
async function withMembers(b: Build, files: readonly string[]): Promise<(value: unknown, member?: string) => SourceLocation | undefined> {
  const known = new Map<unknown, { file: string; line?: number; text: string }>();
  for (const file of files) {
    let text: string;
    try {
      text = await fs.readTextFile(path.join(b.root, file));
    } catch {
      b.found.push({ where: file, problem: { kind: "undescribed", entity: `the file ${file}, which the layered lens is told exports models, cannot be read` } });
      continue;
    }
    const mod = (await import(path.join(b.root, file))) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod)) {
      if ((typeof value !== "object" && typeof value !== "function") || value === null) continue;
      const line = lineOf(text, name);
      // a file that declares a value is where it is written; one that re-exports it is not
      if (known.has(value) && (known.get(value)?.line !== undefined || line === undefined)) continue;
      known.set(value, { file, text, ...(line === undefined ? {} : { line }) });
    }
  }
  return (value, member) => {
    const k = known.get(value);
    if (k === undefined) return undefined;
    if (member === undefined || k.line === undefined) return { file: k.file, ...(k.line === undefined ? {} : { line: k.line }) };
    const l = memberLine(k.text, k.line, member);
    return { file: k.file, line: l ?? k.line };
  };
}

const sourceHref = (b: Build, s: SourceLocation): Href => ({ kind: "external", url: `${b.config.repository}/blob/${b.config.branch}/${s.file}${s.line === undefined ? "" : `#L${s.line}`}` });
const sourceLink = (b: Build, s: SourceLocation | undefined): Inline[] => (s === undefined ? [] : [{ kind: "link", href: sourceHref(b, s), children: [c(`${s.file}${s.line === undefined ? "" : `:${s.line}`}`)] }]);

/** An example of reading a typed table: the first two columns, as a program writes their keys. */
function typedExample(name: string, from: string, columns: readonly string[]): string {
  const key = (k: string): string => k.replace(/_([a-z])/g, (_x, ch: string) => ch.toUpperCase());
  const picked = columns.slice(0, 2).map((k) => `${key(k)}: s.${name}.${key(k)}`).join(", ");
  // the import lines are made from pieces, so that the packer does not read these strings as imports of this module
  const importOf = (what: string, source: string): string => ["import", `{ ${what} }`, "from", `"${source}";`].join(" ");
  return [importOf("from", "@intellectual-frontiers/data/sql/typed"), importOf(name, from), "", `const rows = await from(${name}).select((s) => ({ ${picked} })).run(runner);`].join("\n");
}

/** The sentence that names what a model requires, or nothing. */
const requiresOf = (names: readonly string[]): Inline[] => (names.length === 0 ? [] : [t(". Requires "), ...names.flatMap((r, i) => (i === 0 ? [c(r)] : [t(", "), c(r)]))]);

const prop = (e: LayerElement, k: string): string => {
  const v = e.properties[k];
  return Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v);
};
const list = (e: LayerElement, k: string): readonly string[] => {
  const v = e.properties[k];
  return Array.isArray(v) ? (v as readonly string[]) : [];
};

/** The layered-model lens. */
export function layeredLens(options: LayeredLensOptions): Lens {
  let models: readonly LayeredModel[] = [];
  const group = options.group ?? "Models";
  return {
    name: options.name,
    read: async (b): Promise<LensPages> => {
      models = await options.source(await withMembers(b, options.exports));
      const byId = new Map<string, { model: LayeredModel; element: LayerElement }>();
      for (const m of models) for (const e of m.elements) byId.set(e.id, { model: m, element: e });
      return (build, after) => {
        const conceptPage = (m: LayeredModel, name: string): string => `models/${kebab(m.name)}/${kebab(name)}.html`;
        const tableOfConcept = new Map<string, string>();
        for (const m of models) for (const tr of m.trace) if (tr.how === "projects to" && tr.from.startsWith("governance:concept/") && tr.to.startsWith("logical:table")) tableOfConcept.set(tr.to, tr.from);
        const pageOfElement = (id: string): Href | undefined => {
          const hit = byId.get(id);
          if (hit === undefined) return undefined;
          const e = hit.element;
          if (e.kind === "concept") return { kind: "page", path: conceptPage(hit.model, e.name) };
          if (e.kind === "codelist") return { kind: "page", path: `models/${kebab(hit.model.name)}/list-${kebab(e.name)}.html` };
          if (e.kind === "table") {
            const cid = tableOfConcept.get(e.id);
            const ch = cid === undefined ? undefined : byId.get(cid);
            return ch === undefined ? undefined : { kind: "page", path: conceptPage(ch.model, ch.element.name) };
          }
          if (e.kind === "attribute" || e.kind === "relationship") {
            const p = byId.get(e.parent ?? "");
            return p === undefined ? undefined : { kind: "page", path: conceptPage(p.model, p.element.name), anchor: kebab(e.name) };
          }
          return undefined;
        };
        const link = (id: string, label: string): Inline => {
          const h = pageOfElement(id);
          return h === undefined ? c(label) : { kind: "link", href: h, children: [c(label)] };
        };
        // the page of the layers: what each is for, and how to change a model
        const findings = models.flatMap((m) => m.findings);
        page(build, {
          path: "models/index.html",
          title: "Models",
          description: "The data models, documented layer by layer: governance, the logical schema and the physical forms.",
          group,
          order: after,
          blocks: [
            para(t("Each model is documented in the layers it is written in. Governance says what the business means and is the only layer a person or an agent edits; the logical schema and the physical forms are made from it. "), { kind: "link", href: { kind: "page", path: "models/layers.html" }, children: [t("How the layers fit and how to change a model")] }, t(".")),
            heading(2, "Models"),
            {
              kind: "cards",
              cards: models.map((m) => ({
                title: m.title,
                href: { kind: "page", path: `models/${kebab(m.name)}/index.html` } as Href,
                text: [t(m.summary)],
                badges: [badge(`${m.elements.filter((e) => e.kind === "concept").length} concepts`, "info"), ...(m.findings.length > 0 ? [badge(`${m.findings.length} findings`, "warn")] : [])],
              })),
            },
            heading(2, "Registers"),
            para({ kind: "link", href: { kind: "page", path: "models/registers.html" }, children: [t("What the models annotate: personal data, security, ownership, lifecycle")] }),
            ...(findings.length === 0 ? [] : [heading(2, "Findings"), { kind: "list", ordered: false, items: findings.map((f) => [para(c(f.element), t(` ${f.message}`))]) } as Block]),
          ],
        });
        const layers = models[0]?.layers ?? [];
        page(build, {
          path: "models/layers.html",
          title: "The layers",
          description: "How governance, logical and physical fit together, and how to change a model and regenerate what follows.",
          group,
          order: after + 1,
          blocks: [
            para(t("A model is written once, in governance, and everything else is made from it. Read the layers from the top: each is made from the one above it, and each element says which element it came from.")),
            { kind: "diagram", source: "flowchart LR\n  G[Governance: TypeScript, the definition DSL] -->|projects to| L[Logical: tables, columns, keys]\n  L -->|written as| S[Physical: SQL for each dialect]\n  L -->|read and written by| T[Physical: typed tables]", caption: "The layers: edit the first, generate the rest" },
            ...layers.flatMap((l): Block[] => [heading(2, l.title, l.id), para(t(l.summary)), para(t("Holds: "), ...l.kinds.flatMap((k, i) => (i === 0 ? [c(k)] : [t(", "), c(k)])))]),
            heading(2, "How to change a model"),
            { kind: "list", ordered: true, items: [
              [para(t("Find the concept in governance: its page shows the file and line where it is written."))],
              [para(t("Edit it there: add an "), c("attribute(...)"), t(" or a "), c("relationship(...)"), t(", give it a "), c("definition"), t(" (the definition is the documentation), and annotate personal data with a purpose."))],
              ...(options.regenerate ?? []).map((cmd) => [para(t("Regenerate what follows: "), c(cmd))]),
              [para(t("Never edit a generated file (its name has "), c(".auto."), t(") or the SQL: change governance and generate again. The pages of this site are made from the same values, so they follow."))],
              [para(t("Check: a concept, attribute, relationship or code list with no definition, and personal data held for no purpose, are findings on the "), { kind: "link", href: { kind: "page", path: "models/index.html" }, children: [t("Models")] }, t(" page."))],
            ] },
            heading(2, "For an agent"),
            para(t("Every page of this site has a Markdown twin (the same path with "), c(".md"), t(") and each model is published as JSON ("), c("models/<name>.json"), t(", listed in "), c("llms.txt"), t("). An element's id is stable, so the JSON and the pages name the same things, and the trace lists what each element is made into.")),
          ],
        });
        let order = after + 2;
        for (const m of models) {
          const concepts = m.elements.filter((e) => e.kind === "concept");
          const lists = m.elements.filter((e) => e.kind === "codelist");
          const modEl = m.elements.find((e) => e.kind === "module");
          const edges = concepts.flatMap((cn) => m.elements.filter((e) => e.kind === "relationship" && e.parent === cn.id).map((r) => `  ${kebab(cn.name).replaceAll("-", "_")} -->|${r.name}| ${prop(r, "to").replace(/[^A-Za-z0-9]/g, "_")}`));
          page(build, {
            path: `models/${kebab(m.name)}/index.html`,
            title: m.title,
            description: m.summary,
            group,
            order: order++,
            blocks: [
              para(t(m.summary)),
              ...(modEl === undefined ? [] : [para(t("Written in "), ...sourceLink(build, modEl.source), ...requiresOf(list(modEl, "requires")))]),
              ...(edges.length === 0 ? [] : [{ kind: "diagram", source: `flowchart LR\n${edges.slice(0, 80).join("\n")}`, caption: `How the concepts of ${m.title} relate` } as Block]),
              heading(2, "Concepts"),
              { kind: "table", head: [[t("Concept")], [t("Definition")], [t("Attributes")], [t("Written in")]], rows: concepts.map((cn) => [[{ kind: "link", href: { kind: "page", path: conceptPage(m, cn.name) }, children: [c(cn.name)] }], [t(cn.definition)], [t(String(list(cn, "attributes").length))], sourceLink(build, cn.source)]) },
              ...(lists.length === 0 ? [] : [heading(2, "Code lists"), { kind: "table", head: [[t("Code list")], [t("Definition")], [t("Codes")]], rows: lists.map((l) => [[{ kind: "link", href: { kind: "page", path: `models/${kebab(m.name)}/list-${kebab(l.name)}.html` }, children: [c(l.name)] }], [t(l.definition)], [t(String(list(l, "codes").length))]]) } as Block]),
              ...(m.findings.length === 0 ? [] : [heading(2, "Findings"), { kind: "list", ordered: false, items: m.findings.map((f) => [para(c(f.element), t(` ${f.message}`))]) } as Block]),
            ],
          });
          for (const cn of concepts) {
            const attrs = m.elements.filter((e) => e.kind === "attribute" && e.parent === cn.id);
            const rels = m.elements.filter((e) => e.kind === "relationship" && e.parent === cn.id);
            const table = m.trace.filter((x) => x.from === cn.id && x.how === "projects to").map((x) => m.elements.find((e) => e.id === x.to)).find((e) => e?.kind === "table");
            const cols = table === undefined ? [] : m.elements.filter((e) => e.kind === "column" && e.parent === table.id);
            const ddl = table === undefined ? [] : m.elements.filter((e) => e.kind === "ddl" && e.parent === table.id);
            const typedTable = table === undefined ? undefined : m.elements.find((e) => e.kind === "typed-table" && e.parent === table.id);
            const colFor = (id: string): string => {
              const hit = m.trace.filter((x) => x.from === id && x.to.startsWith("logical:column")).map((x) => m.elements.find((e) => e.id === x.to)?.name ?? "");
              return hit.join(", ");
            };
            const personal = attrs.filter((a) => list(a, "annotations").some((x) => x.startsWith("privacy.personal")));
            page(build, {
              path: conceptPage(m, cn.name),
              title: cn.name,
              description: cn.definition,
              group,
              order: order++,
              navTitle: cn.name,
              badges: [badge("concept", "info"), ...(personal.length > 0 ? [badge("personal data", "warn")] : [])],
              blocks: [
                para(t(cn.definition === "" ? "No definition: say what this concept means." : cn.definition)),
                para(t("Model "), { kind: "link", href: { kind: "page", path: `models/${kebab(m.name)}/index.html` }, children: [c(m.name)] }, ...(cn.source === undefined ? [] : [t(". Written in "), ...sourceLink(build, cn.source)]), t(`. Identified by `), c(prop(cn, "identifiedBy")), t(".")),
                heading(2, "Governance: attributes"),
                ...attrs.map((a): Block => ({
                  kind: "entry",
                  id: kebab(a.name),
                  name: a.name,
                  badges: [badge(prop(a, "type")), badge(prop(a, "multiplicity"), prop(a, "multiplicity") === "required" ? "good" : "neutral"), ...(list(a, "annotations").some((x) => x.startsWith("privacy.personal")) ? [badge("personal data", "warn")] : [])],
                  blocks: [
                    para(t(a.definition === "" ? "No definition." : a.definition)),
                    ...(colFor(a.id) === "" ? [] : [para(t("Becomes the column "), c(colFor(a.id)), t(" of "), ...(table === undefined ? [] : [c(table.name)]), t("."))]),
                    ...(list(a, "annotations").length === 0 ? [] : [para(t("Annotations: "), ...list(a, "annotations").flatMap((x, i) => (i === 0 ? [c(x)] : [t(" "), c(x)])))]),
                    ...(a.source === undefined ? [] : [para(t("Written at "), ...sourceLink(build, a.source))]),
                  ],
                })),
                ...(rels.length === 0 ? [] : [heading(2, "Governance: relationships"), ...rels.map((r): Block => {
                  const target = [...byId.values()].find((x) => x.element.kind === "concept" && x.element.name === prop(r, "to"));
                  return {
                    kind: "entry",
                    id: kebab(r.name),
                    name: r.name,
                    badges: [badge(prop(r, "cardinality"))],
                    blocks: [para(t(r.definition === "" ? "No definition. " : `${r.definition} `), t("To "), target === undefined ? c(prop(r, "to")) : link(target.element.id, target.element.name), ...(r.source === undefined ? [] : [t(". Written at "), ...sourceLink(build, r.source)]))],
                  };
                })]),
                ...(table === undefined ? [] : [
                  heading(2, "Logical: the table"),
                  para(t("Projects to the table "), c(table.name), t(" with the primary key "), c(prop(table, "primaryKey")), t(".")),
                  { kind: "table", head: [[t("Column")], [t("Type")], [t("Null")], [t("Role")], [t("From")]], rows: cols.map((col) => [[c(col.name)], [t(prop(col, "type"))], [t(prop(col, "nullable"))], [t(prop(col, "role"))], (() => { const from = m.trace.find((x) => x.to === col.id)?.from; return from === undefined ? [] : [link(from, from.replace(/^governance:[a-z]+\//, ""))]; })()]) } as Block,
                ]),
                ...(ddl.length === 0 ? [] : [heading(2, "Physical: SQL"), { kind: "tabs", id: "sql", tabs: ddl.map((d) => ({ label: prop(d, "dialect"), blocks: [{ kind: "code", lang: "sql", text: prop(d, "sql") } as Block] })) } as Block]),
                ...(typedTable === undefined ? [] : [heading(2, "Physical: the typed table"), para(t("Read and written from TypeScript with the types the model gives: "), c(["import", `{ ${prop(typedTable, "export")} }`, "from", `"${prop(typedTable, "module")}"`].join(" ")), t(". Generated"), ...(typedTable.source === undefined ? [] : [t(" in "), ...sourceLink(build, typedTable.source)]), t(": do not edit.")), { kind: "code", lang: "ts", text: typedExample(prop(typedTable, "export"), prop(typedTable, "module"), list(table ?? cn, "columns")) } as Block]),
              ],
            });
          }
          for (const l of lists) {
            const codes = m.elements.filter((e) => e.kind === "code" && e.parent === l.id);
            page(build, {
              path: `models/${kebab(m.name)}/list-${kebab(l.name)}.html`,
              title: l.name,
              description: l.definition,
              group,
              order: order++,
              badges: [badge("code list", "info")],
              blocks: [
                para(t(l.definition === "" ? "No definition: say what this list means." : l.definition)),
                para(t("Model "), { kind: "link", href: { kind: "page", path: `models/${kebab(m.name)}/index.html` }, children: [c(m.name)] }, ...(l.source === undefined ? [] : [t(". Written in "), ...sourceLink(build, l.source)])),
                { kind: "table", head: [[t("Code")], [t("Label")], [t("Meaning")]], rows: codes.map((cd) => [[c(cd.name)], [t(prop(cd, "label"))], [t(cd.definition)]]) },
              ],
            });
          }
        }
        // registers: what the models annotate
        const byKind = new Map<string, { model: string; element: LayerElement; value: string }[]>();
        for (const m of models) for (const e of m.elements) for (const a of list(e, "annotations")) {
          const k = a.slice(0, a.indexOf("="));
          byKind.set(k, [...(byKind.get(k) ?? []), { model: m.name, element: e, value: a.slice(a.indexOf("=") + 1) }]);
        }
        page(build, {
          path: "models/registers.html",
          title: "Registers",
          description: "Everything the models annotate, by kind of annotation: personal data, security, ownership, lifecycle.",
          group,
          order,
          blocks: [
            para(t("Annotations are how governance says what an element holds and who answers for it. Each kind is listed with every element that carries it.")),
            ...[...byKind].sort(([a], [b]) => (a < b ? -1 : 1)).flatMap(([kind, rows]): Block[] => [
              heading(2, kind),
              { kind: "table", head: [[t("Element")], [t("Model")], [t("Value")]], rows: rows.map((r) => [[link(r.element.id, r.element.id.replace(/^governance:[a-z]+\//, ""))], [t(r.model)], [c(r.value)]]) },
            ]),
          ],
        });
        return order + 1;
      };
    },
    files: (): readonly SiteFile[] => [
      ...models.map((m): SiteFile => ({ path: `models/${kebab(m.name)}.json`, text: `${JSON.stringify(m, null, 2)}\n`, what: `the ${m.title} model in layers (governance, logical, physical) with its trace and findings` })),
      { path: "models/index.json", text: `${JSON.stringify(models.map((m) => ({ name: m.name, library: m.library, title: m.title, summary: m.summary, file: `models/${kebab(m.name)}.json`, elements: m.elements.length, findings: m.findings.length })), null, 2)}\n`, what: "the list of models with the file of each" },
    ],
  };
}
