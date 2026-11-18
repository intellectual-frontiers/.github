// Spec: 0010-sql-generators FR-001, FR-002, FR-003, FR-004
/**
 * Generators (commons data 0010-sql-generators): what a person or a program reads of a schema is made from it. A generator is a value with an identifier and a function from a logical schema, a
 * naming and an optional dialect to files, a path and a text each, or to error values; it knows no database and reads nothing else. An extension contributes it through the engine's point
 * `physical.generators`, and `generate` runs the generators it is given.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { type Composition, point } from "@intellectual-frontiers/data/engine";
import type { LogicalId, LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { type Naming, naming as defaultNaming } from "./case.ts";
import type { Dialect } from "./dialect.ts";

/** A file a generator makes. */
export interface Artifact {
  /** Where it goes, relative to wherever the files are written, with `/`. */
  readonly path: string;
  readonly text: string;
}

/** What a generator is given. */
export interface GenerateContext {
  readonly schema: LogicalSchema;
  readonly naming: Naming;
  /** The dialect whose types a generator may write, where one is wanted. */
  readonly dialect?: Dialect;
}

/** What is wrong with a generation; `generate` returns all of it together. */
export type GenerateError =
  | { readonly kind: "unsupported"; readonly generator: string; readonly element: LogicalId; readonly why: string }
  | { readonly kind: "path"; readonly path: string; readonly generators: readonly string[] };

/** A generator. */
export interface Generator {
  readonly id: string;
  /** What it makes, in a few words. */
  readonly describe: string;
  generate(context: GenerateContext): Result<readonly Artifact[], readonly GenerateError[]>;
}

/** The contribution point an extension fills to add a generator. */
export const generatorsPoint = point<Generator>("physical.generators");

/**
 * The generators of a composition, in its order.
 *
 * @param composition - the project's composition
 * @returns the generators its extensions contribute
 */
export function generatorsFrom(composition: Composition): readonly Generator[] {
  return composition.contributions(generatorsPoint);
}

/** What `generate` is given besides the schema. */
export interface GenerateOptions {
  readonly generators: readonly Generator[];
  /** How names are written; snake case where none is given. */
  readonly naming?: Naming;
  readonly dialect?: Dialect;
}

/**
 * Runs generators over a logical schema.
 *
 * @param schema - the logical schema
 * @param options - the generators, the naming and the dialect
 * @returns every file, in the order of the generators, or every error
 */
export function generate(schema: LogicalSchema, options: GenerateOptions): Result<readonly Artifact[], readonly GenerateError[]> {
  const context: GenerateContext = {
    schema,
    naming: options.naming ?? defaultNaming(),
    ...(options.dialect === undefined ? {} : { dialect: options.dialect }),
  };
  const errors: GenerateError[] = [];
  const files: { readonly artifact: Artifact; readonly by: string }[] = [];
  for (const g of options.generators) {
    const r = g.generate(context);
    if (r.kind === "err") errors.push(...r.error);
    else for (const artifact of r.value) files.push({ artifact, by: g.id });
  }
  const byPath = new Map<string, string[]>();
  for (const f of files) byPath.set(f.artifact.path, [...(byPath.get(f.artifact.path) ?? []), f.by]);
  for (const [path, by] of byPath) if (by.length > 1) errors.push({ kind: "path", path, generators: by });
  return errors.length > 0 ? err(errors) : ok(files.map((f) => f.artifact));
}
