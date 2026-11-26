// Spec: 0004-scanners-run FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * Running a scanner, the safe way. In this order, and stopping at the first that fails: the scanner and the target are known and the target fit to be given to a tool; the engagement allows the technique on the asset (the caller's `authorize`, which is the product's engagement check); the tool has a pin and the file at its path has
 * the pinned SHA-256; then the tool is run with an argument vector (no shell), in an empty folder, with a bare environment and a time limit. What it prints is read into findings, which are about the estate's asset. Every run, refused or made, gives a record of who it was for, what was run, with which binary and what came of it.
 * Nothing here installs or fetches a tool.
 *
 * @example
 * ```ts
 * import { runScanner } from "./run.ts";
 * // await runScanner({ scanner: "nuclei", asset: "portal", target, authorize, pins, now }) // { kind: "ok", value: { record, findings, problems } }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { RawFinding } from "@intellectual-frontiers/findings/governance";
import { importReport } from "@intellectual-frontiers/findings/logical";
import { argvOf, scannerById, targetProblem, type Pins, type Target } from "@intellectual-frontiers/scanners/governance";
import { headerFindings, tlsFindings } from "@intellectual-frontiers/scanners/logical";
import { permitProblem } from "@intellectual-frontiers/estate/logical";
import type { Permit } from "@intellectual-frontiers/estate/governance";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { probeEndpoint, type Probed } from "./probe.ts";

/** What every run is given. */
export type RunBase = {
  readonly scanner: string;
  /** The asset of the estate the scan is about: what its findings are about, and what the engagement's scope is asked. */
  readonly asset: string;
  readonly pins: Pins;
  readonly now: string;
  readonly rate?: number;
  readonly ports?: string;
  readonly timeoutMs?: number;
  /** The built-in check's contact with the target (the real one by default). */
  readonly probe?: (url: string, timeoutMs: number) => Promise<Probed>;
  /** The name of the program of the product that runs this (default `scanners`): it names the temporary folder (`<program>-scan-`) and the pin command the refusal tells the owner to run (`<program> scan pin`). The product gives it; this library names none. */
  readonly program?: string;
};

/**
 * What a run is given: a scan of a path reads local files and needs no permit; a scan of an endpoint or a host reaches a target and needs the permit of the interlock (`permits` of estate) for the action `scan` on the asset, made
 * only by that function, so that a call with none does not type-check.
 */
export type RunInput = RunBase & ({ readonly target: Extract<Target, { readonly kind: "path" }>; readonly permit?: undefined } | { readonly target: Exclude<Target, { readonly kind: "path" }>; readonly permit: Permit<"scan"> });

/** The record of a run, refused or made. */
export type RunRecord = {
  readonly scanner: string;
  readonly asset: string;
  readonly target: string;
  readonly technique: string;
  readonly startedAt: string;
  readonly tookMs: number;
  readonly tool?: { readonly name: string; readonly version: string; readonly sha256: string };
  readonly exit: number | null;
  readonly findings: number;
  readonly refused?: string;
};

/** What a run gave. */
export type RunResult = { readonly record: RunRecord; readonly findings: readonly RawFinding[]; readonly problems: readonly string[] };

/** A run that was refused or failed: why, and the record. */
export type RunRefusal = { readonly reason: string; readonly record: RunRecord };

const BARE_PATH = "/usr/local/bin:/usr/bin:/bin";

/** Runs a scanner against a target of the estate. */
export async function runScanner(i: RunInput): Promise<Result<RunResult, RunRefusal>> {
  const started = Date.now();
  const scanner = scannerById(i.scanner);
  const program = i.program ?? "scanners";
  const record = (more: Partial<RunRecord>): RunRecord => ({ scanner: i.scanner, asset: i.asset, target: i.target.value, technique: scanner?.technique ?? "unknown", startedAt: i.now, tookMs: Date.now() - started, exit: null, findings: 0, ...more });
  const refuse = (reason: string, more: Partial<RunRecord> = {}): Result<RunResult, RunRefusal> => err({ reason, record: record({ refused: reason, ...more }) });
  if (scanner === undefined) return refuse(`there is no scanner ${i.scanner}`);
  if (scanner.target !== i.target.kind) return refuse(`${i.scanner} scans ${scanner.target === "endpoint" ? "an endpoint" : `a ${scanner.target}`}, not ${i.target.kind === "endpoint" ? "an endpoint" : `a ${i.target.kind}`}`);
  const target: Target = i.target.kind === "path" ? { kind: "path", value: path.resolve(i.target.value) } : i.target;
  const bad = targetProblem(target);
  if (bad !== undefined) return refuse(bad);
  if (target.kind === "path" && !(await fs.exists(target.value))) return refuse(`${target.value} does not exist`);

  if (target.kind !== "path") {
    const problem = i.permit === undefined ? "a scan that reaches a target needs the permit of the interlock for it" : permitProblem(i.permit, "scan", i.asset, i.now);
    if (problem !== undefined) return refuse(`not allowed: ${problem}`);
  }

  const timeoutMs = i.timeoutMs ?? 600_000;
  if (scanner.tool === undefined) {
    // the built-in check: one handshake and one HEAD request
    try {
      const seen = await (i.probe ?? probeEndpoint)(target.value, Math.min(timeoutMs, 30_000));
      const findings = [...headerFindings(target.value, seen.answer), ...(seen.handshake === undefined ? [] : tlsFindings(target.value, seen.handshake, i.now))].map((f) => ({ ...f, asset: i.asset }));
      return ok({ record: record({ exit: 0, findings: findings.length }), findings, problems: [] });
    } catch (e) {
      return refuse(`the check could not reach ${target.value}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const pin = i.pins[scanner.tool];
  if (pin === undefined) return refuse(`${scanner.tool} has no pin: the owner pins the binary (${program} scan pin) before it is run`);
  const have = await fs.exists(pin.path) ? await fs.sha256File(pin.path) : undefined;
  if (have === undefined) return refuse(`${pin.path} does not exist: the pinned ${scanner.tool} ${pin.version} is not installed`);
  const tool = { name: scanner.tool, version: pin.version, sha256: pin.sha256 };
  if (have !== pin.sha256) return refuse(`${pin.path} is not the pinned ${scanner.tool} ${pin.version}: its SHA-256 is ${have}, the pin says ${pin.sha256}`, { tool });

  const work = await fs.makeTempDir({ prefix: `${program}-scan-` });
  try {
    const args = argvOf(i.scanner, target, { outDir: work, ...(i.rate === undefined ? {} : { rate: i.rate }), ...(i.ports === undefined ? {} : { ports: i.ports }) });
    if (args.kind === "err") return refuse(args.error, { tool });
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), timeoutMs);
    let ran: Awaited<ReturnType<typeof proc.run>>;
    try {
      ran = await proc.run([pin.path, ...args.value], { cwd: work, clearEnv: true, env: { PATH: BARE_PATH, HOME: work, LANG: "C", NO_COLOR: "1" }, signal: stop.signal });
    } finally {
      clearTimeout(timer);
    }
    const out = scanner.output.from === "file" ? await fs.readTextFile(path.join(work, scanner.output.name)).catch(() => "") : ran.stdout;
    // the tools exit non-zero when they find something (checkov, semgrep, trivy with --exit-code): what counts is that the output reads
    if (out.trim() === "") return refuse(`${scanner.tool} printed nothing to read (exit ${ran.code}): ${ran.stderr.trim().slice(0, 300)}`, { tool, exit: ran.code });
    const read = importReport(scanner.output.from === "file" ? scanner.output.name : `${scanner.id} output`, out, i.asset);
    if (read.format === undefined || (read.findings.length === 0 && read.problems.length > 0)) return refuse(`the output of ${scanner.tool} is not one an importer reads: ${read.problems.join("; ")}`, { tool, exit: ran.code });
    const findings = read.findings.map((f) => ({ ...f, asset: i.asset }));
    return ok({ record: record({ tool, exit: ran.code, findings: findings.length }), findings, problems: read.problems });
  } finally {
    await fs.remove(work, { recursive: true }).catch(() => undefined);
  }
}
