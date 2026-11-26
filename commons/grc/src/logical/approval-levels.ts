// Spec: 0020-grc-approval FR-025, FR-026, FR-027, FR-028
/**
 * The levels of approval (commons grc 0020-grc-approval): a ladder with a simple start. A fleet begins at `presence`, where a person's presence at the terminal is enough and nothing is set up; it may rise to `key`, where an approval is a signature by a key the platform made for
 * the person and registered itself; and to `hardware`, where a regulated act is approved by a token that verified the person. Each level is a policy of the verification of 0020, nothing more: this module names the levels, gives the policy of each, says which level an approval
 * reached, and builds the versions of the registry that creating, adding and replacing a key need, as pure values that a caller signs.
 *
 * @remarks
 * Nothing here reads a clock, a file, a key or a program. The instant is an argument; signing a version is the caller's step (`signRegistry` of the sshsig signer). The registry stays add-only (FR-018): a key is replaced by adding its successor and marking it revoked, and the revocation
 * of a key never lengthens anything.
 *
 * @example
 * ```ts
 * import { policyOfLevel } from "./approval-levels.ts";
 * policyOfLevel("presence"); // undefined: nothing is signed
 * ```
 *
 * @module
 */
import { err, type Result } from "@intellectual-frontiers/core";
import { type ApprovalPolicy, type Approver, DEFAULT_APPROVAL_POLICY } from "./approval.ts";
import { decodeRegistry, type KeyCustody, type PersonKey, type PersonKeys, REGISTRY_ADMIN, registryDigest } from "./person-keys.ts";

/** The levels, lowest first: a person's presence, a key the platform made and registered, a token that verified the person. */
export const APPROVAL_LEVELS = ["presence", "key", "hardware"] as const;
/** A level of approval. */
export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];

/** The place of a level on the ladder, from 0. */
export const levelRank = (level: ApprovalLevel): number => APPROVAL_LEVELS.indexOf(level);

/** Whether the level reached is at least the level needed. */
export const levelAtLeast = (have: ApprovalLevel, need: ApprovalLevel): boolean => levelRank(have) >= levelRank(need);

/**
 * The policy of a level (FR-025): none for `presence`, because nothing is signed there. At `key` every custody is enough for every risk and a token need not have verified the person; at `hardware` a routine act is still enough with any key, and a regulated act is approved by a
 * hardware key that verified the person. The lifetime is the default's unless given.
 */
export function policyOfLevel(level: ApprovalLevel, maxLifetimeMs: number = DEFAULT_APPROVAL_POLICY.maxLifetimeMs): ApprovalPolicy | undefined {
  if (level === "presence") return undefined;
  const all: readonly KeyCustody[] = ["hardware", "managed", "file"];
  return level === "key"
    ? { ...DEFAULT_APPROVAL_POLICY, maxLifetimeMs, custody: { routine: all, regulated: all }, regulatedNeedsUserVerified: false }
    : { ...DEFAULT_APPROVAL_POLICY, maxLifetimeMs, custody: { routine: all, regulated: ["hardware"] }, regulatedNeedsUserVerified: true };
}

/** The level that holding a key as this custody reaches (FR-026): a token is `hardware`, a key an agent or a file holds is `key`. */
export const levelOfCustody = (custody: KeyCustody): ApprovalLevel => (custody === "hardware" ? "hardware" : "key");

/** The level an approval reached (FR-026): the lowest of its approvers, `presence` where nobody signed. */
export function levelOfApprovers(approvers: readonly Approver[]): ApprovalLevel {
  if (approvers.length === 0) return "presence";
  return approvers.reduce<ApprovalLevel>((low, a) => (levelRank(levelOfCustody(a.custody)) < levelRank(low) ? levelOfCustody(a.custody) : low), "hardware");
}

/** What a key of a person is made of when it enters the registry: its id (the fingerprint), its public key line, the person and how it is held. */
export type NewKey = { readonly keyId: string; readonly publicKey: string; readonly person: string; readonly custody: KeyCustody };

const entryOf = (k: NewKey, roles: readonly string[], at: string, replaces?: string): PersonKey => ({ keyId: k.keyId, publicKey: k.publicKey, person: k.person, roles: [...roles], custody: k.custody, validFrom: at, ...(replaces === undefined ? {} : { replaces }) });

/**
 * The first version of a registry (FR-027): the key of the person who starts, with the roles `approver` and `registry-admin`, at version 1. The platform signs it with that same key and pins the key id as the root of the fleet the first time it is needed, so the first use asks for no
 * typed comparison; the weaker assurance of that first trust is the caller's to say plainly.
 */
export function firstRegistry(key: NewKey, issuedAt: string): Result<PersonKeys, string> {
  return decodeRegistry({ schema: "1", version: 1, issuedAt, keys: [entryOf(key, ["approver", REGISTRY_ADMIN], issuedAt)] });
}

/** A change to a registry (FR-028): keys to add, the roles each gets, and the ids of keys to mark revoked from the instant of the version. */
export type RegistryChange = { readonly add?: readonly { readonly key: NewKey; readonly roles: readonly string[]; readonly replaces?: string }[]; readonly revoke?: readonly string[] };

/**
 * The next version of a registry (FR-028): the version after it, naming its digest, with the keys added and the keys revoked marked so from `issuedAt`. A key is replaced by adding its successor with `replaces` and revoking it, in one version. The version is not signed: a registry
 * administrator of the version before signs it, and `registryOfChain` is what accepts it. Refused where it would revoke a key that is not in the registry or add one that already is.
 */
export async function nextRegistry(previous: PersonKeys, change: RegistryChange, issuedAt: string): Promise<Result<PersonKeys, string>> {
  const ids = new Set(previous.keys.map((k) => k.keyId));
  for (const id of change.revoke ?? []) if (!ids.has(id)) return err(`E-APPROVAL-REGISTRY: the key ${id} is not in the registry, so it cannot be revoked`);
  for (const a of change.add ?? []) if (ids.has(a.key.keyId)) return err(`E-APPROVAL-REGISTRY: the key ${a.key.keyId} is in the registry already`);
  const revoked = new Set(change.revoke ?? []);
  const kept = previous.keys.map((k) => (revoked.has(k.keyId) && k.revokedAt === undefined ? { ...k, revokedAt: issuedAt } : k));
  const added = (change.add ?? []).map((a) => entryOf(a.key, a.roles, issuedAt, a.replaces));
  return decodeRegistry({ schema: "1", version: previous.version + 1, issuedAt, previous: await registryDigest(previous), keys: [...kept, ...added] });
}
