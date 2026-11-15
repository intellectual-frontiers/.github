/**
 * Findings and inventories as OCSF 1.9.0 events (commons 0007-grc FR-016), typed by the types `tools/ocsf-gen.ts` generates from the
 * pinned OCSF 1.9.0 schema (`ocsf-types.auto.ts`, re-exported here), so a missing required attribute does not compile. The classes are the
 * ones the harnesses emit:
 *
 * | Class | What it is made from |
 * | --- | --- |
 * | 2003 Compliance Finding (category 2 Findings) | a GRC finding (`complianceFinding`) |
 * | 2002 Vulnerability Finding (category 2 Findings) | a scanner's finding and its vulnerabilities (`vulnerabilityFinding`) |
 * | 5001 Device Inventory Info (category 5 Discovery) | a device (`deviceInventoryInfo`), or a subject of an assessment (`inventoryInfo`) |
 * | 5003 User Inventory Info (category 5 Discovery) | a user: a person, or an account of one (`userInventoryInfo`) |
 * | 5023 Cloud Resources Inventory Info (category 5 Discovery) | resources of a cloud or a service (`cloudResourcesInventoryInfo`) |
 *
 * Pure and synchronous: the product that writes the events, the instant of an inventory and any further metadata (`tenant_uid`, `uid`,
 * `correlation_uid`, `labels`) are values the caller gives. `type_uid` is `class_uid * 100 + activity_id`; times are milliseconds since
 * the epoch; findings are activity 1 Create, 2 Update or 3 Close, inventories 1 Log or 2 Collect (the default).
 *
 * How a GRC finding maps (its `status` is kept in `compliance.status_code`, its waiver in `compliance.status_details`):
 *
 * | outcome | `compliance.status_id` | `status_id` (the finding's) |
 * | --- | --- | --- |
 * | `pass` | 1 Pass | 4 Resolved |
 * | `warn` | 2 Warning | 1 New |
 * | `fail`, `gap` | 3 Fail | 1 New |
 * | `accepted` | 2 Warning or 3 Fail, as its status | 3 Suppressed |
 * | `error` | 0 Unknown | 1 New |
 * | `not-applicable` | 99 Other ("Not Applicable") | 4 Resolved |
 *
 * Severity: `info` 1 Informational, `low` 2 Low, `medium` 3 Medium, `high` 4 High, `critical` 5 Critical, none 0 Unknown.
 * `finding_info.uid` is the finding's `findingKey`, the same for the same control and subject in every run, so a later event of the same
 * finding updates it.
 *
 * @example
 * ```ts
 * import { complianceFinding } from "./ocsf.ts";
 * const product = { name: "Example Checker", vendor_name: "Example", version: "1.0.0" };
 * // complianceFinding(finding, { product }).class_uid === 2003
 * ```
 *
 * @module
 */
import { absurd } from "./absurd.ts";
import { type Assessment, type Finding, type Instant, type Outcome, type Severity, type SubjectRef, epochMs, findingKey } from "./grc.ts";
import {
  OCSF_VERSION,
  type OcsfCloudResourcesInventoryInfo,
  type OcsfCompliance,
  type OcsfComplianceFinding,
  type OcsfDevice,
  type OcsfDeviceInventoryInfo,
  type OcsfFindingInfo,
  type OcsfMetadata,
  type OcsfOpenObject,
  type OcsfProduct,
  type OcsfResourceDetails,
  type OcsfUser,
  type OcsfUserInventoryInfo,
  type OcsfVulnerability,
  type OcsfVulnerabilityFinding,
} from "./ocsf-types.auto.ts";

export * from "./ocsf-types.auto.ts";

// ---------------------------------------------------------------------------------------------------------------------------- shared

/** `T` with the members `K` present: what this module always writes of an attribute OCSF leaves optional. */
export type Present<T, K extends keyof T> = T & { readonly [P in K]-?: Exclude<T[P], undefined> };

/** The metadata an event carries beyond the schema version and the product: an event id, the tenant, a correlation id, labels, ... */
export type MetadataExtra = Partial<Omit<OcsfMetadata, "version" | "product">>;

/** OCSF's `severity_id` (every class here has the same): 0 Unknown, 1 Informational, 2 Low, 3 Medium, 4 High, 5 Critical, 6 Fatal, 99 Other. */
export type OcsfSeverityId = OcsfComplianceFinding["severity_id"];

/** The captions of the severities this module writes. */
export type OcsfSeverity = "Unknown" | "Informational" | "Low" | "Medium" | "High" | "Critical";

/** A severity as OCSF's `severity_id` and its caption. */
export const OCSF_SEVERITY: Readonly<Record<Severity, { readonly id: OcsfSeverityId; readonly caption: OcsfSeverity }>> = {
  info: { id: 1, caption: "Informational" },
  low: { id: 2, caption: "Low" },
  medium: { id: 3, caption: "Medium" },
  high: { id: 4, caption: "High" },
  critical: { id: 5, caption: "Critical" },
};

const UNKNOWN_SEVERITY = { id: 0, caption: "Unknown" } as const;

/** The activities of a finding (classes 2002 and 2003): 1 Create, 2 Update, 3 Close. */
export type FindingActivity = "create" | "update" | "close";

/** The activities of an inventory (classes 5001, 5003 and 5023): 1 Log, 2 Collect. */
export type InventoryActivity = "log" | "collect";

const FINDING_ACTIVITY = {
  create: { id: 1, name: "Create" },
  update: { id: 2, name: "Update" },
  close: { id: 3, name: "Close" },
} as const;

const INVENTORY_ACTIVITY = {
  log: { id: 1, name: "Log" },
  collect: { id: 2, name: "Collect" },
} as const;

/** The members every event of a class has here: its class, category, activity and type, with their captions. */
type Envelope<C extends number, Cat extends number, A extends number, T extends number, Name extends string, CatName extends string> = {
  readonly class_uid: C;
  readonly class_name: Name;
  readonly category_uid: Cat;
  readonly category_name: CatName;
  readonly activity_id: A;
  readonly activity_name: string;
  readonly type_uid: T;
  readonly type_name: `${Name}: ${string}`;
  readonly severity: OcsfSeverity;
  readonly metadata: OcsfMetadata;
};

function metadataOf(product: OcsfProduct, extra: MetadataExtra | undefined): OcsfMetadata {
  return { ...extra, version: OCSF_VERSION, product };
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const unique = (xs: readonly string[]): readonly string[] => [...new Set(xs)].sort(byText);

// ---------------------------------------------------------------------------------------------------------------------------- Compliance Finding

/** OCSF's compliance `status_id`: 0 Unknown, 1 Pass, 2 Warning, 3 Fail, 99 Other. */
export type OcsfComplianceStatusId = Exclude<OcsfCompliance["status_id"], undefined>;

/** The captions of the compliance statuses this module writes. */
export type OcsfComplianceStatus = "Unknown" | "Pass" | "Warning" | "Fail" | "Not Applicable";

/** A finding's `status_id` (OCSF Findings): 0 Unknown, 1 New, 2 In Progress, 3 Suppressed, 4 Resolved, 5 Archived, 6 Deleted, 99 Other. */
export type OcsfFindingStatusId = Exclude<OcsfComplianceFinding["status_id"], undefined>;

/** The captions of the finding statuses this module writes. */
export type OcsfFindingStatus = "Unknown" | "New" | "In Progress" | "Suppressed" | "Resolved";

/** A resource as this module writes it: its uid, name and type always there. */
export type ResourceEvent = Present<OcsfResourceDetails, "uid" | "name" | "type">;

/** An OCSF 1.9.0 Compliance Finding (class 2003) as this module writes it. */
export type ComplianceFindingEvent = OcsfComplianceFinding &
  Envelope<2003, 2, 1 | 2 | 3, 200301 | 200302 | 200303, "Compliance Finding", "Findings"> & {
    readonly status_id: OcsfFindingStatusId;
    readonly status: OcsfFindingStatus;
    readonly message: string;
    readonly finding_info: Present<OcsfFindingInfo, "title" | "created_time" | "types">;
    readonly compliance: Present<OcsfCompliance, "control" | "standards" | "status_id" | "status" | "status_code"> & {
      readonly status_id: OcsfComplianceStatusId;
      readonly status: OcsfComplianceStatus;
    };
    readonly resources: readonly ResourceEvent[];
  };

/** What a Compliance Finding needs beyond the finding: the product, and optionally the activity, the standards and more metadata. */
export type ComplianceFindingOptions = {
  readonly product: OcsfProduct;
  /** `create` (the default) for a finding first reported, `update` for one reported again, `close` for one resolved. */
  readonly activity?: FindingActivity;
  /** The standards the control is checked against; by default the catalogs the control implements, or its own id where it implements none. */
  readonly standards?: (f: Finding) => readonly string[];
  readonly metadata?: MetadataExtra;
};

const COMPLIANCE_TYPE = { create: 200301, update: 200302, close: 200303 } as const;

/** How an outcome maps to the compliance status and to the finding's status (the table in the module's documentation). */
export function ocsfStatus(
  outcome: Outcome,
  status: Outcome,
): {
  readonly compliance: { readonly id: OcsfComplianceStatusId; readonly caption: OcsfComplianceStatus };
  readonly finding: { readonly id: OcsfFindingStatusId; readonly caption: OcsfFindingStatus };
} {
  switch (outcome) {
    case "pass":
      return { compliance: { id: 1, caption: "Pass" }, finding: { id: 4, caption: "Resolved" } };
    case "warn":
      return { compliance: { id: 2, caption: "Warning" }, finding: { id: 1, caption: "New" } };
    case "fail":
    case "gap":
      return { compliance: { id: 3, caption: "Fail" }, finding: { id: 1, caption: "New" } };
    case "accepted":
      return {
        compliance: status === "warn" ? { id: 2, caption: "Warning" } : { id: 3, caption: "Fail" },
        finding: { id: 3, caption: "Suppressed" },
      };
    case "error":
      return { compliance: { id: 0, caption: "Unknown" }, finding: { id: 1, caption: "New" } };
    case "not-applicable":
      return { compliance: { id: 99, caption: "Not Applicable" }, finding: { id: 4, caption: "Resolved" } };
    default:
      return absurd(outcome);
  }
}

function defaultStandards(f: Finding): readonly string[] {
  const catalogs = unique(f.control.implements.map((r) => r.catalog));
  return catalogs.length > 0 ? catalogs : [f.control.id];
}

function resourceOf(s: SubjectRef): ResourceEvent {
  return { uid: `${s.kind}:${s.id}`, name: s.id, type: s.kind };
}

/** A finding as an OCSF 1.9.0 Compliance Finding. */
export function complianceFinding(f: Finding, options: ComplianceFindingOptions): ComplianceFindingEvent {
  const kind = options.activity ?? "create";
  const activity = FINDING_ACTIVITY[kind];
  const severity = OCSF_SEVERITY[f.severity];
  const s = ocsfStatus(f.outcome, f.status);
  const time = epochMs(f.at);
  const requirements = unique(f.control.implements.map((r) => `${r.catalog}:${r.id}`));
  return {
    class_uid: 2003,
    class_name: "Compliance Finding",
    category_uid: 2,
    category_name: "Findings",
    activity_id: activity.id,
    activity_name: activity.name,
    type_uid: COMPLIANCE_TYPE[kind],
    type_name: `Compliance Finding: ${activity.name}`,
    severity_id: severity.id,
    severity: severity.caption,
    status_id: s.finding.id,
    status: s.finding.caption,
    time,
    message: `${f.control.id} ${f.outcome} for ${f.subject.kind} ${f.subject.id}: ${f.title}`,
    metadata: metadataOf(options.product, options.metadata),
    finding_info: {
      uid: findingKey(f),
      title: f.title,
      ...(f.detail === "" ? {} : { desc: f.detail }),
      created_time: time,
      types: [f.control.id],
    },
    compliance: {
      control: f.control.id,
      standards: (options.standards ?? defaultStandards)(f),
      ...(requirements.length > 0 ? { requirements } : {}),
      status_id: s.compliance.id,
      status: s.compliance.caption,
      status_code: f.status,
      ...(f.waiver === undefined ? {} : { status_details: [`accepted under waiver ${f.waiver}`] }),
    },
    resources: [resourceOf(f.subject)],
    ...(f.evidence.length > 0 ? { evidences: f.evidence.map((d) => ({ data: { sha256: d } })) } : {}),
    ...(f.remediation === undefined || f.outcome === "pass" ? {} : { remediation: { desc: f.remediation } }),
  };
}

/** Every finding of an assessment as Compliance Findings, in the assessment's order. */
export function complianceFindings(a: Assessment, options: ComplianceFindingOptions): readonly ComplianceFindingEvent[] {
  return a.findings.map((f) => complianceFinding(f, options));
}

// ---------------------------------------------------------------------------------------------------------------------------- Vulnerability Finding

/** Where a vulnerability finding stands: 1 New, 2 In Progress, 3 Suppressed (dismissed), 4 Resolved (fixed); unknown where not said. */
export type VulnerabilityStatus = "new" | "in-progress" | "suppressed" | "resolved";

const VULNERABILITY_STATUS: Readonly<
  Record<VulnerabilityStatus, { readonly id: OcsfFindingStatusId; readonly caption: OcsfFindingStatus }>
> = {
  new: { id: 1, caption: "New" },
  "in-progress": { id: 2, caption: "In Progress" },
  suppressed: { id: 3, caption: "Suppressed" },
  resolved: { id: 4, caption: "Resolved" },
};

/** A scanner's finding: its stable id and title, its severity and status where known, its vulnerabilities and what they affect. */
export type VulnerabilityInput = {
  /** The finding's id at its source, the same in every report of it (`finding_info.uid`). */
  readonly uid: string;
  readonly title: string;
  /** Its severity; 0 Unknown where not given. */
  readonly severity?: Severity;
  /** Its status; 0 Unknown where not given. */
  readonly status?: VulnerabilityStatus;
  /** The vulnerabilities (OCSF asks each for a CVE, a CWE or an advisory). */
  readonly vulnerabilities: readonly [OcsfVulnerability, ...OcsfVulnerability[]];
  /** The resources affected. */
  readonly resources?: readonly OcsfResourceDetails[];
  /** More of `finding_info`: `first_seen_time`, `data_sources`, `src_url`, ... */
  readonly findingInfo?: Partial<Omit<OcsfFindingInfo, "uid" | "title">>;
};

/** What a Vulnerability Finding needs beyond the finding: the product, the instant it is reported, and optionally the activity and metadata. */
export type VulnerabilityOptions = {
  readonly product: OcsfProduct;
  readonly at: Instant;
  readonly activity?: FindingActivity;
  readonly metadata?: MetadataExtra;
};

/** An OCSF 1.9.0 Vulnerability Finding (class 2002) as this module writes it. */
export type VulnerabilityFindingEvent = OcsfVulnerabilityFinding &
  Envelope<2002, 2, 1 | 2 | 3, 200201 | 200202 | 200203, "Vulnerability Finding", "Findings"> & {
    readonly status_id: OcsfFindingStatusId;
    readonly status: OcsfFindingStatus;
    readonly message: string;
    readonly finding_info: Present<OcsfFindingInfo, "title">;
  };

const UNKNOWN_STATUS = { id: 0, caption: "Unknown" } as const;

const VULNERABILITY_TYPE = { create: 200201, update: 200202, close: 200203 } as const;

/** A scanner's finding as an OCSF 1.9.0 Vulnerability Finding. */
export function vulnerabilityFinding(v: VulnerabilityInput, options: VulnerabilityOptions): VulnerabilityFindingEvent {
  const kind = options.activity ?? "create";
  const activity = FINDING_ACTIVITY[kind];
  const severity = v.severity === undefined ? UNKNOWN_SEVERITY : OCSF_SEVERITY[v.severity];
  const status = v.status === undefined ? UNKNOWN_STATUS : VULNERABILITY_STATUS[v.status];
  return {
    class_uid: 2002,
    class_name: "Vulnerability Finding",
    category_uid: 2,
    category_name: "Findings",
    activity_id: activity.id,
    activity_name: activity.name,
    type_uid: VULNERABILITY_TYPE[kind],
    type_name: `Vulnerability Finding: ${activity.name}`,
    severity_id: severity.id,
    severity: severity.caption,
    status_id: status.id,
    status: status.caption,
    time: epochMs(options.at),
    message: v.title,
    metadata: metadataOf(options.product, options.metadata),
    finding_info: { ...v.findingInfo, uid: v.uid, title: v.title },
    vulnerabilities: v.vulnerabilities,
    ...(v.resources === undefined || v.resources.length === 0 ? {} : { resources: v.resources }),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- inventories

/** What an inventory event needs: the product, the instant it was taken, whether it was collected (the default) or logged, more metadata. */
export type InventoryOptions = {
  readonly product: OcsfProduct;
  readonly at: Instant;
  readonly activity?: InventoryActivity;
  readonly metadata?: MetadataExtra;
  /** What the source said that OCSF has no attribute for (`unmapped`). */
  readonly unmapped?: OcsfOpenObject;
};

function inventoryEnvelope<C extends number, T extends number, Name extends string>(
  classUid: C,
  name: Name,
  types: { readonly log: T; readonly collect: T },
  options: InventoryOptions,
): Envelope<C, 5, 1 | 2, T, Name, "Discovery"> & { readonly severity_id: 1; readonly time: number; readonly unmapped?: OcsfOpenObject } {
  const kind = options.activity ?? "collect";
  const activity = INVENTORY_ACTIVITY[kind];
  return {
    class_uid: classUid,
    class_name: name,
    category_uid: 5,
    category_name: "Discovery",
    activity_id: activity.id,
    activity_name: activity.name,
    type_uid: types[kind],
    type_name: `${name}: ${activity.name}`,
    severity_id: 1,
    severity: "Informational",
    time: epochMs(options.at),
    metadata: metadataOf(options.product, options.metadata),
    ...(options.unmapped === undefined ? {} : { unmapped: options.unmapped }),
  };
}

/** An OCSF 1.9.0 Device Inventory Info event (class 5001) as this module writes it. */
export type DeviceInventoryEvent = OcsfDeviceInventoryInfo &
  Envelope<5001, 5, 1 | 2, 500101 | 500102, "Device Inventory Info", "Discovery"> & { readonly severity_id: 1 };

/** An OCSF 1.9.0 User Inventory Info event (class 5003) as this module writes it. */
export type UserInventoryEvent = OcsfUserInventoryInfo &
  Envelope<5003, 5, 1 | 2, 500301 | 500302, "User Inventory Info", "Discovery"> & { readonly severity_id: 1 };

/** An OCSF 1.9.0 Cloud Resources Inventory Info event (class 5023) as this module writes it. */
export type CloudResourcesInventoryEvent = OcsfCloudResourcesInventoryInfo &
  Envelope<5023, 5, 1 | 2, 502301 | 502302, "Cloud Resources Inventory Info", "Discovery"> & {
    readonly severity_id: 1;
    readonly resources: readonly OcsfResourceDetails[];
  };

/** Any event this module writes. */
export type OcsfEvent =
  ComplianceFindingEvent | VulnerabilityFindingEvent | DeviceInventoryEvent | UserInventoryEvent | CloudResourcesInventoryEvent;

/** A device as an OCSF 1.9.0 Device Inventory Info event. */
export function deviceInventoryInfo(device: OcsfDevice, options: InventoryOptions): DeviceInventoryEvent {
  return { ...inventoryEnvelope(5001, "Device Inventory Info", { log: 500101, collect: 500102 }, options), device };
}

/** A user (a person, or an account in some system) as an OCSF 1.9.0 User Inventory Info event. */
export function userInventoryInfo(user: OcsfUser, options: InventoryOptions): UserInventoryEvent {
  return { ...inventoryEnvelope(5003, "User Inventory Info", { log: 500301, collect: 500302 }, options), user };
}

/** Resources of a cloud or a service (a repository, a bucket, a tenant, ...) as an OCSF 1.9.0 Cloud Resources Inventory Info event. */
export function cloudResourcesInventoryInfo(
  resources: readonly OcsfResourceDetails[],
  options: InventoryOptions,
): CloudResourcesInventoryEvent {
  return { ...inventoryEnvelope(5023, "Cloud Resources Inventory Info", { log: 502301, collect: 502302 }, options), resources };
}

/** OCSF 1.9.0's device `type_id`. */
export type OcsfDeviceTypeId = OcsfDevice["type_id"];

/** The device type captions, by `type_id`. */
export const OCSF_DEVICE_TYPE: Readonly<Record<OcsfDeviceTypeId, string>> = {
  0: "Unknown",
  1: "Server",
  2: "Desktop",
  3: "Laptop",
  4: "Tablet",
  5: "Mobile",
  6: "Virtual",
  7: "IOT",
  8: "Browser",
  9: "Firewall",
  10: "Switch",
  11: "Hub",
  12: "Router",
  13: "IDS",
  14: "IPS",
  15: "Load Balancer",
  99: "Other",
};

/** A subject of an assessment, with what is known of it beyond its kind and id. */
export type InventoryItem = {
  readonly subject: SubjectRef;
  readonly name?: string;
  readonly hostname?: string;
  readonly type?: OcsfDeviceTypeId;
};

/** A subject of an assessment as a Device Inventory Info event: the device's uid is `kind:id`, and the subject's kind is its group. */
export function inventoryInfo(item: InventoryItem, options: InventoryOptions): DeviceInventoryEvent {
  const typeId = item.type ?? 0;
  return deviceInventoryInfo(
    {
      uid: `${item.subject.kind}:${item.subject.id}`,
      name: item.name ?? item.subject.id,
      type_id: typeId,
      type: OCSF_DEVICE_TYPE[typeId],
      ...(item.hostname === undefined ? {} : { hostname: item.hostname }),
      groups: [{ name: item.subject.kind }],
    },
    options,
  );
}

/** The subjects of an assessment as Device Inventory Info events, in the order of their kinds and then ids, each subject once. */
export function inventory(items: readonly InventoryItem[], options: InventoryOptions): readonly DeviceInventoryEvent[] {
  const seen = new Map<string, InventoryItem>();
  for (const item of items) {
    const k = JSON.stringify([item.subject.kind, item.subject.id]);
    if (!seen.has(k)) seen.set(k, item);
  }
  return [...seen.entries()].sort(([a], [b]) => byText(a, b)).map(([, item]) => inventoryInfo(item, options));
}
