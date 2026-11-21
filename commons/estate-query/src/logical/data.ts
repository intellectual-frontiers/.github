// Spec: 0002-estate-query-relations FR-002, FR-003, FR-004
/**
 * What an estate holds, in the shapes of the estate library, and the relations built from it. A relation is built only when a query names it. What the estate library gives (a snapshot of a fleet store, or what a tenant's files declare) is given here as it is: nothing is read, written or run.
 *
 * @example
 * ```ts
 * import { tablesOf } from "./data.ts";
 * tablesOf({ assets: [], now: "2026-12-01T00:00:00Z" })["asset"]?.().rows; // []
 * ```
 *
 * @module
 */
import { findSecretLike, type JsonValue } from "@intellectual-frontiers/archon/governance";
import { installOf, type Asset } from "@intellectual-frontiers/estate/governance";
import { judgePolicy, type AcceptedRisk, type Observation, type PolicyOutcome, type Truth, type Violation } from "@intellectual-frontiers/estate/logical";
import type { Table, Value } from "@intellectual-frontiers/lang-sql/aide/relational";
import { RELATIONS } from "@intellectual-frontiers/estate-query/governance";

/** What an estate holds: the assets, and, where there are any, what is declared, observed, judged and accepted of them. */
export type EstateData = {
  readonly assets: readonly Asset[];
  /** What is declared of each asset, by its identity. */
  readonly declared?: Readonly<Record<string, Readonly<Record<string, JsonValue>>>>;
  /** The latest observation of each asset (the one the relations show). */
  readonly observations?: readonly { readonly asset: string; readonly observation: Observation }[];
  /** The results of the policies in the latest observation of each asset. */
  readonly results?: readonly (PolicyOutcome & { readonly asset: string })[];
  /** The risks accepted of each asset, by its identity. */
  readonly acceptances?: Readonly<Record<string, readonly AcceptedRisk[]>>;
  /** The operational truth of each asset, where it was worked out. */
  readonly truths?: readonly Truth[];
  /** The invariants broken, where they were checked. */
  readonly violations?: readonly Violation[];
  /** The changes of the repository, newest first. */
  readonly changes?: readonly { readonly commit: string; readonly at: string; readonly author: string; readonly subject: string; readonly refs: string; readonly signed: boolean }[];
  /** The approvals kept. */
  readonly approvals?: readonly { readonly asset: string; readonly kind: string; readonly by: string; readonly planHash: string; readonly at: string }[];
  /** The fleet that declares each asset, by its identity, where the data says. */
  readonly fleets?: Readonly<Record<string, string>>;
  /** The instant now, for the policies' acceptances (an ISO 8601 instant). */
  readonly now: string;
};

/** The relations of an estate, each built when it is asked for. */
export type Tables = Readonly<Record<string, () => Table>>;

const REDACTED = "[redacted: looks like a secret]";

/** The dotted paths and values of a JSON value, one for each leaf (a value that looks like a secret, by what it is or by the name of its key, is replaced). */
function leaves(value: JsonValue, prefix = ""): readonly (readonly [string, string])[] {
  if (value === null || typeof value !== "object") {
    const key = prefix.split(".").pop() ?? "";
    const secret = findSecretLike(value, "$", key).length > 0;
    return [[prefix, secret ? REDACTED : value === null ? "" : String(value)]];
  }
  if (Array.isArray(value)) return value.flatMap((v: JsonValue, i) => leaves(v, prefix === "" ? String(i) : `${prefix}.${i}`));
  return Object.entries(value).flatMap(([k, v]) => leaves(v, prefix === "" ? k : `${prefix}.${k}`));
}

const table = (columns: readonly string[], rows: readonly (readonly Value[])[]): Table => ({ columns, rows });
const columnsOf = (name: string): readonly string[] => RELATIONS.find((r) => r.name === name)?.columns.map((c) => c.name) ?? [];

/** The relations of the data, built as a query names them. */
export function tablesOf(data: EstateData): Tables {
  const latest = new Map((data.observations ?? []).map((o) => [o.asset, o.observation]));
  const accepted = (asset: string): readonly AcceptedRisk[] => data.acceptances?.[asset] ?? [];
  return {
    asset: () => table(columnsOf("asset"), data.assets.map((a) => [String(a.id), data.fleets?.[String(a.id)] ?? "", String(a.kind), a.state, a.origin ?? "", a.state === "discovered" ? "" : installOf(a)])),
    capability: () => table(columnsOf("capability"), data.assets.flatMap((a) => a.capabilities.map((l): readonly Value[] => [String(a.id), l.capability, l.offered, l.offered ? String(l.owner) : "", l.offered ? "" : l.reason]))),
    platform: () =>
      table(
        columnsOf("platform"),
        Object.entries(data.declared ?? {}).flatMap(([asset, d]): readonly (readonly Value[])[] => {
          const p = d["platform"];
          if (p === null || typeof p !== "object" || Array.isArray(p)) return [];
          const o = p as Record<string, JsonValue>;
          const s = (k: string): string => (typeof o[k] === "string" ? (o[k] as string) : "");
          return [[asset, s("family"), s("distro"), s("release"), s("arch"), s("ansible")]];
        }),
      ),
    declared: () => table(columnsOf("declared"), Object.entries(data.declared ?? {}).flatMap(([asset, d]) => leaves(d as JsonValue).map(([path, value]): readonly Value[] => [asset, path, value]))),
    observation: () => table(columnsOf("observation"), [...latest.entries()].map(([asset, o]): readonly Value[] => [asset, o.at, o.source])),
    observed: () => table(columnsOf("observed"), [...latest.entries()].flatMap(([asset, o]) => leaves(o.state as JsonValue).map(([path, value]): readonly Value[] => [asset, path, value]))),
    truth: () => table(columnsOf("truth"), (data.truths ?? []).map((t): readonly Value[] => [t.asset, t.currency, t.alignment, t.agrees, t.observedAt ?? "", t.source ?? ""])),
    policy_result: () =>
      table(
        columnsOf("policy_result"),
        (data.results ?? []).map((r): readonly Value[] => {
          const judged = judgePolicy({ result: { id: r.id, status: r.status, controls: r.controls }, observed: latest.has(r.asset), accepted: accepted(r.asset), now: data.now });
          return [r.asset, r.id, judged.status, judged.detail];
        }),
      ),
    policy_control: () => table(columnsOf("policy_control"), (data.results ?? []).flatMap((r) => r.controls.map((control): readonly Value[] => [r.asset, r.id, control]))),
    risk: () => table(columnsOf("risk"), Object.entries(data.acceptances ?? {}).flatMap(([asset, risks]) => risks.map((r): readonly Value[] => [asset, r.policy, r.reason, r.by, r.until]))),
    change: () => table(columnsOf("change"), (data.changes ?? []).map((x): readonly Value[] => [x.commit, x.at, x.author, x.subject, x.refs, x.signed])),
    approval: () => table(columnsOf("approval"), (data.approvals ?? []).map((x): readonly Value[] => [x.asset, x.kind, x.by, x.planHash, x.at])),
    violation: () => table(columnsOf("violation"), (data.violations ?? []).map((v): readonly Value[] => [v.invariant, v.subject, v.message])),
  };
}

/** What of a snapshot of a fleet store is read (`FleetSnapshot` of the estate library's physical layer satisfies it by shape; it is described here so that nothing of AnyFS is imported). */
export type SnapshotLike = {
  readonly assets: readonly Asset[];
  readonly declared: Readonly<Record<string, Readonly<Record<string, JsonValue>>>>;
  readonly observations: readonly { readonly asset: string; readonly observation: Observation }[];
  readonly results: readonly (PolicyOutcome & { readonly asset: string })[];
  readonly acceptances: Readonly<Record<string, readonly AcceptedRisk[]>>;
};

/** What `assessSnapshot` of the estate library gives, as far as the relations use it. */
export type AssessmentLike = { readonly truths: readonly Truth[]; readonly violations: readonly Violation[] };

/** The estate of a snapshot of a fleet store, at an instant, with what was assessed of it where that was done. */
export function fromSnapshot(snapshot: SnapshotLike, now: string, assessment?: AssessmentLike): EstateData {
  return {
    assets: snapshot.assets,
    declared: snapshot.declared,
    observations: snapshot.observations,
    results: snapshot.results,
    acceptances: snapshot.acceptances,
    ...(assessment === undefined ? {} : { truths: assessment.truths, violations: assessment.violations }),
    now,
  };
}
