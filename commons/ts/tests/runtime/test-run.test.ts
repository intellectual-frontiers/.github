/**
 * Tests of `runtime/test-run.ts` and `tools/test.ts`: a fixture suite (a passing test of high risk, a failing assertion that holds a
 * bearer token, a skipped and a todo test, a review in code, and a test whose process is killed) run through `runTests` on the runtime
 * that runs this file, into one record with every report, a ledger and a signature; the record's tests, redaction and parentage, the exit
 * rule, the renderings, the ledger, and `verify` (an envelope, a review required and then signed, and a one-byte change detected).
 *
 * @module
 */
import { decodeTraces } from "../../kernel/otlp.ts";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { toBase64 } from "@intellectual-frontiers/formats/base64";
import { readTextFile, readFile, remove, symlink, writeFile, writeTextFile, makeTempDir } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve, toFileUrl } from "@intellectual-frontiers/system/path";
import { build, execPath, run, runtimeName } from "@intellectual-frontiers/system/proc";
import { readLedger, REPORT_FORMATS, type Runtime, runTests, signRun, verifyRun, writeReports } from "../../runtime/test-run.ts";
import { assert, assertEquals, assertExists, assertStringIncludes, proves } from "../../runtime/test.ts";

const FR = (n: string): `0008-test-evidence FR-${string}` => `0008-test-evidence FR-${n}`;
const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "../..");
const TEST_TS = toFileUrl(join(ROOT, "runtime", "test.ts")).href;
const RUNTIME: Runtime = runtimeName();
const POSIX = build.os !== "windows";

const MAIN = `
import { assertEquals, proves, reviewed, test } from ${JSON.stringify(TEST_TS)};
reviewed("fixture FR-010", "read by a reviewer");
proves(["fixture FR-001"], "passes", () => assertEquals(1, 1), { risk: "high" });
proves(["fixture FR-002"], "fails", () => assertEquals({ auth: "Bearer abcdefghijklmnop" }, { auth: "none" }));
proves(["fixture FR-003"], "skipped", () => undefined, { skip: "windows has no file modes" });
test("todo", () => undefined, { todo: "later" });
`;

const KILL = `
import process from "node:process";
import { proves } from ${JSON.stringify(TEST_TS)};
proves(["fixture FR-004"], "before the kill", () => undefined);
proves(["fixture FR-005"], "killed", () => {
  process.kill(process.pid, "SIGKILL");
  return new Promise(() => undefined);
});
`;

const REQUIRED = [
  "fixture FR-001",
  "fixture FR-002",
  "fixture FR-003",
  "fixture FR-004",
  "fixture FR-005",
  "fixture FR-006",
  "fixture FR-010",
].filter((r) => POSIX || (r !== "fixture FR-004" && r !== "fixture FR-005")); // the killed process's tests are POSIX only

function pem(label: string, der: ArrayBuffer): string {
  const b64 = toBase64(new Uint8Array(der)).replace(/(.{64})/g, "$1\n");
  return `-----BEGIN ${label}-----\n${b64.trimEnd()}\n-----END ${label}-----\n`;
}

function cli(...words: string[]): readonly string[] {
  const tool = join(ROOT, "tools", "test.ts");
  return [execPath(), tool, ...words];
}

proves(
  [FR("001"), FR("002"), FR("003"), FR("004"), FR("005"), FR("006"), FR("007"), FR("011"), FR("012"), FR("013")],
  "a fixture suite run into one record, its reports, a ledger and signatures, and verified",
  async () => {
    const dir = await makeTempDir({ prefix: "ifc-test-run-" });
    // On POSIX the suite is run through a link to its folder, as macOS's /var is a link to /private/var: a test's file is still
    // recorded relative to the working folder.
    const link = `${dir}-link`;
    if (POSIX) await symlink(dir, link, { type: "dir" });
    const base = POSIX ? link : dir;
    try {
      await writeTextFile(join(dir, "a-main.test.ts"), MAIN);
      if (POSIX) await writeTextFile(join(dir, "z-kill.test.ts"), KILL);
      await writeTextFile(join(dir, "requirements.txt"), `${REQUIRED.join("\n")}\n`);
      const keys = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
      await writeTextFile(join(dir, "ci.pem"), pem("PRIVATE KEY", await crypto.subtle.exportKey("pkcs8", keys.privateKey)));
      await writeTextFile(join(dir, "ci.pub.pem"), pem("PUBLIC KEY", await crypto.subtle.exportKey("spki", keys.publicKey)));
      const ledgerPath = join(dir, "out", "ledger.jsonl");

      const r = await runTests({
        runtimes: [RUNTIME],
        paths: ["."],
        cwd: base,
        out: "out",
        requirements: "requirements.txt",
        ledger: "out/ledger.jsonl",
        sign: { key: join(dir, "ci.pem"), meaning: "executed", role: "ci" },
        reports: REPORT_FORMATS,
        output: "null",
      });
      assert(r.kind === "ok", r.kind === "err" ? r.error : "");
      const { run: testRun, recordPath, digest } = r.value;

      // FR-005, FR-007: one record named for its trace, the digest of its bytes, read back.
      assertEquals(recordPath, join(base, "out", `${testRun.traceId}.otlp.json`));
      const bytes = await readFile(recordPath);
      assertEquals(digest, await sha256(bytes));

      // FR-001: every test, with its outcome, reason, failure and risk; the token redacted.
      const by = (name: string) => testRun.tests.find((t) => t.name === name);
      assertEquals(by("fixture FR-001: passes")?.outcome, "pass");
      assertEquals(by("fixture FR-001: passes")?.risk, "high");
      assertEquals(by("fixture FR-001: passes")?.file, "a-main.test.ts");
      const failed = by("fixture FR-002: fails");
      assertExists(failed);
      assertEquals(failed.outcome, "fail");
      assertStringIncludes(failed.actual ?? "", "Bearer REDACTED");
      assertStringIncludes(failed.expected ?? "", "none");
      assert(![failed.message, failed.expected, failed.actual].join(" ").includes("abcdefghijklmnop"));
      assert(!new TextDecoder().decode(bytes).includes("abcdefghijklmnop"));
      assertEquals([by("fixture FR-003: skipped")?.outcome, by("fixture FR-003: skipped")?.reason], ["skip", "windows has no file modes"]);
      assertEquals([by("todo")?.outcome, by("todo")?.reason], ["todo", "later"]);
      // FR-004: the killed test is cancelled, the one before it kept.
      if (POSIX) {
        assertEquals(by("fixture FR-004: before the kill")?.outcome, "pass");
        assertEquals(by("fixture FR-005: killed")?.outcome, "cancelled");
      }

      // FR-002: each test span's parent is the run's span; FR-003: the resource is the installation record, with no person in it.
      const doc: unknown = JSON.parse(new TextDecoder().decode(bytes));
      const traces = decodeTraces(doc);
      assert(traces.kind === "ok");
      const testSpans = traces.value.flatMap((b) => b.spans.filter((s) => s.name === "test"));
      assertEquals(testSpans.length, testRun.counts.tests);
      assert(testSpans.every((s) => s.parentSpanId === testRun.spanId && s.context.traceId === testRun.traceId));
      for (const b of traces.value) {
        assert(Object.keys(b.resource.attributes).every((k) => !k.startsWith("user.") && !k.startsWith("enduser.") && k !== "host.name"));
      }
      assertEquals(
        testRun.installations.map((i) => i.runtime),
        [RUNTIME],
      );
      assert(["ci", "developer"].includes(testRun.runner.role));

      // FR-006: the run fails, and says why; the skipped and the unlisted requirement are unproven, the reviewed one is not.
      assertEquals(r.value.code, 1);
      assertEquals(testRun.status, "failure");
      assertEquals(testRun.unproven, ["fixture FR-003", "fixture FR-006"]);
      assert(testRun.failures.some((f) => f === "1 test failed"));
      if (POSIX) {
        assert(testRun.failures.some((f) => f === "1 test was cancelled"));
        assert(testRun.failures.some((f) => f.startsWith(`the ${RUNTIME} runner exited with`)));
      }
      assertEquals(testRun.reviews, [{ requirement: "fixture FR-010", reason: "read by a reviewer" }]);

      // FR-008, FR-010: every report, rendered from the record kept, the same bytes when rendered again.
      assertEquals(r.value.reports.length, REPORT_FORMATS.length);
      const again = await writeReports(testRun, join(dir, "again"), REPORT_FORMATS, {
        digest,
        ...(r.value.ledger === undefined ? {} : { ledger: r.value.ledger }),
      });
      for (const [i, path] of r.value.reports.entries()) assertEquals(await readTextFile(again[i] ?? ""), await readTextFile(path), path);

      // FR-011: the record's digest and the signature, with its meaning and role, in the ledger.
      const ledger = await readLedger(ledgerPath);
      assert(ledger.kind === "ok");
      assertEquals(
        ledger.value.map((e) => e.kind),
        ["test-run", "test-signature:executed:ci"],
      );
      assertEquals(ledger.value[0]?.evidence, digest);
      assertEquals(ledger.value[1]?.subject, { kind: "test-record", id: digest });
      const envelopePath = r.value.envelopePath;
      assertExists(envelopePath);
      assertStringIncludes(await readTextFile(join(dir, "out", `${testRun.traceId}.md`)), "| executed | ci |");

      // FR-012: verified with the envelope and the key; FR-013: a review is required, then signed.
      const verified = await verifyRun({
        record: recordPath,
        ledger: ledgerPath,
        envelopes: [envelopePath],
        publicKey: join(dir, "ci.pub.pem"),
      });
      assert(verified.kind === "ok", verified.kind === "err" ? verified.error.join("; ") : "");
      const fromPrivate = await verifyRun({
        record: recordPath,
        ledger: ledgerPath,
        envelopes: [envelopePath],
        publicKey: join(dir, "ci.pem"),
      });
      assert(fromPrivate.kind === "ok");
      const unreviewed = await verifyRun({ record: recordPath, ledger: ledgerPath, requireReview: true });
      assert(unreviewed.kind === "err" && unreviewed.error.some((e) => e.includes("reviewed")));
      const review = await signRun({
        record: recordPath,
        ledger: ledgerPath,
        sign: { key: join(dir, "ci.pem"), meaning: "reviewed", role: "qa-lead" },
      });
      assert(review.kind === "ok", review.kind === "err" ? review.error : "");
      const reviewedRun = await verifyRun({
        record: recordPath,
        ledger: ledgerPath,
        envelopes: [envelopePath, review.value.envelopePath],
        publicKey: join(dir, "ci.pub.pem"),
        requireReview: true,
      });
      assert(reviewedRun.kind === "ok", reviewedRun.kind === "err" ? reviewedRun.error.join("; ") : "");
      assertEquals(
        reviewedRun.value.signatures.map((s) => `${s.meaning}:${s.role}`),
        ["executed:ci", "reviewed:qa-lead"],
      );
      const person = await signRun({
        record: recordPath,
        ledger: ledgerPath,
        sign: { key: join(dir, "ci.pem"), meaning: "approved", role: "alice@example.com" },
      });
      assert(person.kind === "err");

      // SC-003: a record changed by one byte is not in the ledger.
      const changed = new Uint8Array(bytes);
      const at = changed.length - 3;
      changed[at] = (changed[at] ?? 0) ^ 1;
      const changedPath = join(dir, "changed.otlp.json");
      await writeFile(changedPath, changed);
      const tampered = await verifyRun({ record: changedPath, ledger: ledgerPath });
      assert(tampered.kind === "err" && tampered.error.some((e) => e.includes("is not in the ledger")));

      // The command line: verify passes, then fails on the changed record.
      const good = await run(cli("verify", "--record", recordPath, "--ledger", ledgerPath, "--require-review"));
      assertEquals(good.code, 0, good.stderr);
      assertStringIncludes(good.stdout, "reviewed by qa-lead");
      const bad = await run(cli("verify", "--record", changedPath, "--ledger", ledgerPath));
      assertEquals(bad.code, 1);
      assertStringIncludes(bad.stderr, "is not in the ledger");
      assertEquals((await run(cli("run", "--runtime", "perl"))).code, 2);
    } finally {
      if (POSIX) await remove(link);
      await remove(dir, { recursive: true });
    }
  },
  { timeout: 120_000 },
);

proves([FR("005"), FR("006")], "a runtime that is not installed is reported and fails the run", async () => {
  const dir = await makeTempDir({ prefix: "ifc-test-run-" });
  try {
    await writeTextFile(join(dir, "a.test.ts"), "export {};\n");
    const r = await runTests({
      runtimes: [RUNTIME],
      paths: ["."],
      cwd: dir,
      executables: { [RUNTIME]: join(dir, "no-such-runtime") },
      output: "null",
    });
    assert(r.kind === "ok", r.kind === "err" ? r.error : "");
    assertEquals(r.value.code, 1);
    assertEquals(r.value.run.runners, [{ kind: "missing", runtime: RUNTIME }]);
    assertEquals(r.value.run.failures, [`${RUNTIME} is not installed`]);
    const none = await runTests({ paths: ["missing-folder"], cwd: dir });
    assert(none.kind === "err");
  } finally {
    await remove(dir, { recursive: true });
  }
});
