/**
 * What a consumer harness asks of Mizan (commons 0003-mizan FR-043, FR-044, 0015-trace FR-012, 0020-ifccm FR-035 to FR-038, 0026-works-versioning FR-039, FR-040), on real programs: real `git`
 * repositories in temporary folders with real commits, the real command `changes.ts` run in this process, real files for the proof register, the terms and the change requests. Nothing is faked:
 * the offline trace is asked of no Git host, and the one module a test loads by its `file:` URL is a real file in a temporary folder.
 *
 * @module
 */
import { capabilityTrace, parseIssues, traceJson, traceTable } from "@intellectual-frontiers/mizan/changes/capability-trace";
import { proofsOf, specLines, traceFindings, parseSpec } from "@intellectual-frontiers/mizan/trace";
import { run as changes } from "@intellectual-frontiers/libraries/changes";
import { holdHarness } from "@intellectual-frontiers/mizan/harness";
import * as mizan from "@intellectual-frontiers/libraries";
import * as mizanLibrary from "@intellectual-frontiers/mizan";
import { readRegisterInput, registerDocuments } from "@intellectual-frontiers/libraries/oscal-register";
import { definitionsOf, termDefinedByFindings } from "@intellectual-frontiers/mizan/spec-terms";
import { checkVersions } from "@intellectual-frontiers/libraries/versions";
import { decodeReleaseSource, releaseSource } from "@intellectual-frontiers/mizan/versions/record";
import { recordFindings } from "@intellectual-frontiers/mizan/versions/judge";
import { existsSync, mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, join } from "@intellectual-frontiers/system/path";
import { run as spawn } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { needsGit } from "./git-fixtures.ts";

// ------------------------------------------------------------------------------------------------------------------------------- fixtures

async function git(repo: string, args: readonly string[]): Promise<string> {
  const r = await spawn(["git", "-C", repo, ...args], { env: { GIT_TERMINAL_PROMPT: "0" } });
  assert(r.success, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

async function newRepo(dir: string): Promise<string> {
  await git(dir, ["init", "-q", "-b", "main"]);
  for (const [k, v] of [
    ["user.name", "ci"],
    ["user.email", "ci@example.com"],
    ["commit.gpgsign", "false"],
    ["core.autocrlf", "false"],
  ] as const)
    await git(dir, ["config", k, v]);
  return dir;
}

async function commit(repo: string, message: string, files: Readonly<Record<string, string>>): Promise<string> {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, name)), { recursive: true });
    writeTextFileSync(join(repo, name), text);
  }
  await git(repo, ["add", "-A"]);
  await git(repo, ["commit", "-q", "--allow-empty", "-m", message]);
  return git(repo, ["rev-parse", "HEAD"]);
}

type Out = { readonly code: number; readonly out: string; readonly err: string };

async function cmd(repo: string, ...args: readonly string[]): Promise<Out> {
  let out = "";
  let err = "";
  const code = await changes(["--repo", repo, ...args], { out: (t) => void (out += t), err: (t) => void (err += t) }, () => "2026-11-18");
  return { code, out, err };
}

const SPEC = `# Feature Specification: Demo

**Spec ID:** 001-demo
**Status:** Active

- **FR-001**: The demo MUST name a term.
- **FR-002**: The demo MUST be proved.
`;

// ------------------------------------------------------------------------------------------------------------------------------- 0015-trace FR-012

proves(
  ["0015-trace FR-012"],
  "a Spec: line and a Proves: line are read inside a block comment as well as after two slashes, and a line of code that holds the words is not read",
  () => {
    const source = [
      "/**",
      " * The module.",
      " * Spec: 001-demo FR-001, FR-002",
      " */",
      "// Spec: 002-other",
      "/* Spec: 003-third FR-009 */",
      "/** Spec: 004-fourth FR-001 */",
      'const text = "Spec: 005-nothing FR-001";',
      "const after = 1; // Spec: 006-not-a-line FR-001",
      "",
    ].join("\n");
    const cited = specLines(source).map((c) => [c.spec, c.line, c.requirements.length]);
    assertEquals(cited, [
      ["001-demo", 3, 2],
      ["002-other", 5, 0],
      ["003-third", 6, 1],
      ["004-fourth", 7, 1],
    ]);
    const test = ["/**", " * Proves: 001-demo FR-001 to FR-002", " */", "// Proves: 001-demo FR-002", ""].join("\n");
    assertEquals(
      proofsOf(test).map((p) => [
        p.spec,
        p.line,
        p.requirement.kind === "one" ? p.requirement.id : `${p.requirement.from}-${p.requirement.to}`,
      ]),
      [
        ["001-demo", 2, "FR-001-FR-002"],
        ["001-demo", 4, "FR-002"],
      ],
    );
    // the check reads them: a source whose only citation is in a block comment is traced, and a test whose proof is in one proves
    const found = traceFindings({
      specs: [parseSpec("001-demo", SPEC)],
      sources: [{ path: "src/a.ts", text: "/**\n * Spec: 001-demo FR-001\n */\n" }],
      tests: [{ path: "tests/a.test.ts", text: "/**\n * Proves: 001-demo FR-001, FR-002\n */\n" }],
      ontology: [],
    });
    assertEquals(found, []);
  },
);

// ------------------------------------------------------------------------------------------------------------------------------- 0003-mizan FR-043

proves(
  ["0003-mizan FR-043"],
  "the proof register is read from a path given as an option, and the documents are the same bytes as when it sits beside the specifications",
  async () => {
    await withTempDir(async (repo) => {
      mkdirSync(join(repo, "kit", "specs", "001-demo"), { recursive: true });
      mkdirSync(join(repo, "tests"), { recursive: true });
      writeTextFileSync(join(repo, "kit", "specs", "001-demo", "spec.md"), SPEC);
      writeTextFileSync(join(repo, "tests", "demo.test.ts"), 'proves(["001-demo FR-001"], "it", () => {});\n');
      const register =
        "requirement\tmechanism\tby\tnote\n001-demo FR-001\tcheck\tdemo: bun test\tone test\n001-demo FR-002\tnone\t-\tnot built yet\n";
      writeTextFileSync(join(repo, "kit", "enforcement.tsv"), register);
      const beside = await registerDocuments(await readRegisterInput(join(repo, "kit"), repo, ["tests"], "Demo"));
      // the same register, in another folder, with Windows line ends
      mkdirSync(join(repo, "governance"), { recursive: true });
      writeTextFileSync(join(repo, "governance", "proof-register.tsv"), register.replaceAll("\n", "\r\n"));
      writeTextFileSync(join(repo, "kit", "enforcement.tsv"), "requirement\tmechanism\tby\tnote\n");
      const path = join(repo, "governance", "proof-register.tsv");
      const input = await readRegisterInput(join(repo, "kit"), repo, ["tests"], "Demo", { enforcement: path });
      assertEquals(input.enforcement, register, "the text is read with LF line ends");
      const moved = await registerDocuments(input);
      assertEquals(moved, beside);
      // and registerDocuments takes the path itself, over the text it was given
      const named = await registerDocuments(await readRegisterInput(join(repo, "kit"), repo, ["tests"], "Demo"), { enforcement: path });
      assertEquals(named, beside);
      assertStringIncludes(named.componentDefinition, '"value": "check"');
      assert(!named.componentDefinition.includes("\r"), "the generated files have LF line ends");
      // a path that is not there is an error, not an empty register
      let said = "";
      try {
        await readRegisterInput(join(repo, "kit"), repo, ["tests"], "Demo", { enforcement: join(repo, "nowhere.tsv") });
      } catch (e) {
        said = e instanceof Error ? e.message : String(e);
      }
      assertStringIncludes(said, "does not exist");
    });
  },
);

// ------------------------------------------------------------------------------------------------------------------------------- 0003-mizan FR-044

proves(["0003-mizan FR-044"], "a requirement that names a term the term does not cite back is a warning that a baseline holds", () => {
  const specs = [
    {
      slug: "001-demo",
      spec: [
        "- **FR-001**: The demo MUST use `x:Alpha` and `x:Beta`.",
        "- **FR-002**: The demo MUST use `x:Alpha`, `x:Gamma` and `y:Other`.",
        "- **FR-003**: The demo MUST use `x:Missing`.",
        "",
      ].join("\n"),
    },
  ];
  const known = { x: new Set(["Alpha", "Beta", "Gamma"]) };
  const ns = "https://example.org/x#";
  const definitions = definitionsOf(
    [
      { iri: `${ns}Alpha`, basis: "adopts", decision: false, definedBy: ["001-demo FR-001 to FR-002"] },
      { iri: `${ns}Beta`, basis: "adopts", decision: false, definedBy: ["001-demo"] },
      { iri: `${ns}Gamma`, basis: "adopts", decision: false },
    ],
    { x: ns },
  );
  assertEquals([...definitions.keys()], ["x:Alpha", "x:Beta", "x:Gamma"]);
  const found = termDefinedByFindings(specs, known, definitions);
  assertEquals(
    found.map((f) => [f.rule, f.key]),
    [
      ["mizan/term-not-defined-by", "mizan/term-not-defined-by specs/001-demo/spec.md FR-001 x:Beta"],
      ["mizan/term-not-defined-by", "mizan/term-not-defined-by specs/001-demo/spec.md FR-002 x:Gamma"],
    ],
    "Alpha's range covers both; Beta cites the specification and not the requirement; Gamma states nothing; Missing is the unknown-term rule's; y: is not read",
  );
  assertStringIncludes(found[0]?.message ?? "", "does not name 001-demo FR-001");
  assertStringIncludes(found[1]?.message ?? "", "states no mz:definedBy");
});

proves(
  ["0003-mizan FR-044", "0003-mizan FR-015"],
  "the stage runs in a harness's check only where its definitions are given, and its findings are held by the baseline",
  async () => {
    await withTempDir((root) => {
      mkdirSync(join(root, "specs", "001-demo"), { recursive: true });
      writeTextFileSync(join(root, "specs", "001-demo", "spec.md"), "- **FR-001**: The demo MUST use `x:Alpha`.\n");
      const baseline = join(root, "mizan.baseline.txt");
      const known = { x: new Set(["Alpha"]) };
      const base = { root, baselineFile: baseline, today: "2026-11-18", plugins: [] } as const;
      const without = holdHarness({ ...base, specTerms: { known } });
      assertEquals(without, 0, "no definitions given: the stage is not run");
      const definitions = definitionsOf([{ iri: "https://example.org/x#Alpha", basis: "adopts", decision: false }], {
        x: "https://example.org/x#",
      });
      const input = { ...base, specTerms: { known, definitions } };
      assertEquals(holdHarness(input), 1, "a new finding fails");
      assertEquals(holdHarness({ ...input, writeBaseline: true }), 0);
      assertStringIncludes(readTextFileSync(baseline), "mizan/term-not-defined-by specs/001-demo/spec.md FR-001 x:Alpha");
      assertEquals(holdHarness(input), 0, "held by the baseline");
      // the term is fixed: its line in the baseline is now stale
      const fixed = definitionsOf(
        [{ iri: "https://example.org/x#Alpha", basis: "adopts", decision: false, definedBy: ["001-demo FR-001"] }],
        {
          x: "https://example.org/x#",
        },
      );
      assertEquals(holdHarness({ ...base, specTerms: { known, definitions: fixed } }), 1, "a stale line fails: the baseline only shrinks");
      return Promise.resolve();
    });
  },
);

// ------------------------------------------------------------------------------------------------------------------------------- 0026 FR-039, FR-040

const LIB = { slug: "lib", kind: "Library", title: "A library", authors: [{ name: "A. Person" }], version: "1.0.0" };

function record(over: Readonly<Record<string, unknown>> = {}): string {
  return releaseSource({ ...LIB, ...over } as never);
}

proves(
  ["0026-works-versioning FR-039"],
  "a record's paths decode, are written back in their place, and may not name the work's own folder",
  () => {
    const withPaths = record({ paths: ["shared/schema", "docs/lib.md"] });
    const read = decodeReleaseSource(withPaths);
    assertEquals(read.kind, "ok");
    if (read.kind !== "ok") return;
    assertEquals(read.value.paths, ["shared/schema", "docs/lib.md"]);
    assertEquals(
      releaseSource(read.value),
      withPaths,
      "the template writes paths after exclude and before the snapshot, and the same text comes back",
    );
    assertEquals(decodeReleaseSource(record({ paths: ["/abs"] })).kind, "err", "a path is relative");
    assertEquals(decodeReleaseSource(record({ paths: ["a/../b"] })).kind, "err", "a path has no .. part");
    assertEquals(decodeReleaseSource(record({ paths: ["a\\b"] })).kind, "err", "a path is written with /");
    const inside = recordFindings("lib", record({ paths: ["lib/src"] }));
    assertEquals(
      inside.found.map((f) => f.rule),
      ["versions/record-invalid"],
    );
    assertStringIncludes(inside.found[0]?.message ?? "", "inside the folder lib");
    assertEquals(recordFindings("lib", record({ paths: ["shared"] })).found, []);
    assertEquals(recordFindings("", record({ paths: ["shared"] })).found.length, 1, "a work at the root holds every path already");
  },
);

proves(
  ["0026-works-versioning FR-039", "0026-works-versioning FR-040"],
  "a version that went back is found, offline, against any base revision, and the library gives the findings as data; a change in a path the record names is the work's change for the release",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await newRepo(dir);
      await commit(repo, "First\n\nRefs #1", {
        "lib/release.ts": record({ paths: ["shared"] }),
        "lib/a.ts": "1\n",
        "shared/x.ts": "1\n",
        "other/y.ts": "1\n",
      });
      const base = await git(repo, ["rev-parse", "HEAD"]);
      assertEquals(
        (await checkVersions(repo, base)).kind === "judged" && (await checkVersions(repo, base)).kind,
        "judged",
        "the head is the base: nothing changed",
      );
      // a change outside the folder, in a path the record names
      await commit(repo, "Change shared\n\nRefs #1", { "shared/x.ts": "2\n" });
      const found = await checkVersions(repo, base);
      assertEquals(found.kind, "judged");
      if (found.kind !== "judged") return;
      assertEquals(
        found.findings.map((f) => f.rule),
        [],
        "a version grows at the release, so a change of the work's files is no finding of a push",
      );
      assertEquals(found.works, 1);
      // a version that went back is
      await commit(repo, "Back\n\nRefs #1", { "lib/release.ts": record({ paths: ["shared"], version: "0.0.1" }) });
      const back = await checkVersions(repo, base);
      assertEquals(back.kind === "judged" ? back.findings.map((f) => f.rule) : "not run", ["versions/not-grown"]);
      assertStringIncludes(back.kind === "judged" ? (back.findings[0]?.message ?? "") : "", "went back");
      // a change in a path no record names is nobody's
      await commit(repo, "Change other\n\nRefs #1", { "other/y.ts": "2\n" });
      await git(repo, ["checkout", "-q", "-b", "side", base]);
      await commit(repo, "Change other only\n\nRefs #1", { "other/y.ts": "3\n" });
      const quiet = await checkVersions(repo, base);
      assertEquals(quiet.kind === "judged" ? quiet.findings : "not run", []);
      // the bump that follows the change is accepted
      await git(repo, ["checkout", "-q", "main"]);
      await commit(repo, "Bump\n\nRefs #1", { "lib/release.ts": record({ paths: ["shared"], version: "1.1.0" }) });
      const bumped = await checkVersions(repo, base);
      assertEquals(bumped.kind === "judged" ? bumped.findings : "not run", []);
      // a repository that is no repository, and a base that is not there, are not run, with their reason
      const nowhere = await checkVersions(join(dir, "nowhere"), "main");
      assertEquals(nowhere.kind, "not_run");
      const missing = await checkVersions(repo, "no-such-revision");
      assertEquals(missing.kind, "not_run");
    });
  },
  needsGit,
);

proves(
  ["0026-works-versioning FR-040"],
  "the package exports the versions command, the check, the register and readWorks, and readWorks finds the records of a folder",
  async () => {
    const root = new URL("../../libraries/package.json", import.meta.url);
    const pkg: unknown = JSON.parse(readTextFileSync(root));
    const exported: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "exports") : undefined;
    for (const key of ["./versions", "./check", "./changes", "./oscal-register"]) {
      const target: unknown = typeof exported === "object" && exported !== null ? Reflect.get(exported, key) : undefined;
      assert(typeof target === "string" && existsSync(new URL(target, root)), `${key} is exported and its file is there`);
    }
    assertEquals(typeof mizan.runVersions, "function");
    assertEquals(typeof mizan.checkVersions, "function");
    assertEquals(typeof mizanLibrary.versions.readWorks, "function");
    await withTempDir((dir) => {
      mkdirSync(join(dir, "lib"), { recursive: true });
      mkdirSync(join(dir, "node_modules", "x"), { recursive: true });
      writeTextFileSync(join(dir, "lib", "release.ts"), record());
      writeTextFileSync(join(dir, "node_modules", "x", "release.ts"), "skipped\n");
      assertEquals(
        mizanLibrary.readWorks(dir).map((w) => w.path),
        ["lib/release.ts"],
      );
      return Promise.resolve();
    });
  },
);

// ------------------------------------------------------------------------------------------------------------------------------- 0020 FR-035 to FR-038

const RUNGS = [
  "export const rungs = [",
  '  { id: "rung-0", label: "Ontology", provedBy: ["bun test"], homes: ["ontology/"] },',
  '  { id: "rung-1", label: "Specifications", provedBy: ["bun test"], homes: ["specs/"] },',
  '  { id: "rung-5", label: "Business rules", provedBy: ["bun test"], homes: ["src/", "tests/"] },',
  "];",
  "",
].join("\n");

/** A repository with two capabilities: #3 closed with a whole chain but for its run, #4 open and ending at its term. */
async function consumer(repo: string): Promise<{ readonly base: string }> {
  await commit(repo, "Start\n\nRefs #1", { "README.md": "x\n" });
  const base = await git(repo, ["rev-parse", "HEAD"]);
  await commit(repo, "The spec\n\nRefs #3", { "specs/001-demo/spec.md": SPEC });
  await commit(repo, "The term and the code\n\nRefs #3", {
    "ontology/terms.ts": "export const terms = [];\n",
    "src/demo.ts": "/**\n * The demo.\n * Spec: 001-demo FR-001\n */\nexport const demo = 1;\n",
  });
  await commit(repo, "The proof\n\nCloses #3", { "tests/demo.test.ts": "/**\n * Proves: 001-demo FR-001\n */\n" });
  await commit(repo, "More\n\nRefs #4\nSpec: 001-demo FR-002", { "src/more.ts": "// nothing cited here\n" });
  await commit(repo, "No change request here", { "notes.txt": "x\n" });
  return { base };
}

proves(
  ["0020-ifccm FR-035", "0020-ifccm FR-036", "0020-ifccm FR-037"],
  "the offline trace follows each capability's requirements to terms, code and tests on each rung from commits, specifications, a terms file, change requests as JSON and block-comment lines, with no Git host",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await newRepo(dir);
      const { base } = await consumer(repo);
      writeTextFileSync(
        join(repo, "trace-terms.json"),
        JSON.stringify([{ term: "x:Demo", cites: ["001-demo FR-001"], file: "ontology/terms.ts" }]),
      );
      writeTextFileSync(join(repo, "trace-rungs.ts"), RUNGS);
      writeTextFileSync(
        join(repo, "trace-issues.json"),
        JSON.stringify([
          { number: 3, title: "The demo", body: "## Done when\n- [x] 001-demo FR-001\n- [x] 001-demo FR-002\n" },
          { number: 4 },
        ]),
      );
      const range = `${base}..HEAD`;
      const args = [
        "--capability-trace",
        "--range",
        range,
        "--terms",
        "trace-terms.json",
        "--rungs",
        "trace-rungs.ts",
        "--issues",
        "trace-issues.json",
      ];
      const json = await cmd(repo, ...args, "--format", "json");
      assertEquals(json.code, 1, "a closed capability whose chain does not reach its run fails");
      const t: unknown = JSON.parse(json.out);
      assert(typeof t === "object" && t !== null);
      const capabilities: unknown = Reflect.get(t, "capabilities");
      assert(Array.isArray(capabilities));
      const numberOf = (c: unknown): unknown => (typeof c === "object" && c !== null ? Reflect.get(c, "number") : undefined);
      assertEquals(capabilities.map(numberOf), [3, 4]);
      const three: unknown = capabilities[0];
      assert(typeof three === "object" && three !== null);
      assertEquals(Reflect.get(three, "title"), "The demo", "the title is the change request's");
      assertEquals(Reflect.get(three, "closed"), true);
      assertEquals(Reflect.get(three, "rungs"), ["rung-0", "rung-1", "rung-5"]);
      const reqs: unknown = Reflect.get(three, "requirements");
      assert(Array.isArray(reqs));
      const first: unknown = reqs[0];
      assert(typeof first === "object" && first !== null);
      assertEquals(Reflect.get(first, "requirement"), "001-demo FR-001");
      assertEquals(Reflect.get(first, "basis"), ["code", "issue", "spec", "test"]);
      assertEquals(Reflect.get(first, "endsAt"), "StageRun");
      assertEquals(Reflect.get(first, "rungs"), [
        { rung: "rung-0", spec: [], terms: ["x:Demo"], code: [], tests: [] },
        { rung: "rung-1", spec: ["specs/001-demo/spec.md"], terms: [], code: [], tests: [] },
        { rung: "rung-5", spec: [], terms: [], code: ["src/demo.ts"], tests: ["tests/demo.test.ts"] },
      ]);
      const second: unknown = reqs[1];
      assert(typeof second === "object" && second !== null);
      assertEquals(Reflect.get(second, "requirement"), "001-demo FR-002");
      assertEquals(Reflect.get(second, "endsAt"), "StageTerm", "named by the change request's Done when, linked to no term");
      // the same input gives the same bytes, with LF
      const again = await cmd(repo, ...args, "--format", "json");
      assertEquals(again.out, json.out);
      assert(!json.out.includes("\r") && json.out.endsWith("}\n"));
      // the table
      const text = await cmd(repo, ...args);
      const lines = text.out.split("\n");
      assertEquals(lines[0]?.split(/\s{2,}/), ["CAPABILITY", "REQUIREMENT", "RUNG", "SPEC", "TERMS", "CODE", "TESTS", "ENDS AT"]);
      assert(
        lines.some((l) => /^#3\s+001-demo FR-001\s+rung-5\s+-\s+-\s+src\/demo\.ts\s+tests\/demo\.test\.ts\s+StageRun$/.test(l)),
        text.out,
      );
      assert(
        lines.some((l) => /^#4\*\s+001-demo FR-002\s+rung-1\s+specs\/001-demo\/spec\.md\s+-\s+-\s+-\s+StageTerm$/.test(l)),
        text.out,
      );
      assertStringIncludes(text.out, "* the capability is open");
      assertStringIncludes(text.out, "1 commit(s) name no change request");
      // written to a file instead
      const filed = await cmd(repo, ...args, "--format", "json", "--output", "trace.json");
      assertEquals(readTextFileSync(join(repo, "trace.json")), json.out);
      assertStringIncludes(filed.out, "is written");
      // a range that holds only the open capability passes: an open capability is in progress
      const open = await cmd(
        repo,
        "--capability-trace",
        "--range",
        "HEAD~2..HEAD~1",
        "--terms",
        "trace-terms.json",
        "--rungs",
        "trace-rungs.ts",
      );
      assertEquals(open.code, 0);
    });
  },
  needsGit,
);

proves(
  ["0020-ifccm FR-036"],
  "the terms come from a module loaded by its file URL, as audit records, and the usage errors are named",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await newRepo(dir);
      const { base } = await consumer(repo);
      // a module outside the repository's tree of sources, in a folder whose name has a space (a path a bare import would misread on Windows)
      const folder = join(dir, "term sources");
      mkdirSync(folder, { recursive: true });
      const audit = join(folder, "audit.ts");
      writeTextFileSync(
        audit,
        'export const terms = [{ values: { termIri: "https://example.org/x#Demo", definedBy: ["001-demo FR-001"] } }];\n',
      );
      const r = await cmd(repo, "--capability-trace", "--range", `${base}..HEAD`, "--terms", audit, "--format", "json");
      assertStringIncludes(r.out, "https://example.org/x#Demo");
      assertEquals((await cmd(repo, "--capability-trace", "--range", `${base}..HEAD`, "--terms", join(folder, "none.ts"))).code, 3);
      writeTextFileSync(join(folder, "empty.ts"), "export const other = 1;\n");
      const bad = await cmd(repo, "--capability-trace", "--range", `${base}..HEAD`, "--terms", join(folder, "empty.ts"));
      assertEquals(bad.code, 3);
      assertStringIncludes(bad.err, "exports no terms");
      assertEquals((await cmd(repo, "--capability-trace")).code, 2, "the range is needed");
      assertEquals((await cmd(repo, "--capability-trace", "--range", "HEAD~1..HEAD", "--format", "xml")).code, 2);
      assertEquals((await cmd(repo, "--capability-trace", "--range", "HEAD~1..HEAD", "--issues", "no-such.json")).code, 3);
      // --trace uses the same terms file, in place of commons' own
      writeTextFileSync(join(repo, "body.md"), "## Done when\n- [x] 001-demo FR-001\n");
      const traced = await cmd(repo, "--trace", "body.md", "--terms", audit);
      assertStringIncludes(
        traced.out,
        "001-demo FR-001: ends at StageRun (StageIssue > StageRequirement > StageTerm > StageCode > StageTest)",
      );
    });
  },
  needsGit,
);

proves(
  ["0020-ifccm FR-038"],
  "the view of capabilities by rung is made from the commits and written between the markers of a document, and --check fails where it differs",
  async () => {
    await withTempDir(async (dir) => {
      const repo = await newRepo(dir);
      const { base } = await consumer(repo);
      writeTextFileSync(join(repo, "trace-rungs.ts"), RUNGS);
      writeTextFileSync(join(repo, "ARCH.md"), "# Architecture\n\n<!-- capabilities:begin -->\nstale\n<!-- capabilities:end -->\n");
      const args = ["--capability-trace", "--range", `${base}..HEAD`, "--rungs", "trace-rungs.ts", "--document", "ARCH.md"];
      assertStringIncludes((await cmd(repo, ...args, "--check")).err, "differs from what is generated");
      await cmd(repo, ...args);
      const doc = readTextFileSync(join(repo, "ARCH.md"));
      assertStringIncludes(doc, "### Specifications (rung-1)");
      assertStringIncludes(doc, "- #3 The spec: open, `bun test` has no passing run at ");
      assertStringIncludes(doc, "- #4 More: open");
      // the same range gives the same view: --check finds no difference (the exit status is also the chain's, and the closed capability's run is missing)
      assertEquals((await cmd(repo, ...args, "--check")).err.includes("differs"), false);
    });
  },
  needsGit,
);

proves(
  ["0020-ifccm FR-035", "0020-ifccm FR-037"],
  "the trace of data in hand: a commit that names no change request of this repository is listed apart, and the change requests file is decoded",
  () => {
    const result = capabilityTrace({
      commits: [
        {
          sha: "a".repeat(40),
          subject: "Other repository",
          message: "Other repository\n\nRefs owner/other#7\n",
          files: ["src/a.ts"],
          requirements: [],
        },
        {
          sha: "b".repeat(40),
          subject: "Mine",
          message: "Mine\n\nCloses #2\n",
          files: ["src/b.ts"],
          requirements: ["001-demo FR-001", "009-none FR-001"],
        },
      ],
      issues: [],
      specs: [{ slug: "001-demo", spec: SPEC }],
      terms: [],
      sources: [],
      tests: [],
      cases: [],
      rungs: [],
    });
    assertEquals(result.unreferenced, ["a".repeat(40)]);
    assertEquals(
      result.capabilities.map((c) => [c.number, c.closed, c.requirements.map((r) => r.requirement)]),
      [[2, true, ["001-demo FR-001"]]],
    );
    assertEquals(result.capabilities[0]?.rungs, ["-"], "no rung has a home for the file");
    assertStringIncludes(traceTable(result), "#2");
    assertStringIncludes(traceJson(result), '"unreferenced": [');
    assertEquals(parseIssues('{"issues":[{"number":1,"title":"A"}]}').kind, "ok");
    assertEquals(parseIssues("[").kind, "err");
    assertEquals(parseIssues('[{"number":"one"}]').kind, "err");
  },
);
