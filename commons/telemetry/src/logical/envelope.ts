// Spec: 0003-telemetry-reach FR-008
/**
 * The signed envelope of a batch (0003-telemetry-reach FR-008 to FR-011): an in-toto Statement v1 whose subject is the SHA-256 of the encoded batch and whose predicate says which device made it, of which
 * signal, in which epoch and at which sequence number, signed through the port `EnvelopeSigner`; and the receiver's side: `openEnvelope` refuses a body whose signature, payload type, digest or predicate does
 * not hold, naming no key and no payload, and `SeenLedger` drops a batch it already took.
 *
 * @remarks
 * The signature is the caller's: the port has the shape of `grc` `Signer`, so that the SSHSIG signer of an enrolled device and its trusted keys are adapters in the product and telemetry imports no signer.
 * `webCryptoSigner` is the signer of a test and of a program that holds a CryptoKey.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type DsseKey,
  signEnvelope,
  statement,
  subject,
  verifyEnvelope,
  type DsseEnvelope,
} from "@intellectual-frontiers/crypto/dsse";
import type { QueueSignal } from "./queue.ts";

/** The type of the payload of the envelope, and the content type of the body that carries it. */
export const TELEMETRY_PAYLOAD_TYPE = "application/vnd.ifc.telemetry+json";

/** The type of the predicate. */
export const TELEMETRY_PREDICATE_TYPE = "urn:ifc:telemetry:batch:v1";

/** What an envelope says of its batch (FR-008). */
export type BatchPredicate = {
  readonly device: string;
  readonly signal: QueueSignal;
  readonly epoch: string;
  readonly seq: number;
  readonly at: number;
  readonly count: number;
};

/** The port of a signer: the shape of `grc` `Signer`, over serialized envelopes. */
export interface EnvelopeSigner {
  sign(payloadType: string, payload: Uint8Array): Promise<Result<string, string>>;
  verify(envelope: string, payloadType: string): Promise<Result<{ readonly payload: Uint8Array; readonly keyId: string }, string>>;
}

/** The body of a request: the envelope and the encoded batch it binds. */
export type SealedBody = { readonly envelope: string; readonly batch: string };

/** Why a body was refused. It names no key and no payload (FR-011). */
export type Refusal = { readonly kind: "malformed" | "signature" | "payload-type" | "digest" | "predicate" | "replay"; readonly message: string };

/** What a body that was opened holds. `keyId` is what the signer verified the signature by. */
export type Opened = { readonly predicate: BatchPredicate; readonly keyId: string; readonly batch: string };

const utf8 = new TextEncoder();
const utf8d = new TextDecoder();

const hex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function digestOf(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", utf8.encode(text)));
}

/** Signs a batch for a device: the statement binds the digest of `batch` to the predicate (FR-008). */
export async function sealBatch(batch: string, predicate: BatchPredicate, signer: EnvelopeSigner): Promise<Result<SealedBody, string>> {
  const st = statement([await subject("batch", utf8.encode(batch))], TELEMETRY_PREDICATE_TYPE, predicate);
  const signed = await signer.sign(TELEMETRY_PAYLOAD_TYPE, utf8.encode(JSON.stringify(st)));
  return signed.kind === "err" ? signed : ok({ envelope: signed.value, batch });
}

const isPredicate = (v: unknown): v is BatchPredicate => {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p["device"] === "string" &&
    p["device"] !== "" &&
    (p["signal"] === "traces" || p["signal"] === "logs" || p["signal"] === "metrics") &&
    typeof p["epoch"] === "string" &&
    Number.isSafeInteger(p["seq"]) &&
    typeof p["at"] === "number" &&
    Number.isSafeInteger(p["count"])
  );
};

/** Opens a body: the signature must verify, the payload type be ours, the digest match the batch and the predicate be well formed; anything else is a refusal that says which kind and nothing of the key or the payload. */
export async function openEnvelope(body: unknown, signer: EnvelopeSigner): Promise<Result<Opened, Refusal>> {
  if (typeof body !== "object" || body === null) return err({ kind: "malformed", message: "the body is not an envelope" });
  const b = body as Record<string, unknown>;
  if (typeof b["envelope"] !== "string" || typeof b["batch"] !== "string") return err({ kind: "malformed", message: "the body has no envelope and batch" });
  let typed: string;
  try {
    const raw: unknown = JSON.parse(b["envelope"]);
    typed = typeof raw === "object" && raw !== null && typeof (raw as { payloadType?: unknown }).payloadType === "string" ? (raw as { payloadType: string }).payloadType : "";
  } catch {
    return err({ kind: "malformed", message: "the envelope is not JSON" });
  }
  if (typed !== TELEMETRY_PAYLOAD_TYPE) return err({ kind: "payload-type", message: "the payload type is not the telemetry type" });
  const v = await signer.verify(b["envelope"], TELEMETRY_PAYLOAD_TYPE);
  if (v.kind === "err") return err({ kind: "signature", message: "the signature does not verify" });
  let st: unknown;
  try {
    st = JSON.parse(utf8d.decode(v.value.payload));
  } catch {
    return err({ kind: "malformed", message: "the payload is not a statement" });
  }
  const s = st as { subject?: readonly { digest?: { sha256?: unknown } }[]; predicateType?: unknown; predicate?: unknown };
  if (s.predicateType !== TELEMETRY_PREDICATE_TYPE || !isPredicate(s.predicate)) return err({ kind: "predicate", message: "the predicate is not a telemetry predicate" });
  const bound = s.subject?.[0]?.digest?.sha256;
  if (bound !== (await digestOf(b["batch"]))) return err({ kind: "digest", message: "the digest does not match the batch" });
  return ok({ predicate: s.predicate, keyId: v.value.keyId, batch: b["batch"] });
}

/** A signer over WebCrypto keys and the DSSE of `crypto`: `signWith` signs, `verifyWith` are the public keys trusted, each named by its key id. */
export function webCryptoSigner(signWith: readonly DsseKey[], verifyWith: readonly DsseKey[]): EnvelopeSigner {
  return {
    async sign(payloadType, payload) {
      const e = await signEnvelope(payloadType, payload, signWith);
      return e.kind === "err" ? err(e.error.reason) : ok(JSON.stringify(e.value));
    },
    async verify(envelope, payloadType) {
      let parsed: DsseEnvelope;
      try {
        parsed = JSON.parse(envelope) as DsseEnvelope;
      } catch {
        return err("the envelope is not JSON");
      }
      const v = await verifyEnvelope(parsed, payloadType, verifyWith);
      if (v.kind === "err") return err(v.error.kind);
      return ok({ payload: v.value.payload, keyId: v.value.keys[0]?.keyid ?? "" });
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Sequence numbers and the receiver's memory (FR-007, FR-009)
// ---------------------------------------------------------------------------------------------------------------------------------

/** The count of a device: a random epoch and the last sequence number made in it. A lost queue starts a new epoch (FR-009). */
export type Sequence = { readonly epoch: string; readonly last: number };

/** A new epoch from random bytes the caller gives: the count starts at zero. */
export function newEpoch(random: Uint8Array): Sequence {
  return { epoch: [...random].map((x) => x.toString(16).padStart(2, "0")).join(""), last: 0 };
}

/** The next number of a count, and the count after it: it grows by one. */
export function nextSeq(s: Sequence): readonly [number, Sequence] {
  return [s.last + 1, { epoch: s.epoch, last: s.last + 1 }];
}

/** What a receiver has taken: for each device the epoch and the highest sequence number. */
export type SeenLedger = ReadonlyMap<string, Sequence>;

/** Whether a batch is new, and the ledger after it: a pair of device and number already taken is a replay; a new epoch starts a new count. */
export function accept(seen: SeenLedger, predicate: Pick<BatchPredicate, "device" | "epoch" | "seq">): readonly [Result<undefined, Refusal>, SeenLedger] {
  const known = seen.get(predicate.device);
  if (known !== undefined && known.epoch === predicate.epoch && predicate.seq <= known.last) {
    return [err({ kind: "replay", message: "this batch was already taken" }), seen];
  }
  const next = new Map(seen);
  next.set(predicate.device, { epoch: predicate.epoch, last: predicate.seq });
  return [ok(undefined), next];
}
