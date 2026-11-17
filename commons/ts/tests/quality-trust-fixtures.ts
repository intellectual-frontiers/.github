/**
 * What the tests of the Trust page and the assessor pack (`quality-trust.test.ts`, `quality-pack.test.ts`) share: a real temporary Git repository
 * with a specification, its tests, runs kept on the `quality` branch (one failing, with a private marker in its message and its reason) and a
 * nonconformance in the ledger, and an Ed25519 key that signs a pack. Nothing here stands in for the code under test.
 *
 * @module
 */
import { allowedSignersLine } from "../quality/assessor/verify-pack.ts";
import { keepRun } from "../quality/host/branch.ts";
import { appendEvents } from "../quality/host/ledger-branch.ts";
import { attest, emptyLedger, openNonconformance } from "../quality/pure/ledger.ts";
import { mkdir, writeTextFile } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { assert } from "../runtime/test.ts";
import { assembledRun, git, repositoryWithCommit } from "./quality-fixtures.ts";

/** A name that must never reach the public: a customer's, as a failure message would hold it. */
export const MARKER = "Acme Quality Customer";

/** The run's day: `assembledRun` ends run `n` at noon of 2026-11-17 plus `n` seconds. */
export const DAY = "2026-11-17";

/** A demo repository: a specification of two requirements, their tests and the commit that holds them. */
export async function demoRepository(dir: string): Promise<string> {
  await repositoryWithCommit(dir);
  await mkdir(join(dir, "specs", "0099-demo"), { recursive: true });
  await writeTextFile(
    join(dir, "specs", "0099-demo", "spec.md"),
    "# Demo\n\n**Spec ID:** 0099-demo\n**Status:** Active\n\n## Requirements\n\n- **FR-001**: The first requirement.\n- **FR-002**: The second requirement.\n",
  );
  await writeTextFile(
    join(dir, "demo.test.ts"),
    `import { proves } from "./test.ts";\nproves(["0099-demo FR-001"], "the first holds", () => {});\n`,
  );
  await writeTextFile(
    join(dir, "second.test.ts"),
    `import { proves } from "./test.ts";\nproves(["0099-demo FR-002"], "the second holds", () => {});\n`,
  );
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", "a specification and its tests");
  return git(dir, "rev-parse", "HEAD");
}

/**
 * Two runs kept at `revision`: the first passes both requirements; the second fails the second (its message names a customer, an address and a
 * host) and has a planned case that did not run (its reason names the customer); a nonconformance is open for the failure, its reason naming the customer.
 */
export async function demoEvidence(repo: string, revision: string): Promise<void> {
  const first = await keepRun({
    repo,
    record: await assembledRun(
      1,
      [
        { name: "the first holds", file: "demo.test.ts", requirements: ["0099-demo FR-001"] },
        { name: "the second holds", file: "second.test.ts", requirements: ["0099-demo FR-002"] },
      ],
      { revision },
    ),
    commit: revision,
    sign: false,
  });
  assert(first.kind === "ok", "the first run is kept");
  const second = await keepRun({
    repo,
    record: await assembledRun(
      2,
      [
        { name: "the first holds", file: "demo.test.ts", requirements: ["0099-demo FR-001"] },
        {
          name: "the second holds",
          file: "second.test.ts",
          requirements: ["0099-demo FR-002"],
          outcome: "fail",
          message: `expected the order of ${MARKER} (owner@customer.example) from https://db.customer.example/orders to ship`,
        },
      ],
      { revision },
    ),
    commit: revision,
    sign: false,
    notRun: [{ requirements: ["0099-demo FR-001"], name: "a planned check", reason: `the sandbox of ${MARKER} was down` }],
  });
  assert(second.kind === "ok", "the second run is kept");
  const opened = openNonconformance(
    emptyLedger,
    {
      requirement: "0099-demo FR-002",
      cause: "failed",
      reason: `the newest run failed for ${MARKER}`,
      evidence: { traceId: "00000000000000000000000000000002", revision },
    },
    DAY,
  );
  assert(opened.kind === "ok", "a nonconformance is opened");
  const statement = attest({ kind: "statement", requirement: "0099-demo FR-001", by: "person", who: "Ana Quality" }, DAY);
  assert(statement.kind === "ok", "a statement");
  const w = await appendEvents(repo, [opened.value, statement.value], { sign: false });
  assert(w.kind === "ok", w.kind === "err" ? JSON.stringify(w.error) : "");
}

/** An Ed25519 key that signs, and the allowed-signers text that verifies it for the principal `quality`. */
export async function signingKey(
  principal = "quality",
): Promise<{ readonly keys: readonly { readonly key: CryptoKey; readonly keyid: string }[]; readonly allowedSigners: string }> {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  assert("privateKey" in pair, "an Ed25519 key pair");
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { keys: [{ key: pair.privateKey, keyid: principal }], allowedSigners: allowedSignersLine(principal, raw) };
}
