/**
 * The selection of the versions a registry no longer needs (commons 0001-libraries FR-033): the order of the numbers and not of the text, the newest kept, a version that is not plain left alone, every refusal, and the program that reads a listing and
 * prints a plan and deletes nothing.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { workflows } from "../src/workflows/definitions.ts";
import { parseListing, planClean } from "../src/registry-clean.ts";

const SPEC = "0001-libraries";
const v = (id: number, name: string) => ({ id, name });
const REAL = [v(1, "0.2.0"), v(2, "0.2.2"), v(3, "0.3.0"), v(4, "0.4.0"), v(5, "0.4.1"), v(6, "0.4.2")];

proves([`${SPEC} FR-033`], "the newest are kept and the others are to be deleted, in the order of the numbers and never of the text", () => {
  const r = planClean([v(1, "0.9.0"), v(2, "0.10.0"), v(3, "0.1.0"), v(4, "1.0.0")], 2);
  assert(r.kind === "ok");
  assertEquals(r.value.keep.map((x) => x.name), ["1.0.0", "0.10.0"]);
  assertEquals(r.value.delete.map((x) => x.name), ["0.9.0", "0.1.0"]);
  const real = planClean(REAL, 1);
  assert(real.kind === "ok");
  assertEquals(real.value.delete.map((x) => x.name), ["0.4.1", "0.4.0", "0.3.0", "0.2.2", "0.2.0"]);
  const two = planClean(REAL, 2);
  assert(two.kind === "ok");
  assertEquals(two.value.keep.map((x) => x.name), ["0.4.2", "0.4.1"]);
});

proves([`${SPEC} FR-033`], "a version that is not plain is never selected, and the newest plain one is kept", () => {
  const r = planClean([v(1, "0.4.0"), v(2, "0.5.0-beta.1"), v(3, "next"), v(4, "0.4.1")], 1);
  assert(r.kind === "ok");
  assertEquals(r.value.delete.map((x) => x.name), ["0.4.0"]);
  assertEquals(r.value.notPlain.map((x) => x.name).sort(), ["0.5.0-beta.1", "next"]);
  assertEquals(r.value.keep.map((x) => x.name), ["0.4.1"]);
  assertEquals(planClean([v(1, "next"), v(2, "0.5.0-rc.1")], 1).kind, "err");
});

proves([`${SPEC} FR-033`], "every refusal: keep below 1 or not whole, an empty listing, a name twice, a bad identifier; and the whole registry is never selected", () => {
  for (const k of [0, -1, 1.5, Number.NaN]) assertEquals(planClean(REAL, k).kind, "err", `keep ${k}`);
  assertEquals(planClean([], 1).kind, "err");
  assertEquals(planClean([v(1, "0.1.0"), v(2, "0.1.0")], 1).kind, "err");
  assertEquals(planClean([v(0, "0.1.0")], 1).kind, "err");
  const only = planClean([v(1, "0.1.0")], 1);
  assert(only.kind === "ok");
  assertEquals(only.value.delete.length, 0, "the only version is never deleted");
  const many = planClean(REAL, 50);
  assert(many.kind === "ok");
  assertEquals(many.value.delete.length, 0, "fewer versions than keep: nothing is deleted");
});

proves([`${SPEC} FR-033`], "the listing is read as lines of JSON and the first line that is not one is named", () => {
  const ok1 = parseListing('{"id":1,"name":"0.1.0"}\n\n{"id":2,"name":"0.2.0"}\n');
  assert(ok1.kind === "ok");
  assertEquals(ok1.value.length, 2);
  for (const bad of ["not json", "[1]", '{"id":"1","name":"0.1.0"}', '{"id":1}']) assertEquals(parseListing(bad).kind, "err", bad);
});

proves([`${SPEC} FR-033`], "the program prints a plan with the identifiers to delete and deletes nothing, and ends 2 for a listing it cannot plan", () => {
  const lines = REAL.map((x) => JSON.stringify(x)).join("\n");
  const r = spawnSync("bun", ["src/registry-clean.ts", "--keep", "2"], { input: lines, encoding: "utf8" });
  assertEquals(r.status, 0, r.stderr);
  assert(r.stdout.includes("keep    0.4.2") && r.stdout.includes("delete  0.2.0"), r.stdout);
  const last = r.stdout.trim().split("\n").pop() ?? "";
  assertEquals(JSON.parse(last), { delete: [4, 3, 2, 1] });
  assertEquals(spawnSync("bun", ["src/registry-clean.ts", "--keep", "0"], { input: lines, encoding: "utf8" }).status, 2);
  assertEquals(spawnSync("bun", ["src/registry-clean.ts"], { input: "", encoding: "utf8" }).status, 2);
});

proves(["0030-generated-workflows FR-012"], "the maintenance workflow is by hand only, its jobs hold the narrowest permissions, its inputs reach the scripts by env and its steps are of the gate maintenance", () => {
  const w = workflows().find((x) => x.file === "maintenance");
  assert(w !== undefined);
  assert(typeof w.on.workflowDispatch === "object" && w.on.push === undefined && w.on.pullRequest === undefined && w.on.schedule === undefined);
  assertEquals(w.permissions, { contents: "read" });
  assertEquals(w.jobs["package-clean"]?.permissions, { contents: "read", packages: "write" });
  assertEquals(w.jobs["tag"]?.permissions, { contents: "write" });
  for (const j of Object.values(w.jobs))
    for (const st of j.steps) {
      if (st.kind !== "run") continue;
      assert(!st.run.includes("${{"), "no expression in a script");
      assertEquals(st.policy?.kind, "gate");
    }
});
