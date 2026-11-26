// Spec: 0005-enrollment-policy FR-001, FR-002, FR-003
/**
 * The enrollment decision, pure: the rules of the policy held against the evidence of a session, with an explanation of every decision, and the resolution of a device to an asset the controller already knows, so that it is adopted and never duplicated.
 *
 * @module
 */
import type { DeviceClass, EnrollPolicy, EnrollRule, Facts, KnownAsset, EnrollmentSession } from "@intellectual-frontiers/ssh-server/governance";
import { type Result } from "@intellectual-frontiers/core";
import { keyOf, type IdentityKey } from "@intellectual-frontiers/estate/governance";
import { resolveIdentity, type KnownKeys, type Resolution as EstateResolution } from "@intellectual-frontiers/estate/logical";
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

/** How a session matched an asset: the resolution of estate over the keys of the device. */
export type Resolution = EstateResolution;

const keysOfFacts = (facts: Facts): readonly IdentityKey[] => {
  const made: (Result<IdentityKey, string> | undefined)[] = [
    facts.machineId === undefined || facts.machineId === "" ? undefined : keyOf("machine-id", facts.machineId),
    facts.serial === undefined || facts.serial === "" ? undefined : keyOf("serial", facts.serial),
    ...facts.nics.map((n) => keyOf("mac", n.mac)),
    ...facts.hostKeys.map((k) => keyOf("host-key", k.fingerprint as string)),
  ];
  return made.flatMap((r) => (r !== undefined && r.kind === "ok" ? [r.value] : []));
};

const keysOfAsset = (a: KnownAsset): KnownKeys => ({
  id: a.id,
  keys: [
    ...(a.machineId === undefined || a.machineId === "" ? [] : [keyOf("machine-id", a.machineId)]),
    ...(a.serial === undefined || a.serial === "" ? [] : [keyOf("serial", a.serial)]),
    ...a.macs.map((m) => keyOf("mac", m)),
    ...a.hostKeys.map((k) => keyOf("host-key", k as string)),
  ].flatMap((r) => (r.kind === "ok" ? [r.value] : [])),
});

/** Resolve a device to the assets known: by machine id, serial, MAC or host key, through the one resolution of estate (a strong key or a weak one adopts here). One asset that matches is adopted (merged), none is new, and two or more is a conflict that a person settles. */
export function resolveFacts(facts: Facts, assets: readonly KnownAsset[]): Resolution {
  return resolveIdentity(keysOfFacts(facts), assets.map(keysOfAsset), { weakAdopts: true });
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
  const identity = resolveFacts(facts, assets);
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
