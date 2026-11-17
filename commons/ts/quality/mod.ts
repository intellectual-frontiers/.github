/**
 * IFC Quality (commons 0021-ifqs, the Intellectual Frontiers Quality System): the canonical record of a run, kept as evidence. It extends
 * the test record of 0008-test-evidence and does not restate it: the outcome `not_run` with its reason, the evidence grade `E0` to `E5`,
 * the body of a case's log record as a CTRF test object, the record of a check of Mizan, the renderings (JUnit XML, CTRF, SARIF, TAP and
 * the documents of ISO/IEC/IEEE 29119-3), the file layout and chain of the evidence kept as one immutable file per run, and, with real
 * `git`, the append-only `quality` branch, the note on the tested commit and the verifier that walks them. `quality.ts` is the command.
 *
 * @remarks
 * `pure/` imports only the kernel and itself; `host/` is the layer that runs `git` and reads files. The index of runs, freshness, the
 * nonconformance and its CAPA, objectives and the page are the later work of 0021-ifqs and 0022-trust.
 *
 * @module
 */
export * from "./pure/names.ts";
export * from "./pure/record.ts";
export * from "./pure/chain.ts";
export * from "./pure/render.ts";
export * from "./host/branch.ts";
export { formatHostError, type HostError } from "./host/git.ts";
