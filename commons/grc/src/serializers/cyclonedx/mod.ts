// Spec: 0004-grc-documents FR-005, FR-010
/**
 * The `cyclonedx` serializer (0004-grc-documents FR-010): an assessment as a CycloneDX BOM whose `declarations` hold the assessor, a claim for each control that was assessed, the evidence and the
 * attestations, and whose `definitions` hold the frameworks as standards with their requirements. It is a statement about the assessed things, not an inventory of their parts.
 *
 * @limits
 * The structure follows CycloneDX 1.6's declarations for the fields written; it was not validated against the JSON schema here.
 *
 * @module
 */
import { ok, type Result } from "@intellectual-frontiers/core";
import type { Assessment, SerializeContext, SerializeProblem, Serializer } from "@intellectual-frontiers/grc/logical";
import { idOf } from "@intellectual-frontiers/grc/logical";

/** The version of CycloneDX written. */
export const CYCLONEDX_VERSION = "1.6";

/** The `cyclonedx` serializer. */
export const cyclonedx: Serializer = {
  id: "cyclonedx",
  format: "CycloneDX",
  version: CYCLONEDX_VERSION,
  media: "application/vnd.cyclonedx+json",
  async serialize(a: Assessment, _ctx: SerializeContext): Promise<Result<string, SerializeProblem>> {
    const controls = [...new Set(a.results.flatMap((r) => r.controls))].sort();
    const assessor = `assessor-${a.provenance.producer.name}`;
    const claims = controls.map((urn) => {
      const rs = a.results.filter((r) => r.controls.includes(urn));
      return {
        "bom-ref": `claim-${urn}`,
        target: urn,
        predicate: `${urn} is satisfied`,
        reasoning: rs.map((r) => `${r.check} on ${r.subject}: ${r.status}`).sort().join("; "),
        evidence: a.evidence.filter((e) => rs.some((r) => r.subject === e.subject)).map((e) => `evidence-${e.digest}`),
      };
    });
    const conformance = (urn: string): number => {
      const rs = a.results.filter((r) => r.controls.includes(urn) && r.status !== "not-applicable");
      return rs.length === 0 ? 0 : rs.filter((r) => r.status === "pass" || r.status === "accepted").length / rs.length;
    };
    const doc = {
      bomFormat: "CycloneDX",
      specVersion: CYCLONEDX_VERSION,
      serialNumber: await idOf([a.id, "bom"]),
      version: 1,
      metadata: { timestamp: a.createdAt, component: { type: "data", name: a.title, "bom-ref": a.id } },
      declarations: {
        assessors: [{ "bom-ref": assessor, thirdParty: false, organization: { name: a.provenance.producer.name } }],
        attestations: [
          {
            summary: `The assessment ${a.title}.`,
            assessor,
            map: controls.map((urn) => ({
              requirement: urn,
              claims: [`claim-${urn}`],
              conformance: { score: conformance(urn), rationale: `The share of the checks of ${urn} that pass or are accepted.` },
            })),
          },
          ...a.attestations.map((t) => ({ summary: `${t.attester} (${t.role}) says ${t.claim} of ${t.subject}: ${t.statement}`, assessor })),
        ],
        claims,
        evidence: a.evidence.map((e) => ({ "bom-ref": `evidence-${e.digest}`, propertyName: e.type, description: `${e.type} of ${e.subject}, sha256 ${e.digest}`, created: e.observedAt })),
      },
      definitions: {
        standards: a.frameworks.map((f) => ({
          "bom-ref": `standard-${f.id}-${f.version}`,
          name: f.title,
          version: f.version,
          requirements: f.controls.map((c) => ({ "bom-ref": `urn:grc:${f.id}:${f.version}:${c.id}`, identifier: c.id, title: c.title, text: c.statement })),
        })),
      },
    };
    return ok(`${JSON.stringify(doc, null, 2)}\n`);
  },
};
