/**
 * The SQL Aide lens (commons 0011-documentation FR-013): an area whose entry point exports tables, views or indexes (recognised by the
 * type the checker gives each export: `Table<...>`, `View<...>`, `Index<...>`) is a schema, and is shown as one. Its module is imported
 * and SQL Aide's own functions make what the pages show: the entity-relationship diagram (`mermaidErd`), the SQL of each dialect
 * (`render` of `definitions`), the descriptions from the documentation maps the module exports, and what the typical lint rules find. A
 * Governance page gathers, across every model, the columns that hold personal data by category, the tables by owner, and the findings.
 *
 * @limits
 * Data Vault's hubs, links and satellites are functions, not tables, until a caller makes them: its model page shows the tables its
 * module exports (the exceptions it records), not a vault. A diagram is Mermaid's text, drawn in the reader's browser; a large one fits
 * the page and opens to its full size when clicked.
 *
 * @module
 */
import {
  type AnyTable,
  context,
  definitions,
  type Docs,
  duckdb,
  type EmitContext,
  type Entity,
  lint,
  type Finding as LintFinding,
  mermaidErd,
  postgres,
  renderUnchecked,
  sqlite,
} from "../../ts/data/sql-aide/mod.ts";
import type { Build } from "../build.ts";
import type { AreaApi } from "../extract/api.ts";
import type { Block, Card, Inline, Tab } from "../model.ts";
import { slugOf } from "../model.ts";
import type { Area } from "../sources.ts";
import { moduleComment } from "../tsdoc.ts";
import { areaPage, firstSentence } from "../pages/overview.ts";

/** A table of a model, with its page. */
interface ModelTable {
  readonly name: string;
  readonly value: AnyTable;
  readonly page: string;
}

/** A schema: an area's tables, views and indexes, and the context its SQL is written in. */
export interface Model {
  /** The area. */
  readonly area: Area;
  /** Its page. */
  readonly page: string;
  /** Its tables, by export name. */
  readonly tables: readonly ModelTable[];
  /** Its views and indexes, by export name. */
  readonly others: readonly { readonly name: string; readonly value: Entity }[];
  /** The documentation maps it exports. */
  readonly docs: readonly Docs[];
}

/** Whether a value is a table of SQL Aide. */
function isTable(v: unknown): v is AnyTable {
  return typeof v === "object" && v !== null && "entity" in v && v.entity === "table" && "spec" in v && "ddl" in v;
}

/** Whether a value is an entity of SQL Aide with a definition: a view or an index. */
function isEntity(v: unknown): v is Entity {
  return typeof v === "object" && v !== null && "entity" in v && typeof v.entity === "string" && "ddl" in v && "dependsOn" in v &&
    typeof v.dependsOn === "function";
}

/** Whether a value is a documentation map of SQL Aide. */
function isDocs(v: unknown): v is Docs {
  return v instanceof Map && [...v.values()].every((d: unknown) => typeof d === "object" && d !== null && "summary" in d);
}

const MODEL_TYPE = /^const [\w$]+: (Table|View|Index)</;
const DOCS_TYPE = /^const [\w$]+: (Docs|ReadonlyMap<object, EntityDoc>)$/;

/** The page of a model, and of one of its entities. */
const modelPage = (area: Area): string => `models/${area.slug}/index.html`;
const entityPage = (area: Area, name: string): string => `models/${area.slug}/${slugOf(name)}.html`;

/**
 * The models of the areas: for each area whose API exports tables, views or indexes, its module imported and those values read.
 *
 * @param b - the build
 * @param areas - the areas
 * @param apis - their APIs
 */
export async function readModels(b: Build, areas: readonly Area[], apis: readonly AreaApi[]): Promise<Model[]> {
  const out: Model[] = [];
  for (const area of areas) {
    const api = apis.find((a) => a.slug === area.slug);
    if (api === undefined) continue;
    const names = api.exports.filter((e) => e.kinds.includes("const") && MODEL_TYPE.test(e.signature)).map((e) => e.name);
    if (names.length === 0) continue;
    const docNames = api.exports.filter((e) => e.kinds.includes("const") && DOCS_TYPE.test(e.signature)).map((e) => e.name);
    const entry = `${area.pkg.dir}/${area.entryPoints[0] ?? ""}`;
    let mod: Record<string, unknown>;
    try {
      const imported: unknown = await import(b.abs(entry));
      mod = typeof imported === "object" && imported !== null ? Object.fromEntries(Object.entries(imported)) : {};
    } catch (e) {
      b.found.push({ where: entry, problem: { kind: "import-failed", error: e instanceof Error ? e.message : String(e) } });
      continue;
    }
    const tables: ModelTable[] = [];
    const others: { name: string; value: Entity }[] = [];
    for (const n of names) {
      const v = mod[n];
      if (isTable(v)) {
        tables.push({ name: n, value: v, page: entityPage(area, v.spec.name) });
        b.entityPages.set(`${area.slug}!${n}`, entityPage(area, v.spec.name));
      }
      else if (isEntity(v)) others.push({ name: n, value: v });
    }
    const docs = docNames.map((n) => mod[n]).filter(isDocs);
    out.push({ area, page: modelPage(area), tables, others, docs });
  }
  return out;
}

const t = (s: string): Inline => ({ kind: "text", text: s });
const c = (s: string): Inline => ({ kind: "code", text: s });
const heading = (id: string, s: string): Block => ({ kind: "heading", level: 2, id, text: [t(s)] });

/** The name of a column's logical type. */
function domainOf(d: AnyTable["spec"]["columns"][number][1]["domain"]): string {
  switch (d.kind) {
    case "array":
      return `${domainOf(d.of)}[]`;
    case "custom":
      return d.name;
    default:
      return d.kind;
  }
}

/**
 * The SQL of entities for each dialect, as tabs; a dialect that cannot write them says why. The entities are values read at run time,
 * so their fit to each dialect, which the compiler checks where a model is written, is checked here by rendering them.
 */
function ddlTabs(id: string, entities: readonly Entity[], docs: readonly Docs[]): Block {
  const dialects = [
    ["PostgreSQL", () => context({ dialect: postgres(), docs })],
    ["SQLite", () => context({ dialect: sqlite(), docs })],
    ["DuckDB", () => context({ dialect: duckdb(), docs })],
  ] as const;
  const tabs: Tab[] = dialects.map(([label, ctx]) => {
    try {
      return { label, blocks: [{ kind: "code", lang: "sql", text: renderUnchecked(definitions(entities), ctx()) }] };
    } catch (e) {
      return { label, blocks: [{ kind: "callout", tone: "limit", title: `Not written for ${label}`, blocks: [{ kind: "paragraph", inlines: [t(e instanceof Error ? e.message : String(e))] }] }] };
    }
  });
  return { kind: "tabs", id, tabs };
}

/** What a table's description is: its own, or its documentation map's. */
const describe = (tb: AnyTable, ctx: EmitContext): string | undefined => tb.spec.doc ?? ctx.docs.get(tb)?.summary;
const columnDoc = (tb: AnyTable, ctx: EmitContext, n: string): string | undefined =>
  tb.spec.columns.find(([m]) => m === n)?.[1].doc ?? ctx.docs.get(tb)?.members?.[n];

/** The tables a table points to and the tables that point to it, within a model. */
function neighbours(m: Model, tb: AnyTable): AnyTable[] {
  const name = tb.spec.name;
  const refs = new Set(tb.spec.columns.flatMap(([, col]) => (col.references?.table === undefined ? [] : [col.references.table().name])));
  return m.tables.map((x) => x.value).filter((x) => x !== tb && (refs.has(x.spec.name) || x.spec.columns.some(([, col]) => col.references?.table?.().name === name)));
}

/** Cards for the layouts the File Aide lens shows, by the pages it registered. */
function layoutCards(b: Build): Card[] {
  const pages = new Map<string, string>();
  for (const [key, page] of b.entityPages) if (page.endsWith("/index.html") && !pages.has(page)) pages.set(page, key.split("!")[0] ?? "");
  return [...pages].map(([page, area]) => ({ title: `${area} layout`, href: { kind: "page", path: page }, text: [t("A layout of files: its tree, patterns and segments.")] }));
}

/** The page of each model, of each of its tables, the Governance page and the section's home. */
export function modelPages(b: Build, models: readonly Model[]): void {
  const govRows: Inline[][][] = [];
  const ownerRows: Inline[][][] = [];
  const lintRows: Inline[][][] = [];
  models.forEach((m, mi) => {
    const ctx = context({ dialect: postgres(), docs: m.docs });
    const scope = { page: m.page, file: `${m.area.pkg.dir}/${m.area.entryPoints[0] ?? ""}`, area: m.area.slug };
    const tables = m.tables.map((x) => x.value);
    const doc = b.exists(scope.file) ? moduleComment(b.read(scope.file)) : undefined;
    for (const x of m.tables) {
      const tb = x.value;
      if (describe(tb, ctx) === undefined) b.found.push({ where: scope.file, problem: { kind: "undescribed", entity: `table ${tb.spec.name}` } });
      for (const [n, col] of tb.spec.columns) {
        if (col.personal !== undefined) {
          govRows.push([[{ kind: "link", href: { kind: "page", path: x.page, anchor: `col-${slugOf(n)}` }, children: [c(`${tb.spec.name}.${n}`)] }], [t(m.area.title)], [t(col.personal)], col.category === undefined ? [] : [c(col.category)]]);
        }
      }
      ownerRows.push([[{ kind: "link", href: { kind: "page", path: x.page }, children: [c(tb.spec.name)] }], [t(m.area.title)], tb.spec.owner === undefined ? [t("none")] : [t(tb.spec.owner)]]);
    }
    const findings: readonly LintFinding[] = lint(tables, ctx);
    for (const f of findings) {
      const page = m.tables.find((x) => x.value.spec.name === f.table)?.page ?? m.page;
      lintRows.push([[{ kind: "link", href: { kind: "page", path: page }, children: [c(f.column === undefined ? f.table : `${f.table}.${f.column}`)] }], [t(m.area.title)], [c(f.rule)], [t(f.message)]]);
    }
    const blocks: Block[] = [];
    if (doc !== undefined) blocks.push(...b.md(firstSentence(doc.summary, 400), scope));
    blocks.push({ kind: "meta", inlines: [t("The API of this model: "), { kind: "link", href: { kind: "page", path: areaPage(m.area) }, children: [t(m.area.title)] }] });
    if (tables.length > 0) {
      blocks.push(heading("diagram", "Entity-relationship diagram"), { kind: "diagram", source: mermaidErd(tables), caption: `The tables of ${m.area.title} and their foreign keys.` });
      blocks.push(heading("tables", "Tables"), {
        kind: "table",
        head: [[t("Table")], [t("What it is")], [t("Columns")], [t("Personal data")], [t("Owner")]],
        rows: m.tables.map((x) => [
          [{ kind: "link", href: { kind: "page", path: x.page }, children: [c(x.value.spec.name)] }],
          b.line(describe(x.value, ctx) ?? "", scope),
          [t(String(x.value.spec.columns.length))],
          [t(String(x.value.spec.columns.filter(([, col]) => col.personal !== undefined).length))],
          [t(x.value.spec.owner ?? "none")],
        ]),
      });
    }
    if (m.others.length > 0) {
      blocks.push(heading("views-and-indexes", "Views and indexes"), {
        kind: "list",
        ordered: false,
        items: m.others.map((o) => [{ kind: "paragraph", inlines: [c(o.name), t(` — ${o.value.entity}`)] }]),
      });
    }
    blocks.push(heading("sql", "SQL"), ddlTabs(`${m.area.slug}-sql`, [...tables, ...m.others.map((o) => o.value)], m.docs));
    b.add({ path: m.page, title: `${m.area.title} model`, description: `The schema ${m.area.title} defines.`, section: "models", group: m.area.title, order: 100 + mi * 100, navTitle: "Model", blocks });

    m.tables.forEach((x, ti) => {
      const tb = x.value;
      const ts = { ...scope, page: x.page };
      const near = neighbours(m, tb);
      const tblocks: Block[] = [];
      const d = describe(tb, ctx);
      if (d !== undefined) tblocks.push(...b.md(d, ts));
      tblocks.push({ kind: "badges", badges: [{ text: `owner: ${tb.spec.owner ?? "none"}`, tone: tb.spec.owner === undefined ? "warn" : "neutral" }, { text: `${tb.spec.columns.length} columns`, tone: "neutral" }] });
      tblocks.push(heading("columns", "Columns"));
      for (const [n, col] of tb.spec.columns) {
        const badges = [
          { text: domainOf(col.domain), tone: "neutral" as const },
          ...(tb.spec.primaryKey.includes(n) ? [{ text: "primary key", tone: "info" as const }] : []),
          ...(col.nullable ? [{ text: "nullable", tone: "neutral" as const }] : []),
          ...(col.personal === undefined ? [] : [{ text: col.category === undefined ? col.personal : `${col.personal}: ${col.category}`, tone: "warn" as const }]),
        ];
        const ref = col.references;
        const refBlock: Block[] = ref === undefined
          ? []
          : (() => {
            const target = ref.table === undefined ? tb.spec.name : ref.table().name;
            const page = m.tables.find((y) => y.value.spec.name === target)?.page;
            const shown = c(`${target}.${ref.column}`);
            return [{ kind: "meta" as const, inlines: [t("References "), page === undefined ? shown : { kind: "link" as const, href: { kind: "page" as const, path: page, anchor: `col-${slugOf(ref.column)}` }, children: [shown] }] }];
          })();
        const cd = columnDoc(tb, ctx, n);
        tblocks.push({ kind: "entry", id: `col-${slugOf(n)}`, name: n, badges, blocks: [...(cd === undefined ? [] : b.md(cd, ts)), ...refBlock] });
      }
      if (near.length > 0) {
        tblocks.push(heading("neighbours", "Neighbours"), { kind: "diagram", source: mermaidErd([tb, ...near]), caption: `${tb.spec.name} and the tables it touches.` });
      }
      const idx = m.others.filter((o) => o.value.entity === "index" && o.value.dependsOn().some((e) => e.name === tb.spec.name)).map((o) => o.value);
      const views = m.others.filter((o) => o.value.entity === "view" && o.value.dependsOn().some((e) => e.name === tb.spec.name));
      if (views.length > 0) tblocks.push(heading("views", "Views that read it"), { kind: "list", ordered: false, items: views.map((v) => [{ kind: "paragraph", inlines: [c(v.name)] }]) });
      tblocks.push(heading("sql", "SQL"), ddlTabs(`${slugOf(tb.spec.name)}-sql`, [tb, ...idx], m.docs));
      b.add({ path: x.page, title: tb.spec.name, description: d ?? `A table of ${m.area.title}.`, section: "models", group: m.area.title, order: 100 + mi * 100 + ti + 1, blocks: tblocks });
    });
  });
  const cards: Card[] = models.map((m) => ({ title: `${m.area.title} model`, href: { kind: "page", path: m.page }, text: [t(`${m.tables.length} tables, ${m.others.length} views and indexes.`)] }));
  b.add({
    path: "models/index.html",
    title: "Models",
    description: "The schemas commons' libraries define, and their governance.",
    section: "models",
    group: "Models",
    order: 0,
    blocks: [
      { kind: "paragraph", inlines: [t("The schemas the libraries define, read from their TypeScript and shown with SQL Aide's own diagrams and SQL.")] },
      { kind: "cards", cards: [...cards, ...layoutCards(b), { title: "Governance", href: { kind: "page", path: "models/governance.html" }, text: [t("Personal data, owners and what the lint rules find, across every model.")] }] },
    ],
  });
  b.add({
    path: "models/governance.html",
    title: "Governance",
    description: "Personal data by category, tables by owner, and lint findings, across every model.",
    section: "models",
    group: "Models",
    order: 1,
    blocks: [
      { kind: "paragraph", inlines: [t("What the models say of their data, gathered from every model: the columns marked as personal data with their class and category of the Data Privacy Vocabulary, who answers for each table, and what SQL Aide's typical lint rules find.")] },
      heading("personal-data", "Personal data"),
      govRows.length === 0 ? { kind: "paragraph", inlines: [t("No column is marked as personal data.")] } : { kind: "table", head: [[t("Column")], [t("Model")], [t("Class")], [t("Category")]], rows: govRows },
      heading("owners", "Owners"),
      { kind: "table", head: [[t("Table")], [t("Model")], [t("Owner")]], rows: ownerRows },
      heading("lint", "Lint findings"),
      lintRows.length === 0 ? { kind: "paragraph", inlines: [t("The typical rules find nothing.")] } : { kind: "table", head: [[t("Where")], [t("Model")], [t("Rule")], [t("What")]], rows: lintRows },
    ],
  });
}
