// Spec: 0001-quality-evidence FR-052
/**
 * The Trust page made from a repository's evidence and checked against the files on disk (commons 0001-quality-evidence FR-052, FR-059): the page and its
 * JSON are generated from one `Collected` (the evidence read once, `assessor/host.ts`), and `--check` fails where either file differs from what the
 * evidence makes, a page edited by hand included.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { exists, readTextFile } from "@intellectual-frontiers/system/fs";
import { type Collected, trustInputOf } from "../assessor/host.ts";
import type { Audience, RedactionRules } from "./audience.ts";
import { trustHtml } from "./html.ts";
import type { RequirementText } from "./requirement-text.ts";
import { trustJson, trustViewOf, type TrustView } from "./view.ts";

/** What a page is made with besides the evidence. */
export type TrustRequest = {
  readonly harness: string;
  readonly audience: Audience;
  readonly rules: RedactionRules;
  readonly scopeNote?: string;
  readonly notCovered?: readonly string[];
  /** The rate at which a person samples the agents' reviews, in a thousandth, that the harness states (0001-quality-evidence FR-044). */
  readonly agentRatePermille?: number;
  /**
   * What a requirement says at the tested revision (0001-quality-evidence FR-068), read from the specifications by `readRequirementTexts`: the Assessor and
   * Internal pages show it beside a nonconformance, the Public page never does. None where the harness gives none.
   */
  readonly requirementText?: RequirementText;
};

/** A page: its view, its HTML and its JSON. */
export type TrustPage = { readonly view: TrustView; readonly html: string; readonly json: string };

/** The page of an audience made from what was collected (FR-052, FR-057), or why it is refused (FR-055). */
export function generateTrust(c: Collected, request: TrustRequest): Result<TrustPage, string> {
  const input = trustInputOf(c, {
    harness: request.harness,
    ...(request.scopeNote === undefined ? {} : { scopeNote: request.scopeNote }),
    ...(request.notCovered === undefined ? {} : { notCovered: request.notCovered }),
    ...(request.agentRatePermille === undefined ? {} : { agentRatePermille: request.agentRatePermille }),
  });
  const view = trustViewOf(input, request.audience, request.rules, request.requirementText);
  if (view.kind === "err") return view;
  return ok({ view: view.value, html: trustHtml(view.value), json: trustJson(view.value) });
}

const lf = (text: string): string => text.replaceAll("\r\n", "\n");

/** The files on disk that differ from what the evidence makes: each named with what is wrong (FR-052). Empty where the page and its JSON are current. */
export async function driftOf(page: TrustPage, files: { readonly html?: string; readonly json?: string }): Promise<readonly string[]> {
  const out: string[] = [];
  for (const [path, want] of [
    [files.html, page.html],
    [files.json, page.json],
  ] as const) {
    if (path === undefined) continue;
    if (!(await exists(path))) out.push(`${path} does not exist`);
    else if (lf(await readTextFile(path)) !== want) out.push(`${path} is not what the evidence makes`);
  }
  return out;
}

/** Whether the page the evidence makes is the one on disk, as a result. */
export async function checkTrust(
  page: TrustPage,
  files: { readonly html?: string; readonly json?: string },
): Promise<Result<true, string>> {
  const drift = await driftOf(page, files);
  return drift.length === 0 ? ok(true) : err(drift.join("; "));
}
