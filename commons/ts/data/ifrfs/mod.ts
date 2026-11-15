/**
 * IFRFS, the IF Renditions File System: the layout of the folder erga's `publication sync` fills with the works' renditions and issues,
 * written with File Aide's public entry point alone, and the layout that accepts File Aide (commons 0010-file-aide FR-038). It imports
 * nothing of erga.
 *
 * @module
 */
import {
  bytes,
  entry,
  enumeration,
  json5,
  type Layout,
  layout,
  type LayoutError,
  path,
  rest,
  type Result,
  slug,
  text,
  ulid,
} from "../file-aide/mod.ts";

/** The first line of the README the sync writes, by which a sync knows a folder it may remove whole. */
export const MARKER = "<!-- Filled by ergactl publication sync; ergactl may remove this folder whole (250-ergactl-publication FR-008). -->";

/** The kinds of work whose renditions the folder holds. */
export const KINDS = [
  "book",
  "book-series",
  "course",
  "deck",
  "elenchus",
  "essay",
  "patent",
  "patent-family",
  "os-cli",
  "os-container",
  "os-desktop",
  "os-mobile",
  "browser-extn",
  "research",
  "spoken",
] as const;

/** The kind of a work. */
export const kind = enumeration("kind", KINDS);
/** The work's slug: lowercase words joined by hyphens. */
export const work = slug("slug");

/** The folder's `README.md`, which says what the folder is and begins with the sync's marker. */
export const readme = entry("readme", path`README.md`, {
  codec: text,
  description: "What the folder is, how it is filled and its layout; its first line is the sync's marker.",
  owner: "if",
});

/** A file of a work's renditions, directly in its folder or below it, anywhere but `issues.d/`. */
export const rendition = entry("rendition", path`${kind}/${work}/${rest("file", { except: ["issues.d"] })}`, {
  codec: bytes,
  description: "A file of a work's renditions, named as an edition names it.",
  owner: "if",
});

/** One issue of a work, as JSON5. */
export const issue = entry("issue", path`${kind}/${work}/issues.d/${ulid("id")}.json5`, {
  codec: json5,
  description: "One issue of a work, its events merged, as JSON5.",
  owner: "if",
});

/** The entries of IFRFS. */
export const ENTRIES = [readme, rendition, issue] as const;

/** The layout of IFRFS, or why it could not be made. */
export function ifrfs(): Result<Layout<typeof ENTRIES>, LayoutError> {
  return layout(ENTRIES);
}
