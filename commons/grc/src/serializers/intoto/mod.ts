// Spec: 0004-grc-documents FR-005, FR-010
/**
 * The `intoto` serializer (0004-grc-documents FR-010): an assessment as an in-toto Statement v1 whose subjects are the digests of its evidence and whose predicate type is the one the caller
 * names (a predicate type is the caller's to choose; it is required). The statement is ready for a DSSE envelope (`signers/dsse`).
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { statement } from "@intellectual-frontiers/crypto/dsse";
import { type Assessment, type SerializeContext, type SerializeProblem, type Serializer, rollup } from "@intellectual-frontiers/grc/logical";

/** The `intoto` serializer. */
export const intoto: Serializer = {
  id: "intoto",
  format: "in-toto Statement",
  version: "v1",
  media: "application/vnd.in-toto+json",
  serialize(a: Assessment, ctx: SerializeContext): Promise<Result<string, SerializeProblem>> {
    if (ctx.predicateType === undefined || ctx.predicateType === "") return Promise.resolve(err({ kind: "invalid", message: "an in-toto statement needs a predicate type: give predicateType" }));
    const subjects = [...a.evidence].sort((x, y) => (x.digest < y.digest ? -1 : 1)).map((e) => ({ name: `${e.subject}/${e.type}`, digest: { sha256: e.digest } }));
    const r = rollup(a.results);
    const predicate = {
      assessment: a.id,
      title: a.title,
      createdAt: a.createdAt,
      results: a.results.length,
      counts: r.counts,
      worst: r.worst,
      findings: a.findings.map((f) => f.id).sort(),
    };
    return Promise.resolve(ok(`${JSON.stringify(statement(subjects, ctx.predicateType, predicate), null, 2)}\n`));
  },
};
