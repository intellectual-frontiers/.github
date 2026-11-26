// Spec: 0003-server-policy FR-011
/**
 * The operations of a person on a store: approve a session with a plan, refuse it, and add a token or a pairing code. An agent never calls `approve` for itself: the name of the person is an argument, and the controller supplies it from its own authentication.
 *
 * @module
 */
import { createHash, randomBytes } from "node:crypto";
import { err, ok } from "@intellectual-frontiers/core";
import type { Result } from "@intellectual-frontiers/core";
import type { EnrollmentSession, InstallPlan, PairingRecord, TokenRecord } from "@intellectual-frontiers/ssh-server/governance";
import { approveSession, assetOfSession, confirmPairing, pairingCode, refuseSession } from "@intellectual-frontiers/ssh-server/logical";
import type { ConfirmOutcome } from "@intellectual-frontiers/ssh-server/logical";
import type { PairingConfig } from "@intellectual-frontiers/ssh-server/governance";
import type { EnrollStore } from "./store.ts";

/** A person approves a session with a plan. The asset the session becomes (or merges into) is stored. */
export async function approve(store: EnrollStore, id: string, by: string, plan: InstallPlan, now: number = Date.now()): Promise<Result<EnrollmentSession, string>> {
  const session = await store.getSession(id);
  if (session === undefined) return err("unknown session");
  const r = approveSession(session, by, plan, now);
  if (r.kind === "err") return r;
  await store.putSession(r.value);
  const existing = (await store.assets()).find((a) => a.id === r.value.assetId);
  await store.putAsset(assetOfSession(r.value, existing));
  return ok(r.value);
}

/** A person refuses a session. */
export async function refuse(store: EnrollStore, id: string, by: string, reason: string, now: number = Date.now()): Promise<Result<EnrollmentSession, string>> {
  const session = await store.getSession(id);
  if (session === undefined) return err("unknown session");
  const r = refuseSession(session, by, reason, now);
  if (r.kind === "err") return r;
  await store.putSession(r.value);
  return ok(r.value);
}

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
function random32(n: number): string {
  return Array.from(randomBytes(n), (b) => BASE32[b % 32]).join("");
}

/** Make a single-use token valid for `ttlMs`, and store it with the hash of its secret only. The secret is returned once, to show the person. */
export async function issueToken(store: EnrollStore, scope: { readonly tenant?: string; readonly fleet?: string; readonly labels?: readonly string[] }, ttlMs: number, now: number = Date.now()): Promise<{ readonly record: TokenRecord; readonly secret: string }> {
  const id = random32(8);
  const secret = `tok-${id}-${random32(32)}`;
  const record: TokenRecord = { id, secretHash: createHash("sha256").update(secret).digest("hex"), labels: scope.labels ?? [], expiresAt: now + ttlMs, used: false, ...(scope.tenant === undefined ? {} : { tenant: scope.tenant }), ...(scope.fleet === undefined ? {} : { fleet: scope.fleet }) };
  await store.putToken(record);
  return { record, secret };
}

/** Make a pairing code valid for `ttlMs` (default 10 minutes), and store it. */
export async function issuePairing(store: EnrollStore, scope: { readonly tenant?: string; readonly fleet?: string; readonly labels?: readonly string[] }, ttlMs = 600_000, now: number = Date.now()): Promise<PairingRecord> {
  const record: PairingRecord = { code: pairingCode(() => randomBytes(4).readUInt32BE(0) / 2 ** 32), labels: scope.labels ?? [], expiresAt: now + ttlMs, used: false, ...(scope.tenant === undefined ? {} : { tenant: scope.tenant }), ...(scope.fleet === undefined ? {} : { fleet: scope.fleet }) };
  await store.putPairing(record);
  return record;
}

/** A person types the code the device showed. A right code approves the session with the plan and stores its asset (the key the device proved becomes the key of `s-device`); a wrong one spends a try; the third, or the end of its time, burns the session. */
export async function confirm(store: EnrollStore, id: string, typed: string, by: string, plan: InstallPlan, cfg: PairingConfig, maxAttempts = 3, now: number = Date.now()): Promise<Result<ConfirmOutcome, string>> {
  const session = await store.getSession(id);
  if (session === undefined) return err("unknown session");
  const r = confirmPairing(session, typed, by, plan, cfg, maxAttempts, now);
  if (r.kind === "err") return r;
  await store.putSession(r.value.session);
  for (const e of r.value.effects) if (e.kind === "audit") await store.appendAudit(e.event);
  if (r.value.kind === "approved") {
    const existing = (await store.assets()).find((a) => a.id === r.value.session.assetId);
    await store.putAsset(assetOfSession(r.value.session, existing));
  }
  return r;
}

/** The controller revokes every key of an asset: nothing proves it again until a person enrolls it. */
export async function revokeAsset(store: EnrollStore, assetId: string): Promise<Result<true, string>> {
  const a = (await store.assets()).find((x) => x.id === assetId);
  if (a === undefined) return err("unknown asset");
  await store.putAsset({ ...a, keys: [], pendingKeys: [], revoked: true });
  return ok(true);
}

