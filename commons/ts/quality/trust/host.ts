/**
 * The Trust page made from a repository's evidence and checked against the files on disk (commons 0022-trust FR-001, FR-009): the page and its
 * JSON are generated from one `Collected` (the evidence read once, `assessor/host.ts`), and `--check` fails where either file differs from what the
 * evidence makes, a page edited by hand included.
 *
 * @module
 */
import { err, ok, type Result } from "../../kernel/result.ts";
import { exists, readTextFile } from "../../runtime/fs.ts";
import { type Collected, trustInputOf } from "../assessor/host.ts";
import type { Audience, RedactionRules } from "./audience.ts";
import { trustHtml } from "./html.ts";
import { trustJson, trustViewOf, type TrustView } from "./view.ts";

/** What a page is made with besides the evidence. */
export type TrustRequest = {
  readonly harness: string;
  readonly audience: Audience;
  readonly rules: RedactionRules;
  readonly scopeNote?: string;
  readonly notCovered?: readonly string[];
  /** The rate at which a person samples the agents' reviews, in a thousandth, that the harness states (0021-ifqs FR-041). */
  readonly agentRatePermille?: number;
};

/** A page: its view, its HTML and its JSON. */
export type TrustPage = { readonly view: TrustView; readonly html: string; readonly json: string };

/** The page of an audience made from what was collected (FR-001, FR-007), or why it is refused (FR-004). */
export function generateTrust(c: Collected, request: TrustRequest): Result<TrustPage, string> {
  const input = trustInputOf(c, {
    harness: request.harness,
    ...(request.scopeNote === undefined ? {} : { scopeNote: request.scopeNote }),
    ...(request.notCovered === undefined ? {} : { notCovered: request.notCovered }),
    ...(request.agentRatePermille === undefined ? {} : { agentRatePermille: request.agentRatePermille }),
  });
  const view = trustViewOf(input, request.audience, request.rules);
  if (view.kind === "err") return view;
  return ok({ view: view.value, html: trustHtml(view.value), json: trustJson(view.value) });
}

const lf = (text: string): string => text.replaceAll("\r\n", "\n");

/** The files on disk that differ from what the evidence makes: each named with what is wrong (FR-001). Empty where the page and its JSON are current. */
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
