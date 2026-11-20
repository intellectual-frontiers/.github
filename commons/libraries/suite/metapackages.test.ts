/**
 * The metapackages and the distribution of commons (commons 0036-distribution; 0001-libraries FR-022, FR-023): the manifest fields `publishes` and `bundle`, the members of each set from the roles, the exact dependencies and the files the
 * generator writes, the packer of a package with no code, the order of a release, the package a manifest publishes in the record and the publication, and the real repository's own files (the manifests, the README, `AGENTS.md`, the guide).
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { existsSync, mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { decodeLibrarySource, type Library, readLibraries } from "../src/libraries.ts";
import { BUNDLE_OF_ROLE, dependenciesOf, HELD_BACK, isConsumerFacing, membersOf, readmeOf, readSetFile, SET_FILE, setFileText } from "../src/metapackages.ts";
import { main as packMain, metapackagesOf, packMetapackage, synchronize } from "../src/pack-metapackage.ts";
import { ROLE_OF } from "../src/readme.ts";
import { factsOf, offlineRegistry, planRelease, publishAll, recordText, type Tools } from "../src/releasing.ts";
import { BUNDLES } from "../src/libraries.ts";

const ROOT = resolve(fromFileUrl(new URL("../../..", import.meta.url)));
const SPEC = "0001-libraries";
const DIST = "0036-distribution";

const manifest = (name: string, extra: Record<string, unknown> = {}, version = "0.1.0"): string =>
  `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version, exports: ["."], distribution: ["github", "npm"], ...extra })};\n`;
const lib = (name: string, extra: Record<string, unknown> = {}, version = "0.1.0"): Library => {
  const r = decodeLibrarySource(manifest(name, extra, version));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves([`${SPEC} FR-022`, `${DIST} FR-009`], "publishes and bundle are read; a publishes that is no package, a bundle that is not the library's name and a manifest with both are refused", () => {
  assertEquals(lib("data", { publishes: "@intellectual-frontiers/arcactl" }).publishes, "@intellectual-frontiers/arcactl");
  assertEquals(lib("foundation", { bundle: "foundation" }).bundle, "foundation");
  assertEquals(decodeLibrarySource(manifest("data", { publishes: "arcactl" })).kind, "err");
  assertEquals(decodeLibrarySource(manifest("data", { publishes: "@other/arcactl" })).kind, "err");
  const wrong = decodeLibrarySource(manifest("programs", { bundle: "foundation" }));
  assert(wrong.kind === "err");
  assertStringIncludes(wrong.error, "library.bundle foundation");
  assertEquals(decodeLibrarySource(manifest("foundation", { bundle: "foundation", publishes: "@intellectual-frontiers/x" })).kind, "err");
  assertEquals(decodeLibrarySource(manifest("x", { bundle: "x" })).kind, "err");
});

proves([`${DIST} FR-004`], "a manifest of github alone is read (a private package), one of npm alone is refused, and the default is github", () => {
  assertEquals(lib("p", { distribution: ["github"] }).distribution, ["github"]);
  assertEquals(decodeLibrarySource(manifest("p", { distribution: ["npm"] })).kind, "err");
  const none = decodeLibrarySource(`export const library = { name: "p", verify: "bun run verify", version: "0.1.0", exports: [] };\n`);
  assert(none.kind === "ok");
  assertEquals(none.value.distribution, ["github"]);
});

proves([`${DIST} FR-006`, `${SPEC} FR-023`], "the set of a role is the role's in ROLE_OF, commons holds the four, a library held back is in none and a library with no role is a problem", () => {
  const libs = [lib("core", {}, "0.1.5"), lib("kanon", {}, "0.2.1"), lib("ergonex", {}, "0.4.7"), lib("mizan", {}, "0.1.2"), lib("toolchain"), lib("data", { publishes: "@intellectual-frontiers/arcactl" }, "0.9.0")];
  const names = (b: (typeof BUNDLES)[number]): readonly string[] => {
    const m = membersOf(b, libs);
    assert(m.kind === "ok");
    return m.value.map((x) => x.library);
  };
  assertEquals(names("foundation"), ["core"]);
  assertEquals(names("patterns"), ["kanon"]);
  assertEquals(names("programs"), ["data", "ergonex"], "ordered by package: arcactl, ergonex");
  assertEquals(names("standards"), ["mizan"]);
  assertEquals(names("commons"), ["data", "core", "ergonex", "kanon", "mizan"], "ordered by package name; toolchain is held back");
  assert(HELD_BACK.has("toolchain") && !isConsumerFacing(lib("toolchain")));
  assertEquals(isConsumerFacing(lib("p", { distribution: ["github"] })), false, "a private package is in no set");
  assertEquals(isConsumerFacing(lib("foundation", { bundle: "foundation" })), false);
  const none = membersOf("commons", [lib("brand-new")]);
  assert(none.kind === "err");
  assertStringIncludes(none.error, "has no role in ROLE_OF");
  // the roles are all the roles and the sets of them are all the sets but commons
  assertEquals([...new Set(ROLE_OF.values())].map((r) => BUNDLE_OF_ROLE[r]).sort(), ["foundation", "patterns", "programs", "standards"]);
});

proves([`${DIST} FR-007`], "the dependencies are the members at exact versions, the file records them, and a file that is not JSON or has no dependencies is refused", () => {
  const m = [{ library: "core", package: "@intellectual-frontiers/core", version: "0.1.5" }, { library: "data", package: "@intellectual-frontiers/arcactl", version: "0.9.0" }];
  assertEquals(dependenciesOf(m), { "@intellectual-frontiers/core": "0.1.5", "@intellectual-frontiers/arcactl": "0.9.0" });
  const text = setFileText("foundation", m);
  const back = readSetFile(text);
  assert(back.kind === "ok");
  assertEquals(back.value, dependenciesOf(m));
  assertEquals(readSetFile("{").kind, "err");
  assertEquals(readSetFile("{}").kind, "err");
  assertEquals(readSetFile('{"dependencies":{"a":1}}').kind, "err");
  const readme = readmeOf("foundation", m);
  for (const part of ["# @intellectual-frontiers/foundation", "overrides", "npm.pkg.github.com", "ERGONEX_GITHUB_TOKEN", "`0.1.5`"]) assertStringIncludes(readme, part);
});

proves([`${DIST} FR-005`, `${DIST} FR-006`, `${DIST} FR-007`, `${SPEC} FR-023`], "the real manifests: every library declares github and npm, the five metapackages are folders named for their set, and the generated files are what the manifests make", () => {
  const found = readLibraries(ROOT);
  const libraries = found.flatMap((f) => ("library" in f ? [f.library] : []));
  assertEquals(found.filter((f) => "problem" in f).length, 0);
  for (const l of libraries) if (l.held === undefined) assertEquals([...l.distribution], ["github", "npm"], `${l.name}: none of our libraries is private; one that is not published says why with held`);
  assertEquals(metapackagesOf(ROOT).map((m) => m.bundle).sort(), [...BUNDLES].sort());
  for (const m of metapackagesOf(ROOT)) {
    assertEquals(m.bundle, m.name);
    assertEquals(m.level, "L0");
    assertEquals(m.specKit, undefined);
  }
  assertEquals(synchronize(ROOT, false), { stale: [], problems: [] });
  // every set holds what the roles say, and every dependency is an exact version of a library at the version of its manifest
  for (const m of metapackagesOf(ROOT)) {
    const deps = readSetFile(readTextFileSync(join(ROOT, "commons", m.name, SET_FILE)));
    assert(deps.kind === "ok");
    for (const [pkg, version] of Object.entries(deps.value)) {
      assert(/^\d+\.\d+\.\d+$/.test(version), `${m.name}: ${pkg} is at ${version}, which is not an exact version`);
      const owner = libraries.find((l) => (l.publishes ?? `@intellectual-frontiers/${l.name}`) === pkg);
      assertEquals(owner?.version, version, `${m.name}: ${pkg}`);
    }
  }
  const all = readSetFile(readTextFileSync(join(ROOT, "commons", "commons", SET_FILE)));
  assert(all.kind === "ok");
  const four = ["foundation", "patterns", "programs", "standards"].flatMap((n) => {
    const d = readSetFile(readTextFileSync(join(ROOT, "commons", n, SET_FILE)));
    assert(d.kind === "ok");
    return Object.keys(d.value);
  });
  assertEquals(Object.keys(all.value).sort(), four.sort(), "commons is the four sets together");
  assert("@intellectual-frontiers/arcactl" in all.value && !("@intellectual-frontiers/data" in all.value), "data is installed as the package it publishes");
  for (const held of HELD_BACK.keys()) assert(!(`@intellectual-frontiers/${held}` in all.value), `${held} is held back`);
});

proves([`${DIST} FR-007`], "the generator writes the files, --check writes nothing, and a stale or hand-edited file is found", async () => {
  await withTempDir((dir) => {
    for (const [name, extra, version] of [["core", {}, "0.1.5"], ["foundation", { bundle: "foundation" }, "0.1.0"], ["commons", { bundle: "commons" }, "0.1.0"]] as const) {
      mkdirSync(join(dir, "commons", name), { recursive: true });
      writeTextFileSync(join(dir, "commons", name, "library.ts"), manifest(name, extra, version));
    }
    const first = synchronize(dir, false);
    assertEquals(first.stale, ["commons/commons/dependencies.auto.json", "commons/foundation/dependencies.auto.json"]);
    assertEquals(existsSync(join(dir, "commons", "foundation", SET_FILE)), false, "--check writes nothing");
    assertEquals(synchronize(dir, true).stale.length, 2);
    assertEquals(synchronize(dir, false), { stale: [], problems: [] });
    const written = readSetFile(readTextFileSync(join(dir, "commons", "foundation", SET_FILE)));
    assert(written.kind === "ok");
    assertEquals(written.value, { "@intellectual-frontiers/core": "0.1.5" });
    writeTextFileSync(join(dir, "commons", "foundation", SET_FILE), "{}\n");
    assertEquals(synchronize(dir, false).stale, ["commons/foundation/dependencies.auto.json"]);
    // a library with no role stops the generator
    mkdirSync(join(dir, "commons", "brand-new"), { recursive: true });
    writeTextFileSync(join(dir, "commons", "brand-new", "library.ts"), manifest("brand-new"));
    assertEquals(synchronize(dir, false).problems.length, 2);
    return Promise.resolve();
  });
});

proves([`${DIST} FR-008`], "the packer stages a package with no code, the exact dependencies, the README and the LICENSE, passes the inspection and packs it; it refuses a set with no member and a folder with no LICENSE", async () => {
  await withTempDir(async (dir) => {
    const root = join(dir, "foundation");
    mkdirSync(root, { recursive: true });
    writeTextFileSync(join(root, "library.ts"), manifest("foundation", { bundle: "foundation" }, "0.3.0"));
    writeTextFileSync(join(root, SET_FILE), setFileText("foundation", [{ library: "core", package: "@intellectual-frontiers/core", version: "0.1.5" }]));
    writeTextFileSync(join(root, "LICENSE"), "Required Notice: x\n\nPolyForm Noncommercial License 1.0.0\n");
    const packed = await packMetapackage(root);
    assertEquals(packed.findings, []);
    assert(packed.tarball?.endsWith("intellectual-frontiers-foundation-0.3.0.tgz") === true);
    const listed = await proc.run(["tar", "-tzf", packed.tarball ?? ""]);
    assertEquals(listed.stdout.trim().split(/\r?\n/).sort(), ["package/LICENSE", "package/README.md", "package/index.d.ts", "package/index.js", "package/package.json"]);
    const pkg = await proc.run(["tar", "-xzOf", packed.tarball ?? "", "package/package.json"]);
    const json: unknown = JSON.parse(pkg.stdout);
    assert(typeof json === "object" && json !== null && "dependencies" in json && "license" in json);
    assertEquals(json.dependencies, { "@intellectual-frontiers/core": "0.1.5" });
    assertEquals(json.license, "PolyForm-Noncommercial-1.0.0");
    assertEquals(await packMain(root, ["--check"]), 0);
    writeTextFileSync(join(root, SET_FILE), setFileText("foundation", []));
    const empty = await packMetapackage(root);
    assertStringIncludes(empty.findings.join("\n"), "no member");
    const bare = join(dir, "bare");
    mkdirSync(bare, { recursive: true });
    writeTextFileSync(join(bare, "library.ts"), manifest("patterns", { bundle: "patterns" }));
    writeTextFileSync(join(bare, SET_FILE), setFileText("patterns", [{ library: "kanon", package: "@intellectual-frontiers/kanon", version: "0.2.1" }]));
    assertStringIncludes((await packMetapackage(bare)).findings.join("\n"), "no LICENSE");
  });
});

/** Writes a library of a temporary repository: its manifest and package, one source that imports what it imports. */
function put(dir: string, name: string, extra: Record<string, unknown>, imports: readonly string[] = []): void {
  mkdirSync(join(dir, "commons", name, "src"), { recursive: true });
  writeTextFileSync(join(dir, "commons", name, "library.ts"), manifest(name, extra));
  writeTextFileSync(
    join(dir, "commons", name, "package.json"),
    `${JSON.stringify({ name: `@intellectual-frontiers/${name}`, version: "0.1.0", exports: { ".": "./src/mod.ts" }, devDependencies: Object.fromEntries(imports.map((i) => [`@x/${i}`, `link:../${i}`])) }, null, 2)}\n`,
  );
  writeTextFileSync(join(dir, "commons", name, "src", "mod.ts"), `${imports.map((i) => `import "@x/${i}";`).join("\n")}\nexport const ${name.replace(/-/g, "_")} = 1;\n`);
}

proves([`${DIST} FR-008`, `${DIST} FR-015`, `${DIST} FR-009`], "on a real repository: a metapackage is raised after the member that is raised, with its package and tag, and the publication uses the package a manifest publishes", async () => {
  const git = proc.which("git");
  if (git === undefined) return;
  await withTempDir(async (dir) => {
    const g = async (...a: string[]): Promise<string> => {
      const r = await proc.run([git, "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a]);
      assertEquals(r.code, 0, `${a.join(" ")}: ${r.stderr}`);
      return r.stdout;
    };
    await g("init", "-q", "-b", "main");
    put(dir, "core", {});
    put(dir, "data", { publishes: "@intellectual-frontiers/arcactl" });
    put(dir, "foundation", { bundle: "foundation" });
    put(dir, "programs", { bundle: "programs" });
    put(dir, "archon", { held: "not published yet", distribution: [] });
    await g("add", ".");
    await g("commit", "-q", "-m", "Start");
    for (const t of ["core-v0.1.0", "data-v0.1.0", "foundation-v0.1.0", "programs-v0.1.0"]) await g("tag", t);
    writeTextFileSync(join(dir, "commons/core/src/extra.ts"), "export const x = 1;\n");
    await g("add", ".");
    await g("commit", "-q", "-m", "Add x");
    const found = await factsOf(dir, offlineRegistry);
    assert(found.kind === "ok", found.kind === "err" ? found.error : "");
    const by = new Map(found.value.map((f) => [f.slug as string, f]));
    assertEquals(by.has("archon"), false, "a held library is not in the facts of the release");
    assertEquals(by.get("foundation")?.imports.map(String), ["core"]);
    assertEquals(by.get("programs")?.imports.map(String), ["data"]);
    assertEquals(by.get("data")?.package, "@intellectual-frontiers/arcactl");
    assertEquals(by.get("foundation")?.package, "@intellectual-frontiers/foundation");
    const plan = planRelease(found.value);
    assert(plan.kind === "ok");
    assertEquals(plan.value.steps.map((s) => `${s.slug} ${s.from}>${s.to} ${s.decision.kind}`), ["core 0.1.0>0.1.1 raised", "foundation 0.1.0>0.1.1 dependent"], "programs is left alone: none of its members is raised");
    const record = recordText(plan.value);
    assertStringIncludes(record, '"package": "@intellectual-frontiers/foundation"');
    // the publication of an entry of a library that publishes another package asks npm and the GitHub registry for that package, and tags by the library
    const asked: string[] = [];
    const tools: Tools = {
      onNpm: (name) => {
        asked.push(`npm ${name}`);
        return Promise.resolve(false);
      },
      npm: (e) => {
        asked.push(`send ${e.package}`);
        return Promise.resolve(ok(undefined));
      },
      github: (e) => {
        asked.push(`github ${e.package}`);
        return Promise.resolve(e.package === "" ? err("no package") : ok(undefined));
      },
      tag: (t) => {
        asked.push(`tag ${t}`);
        return Promise.resolve(ok("made"));
      },
    };
    const out = await publishAll([{ slug: "data", package: "@intellectual-frontiers/arcactl", version: "0.9.0", folder: "commons/data", tag: "data-v0.9.0", publish: true }], tools);
    assertEquals(asked, ["npm @intellectual-frontiers/arcactl", "send @intellectual-frontiers/arcactl", "github @intellectual-frontiers/arcactl", "tag data-v0.9.0"]);
    assertEquals(out[0]?.tagged, "made");
  });
});

proves([`${DIST} FR-001`, `${DIST} FR-003`, `${DIST} FR-018`], "the root is private, AGENTS.md and the README state the rule, the README lists the metapackages apart, and the guide has one entry in docs.config.ts", () => {
  const root = JSON.parse(readTextFileSync(join(ROOT, "package.json"))) as Record<string, unknown>;
  assertEquals(root["private"], true);
  const agents = readTextFileSync(join(ROOT, "AGENTS.md"));
  assertStringIncludes(agents, "0036-distribution");
  assertStringIncludes(agents, "published package");
  assert(!/bun add github:intellectual-frontiers/.test(agents), "AGENTS.md names no Git dependency on this repository");
  const readme = readTextFileSync(join(ROOT, "README.md"));
  for (const part of ["How other repositories use commons", "@intellectual-frontiers/commons", "repoctl hygiene", "npm.pkg.github.com", "Metapackage"]) assertStringIncludes(readme, part);
  assert(existsSync(join(ROOT, "commons", "docs", "guides", "consuming-commons.md")));
  const config = readTextFileSync(join(ROOT, "commons", "docs.config.ts"));
  assertEquals(config.split("guides/consuming-commons.md").length - 1, 1, "one entry");
});
