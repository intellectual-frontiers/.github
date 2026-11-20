/**
 * Tests of the standard formats of GRC findings: `kernel/ocsf.ts` (OCSF 1.9.0 Compliance Finding, Vulnerability Finding, and Device, User
 * and Cloud Resources Inventory Info, typed by the generated `kernel/ocsf-types.auto.ts`), `kernel/oscal.ts` (OSCAL 1.2.3 assessment
 * results, POA&M, component definition and SSP, every UUID a version 5 UUID, the same input the same bytes in any order) and `kernel/attest.ts` (CycloneDX 1.6 declarations, and in-toto statements signed and verified through DSSE).
 *
 * @module
 */
import fc from "fast-check";
import { defineRisk, type Risk } from "../src/assess.ts";
import {
  bomStatement,
  type CdxBom,
  CYCLONEDX_PREDICATE_TYPE,
  cyclonedxBom,
  digestSubject,
  intotoStatement,
  niUri,
  type TypedStatement,
} from "../src/attest.ts";
import { object, string, unknownValue, type Equal, expectType } from "@intellectual-frontiers/core";
import { signStatement, verifyStatement } from "@intellectual-frontiers/crypto/dsse";
import { canonicalize } from "../src/evidence.ts";
import {
  type Assessment,
  type ControlSummary,
  defineCatalog,
  defineControl,
  definePack,
  defineWaiver,
  duration,
  epochMs,
  type Finding,
  findingKey,
  type Instant,
  instantFromEpochMs,
  instantOf,
  OUTCOMES,
  roleOf,
  runPack,
  SEVERITIES,
  STATUSES,
  verdict,
} from "../src/grc.ts";
import {
  cloudResourcesInventoryInfo,
  type CloudResourcesInventoryEvent,
  complianceFinding,
  type ComplianceFindingEvent,
  complianceFindings,
  type DeviceInventoryEvent,
  deviceInventoryInfo,
  inventory,
  OCSF_CLASSES,
  OCSF_SEVERITY,
  OCSF_VERSION,
  type OcsfComplianceFinding,
  type OcsfDevice,
  type OcsfEvent,
  type UserInventoryEvent,
  userInventoryInfo,
  vulnerabilityFinding,
  type VulnerabilityFindingEvent,
} from "../src/ocsf.ts";
import { assessmentResults, componentDefinition, type OscalOptions, poam, renderOscal, systemSecurityPlan } from "../src/oscal.ts";
import { type Sha256, sha256 } from "@intellectual-frontiers/crypto/sha256";
import { NAMESPACE_URL, uuidOf, uuidV5, uuidVersion } from "@intellectual-frontiers/crypto/uuid";
import { assert, assertEquals, assertNotEquals, proves } from "@intellectual-frontiers/test";

const OCSF = "0001-grc-engineering FR-016";
const OSCAL = "0001-grc-engineering FR-017";
const CDX = "0001-grc-engineering FR-018";

function at(text: string): Instant {
  const i = instantOf(text);
  if (i === undefined) throw new Error(`not an instant: ${text}`);
  return i;
}

function role(text: string): NonNullable<ReturnType<typeof roleOf>> {
  const r = roleOf(text);
  if (r === undefined) throw new Error(`not a role: ${text}`);
  return r;
}

const AT = at("2026-03-01T12:00:00Z");
const PRODUCT = { name: "Example Checker", vendor_name: "Example", version: "1.0.0" };

const catalog = defineCatalog("example", "1.0", [
  { id: "EX-1", title: "Disks are encrypted" },
  { id: "EX-2", title: "Systems are patched" },
] as const);

type Host = { readonly name: string; readonly encrypted: boolean; readonly patched: boolean };

async function fixture(): Promise<Assessment> {
  const digest = await sha256("disk report");
  const disk = defineControl({
    id: "disk-encryption",
    title: "Disk encryption",
    implements: [catalog.control("EX-1"), catalog.control("EX-2")],
    severity: "high",
    cadence: duration("P1D"),
    remediation: "Turn on full-disk encryption.",
    check: (h: Host) => verdict(h.encrypted ? "pass" : "fail", { evidence: [digest], detail: h.encrypted ? "" : "the disk is plain" }),
  });
  const patch = defineControl({
    id: "patch-level",
    title: "Patch level",
    implements: [catalog.control("EX-2")],
    severity: "medium",
    cadence: duration("P7D"),
    check: (h: Host) => verdict(h.patched ? "pass" : "warn"),
  });
  const owner = defineControl({
    id: "owner-named",
    title: "Owner named",
    implements: [],
    severity: "low",
    cadence: duration("P30D"),
    check: (h: Host) => {
      if (h.name === "c") throw new Error("no inventory record");
      return verdict("not-applicable");
    },
  });
  const pack = definePack({
    id: "hosts",
    title: "Hosts",
    subjectKind: "host",
    subjectId: (h: Host) => h.name,
    controls: [disk, patch, owner],
  });
  const waiver = defineWaiver({
    id: "W-1",
    control: "disk-encryption",
    subjects: ["b"],
    reason: "a replacement is ordered",
    approvedBy: role("security-lead"),
    grantedAt: at("2026-02-01T00:00:00Z"),
    expiresAt: at("2026-04-01T00:00:00Z"),
  });
  assert(waiver.kind === "ok");
  return runPack(
    pack,
    [
      { name: "a", encrypted: true, patched: true },
      { name: "b", encrypted: false, patched: false },
      { name: "c", encrypted: false, patched: true },
    ],
    { at: AT },
    { waivers: [waiver.value] },
  );
}

const RISKS: readonly Risk[] = [
  defineRisk({
    id: "R-2",
    title: "Lost laptop",
    likelihood: "moderate",
    impact: "very-high",
    treatment: "mitigate",
    owner: role("it-operations"),
    reviewBy: at("2026-06-01T00:00:00Z"),
    controls: ["disk-encryption"],
  }),
  defineRisk({
    id: "R-1",
    title: "Vendor outage",
    likelihood: "low",
    impact: "high",
    treatment: "transfer",
    owner: role("procurement"),
    reviewBy: at("2026-09-01T00:00:00Z"),
  }),
];

async function options(): Promise<OscalOptions> {
  return {
    namespace: await uuidV5(NAMESPACE_URL, "https://example.com/assessments"),
    lastModified: AT,
    version: "1.0",
    propNamespace: "https://example.com/ns/grc",
    organization: "Example Org",
  };
}

function shuffled<T>(xs: readonly T[], seed: number): readonly T[] {
  const out = [...xs];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** Every value under a key of a JSON value, with the key. */
function walk(value: unknown, visit: (key: string, v: unknown) => void, key = "$"): void {
  visit(key, value);
  if (Array.isArray(value)) for (const v of value) walk(v, visit, key);
  else if (typeof value === "object" && value !== null) for (const [k, v] of Object.entries(value)) walk(v, visit, k);
}

function canonical(value: unknown): string {
  const c = canonicalize(value);
  if (c.kind === "err") throw new Error(c.error.reason);
  return c.value;
}

// ---------------------------------------------------------------------------------------------------------------------------- OCSF

proves(
  [OCSF],
  "a finding is a Compliance Finding: class 2003, type_uid, status and severity mapped, the control in compliance",
  async () => {
    const a = await fixture();
    const events = complianceFindings(a, { product: PRODUCT });
    assertEquals(events.length, a.findings.length);
    for (const [i, e] of events.entries()) {
      const f = a.findings[i];
      assert(f !== undefined);
      assertEquals([e.class_uid, e.category_uid, e.activity_id, e.type_uid], [2003, 2, 1, 200301]);
      assertEquals(e.type_uid, e.class_uid * 100 + e.activity_id);
      assertEquals(e.severity_id, OCSF_SEVERITY[f.severity].id);
      assertEquals(e.metadata, { version: "1.9.0", product: PRODUCT });
      assertEquals(e.time, epochMs(f.at));
      assertEquals(e.finding_info.uid, findingKey(f));
      assertEquals(e.finding_info.created_time, e.time);
      assertEquals(e.compliance.control, f.control.id);
      assertEquals(e.compliance.status_code, f.status);
      assertEquals(e.resources, [{ uid: `host:${f.subject.id}`, name: f.subject.id, type: "host" }]);
    }
    const by = (control: string, subject: string): ComplianceFindingEvent => {
      const e = events.find((x) => x.compliance.control === control && x.resources[0]?.name === subject);
      assert(e !== undefined, `${control} ${subject}`);
      return e;
    };
    const passed = by("disk-encryption", "a");
    assertEquals([passed.compliance.status_id, passed.compliance.status, passed.status_id, passed.status], [1, "Pass", 4, "Resolved"]);
    assertEquals(passed.compliance.standards, ["example"]);
    assertEquals(passed.compliance.requirements, ["example:EX-1", "example:EX-2"]);
    assertEquals(passed.severity_id, 4);
    assertEquals(passed.remediation, undefined);
    const accepted = by("disk-encryption", "b");
    assertEquals([accepted.compliance.status_id, accepted.status_id, accepted.status], [3, 3, "Suppressed"]);
    assertEquals(accepted.compliance.status_details, ["accepted under waiver W-1"]);
    assertEquals(accepted.remediation, { desc: "Turn on full-disk encryption." });
    assertEquals(accepted.evidences?.length, 1);
    const failed = by("disk-encryption", "c");
    assertEquals([failed.compliance.status_id, failed.status_id, failed.finding_info.desc], [3, 1, "the disk is plain"]);
    const warned = by("patch-level", "b");
    assertEquals([warned.compliance.status_id, warned.status_id, warned.severity_id], [2, 1, 3]);
    const errored = by("owner-named", "c");
    assertEquals([errored.compliance.status_id, errored.compliance.status, errored.severity_id], [0, "Unknown", 2]);
    assertEquals(errored.compliance.standards, ["owner-named"]);
    const na = by("owner-named", "a");
    assertEquals([na.compliance.status_id, na.compliance.status, na.status_id], [99, "Not Applicable", 4]);
    const first = a.findings[0];
    assert(first !== undefined);
    const closed = complianceFinding(first, { product: PRODUCT, activity: "close" });
    assertEquals([closed.activity_id, closed.type_uid, closed.type_name], [3, 200303, "Compliance Finding: Close"]);
    expectType<Equal<OcsfComplianceFinding["class_uid"], 2003>>();
    expectType<Equal<ComplianceFindingEvent["type_uid"], 200301 | 200302 | 200303>>();
    expectType<Equal<DeviceInventoryEvent["class_uid"], 5001>>();
    const tagged = complianceFinding(first, { product: PRODUCT, metadata: { tenant_uid: "fleet-1", labels: ["nightly"] } });
    assertEquals(tagged.metadata, { tenant_uid: "fleet-1", labels: ["nightly"], version: "1.9.0", product: PRODUCT });
  },
);

const arbInstant = fc.integer({ min: 0, max: 4_000_000_000_000 }).map((ms) => {
  const i = instantFromEpochMs(ms);
  if (i === undefined) throw new Error("an instant");
  return i;
});
const arbControl: fc.Arbitrary<ControlSummary> = fc.record(
  {
    id: fc.constantFrom("c-1", "c-2", "c-3"),
    title: fc.string({ minLength: 1, maxLength: 8 }),
    implements: fc.uniqueArray(
      fc.record({ catalog: fc.constantFrom("alpha", "beta"), id: fc.constantFrom("A-1", "A-2", "B-1") }, { noNullPrototype: true }),
      { maxLength: 3, selector: (r) => `${r.catalog}/${r.id}` },
    ),
    severity: fc.constantFrom(...SEVERITIES),
    cadence: fc.constant("P1D"),
  },
  { noNullPrototype: true },
);
const arbDigest: fc.Arbitrary<Sha256> = fc.uint8Array({ minLength: 32, maxLength: 32 }).map((b) => {
  let hex = "";
  for (const x of b) hex += x.toString(16).padStart(2, "0");
  return hex as Sha256; // 64 lower-case hexadecimal digits by construction
});
const arbFinding: fc.Arbitrary<Finding> = fc
  .record(
    {
      control: arbControl,
      subject: fc.record({ kind: fc.constantFrom("host", "repo"), id: fc.constantFrom("a", "b", "c", "d") }, { noNullPrototype: true }),
      status: fc.constantFrom(...STATUSES),
      accept: fc.boolean(),
      severity: fc.constantFrom(...SEVERITIES),
      title: fc.string({ minLength: 1, maxLength: 12 }),
      detail: fc.string({ maxLength: 12 }),
      evidence: fc.array(arbDigest, { maxLength: 2 }),
      at: arbInstant,
    },
    { noNullPrototype: true },
  )
  .map(({ accept, ...f }) =>
    accept && (f.status === "fail" || f.status === "warn") ? { ...f, outcome: "accepted", waiver: "W-9" } : { ...f, outcome: f.status },
  );

proves(
  [OCSF],
  "for any finding: type_uid = class_uid * 100 + activity_id, the severity and statuses from their tables, canonical JSON",
  () => {
    fc.assert(
      fc.property(arbFinding, fc.constantFrom("create" as const, "update" as const, "close" as const), (f, activity) => {
        const e = complianceFinding(f, { product: PRODUCT, activity });
        assertEquals(e.type_uid, e.class_uid * 100 + e.activity_id);
        assertEquals(e.severity_id, OCSF_SEVERITY[f.severity].id);
        assert([0, 1, 2, 3, 99].includes(e.compliance.status_id));
        assertEquals(e.status_id === 3, f.outcome === "accepted");
        assertEquals(e.status_id === 4, f.outcome === "pass" || f.outcome === "not-applicable");
        assert(OUTCOMES.includes(f.outcome));
        assertEquals(canonicalize(e).kind, "ok");
        assertEquals(canonical(complianceFinding(f, { product: PRODUCT, activity })), canonical(e));
      }),
    );
  },
);

proves([OCSF], "an inventory is Device Inventory Info events (class 5001), each subject once, ordered by kind and id", () => {
  const events = inventory(
    [
      { subject: { kind: "host", id: "b" }, type: 1, hostname: "b.example.com" },
      { subject: { kind: "host", id: "a" } },
      { subject: { kind: "host", id: "b" }, type: 3 },
    ],
    { product: PRODUCT, at: AT },
  );
  assertEquals(
    events.map((e) => [e.class_uid, e.category_uid, e.activity_id, e.type_uid, e.device.uid, e.device.type_id, e.device.type]),
    [
      [5001, 5, 2, 500102, "host:a", 0, "Unknown"],
      [5001, 5, 2, 500102, "host:b", 1, "Server"],
    ],
  );
  assertEquals(events[1]?.device.hostname, "b.example.com");
  assertEquals(events[0]?.time, epochMs(AT));
  assertEquals(events[0]?.metadata.version, "1.9.0");
  assertEquals(
    [events[0]?.class_name, events[0]?.type_name, events[0]?.device.groups],
    ["Device Inventory Info", "Device Inventory Info: Collect", [{ name: "host" }]],
  );
  const logged = inventory([{ subject: { kind: "host", id: "a" } }], { product: PRODUCT, at: AT, activity: "log" });
  assertEquals([logged[0]?.activity_id, logged[0]?.type_uid], [1, 500101]);
});

proves(
  [OCSF],
  "the OCSF 1.9.0 classes the harnesses emit: vulnerability findings and user, device and cloud resources inventories, envelope and metadata",
  () => {
    assertEquals(OCSF_VERSION, "1.9.0");
    assertEquals(
      Object.values(OCSF_CLASSES).map((c) => [c.uid, c.category_uid]),
      [
        [2003, 2],
        [2002, 2],
        [5001, 5],
        [5003, 5],
        [5023, 5],
      ],
    );
    const o = { product: PRODUCT, at: AT, metadata: { tenant_uid: "fleet-1" } };
    const vuln = vulnerabilityFinding(
      {
        uid: "scanner:42",
        title: "Outdated library",
        severity: "high",
        status: "suppressed",
        vulnerabilities: [{ title: "Outdated library", cve: { uid: "CVE-2026-0001" }, is_fix_available: true }],
        resources: [{ uid: "repo:a", name: "a" }],
        findingInfo: { data_sources: ["scanner"], first_seen_time: epochMs(AT) },
      },
      o,
    );
    assertEquals(
      [vuln.class_uid, vuln.category_uid, vuln.activity_id, vuln.type_uid, vuln.severity_id, vuln.severity, vuln.status_id, vuln.status],
      [2002, 2, 1, 200201, 4, "High", 3, "Suppressed"],
    );
    assertEquals(vuln.finding_info, {
      data_sources: ["scanner"],
      first_seen_time: epochMs(AT),
      uid: "scanner:42",
      title: "Outdated library",
    });
    const unknown = vulnerabilityFinding(
      { uid: "u", title: "t", vulnerabilities: [{ advisory: { uid: "ADV-1" } }] },
      { ...o, activity: "close" },
    );
    assertEquals([unknown.severity_id, unknown.status_id, unknown.type_uid, unknown.resources], [0, 0, 200203, undefined]);
    const person = userInventoryInfo(
      { uid: "person:1", type_id: 1, type: "User", email_addr: "person@example.com" },
      { ...o, metadata: { ...o.metadata, uid: "person:1", labels: ["person"] } },
    );
    const account = userInventoryInfo(
      { uid: "acct:1", name: "account", account: { uid: "tenant", type_id: 99, type: "Example" } },
      { ...o, metadata: { ...o.metadata, uid: "acct:1", correlation_uid: "person:1" }, activity: "log" },
    );
    assertEquals(
      [person.class_uid, person.type_uid, person.metadata.labels, account.type_uid, account.metadata.correlation_uid],
      [5003, 500302, ["person"], 500301, "person:1"],
    );
    const device: OcsfDevice = { uid: "d-1", type_id: 12, type: "Router", hostname: "r.example.com" };
    const dev = deviceInventoryInfo(device, { ...o, unmapped: { is_encrypted: true } });
    assertEquals([dev.class_uid, dev.type_uid, dev.device, dev.unmapped], [5001, 500102, device, { is_encrypted: true }]);
    const cloud = cloudResourcesInventoryInfo([{ uid: "repo:a", name: "a", type: "code_repository", labels: ["repository"] }], o);
    assertEquals(
      [cloud.class_uid, cloud.category_name, cloud.type_uid, cloud.type_name, cloud.resources.length],
      [5023, "Discovery", 502302, "Cloud Resources Inventory Info: Collect", 1],
    );
    const events: readonly OcsfEvent[] = [vuln, unknown, person, account, dev, cloud];
    for (const e of events) {
      assertEquals(e.type_uid, e.class_uid * 100 + e.activity_id);
      assertEquals(e.metadata.version, "1.9.0");
      assertEquals(e.metadata.tenant_uid, "fleet-1");
      assertEquals(e.time, epochMs(AT));
      assertEquals(canonicalize(e).kind, "ok");
    }
    expectType<Equal<VulnerabilityFindingEvent["class_uid"], 2002>>();
    expectType<Equal<UserInventoryEvent["class_uid"], 5003>>();
    expectType<Equal<CloudResourcesInventoryEvent["class_uid"], 5023>>();
    // @ts-expect-error a device must have its type_id (required in OCSF 1.9.0)
    const typeless: OcsfDevice = { uid: "d-2" };
    // @ts-expect-error a vulnerability finding must have at least one vulnerability
    const none: Parameters<typeof vulnerabilityFinding>[0] = { uid: "u", title: "t", vulnerabilities: [] };
    assert(typeless.uid === "d-2" && none.uid === "u");
  },
);

// ---------------------------------------------------------------------------------------------------------------------------- OSCAL

function checkUuids(doc: unknown): void {
  const defined = new Set<string>();
  const referenced: string[] = [];
  walk(doc, (key, v) => {
    if (typeof v !== "string") return;
    if (key === "uuid") {
      const u = uuidOf(v);
      assert(u !== undefined && uuidVersion(u) === 5, `a version 5 UUID: ${v}`);
      assert(!defined.has(v), `the uuid ${v} is defined once`);
      defined.add(v);
    } else if (key.endsWith("-uuid")) referenced.push(v);
  });
  for (const r of referenced) assert(defined.has(r), `the reference ${r} is defined`);
  walk(doc, (key, v) => {
    if (typeof v === "string") assert(v !== "" && v.trim() === v, `an OSCAL string at ${key}: ${JSON.stringify(v)}`);
  });
}

proves(
  [OSCAL],
  "assessment results: OSCAL 1.2.3 metadata, observations per finding, findings per control, every uuid a v5 UUID",
  async () => {
    const a = await fixture();
    const o = await options();
    const doc = await assessmentResults(a, o);
    const ar = doc["assessment-results"];
    assertEquals(ar.metadata["oscal-version"], "1.2.3");
    assertEquals(ar.metadata["last-modified"], AT);
    assertEquals(ar.metadata.version, "1.0");
    assertEquals(ar.metadata.parties?.[0]?.name, "Example Org");
    assertEquals(ar.uuid, await uuidV5(o.namespace, JSON.stringify(["assessment-results", "hosts", AT])));
    checkUuids(doc);
    assert(ar["import-ap"].href === `#${ar["back-matter"]?.resources[0]?.uuid ?? ""}`);
    const result = ar.results[0];
    assert(result !== undefined);
    assertEquals(result.observations?.length, a.findings.length);
    assertEquals(result["local-definitions"]?.["inventory-items"].length, 3);
    assertEquals(result["reviewed-controls"], {
      "control-selections": [{ "include-controls": [{ "control-id": "EX-1" }, { "control-id": "EX-2" }, { "control-id": "owner-named" }] }],
    });
    const status = Object.fromEntries((result.findings ?? []).map((f) => [f.target["target-id"], f.target.status]));
    assertEquals(status, {
      "EX-1": { state: "not-satisfied", reason: "fail" },
      "EX-2": { state: "not-satisfied", reason: "fail" },
      "owner-named": { state: "not-satisfied", reason: "other" },
    });
    const other = await assessmentResults(a, { ...o, namespace: await uuidV5(NAMESPACE_URL, "https://example.com/other") });
    assertNotEquals(other["assessment-results"].uuid, ar.uuid);
  },
);

proves(
  [OSCAL],
  "POA&M: an item and a risk for each finding not passing and each register risk, waived ones deviation-approved",
  async () => {
    const a = await fixture();
    const doc = await poam(a, RISKS, await options());
    checkUuids(doc);
    const p = doc["plan-of-action-and-milestones"];
    const risks = p.risks ?? [];
    const open = a.findings.filter((f) => ["fail", "warn", "gap", "error", "accepted"].includes(f.outcome));
    assertEquals(open.length, 4);
    assertEquals(p["poam-items"].length, open.length + RISKS.length);
    assertEquals(risks.length, open.length + RISKS.length);
    assertEquals(risks.filter((r) => r.status === "deviation-approved").length, 2);
    const register = risks.filter((r) => r.characterizations !== undefined);
    assertEquals(
      register.map((r) => r.title),
      ["Vendor outage", "Lost laptop"],
    );
    assertEquals(
      register[1]?.characterizations?.[0]?.facets.map((f) => [f.name, f.value]),
      [
        ["likelihood", "moderate"],
        ["impact", "very-high"],
        ["risk", "high"],
      ],
    );
    assertEquals(register[1]?.status, "remediating");
    // A finding's risk is named by its control and subject, not its time: the same open finding keeps its UUID.
    const later = await poam({ ...a, at: at("2026-04-01T00:00:00Z") }, RISKS, await options());
    assertEquals(
      later["plan-of-action-and-milestones"].risks?.map((r) => r.uuid),
      risks.map((r) => r.uuid),
    );
  },
);

proves([OSCAL], "component definition and SSP: what the controls implement, and how far, from the assessment", async () => {
  const a = await fixture();
  const o = await options();
  const cd = await componentDefinition(
    a.controls,
    { id: "checker", title: "Example Checker", description: "Checks hosts.", version: "1.0.0" },
    o,
  );
  checkUuids(cd);
  const component = cd["component-definition"].components[0];
  const impl = component?.["control-implementations"]?.[0];
  assert(impl !== undefined);
  assertEquals(impl.source, `#${cd["component-definition"]["back-matter"]?.resources[0]?.uuid ?? ""}`);
  assertEquals(
    impl["implemented-requirements"].map((r) => [r["control-id"], r.props.map((p) => p.value)]),
    [
      ["EX-1", ["disk-encryption"]],
      ["EX-2", ["disk-encryption", "patch-level"]],
    ],
  );
  const lower = await componentDefinition(
    a.controls,
    { id: "checker", title: "C", description: "D", type: "resource-container" },
    {
      ...o,
      controlId: (r) => r.id.toLowerCase(),
      catalogHref: (c) => `https://example.com/catalogs/${c}.json`,
    },
  );
  const li = lower["component-definition"].components[0]?.["control-implementations"]?.[0];
  assertEquals(li?.source, "https://example.com/catalogs/example.json");
  assertEquals(
    li?.["implemented-requirements"].map((r) => r["control-id"]),
    ["ex-1", "ex-2"],
  );
  assertEquals(lower["component-definition"]["back-matter"], undefined);
  assertEquals(lower["component-definition"].components[0]?.type, "resource-container");
  assertEquals(cd["component-definition"].metadata["oscal-version"], "1.2.3");

  const ssp = await systemSecurityPlan(
    a,
    { id: "hosts", name: "Example hosts", description: "The hosts.", profile: "https://example.com/profiles/baseline.json" },
    o,
  );
  checkUuids(ssp);
  const plan = ssp["system-security-plan"];
  assertEquals(plan["import-profile"].href, "https://example.com/profiles/baseline.json");
  assertEquals(
    plan["control-implementation"]["implemented-requirements"].map((r) => [
      r["control-id"],
      r["by-components"][0]?.["implementation-status"].state,
    ]),
    [
      ["owner-named", "partial"],
      ["EX-1", "partial"],
      ["EX-2", "partial"],
    ],
  );
  const allPass: Assessment = { ...a, findings: a.findings.map((f) => ({ ...f, status: "pass", outcome: "pass" })) };
  const good = await systemSecurityPlan(allPass, { id: "hosts", name: "Example hosts", description: "The hosts.", profile: "#p" }, o);
  assert(
    good["system-security-plan"]["control-implementation"]["implemented-requirements"].every(
      (r) => r["by-components"][0]?.["implementation-status"].state === "implemented",
    ),
  );
});

proves(
  [OSCAL],
  "the same assessment gives byte-identical OSCAL, rendered twice and with its findings, controls and risks in any order",
  async () => {
    const a = await fixture();
    const o = await options();
    const render = async (x: Assessment, risks: readonly Risk[]): Promise<readonly string[]> => [
      renderOscal(await assessmentResults(x, o)),
      renderOscal(await poam(x, risks, o)),
      renderOscal(await componentDefinition(x.controls, { id: "checker", title: "Checker", description: "Checks." }, o)),
      renderOscal(await systemSecurityPlan(x, { id: "s", name: "S", description: "The system.", profile: "#p" }, o)),
    ];
    const first = await render(a, RISKS);
    assertEquals(await render(a, RISKS), first);
    assertEquals(
      first.map((t) => canonical(JSON.parse(t))),
      (await render(a, RISKS)).map((t) => canonical(JSON.parse(t))),
    );
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 2 ** 31 }), async (seed) => {
        const x: Assessment = {
          ...a,
          controls: shuffled(a.controls, seed),
          subjects: shuffled(a.subjects, seed + 1),
          findings: shuffled(a.findings, seed + 2),
        };
        assertEquals(await render(x, shuffled(RISKS, seed + 3)), first);
      }),
      { numRuns: 20 },
    );
  },
);

proves([OSCAL], "for any findings, the assessment results do not depend on their order and every uuid is a distinct v5 UUID", async () => {
  const o = await options();
  await fc.assert(
    fc.asyncProperty(fc.array(arbFinding, { maxLength: 8 }), fc.integer({ min: 1, max: 2 ** 31 }), async (findings, seed) => {
      const controls = [...new Map(findings.map((f) => [f.control.id, f.control])).values()];
      const a: Assessment = { pack: { id: "p", title: "P" }, at: AT, controls, subjects: findings.map((f) => f.subject), findings };
      const doc = await assessmentResults(a, o);
      checkUuids(doc);
      const again = await assessmentResults({ ...a, findings: shuffled(findings, seed), subjects: shuffled(a.subjects, seed) }, o);
      assertEquals(renderOscal(again), renderOscal(doc));
    }),
    { numRuns: 25 },
  );
});

// ---------------------------------------------------------------------------------------------------------------------------- CycloneDX and in-toto

const CDX_OPTIONS = async (): Promise<Parameters<typeof cyclonedxBom>[1]> => ({
  namespace: (await options()).namespace,
  assessor: { name: "Example Org", thirdParty: false },
  target: { name: "Example hosts" },
  tool: { name: "Example Checker", version: "1.0.0" },
  standards: { example: { name: "Example catalog", version: "1.0" } },
});

proves([CDX], "an assessment is a CycloneDX 1.6 BOM of declarations whose references all resolve", async () => {
  const a = await fixture();
  const o = await CDX_OPTIONS();
  const bom = await cyclonedxBom(a, o);
  assertEquals([bom.bomFormat, bom.specVersion, bom.version], ["CycloneDX", "1.6", 1]);
  const serial = uuidOf(bom.serialNumber);
  assert(serial !== undefined && uuidVersion(serial) === 5 && bom.serialNumber.startsWith("urn:uuid:"));
  assertEquals(bom.metadata.timestamp, AT);
  const d = bom.declarations;
  const requirements = new Set(bom.definitions.standards.flatMap((s) => s.requirements.map((r) => r["bom-ref"])));
  const claims = new Set(d.claims.map((c) => c["bom-ref"]));
  const evidence = new Set(d.evidence.map((e) => e["bom-ref"]));
  const targets = new Set(d.targets.components.map((c) => c["bom-ref"]));
  assertEquals(
    bom.definitions.standards.map((s) => [s.name, s.version, s.requirements.map((r) => r.identifier)]),
    [
      ["Example catalog", "1.0", ["EX-1", "EX-2"]],
      ["hosts", undefined, ["owner-named"]],
    ],
  );
  assertEquals(evidence.size, a.findings.length);
  assertEquals(
    d.assessors.map((x) => x["bom-ref"]),
    [d.attestations[0]?.assessor],
  );
  for (const c of d.claims) {
    assert(targets.has(c.target));
    for (const e of [...(c.evidence ?? []), ...(c.counterEvidence ?? [])]) assert(evidence.has(e), e);
  }
  const map = d.attestations[0]?.map ?? [];
  assertEquals(map.length, requirements.size);
  for (const m of map) {
    assert(requirements.has(m.requirement));
    for (const c of [...m.claims, ...(m.counterClaims ?? [])]) assert(claims.has(c));
    assert(m.conformance.score >= 0 && m.conformance.score <= 1);
  }
  assertEquals(
    map.map((m) => [m.requirement, m.conformance.score, m.counterClaims !== undefined]),
    [
      ["requirement:example/EX-1", 0.333, true],
      ["requirement:example/EX-2", 0.5, true],
      ["requirement:hosts/owner-named", 0, true],
    ],
  );
  const withDigest = d.evidence.find((e) => e.data !== undefined);
  assert(withDigest?.data?.[0]?.contents.url.startsWith("ni:///sha-256;") === true);
});

proves([CDX], "the same assessment gives the same BOM in any order, and digests are RFC 6920 ni URIs", async () => {
  assertEquals(niUri(await sha256("")), "ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU");
  const a = await fixture();
  const o = await CDX_OPTIONS();
  const first = canonical(await cyclonedxBom(a, o));
  assertEquals(JSON.stringify(await cyclonedxBom(a, o)), JSON.stringify(await cyclonedxBom(a, o)));
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 2 ** 31 }), async (seed) => {
      const x: Assessment = { ...a, controls: shuffled(a.controls, seed), findings: shuffled(a.findings, seed + 1) };
      assertEquals(canonical(await cyclonedxBom(x, o)), first);
    }),
    { numRuns: 20 },
  );
});

proves(
  [CDX],
  "an in-toto Statement v1 keeps its predicate type, and signs and verifies through DSSE with Ed25519 and ECDSA keys",
  async () => {
    const a = await fixture();
    const bom = await cyclonedxBom(a, await CDX_OPTIONS());
    const bytes = new TextEncoder().encode(JSON.stringify(bom));
    const s = bomStatement(bom, [await digestSubject("bom.json", bytes)]);
    assertEquals(s._type, "https://in-toto.io/Statement/v1");
    assertEquals(s.predicateType, CYCLONEDX_PREDICATE_TYPE);
    assertEquals(s.subject[0]?.digest.sha256, await sha256(bytes));
    expectType<Equal<typeof s.predicateType, "https://cyclonedx.org/bom">>();
    expectType<Equal<typeof s, TypedStatement<"https://cyclonedx.org/bom", CdxBom>>>();
    const note = intotoStatement([await digestSubject("a.txt", new TextEncoder().encode("a"))], "https://example.com/Note/v1", {
      note: "hi",
    });
    expectType<Equal<typeof note.predicateType, "https://example.com/Note/v1">>();
    // @ts-expect-error a statement of another predicate type is not a CycloneDX statement
    const wrong: TypedStatement<typeof CYCLONEDX_PREDICATE_TYPE, { readonly note: string }> = note;
    assert(wrong.predicateType !== CYCLONEDX_PREDICATE_TYPE);

    for (const params of [{ name: "Ed25519" }, { name: "ECDSA", namedCurve: "P-256" }]) {
      const keys = await crypto.subtle.generateKey(params, false, ["sign", "verify"]);
      assert("privateKey" in keys);
      const signed = await signStatement(s, [{ key: keys.privateKey, keyid: "assessor" }]);
      assert(signed.kind === "ok");
      const verified = await verifyStatement(signed.value, [{ key: keys.publicKey, keyid: "assessor" }], unknownValue);
      assert(verified.kind === "ok", params.name);
      assertEquals(canonical(verified.value), canonical(s));
      const noted = await signStatement(note, [{ key: keys.privateKey }]);
      assert(noted.kind === "ok");
      const back = await verifyStatement(noted.value, [{ key: keys.publicKey }], object({ note: string }));
      assert(back.kind === "ok");
      assertEquals(back.value.predicate, { note: "hi" });
      const other = await crypto.subtle.generateKey(params, false, ["sign", "verify"]);
      assert("publicKey" in other);
      assertEquals((await verifyStatement(signed.value, [{ key: other.publicKey }], unknownValue)).kind, "err");
    }
  },
);
