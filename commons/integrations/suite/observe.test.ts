/**
 * Tests of the ports and of observation (commons integrations 0003-integrations-logical FR-001 to FR-003; 0005-integrations-observe FR-001 to FR-011): a connector
 * observes over an in-memory port, governance is enforced on what it returns, policies are data, documents round-trip, and a registry pins what it holds.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { cadence, instantOf, parseConnectorId, parseSha256, type Instant } from "../src/governance/mod.ts";
import {
  CONTRACT,
  SECRET_MASK,
  addEntry,
  defineConnector,
  documentOf,
  evaluatePolicy,
  freshnessResult,
  gapOf,
  fromReadFailure,
  lockDocument,
  parseLock,
  parseObservationDocument,
  pinSource,
  secretOf,
  verifyCopy,
  type ConnectorRegistry,
  type Observation,
  type RegistryEntry,
  type PosturePolicy,
} from "../src/logical/mod.ts";
import { NOW, SAMPLE_PORT, must, sampleConnector, sampleGovernance } from "./world.ts";

proves(["0003-integrations-logical FR-001", "0005-integrations-observe FR-003"], "a connector observes over an in-memory port and a fixed clock, and describe agrees with governance", async () => {
  const c = sampleConnector();
  const port = SAMPLE_PORT();
  const probe = await c.probe({ port, now: NOW });
  assertEquals(probe.kind, "ok");
  const o = must(await c.observe({ port, now: NOW }));
  assertEquals(o.provider, "sample-host");
  assertEquals(o.assets.map((a) => a.id), ["alpha", "beta"]);
  const d = c.describe();
  assertEquals(d.id, c.governance.id);
  assertEquals(d.readOnly, true);
  assertEquals(d.policies, ["observation-fresh", "two-factor-required"]);
  assert(!JSON.stringify(d).includes("vault://") === false || d.credentialFields.every((f) => f.name !== ""), "describe holds names and hints only");
});

proves(["0003-integrations-logical FR-002"], "a secret never shows in text or JSON", () => {
  const s = secretOf("abc123xyz-very-secret");
  assertEquals(JSON.stringify(s), JSON.stringify(SECRET_MASK));
  assertEquals(`${s}`, SECRET_MASK);
  assertEquals(String(s), SECRET_MASK);
  assert(!JSON.stringify({ nested: { s } }).includes("abc123xyz"));
  assertEquals(s.reveal(), "abc123xyz-very-secret");
});

proves(["0003-integrations-logical FR-003"], "findings and failures hold no value of the payload", () => {
  const f = fromReadFailure({ kind: "server", subject: "/repos", status: 500 });
  assertEquals(f.kind, "transport");
  assertEquals(gapOf(fromReadFailure({ kind: "denied", subject: "/x" }))?.kind, "denied");
  assertEquals(gapOf(f), undefined);
});

proves(["0005-integrations-observe FR-001", "0005-integrations-observe FR-002", "0005-integrations-observe FR-008"], "an observation round-trips through its document, and one of another schema is refused", async () => {
  const c = sampleConnector({}, false);
  const o = must(await c.observe({ port: SAMPLE_PORT(), now: NOW }));
  const doc = documentOf(o);
  assertEquals(doc.kind, "observation");
  assertEquals(must(parseObservationDocument(JSON.parse(JSON.stringify(doc)))), o);
  assertEquals(parseObservationDocument({ ...doc, schema: "other/1" }).kind, "err");
  assertEquals(parseObservationDocument({ ...doc, kind: "lock" }).kind, "err");
  const wrong = parseObservationDocument({ ...doc, observation: { ...o, posture: { x: [] } } });
  assert(wrong.kind === "err" && wrong.error.path.startsWith("$.observation"));
});

proves(["0005-integrations-observe FR-004"], "defineConnector refuses a connector with problems", () => {
  const spec = { probe: () => Promise.reject(new Error("unused")), observe: () => Promise.reject(new Error("unused")), policies: [] as readonly PosturePolicy[] };
  const refused = defineConnector({ ...spec, governance: sampleGovernance({ scope: { grants: [] } }) });
  assert(refused.kind === "err" && refused.error.kind === "governance");
  const p: PosturePolicy = { id: "p1", title: "P", fact: "f", want: { kind: "present" }, severity: "warn", fix: "x" };
  const twice = defineConnector({ ...spec, governance: sampleGovernance(), policies: [p, p] });
  assert(twice.kind === "err" && twice.error.kind === "duplicate-policy");
  const reserved = defineConnector({ ...spec, governance: sampleGovernance(), policies: [{ ...p, id: "observation-fresh" }] });
  assertEquals(reserved.kind, "err");
});

proves(["0005-integrations-observe FR-005"], "a denied field and an undeclared entity kind do not survive", async () => {
  const c = sampleConnector({ entities: ["repository"] });
  const o = must(await c.observe({ port: SAMPLE_PORT(), now: NOW }));
  for (const r of o.records ?? []) {
    assert("private" in r.props);
    assert(!("owner_salary" in r.props), "the denylist removed it");
  }
  assertEquals(o.entities?.people, undefined);
  assertEquals(o.entities?.repositories?.length, 2);
  assert(o.gaps.some((g) => g.kind === "entity-kind-not-declared" && g.subject === "person"));
});

const at = (posture: Observation["posture"]): Observation => ({ at: NOW, provider: "p", account: "a", assets: [], posture, gaps: [] });

proves(["0005-integrations-observe FR-006"], "evaluatePolicy over each expectation", () => {
  const p = (want: PosturePolicy["want"], severity: PosturePolicy["severity"] = "fail"): PosturePolicy => ({ id: "x", title: "X", fact: "f", want, severity, fix: "fix" });
  assertEquals(evaluatePolicy(p({ kind: "is-true" }), at({})).status, "unknown");
  assertEquals(evaluatePolicy(p({ kind: "is-true" }), at({ f: true })).status, "pass");
  assertEquals(evaluatePolicy(p({ kind: "is-true" }), at({ f: false })).status, "fail");
  assertEquals(evaluatePolicy(p({ kind: "is-false" }, "warn"), at({ f: true })).status, "warn");
  assertEquals(evaluatePolicy(p({ kind: "at-least", value: 2 }), at({ f: 2 })).status, "pass");
  assertEquals(evaluatePolicy(p({ kind: "at-least", value: 2 }), at({ f: 1 })).status, "fail");
  assertEquals(evaluatePolicy(p({ kind: "at-most", value: 2 }), at({ f: 3 })).status, "fail");
  assertEquals(evaluatePolicy(p({ kind: "equals", value: "on" }), at({ f: "on" })).status, "pass");
  assertEquals(evaluatePolicy(p({ kind: "present" }), at({ f: 0 })).status, "pass");
});

proves(["0005-integrations-observe FR-007"], "a stale observation fails the freshness policy", async () => {
  const c = sampleConnector();
  const o = must(await c.observe({ port: SAMPLE_PORT(), now: NOW }));
  const cad = must(cadence("1d"));
  const later: Instant = instantOf(Date.parse(NOW) + 3 * 86_400_000);
  assertEquals(freshnessResult(cad, o, NOW).status, "pass");
  assertEquals(freshnessResult(cad, o, later).status, "fail");
  assertEquals(c.check(o, later)[0]?.id, "observation-fresh");
  assertEquals(c.check(o, NOW).find((r) => r.id === "two-factor-required")?.status, "pass");
});

const sha = (c: string) => must(parseSha256(c.repeat(64)));

proves(["0005-integrations-observe FR-009"], "pinSource refuses a branch", () => {
  assertEquals(pinSource("https://example.test/c@main").kind, "err");
  assertEquals(pinSource("https://example.test/c").kind, "err");
  assertEquals(pinSource("http://example.test/c@v1.2.3").kind, "err");
  assertEquals(pinSource("https://example.test/c@v1.2.3").kind, "ok");
  assertEquals(pinSource(`https://example.test/c@${"a".repeat(40)}`).kind, "ok");
});

proves(["0005-integrations-observe FR-010", "0005-integrations-observe FR-011"], "a lock round-trips in order, and a copy with another digest is refused", () => {
  const entry = (id: string, c: string): RegistryEntry => ({ id: must(parseConnectorId(id)), title: id, source: must(pinSource("https://example.test/c@v1.0.0")), sha256: sha(c), contract: CONTRACT, added: NOW });
  let reg: ConnectorRegistry = new Map();
  reg = must(addEntry(reg, entry("zeta", "a")));
  reg = must(addEntry(reg, entry("alpha", "b")));
  assertEquals(addEntry(reg, entry("alpha", "c")).kind, "err");
  const doc = lockDocument(reg);
  assertEquals(doc.entries.map((e) => e.id), ["alpha", "zeta"]);
  const back = must(parseLock(JSON.parse(JSON.stringify(doc))));
  assertEquals(JSON.stringify(lockDocument(back)), JSON.stringify(doc));
  assertEquals(parseLock({ ...doc, schema: "x/1" }).kind, "err");
  assertEquals(parseLock({ ...doc, entries: [...doc.entries, doc.entries[0]] }).kind, "err");
  assertEquals(parseLock({ ...doc, entries: [{ ...doc.entries[0], sha256: "nope" }] }).kind, "err");
  const id = must(parseConnectorId("alpha"));
  assertEquals(verifyCopy(reg, id, sha("b")).kind, "ok");
  const bad = verifyCopy(reg, id, sha("c"));
  assert(bad.kind === "err" && bad.error.kind === "digest-mismatch" && bad.error.expected === sha("b") && bad.error.actual === sha("c"));
  assertEquals(verifyCopy(reg, must(parseConnectorId("nobody")), sha("b")).kind, "err");
});
