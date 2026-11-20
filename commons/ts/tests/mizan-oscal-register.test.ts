/**
 * The proof register as OSCAL (commons 0003-mizan FR-011, FR-016, FR-021 to FR-023): the rows of a folder's `enforcement.tsv`, `reviewed.tsv` and the proofs its tests name; the
 * component definition and the assessment results the kernel's writers make of them; the same bytes on every run; the generated files of commons current and the command that checks
 * them, run as a program on the runtime this test runs on; and each document read by an independent tool, the `jsonschema` package, against the official OSCAL 1.2.3 JSON Schema
 * of its model, fetched from the release of the OSCAL repository and held to its SHA-256 (where Python with `jsonschema`, or the release, cannot be reached, that test is skipped and says so).
 *
 * @module
 */
import { cpSync } from "node:fs";
import { OSCAL_VERSION } from "@intellectual-frontiers/grc/oscal";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { makeTempDirSync, mkdirSync, readTextFileSync, removeSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, resolve } from "@intellectual-frontiers/system/path";
import { execPath, run, which } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  COMPONENT_FILE,
  controlIdOf,
  main,
  type RegisterInput,
  registerDocuments,
  registerRows,
  RESULTS_FILE,
} from "@intellectual-frontiers/libraries/oscal-register";

const HERE = dirname(fromFileUrl(import.meta.url));
const TOOL = resolve(HERE, "..", "..", "libraries", "src", "oscal-register.ts");
const GENERATED = resolve(HERE, "..", "..", "generated");

/** A folder of two specifications with every kind of row the register has. */
function folder(over: Partial<RegisterInput> = {}): RegisterInput {
  return {
    label: "Example harness",
    specs: [
      {
        slug: "0001-x",
        spec: [
          "# Feature Specification: X",
          "**Status:** Active",
          "- **FR-001**: The tool MUST write the file. It also MUST say so.",
          "- **FR-002**: The tool MUST check the file.",
          "- **FR-003**: The tool MUST sign the file.",
          "- **FR-004**: A person MUST read the file.",
          "- **FR-005**: The tool MUST do more.",
          "- **FR-006**: The tool MUST do most.",
          "",
        ].join("\n"),
      },
      { slug: "0002-y", spec: "# Feature Specification: Y\n**Status:** Draft\n- **FR-001**: The tool MAY wait.\n" },
    ],
    reviewed: new Map([
      ["0001-x", "# reviewed\n0001-x FR-004\ta person reads it each quarter\n0001-x FR-001\tignored: enforcement.tsv decides\n"],
    ]),
    enforcement: [
      "# comment",
      "requirement\tmechanism\tby\tnote",
      "0001-x FR-001\tcheck\trepo: bun test\twrites",
      "0001-x FR-002\tcheck\trepo: bun test\tchecks, but no test names it",
      "0001-x FR-003\tgate\trepo: ci\tsigns",
      "0001-x FR-005\tnone\t-\tplanned",
      "0002-y FR-001\tnone\t-\tplanned, Draft",
      "",
    ].join("\n"),
    tests: [
      { path: "tests/b.test.ts", text: 'proves(["0001-x FR-001", "0001-x FR-003"], "writes", () => {});\n' },
      {
        path: "tests/a.test.ts",
        text: 'proves(["0001-x FR-001"], "writes again", () => {});\n// Proves: 0001-x FR-005 to FR-006; 0009-none FR-001\n',
      },
    ],
    ...over,
  };
}

type Json = Record<string, unknown>;
const asJson = (text: string): Json => {
  const x: unknown = JSON.parse(text);
  assert(typeof x === "object" && x !== null && !Array.isArray(x));
  return Object.fromEntries(Object.entries(x));
};
const list = (x: unknown): readonly Json[] => {
  assert(Array.isArray(x));
  return x.map((i) => asJson(JSON.stringify(i)));
};

proves(
  ["0003-mizan FR-021", "0003-mizan FR-016"],
  "each requirement is a row: its mechanism from enforcement.tsv or reviewed.tsv (enforcement.tsv decides), its proofs from every proves call and Proves line, ranges expanded and unknown specifications left out",
  () => {
    const rows = registerRows(folder());
    assertEquals(
      rows.map((r) => [r.requirement, r.mechanism, r.by, r.files, r.controlId]),
      [
        ["0001-x FR-001", "check", "repo: bun test", ["tests/a.test.ts", "tests/b.test.ts"], "spec-0001-x.fr-001"],
        ["0001-x FR-002", "check", "repo: bun test", [], "spec-0001-x.fr-002"],
        ["0001-x FR-003", "gate", "repo: ci", ["tests/b.test.ts"], "spec-0001-x.fr-003"],
        ["0001-x FR-004", "review", "reviewed.tsv", [], "spec-0001-x.fr-004"],
        ["0001-x FR-005", "none", "-", ["tests/a.test.ts"], "spec-0001-x.fr-005"],
        ["0001-x FR-006", "none", "-", ["tests/a.test.ts"], "spec-0001-x.fr-006"],
        ["0002-y FR-001", "none", "-", [], "spec-0002-y.fr-001"],
      ],
    );
    assertEquals(rows[3]?.note, "a person reads it each quarter");
    assertEquals(rows[5]?.note, "no row in enforcement.tsv");
    assertEquals(rows[0]?.title, "The tool MUST write the file.");
    assertEquals(rows[6]?.status, "Draft");
    assertEquals(controlIdOf("0003-mizan", "FR-011"), "spec-0003-mizan.fr-011");
  },
);

proves(
  ["0003-mizan FR-021"],
  "the component definition has an implemented requirement for each requirement, with its mechanism and its number of proofs; the control ids are OSCAL tokens",
  async () => {
    const made = await registerDocuments(folder());
    const doc = asJson(made.componentDefinition);
    const cd = asJson(JSON.stringify(doc["component-definition"]));
    assertEquals(asJson(JSON.stringify(cd["metadata"]))["oscal-version"], OSCAL_VERSION);
    assertEquals(OSCAL_VERSION, "1.2.3");
    const component = list(cd["components"]);
    assertEquals(component.length, 1);
    const implementations = list(component[0]?.["control-implementations"]);
    assertEquals(implementations.length, 1);
    const reqs = list(implementations[0]?.["implemented-requirements"]);
    assertEquals(
      reqs.map((r) => r["control-id"]),
      [
        "spec-0001-x.fr-001",
        "spec-0001-x.fr-002",
        "spec-0001-x.fr-003",
        "spec-0001-x.fr-004",
        "spec-0001-x.fr-005",
        "spec-0001-x.fr-006",
        "spec-0002-y.fr-001",
      ],
    );
    for (const r of reqs)
      assert(/^(\p{L}|_)(\p{L}|\p{N}|[.\-_])*$/u.test(String(r["control-id"])), `${String(r["control-id"])} is an OSCAL token`);
    const props = (r: Json | undefined): string[] => list(r?.["props"]).map((p) => `${String(p["name"])}=${String(p["value"])}`);
    assertEquals(props(reqs[0]), ["control=0001-x FR-001", "mechanism=check", "proofs=2"]);
    assertEquals(props(reqs[3]), ["control=0001-x FR-004", "mechanism=review", "proofs=0"]);
    assertStringIncludes(String(reqs[0]?.["description"]), "0001-x FR-001 (The tool MUST write the file.)");
  },
);

proves(
  ["0003-mizan FR-021"],
  "the assessment results hold a passing observation for each test file of a requirement with the SHA-256 of the file, an accepted one for a review, and a gap for what no test names",
  async () => {
    const input = folder();
    const results = asJson((await registerDocuments(input)).assessmentResults);
    const ar = asJson(JSON.stringify(results["assessment-results"]));
    assertEquals(asJson(JSON.stringify(ar["metadata"]))["oscal-version"], OSCAL_VERSION);
    const result = list(ar["results"])[0];
    assert(result !== undefined);
    const observations = list(result["observations"]);
    const prop = (o: Json, name: string): string | undefined =>
      list(o["props"])
        .find((p) => p["name"] === name)
        ?.["value"]?.toString();
    const of = (control: string): Json[] => observations.filter((o) => prop(o, "control") === control);
    assertEquals(
      of("0001-x FR-001")
        .map((o) => [prop(o, "outcome"), o["title"]])
        .sort(),
      [
        ["pass", "0001-x FR-001 on specification 0001-x: proved by tests/a.test.ts"],
        ["pass", "0001-x FR-001 on specification 0001-x: proved by tests/b.test.ts"],
      ],
    );
    const evidence = list(of("0001-x FR-001").find((o) => String(o["title"]).endsWith("tests/b.test.ts"))?.["relevant-evidence"])[0];
    assertEquals(list(evidence?.["props"])[0]?.["value"], await sha256(input.tests[0]?.text ?? ""));
    assertEquals(
      of("0001-x FR-002").map((o) => [prop(o, "outcome"), prop(o, "status")]),
      [["gap", "gap"]],
    );
    assertEquals(
      of("0001-x FR-004").map((o) => [prop(o, "outcome"), prop(o, "waiver")]),
      [["accepted", "reviewed.tsv"]],
    );
    assertStringIncludes(String(of("0001-x FR-004")[0]?.["description"]), "a person reads it each quarter");
    assertEquals(
      of("0002-y FR-001").map((o) => prop(o, "outcome")),
      ["gap"],
    );
    const findings = list(result["findings"]);
    const state = (id: string): unknown =>
      asJson(JSON.stringify(asJson(JSON.stringify(findings.find((f) => f["title"] === id)?.["target"]))["status"]))["state"];
    assertEquals(["spec-0001-x.fr-001", "spec-0001-x.fr-002", "spec-0001-x.fr-004", "spec-0001-x.fr-005"].map(state), [
      "satisfied",
      "not-satisfied",
      "satisfied",
      "satisfied",
    ]);
  },
);

proves(
  ["0003-mizan FR-022"],
  "the same folder gives the same bytes, whatever order its tests come in; a changed requirement or proof changes the version, and nothing else does",
  async () => {
    const a = await registerDocuments(folder());
    assertEquals(await registerDocuments(folder()), a);
    const reordered = folder({ tests: [...folder().tests].reverse() });
    assertEquals(await registerDocuments(reordered), a);
    const version = (text: string): string =>
      String(asJson(JSON.stringify(asJson(JSON.stringify(Object.values(asJson(text))[0]))["metadata"]))["version"]);
    assertEquals(version(a.componentDefinition), version(a.assessmentResults));
    assertEquals(version(a.componentDefinition).length, 12);
    assertStringIncludes(a.componentDefinition, '"last-modified": "1970-01-01T00:00:00.000Z"');
    const fixed = folder({ enforcement: folder().enforcement.replace("0001-x FR-002\tcheck", "0001-x FR-002\tgate") });
    const b = await registerDocuments(fixed);
    assert(version(b.componentDefinition) !== version(a.componentDefinition));
    const moved = folder({ tests: [{ path: "tests/c.test.ts", text: "// Proves: 0001-x FR-002\n" }] });
    assert(version((await registerDocuments(moved)).assessmentResults) !== version(a.assessmentResults));
    assertStringIncludes(a.componentDefinition, "generated by bun commons/libraries/src/oscal-register.ts; do not edit");
  },
);

proves(
  ["0003-mizan FR-023"],
  "commons' own register is current, with the command's exit status, and a file edited by hand is named with exit 1 until it is written again",
  async () => {
    const check = await run([execPath(), TOOL, "--check"]);
    assertEquals([check.code, check.stdout, check.stderr], [0, "", ""]);
    const tmp = makeTempDirSync({ prefix: "mizan-oscal-register-" });
    try {
      mkdirSync(`${tmp}/generated`, { recursive: true });
      cpSync(GENERATED, `${tmp}/generated`, { recursive: true });
      assertEquals(await main(["--check", "--out", `${tmp}/generated`]), 0);
      const file = `${tmp}/generated/${COMPONENT_FILE}`;
      writeTextFileSync(file, readTextFileSync(file).replace('"mechanism"', '"mechanism-by-hand"'));
      const stale = await run([execPath(), TOOL, "--check", "--out", `${tmp}/generated`]);
      assertEquals(stale.code, 1);
      assertStringIncludes(
        stale.stderr,
        `${COMPONENT_FILE} is not what the folder makes; run: bun commons/libraries/src/oscal-register.ts`,
      );
      assert(!stale.stderr.includes(RESULTS_FILE));
      assertEquals((await run([execPath(), TOOL, "--out", `${tmp}/generated`])).code, 0);
      assertEquals(
        readTextFileSync(file).replaceAll("\r\n", "\n"),
        readTextFileSync(`${GENERATED}/${COMPONENT_FILE}`).replaceAll("\r\n", "\n"),
      );
      removeSync(`${tmp}/generated/${RESULTS_FILE}`);
      const missing = await run([execPath(), TOOL, "--check", "--out", `${tmp}/generated`]);
      assertEquals(missing.code, 1);
      assertStringIncludes(missing.stderr, RESULTS_FILE);
    } finally {
      removeSync(tmp, { recursive: true });
    }
  },
);

proves(
  ["0003-mizan FR-011", "0003-mizan FR-016", "0003-mizan FR-021"],
  "commons' own register says what its specifications hold: every requirement is an implemented requirement, the register proves this very file, and a requirement no test names is a gap",
  () => {
    const cd = asJson(readTextFileSync(`${GENERATED}/${COMPONENT_FILE}`));
    const inner = asJson(JSON.stringify(cd["component-definition"]));
    const reqs = list(list(list(inner["components"])[0]?.["control-implementations"])[0]?.["implemented-requirements"]);
    const ids = new Set(reqs.map((r) => String(r["control-id"])));
    for (const id of ["spec-0003-mizan.fr-011", "spec-0003-mizan.fr-021", "spec-0018-standards-first.fr-015", "spec-0015-trace.fr-001"])
      assert(ids.has(id), id);
    assert(reqs.length > 300);
    const proofs = (id: string): string | undefined =>
      list(reqs.find((r) => r["control-id"] === id)?.["props"])
        .find((p) => p["name"] === "proofs")
        ?.["value"]?.toString();
    assert(Number(proofs("spec-0003-mizan.fr-021")) >= 1, "the register's own requirement is proved by this file");
    assert(Number(proofs("spec-0003-mizan.fr-011")) >= 1);
  },
);

const PYTHON = `
import json, sys
import jsonschema

def fix(x):
    # Python's re has no \\p{L} or \\p{N}: the schema's patterns say letters and digits with them, and the same classes are written as [^\\W\\d_] and \\d; nothing else is changed
    if isinstance(x, dict):
        return {k: (v.replace("\\\\p{L}", "[^\\\\W\\\\d_]").replace("\\\\p{N}", "\\\\d") if k == "pattern" and isinstance(v, str) else fix(v)) for k, v in x.items()}
    if isinstance(x, list):
        return [fix(i) for i in x]
    return x

schema = fix(json.load(open(sys.argv[1])))
jsonschema.Draft7Validator.check_schema(schema)
errors = list(jsonschema.Draft7Validator(schema).iter_errors(json.load(open(sys.argv[2]))))
for e in errors[:5]:
    print(list(e.path)[:8], e.message[:160])
sys.exit(1 if errors else 0)
`;

/** The official OSCAL 1.2.3 JSON Schemas of the two models, and the SHA-256 of each as the release publishes it (checked 2026-11-17). */
const SCHEMAS = [
  {
    name: "oscal_component_schema.json",
    sha256: "95e76881151ececd5cb1a93ff0f70ad74b8cc1aa58771626ac8b262bf2c8e001",
    file: COMPONENT_FILE,
  },
  {
    name: "oscal_assessment-results_schema.json",
    sha256: "4034e2032332dbf597e59e0646ec16c2c31df992962490371e91f47b219ff42c",
    file: RESULTS_FILE,
  },
] as const;
const RELEASE = "https://github.com/usnistgov/OSCAL/releases/download/v1.2.3";

proves(
  ["0003-mizan FR-023", "0003-mizan FR-011"],
  "each document validates against the official OSCAL 1.2.3 JSON Schema of its model (jsonschema), and the same schema rejects a document with a control id that is no token and one with no metadata",
  async (t) => {
    const python = which("python3");
    const have = python === undefined ? undefined : await run([python, "-c", "import jsonschema"]);
    if (python === undefined || have === undefined || have.code !== 0) {
      t.skip("python3 with jsonschema is not installed");
      return;
    }
    const dir = makeTempDirSync({ prefix: "mizan-oscal-schema-" });
    try {
      for (const s of SCHEMAS) {
        let text: string;
        try {
          const r = await fetch(`${RELEASE}/${s.name}`, { signal: AbortSignal.timeout(60_000) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          text = await r.text();
        } catch (e) {
          t.skip(
            `${RELEASE}/${s.name} cannot be fetched (${e instanceof Error ? e.message : String(e)}); github.com and release-assets.githubusercontent.com must be reachable`,
          );
          return;
        }
        assertEquals(String(await sha256(text)), s.sha256, `${s.name} is the schema of the 1.2.3 release`);
        writeTextFileSync(`${dir}/${s.name}`, text);
        const ok = await run([python, "-I", "-c", PYTHON, `${dir}/${s.name}`, `${GENERATED}/${s.file}`]);
        assertEquals([ok.code, ok.stdout], [0, ""], ok.stderr);
        const doc = readTextFileSync(`${GENERATED}/${s.file}`);
        const noMetadata = doc.replace('"metadata"', '"metadata-missing"');
        writeTextFileSync(`${dir}/broken-metadata.json`, noMetadata);
        const rejected = await run([python, "-I", "-c", PYTHON, `${dir}/${s.name}`, `${dir}/broken-metadata.json`]);
        assertEquals(rejected.code, 1);
        assertStringIncludes(rejected.stdout, "metadata");
        if (s.file === COMPONENT_FILE) {
          writeTextFileSync(`${dir}/broken-token.json`, doc.replace('"spec-0001-software-supply-chain.fr-001"', '"1 not a token"'));
          const token = await run([python, "-I", "-c", PYTHON, `${dir}/${s.name}`, `${dir}/broken-token.json`]);
          assertEquals(token.code, 1);
          assertStringIncludes(token.stdout, "control-id");
        }
      }
    } finally {
      removeSync(dir, { recursive: true });
    }
  },
);
