/**
 * Tests of the pure model: the decision of an authentication, source networks, limits, tokens and pairing codes, the hash chain, the enrollment policy and the resolution of identity.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { createHash } from "node:crypto";
import { GENESIS, SERVER_POLICY_DEFAULTS } from "../src/governance/mod.ts";
import type { AuditEvent, Fingerprint, KnownAsset } from "../src/governance/mod.ts";
import {
  CLEAN, TOKEN, authDecision, blocked, chainNext, checkPairing, checkToken, classify, classifyClient, constantTimeEqual, decideEnrollment, factsDrift, forgive, fullBucket, inAnyCidr, pairingCode,
  parseCidr, parseIp, resolveFacts, sourceAllowed, strike, take, verifyChain, WORDS,
} from "../src/logical/mod.ts";
import { seeded } from "./governance.test.ts";
import { syntheticFacts } from "./helpers.ts";

const sha = (t: string): string => createHash("sha256").update(t).digest("hex");
const fp = `SHA256:${"B".repeat(43)}` as Fingerprint;
const POLICY = { accounts: SERVER_POLICY_DEFAULTS.accounts, anonymous: SERVER_POLICY_DEFAULTS.anonymous, maxAuthTries: 3 } as const;

proves(["0003-server-policy FR-001", "0003-server-policy FR-002", "0003-server-policy FR-003"], "authDecision: accounts, an unsigned key is a query and never proof, a bad signature is refused, anonymous by policy", () => {
  const d = (over: Parameters<typeof authDecision>[1], failures = 0, policy: Parameters<typeof authDecision>[0] = POLICY) => authDecision(policy, over, { failures });
  assertEquals(d({ username: "root", method: "none" }).kind, "reject");
  assertEquals(d({ username: "s-operator", method: "none" }).kind, "reject");
  assertEquals(d({ username: "s-enroll", method: "none" }).kind, "reject", "none is refused under keyboard-interactive");
  assertEquals(d({ username: "s-enroll", method: "none" }, 0, { ...POLICY, anonymous: "none" }).kind, "accept");
  assertEquals(d({ username: "s-enroll", method: "keyboard-interactive" }).kind, "prompt");
  assertEquals(d({ username: "s-enroll", method: "keyboard-interactive" }, 0, { ...POLICY, anonymous: "refuse" }).kind, "reject");
  for (const m of ["password", "hostbased"] as const) assertEquals(d({ username: "s-enroll", method: m }).kind, "reject", m);
  const query = d({ username: "s-enroll", method: "publickey", key: { fingerprint: fp, signed: false, verified: false } });
  assertEquals(query.kind, "accept-query");
  assert(query.kind !== "accept", "an unsigned key is never accepted as proof");
  const forged = d({ username: "s-enroll", method: "publickey", key: { fingerprint: fp, signed: true, verified: false } });
  assertEquals(forged.kind, "reject");
  const proven = d({ username: "s-enroll", method: "publickey", key: { fingerprint: fp, signed: true, verified: true } });
  assert(proven.kind === "accept" && proven.proven === fp);
  assertEquals(d({ username: "s-device", method: "none" }).kind, "reject");
  assertEquals(d({ username: "s-device", method: "keyboard-interactive" }).kind, "reject");
  assertEquals(d({ username: "s-device", method: "publickey", key: { fingerprint: fp, signed: true, verified: true } }).kind, "reject", "an unknown key");
  assertEquals(d({ username: "s-device", method: "publickey", key: { fingerprint: fp, signed: true, verified: true, known: true } }).kind, "accept");
  assertEquals(d({ username: "s-enroll", method: "none" }, 3).kind, "reject");
  const last = d({ username: "s-enroll", method: "none" }, 3);
  assert(last.kind === "reject" && last.disconnect);
});

proves(["0003-server-policy FR-005"], "the source network: private, loopback, link-local and ULA are allowed, public is refused unless listed, and IPv4-mapped IPv6 is read as IPv4", () => {
  for (const [ip, c] of [["127.0.0.1", "loopback"], ["10.1.2.3", "private"], ["172.16.0.1", "private"], ["172.31.255.255", "private"], ["192.168.1.1", "private"], ["169.254.1.1", "link-local"], ["::1", "loopback"], ["fe80::1", "link-local"], ["fd12:3456::1", "ula"], ["fc00::1", "ula"], ["::ffff:10.0.0.1", "private"], ["::ffff:8.8.8.8", "public"], ["8.8.8.8", "public"], ["172.32.0.1", "public"], ["172.15.0.1", "public"], ["100.64.0.1", "public"], ["2001:db8::1", "public"], ["not an address", "public"], ["", "public"], ["256.1.1.1", "public"], ["01.1.1.1", "public"]] as const) assertEquals(classify(ip), c, ip);
  assert(sourceAllowed({ allowCidrs: [] }, "192.168.5.5"));
  assert(!sourceAllowed({ allowCidrs: [] }, "203.0.113.5"));
  assert(sourceAllowed({ allowCidrs: ["203.0.113.0/24"] }, "203.0.113.5"));
  assert(!sourceAllowed({ allowCidrs: ["203.0.113.0/24"] }, "203.0.114.5"));
  assert(sourceAllowed({ allowCidrs: ["2001:db8::/32"] }, "2001:db8:1::1"));
  assert(inAnyCidr("203.0.113.9", ["203.0.113.9"]));
  assertEquals(parseCidr("10.0.0.0/33").kind, "err");
  assertEquals(parseCidr("10.0.0.0/8/1").kind, "err");
  assertEquals(parseCidr("zzz/8").kind, "err");
  assertEquals(parseIp("::ffff:1.2.3.4")?.v, 4);
});

proves(["0003-server-policy FR-006"], "the token bucket over an injected clock and the doubling penalty that ends by itself", () => {
  const cfg = { capacity: 3, refillPerSecond: 1 };
  let b = fullBucket(cfg, 0);
  const got: boolean[] = [];
  for (let i = 0; i < 5; i++) {
    const t = take(b, cfg, 0);
    b = t.bucket;
    got.push(t.allowed);
  }
  assertEquals(got, [true, true, true, false, false]);
  const later = take(b, cfg, 1500);
  assert(later.allowed, "a token came back");
  assert(take(fullBucket(cfg, 100), cfg, 0).allowed, "a clock that goes back is no time passing");
  const refused = take({ tokens: 0, at: 0 }, cfg, 0);
  assertEquals(refused.retryAfterMs, 1000);
  const pc = { baseMs: 100, maxMs: 700 };
  let p = CLEAN;
  const ends: number[] = [];
  for (let i = 0; i < 5; i++) {
    p = strike(p, pc, 1000);
    ends.push(p.blockedUntil - 1000);
  }
  assertEquals(ends, [100, 200, 400, 700, 700]);
  assert(blocked(p, 1500) && !blocked(p, 1700));
  assertEquals(forgive(p, 1700 + 10, 100), p);
  assertEquals(forgive(p, 1700 + 100, 100), CLEAN);
});

proves(["0003-server-policy FR-007", "0003-server-policy FR-016", "0002-enrollment-protocol FR-009"], "tokens and pairing codes: constant-time compare, single use, expiry, shape, and a generator that needs a source of randomness", () => {
  assert(constantTimeEqual("abc", "abc"));
  assert(!constantTimeEqual("abc", "abd"));
  assert(!constantTimeEqual("abc", "abcd"));
  assert(!constantTimeEqual("", "a"));
  const secret = "tok-abcdefgh-abcdefghijklmnopqrstuvwx";
  assert(TOKEN.test(secret));
  const rec = { id: "abcdefgh", secretHash: sha(secret), labels: [], expiresAt: 100, used: false };
  assertEquals(checkToken(rec, secret, 50, sha).kind, "ok");
  assertEquals(checkToken({ ...rec, used: true }, secret, 50, sha), { kind: "err", error: "used" });
  assertEquals(checkToken(rec, secret, 100, sha), { kind: "err", error: "expired" });
  assertEquals(checkToken(rec, "tok-abcdefgh-zzzzzzzzzzzzzzzzzzzzzzzz", 50, sha), { kind: "err", error: "unknown" });
  assertEquals(checkToken(rec, "nope", 50, sha), { kind: "err", error: "malformed" });
  assertEquals(checkToken(undefined, secret, 50, sha), { kind: "err", error: "unknown" });
  const rnd = seeded(5);
  const codes = new Set(Array.from({ length: 200 }, () => pairingCode(rnd)));
  assert(codes.size > 150);
  for (const c of codes) assert(/^[a-z]+-[a-z]+-[0-9]{4}$/.test(c), c);
  assert(WORDS.length >= 64 && new Set(WORDS).size === WORDS.length);
  const pr = { code: "maple-river-4821", labels: [], expiresAt: 100, used: false };
  assertEquals(checkPairing(pr, "maple-river-4821", 1).kind, "ok");
  assertEquals(checkPairing({ ...pr, used: true }, "maple-river-4821", 1).kind, "err");
  assertEquals(checkPairing(pr, "maple-river-4822", 1).kind, "err");
  assertEquals(checkPairing(pr, "x", 1).kind, "err");
});

proves(["0003-server-policy FR-014"], "the hash chain finds a change, a removal and a reordering", () => {
  const ev = (n: number): AuditEvent => ({ at: n, kind: "command", sourceIp: "10.0.0.1", outcome: "ok", detail: `event ${n}` });
  let last: { seq: number; hash: string } | undefined;
  const log = [];
  for (let i = 0; i < 6; i++) {
    const c = chainNext(last, ev(i), sha);
    last = c;
    log.push(c);
  }
  assertEquals(log[0]?.prev, GENESIS);
  assertEquals(verifyChain(log, sha), { kind: "ok", value: 6 });
  assertEquals(verifyChain([], sha), { kind: "ok", value: 0 });
  assertEquals(verifyChain(log.map((e, i) => (i === 3 ? { ...e, detail: "changed" } : e)), sha).kind, "err");
  assertEquals(verifyChain(log.filter((_, i) => i !== 2), sha).kind, "err");
  assertEquals(verifyChain([log[1], log[0], ...log.slice(2)] as typeof log, sha).kind, "err");
  assertEquals(verifyChain(log.slice(1), sha).kind, "err", "a log must begin at its first event");
  const forged = log.map((e, i) => (i === 3 ? { ...e, detail: "changed", hash: sha("x") } : e));
  assertEquals(verifyChain(forged, sha).kind, "err");
});

proves(["0005-enrollment-policy FR-001", "0005-enrollment-policy FR-002", "0005-enrollment-policy FR-003", "0005-enrollment-policy FR-004", "0005-enrollment-policy FR-005"], "the enrollment policy: the first rule that matches decides with an explanation; identity is adopted, never duplicated; a conflict waits for a person", () => {
  const facts = syntheticFacts(1);
  const bound = (tenant: string, kind: "token" | "pairing" = "token") => ({ binding: { kind, id: "abc", tenant, labels: ["lab"] }, sourceIp: "10.0.0.5" });
  const p = (rules: Parameters<typeof decideEnrollment>[0]["rules"]) => ({ rules });
  assertEquals(decideEnrollment(p([]), bound("t1"), facts, []).outcome, "pending");
  const tok = decideEnrollment(p([{ kind: "token", tenant: "t1" }]), bound("t1"), facts, []);
  assertEquals(tok.outcome, "approve");
  assert(tok.explanation.includes("token") && tok.rule === 0, tok.explanation);
  assertEquals(decideEnrollment(p([{ kind: "token", tenant: "t2" }]), bound("t1"), facts, []).outcome, "pending");
  assertEquals(decideEnrollment(p([{ kind: "token", labels: ["other"] }]), bound("t1"), facts, []).outcome, "pending");
  assertEquals(decideEnrollment(p([{ kind: "pairing-code" }]), bound("t1", "pairing"), facts, []).outcome, "approve");
  assertEquals(decideEnrollment(p([{ kind: "pairing-code" }]), bound("t1"), facts, []).outcome, "pending");
  for (const entry of [{ serial: "synthetic-serial-01" }, { machineId: "00000000000000000000000000000001" }, { mac: "02:00:00:00:00:01" }, { hostKey: `SHA256:${"A".repeat(43)}` }]) assertEquals(decideEnrollment(p([{ kind: "inventory", allow: [entry] }]), { sourceIp: "10.0.0.5" }, facts, []).outcome, "approve", JSON.stringify(entry));
  assertEquals(decideEnrollment(p([{ kind: "inventory", allow: [{ serial: "other" }] }]), { sourceIp: "10.0.0.5" }, facts, []).outcome, "pending");
  assertEquals(decideEnrollment(p([{ kind: "source-network", cidrs: ["10.0.0.0/24"] }]), { sourceIp: "10.0.0.5" }, facts, []).outcome, "approve");
  assertEquals(decideEnrollment(p([{ kind: "cloud-attestation", provider: "aws" }]), { sourceIp: "10.0.0.5" }, facts, []).outcome, "pending", "reserved, never matches");
  const refuse = decideEnrollment(p([{ kind: "refuse-network", cidrs: ["10.0.0.0/8"] }, { kind: "source-network", cidrs: ["10.0.0.0/8"] }]), { sourceIp: "10.0.0.5" }, facts, []);
  assertEquals(refuse.outcome, "refuse");
  const a: KnownAsset = { id: "asset-a", machineId: "00000000000000000000000000000001", macs: [], hostKeys: [], keys: [] };
  const b: KnownAsset = { id: "asset-b", macs: ["02:00:00:00:00:01"], hostKeys: [], keys: [] };
  assertEquals(resolveFacts(facts, []), { kind: "new" });
  assertEquals(resolveFacts(facts, [a]), { kind: "adopt", assetId: "asset-a", matchedOn: ["machine-id"] });
  assertEquals(resolveFacts(facts, [b]).kind, "adopt");
  assertEquals(resolveFacts(facts, [a, b]), { kind: "conflict", assetIds: ["asset-a", "asset-b"] });
  const adopted = decideEnrollment(p([{ kind: "token" }]), bound("t1"), facts, [a]);
  assertEquals(adopted.assetId, "asset-a");
  assert(adopted.explanation.includes("adopted"), adopted.explanation);
  const conflict = decideEnrollment(p([{ kind: "token" }]), bound("t1"), facts, [a, b]);
  assertEquals(conflict.outcome, "pending", "a conflict is never approved by a rule");
  const drift = factsDrift(facts, { ...facts, kernel: "x", nics: [] });
  assertEquals([...drift].sort(), ["kernel", "nics"]);
  assertEquals(factsDrift(facts, facts), []);
});

proves(["0002-enrollment-protocol FR-010"], "the class of a device is guessed from the banner of its client", () => {
  for (const [banner, c] of [["SSH-2.0-OpenSSH_9.6p1 Ubuntu", "openssh"], ["SSH-2.0-dropbear_2022.83", "dropbear"], ["SSH-2.0-libssh_0.10.5", "libssh"], ["SSH-2.0-libssh2_1.11", "libssh"], ["SSH-2.0-Cisco-1.25", "cisco"], ["SSH-2.0-ROSSSH", "routeros"], ["SSH-2.0-PuTTY_Release_0.80", "putty"], ["SSH-2.0-UBNT", "unifi"], ["SSH-2.0-EdgeOS", "edgeos"], ["SSH-2.0-JUNOS", "junos"], ["SSH-2.0-weird", "other"], ["", "other"]] as const) assertEquals(classifyClient(banner), c, banner);
});
