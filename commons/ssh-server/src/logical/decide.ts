// Spec: 0005-enrollment-policy FR-001, FR-002, FR-003
/**
 * The enrollment decision, pure: the rules of the policy held against the evidence of a session, with an explanation of every decision, and the resolution of a device to an asset the controller already knows, so that it is adopted and never duplicated.
 *
 * @module
 */
import type { DeviceClass, EnrollPolicy, EnrollRule, Facts, KnownAsset, EnrollmentSession } from "@intellectual-frontiers/ssh-server/governance";
import { inAnyCidr } from "./network.ts";

/** Guess the class of a device from the banner of its client (`SSH-2.0-...`). */
export function classifyClient(ident: string): DeviceClass {
  if (/cisco/i.test(ident)) return "cisco";
  if (/ROSSSH|routeros/i.test(ident)) return "routeros";
  if (/junos|juniper/i.test(ident)) return "junos";
  if (/edgeos|edgerouter/i.test(ident)) return "edgeos";
  if (/ubnt|unifi|ubiquiti/i.test(ident)) return "unifi";
  if (/putty/i.test(ident)) return "putty";
  if (/dropbear/i.test(ident)) return "dropbear";
  if (/libssh/i.test(ident)) return "libssh";
  if (/openssh/i.test(ident)) return "openssh";
  return "other";
}

/** How a session matched an asset. */
export type Resolution =
  | { readonly kind: "new" }
  | { readonly kind: "adopt"; readonly assetId: string; readonly matchedOn: readonly string[] }
  | { readonly kind: "conflict"; readonly assetIds: readonly string[] };

/** Resolve a device to the assets known: by machine id, serial, MAC or host key. One asset that matches is adopted (merged), none is new, and two or more is a conflict that a person settles. */
export function resolveIdentity(facts: Facts, assets: readonly KnownAsset[]): Resolution {
  const macs = new Set(facts.nics.map((n) => n.mac));
  const keys = new Set(facts.hostKeys.map((k) => k.fingerprint as string));
  const found = new Map<string, string[]>();
  for (const a of assets) {
    const on: string[] = [];
    if (a.machineId !== undefined && a.machineId !== "" && a.machineId === facts.machineId) on.push("machine-id");
    if (a.serial !== undefined && a.serial !== "" && facts.serial !== undefined && a.serial === facts.serial) on.push("serial");
    if (a.macs.some((m) => macs.has(m.toLowerCase()))) on.push("mac");
    if (a.hostKeys.some((k) => keys.has(k))) on.push("host-key");
    if (on.length > 0) found.set(a.id, on);
  }
  if (found.size === 0) return { kind: "new" };
  if (found.size > 1) return { kind: "conflict", assetIds: [...found.keys()].sort() };
  const [id, on] = [...found.entries()][0] as [string, string[]];
  return { kind: "adopt", assetId: id, matchedOn: on };
}

/** What the policy decided. */
export type EnrollDecision = { readonly outcome: "approve" | "pending" | "refuse"; readonly rule?: number; readonly explanation: string; readonly assetId?: string };

function matches(rule: EnrollRule, s: Pick<EnrollmentSession, "binding" | "sourceIp">, facts: Facts): string | undefined {
  switch (rule.kind) {
    case "token": {
      const b = s.binding;
      if (b === undefined || b.kind !== "token") return undefined;
      if (rule.tenant !== undefined && b.tenant !== rule.tenant) return undefined;
      if (rule.fleet !== undefined && b.fleet !== rule.fleet) return undefined;
      if ((rule.labels ?? []).some((l) => !b.labels.includes(l))) return undefined;
      return `a valid token (${b.id}) scoped to ${b.tenant ?? "any tenant"}/${b.fleet ?? "any fleet"}`;
    }
    case "pairing-code":
      return s.binding?.kind === "pairing" ? `a pairing code (${s.binding.id}) was used` : undefined;
    case "inventory": {
      for (const e of rule.allow) {
        if (e.serial !== undefined && facts.serial === e.serial) return "its serial is in the inventory allow-list";
        if (e.machineId !== undefined && facts.machineId === e.machineId) return "its machine id is in the inventory allow-list";
        if (e.mac !== undefined && facts.nics.some((n) => n.mac === e.mac?.toLowerCase())) return "one of its MAC addresses is in the inventory allow-list";
        if (e.hostKey !== undefined && facts.hostKeys.some((k) => k.fingerprint === e.hostKey)) return "one of its host keys is in the inventory allow-list";
      }
      return undefined;
    }
    case "source-network":
      return inAnyCidr(s.sourceIp, rule.cidrs) ? "its source address is in a network the policy trusts" : undefined;
    case "cloud-attestation":
      return undefined;
    case "refuse-network":
      return inAnyCidr(s.sourceIp, rule.cidrs) ? "its source address is in a network the policy refuses" : undefined;
  }
}

/** Decide a session whose facts are in. The first rule that matches decides. Where the device matches two assets, or no rule matches, a person decides. A decision always carries its explanation. */
export function decideEnrollment(policy: EnrollPolicy, session: Pick<EnrollmentSession, "binding" | "sourceIp">, facts: Facts, assets: readonly KnownAsset[]): EnrollDecision {
  const identity = resolveIdentity(facts, assets);
  if (identity.kind === "conflict") return { outcome: "pending", explanation: `the device matches more than one known asset (${identity.assetIds.join(", ")}): a person settles which it is` };
  const adopted = identity.kind === "adopt" ? { assetId: identity.assetId } : {};
  const suffix = identity.kind === "adopt" ? `; it is adopted by asset ${identity.assetId} (matched on ${identity.matchedOn.join(", ")})` : "";
  for (const [i, rule] of policy.rules.entries()) {
    const why = matches(rule, session, facts);
    if (why === undefined) continue;
    return rule.kind === "refuse-network"
      ? { outcome: "refuse", rule: i, explanation: `rule ${i} (${rule.kind}): ${why}` }
      : { outcome: "approve", rule: i, explanation: `rule ${i} (${rule.kind}): ${why}${suffix}`, ...adopted };
  }
  return { outcome: "pending", explanation: `no rule approves it${suffix}: a person decides`, ...adopted };
}

/** The fields that differ between the facts a device gave before and now (a drift), as names. */
export function factsDrift(before: Facts, now: Facts): readonly string[] {
  const out: string[] = [];
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  if (!same(before.os, now.os)) out.push("os");
  for (const k of ["kernel", "hostname", "machineId", "cpus", "memoryBytes", "packageManager", "sudo", "init"] as const) if (before[k] !== now[k]) out.push(k);
  for (const k of ["disks", "nics", "hostKeys", "adminUsers"] as const) if (!same(before[k], now[k])) out.push(k);
  return out;
}

/** The asset a session becomes (or merges into) when it is approved: the ids and keys it showed, with the keys it proved as the keys it authenticates by. `existing` is the asset it was adopted by. */
export function assetOfSession(session: EnrollmentSession, existing?: KnownAsset): KnownAsset {
  const f = session.facts;
  const union = <T>(a: readonly T[], b: readonly T[]): readonly T[] => [...new Set([...a, ...b])];
  const proven = [...session.offeredKeys.filter((k) => k.proven).map((k) => k.fingerprint), ...(session.deviceKey === undefined ? [] : [session.deviceKey])];
  return {
    id: existing?.id ?? session.assetId ?? `asset-${session.id}`,
    ...(f?.machineId !== undefined ? { machineId: f.machineId } : existing?.machineId !== undefined ? { machineId: existing.machineId } : {}),
    ...(f?.serial !== undefined ? { serial: f.serial } : existing?.serial !== undefined ? { serial: existing.serial } : {}),
    macs: union(existing?.macs ?? [], f?.nics.map((n) => n.mac) ?? []),
    hostKeys: union(existing?.hostKeys ?? [], f?.hostKeys.map((k) => k.fingerprint) ?? []),
    keys: union(existing?.keys ?? [], proven),
    ...(f !== undefined ? { facts: f } : existing?.facts !== undefined ? { facts: existing.facts } : {}),
    ...(existing?.pending !== undefined ? { pending: existing.pending } : {}),
  };
}
