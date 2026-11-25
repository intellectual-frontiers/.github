/**
 * Tests of the canaries of the secret scanner (commons repoctl 0016-repoctl-canaries FR-001 to FR-008): the pins of a configuration are one file each by its exact path and digest; the scanner finds each canary of the library Test with the
 * rule the canary declares, refuses the same text in a file that is not a canary file and a canary file with one changed byte, and lets the real module of canaries pass as a note that fails nothing; in real repositories a commit of a canary file
 * succeeds with the finding and a commit of the same file edited is refused. This file holds no text that looks like a secret: every one is a canary imported from the library Test.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { CANARIES, canaryText } from "@intellectual-frontiers/test/canaries";
import { fs, path } from "@intellectual-frontiers/system";
import { type CommitPolicy, DEFAULT_ALLOWED_PATHS, DEFAULT_FORBIDDEN_PATHS, DEFAULT_SECRET_PATTERNS, isProblemCode, CATALOGUE, parseConfig } from "@intellectual-frontiers/repoctl/governance";
import { canaryOf, canarySection, digestOf, secretLike } from "@intellectual-frontiers/repoctl/logical";
import { loadConfigFile, systemFiles } from "@intellectual-frontiers/repoctl/physical";
import { CAN_RUN, CHECKOUT, configInput, execute, git, hostOf, put, withRepo } from "./world.ts";

const RULES: CommitPolicy["forbidden"] = { paths: DEFAULT_FORBIDDEN_PATHS, allow: DEFAULT_ALLOWED_PATHS, secrets: DEFAULT_SECRET_PATTERNS, canaries: [] };
const SHA = "a".repeat(64);
const SESSION = "https://claude.ai/code/session_test";
const BASE = configInput().commit;

/** The text of a file made only of canaries. */
const FILE = CANARIES.map((c) => `export const ${c.id.replaceAll("-", "_")} = ${JSON.stringify(c.text)};`).join("\n") + "\n";
const PATH = "fixtures/canaries.ts";
const pinned = (text: string): CommitPolicy["forbidden"] => ({ ...RULES, canaries: [{ path: PATH, sha256: digestOf(text) }] });
const withPin = (sha256: string, p = PATH) => configInput({ commit: { ...BASE, forbidden: { canaries: [{ path: p, sha256 }] } } });

proves(["0016-repoctl-canaries FR-001"], "a configuration pins a canary file by one exact path and a digest, and is refused with every reason where it does not", () => {
  assertEquals(parseConfig(configInput()).kind, "ok");
  assertEquals(parseConfig(withPin(SHA)).kind, "ok");
  const why = (r: ReturnType<typeof parseConfig>): string => (r.kind === "err" ? r.error.join("; ") : "");
  assertStringIncludes(why(parseConfig(withPin("xyz"))), "64 lower-case hexadecimal digits");
  assertStringIncludes(why(parseConfig(withPin(SHA.toUpperCase()))), "sha256");
  for (const glob of ["*.ts", "a/**/b.ts", "a/[b].ts", "{a,b}.ts", "/abs.ts", "../up.ts", ""]) assertStringIncludes(why(parseConfig(withPin(SHA, glob))), "canaries", glob);
  const twice = parseConfig(configInput({ commit: { ...BASE, forbidden: { canaries: [{ path: PATH, sha256: SHA }, { path: PATH, sha256: SHA }] } } }));
  assertStringIncludes(why(twice), "pinned twice");
  const missing = parseConfig(configInput({ commit: { ...BASE, forbidden: { canaries: [{ path: PATH } as { path: string; sha256: string }] } } }));
  assertStringIncludes(why(missing), "never allowed by its path alone");
});

proves(["0016-repoctl-canaries FR-002", "0016-repoctl-canaries FR-008"], "every canary of the library Test is found by the scanner with its declared rule, and carries CANARY", () => {
  assert(CANARIES.length >= DEFAULT_SECRET_PATTERNS.length - 1, "a canary for each rule of the scanner");
  for (const c of CANARIES) {
    assertStringIncludes(c.text, "CANARY");
    assertEquals(secretLike(RULES, `a line before\n${c.text}\na line after`), c.rule, c.id);
  }
  for (const rule of DEFAULT_SECRET_PATTERNS) assert(CANARIES.some((c) => c.rule === rule.label), `a canary for ${rule.label}`);
});

proves(["0016-repoctl-canaries FR-002", "0016-repoctl-canaries FR-008"], "the text of a canary is a canary file only at the pinned path with the pinned digest: elsewhere and with one changed byte it is refused", () => {
  const policy = pinned(FILE);
  assertEquals(canaryOf(policy, PATH, FILE).kind, "canary");
  assertEquals(canaryOf(RULES, PATH, FILE).kind, "ordinary", "the same text with no pin");
  assertEquals(canaryOf(policy, "fixtures/other.ts", FILE).kind, "ordinary", "the same text at another path");
  assertEquals(canaryOf(policy, PATH, `${FILE} `).kind, "changed", "a byte added");
  assertEquals(canaryOf(policy, PATH, FILE.replace("CANARY", "CANARX")).kind, "changed", "a byte changed");
  assertEquals(canaryOf(policy, PATH, `${FILE}// a note\n`).kind, "changed", "a line added");
  assertEquals(canaryOf(policy, PATH, "nothing to see\n").kind, "clean");
  for (const c of CANARIES) {
    const one = `${c.text}\n`;
    assertEquals(canaryOf(pinned(one), PATH, one), { kind: "canary", rule: c.rule }, c.id);
    assertEquals(canaryOf(RULES, "x.ts", one), { kind: "ordinary", rule: c.rule }, c.id);
    assertEquals(canaryOf(pinned(one), PATH, `${one}x`), { kind: "changed", rule: c.rule }, c.id);
  }
});

proves(["0016-repoctl-canaries FR-007", "0016-repoctl-canaries FR-008"], "the one pin of this repository is the module of canaries, whose digest is the pinned one, and the scanner lets it pass", async () => {
  const loaded = await loadConfigFile(path.join(CHECKOUT, "repoctl.config.ts"));
  assert(loaded.kind === "ok", loaded.kind === "err" ? loaded.error.message : "");
  const policy = loaded.value.config.commit.forbidden;
  assertEquals(policy.canaries.map((k) => k.path), ["commons/test/src/canaries.ts"]);
  assertEquals(policy.secrets, DEFAULT_SECRET_PATTERNS);
  assertEquals(policy.paths, DEFAULT_FORBIDDEN_PATHS);
  assertEquals(policy.allow, DEFAULT_ALLOWED_PATHS);
  const text = fs.readTextFileSync(path.join(CHECKOUT, "commons/test/src/canaries.ts"));
  const held = canaryOf(policy, "commons/test/src/canaries.ts", text);
  assertEquals(held.kind, "canary", "the module of canaries has the pinned digest: pin the new one after an edit");
  assertEquals(canaryOf(policy, "commons/test/src/canaries.ts", `${text}\n`).kind, "changed");
  assertEquals(canaryOf(policy, "commons/test/suite/canaries.test.ts", text).kind, "ordinary", "the same text in another file");
  const section = await canarySection({ files: systemFiles, repo: CHECKOUT }, policy);
  assertEquals(section.findings.map((f) => [f.code, f.level]), [["E-CANARY", "info"]]);
});

proves(["0016-repoctl-canaries FR-003", "0016-repoctl-canaries FR-004"], "in a real repository the commit of a canary file is made with the finding, and the commit of the same file edited is refused", async () => {
  if (!CAN_RUN) return;
  await withRepo([], async (dir, world) => {
    await git(dir, "config", "user.name", "Someone Else");
    await git(dir, "config", "user.email", "someone@example.test");
    await put(dir, "README.md", "start\n");
    await git(dir, "add", "README.md");
    await git(dir, "commit", "-q", "-m", "Start");
    const host = hostOf(world, { config: withPin(digestOf(FILE)) });
    const args = ["commit", "-m", "Add the canaries", "--session", SESSION] as const;
    await put(dir, PATH, FILE);
    await put(dir, "fixtures/copy.ts", FILE);
    const copy = await execute(host, [...args, "fixtures/copy.ts"]);
    assertEquals(copy.code, 1, "the same text in a file that is not pinned");
    assertStringIncludes(copy.err, "fixtures/copy.ts holds what looks like");
    await git(dir, "reset", "-q");
    const preview = await execute(host, [...args, "--dry-run", PATH]);
    assertEquals(preview.code, 0, preview.err);
    assertStringIncludes(preview.out + preview.err, "E-CANARY");
    const made = await execute(host, [...args, PATH]);
    assertEquals(made.code, 0, made.err);
    assertStringIncludes(made.out + made.err, "E-CANARY");
    assertEquals((await git(dir, "log", "--oneline")).trim().split("\n").length, 2, "the commit was made");
    await put(dir, PATH, `${FILE}// one more line\n`);
    const edited = await execute(host, [...args, PATH]);
    assertEquals(edited.code, 1);
    assertStringIncludes(edited.err, "E-COMMIT-FORBIDDEN");
    assertStringIncludes(edited.err, "not the pinned one");
    assertEquals((await git(dir, "log", "--oneline")).trim().split("\n").length, 2, "no second commit");
  });
});

proves(["0016-repoctl-canaries FR-004", "0016-repoctl-canaries FR-005"], "repoctl check has the section of the canaries: a note where the digest is the pinned one, a failure where it is not or the file is missing, and a note ends with 0", async () => {
  if (!CAN_RUN) return;
  const run = async (dir: string, world: Parameters<typeof hostOf>[0], sha: string, p = PATH) => {
    await git(dir, "status", "--short");
    return await execute(hostOf(world, { config: withPin(sha, p) }), ["check", "--json"]);
  };
  await withRepo([], async (dir, world) => {
    await put(dir, PATH, FILE);
    const good = JSON.parse((await run(dir, world, digestOf(FILE))).out) as { data: { sections: { id: string; findings: { code: string; level: string }[] }[] } };
    const section = good.data.sections.find((s) => s.id === "canaries");
    assertEquals(section?.findings.map((f) => [f.code, f.level]), [["E-CANARY", "info"]]);
    const stale = await run(dir, world, SHA);
    assertEquals(stale.code, 1);
    assertStringIncludes(stale.out + stale.err, "E-CANARY-CHANGED");
    const gone = await run(dir, world, SHA, "fixtures/gone.ts");
    assertStringIncludes(gone.out + gone.err, "is not there");
  });
});

proves(["0016-repoctl-canaries FR-006"], "repoctl explain explains both codes", async () => {
  for (const code of ["E-CANARY", "E-CANARY-CHANGED"]) {
    assert(isProblemCode(code));
    const e = CATALOGUE[code];
    assert(e.title !== "" && e.what !== "" && e.why !== "" && e.fix !== "", code);
    if (CAN_RUN) {
      await withRepo([], async (_dir, world) => {
        const r = await execute(hostOf(world), ["explain", code]);
        assertEquals(r.code, 0, r.err);
        assertStringIncludes(r.out, e.title);
      });
    }
  }
  assertStringIncludes(canaryText("openssh-private-key"), "CANARY");
});
