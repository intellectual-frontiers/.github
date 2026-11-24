/**
 * Tests of `src/ci-timing.ts` (docs 0001-docs FR-047): the median and the 90th percentile of the wall time of the runs that passed, the slowest jobs with their slowest step, and the workflows over
 * their target as findings; a run that did not pass, and a workflow with no timed run, are not counted.
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import type { WorkflowRuns } from "../src/evidence.ts";
import { median, overTarget, p90, timeOf } from "../src/ci-timing.ts";

const run = (id: number, seconds: number, conclusion: string) => ({
  id,
  number: id,
  event: "push",
  status: "completed",
  conclusion,
  sha: "",
  title: "",
  url: "",
  createdAt: "2026-11-24T00:00:00Z",
  startedAt: "2026-11-24T00:00:00Z",
  updatedAt: new Date(Date.parse("2026-11-24T00:00:00Z") + seconds * 1000).toISOString(),
});

const workflow = (name: string, seconds: readonly number[]): WorkflowRuns => ({
  name,
  path: `.github/workflows/${name}.auto.yml`,
  runs: [...seconds.map((s, i) => run(i + 1, s, "success")), run(99, 5000, "failure")] as unknown as WorkflowRuns["runs"],
  failed: [],
  timing: [
    { run: 1, jobs: [{ name: "verify (data 1/4)", seconds: 100, steps: [{ name: "verify", seconds: 90 }] }, { name: "plan", seconds: 10, steps: [{ name: "plan", seconds: 8 }] }] },
    { run: 2, jobs: [{ name: "verify (data 1/4)", seconds: 140, steps: [{ name: "The tests on Node 26", seconds: 120 }] }, { name: "plan", seconds: 12, steps: [] }] },
  ],
});

proves(["0001-docs FR-047"], "the median and the 90th percentile are the nearest ranks, and 0 where there is no number", () => {
  assertEquals(median([]), 0);
  assertEquals(p90([]), 0);
  assertEquals(median([5, 1, 3]), 3);
  assertEquals(median([4, 1, 3, 2]), 2);
  assertEquals(p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 9);
  assertEquals(p90([7]), 7);
});

proves(["0001-docs FR-047"], "a workflow's time counts its runs that passed only, and its jobs are the slowest first with their slowest step", () => {
  const t = timeOf(workflow("ci", [200, 400, 300]));
  assertEquals(t.runs, 3);
  assertEquals(t.medianSeconds, 300);
  assertEquals(t.p90Seconds, 400);
  assertEquals(t.jobs.map((j) => j.name), ["verify (data 1/4)", "plan"]);
  assertEquals(t.jobs[0]?.medianSeconds, 100);
  assertEquals(t.jobs[0]?.p90Seconds, 140);
  assertEquals(t.jobs[0]?.slowestStep, "The tests on Node 26");
});

proves(["0001-docs FR-047"], "a workflow over its target is named as a finding, one within it or never run is not, and nothing fails", () => {
  const times = [timeOf(workflow("ci", [600, 700, 650])), timeOf(workflow("tests", [60, 70])), timeOf({ ...workflow("site", []), runs: [] })];
  assertEquals(overTarget(times), [{ workflow: "ci", medianSeconds: 650, targetSeconds: 300 }]);
  assertEquals(overTarget([], undefined), []);
});
