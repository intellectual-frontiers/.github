/**
 * Test of the table of the controls of an assurance profile (commons desired-os-state 0002-desired-os-state-governance FR-009): each control is held by workload or by Desired OS State, once, with the reason.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { CONTROL_MAPPING, CONTROL_NAMES } from "../src/mod.ts";

proves(["0002-desired-os-state-governance FR-009"], "every control of a profile is held by workload or by Desired OS State, once, with the reason, and only planHash is workload's", () => {
  assertEquals([...CONTROL_MAPPING.map((m) => m.control)].sort(), [...CONTROL_NAMES].sort());
  assertEquals(CONTROL_MAPPING.filter((m) => m.where === "workload").map((m) => m.control), ["planHash"]);
  for (const m of CONTROL_MAPPING) assert(m.because.length > 20, m.control);
});
