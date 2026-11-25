/**
 * Tests of `src/guide-model.ts`: each kind of step decoded, and every refusal of the decoder with the path of the field
 * (commons 0002-guide FR-001).
 *
 * @module
 */
import { decodeStep } from "../src/guide.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const FR = "0002-guide FR-001";

const base = { id: "synthetic-step-01", summary: "Choose a folder", say: "Pick where the work goes." };
const field = { field: "folder", prompt: "Which folder?", hint: "a path" };

proves([FR], "each of the five kinds decodes, with only the fields it has", () => {
  const cases: readonly unknown[] = [
    { ...base, kind: "question", ask: [field] },
    { ...base, kind: "run", verb: { id: "synthetic-verb-01", inputs: { dry: true, names: ["a", "b"] } } },
    { ...base, kind: "human", gate: { who: "person" } },
    { ...base, kind: "human", gate: { who: "person" }, ask: [field] },
    { ...base, kind: "wait" },
    { ...base, kind: "done", evidence: ["synthetic-evidence-01"] },
  ];
  for (const c of cases) {
    const r = decodeStep(c);
    assert(r.kind === "ok", JSON.stringify(c));
    assertEquals(JSON.parse(JSON.stringify(r.value)), c);
  }
});

proves([FR], "a field not declared for the kind is refused with its path, never dropped", () => {
  const bad: readonly (readonly [unknown, string])[] = [
    [{ ...base, kind: "done", colour: "red" }, "$.colour"],
    [{ ...base, kind: "wait", ask: [field] }, "$.ask"],
    [{ ...base, kind: "done", verb: { id: "x", inputs: {} } }, "$.verb"],
    [{ ...base, kind: "question", ask: [field], gate: { who: "person" } }, "$.gate"],
    [{ ...base, kind: "run", verb: { id: "x", inputs: {}, extra: 1 } }, "$.verb.extra"],
    [{ ...base, kind: "question", ask: [{ ...field, default: "x" }] }, "$.ask[0].default"],
    [{ ...base, kind: "human", gate: { who: "person", how: "x" } }, "$.gate.how"],
  ];
  for (const [input, path] of bad) {
    const r = decodeStep(input);
    assert(r.kind === "err", JSON.stringify(input));
    assertEquals(r.error.path, path);
    assertStringIncludes(r.error.expected, "no such field");
  }
});

proves([FR], "an unknown kind, a missing field and a field of the wrong type are refused with the path", () => {
  const bad: readonly (readonly [unknown, string])[] = [
    [{ ...base, kind: "dance" }, "$.kind"],
    [{ ...base }, "$.kind"],
    ["done", "$"],
    [null, "$"],
    [[], "$"],
    [{ kind: "done", summary: "x", say: "" }, "$.id"],
    [{ id: "a", kind: "done", say: "" }, "$.summary"],
    [{ id: "a", kind: "done", summary: "x" }, "$.say"],
    [{ ...base, id: "", kind: "done" }, "$.id"],
    [{ ...base, kind: "done", summary: 3 }, "$.summary"],
    [{ ...base, kind: "done", evidence: "one" }, "$.evidence"],
    [{ ...base, kind: "done", evidence: [1] }, "$.evidence[0]"],
    [{ ...base, kind: "question" }, "$.ask"],
    [{ ...base, kind: "question", ask: [] }, "$.ask"],
    [{ ...base, kind: "question", ask: [{ ...field, secret: "yes" }] }, "$.ask[0].secret"],
    [{ ...base, kind: "question", ask: [{ ...field }, { ...field }] }, "$.ask[1].field"],
    [{ ...base, kind: "question", ask: [{ field: "a", prompt: "p" }] }, "$.ask[0].hint"],
    [{ ...base, kind: "run" }, "$.verb"],
    [{ ...base, kind: "run", verb: { id: "x" } }, "$.verb.inputs"],
    [{ ...base, kind: "run", verb: { id: "x", inputs: [] } }, "$.verb.inputs"],
    [{ ...base, kind: "human" }, "$.gate"],
    [{ ...base, kind: "human", gate: { who: "agent" } }, "$.gate.who"],
  ];
  for (const [input, path] of bad) {
    const r = decodeStep(input);
    assert(r.kind === "err", JSON.stringify(input));
    assertEquals(r.error.path, path, JSON.stringify(input));
  }
});

proves([FR], "a field marked secret decodes, so that the driver can refuse it with the step", () => {
  const r = decodeStep({ ...base, kind: "question", ask: [{ ...field, secret: true }] });
  assert(r.kind === "ok" && r.value.kind === "question" && r.value.ask[0].secret === true);
});
