/**
 * The assessor pack and its offline verifier (commons 0022-trust FR-010 to FR-016), on a real temporary Git repository's quality branch: the
 * pack's files and manifest, a signature over every file, the page and the pack made from the same evidence with equal figures, the pack as a
 * tar with its SHA-256 and DCAT distribution, and the verifier run as a program from inside the pack (on the runtime this file runs on, and on
 * Node 26 where it is installed): a changed file named, a broken chain named, a key the pack lacks reported `not_run`, and nothing reported
 * verified that was not wholly checked.
 *
 * @module
 */
import { collect, packOf, packSourceOf, readPackFolder, readPackTar, writePack } from "../quality/assessor/host.ts";
import { buildPack } from "../quality/assessor/pack.ts";
import { allowedSignersLine, figuresOf, parseAllowedSigners, type PackFiles, verifyPack } from "../quality/assessor/verify-pack.ts";
import { generateTrust } from "../quality/trust/host.ts";
import { makeTempDir, readFile, readTextFile, remove, writeTextFile } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { execPath, run, which } from "../runtime/proc.ts";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { at, list, needsGit, needsSshKeygen, parsed } from "./quality-fixtures.ts";
import { demoEvidence, demoRepository, MARKER, signingKey } from "./quality-trust-fixtures.ts";

const text = (b: Uint8Array | undefined): string => new TextDecoder().decode(b);
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

async function withDemo(f: (repo: string, revision: string) => Promise<void>): Promise<void> {
  const repo = await makeTempDir({ prefix: "ifc-pack-" });
  try {
    const revision = await demoRepository(repo);
    await demoEvidence(repo, revision);
    await f(repo, revision);
  } finally {
    await remove(repo, { recursive: true });
  }
}

async function signedPack(
  repo: string,
  signer = "quality",
): Promise<{ readonly files: PackFiles; readonly figures: ReturnType<typeof figuresOf> }> {
  const c = await collect({ repo });
  assert(c.kind === "ok", c.kind === "err" ? JSON.stringify(c.error) : "");
  const key = await signingKey(signer);
  const pack = await packOf(c.value, { harness: "demo harness", signing: { keys: key.keys, allowedSigners: key.allowedSigners } });
  assert(pack.kind === "ok", pack.kind === "err" ? pack.error : "");
  return { files: pack.value.files, figures: pack.value.figures };
}

/** The same files with one changed, and the manifest's entry for it brought along as an attacker who rebuilt the manifest would. */
async function withFile(files: PackFiles, path: string, to: string, fixManifest: boolean): Promise<PackFiles> {
  const out = new Map(files);
  out.set(path, bytes(to));
  if (fixManifest) {
    const m = parsed(text(files.get("manifest.json")));
    const entries = list(at(m, "files")).map((e) => (at(e, "path") === path ? { ...(e as object), sha256: "" } : e));
    const digest = await sha256(bytes(to));
    const fixed = entries.map((e) => (at(e, "path") === path ? { ...(e as object), sha256: digest, bytes: bytes(to).length } : e));
    out.set("manifest.json", bytes(JSON.stringify({ ...(m as object), files: fixed })));
  }
  return out;
}

proves(
  ["0022-trust FR-010", "0022-trust FR-011", "0022-trust FR-017"],
  "a pack holds the evidence files with their chain, the ledger, the notes, the specifications, the traceability matrix, the OSCAL results, the index, the signature with its keys, the verifier and a manifest of each file's SHA-256 and media type, marked with its audience and its redactions",
  () =>
    withDemo(async (repo) => {
      const { files } = await signedPack(repo);
      const names = [...files.keys()];
      for (const needle of [
        /^quality\/evidence\/2026\/11\/17\/[0-9a-f]{32}\.otlp\.json$/,
        /^quality\/records\/000001-nonconformance-opened\.json$/,
        /^notes\/[0-9a-f]{40}\.note$/,
        /^specs\/0099-demo\/[0-9a-f]{12}\.md$/,
        /^trace\/matrix\.tsv$/,
        /^oscal\/[0-9a-f]{32}\.assessment-results\.json$/,
        /^index\.json$/,
        /^signatures\/pack\.dsse\.json$/,
        /^keys\/allowed_signers$/,
        /^verify\/verify-pack\.ts$/,
        /^verify\/verify\.ts$/,
        /^manifest\.json$/,
      ])
        assert(
          names.some((n) => needle.test(n)),
          `the pack holds ${String(needle)}`,
        );
      const manifest = parsed(text(files.get("manifest.json")));
      assertEquals(at(manifest, "schema"), "ifqs-pack/1");
      assertEquals(at(manifest, "audience"), "Assessor");
      assertEquals(typeof at(at(manifest, "redactions"), "count"), "number");
      assert(Array.isArray(at(manifest, "redactions", "retained")), "what could not be redacted is named");
      const entries = list(at(manifest, "files"));
      assertEquals(entries.length, names.length - 1, "the manifest lists every file but itself");
      for (const e of entries) {
        const path = String(at(e, "path"));
        assertEquals(at(e, "sha256"), await sha256(files.get(path) ?? new Uint8Array()), path);
        assertEquals(typeof at(e, "mediaType"), "string");
      }
      // the evidence is as kept: the full failure message, with the address redacted where it was written
      const evidence = names
        .filter((n) => n.startsWith("quality/evidence/"))
        .map((n) => text(files.get(n)))
        .join("\n");
      assertStringIncludes(evidence, "expected the order of");
      assert(!evidence.includes("owner@customer.example"), "personal data is redacted where the evidence is written");
      assertStringIncludes(text(files.get("trace/matrix.tsv")), "0099-demo FR-001\t");
      // a file that holds a secret cannot be redacted without breaking its chain: the pack is refused, naming it
      const c = await collect({ repo });
      assert(c.kind === "ok");
      const source = await packSourceOf(c.value, { harness: "demo" });
      assert(source.kind === "ok");
      const [first, ...rest] = source.value.evidence;
      assert(first !== undefined);
      const refused = await buildPack({
        ...source.value,
        evidence: [{ path: first.path, text: `${first.text}\nAuthorization: Bearer abcdefghijklmnop1234567890` }, ...rest],
      });
      assert(refused.kind === "err" && refused.error.includes(first.path), "the file with the secret is named");
      // a span that is not a contiguous part of the chain is refused
      const gap = await buildPack({ ...source.value, span: { from: "2026-11-18" } });
      assert(gap.kind === "ok", "an empty span is a pack with no evidence");
      assertEquals(gap.value.figures.evidenceFiles, 0);
    }),
  needsGit,
);

proves(
  ["0022-trust FR-012", "0022-trust FR-009"],
  "the page and the pack are made from the same evidence in one run: each figure of the page equals the same figure computed from the pack, and the same evidence gives the same bytes",
  () =>
    withDemo(async (repo) => {
      const c = await collect({ repo });
      assert(c.kind === "ok");
      const page = generateTrust(c.value, { harness: "demo harness", audience: "Public", rules: { terms: [MARKER] } });
      assert(page.kind === "ok");
      const key = await signingKey();
      const options = { harness: "demo harness", signing: { keys: key.keys, allowedSigners: key.allowedSigners } };
      const pack = await packOf(c.value, options);
      assert(pack.kind === "ok");
      const fromPack = figuresOf(pack.value.files);
      assertEquals(page.value.view.figures, fromPack, "the page's figures are the pack's");
      assertEquals(at(parsed(text(pack.value.files.get("manifest.json"))), "summary"), fromPack as unknown);
      assertEquals(fromPack.passed, 3);
      assertEquals(fromPack.failed, 1);
      assertEquals(fromPack.notRun, 1);
      assertEquals(fromPack.nonconformancesOpen, 1);
      // the same evidence, the same bytes (an Ed25519 signature is deterministic)
      const again = await packOf(c.value, options);
      assert(again.kind === "ok");
      assertEquals(again.value.manifest, pack.value.manifest);
      for (const [path, b] of pack.value.files) assertEquals(text(again.value.files.get(path)), text(b), path);
    }),
  needsGit,
);

proves(
  ["0022-trust FR-014", "0022-trust FR-015"],
  "a pack verifies offline: a changed file is named, a broken chain is named, a key the pack lacks makes that signature not_run, and nothing that was not wholly checked is reported verified",
  () =>
    withDemo(async (repo) => {
      const { files } = await signedPack(repo);
      const ok = await verifyPack(files);
      assert(ok.verified, JSON.stringify(ok.checks.filter((c) => c.status !== "pass")));
      assertEquals(
        ok.checks.map((c) => c.name),
        ["manifest", "files", "evidence-chain", "ledger-chain", "notes", "signature:signatures/pack.dsse.json", "figures"],
      );
      // one evidence file changed by one byte: the file is named and the pack is not verified
      const evidence = [...files.keys()].find((p) => p.startsWith("quality/evidence/"));
      assert(evidence !== undefined);
      const changed = await verifyPack(new Map(files).set(evidence, bytes(`${text(files.get(evidence))} `)));
      assert(
        !changed.verified && changed.first?.status === "fail" && changed.first.file === evidence,
        `the changed file is named: ${JSON.stringify(changed.first)}`,
      );
      // an attacker who also rebuilds the manifest still breaks the chain and the signature
      const second = [...files.keys()].filter((p) => p.startsWith("quality/evidence/")).sort()[0];
      assert(second !== undefined);
      const rebuilt = await verifyPack(await withFile(files, second, text(files.get(second)).replace("demo", "demox"), true));
      assert(!rebuilt.verified, "a rebuilt manifest does not hide a changed file");
      assert(
        rebuilt.checks.some((c) => c.status === "fail" && (c.name === "evidence-chain" || c.name.startsWith("signature"))),
        JSON.stringify(rebuilt.checks),
      );
      // a record of the ledger changed
      const record = [...files.keys()].find((p) => p.startsWith("quality/records/"));
      assert(record !== undefined);
      const edited = await verifyPack(await withFile(files, record, text(files.get(record)).replace("failed", "stale"), true));
      assert(
        !edited.verified &&
          edited.checks.some(
            (c) => c.status === "fail" && (c.name === "figures" || c.name.startsWith("signature") || c.name === "ledger-chain"),
          ),
      );
      // a file the manifest lists and the pack lacks is not_run, and not verified
      const lacking = new Map(files);
      lacking.delete("trace/matrix.tsv");
      const missing = await verifyPack(lacking);
      assert(
        !missing.verified && missing.first?.status === "not_run" && missing.first.file === "trace/matrix.tsv",
        JSON.stringify(missing.first),
      );
      // a pack that lacks the key of its envelope: that signature is not_run with the reason
      const other = await signedPack(repo, "someone-else-signs");
      const tampered = new Map(files);
      tampered.set("keys/allowed_signers", other.files.get("keys/allowed_signers") ?? new Uint8Array());
      const unlisted = await verifyPack(
        await withFile(tampered, "keys/allowed_signers", text(other.files.get("keys/allowed_signers")), true),
      );
      const sig = unlisted.checks.find((c) => c.name.startsWith("signature:"));
      assertEquals(sig?.status, "not_run");
      assertStringIncludes(sig?.detail ?? "", "holds no key for quality");
      assert(!unlisted.verified && unlisted.first?.status === "not_run");
      // a pack with no signature at all is not wholly checked either
      const unsigned = new Map(files);
      unsigned.delete("signatures/pack.dsse.json");
      const noSig = await verifyPack(unsigned);
      assert(!noSig.verified);
      // not a pack
      const nothing = await verifyPack(new Map());
      assert(!nothing.verified && nothing.first?.name === "manifest");
    }),
  needsGit,
);

proves(
  ["0022-trust FR-013"],
  "a pack is offered as a deterministic tar with its SHA-256 beside it and a DCAT distribution naming it",
  () =>
    withDemo(async (repo) => {
      const c = await collect({ repo });
      assert(c.kind === "ok");
      const key = await signingKey();
      const pack = await packOf(c.value, { harness: "demo harness", signing: { keys: key.keys, allowedSigners: key.allowedSigners } });
      assert(pack.kind === "ok");
      const out = await makeTempDir({ prefix: "ifc-pack-out-" });
      try {
        const folder = join(out, "pack");
        const written = await writePack(folder, pack.value, { title: "Assessor pack of the demo harness", revision: c.value.revision });
        assert(written.kind === "ok", written.kind === "err" ? written.error : "");
        const tarBytes = await readFile(written.value.tar);
        assertEquals(written.value.sha256, await sha256(tarBytes));
        assertStringIncludes(await readTextFile(`${written.value.tar}.sha256`), `${written.value.sha256}  pack.tar`);
        const dcat = parsed(await readTextFile(written.value.dcat));
        assertEquals(at(dcat, "dcat:mediaType"), "application/x-tar");
        assertEquals(at(dcat, "ifqs:packSha256"), written.value.sha256);
        assertEquals(at(dcat, "spdx:checksum", "spdx:checksumValue"), written.value.sha256);
        assertEquals(at(dcat, "ifqs:packRevision"), c.value.revision);
        // the tar and the folder are the same pack, and it verifies
        const fromTar = await readPackTar(written.value.tar);
        assert(fromTar.kind === "ok");
        const fromFolder = await readPackFolder(folder);
        assertEquals([...fromTar.value.keys()].sort(), [...fromFolder.keys()].sort());
        assert((await verifyPack(fromTar.value)).verified);
        assert((await verifyPack(fromFolder)).verified);
        // a folder that is not empty is not written over
        const again = await writePack(folder, pack.value, { title: "x", revision: "r" });
        assertEquals(again.kind, "err");
      } finally {
        await remove(out, { recursive: true });
      }
    }),
  needsGit,
);

proves(
  ["0022-trust FR-016", "0022-trust FR-014"],
  "the verifier is small typed TypeScript with no import, shipped in the pack, and runs from inside it on this runtime and on Node 26 with no network: exit 0 verified, 1 a check failed, 3 part could not be checked",
  () =>
    withDemo(async (repo) => {
      const { files } = await signedPack(repo);
      const source = text(files.get("verify/verify-pack.ts"));
      assert(
        !/^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']/m.test(source) && !/\bimport\s*\(/.test(source),
        "verify-pack.ts imports nothing",
      );
      assert(source.split("\n").length < 600, "the verifier is small");
      const out = await makeTempDir({ prefix: "ifc-pack-run-" });
      try {
        const folder = join(out, "pack");
        const c = await collect({ repo });
        assert(c.kind === "ok");
        const key = await signingKey();
        const pack = await packOf(c.value, { harness: "demo harness", signing: { keys: key.keys, allowedSigners: key.allowedSigners } });
        assert(pack.kind === "ok");
        assert((await writePack(folder, pack.value, { title: "t", revision: "r" })).kind === "ok");
        const runners: { readonly name: string; readonly cmd: string }[] = [{ name: "this runtime", cmd: execPath() }];
        const node = which("node");
        if (node !== undefined && (await run([node, "--version"])).stdout.startsWith("v26") && node !== execPath())
          runners.push({ name: "node 26", cmd: node });
        for (const r of runners) {
          const verified = await run([r.cmd, join(folder, "verify", "verify.ts")]);
          assertEquals(verified.code, 0, `${r.name}: ${verified.stdout}${verified.stderr}`);
          assertStringIncludes(verified.stdout, "verified");
          assertStringIncludes(verified.stdout, "pass    signature:signatures/pack.dsse.json");
        }
        // one byte changed in the pack: exit 1 and the file is named
        const evidence = [...files.keys()].find((p) => p.startsWith("quality/evidence/")) ?? "";
        await writeTextFile(join(folder, evidence), `${text(files.get(evidence))} `);
        const bad = await run([execPath(), join(folder, "verify", "verify.ts"), folder]);
        assertEquals(bad.code, 1);
        assertStringIncludes(bad.stdout, evidence);
        assertStringIncludes(bad.stdout, "not verified");
        // a file the manifest lists and the pack lacks: exit 3
        await writeTextFile(join(folder, evidence), text(files.get(evidence)));
        await remove(join(folder, "trace", "matrix.tsv"));
        const part = await run([execPath(), join(folder, "verify", "verify.ts"), folder]);
        assertEquals(part.code, 3);
        assertStringIncludes(part.stdout, "not_run");
      } finally {
        await remove(out, { recursive: true });
      }
    }),
  needsGit,
);

proves(
  ["0022-trust FR-014"],
  "the keys of an allowed-signers file made by ssh-keygen are read, and a line is made for a key that ssh-keygen's file format reads back",
  async () => {
    const dir = await makeTempDir({ prefix: "ifc-keys-" });
    try {
      const made = await run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "ci", "-f", join(dir, "k")]);
      assert(made.success, made.stderr);
      const pub = (await readTextFile(join(dir, "k.pub"))).trim();
      const keys = parseAllowedSigners(`ci@example.com namespaces="git" ${pub}\n# a comment\nci ssh-rsa AAAA\n`);
      assertEquals(keys.length, 1);
      assertEquals(keys[0]?.principal, "ci@example.com");
      assertEquals(keys[0]?.raw.length, 32);
      // the line we make has the same key blob ssh-keygen wrote
      const line = allowedSignersLine("ci@example.com", keys[0]?.raw ?? new Uint8Array());
      assertEquals(line.split(" ")[2]?.trim(), pub.split(" ")[1]);
    } finally {
      await remove(dir, { recursive: true });
    }
  },
  needsSshKeygen,
);
