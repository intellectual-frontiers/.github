/**
 * Tests of `kernel/trace.ts` and `kernel/layers.ts` (commons 0015-trace): small fixture trees of specifications, sources, tests and an
 * ontology, each rule found and each exemption kept, the baseline written, read and judged (a new finding and a stale entry both fail), and
 * a ladder's placements and imports.
 *
 * @module
 */
import {
  citationsOf,
  finding,
  formatBaseline,
  judge,
  parseBaseline,
  parseCitation,
  parseSpec,
  passes,
  proofsOf,
  report,
  specLines,
  type SourceFile,
  traceFindings,
  type TraceInput,
} from "../src/trace.ts";
import { importsOf, layerFindings, type Ladder, placeOf, resolveImport } from "../src/layers.ts";
import { classSchema, en, many, namespace, one, range, term, vocabulary } from "@intellectual-frontiers/rdf";
import { rdfs } from "@intellectual-frontiers/rdf";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const DEMO = [
  "# Demo",
  "",
  "**Feature Branch**: `001-demo` **Created**: 2026-11-16 **Status**: Active",
  "",
  "- **FR-001** It works.",
  "- **FR-002** It works twice.",
  "- **FR-003** It works thrice.",
  "- **FR-003a** It works once more.",
  "",
].join("\n");

const DRAFT = "# Later\n\n**Spec ID:** 002-later\n**Status:** Draft\n\n- **FR-001**: It MUST come later.\n";

function input(over: Partial<TraceInput> = {}): TraceInput {
  return {
    specs: [parseSpec("001-demo", DEMO, "001-demo FR-003a\treviewed by a person\n# a comment\n"), parseSpec("002-later", DRAFT)],
    sources: [{ path: "src/a.ts", text: "/** A. @module */\n// Spec: 001-demo FR-001 to FR-003\n" }],
    tests: [
      { path: "tests/a.test.ts", text: 'proves(["001-demo FR-001", "001-demo FR-002"], "x", () => {});\n// Proves: 001-demo FR-003\n' },
    ],
    ontology: [],
    ...over,
  };
}

proves(["0015-trace FR-004"], "a specification's slug, status, requirements and reviewed requirements", () => {
  const s = parseSpec("001-demo", DEMO, "001-demo FR-003a\treason\n002-later FR-001\tanother spec's\n");
  assertEquals(s.status, "Active");
  assertEquals(
    s.requirements.map((r) => `${r.id}@${r.line}`),
    ["FR-001@5", "FR-002@6", "FR-003@7", "FR-003a@8"],
  );
  assertEquals(s.reviewed, ["FR-003a"]);
  assertEquals(parseSpec("002-later", DRAFT).status, "Draft");
  assertEquals(parseSpec("003-none", "# None\n").status, undefined);
});

proves(["0015-trace FR-005"], "Spec: lines: groups, lists, ranges, whole specs, several lines", () => {
  const c = specLines(
    "/** x */\n// Spec: 097-controller FR-001, FR-003 to FR-005; 098-pair\n// Spec: 099-engine-update FR-002\nconst x = 1;\n",
  );
  assertEquals(c, [
    {
      line: 2,
      spec: "097-controller",
      requirements: [
        { kind: "one", id: "FR-001" },
        { kind: "range", from: "FR-003", to: "FR-005" },
      ],
    },
    { line: 2, spec: "098-pair", requirements: [] },
    { line: 3, spec: "099-engine-update", requirements: [{ kind: "one", id: "FR-002" }] },
  ]);
  assertEquals(parseCitation("001-demo FR-001 FR-002", 1)[0]?.requirements.length, 2);
  assertEquals(specLines('const s = "// Spec: 001-demo";\n'), []);
});

proves(["0015-trace FR-006"], "proofs: literals in proves([...]), constants, arrays of constants, Proves: lines; not FR(3)", () => {
  const text = [
    'const FR = "100-remote-access FR-003";',
    'const BOTH = ["100-remote-access FR-004", "100-remote-access FR-005"] as const;',
    'proves(["100-remote-access FR-001",',
    '  "100-remote-access FR-002"], "two", () => {});',
    'proves([FR, ...BOTH], "consts", () => {});',
    'proves(BOTH, "an array", () => {});',
    'proves([FR(3)], "built at run time", () => {});',
    "// Proves: 100-remote-access FR-006 to FR-007",
  ].join("\n");
  const ids = proofsOf(text).map((p) =>
    p.requirement.kind === "one" ? `${p.spec} ${p.requirement.id}` : `${p.spec} ${p.requirement.from}..${p.requirement.to}`,
  );
  assertEquals(ids, [
    "100-remote-access FR-001",
    "100-remote-access FR-002",
    "100-remote-access FR-003",
    "100-remote-access FR-004",
    "100-remote-access FR-005",
    "100-remote-access FR-004",
    "100-remote-access FR-005",
    "100-remote-access FR-006..FR-007",
  ]);
});

proves(["0015-trace FR-007"], "a clean tree has no finding; a Draft spec and a reviewed requirement are not unproved", () => {
  assertEquals(traceFindings(input()), []);
});

proves(["0015-trace FR-007"], "each rule of the trace, and .auto. files exempt", () => {
  const found = traceFindings(
    input({
      sources: [
        { path: "src/none.ts", text: "/** None. @module */\nexport const x = 1;\n" },
        { path: "src/gen.auto.ts", text: "export const y = 2;\n" },
        { path: "src/bad.ts", text: "// Spec: 065-console\n// Spec: 001-demo FR-009, FR-003 to FR-001\n" },
      ],
      tests: [{ path: "tests/a.test.ts", text: 'proves(["001-demo FR-001"], "one", () => {});\n' }],
      ontology: [
        { term: "ex:a", cites: [], file: "ontology/a.ts" },
        { term: "ex:b", cites: ["001-demo FR-001"], file: "ontology/a.ts" },
        { term: "ex:c", cites: ["001-demo FR-099", "065-console"], file: "ontology/a.ts", line: 7 },
      ],
    }),
  );
  assertEquals(
    found.map((f) => f.key),
    [
      "trace/no-spec-line src/none.ts",
      "trace/unknown-spec src/bad.ts 065-console",
      "trace/unknown-requirement src/bad.ts 001-demo FR-009",
      "trace/unknown-requirement src/bad.ts 001-demo FR-003 to FR-001",
      "trace/unproved specs/001-demo/spec.md FR-002",
      "trace/unproved specs/001-demo/spec.md FR-003",
      "trace/term-uncited ontology/a.ts ex:a",
      "trace/term-unknown-spec ontology/a.ts ex:c 001-demo FR-099",
      "trace/term-unknown-spec ontology/a.ts ex:c 065-console",
    ],
  );
  const unproved = found.find((f) => f.rule === "trace/unproved");
  assertEquals(unproved?.line, 6);
  assertEquals(found.find((f) => f.rule === "trace/term-unknown-spec")?.line, 7);
  for (const f of found) assert(f.message.length > 0 && !f.message.includes("\n"), f.message);
});

proves(["0015-trace FR-008"], "citations of the individuals made by a schema with a spec field", () => {
  const EX = namespace("ex", "https://example.org/terms#");
  const ex = vocabulary(EX, { Kind: "owl:Class", Other: "owl:Class", spec: "owl:DatatypeProperty" });
  const Kind = classSchema(ex.Kind, { label: one(rdfs.label, range.langString), spec: many(ex.spec, range.string) });
  const Other = classSchema(ex.Other, { label: one(rdfs.label, range.langString) });
  const a = Kind.make(term(EX, "a"), { label: en("a"), spec: ["001-demo", "001-demo FR-002"] });
  const b = Kind.make(term(EX, "b"), { label: en("b") });
  const c = Other.make(term(EX, "c"), { label: en("c") });
  const cites = citationsOf([Kind, Other], [a, b, c], "ontology/ex.ts", "spec", (iri) => iri.replace(EX.iri, "ex:"));
  assertEquals(cites, [
    { term: "ex:a", cites: ["001-demo", "001-demo FR-002"], file: "ontology/ex.ts" },
    { term: "ex:b", cites: [], file: "ontology/ex.ts" },
  ]);
  assertEquals(
    traceFindings(input({ ontology: cites })).map((f) => f.key),
    ["trace/term-uncited ontology/ex.ts ex:b"],
  );
});

proves(["0015-trace FR-001", "0015-trace FR-002"], "a baseline is written sorted, read as a set, and judged both ways", () => {
  const a = finding("trace/no-spec-line", "src/b.ts", 1, "x");
  const b = finding("trace/no-spec-line", "src/a.ts", 1, "y");
  const moved = finding("trace/unknown-spec", "src/c.ts", 40, "z", "065-console");
  assertEquals(moved.key, "trace/unknown-spec src/c.ts 065-console");
  const text = formatBaseline([a, b, a], ["The trace's baseline.", ""]);
  assertEquals(text, "# The trace's baseline.\n#\ntrace/no-spec-line src/a.ts\ntrace/no-spec-line src/b.ts\n");
  assertEquals(parseBaseline("\n# c\n  x  \ny\nx\n"), ["x", "y"]);
  const held = parseBaseline(text);
  assert(passes(judge([a, b], held)));
  const fresh = judge([a, b, moved], held);
  assertEquals(fresh.fresh, [moved]);
  assert(!passes(fresh), "a new finding fails");
  const stale = judge([a], held);
  assertEquals(stale.stale, ["trace/no-spec-line src/a.ts"]);
  assert(!passes(stale), "a baseline entry that no longer occurs fails");
});

proves(["0015-trace FR-003"], "a judgement told as plain lines", () => {
  const a = finding("trace/no-spec-line", "src/a.ts", 1, "it names no requirement");
  const lines = report(judge([a], ["trace/no-spec-line src/gone.ts"]), "trace", "tools/trace.baseline.txt");
  assertEquals(lines, [
    "src/a.ts:1: trace/no-spec-line: it names no requirement",
    'tools/trace.baseline.txt: stale: "trace/no-spec-line src/gone.ts" no longer occurs; delete the line, the baseline only shrinks',
    "trace: FAILED: 1 new, 1 stale, 0 held by tools/trace.baseline.txt",
  ]);
  for (const l of lines) assert(!l.includes("\u001b"), "no colour");
  assertEquals(report(judge([a], [a.key]), "trace", "b.txt"), ["trace: passed: 0 new, 0 stale, 1 held by b.txt"]);
});

const LADDER: Ladder = [
  { number: 0, name: "Ontology", homes: ["ontology/", "src/ontology.auto.ts"], mayRelyOn: [] },
  { number: 2, name: "Data", homes: ["src/model/types.ts"], mayRelyOn: [0] },
  { number: 3, name: "Operations", homes: ["src/model/"], mayRelyOn: [0, 2] },
  { number: 4, name: "Infrastructure", homes: ["src/core/"], mayRelyOn: [0, 3] },
  { number: 7, name: "Documentation", homes: ["src/**/mod.ts"], mayRelyOn: [0, 2, 3, 4] },
];

proves(["0015-trace FR-009"], "a path's rung: one path, then a home naming files, then more literal characters; none; a tie", () => {
  const rung = (p: string): string => {
    const x = placeOf(LADDER, p);
    return x.kind === "one" ? String(x.rung.number) : x.kind;
  };
  assertEquals(rung("src/model/types.ts"), "2");
  assertEquals(rung("src/model/load.ts"), "3");
  assertEquals(rung("src/model/mod.ts"), "7");
  assertEquals(rung("src/ontology.auto.ts"), "0");
  assertEquals(rung("ontology/x/y.ts"), "0");
  assertEquals(rung("tools/x.ts"), "none");
  const tie: Ladder = [
    { number: 1, name: "A", homes: ["a/"], mayRelyOn: [] },
    { number: 2, name: "B", homes: ["a/"], mayRelyOn: [] },
  ];
  assertEquals(placeOf(tie, "a/x.ts").kind, "tie");
  assertEquals(
    layerFindings(tie, [{ path: "a/x.ts", text: "" }]).map((f) => f.rule),
    ["layers/ambiguous"],
  );
});

proves(["0015-trace FR-010"], "relative imports of every form, resolved; above and around found; same rung and packages not", () => {
  const text = [
    'import { a } from "./a.ts";',
    'import type { T } from "../model/types.ts";',
    "import {",
    "  b,",
    '} from "../model/load.ts";',
    'export * from "./c.ts";',
    'import "./side.ts";',
    'const m = await import("../model/mod.ts");',
    'import { kernel } from "@intellectual-frontiers/commons/ts/kernel";',
    '// import { no } from "./comment.ts";',
  ].join("\n");
  assertEquals(
    importsOf(text).map((i) => `${i.line} ${i.specifier}`),
    ["1 ./a.ts", "2 ../model/types.ts", "5 ../model/load.ts", "6 ./c.ts", "7 ./side.ts", "8 ../model/mod.ts"],
  );
  assertEquals(resolveImport("src/core/ui.ts", "../model/types.ts"), "src/model/types.ts");
  const files: SourceFile[] = [
    { path: "src/core/ui.ts", text },
    { path: "src/core/a.ts", text: 'import { o } from "../ontology.auto.ts";\n' },
    { path: "ontology/x.ts", text: 'import { u } from "../src/core/ui.ts";\n' },
    { path: "tools/y.ts", text: "" },
  ];
  assertEquals(
    layerFindings(LADDER, files).map((f) => f.key),
    [
      "layers/around src/core/ui.ts -> src/model/types.ts",
      "layers/above src/core/ui.ts -> src/model/mod.ts",
      "layers/above ontology/x.ts -> src/core/ui.ts",
      "layers/unclassified tools/y.ts",
    ],
  );
  const around = layerFindings(LADDER, files)[0];
  assertEquals(around?.line, 2);
  assertEquals(
    around?.message,
    "rung 4 (Infrastructure) imports src/model/types.ts, on rung 2 (Data), which it may not rely on (it relies on 0, 3)",
  );
});
