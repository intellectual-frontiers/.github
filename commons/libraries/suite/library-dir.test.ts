/**
 * The folder of a library (commons 0027-commons-libraries FR-026, 0033-kanon FR-035): an extension of a host is inside the folder of its host, the one resolver finds a library where its manifest is, and
 * a library out of the folder its manifest derives is a finding of the check of the manifests.
 *
 * @module
 */
import { mkdirSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { derivedDir, LIBRARY_FILE, libraryDir, libraryDirs, manifestFindings, readLibraries } from "../src/libraries.ts";
import { decodeLibrarySource } from "../src/libraries.ts";

const SPEC = "0027-commons-libraries";
const manifest = (o: Readonly<Record<string, unknown>>): string =>
  `export const library = ${JSON.stringify({ verify: "bun run verify", version: "0.1.0", exports: ["."], level: "L0", ...o })};\n`;

/** Writes a library of the given folder (from `commons/`) with its manifest and its package. */
function lib(root: string, dir: string, name: string, extra: Readonly<Record<string, unknown>> = {}): void {
  mkdirSync(join(root, "commons", dir), { recursive: true });
  writeTextFileSync(join(root, "commons", dir, LIBRARY_FILE), manifest({ name, ...extra }));
  writeTextFileSync(
    join(root, "commons", dir, "package.json"),
    JSON.stringify({ name: `@intellectual-frontiers/${name}`, version: "0.1.0", exports: { ".": "./index.ts" }, scripts: { verify: "tsc" } }),
  );
}

const family = (host: string, role: string): Record<string, unknown> => ({ family: { host, role } });

proves([`${SPEC} FR-026`], "an extension of a host is found inside the folder of its host, and the resolver answers from where the manifest is", async () => {
  await withTempDir(async (root) => {
    lib(root, "anyfs", "anyfs", family("anyfs", "host"));
    lib(root, "anyfs/s3", "anyfs-s3", family("anyfs", "plugin"));
    lib(root, "core", "core");
    const found = readLibraries(root);
    assertEquals(
      found.map((f) => f.dir),
      ["anyfs", "anyfs/s3", "core"],
    );
    assertEquals(libraryDirs(found).get("anyfs-s3"), "anyfs/s3");
    assertEquals(libraryDir(root, "anyfs-s3"), "commons/anyfs/s3");
    assertEquals(libraryDir(root, "core"), "commons/core");
    assertEquals(libraryDir(root, "nobody"), "commons/nobody");
  });
});

proves([`${SPEC} FR-026`, "0033-kanon FR-035"], "the folder a manifest derives: under the host for an extension, by name for any other library", () => {
  const hosts = new Set(["anyfs", "archon"]);
  const of = (name: string, f?: Record<string, unknown>): string => {
    const r = decodeLibrarySource(manifest({ name, ...f }));
    assert(r.kind === "ok", r.kind === "err" ? r.error : "");
    return derivedDir(r.value, hosts);
  };
  assertEquals(of("anyfs-s3", family("anyfs", "plugin")), "anyfs/s3");
  assertEquals(of("archon-dialect-apt", family("archon", "dialect")), "archon/dialect-apt");
  assertEquals(of("anyfs", family("anyfs", "host")), "anyfs");
  assertEquals(of("core"), "core");
  assertEquals(of("catalog-soc2"), "catalog-soc2");
  assertEquals(of("estate-iac", family("estate", "plugin")), "estate-iac");
});

proves([`${SPEC} FR-026`], "a library out of the folder its manifest derives is a finding once its host is held to the layout", async () => {
  await withTempDir(async (root) => {
    lib(root, "anyfs", "anyfs", family("anyfs", "host"));
    lib(root, "anyfs-s3", "anyfs-s3", family("anyfs", "plugin"));
    assert(!manifestFindings(root).some((x) => x.includes("puts it in")), "no finding while the host is not held to the layout");
    const found = manifestFindings(root, new Set(["anyfs"])).filter((x) => x.includes("puts it in"));
    assertEquals(found.length, 1);
    assertStringIncludes(found[0] ?? "", "commons/anyfs/s3");
  });
});
