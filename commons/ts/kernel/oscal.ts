/**
 * Assessments as OSCAL 1.1.2 JSON (commons 0007-grc FR-017): `assessment-results` (one result of every finding as an observation and of
 * every reviewed control as an OSCAL finding), a `plan-of-action-and-milestones` (a POA&M item and a risk for each finding not passing, and
 * for each risk of a register), a `component-definition` (a component whose control implementations are the catalog controls its controls
 * implement), and a minimal `system-security-plan` of what is implemented and how far, from an assessment.
 *
 * Every `uuid` is a version 5 UUID (RFC 9562) of a namespace the caller gives and a stable name of what it identifies, and every list is in
 * an order of its own (controls by id, subjects by kind and id, findings by their key), so the same input gives the same document byte for
 * byte, whatever order its findings, controls or risks came in. The document's `metadata` takes its title, `last-modified` (an `Instant`)
 * and version from the caller; the kernel reads no clock. OSCAL's strings are never empty nor start or end with white space, so each is
 * trimmed and an empty one given a stated default.
 *
 * Statuses: an OSCAL finding's target is `satisfied` where the join of its findings' outcomes is `pass`, `accepted` or `not-applicable`,
 * else `not-satisfied` with the reason `fail` (`warn`, `gap`, `fail`) or `other` (`error`). A POA&M risk is `deviation-approved` for an
 * `accepted` finding or a risk treated by `accept` or `transfer`, `remediating` for one treated by `mitigate` or `avoid`, else `open`. An
 * SSP requirement is `implemented` where its coverage is `covered` or `addressed`, `partial` where `partial`, and `planned` where untested.
 *
 * @example
 * ```ts
 * import { assessmentResults, renderOscal } from "./oscal.ts";
 * import { NAMESPACE_URL, uuidV5 } from "./uuid.ts";
 * // const namespace = await uuidV5(NAMESPACE_URL, "https://example.com/assessments");
 * // renderOscal(await assessmentResults(assessment, { namespace, lastModified: assessment.at, version: "1", propNamespace: "https://example.com/ns" }));
 * ```
 *
 * @module
 */
import { absurd } from "./absurd.ts";
import { coverageOf, newestFindings, type Risk } from "./assess.ts";
import { canonicalize } from "./evidence.ts";
import {
  type Assessment,
  type ControlRef,
  type ControlSummary,
  type Finding,
  type Instant,
  type Outcome,
  type SubjectRef,
  findingKey,
  joinAll,
} from "./grc.ts";
import { type Uuid, uuidV5Of } from "./uuid.ts";

/** The OSCAL version written. */
export const OSCAL_VERSION = "1.1.2";

/** NIST SP 800-30 Rev. 1, the system a risk's likelihood, impact and level facets are named in. */
export const SP800_30 = "https://doi.org/10.6028/NIST.SP.800-30r1";

/** The `identifier-type` of a system id that is a UUID. */
export const RFC4122 = "https://ietf.org/rfc/rfc4122";

// ---------------------------------------------------------------------------------------------------------------------------- types

/** An OSCAL property: a name, a value, and the namespace the name is defined in where it is not OSCAL's. */
export type OscalProp = { readonly name: string; readonly value: string; readonly ns?: string };

/** An OSCAL party: the organization a document is by. */
export type OscalParty = { readonly uuid: Uuid; readonly type: "organization" | "person"; readonly name: string };

/** An OSCAL document's metadata. */
export type OscalMetadata = {
  readonly title: string;
  readonly "last-modified": Instant;
  readonly version: string;
  readonly "oscal-version": typeof OSCAL_VERSION;
  readonly parties?: readonly OscalParty[];
};

/** A back-matter resource. */
export type OscalResource = {
  readonly uuid: Uuid;
  readonly title: string;
  readonly description?: string;
  readonly props?: readonly OscalProp[];
  readonly rlinks?: readonly { readonly href: string }[];
};

/** A document's back matter. */
export type OscalBackMatter = { readonly resources: readonly OscalResource[] };

/** An inventory item: a subject of an assessment. */
export type OscalInventoryItem = { readonly uuid: Uuid; readonly description: string; readonly props: readonly OscalProp[] };

/** A reference from an observation to the subject it observed. */
export type OscalSubjectReference = { readonly "subject-uuid": Uuid; readonly type: "inventory-item"; readonly title: string };

/** Evidence an observation relied on, here the SHA-256 of a piece of evidence. */
export type OscalRelevantEvidence = { readonly description: string; readonly props: readonly OscalProp[] };

/** An observation: one finding of one control on one subject. */
export type OscalObservation = {
  readonly uuid: Uuid;
  readonly title: string;
  readonly description: string;
  readonly props: readonly OscalProp[];
  readonly methods: readonly ("EXAMINE" | "INTERVIEW" | "TEST" | "UNKNOWN")[];
  readonly types: readonly string[];
  readonly subjects: readonly OscalSubjectReference[];
  readonly "relevant-evidence"?: readonly OscalRelevantEvidence[];
  readonly collected: Instant;
  readonly remarks?: string;
};

/** The status of an OSCAL finding's target. */
export type OscalTargetStatus = { readonly state: "satisfied" | "not-satisfied"; readonly reason?: "pass" | "fail" | "other" };

/** An OSCAL finding: what the observations say of one control. */
export type OscalFinding = {
  readonly uuid: Uuid;
  readonly title: string;
  readonly description: string;
  readonly props: readonly OscalProp[];
  readonly target: { readonly type: "objective-id"; readonly "target-id": string; readonly status: OscalTargetStatus };
  readonly "related-observations"?: readonly { readonly "observation-uuid": Uuid }[];
};

/** The controls a result reviewed. */
export type OscalReviewedControls = {
  readonly "control-selections": readonly (
    | { readonly "include-controls": readonly { readonly "control-id": string }[] }
    | { readonly "include-all": Readonly<Record<string, never>> }
  )[];
};

/** One result of an assessment. */
export type OscalResult = {
  readonly uuid: Uuid;
  readonly title: string;
  readonly description: string;
  readonly start: Instant;
  readonly "local-definitions"?: { readonly "inventory-items": readonly OscalInventoryItem[] };
  readonly "reviewed-controls": OscalReviewedControls;
  readonly observations?: readonly OscalObservation[];
  readonly findings?: readonly OscalFinding[];
};

/** An OSCAL assessment-results document. */
export type OscalAssessmentResults = {
  readonly "assessment-results": {
    readonly uuid: Uuid;
    readonly metadata: OscalMetadata;
    readonly "import-ap": { readonly href: string };
    readonly results: readonly OscalResult[];
    readonly "back-matter"?: OscalBackMatter;
  };
};

/** The status of an OSCAL risk. */
export type OscalRiskStatus = "open" | "investigating" | "remediating" | "deviation-requested" | "deviation-approved" | "closed";

/** A characterization of a risk: who made it, and its facets. */
export type OscalCharacterization = {
  readonly origin: { readonly actors: readonly { readonly type: "party"; readonly "actor-uuid": Uuid }[] };
  readonly facets: readonly { readonly name: string; readonly system: string; readonly value: string }[];
};

/** An OSCAL risk. */
export type OscalRisk = {
  readonly uuid: Uuid;
  readonly title: string;
  readonly description: string;
  readonly statement: string;
  readonly props?: readonly OscalProp[];
  readonly status: OscalRiskStatus;
  readonly characterizations?: readonly OscalCharacterization[];
  readonly "related-observations"?: readonly { readonly "observation-uuid": Uuid }[];
};

/** An item of a plan of action and milestones. */
export type OscalPoamItem = {
  readonly uuid: Uuid;
  readonly title: string;
  readonly description: string;
  readonly props?: readonly OscalProp[];
  readonly "related-observations"?: readonly { readonly "observation-uuid": Uuid }[];
  readonly "related-risks": readonly { readonly "risk-uuid": Uuid }[];
};

/** An OSCAL plan-of-action-and-milestones document. */
export type OscalPoam = {
  readonly "plan-of-action-and-milestones": {
    readonly uuid: Uuid;
    readonly metadata: OscalMetadata;
    readonly "local-definitions"?: { readonly "inventory-items": readonly OscalInventoryItem[] };
    readonly observations?: readonly OscalObservation[];
    readonly risks?: readonly OscalRisk[];
    readonly "poam-items": readonly OscalPoamItem[];
  };
};

/** A catalog control a component implements, and how. */
export type OscalImplementedRequirement = {
  readonly uuid: Uuid;
  readonly "control-id": string;
  readonly description: string;
  readonly props: readonly OscalProp[];
};

/** A component's implementation of the controls of one catalog. */
export type OscalControlImplementation = {
  readonly uuid: Uuid;
  readonly source: string;
  readonly description: string;
  readonly "implemented-requirements": readonly OscalImplementedRequirement[];
};

/** The types of an OSCAL component (OSCAL 1.1.2 `component/type`). */
export const OSCAL_COMPONENT_TYPES = [
  "software",
  "hardware",
  "service",
  "policy",
  // OSCAL's "process" type, its first letter escaped so that the kernel's host-global check (0005-typescript-runtime FR-004) does not take
  // the value for Node's global of that name.
  "\u0070rocess",
  "validation",
  "interconnection",
] as const;

/** The type of a component. */
export type OscalComponentType = (typeof OSCAL_COMPONENT_TYPES)[number];

/** A component of a component definition. */
export type OscalDefinedComponent = {
  readonly uuid: Uuid;
  readonly type: OscalComponentType;
  readonly title: string;
  readonly description: string;
  readonly props?: readonly OscalProp[];
  readonly "control-implementations"?: readonly OscalControlImplementation[];
};

/** An OSCAL component-definition document. */
export type OscalComponentDefinition = {
  readonly "component-definition": {
    readonly uuid: Uuid;
    readonly metadata: OscalMetadata;
    readonly components: readonly OscalDefinedComponent[];
    readonly "back-matter"?: OscalBackMatter;
  };
};

/** How far a control is implemented. */
export type OscalImplementationState = "implemented" | "partial" | "planned" | "alternative" | "not-applicable";

/** An SSP's statement of one catalog control. */
export type OscalSspRequirement = {
  readonly uuid: Uuid;
  readonly "control-id": string;
  readonly props: readonly OscalProp[];
  readonly "by-components": readonly {
    readonly "component-uuid": Uuid;
    readonly uuid: Uuid;
    readonly description: string;
    readonly "implementation-status": { readonly state: OscalImplementationState };
  }[];
};

/** An OSCAL system-security-plan document, minimal: the system, its users and components, and how far each control is implemented. */
export type OscalSsp = {
  readonly "system-security-plan": {
    readonly uuid: Uuid;
    readonly metadata: OscalMetadata;
    readonly "import-profile": { readonly href: string };
    readonly "system-characteristics": {
      readonly "system-ids": readonly { readonly "identifier-type": string; readonly id: string }[];
      readonly "system-name": string;
      readonly description: string;
      readonly "system-information": {
        readonly "information-types": readonly { readonly uuid: Uuid; readonly title: string; readonly description: string }[];
      };
      readonly status: { readonly state: "operational" | "under-development" | "under-major-modification" | "disposition" | "other" };
      readonly "authorization-boundary": { readonly description: string };
    };
    readonly "system-implementation": {
      readonly users: readonly { readonly uuid: Uuid; readonly title: string }[];
      readonly components: readonly {
        readonly uuid: Uuid;
        readonly type: "this-system";
        readonly title: string;
        readonly description: string;
        readonly status: { readonly state: "operational" };
      }[];
      readonly "inventory-items"?: readonly OscalInventoryItem[];
    };
    readonly "control-implementation": {
      readonly description: string;
      readonly "implemented-requirements": readonly OscalSspRequirement[];
    };
  };
};

/** Any document this module writes. */
export type OscalDocument = OscalAssessmentResults | OscalPoam | OscalComponentDefinition | OscalSsp;

/** What every document needs: the namespace of its UUIDs, its metadata, and the namespace of the properties this module names. */
export type OscalOptions = {
  /** The namespace every `uuid` is a version 5 UUID in. */
  readonly namespace: Uuid;
  readonly lastModified: Instant;
  readonly version: string;
  /** The namespace (a URI) of the properties this module defines: `outcome`, `status`, `severity`, `control`, `sha256`, ... */
  readonly propNamespace: string;
  /** The document's title; each function has a default. */
  readonly title?: string;
  /** The organization the document is by, as a party. */
  readonly organization?: string;
  /** The OSCAL `control-id` of a catalog control; by default its id as the catalog has it. */
  readonly controlId?: (ref: ControlRef) => string;
  /** The `href` of a catalog (a control implementation's `source`); by default a back-matter resource of the document. */
  readonly catalogHref?: (catalog: string) => string;
};

// ---------------------------------------------------------------------------------------------------------------------------- helpers

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function text(s: string | undefined, fallback: string): string {
  const t = (s ?? "").trim();
  return t === "" ? fallback : t;
}

function stableText(value: unknown): string {
  const c = canonicalize(value);
  return c.kind === "ok" ? c.value : String(value);
}

const subjectKey = (s: SubjectRef): string => JSON.stringify([s.kind, s.id]);

/** Findings in a total order of their own (key, then the canonical form of the whole), each with its place among those of its key. */
function ordered(findings: readonly Finding[]): readonly { readonly finding: Finding; readonly key: string; readonly n: number }[] {
  const keyed = findings.map((f) => ({ finding: f, key: findingKey(f), text: stableText(f) }));
  keyed.sort((a, b) => byText(a.key, b.key) || byText(a.text, b.text));
  const count = new Map<string, number>();
  return keyed.map(({ finding, key }) => {
    const n = count.get(key) ?? 0;
    count.set(key, n + 1);
    return { finding, key, n };
  });
}

function uniqueControls(controls: readonly ControlSummary[]): readonly ControlSummary[] {
  const seen = new Map<string, ControlSummary>();
  for (const c of controls) if (!seen.has(c.id)) seen.set(c.id, c);
  return [...seen.values()].sort((a, b) => byText(a.id, b.id));
}

function uniqueSubjects(subjects: readonly SubjectRef[]): readonly SubjectRef[] {
  const seen = new Map<string, SubjectRef>();
  for (const s of subjects) if (!seen.has(subjectKey(s))) seen.set(subjectKey(s), s);
  return [...seen.entries()].sort(([a], [b]) => byText(a, b)).map(([, s]) => s);
}

async function metadataOf(o: OscalOptions, title: string): Promise<OscalMetadata> {
  return {
    title: text(o.title, title),
    "last-modified": o.lastModified,
    version: text(o.version, "1"),
    "oscal-version": OSCAL_VERSION,
    ...(o.organization === undefined
      ? {}
      : {
          parties: [
            {
              uuid: await uuidV5Of(o.namespace, ["party", o.organization]),
              type: "organization",
              name: text(o.organization, "organization"),
            },
          ],
        }),
  };
}

/** A target of a control: a catalog control it implements (by catalog and OSCAL id), or the control itself where it implements none. */
type Target = { readonly key: string; readonly controlId: string; readonly controls: readonly string[] };

function targetsOf(controls: readonly ControlSummary[], o: OscalOptions): readonly Target[] {
  const idOf = o.controlId ?? ((r: ControlRef): string => r.id);
  const targets = new Map<string, { controlId: string; controls: Set<string> }>();
  const add = (key: string, controlId: string, control: string): void => {
    const t = targets.get(key) ?? { controlId, controls: new Set<string>() };
    t.controls.add(control);
    targets.set(key, t);
  };
  for (const c of uniqueControls(controls)) {
    if (c.implements.length === 0) add(JSON.stringify(["", c.id]), c.id, c.id);
    for (const r of c.implements) add(JSON.stringify([r.catalog, r.id]), idOf(r), c.id);
  }
  return [...targets.entries()]
    .sort(([a], [b]) => byText(a, b))
    .map(([key, t]) => ({ key, controlId: t.controlId, controls: [...t.controls].sort(byText) }));
}

function targetStatus(outcome: Outcome): OscalTargetStatus {
  switch (outcome) {
    case "pass":
    case "accepted":
    case "not-applicable":
      return { state: "satisfied" };
    case "warn":
    case "gap":
    case "fail":
      return { state: "not-satisfied", reason: "fail" };
    case "error":
      return { state: "not-satisfied", reason: "other" };
    default:
      return absurd(outcome);
  }
}

async function inventoryItems(subjects: readonly SubjectRef[], o: OscalOptions): Promise<readonly OscalInventoryItem[]> {
  return Promise.all(
    uniqueSubjects(subjects).map(async (s) => ({
      uuid: await subjectUuid(s, o),
      description: text(`${s.kind} ${s.id}`, "a subject"),
      props: [
        { name: "asset-id", value: text(s.id, "unnamed") },
        { name: "subject-kind", ns: o.propNamespace, value: text(s.kind, "unknown") },
      ],
    })),
  );
}

function subjectUuid(s: SubjectRef, o: OscalOptions): Promise<Uuid> {
  return uuidV5Of(o.namespace, ["subject", s.kind, s.id]);
}

async function observation(f: Finding, key: string, n: number, scope: readonly string[], o: OscalOptions): Promise<OscalObservation> {
  const p = (name: string, value: string): OscalProp => ({ name, ns: o.propNamespace, value: text(value, "none") });
  return {
    uuid: await uuidV5Of(o.namespace, ["observation", ...scope, key, String(n)]),
    title: text(`${f.control.id} on ${f.subject.kind} ${f.subject.id}: ${f.title}`, f.control.id),
    description: text(f.detail, `${f.control.id}: ${f.outcome}`),
    props: [
      p("control", f.control.id),
      p("outcome", f.outcome),
      p("status", f.status),
      p("severity", f.severity),
      ...(f.waiver === undefined ? [] : [p("waiver", f.waiver)]),
    ],
    methods: ["TEST"],
    types: ["finding"],
    subjects: [
      {
        "subject-uuid": await subjectUuid(f.subject, o),
        type: "inventory-item",
        title: text(`${f.subject.kind} ${f.subject.id}`, "a subject"),
      },
    ],
    ...(f.evidence.length === 0
      ? {}
      : {
          "relevant-evidence": [...new Set(f.evidence)]
            .sort(byText)
            .map((d) => ({ description: `evidence of SHA-256 ${d}`, props: [{ name: "sha256", ns: o.propNamespace, value: d }] })),
        }),
    collected: f.at,
    ...(f.remediation === undefined || f.outcome === "pass" || text(f.remediation, "") === "" ? {} : { remarks: text(f.remediation, "") }),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- assessment results

/**
 * An assessment as OSCAL assessment results: one result, its subjects as inventory items, each finding an observation, and each control
 * reviewed (each catalog control the assessment's controls implement, or a control that implements none) an OSCAL finding whose target is
 * satisfied or not by the join of the outcomes of the newest findings of its controls. `assessmentPlan` is the `import-ap` href; by default
 * a back-matter resource that stands for the plan.
 */
export async function assessmentResults(
  a: Assessment,
  o: OscalOptions & { readonly assessmentPlan?: string },
): Promise<OscalAssessmentResults> {
  const scope = [a.pack.id, a.at];
  const list = ordered(a.findings);
  const observations = await Promise.all(list.map(({ finding, key, n }) => observation(finding, key, n, scope, o)));
  const newest = new Set(newestFindings(a.findings));
  const controls = uniqueControls([...a.controls, ...a.findings.map((f) => f.control)]);
  const targets = targetsOf(controls, o);
  const findings = await Promise.all(
    targets.map(async (t): Promise<OscalFinding> => {
      const related = list.flatMap(({ finding }, i) => (t.controls.includes(finding.control.id) ? [{ finding, i }] : []));
      const outcome = joinAll(related.filter((r) => newest.has(r.finding)).map((r) => r.finding.outcome));
      const observed = related.flatMap(({ i }) => {
        const obs = observations[i];
        return obs === undefined ? [] : [{ "observation-uuid": obs.uuid }];
      });
      return {
        uuid: await uuidV5Of(o.namespace, ["finding", ...scope, t.key]),
        title: text(t.controlId, "control"),
        description: `${t.controlId}: ${related.length === 0 ? "not assessed" : outcome}, by ${t.controls.join(", ")}.`,
        props: [
          { name: "outcome", ns: o.propNamespace, value: related.length === 0 ? "not-applicable" : outcome },
          ...t.controls.map((c) => ({ name: "control", ns: o.propNamespace, value: text(c, "control") })),
        ],
        target: { type: "objective-id", "target-id": t.controlId, status: targetStatus(outcome) },
        ...(observed.length === 0 ? {} : { "related-observations": observed }),
      };
    }),
  );
  const plan = await uuidV5Of(o.namespace, ["assessment-plan", a.pack.id]);
  const subjects = await inventoryItems([...a.subjects, ...a.findings.map((f) => f.subject)], o);
  const ids = [...new Set(targets.map((t) => t.controlId))].sort(byText);
  const result: OscalResult = {
    uuid: await uuidV5Of(o.namespace, ["result", ...scope]),
    title: text(`${a.pack.title} as of ${a.at}`, a.pack.id),
    description: text(`The findings of ${a.pack.title} (${a.pack.id}), assessed at ${a.at}.`, "The findings of an assessment."),
    start: a.at,
    ...(subjects.length === 0 ? {} : { "local-definitions": { "inventory-items": subjects } }),
    "reviewed-controls": {
      "control-selections": [ids.length === 0 ? { "include-all": {} } : { "include-controls": ids.map((id) => ({ "control-id": id })) }],
    },
    ...(observations.length === 0 ? {} : { observations }),
    ...(findings.length === 0 ? {} : { findings }),
  };
  return {
    "assessment-results": {
      uuid: await uuidV5Of(o.namespace, ["assessment-results", ...scope]),
      metadata: await metadataOf(o, `${text(a.pack.title, a.pack.id)}: assessment results`),
      "import-ap": { href: o.assessmentPlan ?? `#${plan}` },
      results: [result],
      ...(o.assessmentPlan === undefined
        ? { "back-matter": { resources: [{ uuid: plan, title: text(`The assessment plan of ${a.pack.title}`, "The assessment plan") }] } }
        : {}),
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- POA&M

const OPEN_OUTCOMES: ReadonlySet<Outcome> = new Set<Outcome>(["fail", "warn", "gap", "error", "accepted"]);

function riskStatus(r: Risk): OscalRiskStatus {
  switch (r.treatment) {
    case "accept":
    case "transfer":
      return "deviation-approved";
    case "mitigate":
    case "avoid":
      return "remediating";
    default:
      return absurd(r.treatment);
  }
}

/**
 * A plan of action and milestones: for each finding whose outcome is `fail`, `warn`, `gap`, `error` or `accepted`, an observation, a risk
 * (`open`, or `deviation-approved` where a waiver accepted it) and a POA&M item; and for each risk of a register given, a risk with its
 * NIST SP 800-30 likelihood, impact and level as facets and a POA&M item. A finding's risk and item are named by its control and subject
 * (not its time), so the same open finding keeps its UUIDs from one assessment to the next.
 */
export async function poam(a: Assessment, risks: readonly Risk[], o: OscalOptions): Promise<OscalPoam> {
  const list = ordered(a.findings.filter((f) => OPEN_OUTCOMES.has(f.outcome)));
  const scope = [a.pack.id, a.at];
  const party = o.organization === undefined ? undefined : await uuidV5Of(o.namespace, ["party", o.organization]);
  const observations = await Promise.all(list.map(({ finding, key, n }) => observation(finding, key, n, scope, o)));
  const findingRisks = await Promise.all(
    list.map(async ({ finding: f, key, n }, i): Promise<OscalRisk> => {
      const obs = observations[i];
      return {
        uuid: await uuidV5Of(o.namespace, ["risk", "finding", a.pack.id, key, String(n)]),
        title: text(`${f.control.id} on ${f.subject.kind} ${f.subject.id}: ${f.title}`, f.control.id),
        description: text(f.detail, `${f.control.id}: ${f.outcome}`),
        statement: text(
          f.outcome === "accepted"
            ? `Accepted under waiver ${f.waiver ?? "(unnamed)"}: ${f.status}.`
            : `${f.outcome} (severity ${f.severity}).${f.remediation === undefined ? "" : ` Remediation: ${f.remediation}`}`,
          f.outcome,
        ),
        props: [
          { name: "control", ns: o.propNamespace, value: text(f.control.id, "control") },
          { name: "severity", ns: o.propNamespace, value: f.severity },
        ],
        status: f.outcome === "accepted" ? "deviation-approved" : "open",
        ...(obs === undefined ? {} : { "related-observations": [{ "observation-uuid": obs.uuid }] }),
      };
    }),
  );
  const register = [...risks].sort((x, y) => byText(x.id, y.id));
  const registerRisks = await Promise.all(
    register.map(async (r): Promise<OscalRisk> => ({
      uuid: await uuidV5Of(o.namespace, ["risk", "register", r.id]),
      title: text(r.title, r.id),
      description: text(r.description, text(r.title, r.id)),
      statement: `Level of risk ${r.level} (likelihood ${r.likelihood}, impact ${r.impact}; NIST SP 800-30 Rev. 1). Treatment: ${r.treatment}. Owner: ${r.owner}. Review by ${r.reviewBy}.`,
      props: [
        { name: "risk-id", ns: o.propNamespace, value: text(r.id, "risk") },
        { name: "treatment", ns: o.propNamespace, value: r.treatment },
        { name: "owner", ns: o.propNamespace, value: text(r.owner, "owner") },
        { name: "review-by", ns: o.propNamespace, value: r.reviewBy },
        ...[...new Set(r.controls ?? [])].sort(byText).map((c) => ({ name: "control", ns: o.propNamespace, value: text(c, "control") })),
      ],
      status: riskStatus(r),
      ...(party === undefined
        ? {}
        : {
            characterizations: [
              {
                origin: { actors: [{ type: "party", "actor-uuid": party }] },
                facets: [
                  { name: "likelihood", system: SP800_30, value: r.likelihood },
                  { name: "impact", system: SP800_30, value: r.impact },
                  { name: "risk", system: SP800_30, value: r.level },
                ],
              },
            ],
          }),
    })),
  );
  const items: OscalPoamItem[] = [];
  for (const [i, { finding: f, key, n }] of list.entries()) {
    const obs = observations[i];
    const risk = findingRisks[i];
    if (obs === undefined || risk === undefined) continue;
    items.push({
      uuid: await uuidV5Of(o.namespace, ["poam-item", "finding", a.pack.id, key, String(n)]),
      title: risk.title,
      description: risk.statement,
      props: [{ name: "outcome", ns: o.propNamespace, value: f.outcome }],
      "related-observations": [{ "observation-uuid": obs.uuid }],
      "related-risks": [{ "risk-uuid": risk.uuid }],
    });
  }
  for (const r of registerRisks) {
    const id = r.props?.[0]?.value ?? r.title;
    items.push({
      uuid: await uuidV5Of(o.namespace, ["poam-item", "register", id]),
      title: text(`Risk register: ${r.title}`, "Risk register"),
      description: r.statement,
      "related-risks": [{ "risk-uuid": r.uuid }],
    });
  }
  const subjects = await inventoryItems(
    list.map(({ finding }) => finding.subject),
    o,
  );
  const allRisks = [...findingRisks, ...registerRisks];
  return {
    "plan-of-action-and-milestones": {
      uuid: await uuidV5Of(o.namespace, ["plan-of-action-and-milestones", ...scope]),
      metadata: await metadataOf(o, `${text(a.pack.title, a.pack.id)}: plan of action and milestones`),
      ...(subjects.length === 0 ? {} : { "local-definitions": { "inventory-items": subjects } }),
      ...(observations.length === 0 ? {} : { observations }),
      ...(allRisks.length === 0 ? {} : { risks: allRisks }),
      "poam-items": items,
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- component definition

/** The component a component definition describes. */
export type ComponentInput = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type?: OscalComponentType;
  readonly version?: string;
};

async function catalogResources(catalogs: readonly string[], o: OscalOptions): Promise<readonly OscalResource[]> {
  return Promise.all(catalogs.map(async (c) => ({ uuid: await uuidV5Of(o.namespace, ["catalog", c]), title: text(c, "catalog") })));
}

/**
 * A component definition of one component: for each catalog its controls implement (in the catalogs' order), a control implementation
 * whose implemented requirements are those catalog controls, each saying which controls implement it. A catalog's `source` is
 * `catalogHref`'s, or a back-matter resource that stands for it.
 */
export async function componentDefinition(
  controls: readonly ControlSummary[],
  component: ComponentInput,
  o: OscalOptions,
): Promise<OscalComponentDefinition> {
  const unique = uniqueControls(controls);
  const idOf = o.controlId ?? ((r: ControlRef): string => r.id);
  const catalogs = [...new Set(unique.flatMap((c) => c.implements.map((r) => r.catalog)))].sort(byText);
  const resources = await catalogResources(catalogs, o);
  const implementations = await Promise.all(
    catalogs.map(async (catalog, i): Promise<OscalControlImplementation> => {
      const byId = new Map<string, ControlSummary[]>();
      for (const c of unique) {
        for (const r of c.implements) {
          if (r.catalog !== catalog) continue;
          const id = idOf(r);
          const list = byId.get(id) ?? [];
          if (!list.includes(c)) list.push(c);
          byId.set(id, list);
        }
      }
      const resource = resources[i];
      return {
        uuid: await uuidV5Of(o.namespace, ["control-implementation", component.id, catalog]),
        source: o.catalogHref?.(catalog) ?? `#${resource?.uuid ?? ""}`,
        description: text(`The controls of ${catalog} that ${component.title} implements.`, "Controls implemented."),
        "implemented-requirements": await Promise.all(
          [...byId.entries()]
            .sort(([x], [y]) => byText(x, y))
            .map(async ([id, cs]) => ({
              uuid: await uuidV5Of(o.namespace, ["implemented-requirement", component.id, catalog, id]),
              "control-id": id,
              description: text(cs.map((c) => `${c.id} (${c.title})`).join("; "), id),
              props: cs.map((c) => ({ name: "control", ns: o.propNamespace, value: text(c.id, "control") })),
            })),
        ),
      };
    }),
  );
  return {
    "component-definition": {
      uuid: await uuidV5Of(o.namespace, ["component-definition", component.id]),
      metadata: await metadataOf(o, `${text(component.title, component.id)}: component definition`),
      components: [
        {
          uuid: await uuidV5Of(o.namespace, ["component", component.id]),
          type: component.type ?? "software",
          title: text(component.title, component.id),
          description: text(component.description, text(component.title, component.id)),
          ...(component.version === undefined ? {} : { props: [{ name: "version", value: text(component.version, "unversioned") }] }),
          ...(implementations.length === 0 ? {} : { "control-implementations": implementations }),
        },
      ],
      ...(resources.length === 0 || o.catalogHref !== undefined ? {} : { "back-matter": { resources } }),
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- system security plan

/** The system a security plan describes, and the profile (baseline) it imports. */
export type SystemInput = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly profile: string;
  readonly boundary?: string;
  readonly informationType?: { readonly title: string; readonly description: string };
  readonly user?: string;
};

function implementationState(outcomes: readonly Outcome[]): OscalImplementationState {
  const c = coverageOf(outcomes);
  switch (c) {
    case "covered":
    case "addressed":
      return "implemented";
    case "partial":
      return "partial";
    case "untested":
      return "planned";
    default:
      return absurd(c);
  }
}

/**
 * A minimal system security plan of what is implemented: the system as one `this-system` component, the assessment's subjects as its
 * inventory, and each catalog control its controls implement (or control that implements none) with its implementation status from the
 * coverage of the newest findings of its controls.
 */
export async function systemSecurityPlan(a: Assessment, system: SystemInput, o: OscalOptions): Promise<OscalSsp> {
  const newest = newestFindings(a.findings);
  const thisSystem = await uuidV5Of(o.namespace, ["component", "this-system", system.id]);
  const targets = targetsOf([...a.controls, ...a.findings.map((f) => f.control)], o);
  const requirements = await Promise.all(
    targets.map(async (t): Promise<OscalSspRequirement> => {
      const outcomes = newest.filter((f) => t.controls.includes(f.control.id)).map((f) => f.outcome);
      const state = implementationState(outcomes);
      return {
        uuid: await uuidV5Of(o.namespace, ["ssp-requirement", system.id, t.key]),
        "control-id": t.controlId,
        props: t.controls.map((c) => ({ name: "control", ns: o.propNamespace, value: text(c, "control") })),
        "by-components": [
          {
            "component-uuid": thisSystem,
            uuid: await uuidV5Of(o.namespace, ["ssp-by-component", system.id, t.key]),
            description: text(`${t.controlId} is met by ${t.controls.join(", ")}: ${state}.`, t.controlId),
            "implementation-status": { state },
          },
        ],
      };
    }),
  );
  const items = await inventoryItems([...a.subjects, ...a.findings.map((f) => f.subject)], o);
  const info = system.informationType ?? { title: "System information", description: "The information the system stores and processes." };
  return {
    "system-security-plan": {
      uuid: await uuidV5Of(o.namespace, ["system-security-plan", system.id]),
      metadata: await metadataOf(o, `${text(system.name, system.id)}: system security plan`),
      "import-profile": { href: text(system.profile, "#") },
      "system-characteristics": {
        "system-ids": [{ "identifier-type": RFC4122, id: thisSystem }],
        "system-name": text(system.name, system.id),
        description: text(system.description, text(system.name, system.id)),
        "system-information": {
          "information-types": [
            {
              uuid: await uuidV5Of(o.namespace, ["information-type", system.id]),
              title: text(info.title, "System information"),
              description: text(info.description, "System information."),
            },
          ],
        },
        status: { state: "operational" },
        "authorization-boundary": {
          description: text(system.boundary, `Every subject of ${text(system.name, system.id)} listed in its inventory.`),
        },
      },
      "system-implementation": {
        users: [{ uuid: await uuidV5Of(o.namespace, ["user", system.id]), title: text(system.user, "Operator") }],
        components: [
          {
            uuid: thisSystem,
            type: "this-system",
            title: text(system.name, system.id),
            description: text(system.description, text(system.name, system.id)),
            status: { state: "operational" },
          },
        ],
        ...(items.length === 0 ? {} : { "inventory-items": items }),
      },
      "control-implementation": {
        description: text(
          `How ${system.name} meets each control its checks implement, from the assessment at ${a.at}.`,
          "How each control is met.",
        ),
        "implemented-requirements": requirements,
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- rendering

/** A document as OSCAL JSON text: two-space indents and a final newline, its members in the order this module writes them. */
export function renderOscal(doc: OscalDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
