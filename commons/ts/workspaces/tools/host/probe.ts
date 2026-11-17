/**
 * The host layer of the version probes (commons 0023-if-workspaces FR-038): runs `git --version`, `bun --version` and `node --version` as programs (never through a shell) and hands what they
 * said to `judgeProbe`. Nothing is installed, and a program that is not on the path is a `missing` probe, not an exception.
 *
 * @module
 */
import { NotFound } from "../../../runtime/errors.ts";
import { output } from "../../../runtime/proc.ts";
import { judgeProbe, PROBES, type Probe, type ProbedTool } from "../probe.ts";

/** What a tool says of its version, or undefined where it is not on the path (or does not run). */
async function said(program: string): Promise<string | undefined> {
  try {
    const out = await output([program, "--version"], { stdout: "piped", stderr: "piped" });
    return out.success ? new TextDecoder().decode(out.stdout) : undefined;
  } catch (e) {
    if (e instanceof NotFound) return undefined;
    throw e;
  }
}

/** Probes one tool by name: the program of that name on the path, or `program` where a test or a manifest names another. */
export async function probeTool(tool: ProbedTool, program: string = tool): Promise<Probe> {
  return judgeProbe(tool, await said(program));
}

/** Probes `git`, `bun` and `node`; `programs` names another program for any of them (a test's, or a path the user gave). */
export async function probeAll(programs: Readonly<Partial<Record<ProbedTool, string>>> = {}): Promise<readonly Probe[]> {
  return Promise.all(PROBES.map((t) => probeTool(t, programs[t] ?? t)));
}
