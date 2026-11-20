// Spec: 0006-grc-evidence FR-005
/**
 * The `dsse` signer (0006-grc-evidence FR-005): a payload signed into a DSSE envelope (the Dead Simple Signing Envelope) with Web Crypto keys, and verified with their public keys. It reads no key it
 * was not given: a key is `{ key: CryptoKey, keyid? }`. Its custody is `file`, because the keys it is given are in memory; a signer whose keys are held by a service or a token is another unit.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { type DsseKey, signEnvelope, verifyEnvelope } from "@intellectual-frontiers/crypto/dsse";
import type { Signer } from "@intellectual-frontiers/grc/physical";

function keysOf(keys: readonly unknown[]): readonly DsseKey[] | undefined {
  const out: DsseKey[] = [];
  for (const k of keys) {
    if (typeof k !== "object" || k === null || !(Reflect.get(k, "key") instanceof CryptoKey)) return undefined;
    out.push(k as DsseKey);
  }
  return out;
}

/** The `dsse` signer. */
export const dsseSigner: Signer = {
  id: "dsse",
  custody: "file",
  async sign(payloadType, payload, keys) {
    const ks = keysOf(keys);
    if (ks === undefined || ks.length === 0) return err({ kind: "key", message: "a dsse key is { key: CryptoKey, keyid? }, and at least one is needed" });
    const r = await signEnvelope(payloadType, payload, ks);
    return r.kind === "err" ? err({ kind: "key", message: r.error.reason }) : ok(r.value);
  },
  async verify(envelope, payloadType, keys) {
    const ks = keysOf(keys);
    if (ks === undefined || ks.length === 0) return err({ kind: "key", message: "a dsse key is { key: CryptoKey, keyid? }, and at least one is needed" });
    const r = await verifyEnvelope(envelope, payloadType, ks);
    if (r.kind === "ok") return ok(r.value.payload);
    return err({ kind: r.error.kind === "payload-type" ? "payload-type" : "signature", message: r.error.kind });
  },
};
