/**
 * Tests of `runtime/sign.ts`: Web Crypto signers and verifiers round-trip over random messages and refuse a changed one; their DSSE
 * envelopes verify with `kernel/dsse.ts` and the other way round; they sign and check evidence bundles through `kernel/evidence.ts`'s
 * shapes; a key that cannot sign, a missing program and a missing allowed signers file are errors, not throws. Where `ssh-keygen` is
 * installed, a throwaway Ed25519 key signs with `ssh-keygen -Y sign` and verifies with `-Y verify`, bound to its namespace and identity.
 *
 * @module
 */
import fc from "fast-check";
import { type DsseKey, signEnvelope, verifyEnvelope } from "@intellectual-frontiers/crypto/dsse";
import { readBundle, writeBundle } from "../../kernel/evidence.ts";
import { readTextFile, withTempDir, writeTextFile } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { run, which } from "@intellectual-frontiers/system/proc";
import {
  formatSignError,
  signEnvelopeWith,
  sshSigner,
  sshVerifier,
  toSign,
  toVerifySignature,
  verifyEnvelopeWith,
  webCryptoSigner,
  webCryptoVerifier,
} from "../../runtime/sign.ts";
import { assert, assertEquals, assertRejects, proves } from "@intellectual-frontiers/test";

const FR = "0007-grc FR-020";
const enc = new TextEncoder();

async function pair(params: AlgorithmIdentifier | EcKeyGenParams): Promise<CryptoKeyPair> {
  const k = await crypto.subtle.generateKey(params, false, ["sign", "verify"]);
  assert("privateKey" in k, "a key pair");
  return k;
}

proves([FR], "Web Crypto signers and verifiers (Ed25519, ECDSA P-256) round-trip and refuse a changed message", async () => {
  for (const params of [{ name: "Ed25519" }, { name: "ECDSA", namedCurve: "P-256" }]) {
    const keys = await pair(params);
    const signer = webCryptoSigner(keys.privateKey, "ci");
    const verifier = webCryptoVerifier(keys.publicKey, "ci");
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 1, maxLength: 200 }), async (message) => {
        const s = await signer.sign(message);
        assert(s.kind === "ok");
        assertEquals(s.value.keyid, "ci");
        assertEquals(await verifier.verify(message, s.value.sig), { kind: "ok", value: true });
        const changed = Uint8Array.from(message);
        changed[0] = (changed[0] ?? 0) ^ 1;
        assertEquals(await verifier.verify(changed, s.value.sig), { kind: "ok", value: false });
      }),
      { numRuns: 20 },
    );
    assertEquals(await verifier.verify(enc.encode("x"), Uint8Array.of(1, 2, 3)), { kind: "ok", value: false });
  }
});

proves(
  [FR],
  "DSSE envelopes made here verify with kernel/dsse.ts, and the kernel's verify here; a threshold and key ids hold",
  async () => {
    const a = await pair({ name: "ECDSA", namedCurve: "P-256" });
    const b = await pair({ name: "Ed25519" });
    const payload = enc.encode('{"hello":"world"}');
    const type = "application/vnd.example+json";
    const mine = await signEnvelopeWith(type, payload, [webCryptoSigner(a.privateKey, "a"), webCryptoSigner(b.privateKey, "b")]);
    assert(mine.kind === "ok");
    const kernelKeys: DsseKey[] = [
      { key: a.publicKey, keyid: "a" },
      { key: b.publicKey, keyid: "b" },
    ];
    const k = await verifyEnvelope(mine.value, type, kernelKeys, 2);
    assert(k.kind === "ok", JSON.stringify(k));
    const theirs = await signEnvelope(type, payload, [{ key: a.privateKey, keyid: "a" }]);
    assert(theirs.kind === "ok");
    const v = await verifyEnvelopeWith(theirs.value, type, [webCryptoVerifier(a.publicKey, "a")]);
    assert(v.kind === "ok");
    assertEquals(v.value.payload, payload);
    assertEquals(v.value.verifiers, [0]);
    // a verifier of another key id is not tried; a wrong payload type and too few signatures are refused
    const other = await verifyEnvelopeWith(theirs.value, type, [webCryptoVerifier(a.publicKey, "z")]);
    assertEquals(other.kind === "err" ? other.error.kind : "ok", "no-valid-signature");
    const wrongType = await verifyEnvelopeWith(theirs.value, "text/plain", [webCryptoVerifier(a.publicKey)]);
    assertEquals(wrongType.kind === "err" ? wrongType.error.kind : "ok", "payload-type");
    const few = await verifyEnvelopeWith(mine.value, type, [webCryptoVerifier(a.publicKey), webCryptoVerifier(a.publicKey)], 3);
    assertEquals(few.kind === "err" ? few.error.kind : "ok", "no-valid-signature");
  },
);

proves([FR], "a signer and verifier sign and check an evidence bundle through kernel/evidence.ts's Sign and VerifySignature", async () => {
  const keys = await pair({ name: "Ed25519" });
  const other = await pair({ name: "Ed25519" });
  const files = new Map([["a.txt", enc.encode("a")]]);
  const bundle = await writeBundle(files, { sign: toSign(webCryptoSigner(keys.privateKey, "ci")) });
  assert(bundle.kind === "ok");
  const good = await readBundle(bundle.value, { verify: toVerifySignature(webCryptoVerifier(keys.publicKey)) });
  assert(good.kind === "ok" && good.value.signature.kind === "verified");
  const bad = await readBundle(bundle.value, { verify: toVerifySignature(webCryptoVerifier(other.publicKey)) });
  assertEquals(bad.kind === "err" ? bad.error.kind : "ok", "bad-signature");
});

proves([FR], "a key that cannot sign, a missing ssh-keygen and a missing allowed signers file are errors, never throws", async () => {
  const hmac = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const s = await webCryptoSigner(hmac, "x").sign(enc.encode("m"));
  assertEquals(s.kind === "err" ? s.error.kind : "ok", "key");
  await withTempDir(async (dir) => {
    const keyFile = join(dir, "k");
    await writeTextFile(keyFile, "not a key");
    const missing = await sshSigner({ keyFile, namespace: "file", program: "ifc-no-such-ssh-keygen" }).sign(enc.encode("m"));
    assertEquals(missing, { kind: "err", error: { kind: "missing-program", program: "ifc-no-such-ssh-keygen" } });
    assert(missing.kind === "err" && formatSignError(missing.error).includes("not installed"));
    const noKey = await sshSigner({ keyFile: join(dir, "absent"), namespace: "file" }).sign(enc.encode("m"));
    assertEquals(noKey.kind === "err" ? noKey.error.kind : "ok", "key");
    const noAllowed = await sshVerifier({ allowedSignersFile: join(dir, "absent"), identity: "ci@example.com", namespace: "file" }).verify(
      enc.encode("m"),
      enc.encode("sig"),
    );
    assertEquals(noAllowed.kind === "err" ? noAllowed.error.kind : "ok", "key");
    const failing = toSign(sshSigner({ keyFile, namespace: "file", program: "ifc-no-such-ssh-keygen" }));
    await assertRejects(async () => {
      await failing(enc.encode("m"));
    });
  });
});

const sshKeygen = which("ssh-keygen");

proves(
  [FR],
  "ssh-keygen -Y signs with the key file named and verifies against the allowed signers, bound to namespace and identity",
  async () => {
    await withTempDir(async (dir) => {
      const key = join(dir, "k");
      const made = await run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", key, "-C", "ci@example"]);
      assert(made.success, made.stderr);
      const pub = (await readTextFile(`${key}.pub`)).trim();
      const allowed = join(dir, "allowed signers");
      await writeTextFile(allowed, `ci@example.com ${pub}\n`);
      const message = enc.encode("release 1.2.3\n");
      const signed = await sshSigner({ keyFile: key, namespace: "file" }).sign(message);
      assert(signed.kind === "ok", JSON.stringify(signed));
      assert(new TextDecoder().decode(signed.value.sig).startsWith("-----BEGIN SSH SIGNATURE-----"));
      const fp = await run(["ssh-keygen", "-l", "-E", "sha256", "-f", `${key}.pub`]);
      assertEquals(fp.stdout.split(" ")[1], signed.value.keyid);
      const verifier = sshVerifier({ allowedSignersFile: allowed, identity: "ci@example.com", namespace: "file" });
      assertEquals(await verifier.verify(message, signed.value.sig), { kind: "ok", value: true });
      assertEquals(await verifier.verify(enc.encode("release 1.2.4\n"), signed.value.sig), { kind: "ok", value: false });
      const otherNs = sshVerifier({ allowedSignersFile: allowed, identity: "ci@example.com", namespace: "git" });
      assertEquals(await otherNs.verify(message, signed.value.sig), { kind: "ok", value: false });
      const otherId = sshVerifier({ allowedSignersFile: allowed, identity: "ops@example.com", namespace: "file" });
      assertEquals(await otherId.verify(message, signed.value.sig), { kind: "ok", value: false });
      assertEquals(await verifier.verify(message, enc.encode("not a signature")), { kind: "ok", value: false });
      // the same interface carries an SSH signature in a DSSE envelope
      const env = await signEnvelopeWith("text/plain", message, [sshSigner({ keyFile: key, namespace: "dsse" })]);
      assert(env.kind === "ok");
      const dsseVerifier = sshVerifier({ allowedSignersFile: allowed, identity: "ci@example.com", namespace: "dsse" });
      const v = await verifyEnvelopeWith(env.value, "text/plain", [dsseVerifier]);
      assert(v.kind === "ok", JSON.stringify(v));
    });
  },
  sshKeygen === undefined ? { skip: "ssh-keygen is not installed" } : {},
);
