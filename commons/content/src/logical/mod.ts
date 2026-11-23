// Spec: 0001-content-collector FR-001, FR-002, FR-004
/** Collects structurally parsed chapter blocks and decides the dated findings policy. @module */
import { parseElementId } from "@intellectual-frontiers/kanon";
import { CLAIM_LABELS, VOLATILITY, type ChapterInput, type Claim, type EvidenceSource } from "@intellectual-frontiers/content/governance";

/** A source problem a publication owner can review. */
export type CollectionFinding = {
  readonly code: "source-note" | "claim-marker" | "claim-id" | "evidence" | "claim-date" | "review-due";
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

/** Collected claims and source findings for one chapter. */
export type Collection = { readonly claims: readonly Claim[]; readonly findings: readonly CollectionFinding[] };

const day = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

function markerOf(text: string | undefined): ReadonlyMap<string, string> | undefined {
  const attrs = new Map<string, string>();
  if (text === undefined) return attrs;
  if (!text.startsWith("// CLAIM:")) return undefined;
  for (const attr of text.slice("// CLAIM:".length).trim().split(/\s+/)) {
    const eq = attr.indexOf("=");
    const key = attr.slice(0, eq);
    if (eq <= 0 || eq === attr.length - 1 || attrs.has(key) || !["id", "label", "evidence", "asof", "reverify", "volatility", "audience"].includes(key))
      return undefined;
    attrs.set(key, attr.slice(eq + 1));
  }
  return attrs;
}

function sourceOf(text: string): EvidenceSource | undefined {
  const [key, description, url, extra] = text.split("|").map((part) => part.trim());
  if (!key || !description || !url || extra !== undefined || !/^[\w.-]+$/.test(key)) return undefined;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return undefined;
    return { key, description, url: parsed.href };
  } catch {
    return undefined;
  }
}

/** Resolve evidence and collect public claims from the chapter's structurally parsed blocks. */
export function collectChapter(chapter: ChapterInput, today: string): Collection {
  const findings: CollectionFinding[] = [];
  const report = (code: CollectionFinding["code"], line: number, message: string): void => {
    findings.push({ code, file: chapter.file, line, message });
  };
  const notes = new Map<string, EvidenceSource>();
  for (const [index, text] of chapter.sourceNotes.split(/\r?\n/).entries()) {
    if (!text.trim()) continue;
    const source = sourceOf(text);
    if (source === undefined || notes.has(source.key)) report("source-note", index + 1, "Source note needs a unique key, description, and HTTP address.");
    else notes.set(source.key, source);
  }
  const claims: Claim[] = [];
  const seen = new Set<string>();
  let ordinal = 0;
  for (const block of chapter.blocks) {
    if (block.disclosure !== "public") continue;
    const keys = [...block.text.matchAll(/\{\{([\w.-]+)\}\}/g)].flatMap((match) => match[1] === undefined ? [] : [match[1]]);
    if (block.marker === undefined && keys.length === 0) continue;
    const attrs = markerOf(block.marker);
    if (attrs === undefined) {
      report("claim-marker", block.line, "Malformed claim marker.");
      continue;
    }
    ordinal += 1;
    const suppliedId = attrs.get("id");
    const slug = suppliedId ?? `${chapter.id}/m${ordinal}`;
    const id = slug.startsWith("claim:") ? slug : `claim:${slug}`;
    if (parseElementId(id).kind === "err" || seen.has(id)) {
      report("claim-id", block.line, "Claim identifier is invalid or repeated.");
      continue;
    }
    seen.add(id);
    const label = CLAIM_LABELS.find((v) => v === (attrs.get("label") ?? "evidence"));
    const volatility = VOLATILITY.find((v) => v === (attrs.get("volatility") ?? "static"));
    if (label === undefined || volatility === undefined) {
      report("claim-marker", block.line, "Unknown claim label or volatility.");
      continue;
    }
    const sources = new Map<string, EvidenceSource>();
    for (const key of new Set([...keys, ...(attrs.get("evidence")?.split(",") ?? [])])) {
      const source = notes.get(key);
      if (source === undefined) report("evidence", block.line, `No chapter source note for ${key}.`);
      else sources.set(source.url, source);
    }
    if (sources.size === 0) {
      report("evidence", block.line, "A public claim needs resolvable evidence.");
      continue;
    }
    const asOf = attrs.get("asof");
    const reverifyBy = attrs.get("reverify");
    if ((asOf !== undefined && !day(asOf)) || (reverifyBy !== undefined && !day(reverifyBy)) ||
        (volatility !== "static" && (asOf === undefined || reverifyBy === undefined)) ||
        (asOf !== undefined && reverifyBy !== undefined && asOf > reverifyBy)) {
      report("claim-date", block.line, "A dated claim needs valid, ordered as-of and review dates.");
      continue;
    }
    const expired = reverifyBy !== undefined && today > reverifyBy;
    const olderThan90 = volatility === "volatile" && asOf !== undefined && Date.parse(today) - Date.parse(asOf) > 90 * 86_400_000;
    if (expired || olderThan90) report("review-due", block.line, "The claim needs evidence review.");
    claims.push({ id, minted: suppliedId === undefined, text: block.text, file: chapter.file, line: block.line, label,
      audience: attrs.get("audience") ?? chapter.audience, evidence: [...sources.values()], volatility,
      audit: chapter.audit ?? "not-audited", ...(asOf === undefined ? {} : { asOf }), ...(reverifyBy === undefined ? {} : { reverifyBy }),
    });
  }
  return { claims, findings };
}

/** Owner policy for escalating unaccounted evidence. */
export type ContentGatePolicy = {
  readonly until: string;
  readonly reviewedOn?: string;
  readonly decision?: { readonly by: "shah"; readonly on: string; readonly mode: "fail-build" };
};

/** The date at which an unreviewed policy needs a decision. */
export const CONTENT_GATE_POLICY: ContentGatePolicy = { until: "2027-01-31" };

/** Determine the policy for unaccounted evidence on an explicit day. */
export function contentGateDecision(today: string, policy: ContentGatePolicy = CONTENT_GATE_POLICY): { readonly mode: "warn" | "fail-build"; readonly reviewDue: boolean } {
  if (policy.decision?.by === "shah" && day(policy.decision.on) && today >= policy.decision.on)
    return { mode: "fail-build", reviewDue: false };
  return { mode: "warn", reviewDue: today > policy.until && (policy.reviewedOn === undefined || policy.reviewedOn < policy.until) };
}
