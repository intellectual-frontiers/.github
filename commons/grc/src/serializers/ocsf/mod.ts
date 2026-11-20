// Spec: 0004-grc-documents FR-005, FR-008
/**
 * The `ocsf` serializer (0004-grc-documents FR-008): each finding of an assessment as an OCSF Compliance Finding (class 2003, category Findings), one JSON document to a line. `type_uid` is
 * `class_uid * 100 + activity_id`, `severity_id` and the compliance `status_id` are mapped from the severity and the status, the control is in `compliance`, and `metadata` names the product
 * and the version of the schema. Times are milliseconds since the epoch, from the finding's own `createdAt`.
 *
 * @limits
 * The events were built from OCSF's attribute names for this class; they were not validated against the schema's JSON here.
 *
 * @module
 */
import { ok, type Result } from "@intellectual-frontiers/core";
import { type Severity } from "@intellectual-frontiers/grc/governance";
import { type Assessment, type SerializeContext, type SerializeProblem, type Serializer, type Status } from "@intellectual-frontiers/grc/logical";

/** The version of OCSF the events are written as. */
export const OCSF_VERSION = "1.9.0";

const SEVERITY: Readonly<Record<Severity, number>> = { info: 1, low: 2, medium: 3, high: 4, critical: 5 };

/** OCSF's compliance `status_id`: 0 Unknown, 1 Pass, 2 Warning, 3 Fail, 99 Other. */
function complianceStatus(s: Status): number {
  switch (s) {
    case "pass":
    case "accepted":
      return 1;
    case "warn":
    case "pending":
      return 2;
    case "fail":
    case "error":
    case "gap":
      return 3;
    case "not-applicable":
      return 99;
  }
}

/** The `ocsf` serializer: JSON lines. */
export const ocsf: Serializer = {
  id: "ocsf",
  format: "OCSF",
  version: OCSF_VERSION,
  media: "application/x-ndjson",
  serialize(a: Assessment, _ctx: SerializeContext): Promise<Result<string, SerializeProblem>> {
    const lines = [...a.findings]
      .sort((x, y) => (x.id < y.id ? -1 : 1))
      .map((f) =>
        JSON.stringify({
          activity_id: 1,
          activity_name: "Create",
          category_uid: 2,
          category_name: "Findings",
          class_uid: 2003,
          class_name: "Compliance Finding",
          type_uid: 200301,
          type_name: "Compliance Finding: Create",
          severity_id: SEVERITY[f.severity],
          status_id: 1,
          time: Date.parse(f.createdAt),
          message: f.title,
          metadata: { version: OCSF_VERSION, product: { name: f.provenance.producer.name, version: f.provenance.producer.version }, uid: f.id },
          finding_info: { uid: f.id, title: f.title, desc: f.detail },
          compliance: {
            control: f.controls[0] ?? f.check,
            standards: [...new Set(f.controls.map((c) => c.split(":").slice(2, 4).join(" ")))].sort(),
            status_id: complianceStatus(f.status),
            status: f.status,
          },
          resources: [{ uid: f.subject, name: f.subject }],
        }),
      );
    return Promise.resolve(ok(lines.length === 0 ? "" : `${lines.join("\n")}\n`));
  },
};
