// Spec: 0002-engine FR-009
/**
 * A handle: what an extension is given to act with, and nothing more (commons data 0002-engine FR-009). A layer defines the handles it offers (the trace graph, the
 * statements to emit, the files to write) with `handle`; a project provides a value for each with `provide`; an extension says in its manifest which it uses, and its `activate`
 * can `use` only those. This is a discipline, not a sandbox: code that runs in the same process can import what it likes, and the layers check keeps it to public surfaces.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { PointName } from "./point.ts";

/** A handle: a named place for a value of type `T`, which the project provides. */
export interface Handle<T> {
  /** The handle's name, a namespace and a name like a contribution point's. */
  readonly name: PointName;
  /** Never set: carries what the handle gives, for the compiler. */
  readonly __gives?: T;
}

/**
 * Declares a handle.
 *
 * @param name - its namespace and name, such as `physical.statements`
 * @returns the handle, frozen
 */
export function handle<T>(name: PointName): Handle<T> {
  return Object.freeze({ name });
}

/** A value the project provides for a handle, made by `provide`. */
export interface Provided {
  readonly name: PointName;
  readonly value: unknown;
}

/**
 * Provides a value for a handle, typed by it.
 *
 * @param h - the handle
 * @param value - what it gives
 * @returns the provision, frozen
 */
export function provide<T>(h: Handle<T>, value: T): Provided {
  return Object.freeze({ name: h.name, value });
}

/** Why `use` gave nothing: the extension did not declare the handle, or the project did not provide it. */
export type HandleError =
  { readonly kind: "undeclared"; readonly handle: PointName } | { readonly kind: "unprovided"; readonly handle: PointName };

/** What `activate` is given. */
export interface Context {
  /** The value of a handle the manifest declared and the project provided. */
  use<T>(h: Handle<T>): Result<T, HandleError>;
}

/** The context of an extension: its declared handles, and what the project provided. */
export function contextFor(declared: readonly Handle<unknown>[], provided: ReadonlyMap<PointName, unknown>): Context {
  const names = new Set(declared.map((d) => d.name));
  return {
    use<T>(h: Handle<T>): Result<T, HandleError> {
      if (!names.has(h.name)) return err({ kind: "undeclared", handle: h.name });
      if (!provided.has(h.name)) return err({ kind: "unprovided", handle: h.name });
      // the one place a provided value is read back as its type: `provide` typed it by the same handle
      return ok(provided.get(h.name) as T);
    },
  };
}
