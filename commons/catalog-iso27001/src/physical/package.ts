// Spec: 0002-iso27001-package FR-002, FR-003, FR-004
/**
 * The files of the package (0002-iso27001-package FR-002, FR-003, FR-004): from the entries to the text of each file, with the manifest's digests, and the folder where they are kept. Making is pure; reading and writing the folder is the tool's.
 *
 * @example
 * ```ts
 * import { PACKAGE_DIR } from "./package.ts";
 * PACKAGE_DIR.endsWith("data"); // true
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { path } from "@intellectual-frontiers/system";
import { ATTRIBUTES, CLAUSES, CONTROLS, FRAMEWORKS, LICENCE, MADE_AT, REFERENCES, SOURCE_FILES, THEMES } from "@intellectual-frontiers/catalog-iso27001/governance";
import { convert } from "@intellectual-frontiers/catalog-iso27001/logical";

/** The folder of the package: the one the loader of grc reads. */
export const PACKAGE_DIR: string = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..", "data");

const head = (kind: string, id: string): Record<string, unknown> => ({ kind, schema: "1", id, createdAt: MADE_AT, provenance: { producer: { name: "catalog-iso27001", version: "1" }, inputs: SOURCE_FILES } });
const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** The path of each framework's file inside the package. */
export const FRAMEWORK_FILES = {
  iso27001: `frameworks/${FRAMEWORKS.iso27001.id}-${FRAMEWORKS.iso27001.version}.json`,
  iso27002: `frameworks/${FRAMEWORKS.iso27002.id}-${FRAMEWORKS.iso27002.version}.json`,
} as const;

/** What a manifest says about the content that is not there. */
export const NOTICE =
  "ISO/IEC 27001:2022 and ISO/IEC 27002:2022 have not been read: the publisher's page refused the fetch and the text is a licensed work, so every title and statement here is our own understanding of what each clause and control asks, and a person who holds the standards must check every row before the package is relied on for a certification. The value of each attribute of ISO/IEC 27002 for each control is not in the package.";

/** The text of every file of the package, by its path, given the SHA-256 of each source file the entries are in. */
export async function makePackage(sourceDigests: Readonly<Record<string, string>>): Promise<ReadonlyMap<string, string>> {
  const sets = { iso27001: [...CLAUSES, ...CONTROLS], iso27002: [...THEMES, ...ATTRIBUTES] } as const;
  const files = new Map<string, string>();
  const holds: { kind: string; id: string; file: string; digest: string }[] = [];
  for (const key of ["iso27001", "iso27002"] as const) {
    const c = convert(sets[key]);
    if (c.repeated.length > 0) throw new Error(`${FRAMEWORKS[key].id} repeats ${c.repeated.join(", ")}`);
    const text = json({ ...head("grc.framework", FRAMEWORKS[key].id), version: FRAMEWORKS[key].version, title: FRAMEWORKS[key].title, controls: c.controls, publisher: REFERENCES[key].publisher, source: REFERENCES[key].url });
    files.set(FRAMEWORK_FILES[key], text);
    holds.push({ kind: "grc.framework", id: FRAMEWORKS[key].id, file: FRAMEWORK_FILES[key], digest: await sha256(new TextEncoder().encode(text)) });
  }
  const manifest = json({
    ...head("grc.catalog-package", "catalog-iso27001"),
    version: "1",
    title: "ISO/IEC 27001:2022 and ISO/IEC 27002:2022: the clauses, the controls of Annex A and the themes and attributes, in our own words, unread",
    source: {
      publisher: "Intellectual Frontiers LLC, from what is published about ISO and IEC standards that it has not read",
      edition: [REFERENCES.iso27001, REFERENCES.iso27002].map((r) => `${r.edition}, ${r.readOn}, ${r.url}`).join("; "),
      url: REFERENCES.iso27001.url,
    },
    licence: LICENCE,
    redistributable: true,
    holds,
    sources: SOURCE_FILES.map((url) => ({ url, sha256: sourceDigests[url] ?? "" })),
    notice: NOTICE,
  });
  files.set("manifest.json", manifest);
  return new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** The SHA-256 of the bytes of a source file, as the package records it. */
export async function digestOf(bytes: Uint8Array): Promise<string> {
  return sha256(bytes);
}
