/**
 * Helpers for the tests of the logical schema: the schema of Arca's party model, a table by its name in snake case, and a small domain builder. Not a test itself.
 *
 * @module
 */
import {
  annotate,
  type Annotation,
  type AnyConcept,
  attribute,
  codeList,
  codeOf,
  concept,
  domain,
  type Domain,
  identifier,
  relationship,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import { partyDomain } from "@intellectual-frontiers/data/models/arca";
import {
  type LogicalSchema,
  projectDomain,
  type Projected,
  type ProjectionError,
  type Table,
} from "@intellectual-frontiers/data/sql/logical";

/** The domain of Arca's party model. */
export const arcaDomain = (): Domain => {
  if (partyDomain.kind === "err") throw new Error(JSON.stringify(partyDomain.error));
  return partyDomain.value;
};

/** The projection of a domain, which must not fail. */
export const projected = (d: Domain): Projected => {
  const r = projectDomain(d);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

/** The errors of the projection of a domain, which must fail. */
export const projectionErrors = (d: Domain): readonly ProjectionError[] => {
  const r = projectDomain(d);
  if (r.kind === "ok") throw new Error("the projection did not fail");
  return r.error;
};

/** The logical schema of Arca's party model. */
export const arcaSchema = (): LogicalSchema => projected(arcaDomain()).schema;

/** A table of a schema by its name in snake case. */
export const tableOf = (s: LogicalSchema, name: string): Table => {
  const t = s.tables.find((x) => x.name.join("_") === name);
  if (t === undefined) throw new Error(`no table ${name} in ${s.tables.map((x) => x.name.join("_")).join(", ")}`);
  return t;
};

/** A name as a list of words in snake case. */
export const snake = (words: readonly string[]): string => words.join("_");

/** The names of the columns of a table, in snake case. */
export const columnNames = (t: Table): string[] => t.columns.map((c) => snake(c.name));

const { quality } = vocabularies;

/** An open code list. */
export const openKinds = codeList("kinds", {
  definition: "Kinds of thing",
  codes: { alpha: { label: "Alpha", definition: "The first" }, betaGamma: { label: "Beta gamma" } },
  annotations: [annotate(quality.openness, "open")],
});

/** A concept with one required attribute that identifies it, the others being what a test adds. */
export const thing = (
  name: string,
  extra: Record<string, ReturnType<typeof attribute>> = {},
  annotations: readonly Annotation[] = [],
): AnyConcept =>
  concept(name, {
    definition: `A ${name}`,
    attributes: {
      id: attribute(identifier(), { definition: "What identifies it" }),
      label: attribute(text(), { definition: "What it is called" }),
      ...extra,
    },
    identifiedBy: ["id"],
    annotations,
  });

/** A domain of what a test gives it, which must be valid. */
export const world = (
  concepts: readonly AnyConcept[],
  lists: readonly ReturnType<typeof codeList>[] = [],
  annotations: readonly Annotation[] = [],
): Domain => {
  const r = domain("w", { definition: "A test domain", concepts, codeLists: lists, annotations });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

export { codeOf, relationship };
