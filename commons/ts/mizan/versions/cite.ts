/**
 * The citation file of a work (commons 0026-works-versioning FR-024, FR-029): `CITATION.cff` in the Citation File Format 1.2.0, made deterministically from the work's record and the day of the
 * release's commit. A DOI or an ISBN is written only where the record carries an `identifier`; no tool of the specification mints, requires or registers one.
 *
 * @remarks
 * Pure. Strings are written as JSON strings, which are valid YAML double-quoted scalars, so no value needs another quoting rule. The authors are written by `name`, as the record holds them. The
 * file lists the same fields in the same order every time, so `versions cite --check` compares text.
 *
 * @limits
 * It does not read Git: the day is an argument. It does not validate the file against the CFF schema, which is outside the repository's tools.
 *
 * @example
 * ```ts
 * import { citationOf } from "./cite.ts";
 * // citationOf(release, "2026-11-17") -> "cff-version: 1.2.0\nmessage: ..."
 * ```
 *
 * @module
 */
import type { Release } from "./record.ts";

/** The message every citation file carries. */
export const CITATION_MESSAGE = "If you use this work, please cite it as below.";

/** The kind and value of an identifier: a DOI (bare, from `doi:` or a doi.org URL) or another identifier such as an ISBN, as written. */
export function identifierOf(identifier: string): { readonly type: "doi" | "other"; readonly value: string } {
  const m = /^(?:doi:|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i.exec(identifier.trim());
  return m?.[1] === undefined ? { type: "other", value: identifier.trim() } : { type: "doi", value: m[1] };
}

/** The text of `CITATION.cff` for a record released on a day (the day of the release's commit), or why a work has none. */
export function citationOf(r: Release, releasedOn: string): string | undefined {
  if (r.version === undefined) return undefined;
  const q = (s: string): string => JSON.stringify(s);
  const lines = [
    "cff-version: 1.2.0",
    `message: ${q(CITATION_MESSAGE)}`,
    `title: ${q(r.title)}`,
    `version: ${q(r.version)}`,
    `date-released: ${releasedOn}`,
    "authors:",
    ...r.authors.map((a) => `  - name: ${q(a.name)}`),
    ...(r.repository === undefined ? [] : [`repository-code: ${q(r.repository)}`]),
  ];
  if (r.identifier !== undefined) {
    const id = identifierOf(r.identifier);
    lines.push("identifiers:", `  - type: ${id.type}`, `    value: ${q(id.value)}`);
  }
  return `${lines.join("\n")}\n`;
}
