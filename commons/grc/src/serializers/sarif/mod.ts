// Spec: 0004-grc-documents FR-005, FR-009
/**
 * The `sarif` serializer (0004-grc-documents FR-009): the findings of an assessment as SARIF 2.1.0, one run, one rule for each check that has a finding, and one result for each finding with its
 * level, its message and the subject as a logical location.
 *
 * @module
 */
import { ok, type Result } from "@intellectual-frontiers/core";
import type { Assessment, SerializeContext, SerializeProblem, Serializer, Status } from "@intellectual-frontiers/grc/logical";

/** The version of SARIF written. */
export const SARIF_VERSION = "2.1.0";

function level(s: Status): "error" | "warning" | "note" {
  return s === "fail" || s === "error" || s === "gap" ? "error" : s === "warn" || s === "pending" ? "warning" : "note";
}

/** The `sarif` serializer. */
export const sarif: Serializer = {
  id: "sarif",
  format: "SARIF",
  version: SARIF_VERSION,
  media: "application/sarif+json",
  serialize(a: Assessment, _ctx: SerializeContext): Promise<Result<string, SerializeProblem>> {
    const findings = [...a.findings].sort((x, y) => (x.id < y.id ? -1 : 1));
    const asks = new Map((a.checks ?? []).map((c) => [c.id, c.ask]));
    const rules = [...new Set(findings.map((f) => f.check))].sort().map((id) => ({ id, shortDescription: { text: asks.get(id) ?? id } }));
    const doc = {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: SARIF_VERSION,
      runs: [
        {
          tool: { driver: { name: a.provenance.producer.name, version: a.provenance.producer.version, rules } },
          results: findings.map((f) => ({
            ruleId: f.check,
            level: level(f.status),
            message: { text: `${f.title}: ${f.detail}` },
            locations: [{ logicalLocations: [{ name: f.subject, kind: "resource" }] }],
          })),
        },
      ],
    };
    return Promise.resolve(ok(`${JSON.stringify(doc, null, 2)}\n`));
  },
};
