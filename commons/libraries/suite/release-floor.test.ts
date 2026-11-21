/**
 * The floor of the exports (commons 0001-libraries FR-027): the keys of `exports` of the version npm holds against the library's now raise the version by at least a breaking level where a key was removed or renamed and by at least a feature level where one
 * was added, the greater of that and the `Impact:` of the commits wins, and the plan says the reason. On facts, and on a real repository of tags and commits whose npm is a registry simulator, a real HTTP server on the loopback that answers as npm does for the
 * manifest of a version (what needs an npm account is left untested; reading a version is public).
 *
 * @module
 */
import { createServer, type Server } from "node:http";
import { proc } from "@intellectual-frontiers/system";
import { mkdirSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { slugOf } from "@intellectual-frontiers/mizan/versions/record";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { appliedImpact, exportsChangeOf, type Facts, factsOf, floorOf, offlineRegistry, planLines, planRelease, realPublishedExports, releasePlan } from "../src/releasing.ts";

const SPEC = "0001-libraries";

const slug = (n: string) => {
  const s = slugOf(n);
  if (s === undefined) throw new Error(`${n} is no slug`);
  return s;
};
const changed = (version: string, impact: Facts["impact"], keys?: { removed?: readonly string[]; added?: readonly string[] }): Facts => ({
  slug: slug("a"),
  folder: "commons/a",
  package: "@intellectual-frontiers/a",
  version,
  imports: [],
  last: { version, tag: `a-v${version}` },
  changed: true,
  impact,
  publish: true,
  registry: "absent",
  sinceVersion: { changed: false, impact: "patch" },
  exportsChange: keys === undefined ? undefined : { removed: keys.removed ?? [], added: keys.added ?? [] },
});
const outcome = (f: Facts): string => {
  const p = planRelease([f]);
  return p.kind === "ok" ? p.value.steps.map((s) => `${s.from}>${s.to}`).join() : `error: ${p.error}`;
};

proves(
  [`${SPEC} FR-027`],
  "a removed or renamed key raises at least the breaking level, an added key at least the feature level, the greater of the floor and the commits' Impact wins, a major version of 0 raises the minor for a breaking change, and the plan says the reason",
  () => {
    assertEquals(exportsChangeOf([".", "./a", "./b"], [".", "./a", "./c"]), { removed: ["./b"], added: ["./c"] });
    assertEquals(floorOf(undefined), undefined);
    assertEquals(floorOf({ removed: [], added: [] }), undefined);
    assertEquals(floorOf({ removed: ["./b"], added: ["./c"] })?.impact, "major", "a rename is a removal and an addition: breaking");
    assertEquals(floorOf({ removed: [], added: ["./c"] })?.impact, "minor");
    // while the major version is 0 (SemVer 2.0.0 item 4): breaking raises the minor; a feature raises the minor, never the patch
    assertEquals(outcome(changed("0.3.1", "patch", { removed: ["./b"] })), "0.3.1>0.4.0");
    assertEquals(outcome(changed("0.3.1", "patch", { added: ["./c"] })), "0.3.1>0.4.0");
    assertEquals(outcome(changed("0.3.1", "patch", { added: [], removed: [] })), "0.3.1>0.3.2");
    assertEquals(outcome(changed("0.3.1", "patch")), "0.3.1>0.3.2", "no key compared (offline): the commits alone");
    // from 1.0.0 the levels are as stated
    assertEquals(outcome(changed("1.2.3", "patch", { removed: ["./b"] })), "1.2.3>2.0.0");
    assertEquals(outcome(changed("1.2.3", "patch", { added: ["./c"] })), "1.2.3>1.3.0");
    // the greater of the floor and the commits wins, in both directions
    assertEquals(outcome(changed("1.2.3", "major", { added: ["./c"] })), "1.2.3>2.0.0", "the commits are greater than the floor");
    assertEquals(outcome(changed("1.2.3", "minor", { removed: ["./b"] })), "1.2.3>2.0.0", "the floor is greater than the commits");
    assertEquals(outcome(changed("1.2.3", "minor", { added: ["./c"] })), "1.2.3>1.3.0");
    assertEquals(appliedImpact("0.9.0", "major"), "minor");
    assertEquals(appliedImpact("0.9.0", "patch"), "patch");
    assertEquals(appliedImpact("1.0.0", "major"), "major");
    // the plan states the reason
    const p = planRelease([changed("0.3.1", "patch", { removed: ["./b"], added: ["./c"] })]);
    assert(p.kind === "ok");
    const line = planLines({ tty: false, colour: false, emoji: false, columns: 80 }, p.value)[0] ?? "";
    assertStringIncludes(line, "a 0.3.1 -> 0.4.0");
    assertStringIncludes(line, "the floor of the exports: exports removed or renamed (./b): breaking");
    assertStringIncludes(line, "a minor while the major version is 0");
    return Promise.resolve();
  },
);

/** A registry that answers as npm does for `GET /<package>/<version>`: the manifest of a version, or 404. */
async function withRegistry(published: Readonly<Record<string, unknown>>, use: (base: string) => Promise<void>): Promise<void> {
  const server: Server = createServer((req, res) => {
    const manifest = published[decodeURIComponent(req.url ?? "")];
    res.statusCode = manifest === undefined ? 404 : 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(manifest ?? { error: "Not found" }));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  try {
    await use(`http://127.0.0.1:${typeof address === "object" && address !== null ? address.port : 0}`);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
}

proves(
  [`${SPEC} FR-027`],
  "the keys of exports of the version npm holds are read from its manifest, and a version it does not hold or a registry that does not answer is no keys, never a guess",
  async () => {
    await withRegistry({ "/@intellectual-frontiers/a/0.1.0": { name: "@intellectual-frontiers/a", exports: { ".": {}, "./x": {} } } }, async (base) => {
      const read = realPublishedExports(base);
      assertEquals(await read("@intellectual-frontiers/a", "0.1.0"), [".", "./x"]);
      assertEquals(await read("@intellectual-frontiers/a", "0.2.0"), undefined);
    });
    assertEquals(await realPublishedExports("http://127.0.0.1:9")("@intellectual-frontiers/a", "0.1.0"), undefined);
  },
);

const library = (root: string, name: string, exportKeys: readonly string[]): void => {
  const put = (file: string, text: string): void => {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeTextFileSync(join(root, file), text);
  };
  put(`commons/${name}/library.ts`, `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version: "0.1.0", exports: [...exportKeys], distribution: ["github", "npm"] })};\n`);
  put(`commons/${name}/package.json`, `${JSON.stringify({ name: `@intellectual-frontiers/${name}`, version: "0.1.0", exports: Object.fromEntries(exportKeys.map((k) => [k, `./src/${k === "." ? "mod" : k.slice(2)}.ts`])) }, null, 2)}\n`);
  for (const k of exportKeys) put(`commons/${name}/src/${k === "." ? "mod" : k.slice(2)}.ts`, `export const ${name}${k === "." ? "" : k.slice(2)} = 1;\n`);
  put(`commons/${name}/release.ts`, `export const release = ${JSON.stringify({ slug: name, kind: "Library", title: name, authors: [{ name: "x" }], version: "0.1.0", repository: "https://example.org/r" })};\n`);
};

proves(
  [`${SPEC} FR-027`],
  "on a real repository whose npm is a registry simulator: a library that dropped a key since the version npm holds is raised by the breaking level with the reason, one that gained a key by the feature level, one that changed no key by its commits, and a version npm does not hold has no floor",
  async () => {
    const git = proc.which("git");
    if (git === undefined) return;
    await withTempDir(async (dir) => {
      const g = async (...a: string[]): Promise<void> => {
        const r = await proc.run([git, "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a]);
        assertEquals(r.code, 0, `${a.join(" ")}: ${r.stderr}`);
      };
      await g("init", "-q", "-b", "main");
      for (const [name, keys] of [["lost", [".", "./old"]], ["gained", ["."]], ["same", ["."]], ["unpublished", ["."]]] as const) library(dir, name, keys);
      await g("add", ".");
      await g("commit", "-q", "-m", "Start");
      for (const n of ["lost", "gained", "same", "unpublished"]) await g("tag", `${n}-v0.1.0`);
      // each library changes after its tag: lost drops ./old and gains ./fresh (a rename), gained adds ./more, the rest change a source only
      const root = (f: string, t: string): void => writeTextFileSync(join(dir, f), t);
      library(dir, "lost", [".", "./fresh"]);
      library(dir, "gained", [".", "./more"]);
      for (const n of ["lost", "gained", "same", "unpublished"]) root(`commons/${n}/src/extra.ts`, "export const extra = 1;\n");
      await g("add", ".");
      await g("commit", "-q", "-m", "Change them all\n\nImpact: patch");
      const published = {
        "/@intellectual-frontiers/lost/0.1.0": { exports: { ".": "x", "./old": "x" } },
        "/@intellectual-frontiers/gained/0.1.0": { exports: { ".": "x" } },
        "/@intellectual-frontiers/same/0.1.0": { exports: { ".": "x" } },
      };
      await withRegistry(published, async (base) => {
        const facts = await factsOf(dir, offlineRegistry, realPublishedExports(base));
        assert(facts.kind === "ok", facts.kind === "err" ? facts.error : "");
        const by = new Map(facts.value.map((f) => [f.slug as string, f]));
        assertEquals(by.get("lost")?.exportsChange, { removed: ["./old"], added: ["./fresh"] });
        assertEquals(by.get("gained")?.exportsChange, { removed: [], added: ["./more"] });
        assertEquals(by.get("same")?.exportsChange, { removed: [], added: [] });
        assertEquals(by.get("unpublished")?.exportsChange, undefined, "npm holds no such version: nothing to compare");
        const plan = await releasePlan(dir, { registry: offlineRegistry, published: realPublishedExports(base) });
        assert(plan.kind === "ok", plan.kind === "err" ? plan.error : "");
        const to = new Map(plan.value.steps.map((s) => [s.slug as string, `${s.from}>${s.to}`]));
        // while the major version is 0 the breaking level raises the minor, and a feature raises the minor too; a source changed alone is a patch
        assertEquals(to.get("lost"), "0.1.0>0.2.0");
        assertEquals(to.get("gained"), "0.1.0>0.2.0");
        assertEquals(to.get("same"), "0.1.0>0.1.1");
        assertEquals(to.get("unpublished"), "0.1.0>0.1.1");
        const lines = planLines({ tty: false, colour: false, emoji: false, columns: 100 }, plan.value).join("\n");
        assertStringIncludes(lines, "exports removed or renamed (./old): breaking");
        assertStringIncludes(lines, "exports added (./more): a feature");
      });
    });
  },
  { timeout: 120_000 },
);
