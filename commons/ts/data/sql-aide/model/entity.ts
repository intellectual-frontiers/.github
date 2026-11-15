/**
 * The entities of a model and the order they are emitted in: a referenced entity before the one that refers to it
 * (commons 0009-sql-aide FR-009).
 *
 * @module
 */
import { err, ok, order, type Result } from "../../../kernel/mod.ts";
import { type AnySql, type Chunk, chunkOf, chunkText, type DxOf, type ReqOf, sql, type Sql } from "../emit/sql.ts";

/** What names an entity: its name and the schema it lives in. */
export interface EntityName {
  /** The entity's name. */
  readonly name: string;
  /** The schema it lives in, where there is one. */
  readonly schema: string | undefined;
}

/** What every entity of a model has: a kind, a name, a definition and the entities it needs. */
export interface Entity extends EntityName {
  /** The kind of entity (`table`, `view`, `routine`, ...). */
  readonly entity: string;
  /** The statement, or statements, that define it. */
  readonly ddl: AnySql;
  /** The entities it refers to. */
  readonly dependsOn: () => readonly EntityName[];
}

/** The key of an entity by its schema and name, as a reference to it is written. */
export const entityKey = (e: EntityName): string => `${e.schema ?? ""}.${e.name}`;

/** A model whose entities need each other in a circle. */
export type CycleError = { readonly kind: "cycle"; readonly entities: readonly string[] };

/**
 * Puts entities in the order they must be defined in. An entity is defined after every entity of the list that it names, and after the
 * schema it lives in where the list has that schema. A reference to an entity outside the list, or to itself, asks for nothing.
 *
 * @param entities - the entities of a model, in the order written
 */
export function ordered<E extends Entity>(entities: readonly E[]): Result<readonly E[], CycleError> {
  const named = new Map<string, number[]>();
  entities.forEach((e, i) => {
    if (e.entity === "schema") return;
    named.set(entityKey(e), [...(named.get(entityKey(e)) ?? []), i]);
  });
  const schemas = new Map<string, number>();
  entities.forEach((e, i) => {
    if (e.entity === "schema") schemas.set(e.name, i);
  });
  const needs = new Map<string, readonly string[]>();
  entities.forEach((e, i) => {
    const after = new Set<number>();
    for (const d of e.dependsOn()) for (const j of named.get(entityKey(d)) ?? []) after.add(j);
    const home = e.schema === undefined || e.entity === "schema" ? undefined : schemas.get(e.schema);
    if (home !== undefined) after.add(home);
    after.delete(i);
    needs.set(String(i), [...after].sort((a, b) => a - b).map(String));
  });
  const sorted = order(needs);
  if (sorted.kind === "err") return err({ kind: "cycle", entities: sorted.error.nodes.map((n) => entities[Number(n)]?.name ?? n) });
  return ok(
    sorted.value.flatMap((n) => {
      const e = entities[Number(n)];
      return e === undefined ? [] : [e];
    }),
  );
}

/**
 * The definitions of a model's entities, in order, a blank line between them.
 *
 * @param entities - the entities; where they need each other in a circle the rendering fails, naming them
 */
export function definitions<const E extends readonly Entity[]>(
  entities: E,
): Sql<"fragment", unknown, ReqOf<E[number]["ddl"]>, DxOf<E[number]["ddl"]>> {
  return sql("fragment", () => {
    const sorted = ordered(entities);
    if (sorted.kind === "err") throw new Error(`entities need each other in a circle: ${sorted.error.entities.join(", ")}`);
    const out: Chunk[] = [];
    sorted.value.forEach((e, i) => out.push(...(i === 0 ? [chunkOf(e.ddl)] : [chunkText("\n\n"), chunkOf(e.ddl)])));
    return out;
  });
}
