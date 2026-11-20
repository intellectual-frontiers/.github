// Spec: 0058-sql-osquery FR-001
/**
 * Writes the osquery schema the library imports (commons data 0058-sql-osquery FR-001): the published schema of one osquery version, from a checkout of `osquery/osquery-site`, trimmed to the fields the importer reads
 * and stamped with where it came from (the repository, the commit, the path and the SHA-256 of the file) and its licence. The schema is never written by hand.
 *
 *   bun tools/osquery-schema.ts <osquery-site checkout> <version>
 *
 * @module
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Published = readonly { readonly name: string; readonly description: string; readonly platforms: readonly string[]; readonly evented: boolean; readonly cacheable: boolean; readonly columns: readonly Record<string, unknown>[] }[];

/** The text of the trimmed schema file: one table to a line, so that a change is a readable diff. */
export function trimmed(raw: Buffer, version: string, commit: string, path: string): string {
  const published = JSON.parse(raw.toString("utf8")) as Published;
  const tables = published.map((t) => ({
    name: t.name,
    description: t.description,
    platforms: t.platforms,
    evented: t.evented,
    cacheable: t.cacheable,
    columns: t.columns.map((c) => ({ name: c["name"], description: c["description"], type: c["type"], hidden: c["hidden"], required: c["required"], index: c["index"], ...(c["platforms"] === undefined ? {} : { platforms: c["platforms"] }) })),
  }));
  const head = {
    osquery: version,
    source: {
      repository: "https://github.com/osquery/osquery-site",
      commit,
      path,
      sha256: createHash("sha256").update(raw).digest("hex"),
      license: "CC-BY-4.0 (the osquery-site documentation data); the osquery project is Apache-2.0 OR GPL-2.0-only",
      note: "Trimmed to the fields the importer reads (examples, notes and urls are left out); regenerate with `bun tools/osquery-schema.ts <osquery-site checkout> <version>`.",
    },
  };
  return `{\n"osquery":${JSON.stringify(head.osquery)},\n"source":${JSON.stringify(head.source)},\n"tables":[\n${tables.map((t) => JSON.stringify(t)).join(",\n")}\n]\n}\n`;
}

if (import.meta.main) {
  const [checkout, version] = process.argv.slice(2);
  if (checkout === undefined || version === undefined) {
    console.error("usage: bun tools/osquery-schema.ts <osquery-site checkout> <version>");
    process.exit(2);
  }
  const path = `src/data/osquery_schema_versions/${version}.json`;
  const raw = readFileSync(join(checkout, path));
  const commit = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const out = join(dirname(fileURLToPath(import.meta.url)), "..", "sql", "extensions", "osquery", "schema", `osquery-${version}.auto.json`);
  writeFileSync(out, trimmed(raw, version, commit, path));
  console.log(`wrote ${out}`);
}
