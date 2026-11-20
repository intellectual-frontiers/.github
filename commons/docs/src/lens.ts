// Spec: 0001-docs FR-001
/**
 * What a lens is (commons 0011-documentation FR-013, FR-026): a value a configuration passes, which knows one library. Its `read` is given
 * the build, the areas and their API once every API page is registered; it recognises the library's exports by the type the checker gives
 * each, imports their module, registers the page each entity is shown on (so that an API page can link to it), and returns what makes its
 * pages once every other page is made. The package ships no lens and depends on no library it shows.
 *
 * @module
 */
import type { Build } from "./build.ts";
import type { AreaApi } from "./extract/api.ts";
import type { Area } from "./sources.ts";

/** What makes a lens's pages: given the order its first group of pages takes in the Models section, it returns the order after its last. */
export type LensPages = (b: Build, after: number) => number;

/** A file a lens adds to the site beside its pages: the JSON of a model. */
export interface SiteFile {
  /** Where it is, from the site's root. */
  readonly path: string;
  readonly text: string;
  /** What it is, in a few words, for the index of the site that a program reads (`llms.txt`). */
  readonly what: string;
}

/** A lens: its name, and what reads its library's values and makes their pages. */
export interface Lens {
  /** Its name, as `data`. */
  readonly name: string;
  /** Reads the values of the areas whose exports are its library's, and returns what makes their pages. */
  readonly read: (b: Build, areas: readonly Area[], apis: readonly AreaApi[]) => Promise<LensPages>;
  /** The files it adds to the site once its pages are made (commons 0011-documentation FR-028). */
  readonly files?: (b: Build) => readonly SiteFile[];
}
