/**
 * Tests of the Logical layer of Archon (commons archon 0003-archon-logical FR-001 to FR-007): the order of a subject from layers and everything that refuses it, the plan between what is
 * observed and the order, its canonical form and digest, and the approvals a plan needs by the assurance of the fleet. Everything is made up: no real host or person is in this file.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  approvalsNeeded,
  buildOrder,
  canonicalPlan,
  changesOf,
  defineRequirement,
  destructiveGate,
  parseRequirementId,
  parseSubjectName,
  planDigest,
  planOrder,
  resolveAssurance,
  type Assurance,
  type JsonValue,
  type Layer,
  type Observed,
  type Order,
  type Requirement,
  type RequirementId,
  type RequirementInput,
  type Subject,
} from "../src/mod.ts";

function subject(name: string, cls: Subject["class"] = "machine"): Subject {
  const n = parseSubjectName(name);
  if (n.kind === "err") throw new Error(n.error);
  return { name: n.value, class: cls };
}

function req(id: string, more: Partial<RequirementInput> = {}): Requirement {
  const r = defineRequirement({ id, summary: `${id}.`, why: ["a made-up reason"], subject: { by: "all" }, kind: "package", desired: { name: id }, change: "additive", ...more });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

function rid(text: string): RequirementId {
  const r = parseRequirementId(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

function assurance(profile: "solo" | "team" | "regulated"): Assurance {
  const r = resolveAssurance(profile);
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

function orderOf(requirements: readonly Requirement[], layer: Layer = "baseline", s: Subject = subject("web-01.example.test")): Order {
  const o = buildOrder({ subject: s, assurance: "solo", layers: [{ layer, requirements }] });
  if (o.kind === "err") throw new Error(JSON.stringify(o.error));
  return o.value;
}

const WEB = subject("web-01.example.test");

/** A value as plain data, so that branded texts compare with the texts they are. */
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

proves(["0003-archon-logical FR-001"], "the order keeps the requirements whose selector matches and whose kind applies, and refuses a requirement twice in a layer", () => {
  const all = req("a.all");
  const mine = req("a.mine", { subject: { by: "names", names: ["web-01.example.test"] } });
  const other = req("a.other", { subject: { by: "names", names: ["db-01.example.test"] } });
  const workstations = req("a.workstations", { subject: { by: "class", class: "workstation" }, desired: { name: "x" } });
  const zone = req("a.zone", { kind: "dns-record", subject: { by: "all" }, desired: { name: "www", type: "A" } });
  const o = orderOf([all, mine, other, workstations, zone]);
  assertEquals(o.requirements.map((r) => r.id), ["a.all", "a.mine"]);
  const twice = buildOrder({ subject: WEB, assurance: "solo", layers: [{ layer: "baseline", requirements: [all, all] }] });
  assert(twice.kind === "err");
  assertEquals(twice.error[0]?.kind, "duplicate");
  const cloud = orderOf([zone], "baseline", subject("example-zone", "cloud-account"));
  assertEquals(cloud.requirements.map((r) => r.id), ["a.zone"]);
});

proves(["0003-archon-logical FR-002"], "a higher layer replaces a lower one, and the order records what was replaced", () => {
  const base = req("a.pkg", { desired: { name: "base" } });
  const host = req("a.pkg", { desired: { name: "host" } });
  const o = buildOrder({ subject: WEB, assurance: "solo", layers: [{ layer: "host", requirements: [host] }, { layer: "baseline", requirements: [base] }] });
  assert(o.kind === "ok");
  assertEquals(o.value.requirements.map((r) => r.desired), [{ name: "host" }]);
  assertEquals(plain(o.value.replaced), [{ id: "a.pkg", was: "baseline", by: "host" }]);
  const fleet = req("a.pkg", { desired: { name: "fleet" } });
  const three = buildOrder({ subject: WEB, assurance: "solo", layers: [{ layer: "fleet", requirements: [fleet] }, { layer: "host", requirements: [host] }, { layer: "baseline", requirements: [base] }] });
  assert(three.kind === "ok");
  assertEquals(three.value.replaced.map((r) => `${r.was}>${r.by}`), ["baseline>fleet", "fleet>host"]);
});

proves(["0003-archon-logical FR-003"], "the order is sequenced after dependencies, and a missing dependency and a cycle are refused", () => {
  const o = orderOf([req("c.app", { dependsOn: ["c.config"] }), req("c.config", { dependsOn: ["c.base"] }), req("c.base")]);
  assertEquals(o.requirements.map((r) => r.id), ["c.base", "c.config", "c.app"]);
  const missing = buildOrder({ subject: WEB, assurance: "solo", layers: [{ layer: "baseline", requirements: [req("c.app", { dependsOn: ["c.nothing"] })] }] });
  assert(missing.kind === "err");
  assertEquals(plain(missing.error), [{ kind: "missing-dependency", id: "c.app", dependsOn: "c.nothing" }]);
  const loop = buildOrder({ subject: WEB, assurance: "solo", layers: [{ layer: "baseline", requirements: [req("c.a", { dependsOn: ["c.b"] }), req("c.b", { dependsOn: ["c.a"] })] }] });
  assert(loop.kind === "err");
  const cycle = loop.error.find((p) => p.kind === "cycle");
  assert(cycle !== undefined && cycle.kind === "cycle" && cycle.ids.includes(rid("c.a")) && cycle.ids.includes(rid("c.b")));
});

proves(["0003-archon-logical FR-004"], "the plan says none, create, update or remove for each requirement, and equal data is the same whatever the order of keys", () => {
  const o = orderOf([
    req("p.keep", { desired: { a: 1, b: 2 } }),
    req("p.new", { desired: { name: "new" } }),
    req("p.change", { desired: { name: "changed" } }),
    req("p.gone", { ensure: "absent", change: "destructive", rollback: "restore-from-backup", desired: null }),
    req("p.already-gone", { ensure: "absent", change: "destructive", rollback: "reversible", desired: null }),
  ]);
  const observed: Observed = new Map<RequirementId, JsonValue>([
    [rid("p.keep"), { b: 2, a: 1 }],
    [rid("p.change"), { name: "old" }],
    [rid("p.gone"), { name: "present" }],
  ]);
  const plan = planOrder(o, observed);
  const actions = Object.fromEntries(plan.entries.map((e) => [e.id, e.action]));
  assertEquals(actions, { "p.keep": "none", "p.new": "create", "p.change": "update", "p.gone": "remove", "p.already-gone": "none" });
  assertEquals(changesOf(plan).length, 3);
  assertEquals(plan.entries.map((e) => e.id), o.requirements.map((r) => r.id));
});

proves(["0003-archon-logical FR-005"], "the canonical text and digest of a plan are the same on every run, and any change of any entry changes them", async () => {
  const a = planOrder(orderOf([req("d.one", { desired: { x: 1, y: 2 } })]), new Map());
  const b = planOrder(orderOf([req("d.one", { desired: { y: 2, x: 1 } })]), new Map());
  assertEquals(canonicalPlan(a), canonicalPlan(b));
  const da = await planDigest(a);
  assertEquals(da, await planDigest(b));
  assert(/^[0-9a-f]{64}$/.test(da));
  const changed = planOrder(orderOf([req("d.one", { desired: { x: 1, y: 3 } })]), new Map());
  assert((await planDigest(changed)) !== da);
  const other = planOrder(orderOf([req("d.one", { desired: { x: 1, y: 2 } })], "baseline", subject("web-02.example.test")), new Map());
  assert((await planDigest(other)) !== da);
  const empty = planOrder(orderOf([]), new Map());
  assert(/^[0-9a-f]{64}$/.test(await planDigest(empty)));
});

proves(["0003-archon-logical FR-006"], "the approvals a plan needs follow its destructive entries, its tiers and the assurance of the fleet", () => {
  const o = orderOf([req("e.pkg"), req("e.remove", { ensure: "absent", change: "destructive", rollback: "restore-from-backup", desired: null }), req("e.admin", { tier: "administrator", desired: { name: "admin" } })]);
  const plan = planOrder(o, new Map<RequirementId, JsonValue>([[rid("e.remove"), { name: "present" }]]));
  const solo = approvalsNeeded(plan, assurance("solo"));
  assertEquals(plain(solo), { typedConfirmations: ["e.remove"], secondApprover: false, planDigestRequired: false });
  const regulated = approvalsNeeded(plan, assurance("regulated"));
  assertEquals(plain(regulated), { typedConfirmations: ["e.remove"], secondApprover: true, planDigestRequired: true });
  const quiet = planOrder(orderOf([req("e.pkg")]), new Map<RequirementId, JsonValue>([[rid("e.pkg"), { name: "e.pkg" }]]));
  assertEquals(approvalsNeeded(quiet, assurance("regulated")), { typedConfirmations: [], secondApprover: false, planDigestRequired: false });
  const tiered = planOrder(orderOf([req("e.admin", { tier: "administrator" })]), new Map());
  assertEquals(approvalsNeeded(tiered, assurance("regulated")).secondApprover, true);
  assertEquals(approvalsNeeded(tiered, assurance("team")).secondApprover, false);
});

proves(["0003-archon-logical FR-007"], "the gate opens only when each destructive entry is confirmed by its exact id and every approval needed is given", async () => {
  const o = orderOf([req("g.remove", { ensure: "absent", change: "destructive", rollback: "restore-from-backup", desired: null })]);
  const plan = planOrder(o, new Map<RequirementId, JsonValue>([[rid("g.remove"), { name: "present" }]]));
  const digest = await planDigest(plan);
  const solo = assurance("solo");
  const none = destructiveGate(plan, solo, { confirmations: [], secondApprover: false, planDigest: undefined }, digest);
  assertEquals(plain(none), { kind: "blocked", missing: [{ kind: "confirmation", id: "g.remove" }] });
  const wrong = destructiveGate(plan, solo, { confirmations: ["yes"], secondApprover: false, planDigest: undefined }, digest);
  assertEquals(wrong.kind, "blocked");
  assertEquals(destructiveGate(plan, solo, { confirmations: ["g.remove"], secondApprover: false, planDigest: undefined }, digest), { kind: "open" });
  const regulated = assurance("regulated");
  const partial = destructiveGate(plan, regulated, { confirmations: ["g.remove"], secondApprover: false, planDigest: undefined }, digest);
  assertEquals(partial, { kind: "blocked", missing: [{ kind: "second-approver" }, { kind: "plan-digest" }] });
  assertEquals(destructiveGate(plan, regulated, { confirmations: ["g.remove"], secondApprover: true, planDigest: digest }, digest), { kind: "open" });
  assertEquals(destructiveGate(plan, regulated, { confirmations: ["g.remove"], secondApprover: true, planDigest: "0".repeat(64) }, digest), { kind: "blocked", missing: [{ kind: "plan-changed" }] });
  const quiet = planOrder(orderOf([req("g.pkg")]), new Map<RequirementId, JsonValue>([[rid("g.pkg"), { name: "g.pkg" }]]));
  assertEquals(destructiveGate(quiet, solo, { confirmations: [], secondApprover: false, planDigest: undefined }, await planDigest(quiet)), { kind: "open" });
});
