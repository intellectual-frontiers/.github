/**
 * Tests of the policy gate (commons gate 0002-policy-gate FR-001 to FR-008): what a change touches, the kinds a rule applies to and a rule that throws, waivers that are live, ended or malformed, the verdict and its order, the builders and the baseline on subjects that break and keep each rule, the same answer
 * every time, and the SARIF document with its suppressions.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { Rule, Subject, Waiver } from "../src/governance/mod.ts";
import { BASELINE, evaluate, forbid, oneOf, require, toSarif, touched, waiverProblems } from "../src/logical/mod.ts";

const NOW = "2026-11-21T12:00:00Z";
const db = (o: Record<string, never> | Subject["attributes"] = {}): Subject => ({ id: "aws_db.main", kind: "cloud-resource", attributes: { owner: "ops", "encrypted-at-rest": true, "ingress-cidrs": ["0.0.0.0/0"], "ingress-ports": ["5432"], ...o } });

proves(["0002-policy-gate FR-001", "0002-policy-gate FR-002"], "only what a change adds or alters is checked: not what is removed or left as it was", () => {
  const same = db();
  const changed = db({ "encrypted-at-rest": false });
  assertEquals(touched({ before: [same], after: [same] }), []);
  assertEquals(touched({ before: [same], after: [] }), []);
  assertEquals(touched({ before: [], after: [same] }).map((s) => s.id), ["aws_db.main"]);
  assertEquals(touched({ before: [same], after: [changed] }).length, 1);
  assertEquals(touched({ before: [{ ...same, kind: "x" }], after: [same] }).length, 1, "a changed kind is a change");
  assertEquals(touched({ before: [{ id: "a", kind: "k", attributes: { x: 1, y: 2 } }], after: [{ id: "a", kind: "k", attributes: { y: 2, x: 1 } }] }), [], "the order of attributes is no change");
});

proves(["0002-policy-gate FR-003", "0002-policy-gate FR-005", "0002-policy-gate FR-007"], "a rule applies to its kinds, a rule that throws is a violation, the verdict passes only where nothing blocks, and lists are in a stable order", () => {
  const onlyApps = require({ id: "r-app", title: "App has a team", kinds: ["application"] }, "team", (v) => v === "x", "x");
  const boom: Rule = { id: "boom", title: "Throws", severity: "block", check: () => { throw new Error("bad rule"); } };
  const warn = forbid({ id: "w", title: "Warns", severity: "warn" }, "legacy", (v) => v === true, "is legacy");
  const v = evaluate({ before: [], after: [db({ legacy: true })] }, [onlyApps, warn], [], NOW);
  assert(v.pass && v.blocking.length === 0 && v.warnings.length === 1, "a warning does not stop a change");
  assertEquals(v.checked, 1);
  const t = evaluate({ before: [], after: [db()] }, [boom], [], NOW);
  assert(!t.pass && t.blocking[0]?.message.includes("could not be evaluated: bad rule"));
  const two = evaluate({ before: [], after: [db({ "ingress-ports": ["22", "3389"] })] }, BASELINE, [], NOW);
  assert(!two.pass);
  assertEquals(two.blocking.map((x) => x.rule), [...two.blocking.map((x) => x.rule)].sort());
  assertEquals(evaluate({ before: [], after: [db()] }, BASELINE, [], NOW), evaluate({ before: [], after: [db()] }, BASELINE, [], NOW));
  assert(evaluate({ before: [], after: [] }, BASELINE, [], NOW).pass);
});

const W: Waiver = { rule: "no-open-admin-port", subject: "aws_db.main", reason: "Fronted by a bastion until the migration.", by: "owner", until: "2026-11-22T00:00:00Z" };

proves(["0002-policy-gate FR-004"], "a live waiver lets a violation through and is listed, an ended or malformed one does not count, and a waiver nothing needed is unused", () => {
  const change = { before: [], after: [db()] };
  const waived = evaluate(change, BASELINE, [W], NOW);
  assert(waived.pass, JSON.stringify(waived.blocking));
  assertEquals(waived.waived.map((x) => [x.rule, x.waived?.by]), [["no-open-admin-port", "owner"]]);
  assertEquals(waived.unusedWaivers, []);
  const ended = evaluate(change, BASELINE, [W], "2026-11-22T00:00:00Z");
  assert(!ended.pass && ended.unusedWaivers.length === 1, "a waiver that ends on the instant does not count");
  assert(!evaluate(change, BASELINE, [{ ...W, reason: " " }], NOW).pass);
  assert(!evaluate(change, BASELINE, [{ ...W, by: "" }], NOW).pass);
  assert(!evaluate(change, BASELINE, [{ ...W, until: "tomorrow" }], NOW).pass);
  assertEquals(waiverProblems([{ ...W, reason: "", by: "", until: "x" }]).length, 3);
  assertEquals(evaluate(change, BASELINE, [{ ...W, subject: "other" }], NOW).unusedWaivers.length, 1);
  assertEquals(evaluate(change, BASELINE, [{ ...W, rule: "other" }], NOW).pass, false);
});

proves(["0002-policy-gate FR-006"], "the builders make rules of an attribute and the baseline breaks and keeps each of its rules as it says", () => {
  const r = require({ id: "r", title: "t" }, "a", (v) => v === 1, "1");
  assertEquals(r.check({ id: "s", kind: "k", attributes: {} }).map((p) => p.message), ["is missing (expected 1)"]);
  assertEquals(r.check({ id: "s", kind: "k", attributes: { a: 2 } }).map((p) => p.message), ["is 2 (expected 1)"]);
  assertEquals(r.check({ id: "s", kind: "k", attributes: { a: 1 } }), []);
  assertEquals(forbid({ id: "f", title: "t" }, "a", (v) => v === 1, "no").check({ id: "s", kind: "k", attributes: {} }), []);
  const o = oneOf({ id: "o", title: "t" }, "tier", ["gold", "silver"]);
  assertEquals(o.check({ id: "s", kind: "k", attributes: { tier: "gold" } }), []);
  assertEquals(o.check({ id: "s", kind: "k", attributes: { tier: "tin" } }).length, 1);
  const run = (s: Subject): string[] => evaluate({ before: [], after: [s] }, BASELINE, [], NOW).blocking.map((x) => x.rule);
  const fine = db({ "ingress-cidrs": ["10.0.0.0/8"], image: "app:1.2" });
  assertEquals(run(fine), []);
  assert(run(db({ "ingress-cidrs": ["::/0"] })).includes("no-open-admin-port"));
  assertEquals(run(db({ "ingress-ports": ["443"] })), [], "a web port open to the world is not administrative");
  assert(run(db({ "encrypted-at-rest": false })).includes("storage-encrypted"));
  assert(run({ id: "e", kind: "endpoint", attributes: { "allows-cleartext": true, owner: "x" } }).includes("no-cleartext"));
  assert(run(db({ image: "app:latest" })).includes("image-pinned") && run(db({ image: "app" })).includes("image-pinned"));
  assertEquals(run(db({ image: "app@sha256:abc", "ingress-cidrs": [] })), []);
  const warns = (s: Subject): string[] => evaluate({ before: [], after: [s] }, BASELINE, [], NOW).warnings.map((x) => x.rule);
  assert(warns({ id: "c", kind: "certificate", attributes: { "days-to-expiry": 12, owner: "x" } }).includes("certificate-not-near-end"));
  assertEquals(warns({ id: "c", kind: "certificate", attributes: { "days-to-expiry": 90, owner: "x" } }), []);
  assert(warns({ id: "n", kind: "application", attributes: {} }).includes("has-owner"));
  assert(BASELINE.every((x) => (x.controls ?? []).length > 0));
});

proves(["0002-policy-gate FR-008"], "the verdict is SARIF 2.1.0 with an error or a warning for each violation and a suppression for a waived one", () => {
  const v = evaluate({ before: [], after: [db(), { id: "n", kind: "application", attributes: {} }] }, BASELINE, [W], NOW);
  const s = toSarif(v, "opsfolio-gate");
  assertEquals(s.version, "2.1.0");
  const run = s.runs[0] as { tool: { driver: { name: string; rules: { id: string }[] } }; results: { ruleId: string; level: string; suppressions?: { justification: string }[] }[] };
  assertEquals(run.tool.driver.name, "opsfolio-gate");
  assert(run.tool.driver.rules.some((r) => r.id === "has-owner"));
  const owner = run.results.find((r) => r.ruleId === "has-owner");
  assertEquals(owner?.level, "warning");
  const admin = run.results.find((r) => r.ruleId === "no-open-admin-port");
  assert(admin?.suppressions?.[0]?.justification.includes("bastion") === true && admin.level === "error");
  assertEquals(run.results.length, v.blocking.length + v.warnings.length + v.waived.length);
});
