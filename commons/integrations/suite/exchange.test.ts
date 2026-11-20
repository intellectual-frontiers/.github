/**
 * Tests of exchange (commons integrations 0006-integrations-exchange FR-001 to FR-012): the abstract tree and its paths, redaction written once, schema and profile
 * as constraints, findings that hold no value, terminology bindings, validation, mappings that account for every field, acknowledgements and the state machine.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ok } from "@intellectual-frontiers/core";
import { parseSha256, parseStandardUrn, ref, type Instant } from "../src/governance/mod.ts";
import {
  ACK_KINDS,
  ACK_STATUSES,
  FINDING_CODES,
  FINDING_LEVELS,
  REJECTION_KINDS,
  conformLedger,
  memoryLedger,
  parseItemKey,
  parseLoadId,
  parseOutcomeCode,
  parseStage,
  type LedgerPort,
  HIDDEN,
  coverage,
  element,
  entries,
  finding,
  hasErrors,
  hidingAllBut,
  isFinal,
  loop,
  occurrences,
  pathsOf,
  redactTree,
  segment,
  statusOf,
  transactionsOf,
  transition,
  translate,
  validate,
  valuesOf,
  type Acknowledgement,
  type Constraint,
  type Interchange,
  type ExchangeEvent,
  type ExchangeState,
  type Mapping,
  type Schema,
  type Terminology,
  type Transaction,
} from "../src/logical/mod.ts";
import { NOW, TOY, must } from "./world.ts";

const SCHEMA_URN = must(parseStandardUrn("urn:standard:tests:patient-schema:1"));
const TERM_URN = must(parseStandardUrn("urn:standard:tests:gender-codes:1"));

/** A synthetic patient: FHIR-like ids, made-up values only. */
const patient: Transaction = {
  kind: "transaction",
  id: "Patient",
  control: "1",
  children: [
    segment("id", element("", "pt-0001")),
    loop("name", segment("family", element("", "Zyxwvut")), segment("given", element("", "Qwertyuiop")), segment("given", element("", "Asdfghjkl"))),
    segment("gender", element("", "female")),
    segment("birthDate", element("", "1970-01-02")),
  ],
};
const tree: Interchange = { kind: "interchange", syntax: ref("syntax", TOY), control: "1", groups: [{ kind: "group", id: "G", control: "1", transactions: [patient] }] };

const schema = (constraints: readonly Constraint[]): Schema => ({
  id: ref("schema", SCHEMA_URN),
  transaction: "Patient",
  paths: ["Patient.id", "Patient.name", "Patient.name.family", "Patient.name.given", "Patient.gender", "Patient.birthDate"],
  constraints,
});

proves(["0006-integrations-exchange FR-001", "0006-integrations-exchange FR-002"], "a tree is made and walked: entries, paths and occurrences", () => {
  assertEquals(transactionsOf(tree).length, 1);
  assertEquals(entries(patient).map((e) => e.path), ["Patient.id", "Patient.name.family", "Patient.name.given", "Patient.name.given", "Patient.gender", "Patient.birthDate"]);
  assertEquals(entries(patient)[3]?.at, "Patient.name[0].given[1]");
  assertEquals(pathsOf(patient), ["Patient.id", "Patient.name", "Patient.name.family", "Patient.name.given", "Patient.gender", "Patient.birthDate"]);
  assertEquals(occurrences(patient, "Patient.name.given"), [["Patient.name[0]", 2]]);
  assertEquals(occurrences(patient, "Patient.name"), [["Patient", 1]]);
  assertEquals(occurrences(patient, "Patient.deceased"), [["Patient", 0]]);
});

proves(["0006-integrations-exchange FR-003"], "redaction hides what it names and keeps the rest", () => {
  const hidden = redactTree(tree, (p) => p === "Patient.name");
  const t = transactionsOf(hidden)[0];
  assert(t !== undefined);
  const values = entries(t).map((e) => e.value);
  assertEquals(values, ["pt-0001", HIDDEN, HIDDEN, HIDDEN, "female", "1970-01-02"]);
  const min = redactTree(tree, hidingAllBut(["Patient.gender", "Patient.id"]));
  const mt = transactionsOf(min)[0];
  assert(mt !== undefined);
  assertEquals(entries(mt).map((e) => e.value), ["pt-0001", HIDDEN, HIDDEN, HIDDEN, "female", HIDDEN]);
  assertEquals(valuesOf(tree)[0], "Qwertyuiop");
});

proves(["0006-integrations-exchange FR-004", "0006-integrations-exchange FR-007"], "a schema and a profile constrain a transaction, and validate finds each kind", () => {
  assertEquals(validate(patient, schema([{ kind: "cardinality", path: "Patient.id", min: 1, max: 1 }])), []);
  const bad: Transaction = { ...patient, children: [...patient.children, segment("unknownThing", element("", "x")), segment("id", element("", "pt-0002"))] };
  const fs = validate(bad, schema([{ kind: "cardinality", path: "Patient.id", min: 1, max: 1 }]));
  assertEquals(fs.map((f) => f.code), ["unknown-path", "cardinality-max"]);
  const none: Transaction = { ...patient, children: patient.children.filter((c) => c.id !== "birthDate") };
  assertEquals(validate(none, schema([{ kind: "cardinality", path: "Patient.birthDate", min: 1, max: 1 }])).map((f) => f.code), ["cardinality-min"]);
  assertEquals(validate(patient, schema([{ kind: "pattern", path: "Patient.birthDate", regex: "^\\d{4}-\\d{2}-\\d{2}$" }])), []);
  assertEquals(validate(patient, schema([{ kind: "pattern", path: "Patient.birthDate", regex: "^X" }])).map((f) => f.code), ["value-pattern"]);
  assertEquals(validate(patient, schema([]), { profile: { id: ref("profile", SCHEMA_URN), schema: ref("schema", SCHEMA_URN), constraints: [{ kind: "fixed", path: "Patient.gender", value: "male" }] } }).map((f) => [f.level, f.code]), [["profile", "value-fixed"]]);
  assertEquals(validate(patient, schema([]), { rules: [(t) => (t.id === "Patient" ? [finding("business-rule", "warning", "business-rule", "Patient")] : [])] }).map((f) => f.level), ["business-rule"]);
  assertEquals(validate({ ...patient, id: "Other" }, schema([])).some((f) => f.code === "unknown-path"), true);
  assert(hasErrors(fs));
});

proves(["0006-integrations-exchange FR-005"], "findings hold no value of the payload (property)", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[A-Za-z]{6,12}$/), fc.stringMatching(/^[A-Za-z]{6,12}$/), (family, given) => {
      fc.pre(family !== given && !family.includes(given) && !given.includes(family));
      const t: Transaction = { ...patient, children: [loop("name", segment("family", element("", `Z${family}`)), segment("given", element("", `Q${given}`))), segment("gender", element("", "other"))] };
      const fs = validate(t, schema([{ kind: "pattern", path: "Patient.name.family", regex: "^never$" }, { kind: "binding", path: "Patient.gender", terminology: ref("terminology", TERM_URN), strength: "required" }]), {
        terminologies: new Map([[TERM_URN, { id: ref("terminology", TERM_URN), codes: new Set(["male", "female"]) }]]),
      });
      assert(fs.length >= 2);
      for (const f of fs) {
        assert(!f.message.includes(`Z${family}`) && !f.message.includes(`Q${given}`) && !f.path.includes(`Z${family}`), "no value in a finding");
        assert(!f.message.includes("other"), "the code is not said either");
      }
    }),
  );
});

proves(["0006-integrations-exchange FR-006"], "binding strengths", () => {
  const terminologies = new Map<typeof TERM_URN, Terminology>([[TERM_URN, { id: ref("terminology", TERM_URN), codes: new Set(["male"]) }]]);
  const bound = (strength: "required" | "extensible" | "preferred" | "example") => validate(patient, schema([{ kind: "binding", path: "Patient.gender", terminology: ref("terminology", TERM_URN), strength }]), { terminologies }).map((f) => f.severity);
  assertEquals(bound("required"), ["error"]);
  assertEquals(bound("extensible"), ["warning"]);
  assertEquals(bound("preferred"), ["information"]);
  assertEquals(bound("example"), []);
  const unloaded = validate(patient, schema([{ kind: "binding", path: "Patient.gender", terminology: ref("terminology", TERM_URN), strength: "required" }]));
  assertEquals(unloaded.map((f) => f.code), ["terminology-unavailable"]);
  assertEquals(unloaded.map((f) => f.severity), ["warning"]);
});

const claimSchema = ref("schema", must(parseStandardUrn("urn:standard:tests:claim:1")));
const mapping = (rules: Mapping["rules"]): Mapping => ({ id: "patient-to-person", source: ref("schema", SCHEMA_URN), target: claimSchema, sourceTransaction: "Patient", targetTransaction: "Person", rules });

proves(["0006-integrations-exchange FR-008"], "coverage finds an unmapped field, a conflict, a stray rule and a drop", () => {
  const paths = [...new Set(entries(patient).map((e) => e.path))];
  const full = mapping([
    { kind: "map", from: "Patient.id", to: "Person.identifier", transform: { kind: "identity" } },
    { kind: "carry", from: "Patient.name", to: "Person.name" },
    { kind: "map", from: "Patient.gender", to: "Person.sex", transform: { kind: "upper" } },
    { kind: "drop", from: "Patient.birthDate", reason: "the recipient may not have it" },
  ]);
  assertEquals(coverage(full, paths).map((f) => [f.code, f.path]), [["lossy-mapping", "Patient.birthDate"]]);
  const lacking = mapping(full.rules.filter((r) => r.from !== "Patient.gender"));
  assertEquals(coverage(lacking, paths).map((f) => f.code).sort(), ["lossy-mapping", "unmapped-source-field"]);
  const conflict = mapping([...full.rules, { kind: "map", from: "Patient.name.family", to: "Person.identifier", transform: { kind: "trim" } }]);
  assert(coverage(conflict, paths).some((f) => f.code === "mapping-target-conflict"));
  const stray = mapping([...full.rules, { kind: "carry", from: "Patient.nothing", to: "Person.nothing" }]);
  assert(coverage(stray, paths).some((f) => f.code === "unknown-path"));
});

proves(["0006-integrations-exchange FR-009"], "translate maps, carries and drops, and refuses an unmapped field", () => {
  const rules: Mapping["rules"] = [
    { kind: "map", from: "Patient.id", to: "Person.identifier", transform: { kind: "upper" } },
    { kind: "carry", from: "Patient.name", to: "Person.name" },
    { kind: "map", from: "Patient.gender", to: "Person.sex", transform: { kind: "table", table: { female: "F" }, otherwise: "drop" } },
    { kind: "drop", from: "Patient.birthDate", reason: "not for the recipient" },
  ];
  const out = must(translate(mapping(rules), patient));
  assertEquals(entries(out).map((e) => [e.path, e.value]), [
    ["Person.identifier", "PT-0001"],
    ["Person.name.family", "Zyxwvut"],
    ["Person.name.given", "Qwertyuiop"],
    ["Person.name.given", "Asdfghjkl"],
    ["Person.sex", "F"],
  ]);
  const lossy = translate(mapping(rules.slice(0, 3)), patient);
  assert(lossy.kind === "err" && lossy.error[0]?.code === "unmapped-source-field");
  assertEquals(translate({ ...mapping(rules), sourceTransaction: "Other" }, patient).kind, "err");
});

const ta1: Acknowledgement = { kind: "x12-ta1", control: "000000001", status: "accepted", note: "000" };

proves(["0006-integrations-exchange FR-010"], "statusOf over every acknowledgement", () => {
  assertEquals(statusOf(ta1), "accepted");
  assertEquals(statusOf({ kind: "x12-999", control: "1", groupControl: "1", status: "rejected", errors: 3 }), "rejected");
  for (const [code, status] of [["AA", "accepted"], ["CA", "accepted"], ["AE", "accepted-with-errors"], ["CE", "accepted-with-errors"], ["AR", "rejected"], ["CR", "rejected"]] as const) {
    assertEquals(statusOf({ kind: "hl7-ack", control: "1", code }), status);
  }
  assertEquals(statusOf({ kind: "fhir-operation-outcome", issues: [] }), "accepted");
  assertEquals(statusOf({ kind: "fhir-operation-outcome", issues: [finding("schema", "warning", "unknown-path", "x")] }), "accepted-with-errors");
  assertEquals(statusOf({ kind: "fhir-operation-outcome", issues: [finding("schema", "error", "unknown-path", "x")] }), "rejected");
});

const policy = { maxAttempts: 3 };
const ev = (kind: ExchangeEvent["kind"], at: Instant = NOW): ExchangeEvent => {
  switch (kind) {
    case "send":
    case "receive":
    case "retry":
      return { kind, at };
    case "ack":
      return { kind, status: "accepted" };
    case "timeout":
    case "invalid":
      return { kind };
  }
};
const states: readonly ExchangeState[] = [
  { kind: "pending" },
  { kind: "sent", attempt: 1, at: NOW },
  { kind: "received", at: NOW },
  { kind: "retrying", attempt: 1 },
  { kind: "acknowledged", status: "accepted" },
  { kind: "rejected", reason: "nack" },
  { kind: "abandoned", attempts: 3 },
];
const events = ["send", "receive", "ack", "timeout", "retry", "invalid"] as const;

proves(["0006-integrations-exchange FR-011"], "transition over every state and event (property)", () => {
  fc.assert(
    fc.property(fc.constantFrom(...states), fc.constantFrom(...events), (s, e) => {
      const r = transition(s, ev(e), policy);
      if (r.kind === "err") assertEquals([r.error.from, r.error.event], [s.kind, e]);
    }),
  );
  assertEquals(must(transition({ kind: "pending" }, ev("send"), policy)).kind, "sent");
  assertEquals(must(transition({ kind: "sent", attempt: 1, at: NOW }, ev("ack"), policy)), { kind: "acknowledged", status: "accepted" });
  assertEquals(must(transition({ kind: "sent", attempt: 1, at: NOW }, { kind: "ack", status: "rejected" }, policy)), { kind: "rejected", reason: "nack" });
  assertEquals(must(transition({ kind: "received", at: NOW }, ev("invalid"), policy)), { kind: "rejected", reason: "invalid" });
  assertEquals(transition({ kind: "pending" }, ev("ack"), policy).kind, "err");
});

proves(["0006-integrations-exchange FR-012"], "retries are bounded, and a final state accepts no event", () => {
  let s: ExchangeState = must(transition({ kind: "pending" }, ev("send"), policy));
  for (let i = 1; i < policy.maxAttempts; i++) {
    s = must(transition(s, ev("timeout"), policy));
    assertEquals(s, { kind: "retrying", attempt: i });
    s = must(transition(s, ev("retry"), policy));
    assertEquals(s.kind, "sent");
  }
  s = must(transition(s, ev("timeout"), policy));
  assertEquals(s, { kind: "abandoned", attempts: 3 });
  for (const e of events) assertEquals(transition(s, ev(e), policy).kind, "err");
  assertEquals(states.filter(isFinal).map((x) => x.kind), ["acknowledged", "rejected", "abandoned"]);
});

const ledgerIds = {
  load: (n: number) => must(parseLoadId(`load-${n}`)),
  stage: (s: string) => must(parseStage(s)),
  code: (s: string) => must(parseOutcomeCode(s)),
  key: (n: number) => must(parseItemKey(`item-${n}`)),
  hash: (n: number) => must(parseSha256(String(n).repeat(64).slice(0, 64))),
  at: NOW,
};

proves(["0006-integrations-exchange FR-013"], "the identifiers of a ledger event admit no free text", () => {
  assertEquals(parseStage("RECEIVED").kind, "ok");
  assertEquals(parseStage("received").kind, "err");
  assertEquals(parseOutcomeCode("cardinality-min").kind, "ok");
  const leak = parseOutcomeCode("Patient Zyxwvut was rejected");
  assert(leak.kind === "err" && !JSON.stringify(leak).includes("Zyxwvut"));
  assertEquals(parseLoadId("a b").kind, "err");
  assertEquals(parseItemKey("ok.key:1").kind, "ok");
});

proves(["0006-integrations-exchange FR-014"], "the in-memory ledger conforms and a faulty one is found", async () => {
  assertEquals(await conformLedger(memoryLedger, ledgerIds), []);
  const forgetful = (): LedgerPort => ({ ...memoryLedger(), intake: () => Promise.resolve(ok({ kind: "first-seen" as const })) });
  assertEquals((await conformLedger(forgetful, ledgerIds)).map((f) => f.rule).sort(), ["ledger/conflict", "ledger/duplicate"]);
  const lax = (): LedgerPort => ({ ...memoryLedger(), outcome: () => Promise.resolve(ok(undefined)) });
  assert((await conformLedger(lax, ledgerIds)).some((f) => f.rule === "ledger/unknown-load"));
  const shared = memoryLedger();
  assert((await conformLedger(() => shared, ledgerIds)).some((f) => f.rule === "ledger/fresh"));
});

proves(["0006-integrations-exchange FR-015"], "the code lists are complete", () => {
  assertEquals(FINDING_CODES.length, 12);
  assertEquals(new Set(FINDING_CODES).size, 12);
  assertEquals(FINDING_LEVELS.length, 5);
  assertEquals([...ACK_KINDS].sort(), ["fhir-operation-outcome", "hl7-ack", "x12-999", "x12-ta1"]);
  assertEquals(ACK_STATUSES, ["accepted", "accepted-with-errors", "rejected"]);
  assertEquals(REJECTION_KINDS, ["nack", "invalid"]);
});
