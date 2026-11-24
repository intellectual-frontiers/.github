/**
 * The folder of a library (commons 0027-commons-libraries FR-026, 0033-kanon FR-035): an extension of a host is inside the folder of its host, the one resolver finds a library where its manifest is, and
 * a library out of the folder its manifest derives is a finding of the check of the manifests.
 *
 * @module
 */
import { mkdirSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { derivedDir, idsIn, LIBRARY_FILE, libraryDir, libraryDirs, manifestFindings, readLibraries } from "../src/libraries.ts";
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
    assert(!manifestFindings(root, new Set()).some((x) => x.includes("puts it in")), "no finding while the host is not held to the layout");
    const found = manifestFindings(root, new Set(["anyfs"])).filter((x) => x.includes("puts it in"));
    assertEquals(found.length, 1);
    assertStringIncludes(found[0] ?? "", "commons/anyfs/s3");
  });
});

proves([`${SPEC} FR-026`, `${SPEC} FR-011`], "the number a library keeps is read from its line whether its folder is `commons/<name>` or `commons/<host>/<extension>`", () => {
  const spec = [
    "## The libraries",
    "",
    "<!-- libraries:begin -->",
    "",
    "- **FR-140**: `commons/archon/dialect-apt` MUST be a library",
    "- **FR-141**: `commons/core` MUST be a library",
    "",
    "<!-- libraries:end -->",
    "",
  ].join("\n");
  const ids = idsIn(spec);
  assertEquals(ids.get("archon-dialect-apt"), "FR-140");
  assertEquals(ids.get("core"), "FR-141");
  assertEquals(ids.has("archon"), false);
});
