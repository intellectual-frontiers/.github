/**
 * Tests of the levels of approval (commons grc 0020-grc-approval FR-025 to FR-029): the policy of each level, the level an approval reached, the registry that a first key starts and that a replacement continues, and the signature of a version by the first key. Real `ssh-keygen`
 * keys sign, every name is made up and nothing reads a clock.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves as provesWith } from "@intellectual-frontiers/test";
import {
  APPROVAL_LEVELS,
  APPROVAL_NAMESPACE,
  APPROVAL_PAYLOAD_TYPE,
  type Approver,
  type ApprovalRequest,
  decodeStatement,
  firstRegistry,
  levelAtLeast,
  levelOfApprovers,
  levelOfCustody,
  nextRegistry,
  policyOfLevel,
  registryOfChain,
  statementBytes,
  verifyApproval,
  type PersonKeys,
  type SignedDocument,
} from "../src/logical/mod.ts";
import { approvalVerifier, fingerprintOf, sshsigSignerFor, signRegistry } from "../src/signers/sshsig/mod.ts";

type Fn = () => Promise<void>;
type Reqs = Parameters<typeof provesWith>[0];
const proves = (ids: Reqs, name: string, a: Fn | { skip?: string }, b?: Fn): void => (typeof a === "function" ? provesWith(ids, name, a) : provesWith(ids, name, b as Fn, a));
const skip = proc.which("ssh-keygen") === undefined ? { skip: "ssh-keygen is not installed" } : {};
const NOW = "2026-06-01T12:00:00Z";
const PLAN = "b".repeat(64);

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
const asNew = (k: Soft, person: string) => ({ keyId: k.keyId, publicKey: k.line, person, custody: "file" as const });

proves(["0020-grc-approval FR-025"], "the levels are presence, key and hardware; presence signs nothing, key accepts every custody, hardware needs a token for a regulated act", async () => {
  assertEquals([...APPROVAL_LEVELS], ["presence", "key", "hardware"]);
  assertEquals(policyOfLevel("presence"), undefined);
  const key = policyOfLevel("key");
  assert(key !== undefined && key.custody.regulated.includes("file") && key.regulatedNeedsUserVerified === false);
  const hw = policyOfLevel("hardware");
  assert(hw !== undefined && hw.custody.regulated.join() === "hardware" && hw.custody.routine.includes("file") && hw.regulatedNeedsUserVerified === true);
  assertEquals(policyOfLevel("key", 60_000)?.maxLifetimeMs, 60_000);
  assert(levelAtLeast("hardware", "key") && levelAtLeast("key", "key") && !levelAtLeast("presence", "key"));
});

proves(["0020-grc-approval FR-026"], "the level an approval reached is the lowest of its approvers, and presence where nobody signed", async () => {
  assertEquals(levelOfCustody("file"), "key");
  assertEquals(levelOfCustody("managed"), "key");
  assertEquals(levelOfCustody("hardware"), "hardware");
  const a = (custody: Approver["custody"]): Approver => ({ person: "synthetic-person-01", keyId: `SHA256:${custody}`, custody, weak: custody === "file", userVerified: false, nonce: "1".repeat(32), notAfter: NOW });
  assertEquals(levelOfApprovers([]), "presence");
  assertEquals(levelOfApprovers([a("hardware")]), "hardware");
  assertEquals(levelOfApprovers([a("hardware"), a("file")]), "key");
});

proves(["0020-grc-approval FR-027", "0020-grc-approval FR-029"], "a first key starts the registry at version 1 with the roles approver and registry-admin, the platform signs it with that key, and a chain from that key as root is good", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const k = await softKey(dir, "synthetic-person-01");
    const v1 = firstRegistry(asNew(k, "synthetic-person-01"), NOW);
    assert(v1.kind === "ok", v1.kind === "err" ? v1.error : "");
    assertEquals(v1.value.version, 1);
    assertEquals([...(v1.value.keys[0]?.roles ?? [])], ["approver", "registry-admin"]);
    const signed = await signRegistry(v1.value, { keyFile: k.file });
    assert(signed.kind === "ok", signed.kind === "err" ? signed.error : "");
    const chain = await registryOfChain({ keyId: k.keyId }, [signed.value], approvalVerifier);
    assert(chain.kind === "ok", chain.kind === "err" ? chain.error : "");
    const other = await registryOfChain({ keyId: "SHA256:" + "A".repeat(43) }, [signed.value], approvalVerifier);
    assert(other.kind === "err", "another key id is not the root");
  });
});

proves(["0020-grc-approval FR-028"], "a key is replaced by adding its successor and marking it revoked in the next version, signed by the first key; a key that is not there cannot be revoked and one that is there cannot be added again", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const k1 = await softKey(dir, "synthetic-person-01");
    const k2 = await softKey(dir, "synthetic-person-02");
    const v1 = firstRegistry(asNew(k1, "synthetic-person-01"), NOW);
    assert(v1.kind === "ok");
    const s1 = await signRegistry(v1.value, { keyFile: k1.file });
    assert(s1.kind === "ok");
    const later = "2026-06-02T12:00:00Z";
    const v2 = await nextRegistry(v1.value, { add: [{ key: asNew(k2, "synthetic-person-01"), roles: ["approver", "registry-admin"], replaces: k1.keyId }], revoke: [k1.keyId] }, later);
    assert(v2.kind === "ok", v2.kind === "err" ? v2.error : "");
    assertEquals(v2.value.version, 2);
    const s2 = await signRegistry(v2.value, { keyFile: k1.file });
    assert(s2.kind === "ok");
    const chain = await registryOfChain({ keyId: k1.keyId }, [s1.value, s2.value] as SignedDocument[], approvalVerifier);
    assert(chain.kind === "ok", chain.kind === "err" ? chain.error : "");
    const reg: PersonKeys = chain.value;
    assert(reg.keys.find((x) => x.keyId === k1.keyId)?.revokedAt === later, "the old key is revoked");
    assert((await nextRegistry(v1.value, { revoke: ["SHA256:unknown"] }, later)).kind === "err");
    assert((await nextRegistry(v1.value, { add: [{ key: asNew(k1, "synthetic-person-01"), roles: ["approver"] }] }, later)).kind === "err");
    // the successor approves, the replaced key does not
    const statement = decodeStatement({ schema: "1", action: "boundary.approve", subject: "synthetic-boundary-01", planHash: PLAN, requestId: "synthetic-request-01", nonce: "2".repeat(32), notBefore: "2026-06-02T12:00:00Z", notAfter: "2026-06-02T12:05:00Z", risk: "regulated" });
    assert(statement.kind === "ok");
    const request: ApprovalRequest = { action: "boundary.approve", subject: "synthetic-boundary-01", planHash: PLAN, requestId: "synthetic-request-01", risk: "regulated", threshold: 1, roles: ["approver"] };
    const sign = async (by: Soft) => {
      const r = await sshsigSignerFor(APPROVAL_NAMESPACE as never).sign(APPROVAL_PAYLOAD_TYPE, statementBytes(statement.value).payload, [{ keyFile: by.file }]);
      assert(r.kind === "ok");
      return r.value as SignedDocument;
    };
    const policy = policyOfLevel("key");
    assert(policy !== undefined);
    const input = (a: SignedDocument) => ({ request, approvals: [a], registry: reg, policy, used: new Set<string>(), now: "2026-06-02T12:01:00Z" });
    const good = await verifyApproval(input(await sign(k2)), approvalVerifier);
    assert(good.kind === "ok" && good.value.approvers[0]?.custody === "file", good.kind === "err" ? good.error.message : "");
    const old = await verifyApproval(input(await sign(k1)), approvalVerifier);
    assert(old.kind === "err" && old.error.code === "E-APPROVAL-KEY-REVOKED", old.kind === "err" ? old.error.code : "approved");
  });
});

proves(["0020-grc-approval FR-025", "0020-grc-approval FR-010"], "at the level key a regulated act is approved by a file key without a token; at the level hardware the same key is refused for its custody", skip, async () => {
  await fs.withTempDir(async (dir) => {
    const k = await softKey(dir, "synthetic-person-01");
    const v1 = firstRegistry(asNew(k, "synthetic-person-01"), NOW);
    assert(v1.kind === "ok");
    const statement = decodeStatement({ schema: "1", action: "boundary.approve", subject: "synthetic-boundary-01", planHash: PLAN, requestId: "synthetic-request-02", nonce: "3".repeat(32), notBefore: "2026-06-01T11:59:30Z", notAfter: "2026-06-01T12:05:00Z", risk: "regulated" });
    assert(statement.kind === "ok");
    const r = await sshsigSignerFor(APPROVAL_NAMESPACE as never).sign(APPROVAL_PAYLOAD_TYPE, statementBytes(statement.value).payload, [{ keyFile: k.file }]);
    assert(r.kind === "ok");
    const request: ApprovalRequest = { action: "boundary.approve", subject: "synthetic-boundary-01", planHash: PLAN, requestId: "synthetic-request-02", risk: "regulated", threshold: 1, roles: ["approver"] };
    const run = async (level: "key" | "hardware") => {
      const policy = policyOfLevel(level);
      assert(policy !== undefined);
      return verifyApproval({ request, approvals: [r.value as SignedDocument], registry: v1.value, policy, used: new Set(), now: NOW }, approvalVerifier);
    };
    const key = await run("key");
    assert(key.kind === "ok" && levelOfApprovers(key.value.approvers) === "key", key.kind === "err" ? key.error.message : "");
    const hw = await run("hardware");
    assert(hw.kind === "err" && hw.error.code === "E-APPROVAL-CUSTODY", hw.kind === "err" ? hw.error.code : "approved");
  });
});
