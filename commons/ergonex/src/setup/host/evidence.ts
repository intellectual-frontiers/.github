// Spec: 0002-workspace-model FR-041
/**
 * The host layer of a run's evidence (commons 0002-workspace-model FR-041 to FR-043): makes the record of a run in the IFQS test-record shape (`checkRun` of the quality module), refuses to write it
 * if it holds anything of the shapes of a credential, and writes it once, as `<home>/.ergonex/evidence/<UTC time>-<run id>.otlp.json`, refusing to overwrite a file.
 *
 * @remarks
 * The ids of the run are random and made here (a host act); the times are the caller's, read once from the clock by the controller, so that a test gives its own.
 *
 * @module
 */
import { movedPath, type Places } from "../../places.ts";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { parseSpanId, parseTraceId, type SpanId, type TraceId } from "../../platform/k-otel.ts";
import { installationFromEnv } from "../../platform/k-test-record.ts";
import { checkRun, formatQualityError } from "@intellectual-frontiers/commons/ts/quality";
import { mkdir } from "../../platform/r-fs.ts";
import { join } from "../../platform/r-path.ts";
import { build, runtimeName, runtimeVersion } from "../../platform/r-proc.ts";
import { formatHostError } from "@intellectual-frontiers/commons/ts/quality";
import { writeOnce } from "@intellectual-frontiers/commons/ts/quality";
import { caseCount, evidenceFileName, holdsCredential, runRules, type RunFacts } from "../evidence.ts";

/** What is needed to write the evidence of a run. */
export type EvidenceDeps = {
  readonly home: string;
  /** Where Ergonex keeps what it remembers: the evidence is in the state folder. */
  readonly places: Places;
  /** The run's start and end, nanoseconds since the Unix epoch, read from the clock by the caller. */
  readonly start: bigint;
  readonly end: bigint;
  /** The environment the installation record is read from (`IFC_TEST_ROLE`, `CI`, ...). */
  readonly env: Readonly<Record<string, string | undefined>>;
};

function hex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function ids(n: number): Result<
  {
    readonly traceId: TraceId;
    readonly spanId: SpanId;
    readonly caseIds: readonly SpanId[];
  },
  string
> {
  const trace = parseTraceId(hex(16));
  const span = parseSpanId(hex(8));
  if (trace.kind === "err" || span.kind === "err") return err("a random id was not an id");
  const caseIds: SpanId[] = [];
  for (let i = 0; i < n; i++) {
    const c = parseSpanId(hex(8));
    if (c.kind === "err") return err("a random id was not an id");
    caseIds.push(c.value);
  }
  return ok({ traceId: trace.value, spanId: span.value, caseIds });
}

/** A time in nanoseconds as an ISO 8601 text. */
export function isoOf(nanos: bigint): string {
  return new Date(Number(nanos / 1_000_000n)).toISOString();
}

/** A run's evidence that was written. */
export type EvidenceWritten = {
  readonly path: string;
  readonly traceId: string;
  readonly text: string;
};

/** Writes the evidence of a run once; the record holds no credential (a record that does is refused and nothing is written) and an existing file is never overwritten. */
export async function writeRunEvidence(deps: EvidenceDeps, facts: RunFacts): Promise<Result<EvidenceWritten, string>> {
  const rules = runRules(facts);
  const made = ids(caseCount(rules));
  if (made.kind === "err") return made;
  const { installation } = installationFromEnv(
    {
      runtime: runtimeName(),
      runtimeVersion: runtimeVersion(),
      os: build.os,
      arch: build.arch,
    },
    deps.env,
  );
  const record = await checkRun({
    tool: "ergonex",
    rules,
    traceId: made.value.traceId,
    spanId: made.value.spanId,
    caseIds: made.value.caseIds,
    start: deps.start,
    end: deps.end,
    runner: installation,
  });
  if (record.kind === "err") return err(formatQualityError(record.error));
  if (holdsCredential(record.value.text)) return err("the evidence of this run would hold a credential; it was not written");
  const dir = movedPath(deps.places, ".ergonex/evidence") ?? join(deps.home, ".ergonex", "evidence");
  const path = join(dir, evidenceFileName(isoOf(deps.end), made.value.traceId));
  await mkdir(dir, { recursive: true });
  const w = await writeOnce(path, record.value.text);
  if (w.kind === "err") return err(formatHostError(w.error));
  return ok({ path, traceId: made.value.traceId, text: record.value.text });
}
