/**
 * The release (commons 0001-libraries FR-013, FR-014): each rule of the plan on facts, the record and the matrix the workflow reads, and a real repository of real tags and commits in a temporary folder, planned and made by
 * `apply` with the generators and the tests that pack replaced by a host of the test's own (what they run is the repository's: its generators have their own tests, and `tests/release/` is run by a release).
 *
 * @module
 */
import {
  applyRelease,
  type Facts,
  factsOf,
  GENERATORS,
  type Host,
  main,
  matrixOutputs,
  planLines,
  planRelease,
  readRecord,
  RECORD_PATH,
  recordText,
} from "../src/releasing.ts";
import { err, ok } from "@intellectual-frontiers/core";
import { mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { proc } from "@intellectual-frontiers/system";
import { slugOf } from "@intellectual-frontiers/mizan/versions/record";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const SPEC = "0001-libraries";
const PLAIN = { tty: false, colour: false, emoji: false, columns: 80 } as const;

const slug = (n: string) => {
  const s = slugOf(n);
  if (s === undefined) throw new Error(`${n} is no slug`);
  return s;
};
const facts = (name: string, over: Partial<Facts> = {}): Facts => ({
  slug: slug(name),
  folder: `commons/${name}`,
  version: "0.1.0",
  imports: [],
  last: { version: "0.1.0", tag: `${name}-v0.1.0` },
  changed: false,
  impact: "patch",
  publish: true,
  ...over,
});
const steps = (fs: readonly Facts[]): readonly string[] => {
  const p = planRelease(fs);
  return p.kind === "ok" ? p.value.steps.map((s) => `${s.slug} ${s.from}>${s.to}`) : [`error: ${p.error}`];
};

proves(
  [`${SPEC} FR-013`],
  "a library changed since its tag is raised by its impact, one that imports it by a patch and so up the imports, a version with no tag or ahead of its tag is released as it is, one tagged and unchanged is left alone, and the order is the imports'",
  () => {
    // raised by the impact, importers by a patch, and the importers' importers
    assertEquals(
      steps([
        facts("c", { imports: [slug("b")] }),
        facts("b", { imports: [slug("a")] }),
        facts("a", { changed: true, impact: "minor" }),
        facts("lone"),
      ]),
      ["a 0.1.0>0.2.0", "b 0.1.0>0.1.1", "c 0.1.0>0.1.1"],
    );
    assertEquals(steps([facts("a", { changed: true, impact: "major" })]), ["a 0.1.0>1.0.0"]);
    // not tagged yet: as it is, and no importer is raised for it
    assertEquals(steps([facts("a", { last: undefined, version: "0.3.1" }), facts("b", { imports: [slug("a")] })]), ["a 0.3.1>0.3.1"]);
    // ahead of its last tag: as it is, whether or not its files changed since
    assertEquals(steps([facts("a", { version: "0.4.5", last: { version: "0.3.10", tag: "a-v0.3.10" }, changed: true })]), ["a 0.4.5>0.4.5"]);
    // the order: a library comes after the libraries it imports, whatever the order given
    assertEquals(
      steps([
        facts("z", { last: undefined, imports: [slug("m")] }),
        facts("m", { last: undefined, imports: [slug("a")] }),
        facts("a", { last: undefined }),
      ]),
      ["a 0.1.0>0.1.0", "m 0.1.0>0.1.0", "z 0.1.0>0.1.0"],
    );
    // nothing to release
    assertEquals(steps([facts("a"), facts("b", { imports: [slug("a")] })]), []);
    // errors: a version that went back, a version that is no version, a cycle
    assertStringIncludes(steps([facts("a", { version: "0.0.9" })])[0] ?? "", "never goes back");
    assertStringIncludes(steps([facts("a", { version: "x" })])[0] ?? "", "not a Semantic Version");
    assertStringIncludes(
      steps([facts("a", { last: undefined, imports: [slug("b")] }), facts("b", { last: undefined, imports: [slug("a")] })])[0] ?? "",
      "cycle",
    );
    // the lines say it
    const p = planRelease([facts("a", { changed: true }), facts("b", { imports: [slug("a")] }), facts("c"), facts("d", { last: undefined })]);
    assert(p.kind === "ok");
    const lines = planLines(PLAIN, p.value);
    assertEquals(lines.length, 4);
    assertStringIncludes(lines[0] ?? "", "a 0.1.0 -> 0.1.1");
    assertStringIncludes(lines[1] ?? "", "b 0.1.0 -> 0.1.1");
    assertStringIncludes(lines[1] ?? "", "it imports a");
    assertStringIncludes(lines[2] ?? "", "d 0.1.0  released as it is");
    assertEquals(lines[3], "left alone (1): c");
    assertStringIncludes(planLines(PLAIN, { steps: [], unchanged: [] })[0] ?? "", "nothing to release");
    return Promise.resolve();
  },
);

proves(
  [`${SPEC} FR-014`],
  "the record is the plan in order with no day and no person, it reads back, the matrix leaves out what is tagged and says whether anything is left, and a record that is not one is refused",
  () => {
    const p = planRelease([facts("b", { imports: [slug("a")] }), facts("a", { changed: true }), facts("t", { publish: false, last: undefined })]);
    assert(p.kind === "ok");
    const text = recordText(p.value);
    assertEquals(text, recordText(p.value), "the same bytes for the same plan");
    const read = readRecord(text);
    assert(read.kind === "ok");
    assertEquals(
      read.value.map((e) => `${e.slug}@${e.version} ${e.tag} ${e.publish}`),
      ["a@0.1.1 a-v0.1.1 true", "b@0.1.1 b-v0.1.1 true", "t@0.1.0 t-v0.1.0 false"],
    );
    const all = matrixOutputs(read.value, new Set()).split("\n");
    assertEquals(all[0], "has-build=true");
    assertStringIncludes(all[1] ?? "", '"slug":"a"');
    assert(!(all[1] ?? "").includes('"slug":"t"'), "a library that is only tagged is not built");
    assertStringIncludes(all[2] ?? "", '"slug":"t"');
    const rest = matrixOutputs(read.value, new Set(["a-v0.1.1", "b-v0.1.1", "t-v0.1.0"])).split("\n");
    assertEquals(rest[0], "has-build=false");
    assertEquals(rest[2], "sequence=[]");
    assertEquals(readRecord("nope").kind, "err");
    assertEquals(readRecord('{"releases":[{"slug":1}]}').kind, "err");
    assertEquals(readRecord("{}").kind, "err");
    return Promise.resolve();
  },
);

const library = (root: string, name: string, version: string, imports: readonly string[] = [], record = true): void => {
  const put = (file: string, text: string): void => {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeTextFileSync(join(root, file), text);
  };
  put(
    `commons/${name}/library.ts`,
    `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version, exports: ["."], distribution: ["github", "npm"] })};\n`,
  );
  put(
    `commons/${name}/package.json`,
    `${JSON.stringify({ name: `@x/${name}`, version, exports: { ".": "./src/mod.ts" }, devDependencies: Object.fromEntries(imports.map((i) => [`@x/${i}`, `link:../${i}`])) }, null, 2)}\n`,
  );
  put(`commons/${name}/src/mod.ts`, `${imports.map((i) => `import "@x/${i}";`).join("\n")}\nexport const ${name} = 1;\n`);
  if (record)
    put(
      `commons/${name}/release.ts`,
      `export const release = ${JSON.stringify({ slug: name, kind: "Library", title: name, authors: [{ name: "x" }], version, repository: "https://example.org/r" })};\n`,
    );
};

proves(
  [`${SPEC} FR-013`, `${SPEC} FR-014`],
  "on a real repository of tags and commits: the plan reads the tags, the files since each and the Impact: lines, apply writes the versions into the record, the manifest and the package of each library it raises, makes the generated files once, writes the record and tags nothing",
  async () => {
    const git = proc.which("git");
    if (git === undefined) return;
    await withTempDir(async (dir) => {
      const g = async (...a: string[]) => {
        const r = await proc.run([git, "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a]);
        assertEquals(r.code, 0, `${a.join(" ")}: ${r.stderr}`);
        return r.stdout;
      };
      await g("init", "-q", "-b", "main");
      library(dir, "a", "0.1.0");
      library(dir, "b", "0.1.0", ["a"]);
      library(dir, "c", "0.2.0");
      library(dir, "d", "0.5.0", [], false);
      await g("add", ".");
      await g("commit", "-q", "-m", "Start");
      for (const t of ["a-v0.1.0", "b-v0.1.0", "c-v0.1.0"]) await g("tag", t);
      // a changes with a stated impact; c's files change too, and its version is ahead of its tag already; d has no tag and no record
      writeTextFileSync(join(dir, "commons/a/src/extra.ts"), "export const x = 1;\n");
      await g("add", ".");
      await g("commit", "-q", "-m", "Add x\n\nImpact: minor");
      writeTextFileSync(join(dir, "commons/c/src/extra.ts"), "export const y = 1;\n");
      await g("add", ".");
      await g("commit", "-q", "-m", "Add y");
      const found = await factsOf(dir);
      assert(found.kind === "ok", found.kind === "err" ? found.error : "");
      const by = new Map(found.value.map((f) => [f.slug as string, f]));
      assertEquals(by.get("a")?.changed, true);
      assertEquals(by.get("a")?.impact, "minor");
      assertEquals(by.get("b")?.changed, false);
      assertEquals(by.get("b")?.imports.map(String), ["a"]);
      assertEquals(by.get("d")?.last, undefined, "no tag");
      assertEquals(by.get("c")?.last?.version, "0.1.0");
      const plan = planRelease(found.value);
      assert(plan.kind === "ok");
      assertEquals(
        plan.value.steps.map((s) => `${s.slug} ${s.from}>${s.to} ${s.decision.kind}`),
        ["a 0.1.0>0.2.0 raised", "b 0.1.0>0.1.1 dependent", "c 0.2.0>0.2.0 as-is", "d 0.5.0>0.5.0 as-is"],
      );
      // apply, with the generators and the proof of the test's own
      const ran: string[] = [];
      const host: Host = {
        generate: (_repo, command) => {
          ran.push(command.join(" "));
          return Promise.resolve(ok(undefined));
        },
        prove: () => {
          ran.push("prove");
          return Promise.resolve(ok(undefined));
        },
      };
      const done = await applyRelease(dir, host, { tests: true });
      assert(done.kind === "ok", done.kind === "err" ? done.error : "");
      assertEquals(ran, [...GENERATORS.map((c) => c.join(" ")), "prove"], "the generated files are made once and the proof is run once");
      assertStringIncludes(readTextFileSync(join(dir, "commons/a/release.ts")), "0.2.0");
      assertStringIncludes(readTextFileSync(join(dir, "commons/a/library.ts")), '"version":"0.2.0"');
      assertStringIncludes(readTextFileSync(join(dir, "commons/a/package.json")), '"version": "0.2.0"');
      assertStringIncludes(readTextFileSync(join(dir, "commons/b/package.json")), '"version": "0.1.1"');
      assertStringIncludes(readTextFileSync(join(dir, "commons/c/package.json")), '"version": "0.2.0"', "released as it is: not written");
      assertStringIncludes(readTextFileSync(join(dir, "commons/d/library.ts")), '"version":"0.5.0"');
      const record = readRecord(readTextFileSync(join(dir, RECORD_PATH)));
      assert(record.kind === "ok");
      assertEquals(
        record.value.map((e) => e.tag),
        ["a-v0.2.0", "b-v0.1.1", "c-v0.2.0", "d-v0.5.0"],
      );
      assertEquals((await g("tag", "-l")).trim().split("\n").sort(), ["a-v0.1.0", "b-v0.1.0", "c-v0.1.0"], "apply tags nothing");
      // the proof is left out where it is asked, and a failing generator stops the release before the record
      ran.length = 0;
      assertEquals((await applyRelease(dir, host, { tests: false })).kind, "ok");
      assert(!ran.includes("prove"));
      const bad: Host = { ...host, generate: () => Promise.resolve(err("the generator failed")) };
      writeTextFileSync(join(dir, RECORD_PATH), "{}\n");
      assertEquals((await applyRelease(dir, bad, { tests: true })).kind, "err");
      assertEquals(readTextFileSync(join(dir, RECORD_PATH)), "{}\n", "no record from a release that stopped");
      // the command reads the same: plan says it, matrix leaves out what is tagged
      assertEquals(await main(["plan", "--repo", dir]), 0);
      await g("add", ".");
      await g("commit", "-q", "-m", "Release");
      await g("tag", "a-v0.2.0");
      const out = join(dir, "output");
      writeTextFileSync(join(dir, RECORD_PATH), recordText({ steps: plan.value.steps, unchanged: plan.value.unchanged }));
      assertEquals(await main(["matrix", "--repo", dir, "--github-output", out]), 0);
      const text = readTextFileSync(out);
      assertStringIncludes(text, "has-build=true");
      assert(!text.includes('"tag":"a-v0.2.0"'), "a tagged library is left out");
      assertStringIncludes(text, '"tag":"b-v0.1.1"');
      assertEquals(await main(["nonsense", "--repo", dir]), 2);
      assertEquals(await main(["--nonsense"]), 2);
    });
  },
);

proves(
  [`${SPEC} FR-013`],
  "a version that is below its last tag, in a real repository, stops the plan with the exit status 1 and says so",
  async () => {
    const git = proc.which("git");
    if (git === undefined) return;
    await withTempDir(async (dir) => {
      const g = (...a: string[]) => proc.run([git, "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a]);
      await g("init", "-q", "-b", "main");
      library(dir, "a", "0.1.0");
      await g("add", ".");
      await g("commit", "-q", "-m", "Start");
      await g("tag", "a-v0.3.0");
      assertEquals(await main(["plan", "--repo", dir]), 1);
    });
  },
);
