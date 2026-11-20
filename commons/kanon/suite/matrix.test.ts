/**
 * Tests of the check of dropped annotations per instance and of the matrix of requirement by instance (commons kanon 0001-kanon-checker FR-013, FR-014): the fixture host's matrix is as the Markdown
 * and the JSON say, a dropped cell is exactly a `kanon/dropped` finding, and that holds for any set of dispositions.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { buildMatrix, type Disposition, droppedFindings, matrixJson, matrixMarkdown, matrixTotals, parseInstanceName } from "../src/mod.ts";
import { ANSIBLE_NAME, DISPOSITIONS, DSC_NAME, DSC_RESOURCE, model, PLAY, SSH_KEYS } from "./fixtures/fleet.ts";

proves(["0001-kanon-checker FR-013"], "the fixture model accounts for every annotation in each dialect", () => {
  assertEquals(droppedFindings(model()), []);
});

proves(["0001-kanon-checker FR-013"], "an annotation accounted for in one dialect and not the other is kanon/dropped naming the other", () => {
  const only = DISPOSITIONS.filter((d) => !(d.instance === DSC_NAME && d.annotation === "audit"));
  const found = droppedFindings(model(only));
  assertEquals(found.map((f) => f.rule), ["kanon/dropped"]);
  assertStringIncludes(found[0]?.message ?? "", "for the instance dsc");
  assertStringIncludes(found[0]?.key ?? "", "@dsc");
});

proves(["0001-kanon-checker FR-013"], "a disposition for no instance holds for every instance, and one for an instance wins over it", () => {
  const all: readonly Disposition[] = [
    { element: SSH_KEYS, annotation: "effect", outcome: "unexpressed", reason: "no dialect enforces it yet" },
    { element: SSH_KEYS, annotation: "audit", outcome: "carried", target: PLAY, instance: ANSIBLE_NAME },
    { element: SSH_KEYS, annotation: "audit", outcome: "unexpressed", reason: "none", instance: DSC_NAME },
  ];
  assertEquals(droppedFindings(model(all)), []);
  const m = buildMatrix(model(all));
  assertEquals(m.rows[0]?.cells.map((c) => c.cell.outcome), ["unexpressed", "unexpressed"]);
  assertEquals(m.rows[1]?.cells.map((c) => c.cell.outcome), ["carried", "unexpressed"]);
});

proves(["0001-kanon-checker FR-013"], "a target that belongs to another instance, a missing target, an empty reason and an unknown instance are findings", () => {
  const wrong: Disposition[] = [
    { element: SSH_KEYS, annotation: "effect", outcome: "expressed", target: DSC_RESOURCE, instance: ANSIBLE_NAME },
    { element: SSH_KEYS, annotation: "audit", outcome: "unexpressed", reason: " ", instance: ANSIBLE_NAME },
  ];
  const rest = DISPOSITIONS.filter((d) => d.instance === DSC_NAME);
  assertEquals(droppedFindings(model([...wrong, ...rest])).length, 2);
  const named = parseInstanceName("ghost");
  assert(named.kind === "ok");
  const ghost: Disposition = { element: SSH_KEYS, annotation: "effect", outcome: "unexpressed", reason: "because", instance: named.value };
  assert(droppedFindings(model([...DISPOSITIONS, ghost])).some((f) => f.message.includes("no instance of the model")));
});

proves(["0001-kanon-checker FR-014"], "the matrix of the fixture is a row for each annotation and a cell for each dialect", () => {
  const m = buildMatrix(model());
  assertEquals(m.instances, [ANSIBLE_NAME, DSC_NAME]);
  assertEquals(
    m.rows.map((r) => [r.annotation, ...r.cells.map((c) => c.cell.outcome)]),
    [
      ["effect", "expressed", "expressed"],
      ["audit", "carried", "unexpressed"],
    ],
  );
  assertEquals(matrixTotals(m), { expressed: 2, carried: 1, unexpressed: 1, dropped: 0 });
});

proves(["0001-kanon-checker FR-014"], "the matrix is rendered as a Markdown table and as JSON that reads back as the matrix", () => {
  const m = buildMatrix(model());
  assertEquals(
    matrixMarkdown(m),
    [
      "| Requirement | Annotation | ansible | dsc |",
      "| --- | --- | --- | --- |",
      "| Admin SSH keys (governance:ssh-keys) | effect | expressed (ansible:authorized-keys) | expressed (dsc:ssh-keys) |",
      "| Admin SSH keys (governance:ssh-keys) | audit | carried (ansible:authorized-keys) | unexpressed: DSC has no audit trail for a file resource |",
      "",
      "2 expressed, 1 carried, 1 unexpressed, 0 dropped",
      "",
    ].join("\n"),
  );
  assertEquals(JSON.parse(matrixJson(m)), JSON.parse(JSON.stringify(m)));
  assert(matrixJson(m).endsWith("\n"));
});

proves(["0001-kanon-checker FR-013", "0001-kanon-checker FR-014"], "for any dispositions, the dropped cells of the matrix are the findings of the check", () => {
  const outcome = fc.constantFrom("expressed", "carried", "unexpressed", "none");
  const pick = fc.record({
    annotation: fc.constantFrom("effect", "audit"),
    instance: fc.constantFrom(ANSIBLE_NAME, DSC_NAME, undefined),
    outcome,
    good: fc.boolean(),
  });
  fc.assert(
    fc.property(fc.array(pick, { maxLength: 8 }), (picks) => {
      const ds: Disposition[] = [];
      for (const p of picks) {
        const base = { element: SSH_KEYS, annotation: p.annotation, ...(p.instance === undefined ? {} : { instance: p.instance }) };
        const target = p.instance === DSC_NAME ? DSC_RESOURCE : PLAY;
        if (p.outcome === "expressed" || p.outcome === "carried") ds.push({ ...base, outcome: p.outcome, target });
        else if (p.outcome === "unexpressed") ds.push({ ...base, outcome: "unexpressed", reason: p.good ? "because" : "" });
      }
      const m = buildMatrix(model(ds));
      assertEquals(m.rows.length * m.instances.length, matrixTotals(m).expressed + matrixTotals(m).carried + matrixTotals(m).unexpressed + matrixTotals(m).dropped);
      assertEquals(matrixTotals(m).dropped, droppedFindings(model(ds)).length);
      assertEquals(matrixMarkdown(m).split("\n").length, m.rows.length + 5);
    }),
  );
});

proves(["0001-kanon-checker FR-014"], "a model with no instances has a matrix with no columns, and the check is the one of FR-005", () => {
  const bare = { ...model([]), instances: [] };
  const m = buildMatrix(bare);
  assertEquals(m.instances, []);
  assertEquals(m.rows.map((r) => r.cells.length), [0, 0]);
  assertEquals(droppedFindings(bare).length, 2);
});
