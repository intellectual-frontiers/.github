// Spec: 0002-sp800-package FR-001, FR-004
/**
 * The conversion of a NIST OSCAL catalog into frameworks (0002-sp800-package FR-001, FR-004): a pure function of the catalog. For SP 800-53 and SP 800-171 the controls are the requirements that are not withdrawn, with their statement as NIST wrote it and the group
 * (the family) as the family; the assessment objectives (SP 800-53A, SP 800-171A) are a framework of their own whose controls are the objectives that have no objective below them, so that evidence can be tied to what an assessor determines. A parameter that the text inserts is
 * written as its label in brackets, as the printed publications do.
 *
 * @example
 * ```ts
 * import { convertCatalog } from "./convert.ts";
 * convertCatalog({ catalog: { groups: [] } }, "800-53").requirements; // []
 * ```
 *
 * @module
 */

type Prop = { readonly name: string; readonly value: string; readonly class?: string };
type Param = { readonly id: string; readonly label?: string; readonly select?: { readonly choice?: readonly string[]; readonly "how-many"?: string } };
type Part = { readonly id?: string; readonly name: string; readonly prose?: string; readonly props?: readonly Prop[]; readonly parts?: readonly Part[] };
type Control = { readonly id: string; readonly title: string; readonly props?: readonly Prop[]; readonly params?: readonly Param[]; readonly parts?: readonly Part[]; readonly controls?: readonly Control[] };
type Group = { readonly id: string; readonly title: string; readonly controls?: readonly Control[]; readonly groups?: readonly Group[] };

/** The part of an OSCAL document this conversion reads. */
export type Catalog = { readonly catalog: { readonly groups?: readonly Group[]; readonly controls?: readonly Control[] } };

/** A control of a converted framework. */
export type OutControl = { readonly id: string; readonly title: string; readonly statement: string; readonly family: string };
/** What a catalog gives: the requirements and the assessment objectives. */
export type Converted = { readonly requirements: readonly OutControl[]; readonly objectives: readonly OutControl[] };

const label = (props: readonly Prop[] | undefined, klass?: string | null): string | undefined => props?.find((p) => p.name === "label" && (klass === undefined ? true : klass === null ? p.class === undefined : p.class === klass))?.value;
const status = (props: readonly Prop[] | undefined): string | undefined => props?.find((p) => p.name === "status")?.value;

function paramText(p: Param | undefined, id: string): string {
  if (p === undefined) return id;
  if (p.label !== undefined) return `[Assignment: ${p.label}]`;
  const choices = p.select?.choice;
  return choices === undefined ? id : `[Selection${p.select?.["how-many"] === "one-or-more" ? " (one or more)" : ""}: ${choices.join("; ")}]`;
}

/** The text of a part and its items, one line each, with the labels the publication prints and the inserted parameters written out. */
function textOf(part: Part, params: ReadonlyMap<string, Param>, depth = 0): string[] {
  const own = (part.prose ?? "").replace(/\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g, (_m, id: string) => paramText(params.get(id), id)).replace(/\s+/g, " ").trim();
  const lab = label(part.props)?.replace(/^SR-\d\d\.\d\d\.\d\d\./, "");
  const line = own === "" ? [] : [`${"  ".repeat(depth)}${lab === undefined ? "" : `${lab} `}${own}`];
  return [...line, ...(part.parts ?? []).flatMap((p) => textOf(p, params, depth + 1))];
}

function* walk(controls: readonly Control[] | undefined): Generator<Control> {
  for (const c of controls ?? []) {
    yield c;
    yield* walk(c.controls);
  }
}

function* allControls(groups: readonly Group[] | undefined): Generator<{ readonly group: Group; readonly control: Control }> {
  for (const g of groups ?? []) {
    for (const c of walk(g.controls)) yield { group: g, control: c };
    yield* allControls(g.groups);
  }
}

/** The leaf objectives of a part tree with the label each prints (an objective with objectives below it is not a unit to be determined). */
function* leaves(part: Part): Generator<Part> {
  const below = (part.parts ?? []).filter((p) => p.name === "assessment-objective");
  if (below.length === 0) {
    if (part.name === "assessment-objective" && (part.prose ?? "") !== "") yield part;
    return;
  }
  for (const p of below) yield* leaves(p);
}

/** The requirements and objectives of a catalog; `kind` says which publication it is (they label their controls differently). */
export function convertCatalog(doc: Catalog, kind: "800-53" | "800-171"): Converted {
  const requirements: OutControl[] = [];
  const objectives: OutControl[] = [];
  for (const { group, control } of allControls(doc.catalog.groups)) {
    if (status(control.props) === "withdrawn") continue;
    const params = new Map((control.params ?? []).map((p) => [p.id, p]));
    const id = kind === "800-53" ? (label(control.props, null) ?? control.id.toUpperCase()) : control.id.replace(/^SP_800_171_/, "");
    const stmt = (control.parts ?? []).filter((p) => p.name === "statement").flatMap((p) => textOf(p, params)).join("\n");
    const family = group.id.replace(/^SP_800_171_/, "").toUpperCase();
    requirements.push({ id, title: control.title, statement: stmt, family });
    for (const part of control.parts ?? []) {
      if (part.name !== "assessment-objective") continue;
      for (const leaf of leaves(part)) {
        const lab = kind === "800-53" ? label(leaf.props) : (leaf.id ?? "").replace(/^assessment-objective_DS-/, "");
        if (lab === undefined || lab === "") continue;
        objectives.push({ id: lab, title: `${control.title}`, statement: textOf(leaf, params).join(" "), family: id });
      }
    }
  }
  const byId = <T extends { id: string }>(xs: readonly T[]): T[] => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { requirements: byId(requirements), objectives: byId(objectives) };
}
