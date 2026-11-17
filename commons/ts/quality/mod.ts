/**
 * IFC Quality (commons 0021-ifqs, the Intellectual Frontiers Quality System): the canonical record of a run, kept as evidence. It extends
 * the test record of 0008-test-evidence and does not restate it: the outcome `not_run` with its reason, the evidence grade `E0` to `E5`,
 * the body of a case's log record as a CTRF test object, the record of a check of Mizan, the renderings (JUnit XML, CTRF, SARIF, TAP and
 * the documents of ISO/IEC/IEEE 29119-3), the file layout and chain of the evidence kept as one immutable file per run, and, with real
 * `git`, the append-only `quality` branch, the note on the tested commit and the verifier that walks them. `quality.ts` is the command.
 *
 * Tier 1 of 0021-ifqs, the system reports itself: the evidence ladder of each requirement and the review debt (`pure/ladder.ts`), freshness
 * by time and by change (`pure/freshness.ts`), the ledger of nonconformances and CAPA kept as append-only files on the branch
 * (`pure/ledger.ts`, `host/ledger-branch.ts`), quality objectives emitted as OpenTelemetry metrics (`pure/objectives.ts`), the index of the
 * branch (`pure/index-file.ts`) and the tier a harness claims (`pure/tier.ts`).
 *
 * Tier 2, people see and prove: `attestation/` (pre-registered test plans and the judgement of a run against its plan, attested samples drawn by a
 * rule and a seed, mutation runs and the strength of a proof, the agents' reviews and the person who samples them: 0021-ifqs FR-038 to FR-041),
 * `trust/` (the Trust page and JSON for one audience, redacted with the count of what was redacted, `--check`able: 0022-trust FR-001 to FR-009) and
 * `assessor/` (the assessor pack, its signature, its tar and DCAT distribution, and the verifier that is inside it: FR-010 to FR-016).
 *
 * @remarks
 * `pure/` imports only the kernel, itself and the harness declaration (`mizan/changes/declaration.ts`, pure); `host/` is the layer that runs `git` and reads files. The records of Tier 2 are events of the ledger
 * (`pure/tier2-events.ts`), folded by `attestation/rules.ts`. The verifier `assessor/verify-pack.ts` imports nothing, because it is copied into every pack.
 *
 * @module
 */
export * from "./pure/names.ts";
export * from "./pure/record.ts";
export * from "./pure/chain.ts";
export * from "./pure/render.ts";
export * from "./host/branch.ts";
export * from "./pure/time.ts";
export * from "./pure/freshness.ts";
export * from "./pure/ladder.ts";
export * from "./pure/ledger.ts";
export * from "./pure/objectives.ts";
export * from "./pure/index-file.ts";
export * from "./pure/tier.ts";
export * from "./pure/chain-files.ts";
export * from "./host/ledger-branch.ts";
export * from "./host/gather.ts";
export * from "./host/report.ts";
export { formatHostError, type HostError } from "./host/git.ts";
export * from "./pure/tier2-events.ts";
export * from "./attestation/rules.ts";
export * from "./attestation/sample.ts";
export * from "./attestation/plan.ts";
export * from "./attestation/mutation.ts";
export * from "./attestation/agents.ts";
export * from "./attestation/host.ts";
export * from "./trust/audience.ts";
export * from "./trust/view.ts";
export * from "./trust/html.ts";
export * from "./trust/host.ts";
export * from "./assessor/verify-pack.ts";
export * from "./assessor/pack.ts";
export * from "./assessor/host.ts";
