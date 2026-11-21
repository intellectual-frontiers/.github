// Spec: 0005-evidence-capture-views FR-007, FR-008
/**
 * Sealing and exporting with a signer of the fleet (0005-evidence-capture-views FR-007, FR-008): which signer a key file is (the one whose public key is the key file's, and, where the policy names one for the seal, only that one), the seal of the journal, the export of a bundle
 * (refused unsigned where the policy asks for a seal with an export), the seals of the journal against the signers, and the verification of a bundle offline with the signers of a file or the bundle's own. Where the signers are kept is the caller's.
 *
 * @example
 * ```ts
 * import { readSignersFile } from "./signing.ts";
 * // await readSignersFile("signers.json") is a Result of the list of { name, role, key }
 * ```
 *
 * @module
 */
import { readFile } from "node:fs/promises";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { CapturePolicy } from "@intellectual-frontiers/estate/governance";
import type { GitRefStore } from "@intellectual-frontiers/grc/stores/gitref";
import { path } from "@intellectual-frontiers/system";
import { exportBundle, sealJournal, sealStatus, verifyBundleDir, type Exported, type SealStatus, type TrustedSigner, type Verified } from "./bundle.ts";
import { readJournal } from "./collect.ts";

/** Which signer of the fleet a key file is. */
async function signerOfKey(keyFile: string, signers: readonly TrustedSigner[], required: string | null): Promise<Result<TrustedSigner, string>> {
  const pub = await readFile(`${keyFile}.pub`, "utf8").catch(() => undefined);
  if (pub === undefined) return err(`${keyFile}.pub is not there: the public key of the key is needed to know whose it is`);
  const blob = pub.trim().split(/\s+/)[1];
  const who = signers.find((s) => s.key.split(/\s+/)[1] === blob);
  if (who === undefined) return err(`${keyFile} is not the key of a signer of the fleet`);
  if (required !== null && who.name !== required) return err(`the policy asks for the seal of ${required}, and this key is ${who.name}`);
  return ok(who);
}

/** Seals the journal of a fleet with a key of one of its signers, made at the instant. */
export async function sealWith(store: GitRefStore, policy: CapturePolicy, signers: readonly TrustedSigner[], o: { readonly fleet: string; readonly keyFile: string; readonly agent: boolean; readonly now: string }): Promise<Result<{ readonly seq: number; readonly head: string; readonly signer: string }, string>> {
  const who = await signerOfKey(o.keyFile, signers, policy.sealing.key);
  if (who.kind === "err") return who;
  const sealed = await sealJournal(store, { fleet: o.fleet, key: { keyFile: o.keyFile, ...(o.agent ? { agent: true } : {}) }, now: o.now });
  return sealed.kind === "err" ? sealed : ok({ seq: sealed.value.seq, head: sealed.value.head, signer: who.value.name });
}

/** Exports the journal up to an instant as a bundle; the policy that asks for a seal with an export refuses an unsigned one. */
export async function exportWith(store: GitRefStore, policy: CapturePolicy, signers: readonly TrustedSigner[], o: { readonly fleet: string; readonly out: string; readonly until: string; readonly keyFile: string; readonly agent: boolean; readonly now: string }): Promise<Result<Exported, string>> {
  if (o.keyFile === "" && policy.sealing.required !== "never") return err(`the capture policy asks for a seal with an export (sealing.required is ${policy.sealing.required}): give --key`);
  let key: { keyFile: string; agent?: boolean } | undefined;
  if (o.keyFile !== "") {
    const who = await signerOfKey(o.keyFile, signers, policy.sealing.key);
    if (who.kind === "err") return who;
    key = { keyFile: o.keyFile, ...(o.agent ? { agent: true } : {}) };
  }
  return exportBundle(store, { fleet: o.fleet, out: path.resolve(o.out), until: o.until === "" ? o.now : o.until, now: o.now, signers, ...(key === undefined ? {} : { key }) });
}

/** The signers a file lists: a JSON array of `{ name, role, key }`, or an object with `signers`. */
export async function readSignersFile(file: string): Promise<Result<readonly TrustedSigner[], string>> {
  try {
    const v = JSON.parse(await readFile(file, "utf8")) as unknown;
    const list = Array.isArray(v) ? v : (v as { signers?: unknown }).signers;
    if (!Array.isArray(list) || !list.every((s) => typeof s?.name === "string" && typeof s?.role === "string" && typeof s?.key === "string")) return err(`${file} is not a list of signers: { name, role, key }`);
    return ok(list as TrustedSigner[]);
  } catch (e) {
    return err(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Verifies a bundle offline: with the signers of a file, or with its own where no file is given. */
export async function verifyBundleAt(dir: string, signersFile: string, at: string): Promise<Result<Verified, string>> {
  const signers = signersFile === "" ? undefined : await readSignersFile(signersFile);
  if (signers?.kind === "err") return signers;
  return verifyBundleDir(path.resolve(dir), signers?.value, at);
}

/** The seals of a fleet's journal against its signers, and when the last good seal was made. */
export async function sealsOf(store: GitRefStore, policy: CapturePolicy, signers: readonly TrustedSigner[]): Promise<Result<{ readonly status: SealStatus; readonly lastSealedAt: string | undefined; readonly required: string }, string>> {
  const status = await sealStatus(store, signers);
  if (status.kind === "err") return status;
  const journal = await readJournal(store);
  const last = journal.kind === "ok" && status.value.lastSealedSeq !== undefined ? journal.value.filter((e) => e.type === "seal").at(-1)?.createdAt : undefined;
  return ok({ status: status.value, lastSealedAt: last, required: policy.sealing.required });
}
