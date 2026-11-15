/**
 * Findings and inventories as OCSF 1.3.0 events (commons 0007-grc FR-016): each finding a **Compliance Finding** (class 2003, category 2
 * Findings) and each subject of an inventory a **Device Inventory Info** event (class 5001, category 5 Discovery; OCSF 1.0 called it
 * "Inventory Info"). Pure and synchronous: the product that writes the events and the instant of an inventory are values the caller gives.
 *
 * How a finding maps (the finding's `status` is kept in `compliance.status_code`, its waiver in `compliance.status_detail`):
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
 * Severity: `info` 1 Informational, `low` 2 Low, `medium` 3 Medium, `high` 4 High, `critical` 5 Critical. `type_uid` is
 * `class_uid * 100 + activity_id`. Times are milliseconds since the epoch. `finding_info.uid` is the finding's `findingKey`, the same for
 * the same control and subject in every run, so a later event of the same finding updates it.
 *
 * Written from the OCSF 1.3.0 schema as known when this was written (schema.ocsf.io was not reachable from where it was): the field names
 * and enumerations used are the stable core of the classes; `compliance.status_detail` (a string in 1.3.0, a list in later versions) and
 * the `data` member of `evidences` are the two least certain, and a reader that does not know them ignores them.
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

/** The OCSF schema version written. */
export const OCSF_VERSION = "1.3.0";

// ---------------------------------------------------------------------------------------------------------------------------- shared objects

/** The product that wrote an event (OCSF `product`): its name, vendor and version are the caller's. */
export type OcsfProduct = { readonly name: string; readonly vendor_name: string; readonly version: string; readonly uid?: string };

/** An event's metadata (OCSF `metadata`): the schema version and the product, with an optional event id and labels. */
export type OcsfMetadata = {
  readonly version: typeof OCSF_VERSION;
  readonly product: OcsfProduct;
  readonly uid?: string;
  readonly labels?: readonly string[];
};

/** OCSF's `severity_id`: 0 Unknown, 1 Informational, 2 Low, 3 Medium, 4 High, 5 Critical, 6 Fatal, 99 Other. */
export type OcsfSeverityId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 99;

/** The captions of the severities this module writes. */
export type OcsfSeverity = "Informational" | "Low" | "Medium" | "High" | "Critical";

/** A severity as OCSF's `severity_id` and its caption. */
export const OCSF_SEVERITY: Readonly<Record<Severity, { readonly id: OcsfSeverityId; readonly caption: OcsfSeverity }>> = {
  info: { id: 1, caption: "Informational" },
  low: { id: 2, caption: "Low" },
  medium: { id: 3, caption: "Medium" },
  high: { id: 4, caption: "High" },
  critical: { id: 5, caption: "Critical" },
};

// ---------------------------------------------------------------------------------------------------------------------------- Compliance Finding

/** The Compliance Finding activities: 1 Create, 2 Update, 3 Close. */
export type ComplianceActivity = "create" | "update" | "close";

/** OCSF's compliance `status_id`: 0 Unknown, 1 Pass, 2 Warning, 3 Fail, 99 Other. */
export type OcsfComplianceStatusId = 0 | 1 | 2 | 3 | 99;

/** The captions of the compliance statuses this module writes. */
export type OcsfComplianceStatus = "Unknown" | "Pass" | "Warning" | "Fail" | "Not Applicable";

/** A finding's `status_id` (OCSF Findings): 0 Unknown, 1 New, 2 In Progress, 3 Suppressed, 4 Resolved, 99 Other. */
export type OcsfFindingStatusId = 0 | 1 | 2 | 3 | 4 | 99;

/** The captions of the finding statuses this module writes. */
export type OcsfFindingStatus = "New" | "Suppressed" | "Resolved";

/** The OCSF `compliance` object: the control, the standards and requirements it is checked against, and the compliance status. */
export type OcsfCompliance = {
  readonly control: string;
  readonly standards: readonly string[];
  readonly requirements?: readonly string[];
  readonly status_id: OcsfComplianceStatusId;
  readonly status: OcsfComplianceStatus;
  /** The finding's own status (`pass`, `fail`, `warn`, `error`, `not-applicable`, `gap`). */
  readonly status_code: string;
  readonly status_detail?: string;
};

/** The OCSF `finding_info` object. */
export type OcsfFindingInfo = {
  readonly uid: string;
  readonly title: string;
  readonly desc?: string;
  readonly created_time: number;
  readonly types?: readonly string[];
};

/** A resource a finding is about (OCSF `resource_details`). */
export type OcsfResource = { readonly uid: string; readonly name: string; readonly type: string };

/** A piece of evidence (OCSF `evidences`), here its SHA-256 as `data`. */
export type OcsfEvidence = { readonly data: { readonly sha256: string } };

/** An OCSF 1.3.0 Compliance Finding (class 2003). */
export type OcsfComplianceFinding = {
  readonly class_uid: 2003;
  readonly class_name: "Compliance Finding";
  readonly category_uid: 2;
  readonly category_name: "Findings";
  readonly activity_id: 1 | 2 | 3;
  readonly activity_name: "Create" | "Update" | "Close";
  readonly type_uid: 200301 | 200302 | 200303;
  readonly type_name: `Compliance Finding: ${"Create" | "Update" | "Close"}`;
  readonly severity_id: OcsfSeverityId;
  readonly severity: OcsfSeverity;
  readonly status_id: OcsfFindingStatusId;
  readonly status: OcsfFindingStatus;
  readonly time: number;
  readonly message: string;
  readonly metadata: OcsfMetadata;
  readonly finding_info: OcsfFindingInfo;
  readonly compliance: OcsfCompliance;
  readonly resources: readonly OcsfResource[];
  readonly evidences?: readonly OcsfEvidence[];
  readonly remediation?: { readonly desc: string };
};

/** What a Compliance Finding needs beyond the finding: the product, and optionally the activity, the standards and an event id. */
export type ComplianceFindingOptions = {
  readonly product: OcsfProduct;
  /** `create` (the default) for a finding first reported, `update` for one reported again, `close` for one resolved. */
  readonly activity?: ComplianceActivity;
  /** The standards the control is checked against; by default the catalogs the control implements, or its own id where it implements none. */
  readonly standards?: (f: Finding) => readonly string[];
  readonly labels?: readonly string[];
};

const ACTIVITY = {
  create: { id: 1, name: "Create", type: 200301 },
  update: { id: 2, name: "Update", type: 200302 },
  close: { id: 3, name: "Close", type: 200303 },
} as const;

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

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const unique = (xs: readonly string[]): readonly string[] => [...new Set(xs)].sort(byText);

function defaultStandards(f: Finding): readonly string[] {
  const catalogs = unique(f.control.implements.map((r) => r.catalog));
  return catalogs.length > 0 ? catalogs : [f.control.id];
}

/** A finding as an OCSF 1.3.0 Compliance Finding. */
export function complianceFinding(f: Finding, options: ComplianceFindingOptions): OcsfComplianceFinding {
  const activity = ACTIVITY[options.activity ?? "create"];
  const severity = OCSF_SEVERITY[f.severity];
  const s = ocsfStatus(f.outcome, f.status);
  const time = epochMs(f.at);
  const requirements = unique(f.control.implements.map((r) => `${r.catalog}:${r.id}`));
  const detail = f.waiver === undefined ? undefined : `accepted under waiver ${f.waiver}`;
  return {
    class_uid: 2003,
    class_name: "Compliance Finding",
    category_uid: 2,
    category_name: "Findings",
    activity_id: activity.id,
    activity_name: activity.name,
    type_uid: activity.type,
    type_name: `Compliance Finding: ${activity.name}`,
    severity_id: severity.id,
    severity: severity.caption,
    status_id: s.finding.id,
    status: s.finding.caption,
    time,
    message: `${f.control.id} ${f.outcome} for ${f.subject.kind} ${f.subject.id}: ${f.title}`,
    metadata: metadata(options.product, options.labels),
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
      ...(detail === undefined ? {} : { status_detail: detail }),
    },
    resources: [resourceOf(f.subject)],
    ...(f.evidence.length > 0 ? { evidences: f.evidence.map((d) => ({ data: { sha256: d } })) } : {}),
    ...(f.remediation === undefined || f.outcome === "pass" ? {} : { remediation: { desc: f.remediation } }),
  };
}

/** Every finding of an assessment as Compliance Findings, in the assessment's order. */
export function complianceFindings(a: Assessment, options: ComplianceFindingOptions): readonly OcsfComplianceFinding[] {
  return a.findings.map((f) => complianceFinding(f, options));
}

function metadata(product: OcsfProduct, labels: readonly string[] | undefined): OcsfMetadata {
  return { version: OCSF_VERSION, product, ...(labels === undefined || labels.length === 0 ? {} : { labels }) };
}

function resourceOf(s: SubjectRef): OcsfResource {
  return { uid: `${s.kind}:${s.id}`, name: s.id, type: s.kind };
}

// ---------------------------------------------------------------------------------------------------------------------------- Inventory Info

/**
 * OCSF 1.3.0's device `type_id`: 0 Unknown, 1 Server, 2 Desktop, 3 Laptop, 4 Tablet, 5 Mobile, 6 Virtual, 7 IOT, 8 Browser, 9 Firewall,
 * 10 Switch, 11 Hub, 99 Other.
 */
export type OcsfDeviceTypeId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 99;

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
  99: "Other",
};

/** The OCSF `device` object as an inventory event carries it. */
export type OcsfDevice = {
  readonly uid: string;
  readonly name: string;
  readonly type_id: OcsfDeviceTypeId;
  readonly type: string;
  readonly hostname?: string;
  readonly groups?: readonly { readonly name: string }[];
};

/** An OCSF 1.3.0 Device Inventory Info event (class 5001). */
export type OcsfInventoryInfo = {
  readonly class_uid: 5001;
  readonly class_name: "Device Inventory Info";
  readonly category_uid: 5;
  readonly category_name: "Discovery";
  readonly activity_id: 1 | 2;
  readonly activity_name: "Log" | "Collect";
  readonly type_uid: 500101 | 500102;
  readonly type_name: `Device Inventory Info: ${"Log" | "Collect"}`;
  readonly severity_id: 1;
  readonly severity: "Informational";
  readonly time: number;
  readonly metadata: OcsfMetadata;
  readonly device: OcsfDevice;
};

/** A subject of an inventory, with what is known of it beyond its kind and id. */
export type InventoryItem = {
  readonly subject: SubjectRef;
  readonly name?: string;
  readonly hostname?: string;
  readonly type?: OcsfDeviceTypeId;
};

/** What an inventory event needs: the product, the instant it was taken, and whether it was collected (the default) or logged. */
export type InventoryOptions = {
  readonly product: OcsfProduct;
  readonly at: Instant;
  readonly activity?: "log" | "collect";
  readonly labels?: readonly string[];
};

/** A subject as an OCSF 1.3.0 Device Inventory Info event; the subject's kind is the device's group. */
export function inventoryInfo(item: InventoryItem, options: InventoryOptions): OcsfInventoryInfo {
  const log = options.activity === "log";
  const typeId = item.type ?? 0;
  return {
    class_uid: 5001,
    class_name: "Device Inventory Info",
    category_uid: 5,
    category_name: "Discovery",
    activity_id: log ? 1 : 2,
    activity_name: log ? "Log" : "Collect",
    type_uid: log ? 500101 : 500102,
    type_name: log ? "Device Inventory Info: Log" : "Device Inventory Info: Collect",
    severity_id: 1,
    severity: "Informational",
    time: epochMs(options.at),
    metadata: metadata(options.product, options.labels),
    device: {
      uid: `${item.subject.kind}:${item.subject.id}`,
      name: item.name ?? item.subject.id,
      type_id: typeId,
      type: OCSF_DEVICE_TYPE[typeId],
      ...(item.hostname === undefined ? {} : { hostname: item.hostname }),
      groups: [{ name: item.subject.kind }],
    },
  };
}

/** An inventory as Device Inventory Info events, in the order of the subjects' kinds and then ids, each subject once. */
export function inventory(items: readonly InventoryItem[], options: InventoryOptions): readonly OcsfInventoryInfo[] {
  const seen = new Map<string, InventoryItem>();
  for (const item of items) {
    const k = JSON.stringify([item.subject.kind, item.subject.id]);
    if (!seen.has(k)) seen.set(k, item);
  }
  return [...seen.entries()].sort(([a], [b]) => byText(a, b)).map(([, item]) => inventoryInfo(item, options));
}
