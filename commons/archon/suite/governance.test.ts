/**
 * Tests of the Governance layer of Archon (commons archon 0002-archon-governance FR-001 to FR-008): the names, the catalogue of kinds, the requirement and every way it is refused, the guard
 * against a secret in a model, the profiles and their ranks, the overrides, the floor, and the judgement of a change of assurance by the assurance in force.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  CONTROL_NAMES,
  FLOOR,
  KINDS,
  PROFILES,
  PROFILE_NAMES,
  SUBJECT_CLASSES,
  canonicalJson,
  defineRequirement,
  findSecretLike,
  judgeAssuranceChange,
  kindOf,
  parseKindId,
  parseRequirementId,
  parseSecretRef,
  parseSubjectName,
  rankOf,
  resolveAssurance,
  type ApprovalEvidence,
  type Assurance,
  type RequirementInput,
} from "../src/mod.ts";

const GOOD: RequirementInput = {
  id: "baseline.openssh",
  summary: "OpenSSH is installed.",
  why: ["the only way in"],
  subject: { by: "all" },
  kind: "package",
  desired: { name: "openssh-server" },
  change: "additive",
};

function refused(input: RequirementInput): readonly string[] {
  const r = defineRequirement(input);
  assert(r.kind === "err", "the requirement is refused");
  return r.error;
}

function assurance(profile: "solo" | "team" | "regulated", overrides: readonly unknown[] = []): Assurance {
  const r = resolveAssurance(profile, overrides);
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

proves(["0002-archon-governance FR-001"], "names are made only by their functions, and a text that is none is refused with the rule", () => {
  assertEquals(parseSubjectName("web-01.example.test").kind, "ok");
  const bad = parseSubjectName("Web 01");
  assert(bad.kind === "err" && bad.error.includes("host name"));
  assertEquals(parseRequirementId("baseline.openssh").kind, "ok");
  assertEquals(parseRequirementId("Baseline").kind, "err");
  assertEquals(parseRequirementId("a".repeat(101)).kind, "err");
  assertEquals(parseKindId("firewall-rule").kind, "ok");
  assertEquals(parseKindId("firewall_rule").kind, "err");
  assertEquals(parseSecretRef("secret:vault/cloudflare-token").kind, "ok");
  assertEquals(parseSecretRef("hunter2").kind, "err");
});

proves(["0002-archon-governance FR-002"], "the catalogue has kinds for machines, zones and cloud accounts, each with its classes and whether it can destroy", () => {
  for (const id of ["package", "user", "file", "service", "firewall-rule", "ssh-authorized-key", "dns-record", "cloud-resource"]) assert(kindOf(id) !== undefined, `${id} is in the catalogue`);
  assertEquals(kindOf("package")?.subjects, ["machine", "workstation"]);
  assertEquals(kindOf("cloud-resource")?.subjects, ["cloud-account"]);
  assertEquals(kindOf("service")?.canDestroy, false);
  assertEquals(kindOf("package")?.canDestroy, true);
  assertEquals(new Set(KINDS.map((k) => k.id)).size, KINDS.length);
  assertEquals(SUBJECT_CLASSES, ["machine", "device", "workstation", "cloud-account"]);
});

proves(["0002-archon-governance FR-003"], "a requirement is defined, or refused with every reason", () => {
  const ok = defineRequirement(GOOD);
  assert(ok.kind === "ok");
  assertEquals([ok.value.ensure, ok.value.plan, ok.value.tier, ok.value.rollback, ok.value.verify.by], ["present", "faithful", "operator", "reversible", "dialect"]);
  assert(refused({ ...GOOD, why: [] }).some((m) => m.includes("why")));
  assert(refused({ ...GOOD, kind: "spaceship" }).some((m) => m.includes("catalogue")));
  assert(refused({ ...GOOD, kind: "dns-record", subject: { by: "class", class: "machine" } }).some((m) => m.includes("does not apply")));
  assert(refused({ ...GOOD, desired: { when: new Date() } }).some((m) => m.includes("not data")));
  assert(refused({ ...GOOD, change: "destructive" }).some((m) => m.includes("rolled back")));
  assert(refused({ ...GOOD, ensure: "absent", change: "mutating" }).some((m) => m.includes("absent")));
  const gone = defineRequirement({ ...GOOD, id: "baseline.no-telnet", ensure: "absent", change: "destructive", rollback: "restore-from-backup" });
  assertEquals(gone.kind, "ok");
  const many = refused({ ...GOOD, id: "Bad", why: [], kind: "spaceship", change: "huge" });
  assert(many.length >= 4, "every reason is given");
});

proves(["0002-archon-governance FR-004"], "text that looks like a secret is found by its path, and a requirement that holds one is refused", () => {
  assertEquals(findSecretLike({ content: "-----BEGIN PRIVATE KEY-----" }), [{ path: "$.content", why: "private-key" }]);
  assertEquals(findSecretLike({ keys: ["AKIAIOSFODNN7EXAMPLE"] }), [{ path: "$.keys[0]", why: "cloud-key" }]);
  assertEquals(findSecretLike({ db: { password: "hunter2" } }), [{ path: "$.db.password", why: "named-secret" }]);
  assertEquals(findSecretLike({ db: { password: "secret:vault/db-password" } }), []);
  assertEquals(findSecretLike({ name: "openssh-server", port: 22, enabled: true }), []);
  const r = refused({ ...GOOD, desired: { content: "-----BEGIN OPENSSH PRIVATE KEY-----" } });
  assert(r.some((m) => m.includes("$.content")));
});

proves(["0002-archon-governance FR-005"], "each profile gives every control, and the profiles are ranked from the least strict to the most", () => {
  assertEquals(PROFILE_NAMES, ["solo", "team", "regulated"]);
  for (const c of CONTROL_NAMES) {
    const ranks = PROFILE_NAMES.map((p) => rankOf(c, PROFILES[p][c]));
    assert(ranks.every((r) => r >= 0), `${c} has a value of its own in every profile`);
    assert(ranks.every((r, i) => i === 0 || r >= (ranks[i - 1] ?? Number.POSITIVE_INFINITY)), `${c} does not get less strict from solo to regulated`);
  }
  assertEquals(PROFILES.solo.approval, "authenticated-push");
  assertEquals(PROFILES.regulated.keyCustody, "hardware-required");
  assertEquals(PROFILES.regulated.secondApprover, "tier-and-destructive");
});

proves(["0002-archon-governance FR-006"], "an override has a reason and a date, names a control it has and a value it has, and is kept in the assurance", () => {
  const ok = resolveAssurance("team", [{ control: "keyCustody", value: "hardware-required", reason: "the signers hold hardware keys", decidedOn: "2026-11-20" }]);
  assert(ok.kind === "ok");
  assertEquals(ok.value.controls.keyCustody, "hardware-required");
  assertEquals(ok.value.overrides.length, 1);
  assertEquals(ok.value.controls.approval, PROFILES.team.approval);
  for (const bad of [
    { control: "keyCustody", value: "optional", reason: "", decidedOn: "2026-11-20" },
    { control: "keyCustody", value: "optional", reason: "x" },
    { control: "mood", value: "optional", reason: "x", decidedOn: "2026-11-20" },
    { control: "keyCustody", value: "telepathy", reason: "x", decidedOn: "2026-11-20" },
  ]) assertEquals(resolveAssurance("team", [bad]).kind, "err");
});

proves(["0002-archon-governance FR-007"], "the floor is stated as data and no control or override can lower it", () => {
  assertEquals(FLOOR.map((f) => f.id), ["no-secret-in-a-model", "no-passphrase-stored", "agent-proposes-person-approves", "destructive-needs-typed-confirmation"]);
  for (const f of FLOOR) assert(!CONTROL_NAMES.some((c) => c === f.id), `${f.id} is not a control`);
  assertEquals(resolveAssurance("solo", [{ control: "no-passphrase-stored", value: "optional", reason: "x", decidedOn: "2026-11-20" }]).kind, "err");
});

const EVIDENCE: ApprovalEvidence = { mechanism: "authenticated-push", keyHeld: "none", tip: "authenticated-remote", secondApproverPresent: false, planHashNamed: false };

proves(["0002-archon-governance FR-008"], "a change of assurance is judged by the assurance in force, and an accepted change records what it lowers", () => {
  const refusedChange = judgeAssuranceChange({ inForce: assurance("team"), proposed: assurance("solo"), evidence: EVIDENCE });
  assertEquals(refusedChange.kind, "refused");
  assert(refusedChange.kind === "refused" && refusedChange.unmet.includes("approval") && refusedChange.unmet.includes("tipAccept"));
  const accepted = judgeAssuranceChange({ inForce: assurance("team"), proposed: assurance("solo"), evidence: { ...EVIDENCE, mechanism: "signed-commit", keyHeld: "hardware", tip: "signed-by-listed-signer" } });
  assert(accepted.kind === "accepted");
  assert(accepted.lowered.includes("approval") && accepted.lowered.includes("keyCustody") && accepted.lowered.includes("recovery"));
  const same = judgeAssuranceChange({ inForce: assurance("solo"), proposed: assurance("solo"), evidence: EVIDENCE });
  assertEquals(same, { kind: "accepted", lowered: [] });
  const regulated = judgeAssuranceChange({ inForce: assurance("regulated"), proposed: assurance("team"), evidence: { ...EVIDENCE, mechanism: "signed-commit-second-approver", keyHeld: "hardware", tip: "signed-with-plan-hash", secondApproverPresent: true } });
  assertEquals(regulated.kind, "refused");
  assert(regulated.kind === "refused" && regulated.unmet.includes("planHash"));
  assertEquals(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
});
