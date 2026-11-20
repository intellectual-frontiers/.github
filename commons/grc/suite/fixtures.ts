/**
 * Fixtures of the tests: a small framework, a crosswalk, checks, a policy, an exception and results, each made through the decoders of its kind so that the fixtures are valid documents.
 *
 * @module
 */
import type { Decoder } from "@intellectual-frontiers/core";
import {
  check,
  crosswalk,
  evidencePolicy,
  exception,
  framework,
  policy,
  requirement,
  type Check,
  type Crosswalk,
  type EvidencePolicy,
  type Exception,
  type Framework,
  type Policy,
  type Requirement,
} from "@intellectual-frontiers/grc/governance";
import { result, type Result } from "@intellectual-frontiers/grc/logical";

/** The time of the fixtures. */
export const AT = "2026-06-01T00:00:00Z";
const provenance = { producer: { name: "test", version: "1" }, inputs: [] };
const head = (kind: string, id: string): Record<string, unknown> => ({ kind, schema: "1", id, createdAt: AT, provenance });

/** A decoded document, or the failure thrown (a fixture is always valid). */
export function must<T>(decode: Decoder<T>, value: unknown): T {
  const r = decode(value);
  if (r.kind === "err") throw new Error(`${r.error.path}: expected ${r.error.expected}, found ${r.error.found}`);
  return r.value;
}

export const A1 = "urn:grc:ex:1:A-1";
export const A2 = "urn:grc:ex:1:A-2";
export const B1 = "urn:grc:ex:1:B-1";
export const OTHER1 = "urn:grc:other:2:X-1";

export const ex: Framework = must(framework.decode, {
  ...head("grc.framework", "ex"),
  version: "1",
  title: "Example",
  controls: [
    { id: "A-1", title: "Disks", statement: "Disks are encrypted." },
    { id: "A-2", title: "Patches", statement: "Patches are applied." },
    { id: "B-1", title: "Logs", statement: "Logs are kept." },
  ],
});

export const other: Framework = must(framework.decode, {
  ...head("grc.framework", "other"),
  version: "2",
  title: "Other",
  controls: [{ id: "X-1", title: "Encryption", statement: "Data at rest is encrypted." }],
});

export const walk: Crosswalk = must(crosswalk.decode, {
  ...head("grc.crosswalk", "ex-other"),
  mappings: [{ from: B1, to: OTHER1, relationship: "subset-of", strength: 8 }],
});

export function aCheck(id: string, controls: readonly string[], extra: Record<string, unknown> = {}): Check {
  return must(check.decode, {
    ...head("grc.check", id),
    ask: `Is ${id} true?`,
    expect: { kind: "empty" },
    platforms: ["linux", "darwin"],
    freshness: "P7D",
    controls,
    runner: { kind: "sql", input: { query: "select 1 where 0" } },
    ...extra,
  });
}

export const policyOf: Policy = must(policy.decode, {
  ...head("grc.policy", "disk-policy"),
  title: "Disk policy",
  scope: { platforms: ["linux"], tags: [] },
  severity: "high",
  rationale: "Lost laptops must not leak data.",
  controls: [A1],
  checks: ["disk-encrypted"],
  owner: "security",
  review: { cadence: "P1Y", lastReviewed: "2026-01-01T00:00:00Z" },
});

export const evidencePolicyOf: EvidencePolicy = must(evidencePolicy.decode, {
  ...head("grc.evidence-policy", "default"),
  counts: [{ kinds: ["attestation"], maxAge: "P30D" }],
  retention: "P1Y",
  attesters: ["ciso"],
  custody: "file",
});

export function anException(extra: Record<string, unknown> = {}): Exception {
  return must(exception.decode, {
    ...head("grc.exception", "exc-1"),
    excuses: { type: "check", ref: "disk-encrypted" },
    subjects: ["host-*"],
    reason: "Replacement hardware is on order.",
    approvedBy: "ciso",
    grantedAt: "2026-03-01T00:00:00Z",
    expiresAt: "2026-03-31T00:00:00Z",
    ...extra,
  });
}

export function aRequirement(id: string, mechanism: string, by: string): Requirement {
  return must(requirement.decode, {
    ...head("grc.requirement", id),
    statement: "The system MUST encrypt disks.",
    level: "MUST",
    controls: [A1],
    verification: { mechanism, by, note: "n" },
  });
}

export function aResult(check: string, subject: string, status: string, extra: Record<string, unknown> = {}): Result {
  return must(result.decode, {
    ...head("grc.result", `result:${check}:${subject}:${extra["observedAt"] ?? AT}`),
    check,
    controls: [A1],
    subject,
    status,
    severity: "high",
    reason: "because",
    observedAt: AT,
    ...extra,
  });
}
