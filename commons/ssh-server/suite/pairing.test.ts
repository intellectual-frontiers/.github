/**
 * Tests of the pairing handshake: commit-then-reveal, the short authentication string, a man in the middle, tampering, replay, reuse of a nonce, three wrong codes, expiry on an injected clock, and both alphabets of codes.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { createHash } from "node:crypto";
import { LETTERS } from "@intellectual-frontiers/ssh-server/governance";
import type { EnrollmentSession, Fingerprint, PairingConfig, SessionId } from "@intellectual-frontiers/ssh-server/governance";
import { BURNED, checkPairingConfig, codeOf, commit, confirmPairing, deviceMaterial, normaliseCode, pairCommit, pairReveal, sasOf, tofuPairing } from "@intellectual-frontiers/ssh-server/logical";
import type { CryptoPort, PairOutcome } from "@intellectual-frontiers/ssh-server/logical";
import { seeded } from "./governance.test.ts";

const sha = (t: string): string => createHash("sha256").update(t).digest("hex");
const fpOf = (line: string): Fingerprint => `SHA256:${createHash("sha256").update(line).digest("base64").replace(/=+$/, "")}` as Fingerprint;
function port(seed: number): CryptoPort {
  const rnd = seeded(seed);
  return { sha256Hex: sha, randomHex: (n) => Array.from({ length: n }, () => Math.floor(rnd() * 256).toString(16).padStart(2, "0")).join(""), fingerprintOfLine: fpOf };
}
const DIGITS: PairingConfig = { kind: "digits", length: 6 };
const CONTROLLER = "ssh-ed25519 AAAAcontrollerkeyreal";
const ATTACKER = "ssh-ed25519 AAAAattackerkey";
const DEVICE = "ssh-ed25519 AAAAdevicekey";
const ATTACKER_DEVICE = "ssh-ed25519 AAAAattackerdevicekey";
const session = (): EnrollmentSession => ({ id: "en-aaaaaaaaaaaaaaaa" as SessionId, state: "interrogated", sourceIp: "10.0.0.2", clientIdent: "SSH-2.0-OpenSSH_9.6", deviceClass: "openssh", offeredKeys: [], createdAt: 0, updatedAt: 0, expiresAt: 10 ** 9 });
const ok = (o: unknown): PairOutcome => {
  const r = o as { kind: string; value: PairOutcome };
  assertEquals(r.kind, "ok");
  return r.value;
};

/** The device side of the handshake, as the script does it: what it commits to, then what it reveals and what it computes. */
function device(p: CryptoPort, pub: string, observed: string, nd: string) {
  return { cd: commit(p, nd, deviceMaterial(pub, observed)), reveal: { nonce: nd, devicePub: pub, hostKey: observed } };
}

proves(["0002-enrollment-protocol FR-018"], "an honest handshake gives the device and the controller the same code, and a person typing it approves the session", () => {
  const p = port(1);
  const nd = p.randomHex(16);
  const d = device(p, DEVICE, CONTROLLER, nd);
  const c = ok(pairCommit(session(), d.cd, fpOf(DEVICE), p, CONTROLLER, 1000, 300_000));
  assert(c.kind === "ok");
  const cc = c.out["cc"] as string;
  const r = ok(pairReveal(c.session, d.reveal, fpOf(DEVICE), true, p, DIGITS, 2000));
  assert(r.kind === "ok");
  assertEquals(commit(p, r.out["nc"] as string, r.out["controllerHostKey"] as string), cc, "the device can verify the controller's commitment");
  const deviceCode = codeOf(sha(`ifc-enroll-sas-v1\n${CONTROLLER}\n${DEVICE}\n${r.out["nc"]}\n${nd}`), DIGITS);
  assertEquals(r.session.pairing?.sas, deviceCode);
  assert(/^[0-9]{6}$/.test(deviceCode));
  const wrong = confirmPairing(r.session, "000000" === deviceCode ? "111111" : "000000", "synthetic-person-01", { steps: [] }, DIGITS, 3, 3000);
  assertEquals((wrong as { value: { kind: string } }).value.kind, "wrong");
  const right = confirmPairing(r.session, deviceCode, "synthetic-person-01", { steps: [] }, DIGITS, 3, 3000);
  assert(right.kind === "ok" && right.value.kind === "approved");
  assertEquals(right.value.session.state, "approved");
  assertEquals(right.value.session.pairing?.confirmed, true);
});

proves(["0002-enrollment-protocol FR-019"], "a man in the middle that terminates both legs with its own key makes the two codes differ, and the controller burns the pairing", () => {
  const p = port(2);
  // the device talks to the attacker: it observes the attacker's host key; the attacker talks to the controller with a key of its own
  const nd = p.randomHex(16);
  const dev = device(p, DEVICE, ATTACKER, nd);
  // variant 1: the attacker relays the device's commitment and reveal unchanged: the controller sees a reveal that names a host key that is not its own
  const c1 = ok(pairCommit(session(), dev.cd, fpOf(DEVICE), p, CONTROLLER, 0, 300_000));
  const relayed = pairReveal(c1.session, dev.reveal, fpOf(DEVICE), true, p, DIGITS, 10);
  const burned1 = ok(relayed);
  assertEquals(burned1.kind, "burned");
  assert(burned1.kind === "burned" && burned1.detail.includes(BURNED) && burned1.detail.includes("possible interception"), "flagged as a possible interception");
  assertEquals(burned1.session.state, "refused");
  // variant 2: the attacker makes its own commitment toward the controller, as if it were the device, with the host key the controller really has
  const nr = p.randomHex(16);
  const own = device(p, ATTACKER_DEVICE, CONTROLLER, nr);
  const c2 = ok(pairCommit(session(), own.cd, fpOf(ATTACKER_DEVICE), p, CONTROLLER, 0, 300_000));
  const r2 = ok(pairReveal(c2.session, own.reveal, fpOf(ATTACKER_DEVICE), true, p, DIGITS, 10));
  assert(r2.kind === "ok");
  const controllerCode = r2.session.pairing?.sas as string;
  // the device, for its part, gets the attacker's nonce and commitment: it derives its code from what IT saw
  const ncAttacker = p.randomHex(16);
  const deviceCode = sasOf(p, DIGITS, { controllerHostKey: ATTACKER, devicePub: DEVICE, nc: ncAttacker, nd });
  assert(deviceCode !== controllerCode, `the codes differ: ${deviceCode} ${controllerCode}`);
  // a person who types the code the device shows is refused, and three tries burn it
  let s = r2.session;
  for (let i = 1; i <= 3; i++) {
    const t = confirmPairing(s, deviceCode, "synthetic-person-01", { steps: [] }, DIGITS, 3, 100 + i);
    assert(t.kind === "ok");
    s = t.value.session;
    assertEquals(t.value.kind, i < 3 ? "wrong" : "burned");
  }
  assertEquals(s.state, "refused");
  assert((s.decision?.explanation ?? "").includes(BURNED));
});

proves(["0002-enrollment-protocol FR-018", "0002-enrollment-protocol FR-019"], "tampering with a commitment, a reveal, a key or a nonce burns the pairing; a replay and a reused nonce are refused", () => {
  const p = port(3);
  const nd = p.randomHex(16);
  const d = device(p, DEVICE, CONTROLLER, nd);
  const start = ok(pairCommit(session(), d.cd, fpOf(DEVICE), p, CONTROLLER, 0, 1000));
  assert(start.kind === "ok");
  const tamper = (reveal: Partial<typeof d.reveal>, key = fpOf(DEVICE), fresh = true) => ok(pairReveal(start.session, { ...d.reveal, ...reveal }, key, fresh, p, DIGITS, 10));
  assertEquals(tamper({ nonce: p.randomHex(16) }).kind, "burned", "another nonce does not match the commitment");
  assertEquals(tamper({ devicePub: "ssh-ed25519 AAAAother" }).kind, "burned", "another device key does not match");
  assertEquals(tamper({ hostKey: ATTACKER }).kind, "burned", "another host key does not match");
  assertEquals(tamper({}, fpOf("ssh-ed25519 AAAAsomeoneelse")).kind, "burned", "the key that proved itself is not the key of the reveal");
  assertEquals(tamper({}, fpOf(DEVICE), false).kind, "burned", "a nonce used before");
  assertEquals(pairReveal(start.session, { ...d.reveal, nonce: "short" }, fpOf(DEVICE), true, p, DIGITS, 10).kind, "err");
  assertEquals(pairReveal(session(), d.reveal, fpOf(DEVICE), true, p, DIGITS, 10).kind, "err", "a reveal with no commitment");
  assertEquals(pairCommit(start.session, d.cd, fpOf(DEVICE), p, CONTROLLER, 5, 1000).kind, "err", "a replayed commitment");
  assertEquals(pairCommit(session(), "xyz", fpOf(DEVICE), p, CONTROLLER, 5, 1000).kind, "err", "a malformed commitment");
  const done = ok(pairReveal(start.session, d.reveal, fpOf(DEVICE), true, p, DIGITS, 10));
  assert(done.kind === "ok");
  assertEquals(pairReveal(done.session, d.reveal, fpOf(DEVICE), true, p, DIGITS, 11).kind, "err", "a replayed reveal");
  // the commitment hides: the same material with another nonce gives another commitment, and a domain tag keeps a commitment from being a code
  assert(commit(p, "a".repeat(32), "m") !== commit(p, "b".repeat(32), "m"));
  assert(commit(p, "a".repeat(32), "m") !== sha(`${"a".repeat(32)}\nm`));
});

proves(["0002-enrollment-protocol FR-019"], "three wrong codes burn the session, a burned session confirms nothing, and a pairing past its time burns on an injected clock", () => {
  const p = port(4);
  const nd = p.randomHex(16);
  const d = device(p, DEVICE, CONTROLLER, nd);
  const c = ok(pairCommit(session(), d.cd, fpOf(DEVICE), p, CONTROLLER, 0, 1000));
  assert(c.kind === "ok");
  const r = ok(pairReveal(c.session, d.reveal, fpOf(DEVICE), true, p, DIGITS, 10));
  assert(r.kind === "ok");
  const right = r.session.pairing?.sas as string;
  const bad = right === "123456" ? "654321" : "123456";
  let s = r.session;
  const kinds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const t = confirmPairing(s, bad, "synthetic-person-01", { steps: [] }, DIGITS, 3, 20 + i);
    assert(t.kind === "ok");
    kinds.push(t.value.kind);
    s = t.value.session;
  }
  assertEquals(kinds, ["wrong", "wrong", "burned"]);
  assertEquals(confirmPairing(s, right, "synthetic-person-01", { steps: [] }, DIGITS, 3, 30).kind, "err", "even the right code, after the burn");
  assert(s.pairing?.burned === "too many wrong codes");
  const late = confirmPairing(r.session, right, "synthetic-person-01", { steps: [] }, DIGITS, 3, 1000);
  assert(late.kind === "ok" && late.value.kind === "burned", "the right code after its time");
  const onTime = confirmPairing(r.session, right, "synthetic-person-01", { steps: [] }, DIGITS, 3, 999);
  assert(onTime.kind === "ok" && onTime.value.kind === "approved", "one tick before its time");
  assertEquals(confirmPairing(r.session, right, " ", { steps: [] }, DIGITS, 3, 999).kind, "err", "a person is named");
  assertEquals(confirmPairing(session(), right, "synthetic-person-01", { steps: [] }, DIGITS, 3, 5).kind, "err", "no code to confirm");
  const reveal = ok(pairReveal(c.session, d.reveal, fpOf(DEVICE), true, p, DIGITS, 1000));
  assertEquals(reveal.kind, "burned", "a reveal after its time");
});

proves(["0002-enrollment-protocol FR-020"], "both alphabets of codes: digits keep their zeros, letters have no look-alikes, a typed code is normalised, and a configuration is checked", () => {
  assertEquals(codeOf("00000001ffff", { kind: "digits", length: 6 }), "000001");
  assertEquals(codeOf("ffffffffffff", { kind: "digits", length: 4 }).length, 4);
  for (const ch of "ILO01") assert(!LETTERS.includes(ch), ch);
  const rnd = seeded(9);
  for (let i = 0; i < 500; i++) {
    const h = Array.from({ length: 8 }, () => Math.floor(rnd() * 16).toString(16)).join("");
    const l = codeOf(h, { kind: "letters", length: 4 });
    assert(/^[A-HJKM-NP-Z]{4}$/.test(l), l);
    const dd = codeOf(h, { kind: "digits", length: 9 });
    assert(/^[0-9]{9}$/.test(dd), dd);
  }
  assertEquals(normaliseCode(" 123-456 ", DIGITS), "123456");
  assertEquals(normaliseCode("ab-cd", { kind: "letters", length: 4 }), "ABCD");
  for (const bad of [{ kind: "digits", length: 3 }, { kind: "digits", length: 10 }, { kind: "letters", length: 2 }, { kind: "letters", length: 7 }, { kind: "digits", length: 6.5 }] as const) assertEquals(checkPairingConfig(bad).kind, "err", JSON.stringify(bad));
  assertEquals(checkPairingConfig({ kind: "letters", length: 4 }).kind, "ok");
  // a letters pairing is confirmed by a lowercase, spaced code
  const p = port(5);
  const nd = p.randomHex(16);
  const cfg: PairingConfig = { kind: "letters", length: 4 };
  const d = device(p, DEVICE, CONTROLLER, nd);
  const c = ok(pairCommit(session(), d.cd, fpOf(DEVICE), p, CONTROLLER, 0, 1000));
  assert(c.kind === "ok");
  const r = ok(pairReveal(c.session, d.reveal, fpOf(DEVICE), true, p, cfg, 10));
  assert(r.kind === "ok");
  const sas = r.session.pairing?.sas as string;
  const typed = sas.toLowerCase().split("").join(" ");
  const t = confirmPairing(r.session, typed, "synthetic-person-01", { steps: [] }, cfg, 3, 20);
  assert(t.kind === "ok" && t.value.kind === "approved");
});

proves(["0002-enrollment-protocol FR-021"], "a bare knock is trust on first use: the controller makes the code, flagged as such, and a person confirms it", () => {
  const p = port(6);
  const s = tofuPairing(session(), p, DIGITS, CONTROLLER, 0, 1000);
  assertEquals(s.pairing?.tofu, true);
  assert(/^[0-9]{6}$/.test(s.pairing?.sas ?? ""));
  const t = confirmPairing(s, s.pairing?.sas as string, "synthetic-person-01", { steps: [] }, DIGITS, 3, 5);
  assert(t.kind === "ok" && t.value.kind === "approved");
});
