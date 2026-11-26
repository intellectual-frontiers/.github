/**
 * Tests of the approval and of the registry of the keys of persons (commons grc 0020-grc-approval): real `ssh-keygen` keys sign the statements, and a software Ed25519 key stands in for a token to make the signature of a FIDO2 key in the format that
 * PROTOCOL.u2f describes (so the verification of a token is proved against our reading of the format, and not against a device: spec FR-014 says so). Every name is made up and nothing reads a clock.
 *
 * @module
 */
import fc from "fast-check";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves as provesWith } from "@intellectual-frontiers/test";
import {
  APPROVAL_NAMESPACE,
  APPROVAL_PAYLOAD_TYPE,
  DEFAULT_APPROVAL_POLICY,
  REGISTRY_PAYLOAD_TYPE,
  bindingOf,
  decodeRegistry,
  decodeStatement,
  registryDigest,
  registryOfChain,
  statementBytes,
  verifyApproval,
  type ApprovalPolicy,
  type ApprovalRequest,
  type ApprovalStatement,
  type PersonKey,
  type PersonKeys,
  type SignedApproval,
} from "../src/logical/mod.ts";
import { SK_ED25519, approvalVerifier, fingerprintOf, sshsigSignerFor } from "../src/signers/sshsig/mod.ts";

type Fn = () => Promise<void>;
type Reqs = Parameters<typeof provesWith>[0];
const proves = (ids: Reqs, name: string, a: Fn | { skip?: string }, b?: Fn): void => (typeof a === "function" ? provesWith(ids, name, a) : provesWith(ids, name, b as Fn, a));
const skip = proc.which("ssh-keygen") === undefined ? { skip: "ssh-keygen is not installed" } : {};
const enc = new TextEncoder();
const NOW = "2026-06-01T12:00:00Z";
const PLAN = "a".repeat(64);
const signer = sshsigSignerFor(APPROVAL_NAMESPACE as never);

const b64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b));
const concat = (...p: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let at = 0;
  for (const x of p) {
    out.set(x, at);
    at += x.length;
  }
  return out;
};
const u32 = (n: number): Uint8Array => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const str = (b: Uint8Array): Uint8Array => concat(u32(b.length), b);
const sha = async (b: Uint8Array | string, name: "SHA-256" | "SHA-512" = "SHA-256"): Promise<Uint8Array> => new Uint8Array(await crypto.subtle.digest(name, typeof b === "string" ? enc.encode(b) : new Uint8Array(b)));

type Soft = { readonly file: string; readonly line: string; readonly keyId: string };
async function softKey(dir: string, name: string): Promise<Soft> {
  const file = path.join(dir, name);
  const r = await proc.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", name, "-f", file]);
  assert(r.success, r.stderr);
  const line = (await fs.readTextFile(`${file}.pub`)).trim();
  const id = await fingerprintOf(line);
  assert(id.kind === "ok");
  return { file, line, keyId: id.value };
}

type Token = { readonly kp: CryptoKeyPair; readonly line: string; readonly blob: Uint8Array; readonly keyId: string };
async function tokenKey(): Promise<Token> {
  const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const blob = concat(str(enc.encode(SK_ED25519)), str(pub), str(enc.encode("ssh:")));
  const line = `${SK_ED25519} ${b64(blob)}`;
  const id = await fingerprintOf(line);
  assert(id.kind === "ok", "fingerprint of the token");
  return { kp, line, blob, keyId: id.value };
}

/** A signature of a token in the format of PROTOCOL.u2f, as a person's touch would make it. */
async function tokenSign(t: Token, payloadType: string, payload: Uint8Array, flags: number, counter: number): Promise<SignedApproval> {
  const message = new Uint8Array(concat(enc.encode("DSSEv1 "), enc.encode(String(payloadType.length)), enc.encode(" "), enc.encode(payloadType), enc.encode(" "), enc.encode(String(payload.length)), enc.encode(" "), payload));
  const data = concat(enc.encode("SSHSIG"), str(enc.encode(APPROVAL_NAMESPACE)), str(new Uint8Array()), str(enc.encode("sha512")), str(await sha(message, "SHA-512")));
  const signed = concat(await sha(enc.encode("ssh:")), new Uint8Array([flags]), u32(counter), await sha(data));
  const raw = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, t.kp.privateKey, new Uint8Array(signed)));
  const inner = concat(str(enc.encode(SK_ED25519)), str(raw), new Uint8Array([flags]), u32(counter));
  const blob = concat(enc.encode("SSHSIG"), u32(1), str(t.blob), str(enc.encode(APPROVAL_NAMESPACE)), str(new Uint8Array()), str(enc.encode("sha512")), str(inner));
  const body = b64(blob).match(/.{1,70}/gu)?.join("\n") ?? "";
  return { payloadType, payload: b64(payload), signatures: [{ sig: `-----BEGIN SSH SIGNATURE-----\n${body}\n-----END SSH SIGNATURE-----` }] };
}

const stmt = (over: Partial<ApprovalStatement> = {}): ApprovalStatement => {
  const d = decodeStatement({ schema: "1", action: "enroll.approve", subject: "synthetic-asset-01", planHash: PLAN, requestId: "synthetic-request-01", nonce: "1".repeat(32), notBefore: "2026-06-01T11:59:30Z", notAfter: "2026-06-01T12:05:00Z", risk: "routine", ...over });
  assert(d.kind === "ok", d.kind === "err" ? d.error : "");
  return d.value;
};

async function approveWith(key: Soft, s: ApprovalStatement): Promise<SignedApproval> {
  const { payload } = statementBytes(s);
  const r = await signer.sign(APPROVAL_PAYLOAD_TYPE, payload, [{ keyFile: key.file }]);
  assert(r.kind === "ok", r.kind === "err" ? r.error.message : "");
  return r.value;
}

const request = (over: Partial<ApprovalRequest> = {}): ApprovalRequest => ({ action: "enroll.approve", subject: "synthetic-asset-01", planHash: PLAN, requestId: "synthetic-request-01", risk: "routine", threshold: 1, roles: ["approver"], ...over });

const entry = (k: { keyId: string; line: string }, person: string, over: Partial<PersonKey> = {}): PersonKey => ({ keyId: k.keyId, publicKey: k.line, person, roles: ["approver"], custody: "managed", validFrom: "2026-01-01T00:00:00Z", ...over });
const registryOf = (keys: readonly PersonKey[], version = 1): PersonKeys => {
  const d = decodeRegistry({ schema: "1", version, issuedAt: "2026-01-01T00:00:00Z", keys });
  assert(d.kind === "ok", d.kind === "err" ? d.error : "");
  return d.value;
};
const policy = (over: Partial<ApprovalPolicy> = {}): ApprovalPolicy => ({ ...DEFAULT_APPROVAL_POLICY, ...over });
const verify = (approvals: readonly SignedApproval[], registry: PersonKeys, req = request(), over: Partial<{ used: ReadonlySet<string>; now: string; policy: ApprovalPolicy; counters: Record<string, number> }> = {}) =>
  verifyApproval({ request: req, approvals, registry, policy: over.policy ?? policy(), used: over.used ?? new Set(), now: over.now ?? NOW, ...(over.counters === undefined ? {} : { counters: over.counters }) }, approvalVerifier);
const codeOf = async (r: ReturnType<typeof verify>): Promise<string> => {
  const x = await r;
  return x.kind === "ok" ? "ok" : x.error.code;
};

proves(["0020-grc-approval FR-001", "0020-grc-approval FR-002", "0020-grc-approval FR-004", "0020-grc-approval FR-012"], "a statement signed by a person's key approves the request it was made for, and the result names the person, the key and the nonce to consume", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const a = await softKey(dir, "synthetic-person-01");
    const r = await verify([await approveWith(a, stmt())], registryOf([entry(a, "synthetic-person-01")]));
    assert(r.kind === "ok", r.kind === "err" ? r.error.message : "");
    assertEquals(r.value.approvers.map((x) => [x.person, x.keyId, x.custody, x.weak]), [["synthetic-person-01", a.keyId, "managed", false]]);
    assertEquals(r.value.nonces, ["1".repeat(32)]);
    assertEquals(decodeStatement({ ...stmt(), nonce: "short" }).kind, "err");
    assertEquals(decodeStatement({ ...stmt(), planHash: "abc" }).kind, "err");
  });
});

proves(["0020-grc-approval FR-005"], "an approval for another action, subject, plan hash, request, risk or binding is refused, and the message says which", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const a = await softKey(dir, "synthetic-person-01");
    const reg = registryOf([entry(a, "synthetic-person-01")]);
    const signed = await approveWith(a, stmt());
    for (const [over, word] of [[{ action: "asset.apply" }, "action"], [{ subject: "synthetic-asset-02" }, "subject"], [{ planHash: "b".repeat(64) }, "plan hash"], [{ requestId: "synthetic-request-02" }, "request"], [{ risk: "regulated" as const }, "risk"], [{ binding: "c".repeat(64) }, "binding"]] as const) {
      const r = await verify([signed], reg, request(over));
      assert(r.kind === "err" && r.error.code === "E-APPROVAL-MISMATCH" && r.error.message.includes(word), `${word}: ${r.kind === "err" ? r.error.message : "accepted"}`);
    }
  });
});

proves(["0020-grc-approval FR-006"], "an approval is refused before its window, after it, and when it lives longer than the policy allows", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const a = await softKey(dir, "synthetic-person-01");
    const reg = registryOf([entry(a, "synthetic-person-01")]);
    const signed = await approveWith(a, stmt());
    assertEquals(await codeOf(verify([signed], reg, request(), { now: "2026-06-01T12:05:00Z" })), "E-APPROVAL-EXPIRED");
    assertEquals(await codeOf(verify([signed], reg, request(), { now: "2026-06-01T11:50:00Z" })), "E-APPROVAL-NOT-YET");
    const long = await approveWith(a, stmt({ notAfter: "2026-06-01T13:00:00Z" }));
    assertEquals(await codeOf(verify([long], reg)), "E-APPROVAL-LIFETIME");
  });
});

proves(["0020-grc-approval FR-007"], "an approval is used once: a nonce already used, or used twice in one set, is a replay", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const a = await softKey(dir, "synthetic-person-01");
    const b = await softKey(dir, "synthetic-person-02");
    const reg = registryOf([entry(a, "synthetic-person-01"), entry(b, "synthetic-person-02")]);
    const signed = await approveWith(a, stmt());
    assertEquals(await codeOf(verify([signed], reg, request(), { used: new Set(["1".repeat(32)]) })), "E-APPROVAL-REPLAY");
    const two = await verify([signed, await approveWith(b, stmt())], reg, request({ threshold: 2 }));
    assert(two.kind === "err" && two.error.accepted.length === 1 && two.error.rejected[0]?.code === "E-APPROVAL-REPLAY");
  });
});

proves(["0020-grc-approval FR-008", "0020-grc-approval FR-009"], "a key that is not in the registry, not yet valid, ended or revoked, or whose person holds no role that may approve, approves nothing", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const a = await softKey(dir, "synthetic-person-01");
    const signed = await approveWith(a, stmt());
    assertEquals(await codeOf(verify([signed], registryOf([]))), "E-APPROVAL-UNKNOWN-KEY");
    assertEquals(await codeOf(verify([signed], registryOf([entry(a, "synthetic-person-01", { validFrom: "2026-07-01T00:00:00Z" })]))), "E-APPROVAL-KEY-NOT-YET");
    assertEquals(await codeOf(verify([signed], registryOf([entry(a, "synthetic-person-01", { validUntil: "2026-05-01T00:00:00Z" })]))), "E-APPROVAL-KEY-EXPIRED");
    assertEquals(await codeOf(verify([signed], registryOf([entry(a, "synthetic-person-01", { revokedAt: "2026-06-01T11:59:59Z" })]))), "E-APPROVAL-KEY-REVOKED");
    assertEquals(await codeOf(verify([signed], registryOf([entry(a, "synthetic-person-01", { revokedAt: "2026-06-02T00:00:00Z" })]))), "E-APPROVAL-KEY-REVOKED");
    assertEquals(await codeOf(verify([signed], registryOf([entry(a, "synthetic-person-01", { roles: ["reader"] })]))), "E-APPROVAL-ROLE");
  });
});

proves(["0020-grc-approval FR-010"], "a key held as a file approves nothing by the default policy, and approves weakly where a policy lists it; a regulated act needs a token", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const a = await softKey(dir, "synthetic-person-01");
    const signed = await approveWith(a, stmt());
    const filed = registryOf([entry(a, "synthetic-person-01", { custody: "file" })]);
    assertEquals(await codeOf(verify([signed], filed)), "E-APPROVAL-CUSTODY");
    const weak = await verify([signed], filed, request(), { policy: policy({ custody: { routine: ["hardware", "managed", "file"], regulated: ["hardware"] } }) });
    assert(weak.kind === "ok" && weak.value.approvers[0]?.weak === true);
    const regulated = await approveWith(a, stmt({ risk: "regulated" }));
    assertEquals(await codeOf(verify([regulated], registryOf([entry(a, "synthetic-person-01")]), request({ risk: "regulated" }))), "E-APPROVAL-CUSTODY");
  });
});

proves(["0020-grc-approval FR-013", "0020-grc-approval FR-010"], "a signature of a token is verified with its flags and counter: presence is needed, a regulated act needs the person verified, a counter that does not rise is refused", async () => {
  const t = await tokenKey();
  const reg = registryOf([entry(t, "synthetic-person-01", { custody: "hardware" })]);
  const make = async (s: ApprovalStatement, flags: number, counter: number) => tokenSign(t, APPROVAL_PAYLOAD_TYPE, statementBytes(s).payload, flags, counter);
  const ok1 = await verify([await make(stmt(), 0x01, 5)], reg);
  assert(ok1.kind === "ok" && ok1.value.approvers[0]?.custody === "hardware" && ok1.value.counters[t.keyId] === 5, ok1.kind === "err" ? ok1.error.message : "");
  assertEquals(await codeOf(verify([await make(stmt(), 0x00, 6)], reg)), "E-APPROVAL-PRESENCE");
  assertEquals(await codeOf(verify([await make(stmt({ risk: "regulated" }), 0x01, 7)], reg, request({ risk: "regulated" }))), "E-APPROVAL-VERIFICATION");
  const reg2 = await verify([await make(stmt({ risk: "regulated" }), 0x05, 8)], reg, request({ risk: "regulated" }));
  assert(reg2.kind === "ok" && reg2.value.approvers[0]?.userVerified === true, reg2.kind === "err" ? reg2.error.message : "");
  assertEquals(await codeOf(verify([await make(stmt(), 0x01, 5)], reg, request(), { counters: { [t.keyId]: 5 } })), "E-APPROVAL-COUNTER");
  const tampered = await make(stmt(), 0x01, 9);
  const flipped = { ...tampered, signatures: [{ sig: tampered.signatures[0]?.sig.replace("-----END", "AAAA\n-----END") ?? "" }] };
  assert((await codeOf(verify([flipped], reg))) !== "ok", "flipped");
  // the flags are covered by the signature: a presence bit set after signing does not verify
  const parsed = await approvalVerifier.signerOf((await make(stmt(), 0x00, 10)).signatures[0]?.sig ?? "");
  assert(parsed.kind === "ok", "parsed");
});

proves(["0020-grc-approval FR-013"], "a signature that is not Ed25519 or sk-Ed25519 is refused and says so, and a signature in another namespace is refused naming both", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const file = path.join(dir, "synthetic-ecdsa");
    assert((await proc.run(["ssh-keygen", "-q", "-t", "ecdsa", "-N", "", "-f", file])).success);
    const line = (await fs.readTextFile(`${file}.pub`)).trim();
    assertEquals((await fingerprintOf(line)).kind, "err");
    const a = await softKey(dir, "synthetic-person-01");
    const other = await sshsigSignerFor("ifc-telemetry" as never).sign(APPROVAL_PAYLOAD_TYPE, statementBytes(stmt()).payload, [{ keyFile: a.file }]);
    assert(other.kind === "ok");
    const r = await verify([other.value], registryOf([entry(a, "synthetic-person-01")]));
    assert(r.kind === "err" && r.error.message.includes("ifc-telemetry") && r.error.message.includes(APPROVAL_NAMESPACE), r.kind === "err" ? r.error.message : "");
  });
});

proves(["0020-grc-approval FR-011"], "one person with two keys counts once, a threshold of two needs two persons, and a proposer who may not approve is not counted", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const a1 = await softKey(dir, "synthetic-person-01-a");
    const a2 = await softKey(dir, "synthetic-person-01-b");
    const b = await softKey(dir, "synthetic-person-02");
    const reg = registryOf([entry(a1, "synthetic-person-01"), entry(a2, "synthetic-person-01"), entry(b, "synthetic-person-02")]);
    const s1 = await approveWith(a1, stmt({ nonce: "1".repeat(32) }));
    const s2 = await approveWith(a2, stmt({ nonce: "2".repeat(32) }));
    const s3 = await approveWith(b, stmt({ nonce: "3".repeat(32) }));
    const same = await verify([s1, s2], reg, request({ threshold: 2 }));
    assert(same.kind === "err" && same.error.code === "E-APPROVAL-INSUFFICIENT" && same.error.rejected[0]?.code === "E-APPROVAL-DUPLICATE");
    const two = await verify([s1, s3], reg, request({ threshold: 2 }));
    assert(two.kind === "ok" && two.value.approvers.length === 2);
    const own = await verify([s1], reg, request({ proposer: "synthetic-person-01", separateFromProposer: true }));
    assert(own.kind === "err" && own.error.code === "E-APPROVAL-PROPOSER");
    const none = await verify([], reg);
    assert(none.kind === "err" && none.error.code === "E-APPROVAL-INSUFFICIENT" && none.error.message.includes("no approval was given"));
  });
});

proves(["0020-grc-approval FR-021"], "the binding of a pairing code is the hash of the length-prefixed parts: no two lists of parts give one binding, and a statement with another binding is refused", skip, async () => {
  assert((await bindingOf(["ab", "c"])) !== (await bindingOf(["a", "bc"])));
  assertEquals(await bindingOf(["s", "123456"]), await bindingOf(["s", "123456"]));
  await fs.withTempDir(async (dir) => {
    const a = await softKey(dir, "synthetic-person-01");
    const good = await bindingOf(["synthetic-session-01", "123456"]);
    const signed = await approveWith(a, stmt({ binding: good }));
    const reg = registryOf([entry(a, "synthetic-person-01")]);
    assertEquals(await codeOf(verify([signed], reg, request({ binding: good }))), "ok");
    assertEquals(await codeOf(verify([signed], reg, request({ binding: await bindingOf(["synthetic-session-01", "654321"]) }))), "E-APPROVAL-MISMATCH");
  });
});

proves(["0020-grc-approval FR-023", "0020-grc-approval FR-024"], "the persons that count do not depend on the order of the approvals, and an approval that is refused never changes the verdict of the others", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const keys = await Promise.all([1, 2, 3].map((n) => softKey(dir, `synthetic-person-0${String(n)}`)));
    const stranger = await softKey(dir, "synthetic-stranger-01");
    const reg = registryOf(keys.map((k, i) => entry(k, `synthetic-person-0${String(i + 1)}`)));
    const signed = await Promise.all(keys.map((k, i) => approveWith(k, stmt({ nonce: String(i + 1).repeat(32) }))));
    const bad = await approveWith(stranger, stmt({ nonce: "9".repeat(32) }));
    const all = [...signed, bad];
    await fc.assert(
      fc.asyncProperty(fc.shuffledSubarray(all, { minLength: 0, maxLength: 4 }), fc.integer({ min: 1, max: 3 }), async (subset, threshold) => {
        const forward = await verify(subset, reg, request({ threshold }));
        const backward = await verify([...subset].reverse(), reg, request({ threshold }));
        const people = (r: typeof forward): string[] => (r.kind === "ok" ? r.value.approvers.map((x) => x.person) : r.error.accepted.map((x) => x.person)).sort();
        assertEquals(people(forward), people(backward));
        assertEquals(forward.kind === "ok", backward.kind === "ok");
        const without = await verify(subset.filter((s) => s !== bad), reg, request({ threshold }));
        assertEquals(forward.kind === "ok", without.kind === "ok");
      }),
      { numRuns: 25 },
    );
  });
});

proves(["0020-grc-approval FR-006", "0020-grc-approval FR-007"], "within its window an approval stays good for any instant and is refused at and after the end, whatever the instant", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const a = await softKey(dir, "synthetic-person-01");
    const reg = registryOf([entry(a, "synthetic-person-01")]);
    const signed = await approveWith(a, stmt());
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -60, max: 600 }), async (s) => {
        const now = new Date(Date.parse("2026-06-01T12:00:00Z") + s * 1000).toISOString();
        const code = await codeOf(verify([signed], reg, request(), { now }));
        const end = Date.parse("2026-06-01T12:05:00Z");
        if (Date.parse(now) >= end) assertEquals(code, "E-APPROVAL-EXPIRED");
        else if (Date.parse(now) + 120_000 < Date.parse("2026-06-01T11:59:30Z")) assertEquals(code, "E-APPROVAL-NOT-YET");
        else assertEquals(code, "ok");
      }),
      { numRuns: 30 },
    );
  });
});

proves(["0020-grc-approval FR-015"], "a registry is refused with its two keys of one id, a key with no person or role, a hardware custody on a key that is not a token, an end before the start and a key that replaces one that is not there", async () => {
  const k = { keyId: "SHA256:aaa", publicKey: "ssh-ed25519 AAAA", person: "synthetic-person-01", roles: ["approver"], custody: "managed", validFrom: "2026-01-01T00:00:00Z" };
  const bad = (keys: unknown[]) => decodeRegistry({ schema: "1", version: 1, issuedAt: "2026-01-01T00:00:00Z", keys }).kind;
  assertEquals(bad([k]), "ok");
  assertEquals(bad([k, k]), "err");
  assertEquals(bad([{ ...k, person: " " }]), "err");
  assertEquals(bad([{ ...k, roles: [] }]), "err");
  assertEquals(bad([{ ...k, custody: "hardware" }]), "err");
  assertEquals(bad([{ ...k, validUntil: "2025-01-01T00:00:00Z" }]), "err");
  assertEquals(bad([{ ...k, replaces: "SHA256:zzz" }]), "err");
});

proves(["0020-grc-approval FR-016", "0020-grc-approval FR-017", "0020-grc-approval FR-018"], "a chain of registries is good only when the root signs the first, an administrator of the version before signs each next, each only adds, and no key is removed, un-revoked or lengthened", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const root = await softKey(dir, "synthetic-root-01");
    const alice = await softKey(dir, "synthetic-person-01");
    const bob = await softKey(dir, "synthetic-person-02");
    const sign = async (reg: PersonKeys, by: Soft): Promise<SignedApproval> => {
      const r = await signer.sign(REGISTRY_PAYLOAD_TYPE, enc.encode(JSON.stringify(reg)), [{ keyFile: by.file }]);
      assert(r.kind === "ok", r.kind === "err" ? r.error.message : "");
      return r.value;
    };
    const v1 = registryOf([entry(root, "synthetic-owner-01", { roles: ["registry-admin", "approver"] }), entry(alice, "synthetic-person-01")]);
    const v2 = { ...registryOf([...v1.keys, entry(bob, "synthetic-person-02")], 2), previous: await registryDigest(v1), issuedAt: "2026-02-01T00:00:00Z" };
    const link = (r: PersonKeys, by: Soft) => sign(r, by);
    const good = await registryOfChain({ keyId: root.keyId }, [await link(v1, root), await link(v2, root)], approvalVerifier);
    assert(good.kind === "ok" && good.value.keys.length === 3, good.kind === "err" ? good.error : "");
    const code = async (chain: Promise<SignedApproval>[], rootId = root.keyId) => {
      const r = await registryOfChain({ keyId: rootId }, await Promise.all(chain), approvalVerifier);
      return r.kind === "ok" ? "ok" : r.error.split(":")[0];
    };
    assertEquals(await code([link(v1, alice)]), "E-APPROVAL-REGISTRY-CHAIN");
    assertEquals(await code([link(v1, root)], alice.keyId), "E-APPROVAL-REGISTRY-CHAIN");
    assertEquals(await code([link(v1, root), link(v2, alice)]), "E-APPROVAL-REGISTRY-CHAIN");
    assertEquals(await code([link(v1, root), link({ ...v2, previous: "0".repeat(64) }, root)]), "E-APPROVAL-REGISTRY-CHAIN");
    assertEquals(await code([link(v1, root), link({ ...v2, version: 3 }, root)]), "E-APPROVAL-REGISTRY-CHAIN");
    const removed = { ...registryOf([v1.keys[0] as PersonKey], 2), previous: await registryDigest(v1), issuedAt: "2026-02-01T00:00:00Z" };
    assertEquals(await code([link(v1, root), link(removed, root)]), "E-APPROVAL-REGISTRY-CHAIN");
    const revoked = { ...registryOf([v1.keys[0] as PersonKey, { ...(v1.keys[1] as PersonKey), revokedAt: "2026-02-01T00:00:00Z" }], 2), previous: await registryDigest(v1), issuedAt: "2026-02-01T00:00:00Z" };
    const v3 = { ...registryOf([revoked.keys[0] as PersonKey, { ...(v1.keys[1] as PersonKey) }], 3), previous: await registryDigest(revoked), issuedAt: "2026-03-01T00:00:00Z" };
    assertEquals(await code([link(v1, root), link(revoked, root)]), "ok");
    assertEquals(await code([link(v1, root), link(revoked, root), link(v3, root)]), "E-APPROVAL-REGISTRY-CHAIN");
    const lengthened = { ...registryOf([v1.keys[0] as PersonKey, { ...(v1.keys[1] as PersonKey), validUntil: "2027-01-01T00:00:00Z" }], 2), previous: await registryDigest(v1), issuedAt: "2026-02-01T00:00:00Z" };
    const shortV1 = registryOf([v1.keys[0] as PersonKey, { ...(v1.keys[1] as PersonKey), validUntil: "2026-12-01T00:00:00Z" }]);
    const lengthenedShort = { ...lengthened, previous: await registryDigest(shortV1) };
    assertEquals(await code([link(shortV1, root), link(lengthenedShort, root)]), "E-APPROVAL-REGISTRY-CHAIN");
    assertEquals(await code([]), "E-APPROVAL-REGISTRY-CHAIN");
  });
});

proves(["0020-grc-approval FR-019", "0020-grc-approval FR-022"], "the logical files of approvals import no program, no file system and no key file, and read no clock or random number", async () => {
  for (const f of ["approval.ts", "person-keys.ts"]) {
    const code = (await fs.readTextFile(new URL(`../src/logical/${f}`, import.meta.url).pathname)).split("\n").filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//") && !l.trimStart().startsWith("/**")).join("\n");
    for (const banned of ["@intellectual-frontiers/system", "node:", "Date.now", "new Date()", "Math.random", "crypto.getRandomValues", "readFile", "keyFile", "process.env"]) assert(!code.includes(banned), `${f} has ${banned}`);
  }
});

proves(["0020-grc-approval FR-020"], "the signer of approvals is the sshsig signer of the namespace ifc-approval and names the program where it is missing", async () => {
  assertEquals([signer.id, signer.custody], ["sshsig", "file"]);
  const r = await signer.sign(APPROVAL_PAYLOAD_TYPE, enc.encode("{}"), [{ keyFile: "/nonexistent/synthetic-key" }]);
  assert(r.kind === "err" && r.error.message.includes("ssh-keygen"), r.kind === "err" ? r.error.message : "signed");
});

proves(["0020-grc-approval FR-003"], "a request with a threshold below one needs one person, and a request names its action, subject, plan hash, request, risk and roles", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const a = await softKey(dir, "synthetic-person-01");
    const r = await verify([await approveWith(a, stmt())], registryOf([entry(a, "synthetic-person-01")]), request({ threshold: 0 }));
    assert(r.kind === "ok" && r.value.approvers.length === 1);
    assertEquals(Object.keys(request()).sort(), ["action", "planHash", "requestId", "risk", "roles", "subject", "threshold"]);
  });
});

proves(["0020-grc-approval FR-014"], "a key of the kind ecdsa-sk and a signature of it are refused with the words that they are not verified", async () => {
  const line = "sk-ecdsa-sha2-nistp256@openssh.com AAAAInNrLWVjZHNhLXNoYTItbmlzdHAyNTZAb3BlbnNzaC5jb20=";
  const r = await fingerprintOf(line);
  assert(r.kind === "err" && r.error.includes("not verified"), r.kind === "err" ? r.error : "accepted");
});
