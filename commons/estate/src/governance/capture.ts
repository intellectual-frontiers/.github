// Spec: 0004-estate-capture FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * How the evidence of a tenant's assets is captured, as data the compiler checks (commons estate 0004-estate-capture): which branch it is kept on, where the collector runs, how often each kind of asset is observed, whether every capture or
 * only a change and a heartbeat is journaled and how the journal is committed, whether and when the branch is pushed, and whether a person's seal is asked for. A policy is made only by `defineCapturePolicy`, which fills what is left out with the
 * defaults and refuses, with every reason, what cannot hold: a cadence longer than the freshness window allows, a heartbeat longer than the freshness of an asset it covers, a branch that is the tenant's own.
 *
 * @example
 * ```ts
 * import { defineCapturePolicy } from "./capture.ts";
 * const p = defineCapturePolicy({ push: { mode: "after-commit" } });
 * p.kind === "ok" && p.value.cadence.managed; // "PT15M"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { parseDuration } from "@intellectual-frontiers/grc/governance";
import { parseAssetId } from "./ids.ts";

/** Whether every capture is journaled, or only a change and a heartbeat that says the machine was looked at and had not changed. */
export type JournalGranularity = "every-capture" | "changes-and-heartbeat";

/** When the collector pushes the branch: never, after each commit, or at an interval. */
export type PushMode = "never" | "after-commit" | "every";

/** Whether a person's seal of the journal is never asked for, asked for with an export, or due every day. */
export type SealRequirement = "never" | "on-export" | "daily";

/** What a policy is written with; every field is optional and a left out one has its default. */
export type CapturePolicyInput = {
  readonly branch?: string;
  readonly collector?: { readonly runsOn?: string };
  readonly cadence?: { readonly managed?: string; readonly adopted?: string; readonly perRole?: Readonly<Record<string, string>>; readonly perAsset?: Readonly<Record<string, string>> };
  readonly journal?: { readonly granularity?: JournalGranularity; readonly heartbeat?: string; readonly disposable?: { readonly granularity: JournalGranularity; readonly heartbeat?: string }; readonly commit?: { readonly every?: string } };
  readonly push?: { readonly mode?: PushMode; readonly remote?: string; readonly every?: string };
  readonly sealing?: { readonly required?: SealRequirement; readonly key?: string };
};

/** A capture policy: every field is there. */
export type CapturePolicy = {
  readonly branch: string;
  readonly collector: { readonly runsOn: string };
  readonly cadence: { readonly managed: string; readonly adopted: string; readonly perRole: Readonly<Record<string, string>>; readonly perAsset: Readonly<Record<string, string>> };
  readonly journal: { readonly granularity: JournalGranularity; readonly heartbeat: string | null; readonly disposable: { readonly granularity: JournalGranularity; readonly heartbeat: string | null } | null; readonly commit: { readonly every: string } };
  readonly push: { readonly mode: PushMode; readonly remote: string; readonly every: string | null };
  readonly sealing: { readonly required: SealRequirement; readonly key: string | null };
};

/** The longest a freshness window may be: seven days, the longest interval of continuous validation of FedRAMP 20x. */
export const LONGEST_WINDOW_MS = 7 * 86_400_000;

/** The defaults: the controller collects, a managed asset every 15 minutes and an adopted asset every day, every capture journaled and committed hourly, nothing pushed, a seal only with an export. */
export const DEFAULT_CAPTURE_POLICY: CapturePolicy = {
  branch: "evidence",
  collector: { runsOn: "controller" },
  cadence: { managed: "PT15M", adopted: "P1D", perRole: {}, perAsset: {} },
  journal: { granularity: "every-capture", heartbeat: null, disposable: null, commit: { every: "PT1H" } },
  push: { mode: "never", remote: "origin", every: null },
  sealing: { required: "on-export", key: null },
};

/** The capture policy for the agent workspaces of an estate (0008-estate-workstations FR-016): an agent workspace is observed every 15 minutes whether adopted or managed, and a disposable one is journaled as changes and a heartbeat. */
export const AGENT_WORKSPACE_CAPTURE: CapturePolicyInput = {
  cadence: { perRole: { "agent-workspace": "PT15M" } },
  journal: { disposable: { granularity: "changes-and-heartbeat", heartbeat: "PT30M" } },
};

/** How long an observation is good for at a cadence: twice the cadence, and never more than the longest window. */
export function freshnessWindowMs(cadenceMs: number): number {
  return Math.min(2 * cadenceMs, LONGEST_WINDOW_MS);
}

const REF = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const RESERVED_BRANCHES = ["main", "master", "HEAD", "trunk", "develop"];
const REMOTE = /^[A-Za-z][A-Za-z0-9._-]*$/;

/** The policy from what was written, with every reason it cannot hold where it cannot. */
export function defineCapturePolicy(input: CapturePolicyInput = {}): Result<CapturePolicy, readonly string[]> {
  const d = DEFAULT_CAPTURE_POLICY;
  const problems: string[] = [];
  const branch = input.branch ?? d.branch;
  if (!REF.test(branch) || branch.includes("..") || branch.endsWith(".lock")) problems.push(`${JSON.stringify(branch)} is not a name of a branch`);
  else if (RESERVED_BRANCHES.includes(branch)) problems.push(`the evidence is not kept on ${branch}: it is kept on a branch of its own, so that the tenant's own branch stays what a person signed`);
  const runsOn = input.collector?.runsOn ?? d.collector.runsOn;
  if (runsOn !== "controller" && parseAssetId(runsOn).kind === "err") problems.push(`${JSON.stringify(runsOn)}: the collector runs on the controller or on an asset`);

  const duration = (label: string, text: string): number | undefined => {
    const r = parseDuration(text);
    if (r.kind === "err" || r.value <= 0) {
      problems.push(`${label} ${JSON.stringify(text)} is not a duration above zero (such as PT15M or P1D)`);
      return undefined;
    }
    return r.value;
  };
  const cadence = { managed: input.cadence?.managed ?? d.cadence.managed, adopted: input.cadence?.adopted ?? d.cadence.adopted, perRole: { ...(input.cadence?.perRole ?? {}) }, perAsset: { ...(input.cadence?.perAsset ?? {}) } };
  const cadences: { label: string; text: string; ms: number | undefined }[] = [
    { label: "the cadence of managed assets", text: cadence.managed, ms: duration("the cadence of managed assets", cadence.managed) },
    { label: "the cadence of adopted assets", text: cadence.adopted, ms: duration("the cadence of adopted assets", cadence.adopted) },
    ...Object.entries(cadence.perRole).map(([role, text]) => {
      if (!/^[a-z][a-z0-9-]*$/.test(role)) problems.push(`${JSON.stringify(role)} in the cadences of roles is not a role (lower case words joined by hyphens)`);
      return { label: `the cadence of the role ${role}`, text, ms: duration(`the cadence of the role ${role}`, text) };
    }),
    ...Object.entries(cadence.perAsset).map(([id, text]) => {
      if (parseAssetId(id).kind === "err") problems.push(`${JSON.stringify(id)} in the cadences is not an asset`);
      return { label: `the cadence of ${id}`, text, ms: duration(`the cadence of ${id}`, text) };
    }),
  ];
  for (const c of cadences) if (c.ms !== undefined && c.ms > LONGEST_WINDOW_MS) problems.push(`${c.label} ${c.text} is longer than seven days, the longest an observation may be left`);

  const granularity = input.journal?.granularity ?? d.journal.granularity;
  if (granularity !== "every-capture" && granularity !== "changes-and-heartbeat") problems.push(`${JSON.stringify(granularity)} is not a granularity of the journal`);
  const heartbeat = input.journal?.heartbeat ?? null;
  if (granularity === "every-capture" && heartbeat !== null) problems.push("a heartbeat is for a journal of changes and a heartbeat: every capture is journaled already");
  if (granularity === "changes-and-heartbeat") {
    if (heartbeat === null) problems.push("a journal of changes and a heartbeat needs the heartbeat");
    else {
      const hb = duration("the heartbeat", heartbeat);
      if (hb !== undefined) {
        for (const c of cadences) if (c.ms !== undefined && hb > freshnessWindowMs(c.ms)) problems.push(`the heartbeat ${heartbeat} is longer than the freshness window of ${c.label.replace("the cadence of ", "")} (${c.text}): it would look stale between heartbeats`);
      }
    }
  }
  let disposable: { readonly granularity: JournalGranularity; readonly heartbeat: string | null } | null = null;
  if (input.journal?.disposable !== undefined) {
    const g = input.journal.disposable.granularity;
    const hb = input.journal.disposable.heartbeat ?? null;
    if (g !== "every-capture" && g !== "changes-and-heartbeat") problems.push(`${JSON.stringify(g)} is not a granularity of the journal of disposable assets`);
    else if (g === "every-capture" && hb !== null) problems.push("a heartbeat is for a journal of changes and a heartbeat: every capture is journaled already (disposable assets)");
    else if (g === "changes-and-heartbeat") {
      if (hb === null) problems.push("a journal of changes and a heartbeat needs the heartbeat (disposable assets)");
      else {
        const ms = duration("the heartbeat of disposable assets", hb);
        if (ms !== undefined) for (const c of cadences) if (c.ms !== undefined && ms > freshnessWindowMs(c.ms)) problems.push(`the heartbeat ${hb} of disposable assets is longer than the freshness window of ${c.label.replace("the cadence of ", "")} (${c.text}): it would look stale between two heartbeats`);
      }
    }
    disposable = { granularity: g, heartbeat: hb };
  }
  const commitEvery = input.journal?.commit?.every ?? d.journal.commit.every;
  duration("the commit interval of the journal", commitEvery);

  const mode = input.push?.mode ?? d.push.mode;
  if (mode !== "never" && mode !== "after-commit" && mode !== "every") problems.push(`${JSON.stringify(mode)} is not a way to push`);
  const remote = input.push?.remote ?? d.push.remote;
  if (!REMOTE.test(remote)) problems.push(`${JSON.stringify(remote)} is not a name of a remote`);
  const pushEvery = input.push?.every ?? null;
  if (mode === "every") {
    if (pushEvery === null) problems.push("pushing at an interval needs the interval");
    else duration("the push interval", pushEvery);
  } else if (pushEvery !== null) problems.push("a push interval is for pushing at an interval");

  const required = input.sealing?.required ?? d.sealing.required;
  if (required !== "never" && required !== "on-export" && required !== "daily") problems.push(`${JSON.stringify(required)} is not a seal requirement`);
  const key = input.sealing?.key ?? null;
  if (required !== "never" && key === null && input.sealing?.required !== undefined) problems.push("a seal is made with a key of the tenant's signers: name it");
  if (key !== null && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key)) problems.push(`${JSON.stringify(key)} is not a name of a signer`);

  if (problems.length > 0) return err(problems);
  return ok({
    branch,
    collector: { runsOn },
    cadence,
    journal: { granularity, heartbeat, disposable, commit: { every: commitEvery } },
    push: { mode, remote, every: pushEvery },
    sealing: { required, key },
  });
}

/** The cadence of an asset: its own where the policy gives one, else that of its role (the `role` attribute), else that of its state; nothing for an asset that is not observed (a discovered asset). */
export function cadenceOf(policy: CapturePolicy, asset: { readonly id: string; readonly state: "discovered" | "adopted" | "managed"; readonly attributes?: Readonly<Record<string, unknown>> }): string | undefined {
  const own = policy.cadence.perAsset[asset.id];
  if (own !== undefined) return own;
  if (asset.state === "discovered") return undefined;
  const role = asset.attributes?.["role"];
  const ofRole = typeof role === "string" ? policy.cadence.perRole[role] : undefined;
  if (ofRole !== undefined) return ofRole;
  return asset.state === "managed" ? policy.cadence.managed : policy.cadence.adopted;
}

/** How the journal records an asset: that of disposable assets where the asset says it is `disposable` and the policy gives one, else that of the policy. */
export function journalOf(policy: CapturePolicy, asset: { readonly attributes?: Readonly<Record<string, unknown>> }): { readonly granularity: JournalGranularity; readonly heartbeat: string | null } {
  return asset.attributes?.["disposability"] === "disposable" && policy.journal.disposable !== null ? policy.journal.disposable : { granularity: policy.journal.granularity, heartbeat: policy.journal.heartbeat };
}
