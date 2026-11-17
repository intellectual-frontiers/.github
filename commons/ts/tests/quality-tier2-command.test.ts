/**
 * Tier 2 of the quality system run as a program on a real temporary Git repository (commons 0021-ifqs FR-004, FR-038 to FR-041, 0022-trust FR-001,
 * FR-010, FR-013, FR-014): `quality trust` writes the Trust page and `--check`s it, `quality pack` writes a signed pack that `quality verify-pack`
 * verifies offline (and refuses once a file is changed), and a plan is registered, a sample drawn and attested, a mutation report ingested and the
 * agents' reviews judged through the command line. The commands run as real processes on the runtime this file runs on.
 *
 * @module
 */
import { makeTempDir, readTextFile, remove, writeTextFile } from "../runtime/fs.ts";
import { dirname, fromFileUrl, join, resolve } from "../runtime/path.ts";
import { execPath, run } from "../runtime/proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { needsGit } from "./quality-fixtures.ts";
import { demoEvidence, demoRepository, MARKER } from "./quality-trust-fixtures.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const QUALITY = join(ROOT, "quality", "quality.ts");

const quality = (...words: string[]): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> =>
  run([execPath(), QUALITY, ...words], { env: { GIT_TERMINAL_PROMPT: "0" } });

async function withDemo(f: (repo: string, out: string) => Promise<void>): Promise<void> {
  const repo = await makeTempDir({ prefix: "ifc-tier2-" });
  const out = await makeTempDir({ prefix: "ifc-tier2-out-" });
  try {
    await demoEvidence(repo, await demoRepository(repo));
    await f(repo, out);
  } finally {
    await remove(repo, { recursive: true });
    await remove(out, { recursive: true });
  }
}

proves(
  ["0022-trust FR-001", "0022-trust FR-004", "0022-trust FR-008"],
  "quality trust writes the page and its JSON for the public, --check passes on them and fails once one is edited, and a scope that states conformity is refused",
  () =>
    withDemo(async (repo, out) => {
      const html = join(out, "trust.html");
      const json = join(out, "trust.json");
      const base = ["trust", "--repo", repo, "--harness", "demo harness", "--term", MARKER];
      const made = await quality(...base, "--html", html, "--json", json);
      assertEquals(made.code, 0, made.stderr);
      assertStringIncludes(made.stdout, "values redacted");
      assert(!(await readTextFile(html)).includes(MARKER), "the public page holds no private marker");
      assertEquals((await quality(...base, "--html", html, "--json", json, "--check")).code, 0);
      await writeTextFile(json, (await readTextFile(json)).replace('"failedCases": 1', '"failedCases": 0'));
      const stale = await quality(...base, "--html", html, "--json", json, "--check");
      assertEquals(stale.code, 1);
      assertStringIncludes(stale.stderr, "trust.json is not what the evidence makes");
      const claim = await quality(...base, "--scope", "The demo harness complies with ISO 9001.");
      assertEquals(claim.code, 1);
      assertStringIncludes(claim.stderr, "FR-004");
      assertEquals((await quality("trust", "--repo", repo, "--harness", "x", "--audience", "everyone")).code, 2);
    }),
  needsGit,
);

proves(
  ["0022-trust FR-010", "0022-trust FR-013", "0022-trust FR-014", "0022-trust FR-015"],
  "quality pack writes a signed pack, its tar with the SHA-256 and the DCAT distribution, and quality verify-pack verifies the folder and the tar with no network, refuses a pack with a changed file and says not_run for a pack that is not signed",
  () =>
    withDemo(async (repo, out) => {
      const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
      assert("privateKey" in pair);
      const keyFile = join(out, "signing.jwk");
      await writeTextFile(keyFile, JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey)));
      const folder = join(out, "signed");
      const made = await quality(
        "pack",
        "--repo",
        repo,
        "--harness",
        "demo harness",
        "--out",
        folder,
        "--sign-key",
        keyFile,
        "--signer",
        "quality",
      );
      assertEquals(made.code, 0, made.stderr);
      assertStringIncludes(made.stdout, ", signed");
      assertStringIncludes(made.stdout, "sha256");
      const verified = await quality("verify-pack", folder);
      assertEquals(verified.code, 0, verified.stdout + verified.stderr);
      assertStringIncludes(verified.stdout, "verified");
      assertEquals((await quality("verify-pack", `${folder}.tar`)).code, 0, "the tar is the same pack");
      // a pack is written to a new folder, never over one
      assertEquals((await quality("pack", "--repo", repo, "--harness", "demo harness", "--out", folder)).code, 1);
      // one file changed: the verification fails and names it
      const matrix = join(folder, "trace", "matrix.tsv");
      await writeTextFile(matrix, `${await readTextFile(matrix)}x`);
      const bad = await quality("verify-pack", folder);
      assertEquals(bad.code, 1);
      assertStringIncludes(bad.stdout, "trace/matrix.tsv");
      // a pack that is not signed is not wholly checked: exit 3, not verified
      const unsigned = join(out, "unsigned");
      assertEquals((await quality("pack", "--repo", repo, "--harness", "demo harness", "--out", unsigned)).code, 0);
      const part = await quality("verify-pack", unsigned);
      assertEquals(part.code, 3);
      assertStringIncludes(part.stdout, "not_run");
      assertStringIncludes(part.stdout, "not verified");
      // a key that is not a signing key is refused
      await writeTextFile(keyFile, "{}");
      assertEquals((await quality("pack", "--repo", repo, "--harness", "x", "--out", join(out, "third"), "--sign-key", keyFile)).code, 1);
    }),
  needsGit,
);

proves(
  ["0021-ifqs FR-038", "0021-ifqs FR-039", "0021-ifqs FR-040", "0021-ifqs FR-041"],
  "plans, samples, mutation reports and the agents' reviews are recorded through the command line, and a person's attestation of a sample refuses an item without a result",
  () =>
    withDemo(async (repo, out) => {
      const planFile = join(out, "plan.json");
      await writeTextFile(
        planFile,
        JSON.stringify({
          title: "release",
          cases: [{ name: "the first holds", requirements: ["0099-demo FR-001"], acceptance: "passes" }],
        }),
      );
      const registered = await quality(
        "plan",
        "register",
        "--repo",
        repo,
        "--plan",
        planFile,
        "--by",
        "Ana Quality",
        "--role",
        "lead",
        "--no-sign",
      );
      assertEquals(registered.code, 0, registered.stderr);
      assertStringIncludes(registered.stdout, "PLAN-0001");
      // the runs of the demo name no plan, so there is no finding
      const checked = await quality("plan", "check", "--repo", repo);
      assertEquals(checked.code, 0, checked.stdout + checked.stderr);
      // a sample of the runs, drawn with a seed and then attested
      const drawn = await quality(
        "sample",
        "draw",
        "--repo",
        repo,
        "--subject",
        "runs",
        "--by",
        "Ana Quality",
        "--seed",
        "abc",
        "--size",
        "1",
        "--no-sign",
      );
      assertEquals(drawn.code, 0, drawn.stderr);
      const item = /SAMPLE-0001 drawn with the seed abc: ([0-9a-f]{32})/.exec(drawn.stdout)?.[1];
      assert(item !== undefined, drawn.stdout);
      const missing = await quality("sample", "attest", "--repo", repo, "--sample", "SAMPLE-0001", "--by", "Ana Quality", "--no-sign");
      assertEquals(missing.code, 1);
      assertStringIncludes(missing.stderr, "no result for");
      const attested = await quality(
        "sample",
        "attest",
        "--repo",
        repo,
        "--sample",
        "SAMPLE-0001",
        "--by",
        "Ana Quality",
        "--result",
        `${item}=pass`,
        "--no-sign",
      );
      assertEquals(attested.code, 0, attested.stderr);
      assertEquals((await quality("sample", "verify", "--repo", repo)).code, 0);
      // a mutation report
      const reportFile = join(out, "mutation.json");
      await writeTextFile(
        reportFile,
        JSON.stringify({
          schema: "ifqs-mutation-report/1",
          tool: { name: "the harness's mutation tool", version: "1" },
          revision: "abc",
          results: [{ requirement: "0099-demo FR-001", mutants: 10, killed: 4, survived: 6 }],
        }),
      );
      assertEquals((await quality("mutation", "ingest", "--repo", repo, "--report", reportFile, "--no-sign")).code, 0);
      const strength = await quality("mutation", "strength", "--repo", repo);
      assertEquals(strength.code, 0, strength.stderr);
      assertStringIncludes(strength.stdout, "0099-demo FR-001\tE3\t40.0%\tlowered to E2");
      // no agent reviewed anything: nothing is owed
      const agents = await quality("agents", "--repo", repo, "--rate", "200");
      assertEquals(agents.code, 0, agents.stderr);
      assertStringIncludes(agents.stdout, "0 agent reviews");
      assertEquals((await quality("plan")).code, 2);
    }),
  needsGit,
);
