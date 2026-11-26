// Spec: 0020-grc-approval FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-021, FR-023, FR-024
/**
 * The approval (commons grc 0020-grc-approval): what a person signs to approve a thing by its plan hash, and the pure verification of it. A statement says the action, the subject, the plan hash, the request, a nonce, a window of time, the risk and, where the
 * approval is of a pairing, a binding to what the person typed; it is signed with a key of the person in the namespace `ifc-approval`; and a verifier decides, from the request the controller expects, the registry of the keys of persons, the policy and the nonces already used,
 * whether the approvals given are enough. An agent has no key in the registry and holds no private key, so it has no way to make one; it can only make a request that waits.
 *
 * @remarks
 * Verification reads no clock, no file and no program. The instant is an argument, the signature check is a port (`SignatureVerifier`), and the nonces that have been used are a set the caller keeps. Verification does not consume a nonce: it gives the nonces to
 * consume, and the caller consumes them where it records the act, so that the check and the record are one step of the caller's.
 *
 * @example
 * ```ts
 * import { DEFAULT_APPROVAL_POLICY, bindingOf } from "./approval.ts";
 * await bindingOf(["session-1", "123456"]); // the hex SHA-256 of the length-prefixed parts
 * ```
 *
 * @module
 */
import { type Decoded, err, literal, object, ok, type Result, string } from "@intellectual-frontiers/core";
import { pae } from "@intellectual-frontiers/crypto/dsse";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { instant, instantMs } from "@intellectual-frontiers/grc/governance";
import { digestOf } from "./canonical.ts";
import { APPROVAL_NAMESPACE, type KeyCustody, isHardwareKeyType, keyById, keyValidAt, type PersonKeys, type SignatureVerifier, type SignedDocument } from "./person-keys.ts";

/** How much an act matters: a routine act is approved by one person, a regulated act by the persons the request names. */
export const APPROVAL_RISKS = ["routine", "regulated"] as const;
/** A risk. */
export type ApprovalRisk = (typeof APPROVAL_RISKS)[number];

/** What an approval is signed as. */
export const APPROVAL_PAYLOAD_TYPE = "application/vnd.ifc.approval+json";

const statementDecoder = object(
  { schema: literal("1"), action: string, subject: string, planHash: string, requestId: string, nonce: string, notBefore: instant, notAfter: instant, risk: literal(...APPROVAL_RISKS) },
  { binding: string },
);
/** What a person signs (FR-001). */
export type ApprovalStatement = Decoded<typeof statementDecoder>;

/** The statement of this value, or what is wrong with it (FR-001): the action is lower case words, the subject and the request are not empty, the plan hash is 64 hex digits, the nonce is at least 32 hex digits (128 bits), and the window ends after it starts. */
export function decodeStatement(input: unknown): Result<ApprovalStatement, string> {
  const r = statementDecoder(input);
  if (r.kind === "err") return err(`E-APPROVAL-STATEMENT: ${r.error.path} is not ${r.error.expected}`);
  const s = r.value;
  if (!/^[a-z][a-z0-9.-]*$/u.test(s.action)) return err("E-APPROVAL-STATEMENT: the action is lower case words with dots and hyphens");
  if (s.subject.trim() === "" || s.subject.length > 256 || s.requestId.trim() === "") return err("E-APPROVAL-STATEMENT: the subject and the request are not empty");
  if (!/^[0-9a-f]{64}$/u.test(s.planHash)) return err("E-APPROVAL-STATEMENT: the plan hash is 64 hex digits");
  if (!/^[0-9a-f]{32,128}$/u.test(s.nonce)) return err("E-APPROVAL-STATEMENT: the nonce is at least 32 hex digits");
  const from = instantMs(s.notBefore);
  const to = instantMs(s.notAfter);
  if (from === undefined || to === undefined || to <= from) return err("E-APPROVAL-STATEMENT: the window ends after it starts");
  return ok(s);
}

/** The bytes a person's key signs for a statement: the pre-authentication encoding of DSSE of the payload type and the canonical JSON of the statement. */
export function statementBytes(statement: ApprovalStatement): { readonly payload: Uint8Array; readonly message: Uint8Array } {
  const payload = new TextEncoder().encode(canonicalJson(statement));
  return { payload, message: pae(APPROVAL_PAYLOAD_TYPE, payload) };
}

/** A hash that ties a statement to what the person typed (FR-021): the hex SHA-256 of the parts, each with its length in front, so that no two lists of parts give one text. */
export async function bindingOf(parts: readonly string[]): Promise<string> {
  const enc = new TextEncoder();
  const bytes = parts.map((p) => enc.encode(p));
  const out = new Uint8Array(bytes.reduce((n, b) => n + 4 + b.length, 0));
  let at = 0;
  for (const b of bytes) {
    out[at] = (b.length >>> 24) & 255;
    out[at + 1] = (b.length >>> 16) & 255;
    out[at + 2] = (b.length >>> 8) & 255;
    out[at + 3] = b.length & 255;
    out.set(b, at + 4);
    at += 4 + b.length;
  }
  return sha256(out);
}

/** What the controller expects of an approval (FR-003): the action, the subject and the plan hash it will do, its request, its risk, how many persons with which roles, and whom it may not count. */
export type ApprovalRequest = {
  readonly action: string;
  readonly subject: string;
  readonly planHash: string;
  readonly requestId: string;
  readonly risk: ApprovalRisk;
  /** The binding the statement must carry, where the request has one. */
  readonly binding?: string;
  /** How many distinct persons must approve (at least 1). */
  readonly threshold: number;
  /** A person must hold one of these roles. */
  readonly roles: readonly string[];
  /** Who proposed the act, where a person did: not counted when `separateFromProposer` is set. */
  readonly proposer?: string;
  readonly separateFromProposer?: boolean;
};

/** What the policy asks of an approval (FR-010): how long a statement may live, how far ahead of the clock it may start, which custody is enough for each risk, and whether a regulated act needs the token to have verified the person. */
export type ApprovalPolicy = {
  readonly maxLifetimeMs: number;
  readonly maxSkewMs: number;
  readonly custody: Readonly<Record<ApprovalRisk, readonly KeyCustody[]>>;
  readonly regulatedNeedsUserVerified: boolean;
};

/** The default policy: ten minutes, two minutes of skew, a routine act by a hardware key or a managed one, a regulated act by a hardware key that verified the person. A file key approves nothing unless a policy lists it, and then the approval is weak (FR-010). */
export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  maxLifetimeMs: 10 * 60_000,
  maxSkewMs: 2 * 60_000,
  custody: { routine: ["hardware", "managed"], regulated: ["hardware"] },
  regulatedNeedsUserVerified: true,
};

/** A signed approval: the envelope of DSSE with the statement as payload. */
export type SignedApproval = SignedDocument;

/** Why one approval was not counted (FR-004): a code from the table, the person where it is known, and a sentence. */
export type Rejection = {
  readonly code:
    | "E-APPROVAL-STATEMENT"
    | "E-APPROVAL-MISMATCH"
    | "E-APPROVAL-NOT-YET"
    | "E-APPROVAL-EXPIRED"
    | "E-APPROVAL-LIFETIME"
    | "E-APPROVAL-REPLAY"
    | "E-APPROVAL-UNKNOWN-KEY"
    | "E-APPROVAL-KEY-NOT-YET"
    | "E-APPROVAL-KEY-EXPIRED"
    | "E-APPROVAL-KEY-REVOKED"
    | "E-APPROVAL-ROLE"
    | "E-APPROVAL-CUSTODY"
    | "E-APPROVAL-PRESENCE"
    | "E-APPROVAL-VERIFICATION"
    | "E-APPROVAL-COUNTER"
    | "E-APPROVAL-SIGNATURE"
    | "E-APPROVAL-PROPOSER"
    | "E-APPROVAL-DUPLICATE";
  readonly person?: string;
  readonly keyId?: string;
  readonly message: string;
};

/** An approval that counts (FR-012). `weak` is set where the custody was not the one the policy prefers but one it lists. */
export type Approver = {
  readonly person: string;
  readonly keyId: string;
  readonly custody: KeyCustody;
  readonly weak: boolean;
  readonly userVerified: boolean;
  readonly nonce: string;
  readonly notAfter: string;
  readonly counter?: number;
};

/** What verification gives where the approvals are enough (FR-012): the persons that counted, the nonces to consume, the counters to keep, the approvals not counted, and the digest of the request with the keys that approved it. */
export type Verified = {
  readonly approvers: readonly Approver[];
  readonly nonces: readonly string[];
  readonly counters: Readonly<Record<string, number>>;
  readonly rejected: readonly Rejection[];
  readonly digest: string;
};

/** What verification gives where they are not (FR-004): the sentence, the code of the first rejection (or `E-APPROVAL-INSUFFICIENT`), what counted, and what did not. */
export type Insufficient = { readonly code: Rejection["code"] | "E-APPROVAL-INSUFFICIENT"; readonly message: string; readonly accepted: readonly Approver[]; readonly rejected: readonly Rejection[]; readonly need: number };

/** What is verified (FR-004). */
export type VerifyInput = {
  readonly request: ApprovalRequest;
  readonly approvals: readonly SignedApproval[];
  readonly registry: PersonKeys;
  readonly policy: ApprovalPolicy;
  /** The nonces already used. */
  readonly used: ReadonlySet<string>;
  /** The last counter seen of each hardware key, by key id. */
  readonly counters?: Readonly<Record<string, number>>;
  /** The instant of the act, ISO 8601 with a zone. */
  readonly now: string;
};

const canonicalJson = (v: unknown): string => {
  const walk = (x: unknown): unknown => (Array.isArray(x) ? x.map(walk) : x !== null && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().filter((k) => Reflect.get(x, k) !== undefined).map((k) => [k, walk(Reflect.get(x, k))])) : x);
  return JSON.stringify(walk(v));
};

const unb64 = (s: string): Uint8Array | undefined => {
  try {
    return Uint8Array.from(atob(s.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  } catch {
    return undefined;
  }
};

/** The one rejection of an approval, or the approver it makes: a deterministic pipeline, the first failure wins (FR-024). */
async function judge(input: VerifyInput, signed: SignedApproval, seen: Set<string>, verifier: SignatureVerifier): Promise<Rejection | Approver> {
  const at = instantMs(input.now);
  if (at === undefined) return { code: "E-APPROVAL-STATEMENT", message: "the instant of the act is not an ISO 8601 instant with a zone" };
  if (signed.payloadType !== APPROVAL_PAYLOAD_TYPE) return { code: "E-APPROVAL-STATEMENT", message: `the payload is for ${signed.payloadType}, not ${APPROVAL_PAYLOAD_TYPE}` };
  const payload = unb64(signed.payload);
  if (payload === undefined) return { code: "E-APPROVAL-STATEMENT", message: "the payload is not base64" };
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return { code: "E-APPROVAL-STATEMENT", message: "the payload is not JSON" };
  }
  const st = decodeStatement(raw);
  if (st.kind === "err") return { code: "E-APPROVAL-STATEMENT", message: st.error };
  const s = st.value;
  const r = input.request;
  const wrong = s.action !== r.action ? "action" : s.subject !== r.subject ? "subject" : s.planHash !== r.planHash ? "plan hash" : s.requestId !== r.requestId ? "request" : s.risk !== r.risk ? "risk" : r.binding !== undefined && s.binding !== r.binding ? "binding" : undefined;
  if (wrong !== undefined) return { code: "E-APPROVAL-MISMATCH", message: `the approval is for another ${wrong} than the one asked: approve what is shown` };
  const from = instantMs(s.notBefore) ?? 0;
  const to = instantMs(s.notAfter) ?? 0;
  if (to - from > input.policy.maxLifetimeMs) return { code: "E-APPROVAL-LIFETIME", message: `the approval lives ${String(Math.round((to - from) / 1000))} seconds, more than the ${String(Math.round(input.policy.maxLifetimeMs / 1000))} the policy allows` };
  if (from > at + input.policy.maxSkewMs) return { code: "E-APPROVAL-NOT-YET", message: "the approval starts later than now" };
  if (at >= to) return { code: "E-APPROVAL-EXPIRED", message: "the approval has ended: approve again" };
  if (input.used.has(s.nonce) || seen.has(s.nonce)) return { code: "E-APPROVAL-REPLAY", message: "this approval was used before: an approval is used once" };
  const sig = signed.signatures[0];
  if (sig === undefined || signed.signatures.length !== 1) return { code: "E-APPROVAL-SIGNATURE", message: "an approval has one signature" };
  const line = await verifier.signerOf(sig.sig);
  if (line.kind === "err") return { code: "E-APPROVAL-SIGNATURE", message: line.error };
  const fp = await verifier.fingerprint(line.value);
  if (fp.kind === "err") return { code: "E-APPROVAL-SIGNATURE", message: fp.error };
  const key = keyById(input.registry, fp.value);
  if (key === undefined) return { code: "E-APPROVAL-UNKNOWN-KEY", keyId: fp.value, message: `the key ${fp.value} is not in the registry of the keys of persons: it approves nothing` };
  if (key.publicKey.trim().split(/\s+/).slice(0, 2).join(" ") !== line.value.trim().split(/\s+/).slice(0, 2).join(" ")) return { code: "E-APPROVAL-UNKNOWN-KEY", keyId: fp.value, person: key.person, message: "the public key of the signature is not the one the registry holds under that id" };
  const valid = keyValidAt(key, at);
  if (valid !== undefined) return { code: valid === "revoked" ? "E-APPROVAL-KEY-REVOKED" : valid === "expired" ? "E-APPROVAL-KEY-EXPIRED" : "E-APPROVAL-KEY-NOT-YET", person: key.person, keyId: key.keyId, message: `the key ${key.keyId} of ${key.person} is ${valid.replace("-", " ")}` };
  if (!r.roles.some((x) => key.roles.includes(x))) return { code: "E-APPROVAL-ROLE", person: key.person, keyId: key.keyId, message: `${key.person} holds none of the roles that may approve this (${r.roles.join(", ")})` };
  const facts = await verifier.verify(sig.sig, statementMessage(payload), line.value, APPROVAL_NAMESPACE);
  if (facts.kind === "err") return { code: "E-APPROVAL-SIGNATURE", person: key.person, keyId: key.keyId, message: facts.error };
  const hardware = isHardwareKeyType(facts.value.keyType);
  const custody: KeyCustody = hardware ? "hardware" : key.custody === "hardware" ? "file" : key.custody;
  const allowed = input.policy.custody[r.risk];
  if (!allowed.includes(custody)) return { code: "E-APPROVAL-CUSTODY", person: key.person, keyId: key.keyId, message: `a ${r.risk} act is approved by a key held as ${allowed.join(" or ")}, not as ${custody}` };
  if (hardware && facts.value.flags?.userPresent !== true) return { code: "E-APPROVAL-PRESENCE", person: key.person, keyId: key.keyId, message: "the token did not report that a person touched it" };
  const userVerified = facts.value.flags?.userVerified === true;
  if (r.risk === "regulated" && input.policy.regulatedNeedsUserVerified && !userVerified) return { code: "E-APPROVAL-VERIFICATION", person: key.person, keyId: key.keyId, message: "a regulated act needs the token to have verified the person (a PIN or a biometric)" };
  const counter = facts.value.counter;
  const last = input.counters?.[key.keyId];
  if (counter !== undefined && last !== undefined && counter <= last) return { code: "E-APPROVAL-COUNTER", person: key.person, keyId: key.keyId, message: `the counter of the token went from ${String(last)} to ${String(counter)}: the key may have been cloned` };
  if (r.separateFromProposer === true && r.proposer !== undefined && key.person === r.proposer) return { code: "E-APPROVAL-PROPOSER", person: key.person, keyId: key.keyId, message: `${key.person} proposed this act and may not approve it` };
  seen.add(s.nonce);
  return { person: key.person, keyId: key.keyId, custody, weak: custody === "file", userVerified, nonce: s.nonce, notAfter: s.notAfter, ...(counter === undefined ? {} : { counter }) };
}

const statementMessage = (payload: Uint8Array): Uint8Array => pae(APPROVAL_PAYLOAD_TYPE, payload);

/**
 * Whether the approvals given are enough for the request (FR-004): each approval is judged on its own in the order given, the first failure of each decides its rejection, and the approvals that count are those of distinct persons; the result is an approver
 * list that meets the threshold, or `Insufficient` with every rejection. One person with several keys counts once, and a rejected approval does not void the others (FR-011). The order of the approvals does not change which persons count (FR-023).
 */
export async function verifyApproval(input: VerifyInput, verifier: SignatureVerifier): Promise<Result<Verified, Insufficient>> {
  const seen = new Set<string>();
  const accepted: Approver[] = [];
  const rejected: Rejection[] = [];
  const persons = new Set<string>();
  const need = Math.max(1, input.request.threshold);
  for (const signed of input.approvals) {
    const j = await judge(input, signed, seen, verifier);
    if ("code" in j) {
      rejected.push(j);
      continue;
    }
    if (persons.has(j.person)) {
      rejected.push({ code: "E-APPROVAL-DUPLICATE", person: j.person, keyId: j.keyId, message: `${j.person} already approved: a person counts once` });
      continue;
    }
    persons.add(j.person);
    accepted.push(j);
  }
  if (accepted.length < need) {
    const first = rejected[0];
    const code = first !== undefined && accepted.length === 0 ? first.code : "E-APPROVAL-INSUFFICIENT";
    const message = accepted.length === 0 && first === undefined ? `no approval was given: ${String(need)} ${need === 1 ? "person has" : "persons have"} to approve` : accepted.length === 0 && first !== undefined ? first.message : `${String(accepted.length)} of ${String(need)} persons approved`;
    return err({ code, message, accepted, rejected, need });
  }
  const counters: Record<string, number> = {};
  for (const a of accepted) if (a.counter !== undefined) counters[a.keyId] = a.counter;
  const digest = await digestOf({ request: input.request, keys: accepted.map((a) => a.keyId).sort() });
  return ok({ approvers: accepted, nonces: accepted.map((a) => a.nonce), counters, rejected, digest });
}
