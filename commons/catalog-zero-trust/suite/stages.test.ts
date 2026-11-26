/**
 * Tests of the stages (commons catalog-zero-trust 0003-zero-trust-stages FR-001 to FR-005): the thresholds as data and their order, the stage computed from indicators and the ages of their readings (unmeasured, traditional and the three stages that a reading can show), the stage
 * that does not fall when a reading is made or refreshed, and the statement that goes with a computed stage.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import fc from "fast-check";
import { COMPUTED_BY, THRESHOLDS } from "../src/governance/mod.ts";
import { RISING, stageOf, type Indicator, type Stage } from "../src/logical/mod.ts";

const RANK: Record<Stage | "unmeasured", number> = { unmeasured: 0, traditional: 1, initial: 2, advanced: 3, optimal: 4 };

proves(["0003-zero-trust-stages FR-001", "0003-zero-trust-stages FR-002"], "the thresholds are data for the three stages that a reading can show, whole days, and no later stage asks less than an earlier one", () => {
  assertEquals(Object.keys(THRESHOLDS), ["initial", "advanced", "optimal"]);
  let before = { coverage: 0, maxAgeDays: Number.POSITIVE_INFINITY };
  for (const stage of RISING) {
    const t = THRESHOLDS[stage];
    assert(Number.isInteger(t.maxAgeDays) && t.maxAgeDays > 0, `${stage} age is a positive whole number of days`);
    assert(t.coverage > 0 && t.coverage <= 1, `${stage} coverage is a share`);
    assert(t.coverage >= before.coverage && t.maxAgeDays <= before.maxAgeDays, `${stage} asks no less than the stage before`);
    before = t;
  }
});

proves(["0003-zero-trust-stages FR-003"], "no reading is unmeasured and never traditional, some reading is at least traditional, and the stage is the highest whose limits hold with an indicator of its own", () => {
  assertEquals(stageOf([], THRESHOLDS), "unmeasured");
  assertEquals(stageOf([{ stage: "initial", ageDays: undefined }], THRESHOLDS), "unmeasured");
  assertEquals(stageOf([{ stage: "initial", ageDays: 3 }], THRESHOLDS), "initial");
  assertEquals(stageOf([{ stage: "initial", ageDays: 200 }], THRESHOLDS), "traditional");
  assertEquals(stageOf([{ stage: "initial", ageDays: 5 }, { stage: "advanced", ageDays: 20 }], THRESHOLDS), "advanced");
  assertEquals(stageOf([{ stage: "initial", ageDays: 5 }, { stage: "advanced", ageDays: 40 }], THRESHOLDS), "initial");
  assertEquals(stageOf([{ stage: "initial", ageDays: 5 }, { stage: "advanced", ageDays: 2 }, { stage: "optimal", ageDays: 6 }], THRESHOLDS), "optimal");
  assertEquals(stageOf([{ stage: "initial", ageDays: 5 }, { stage: "advanced", ageDays: 2 }, { stage: "optimal", ageDays: 8 }], THRESHOLDS), "advanced");
  assertEquals(stageOf([{ stage: "initial", ageDays: 5 }, { stage: "optimal", ageDays: 1 }], THRESHOLDS), "initial");
  assertEquals(stageOf([{ stage: "initial", ageDays: -1 }, { stage: "advanced", ageDays: 1 }], THRESHOLDS), "traditional");
  assertEquals(stageOf([{ stage: "initial", ageDays: 5 }, { stage: "initial", ageDays: undefined }], THRESHOLDS), "traditional");
});

const indicator: fc.Arbitrary<Indicator> = fc.record({ stage: fc.constantFrom(...RISING), ageDays: fc.option(fc.integer({ min: 0, max: 400 }), { nil: undefined }) });

proves(["0003-zero-trust-stages FR-004"], "a reading that is made, or replaced by a younger one, never lowers the stage", () => {
  fc.assert(
    fc.property(fc.array(indicator, { maxLength: 12 }), fc.nat({ max: 11 }), fc.integer({ min: 0, max: 400 }), (indicators, at, age) => {
      if (indicators.length === 0) return true;
      const i = at % indicators.length;
      const current = indicators[i] as Indicator;
      const younger = Math.min(age, current.ageDays ?? age);
      const refreshed = indicators.map((x, k) => (k === i ? { stage: x.stage, ageDays: younger } : x));
      return RANK[stageOf(refreshed, THRESHOLDS)] >= RANK[stageOf(indicators, THRESHOLDS)];
    }),
    { numRuns: 300 },
  );
});

proves(["0003-zero-trust-stages FR-005"], "a computed stage comes with the statement that the thresholds are the catalog's and not the model's", () => {
  assert(/ours/.test(COMPUTED_BY) && /not the model's/.test(COMPUTED_BY));
});
