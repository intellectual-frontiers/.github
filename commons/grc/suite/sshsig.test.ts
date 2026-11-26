/**
 * Tests of the sshsig signer (commons grc 0014-grc-sshsig FR-001 to FR-005) with real `ssh-keygen`: a payload signed and verified with the public key alone, a payload changed, the wrong key, the wrong namespace and payload type refused, a key type that is
 * not verified, and the signatures checked both ways against the reference tool. Every name is made up.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fingerprintOf, NAMESPACE, NAMESPACES, pae, parseNamespace, sshsigSigner, sshsigSignerFor, verifySshsig } from "../src/signers/sshsig/mod.ts";
import { pae as dssePae } from "@intellectual-frontiers/crypto/dsse";

const skip = proc.which("ssh-keygen") === undefined ? { skip: "ssh-keygen is not installed" } : {};
const TYPE = "application/vnd.example+json";
const bytes = (s: string) => new TextEncoder().encode(s);

async function key(dir: string, name: string, type = "ed25519"): Promise<{ file: string; pub: string }> {
  const file = path.join(dir, name);
  const r = await proc.run(["ssh-keygen", "-q", "-t", type, "-N", "", "-C", name, "-f", file]);
  assert(r.success, r.stderr);
  return { file, pub: (await fs.readTextFile(`${file}.pub`)).trim() };
}

proves(["0014-grc-sshsig FR-001", "0014-grc-sshsig FR-002"], "a payload is signed with a key file and verified with the public key alone, the envelope has the type, the payload and the key's fingerprint, and the payload is given back", async () => {
  await fs.withTempDir(async (dir) => {
    const k = await key(dir, "daily");
    assertEquals(sshsigSigner.id, "sshsig");
    assertEquals(sshsigSigner.custody, "file");
    const signed = await sshsigSigner.sign(TYPE, bytes('{"a":1}'), [{ keyFile: k.file }]);
    assert(signed.kind === "ok", signed.kind === "err" ? signed.error.message : "");
    assertEquals([signed.value.payloadType, signed.value.payload, signed.value.signatures.length], [TYPE, btoa('{"a":1}'), 1]);
    assert(signed.value.signatures[0]?.sig.startsWith("-----BEGIN SSH SIGNATURE-----"));
    const fp = await fingerprintOf(k.pub);
    assert(fp.kind === "ok");
    assertEquals(signed.value.signatures[0]?.keyid, fp.value);
    const back = await sshsigSigner.verify(signed.value, TYPE, [{ publicKey: k.pub }]);
    assert(back.kind === "ok" && new TextDecoder().decode(back.value) === '{"a":1}');
    const none = await sshsigSigner.sign(TYPE, bytes("x"), []);
    assert(none.kind === "err" && none.error.message.includes("one is needed"));
    const nofile = await sshsigSigner.sign(TYPE, bytes("x"), [{ keyFile: path.join(dir, "missing") }]);
    assert(nofile.kind === "err" && nofile.error.kind === "key" && nofile.error.message.includes("ssh-keygen did not sign"));
  });
}, skip);

proves(["0014-grc-sshsig FR-003"], "a changed payload, the wrong key, the wrong payload type, another namespace, an unreadable signature and an unknown hash are each refused with the reason", async () => {
  await fs.withTempDir(async (dir) => {
    const a = await key(dir, "a");
    const b = await key(dir, "b");
    const signed = await sshsigSigner.sign(TYPE, bytes("payload"), [{ keyFile: a.file }]);
    assert(signed.kind === "ok");
    const env = signed.value;
    const check = async (e: typeof env, type = TYPE, pub = a.pub) => sshsigSigner.verify(e, type, [{ publicKey: pub }]);
    const reason = async (r: ReturnType<typeof check>) => {
      const x = await r;
      assert(x.kind === "err");
      return x.error.message;
    };
    assert((await reason(check({ ...env, payload: btoa("payloaD") }))).includes("does not verify"), "a payload changed by a byte");
    assert((await reason(check(env, TYPE, b.pub))).includes("another key"));
    assert((await reason(check(env, "application/other"))).includes("application/other"));
    assert((await reason(check({ ...env, payload: "!!!" }))).includes("not base64"));
    assert((await reason(check({ ...env, signatures: [{ sig: "not a signature" }] }))).includes("not an SSH signature"));
    assert((await reason(check({ ...env, signatures: [{ sig: "-----BEGIN SSH SIGNATURE-----\nAAAA\n-----END SSH SIGNATURE-----" }] }))).includes("SSHSIG"));
    // a signature made in another namespace by the reference tool
    const msg = path.join(dir, "msg");
    await fs.writeFile(msg, pae(TYPE, bytes("payload")));
    const other = await proc.run(["ssh-keygen", "-Y", "sign", "-f", a.file, "-n", "file"], { input: pae(TYPE, bytes("payload")) });
    assert(other.success);
    assert((await reason(check({ ...env, signatures: [{ sig: other.stdout.trim() }] }))).includes("namespace file"));
    assertEquals((await sshsigSigner.verify({ ...env, signatures: [] }, TYPE, [{ publicKey: a.pub }])).kind, "err");
    assertEquals((await sshsigSigner.verify(env, TYPE, [])).kind, "err");
  });
}, skip);

proves(["0014-grc-sshsig FR-004"], "only Ed25519 keys are verified: another key type is refused saying so", async () => {
  await fs.withTempDir(async (dir) => {
    const a = await key(dir, "a");
    const rsa = await key(dir, "r", "rsa");
    const signed = await sshsigSigner.sign(TYPE, bytes("p"), [{ keyFile: a.file }]);
    assert(signed.kind === "ok");
    const r = await sshsigSigner.verify(signed.value, TYPE, [{ publicKey: rsa.pub }]);
    assert(r.kind === "err" && r.error.message.includes("only ssh-ed25519"), JSON.stringify(r));
    const fp = await fingerprintOf(rsa.pub);
    assert(fp.kind === "err");
  });
}, skip);

proves(["0014-grc-sshsig FR-005"], "the fingerprint is OpenSSH's, a signature made here is verified by ssh-keygen -Y verify, and a signature of ssh-keygen in the namespace is verified here", async () => {
  await fs.withTempDir(async (dir) => {
    const k = await key(dir, "daily");
    const fp = await fingerprintOf(k.pub);
    const reference = (await proc.run(["ssh-keygen", "-l", "-f", `${k.file}.pub`])).stdout.split(" ")[1];
    assert(fp.kind === "ok" && fp.value === reference, `${fp.kind === "ok" ? fp.value : ""} vs ${reference}`);
    const allowed = path.join(dir, "allowed_signers");
    await fs.writeTextFile(allowed, `signer ${k.pub}\n`);
    // ours, checked by the reference tool
    const signed = await sshsigSigner.sign(TYPE, bytes("hello"), [{ keyFile: k.file }]);
    assert(signed.kind === "ok");
    const sigFile = path.join(dir, "sig");
    await fs.writeTextFile(sigFile, `${signed.value.signatures[0]?.sig}\n`);
    const checked = await proc.run(["ssh-keygen", "-Y", "verify", "-f", allowed, "-I", "signer", "-n", NAMESPACE, "-s", sigFile], { input: pae(TYPE, bytes("hello")) });
    assert(checked.success, checked.stderr + checked.stdout);
    const wrong = await proc.run(["ssh-keygen", "-Y", "verify", "-f", allowed, "-I", "signer", "-n", NAMESPACE, "-s", sigFile], { input: pae(TYPE, bytes("hellO")) });
    assertEquals(wrong.success, false, "and the reference tool refuses a changed payload");
    // the reference tool's, checked by ours
    const theirs = await proc.run(["ssh-keygen", "-Y", "sign", "-f", k.file, "-n", NAMESPACE], { input: pae(TYPE, bytes("hello")) });
    assert(theirs.success);
    const verified = await sshsigSigner.verify({ payloadType: TYPE, payload: btoa("hello"), signatures: [{ sig: theirs.stdout.trim() }] }, TYPE, [{ publicKey: k.pub }]);
    assert(verified.kind === "ok");
    assertEquals(pae("t", bytes("ab")), bytes("DSSEv1 1 t 2 ab"));
  });
}, skip);

const N = (n: string): string => `0017-grc-sshsig-namespace ${n}`;

proves([N("FR-002")], "a namespace is made only by parseNamespace, which refuses an empty text, a space, a comma, a control character and a text over 64; the known ones are one table", () => {
  assertEquals([...NAMESPACES], ["grc-evidence", "ifc-telemetry", "ifc-approval"]);
  for (const bad of ["", "a b", "a,b", "a\nb", "x".repeat(65)]) assertEquals(parseNamespace(bad).kind, "err");
  assertEquals(parseNamespace("ifc-telemetry").kind, "ok");
});

proves([N("FR-001"), N("FR-003"), N("FR-004")], "a signature of the telemetry namespace verifies there, is refused in the evidence namespace with both named, and verifySshsig takes any message", async () => {
  await fs.withTempDir(async (dir) => {
    const k = await key(dir, "device");
    const ns = parseNamespace("ifc-telemetry");
    assert(ns.kind === "ok");
    const telemetry = sshsigSignerFor(ns.value);
    const signed = await telemetry.sign(TYPE, bytes("batch"), [{ keyFile: k.file }]);
    assert(signed.kind === "ok");
    assert((await telemetry.verify(signed.value, TYPE, [{ publicKey: k.pub }])).kind === "ok");
    const wrong = await sshsigSigner.verify(signed.value, TYPE, [{ publicKey: k.pub }]);
    assert(wrong.kind === "err" && wrong.error.message.includes("ifc-telemetry") && wrong.error.message.includes("grc-evidence"));
    const armored = signed.value.signatures[0]?.sig ?? "";
    assert((await verifySshsig(armored, dssePae(TYPE, bytes("batch")), k.pub, "ifc-telemetry")).kind === "ok");
    assert((await verifySshsig(armored, bytes("another message"), k.pub, "ifc-telemetry")).kind === "err");
    const ecdsa = await key(dir, "e", "ecdsa");
    const refused = await verifySshsig(armored, dssePae(TYPE, bytes("batch")), ecdsa.pub, "ifc-telemetry");
    assert(refused.kind === "err" && refused.error.message.includes("ssh-ed25519"));
  });
}, skip);

proves([N("FR-005")], "pae is the one of crypto: both give the same bytes", () => {
  for (const [t, p] of [[TYPE, "x"], ["a/b", ""], ["application/vnd.ifc.telemetry+json", "{\"a\":[1,2]}"]] as const) assertEquals(pae(t, bytes(p)), dssePae(t, bytes(p)));
});
