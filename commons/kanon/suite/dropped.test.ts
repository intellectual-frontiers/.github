/**
 * Tests of the check that nothing is silently dropped (commons kanon 0001-kanon-checker FR-005): each annotation of Governance ends expressed, carried or named unexpressed.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { type Disposition, droppedFindings, type ElementId, type LayeredModel, parseElementId } from "../src/mod.ts";

function id(text: string): ElementId {
  const r = parseElementId(text);
  assert(r.kind === "ok", text);
  return r.value;
}

function model(dispositions: readonly Disposition[]): LayeredModel {
  return {
    name: "demo",
    library: "demo",
    title: "Demo",
    summary: "A model.",
    layers: [
      { id: "governance", title: "Governance", summary: "What it is.", kinds: ["action"] },
      { id: "logical", title: "Logical", summary: "Made from it.", kinds: ["verb"] },
    ],
    elements: [
      {
        id: id("headless:demo/run"),
        layer: "governance",
        kind: "action",
        name: "run",
        definition: "Runs.",
        source: { file: "src/governance/run.ts", line: 3 },
        properties: { effect: "write", audience: "operator" },
      },
      {
        id: id("cli:demo run"),
        layer: "logical",
        kind: "verb",
        name: "run",
        definition: "Runs.",
        source: { file: "src/logical/run.ts", line: 9 },
        properties: {},
      },
    ],
    trace: [{ from: id("headless:demo/run"), to: id("cli:demo run"), how: "projects to" }],
    findings: [],
    dispositions,
    instances: [],
  };
}

proves(["0001-kanon-checker FR-005"], "an annotation that nothing accounts for is kanon/dropped, named by element and annotation", () => {
  const found = droppedFindings(
    model([{ element: id("headless:demo/run"), annotation: "effect", outcome: "expressed", target: id("cli:demo run") }]),
  );
  assertEquals(
    found.map((f) => f.key),
    ["kanon/dropped src/governance/run.ts headless:demo/run audience"],
  );
  assertEquals(found[0]?.line, 3);
});

proves(["0001-kanon-checker FR-005"], "carried, expressed and unexpressed with a reason each account for an annotation", () => {
  assertEquals(
    droppedFindings(
      model([
        { element: id("headless:demo/run"), annotation: "effect", outcome: "carried", target: id("cli:demo run") },
        { element: id("headless:demo/run"), annotation: "audience", outcome: "unexpressed", reason: "no surface enforces audiences yet" },
      ]),
    ),
    [],
  );
});

proves(["0001-kanon-checker FR-005"], "a target that is no element, and an unexpressed annotation with no reason, are findings", () => {
  const found = droppedFindings(
    model([
      { element: id("headless:demo/run"), annotation: "effect", outcome: "expressed", target: id("cli:demo gone") },
      { element: id("headless:demo/run"), annotation: "audience", outcome: "unexpressed", reason: " " },
    ]),
  );
  assertEquals(found.length, 2);
});

proves(["0001-kanon-checker FR-005"], "a model with no layers has no finding", () => {
  assertEquals(droppedFindings({ ...model([]), layers: [] }), []);
});
