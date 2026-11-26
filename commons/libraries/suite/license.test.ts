/**
 * The license of the repository (commons 0035-licensing): the official text is the one its standard records, every `LICENSE` is made from it and the required notice, the check writes nothing and names a missing or
 * edited file and the command that writes it, the hand-written files hold the facts they exist for, the record of what is vendored is held to the repository, and the real repository has no finding.
 *
 * @module
 */
import { decodeLibrarySource } from "../src/libraries.ts";
import { COMMAND, judge, licenseFileText, licenseOf, main, officialText, REQUIRED_NOTICE, sentence, thirdPartyNotices } from "../src/license.ts";
import { DEFAULT_LICENSE, LICENSE_STANDARDS, parseSpdxId, SPDX_IDS } from "../src/license/standard.ts";
import { THIRD_PARTY } from "../src/license/third-party.ts";
import { existsSync, mkdirSync, readTextFileSync, removeSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const SPEC = "0035-licensing";
const ROOT = resolve(fromFileUrl(new URL("../../..", import.meta.url)));
const read = (p: string): string => readTextFileSync(join(ROOT, p));
const manifest = (extra = ""): string => `export const library = { name: "alpha", verify: "bun run verify", version: "0.1.0", exports: ["."], ${extra} };\n`;

/** A small repository: one library, the hand-written files with the facts they need and the vendored files the record names. */
function fixture(dir: string, files: Readonly<Record<string, string>> = {}): void {
  const all: Record<string, string> = {
    "commons/alpha/library.ts": manifest(),
    "LICENSING.md": `${DEFAULT_LICENSE} https://github.com/intellectual-frontiers/.github/issues\n`,
    "COMMERCIAL.md": "commercial\n",
    NOTICE: "Copyright Intellectual Frontiers LLC\n",
    "CONTRIBUTING.md": "git commit -s\n",
    "CITATION.cff": `license: ${DEFAULT_LICENSE}\n`,
    "README.md": `# x\n\n## License\n\n${DEFAULT_LICENSE}\n`,
    "package.json": `{ "license": "${DEFAULT_LICENSE}" }\n`,
    ...Object.fromEntries(THIRD_PARTY.flatMap((i) => (i.path === undefined ? [] : [[i.path, "x\n"] as const]))),
    ...files,
  };
  for (const [p, t] of Object.entries(all)) {
    mkdirSync(join(dir, p, ".."), { recursive: true });
    writeTextFileSync(join(dir, p), t);
  }
}
const paths = async (dir: string): Promise<readonly string[]> => (await judge(dir)).findings.map(sentence);

proves([`${SPEC} FR-001`, `${SPEC} FR-003`], "the default is the PolyForm Noncommercial license, a manifest's license is one of the closed list and another is refused naming it", () => {
  assertEquals(DEFAULT_LICENSE, "PolyForm-Noncommercial-1.0.0");
  assertEquals(licenseOf(undefined), DEFAULT_LICENSE);
  const ok = decodeLibrarySource(manifest('license: "PolyForm-Noncommercial-1.0.0",'));
  assert(ok.kind === "ok" && ok.value.license === "PolyForm-Noncommercial-1.0.0");
  const none = decodeLibrarySource(manifest());
  assert(none.kind === "ok" && none.value.license === undefined && licenseOf(none.value) === DEFAULT_LICENSE);
  const bad = decodeLibrarySource(manifest('license: "MIT",'));
  assert(bad.kind === "err");
  assertStringIncludes(bad.error, "MIT");
  assertEquals(parseSpdxId("Apache-2.0").kind, "err");
  assertEquals(SPDX_IDS.length, Object.keys(LICENSE_STANDARDS).length);
});

proves([`${SPEC} FR-002`, `${SPEC} FR-004`], "the official text is the one its standard records, a changed text is refused naming both hashes, and a LICENSE is the notice and the text unchanged", async () => {
  const real = await officialText(DEFAULT_LICENSE);
  assert(real.kind === "ok");
  assertStringIncludes(real.value, "# PolyForm Noncommercial License 1.0.0");
  const std = LICENSE_STANDARDS[DEFAULT_LICENSE];
  assertStringIncludes(std.location, "polyformproject/polyform-licenses/1.0.0/");
  await withTempDir(async (dir) => {
    writeTextFileSync(join(dir, std.file), real.value.replace("Acceptance", "Acceptence"));
    const r = await officialText(DEFAULT_LICENSE, dir);
    assert(r.kind === "err" && r.error.kind === "text-changed");
    assertStringIncludes(sentence(r.error), std.sha256);
    const gone = await officialText(DEFAULT_LICENSE, join(dir, "nowhere"));
    assert(gone.kind === "err" && gone.error.kind === "text-missing");
  });
  const file = licenseFileText(real.value);
  assert(file.startsWith(`${REQUIRED_NOTICE}\n\n# PolyForm Noncommercial License 1.0.0`));
  assert(file.endsWith(real.value));
  assertEquals(REQUIRED_NOTICE, "Required Notice: Copyright Intellectual Frontiers LLC (https://github.com/intellectual-frontiers/.github)");
});

proves(
  [`${SPEC} FR-005`, `${SPEC} FR-006`],
  "--check writes nothing and exits 1 naming a library with no LICENSE and the command, the generator writes every LICENSE, and a hand edit is found",
  async () => {
    await withTempDir(async (dir) => {
      fixture(dir);
      const found = await paths(dir);
      assert(found.some((l) => l.startsWith("commons/alpha/LICENSE is missing") && l.includes(COMMAND)), found.join("\n"));
      assert(found.some((l) => l.startsWith("LICENSE is missing")));
      assertEquals(await main(["--check", "--repo", dir]), 1);
      assert(!existsSync(join(dir, "LICENSE")) && !existsSync(join(dir, "commons/alpha/LICENSE")));
      assertEquals(await main(["--repo", dir]), 0);
      assertEquals((await paths(dir)), []);
      assertEquals(readTextFileSync(join(dir, "commons/alpha/LICENSE")), readTextFileSync(join(dir, "LICENSE")));
      writeTextFileSync(join(dir, "commons/alpha/LICENSE"), "MIT License\n");
      assertStringIncludes((await paths(dir)).join("\n"), "commons/alpha/LICENSE is not what the official text");
      assertEquals(await main(["--check", "--repo", dir]), 1);
      assertEquals(await main(["--repo", dir]), 0);
      assertEquals(await paths(dir), []);
      // CRLF line ends are the same file
      writeTextFileSync(join(dir, "LICENSE"), readTextFileSync(join(dir, "LICENSE")).replaceAll("\n", "\r\n"));
      assertEquals(await paths(dir), []);
    });
  },
);

proves([`${SPEC} FR-008`, `${SPEC} FR-009`, `${SPEC} FR-011`], "a missing hand-written file and one that lacks its facts are found", async () => {
  await withTempDir(async (dir) => {
    fixture(dir);
    await main(["--repo", dir]);
    assertEquals(await paths(dir), []);
    writeTextFileSync(join(dir, "NOTICE"), "nothing\n");
    writeTextFileSync(join(dir, "CONTRIBUTING.md"), "no sign-off\n");
    writeTextFileSync(join(dir, "LICENSING.md"), "words\n");
    writeTextFileSync(join(dir, "README.md"), "# x\n\n## License\n\nMIT\n");
    writeTextFileSync(join(dir, "package.json"), "{}\n");
    const text = (await paths(dir)).join("\n");
    for (const w of ["NOTICE does not", "CONTRIBUTING.md does not", "LICENSING.md does not name", "LICENSING.md does not say where", "README.md does not have a License section", "package.json does not declare"])
      assertStringIncludes(text, w);
    for (const f of ["COMMERCIAL.md", "CITATION.cff"]) {
      writeTextFileSync(join(dir, f), "");
      assertStringIncludes((await paths(dir)).join("\n"), `${f} is missing`);
    }
  });
});

proves([`${SPEC} FR-010`], "THIRD_PARTY_NOTICES.md is what the record makes, says unverified where it was not checked, and a vendored path that is gone is found", async () => {
  const t = thirdPartyNotices(THIRD_PARTY);
  assertEquals(read("THIRD_PARTY_NOTICES.md").replaceAll("\r\n", "\n"), t); // a Windows checkout may hold the file with CRLF line ends
  assertStringIncludes(t, "unverified:");
  for (const i of THIRD_PARTY) assertStringIncludes(t, i.license);
  await withTempDir(async (dir) => {
    fixture(dir);
    await main(["--repo", dir]);
    assertEquals(await paths(dir), []);
    removeSync(join(dir, "commons/libraries/src/workflows/schema/github-workflow.schema.json"));
    const gone = await paths(dir);
    assertEquals(gone.length, 1);
    assertStringIncludes(gone.join("\n"), "github-workflow.schema.json is named as vendored");
  });
});

proves([`${SPEC} FR-001`, `${SPEC} FR-005`, `${SPEC} FR-007`, `${SPEC} FR-011`], "the real repository has no finding, no LICENSE is the MIT license, and the README and AGENTS.md name the license and the command", async () => {
  assertEquals((await judge(ROOT)).findings.map(sentence), []);
  for (const l of (await import("../src/libraries.ts")).readLibraries(ROOT)) {
    if ("problem" in l) continue;
    assert(read(`commons/${l.dir}/LICENSE`).includes("PolyForm Noncommercial License 1.0.0"), l.dir);
    assert(!read(`commons/${l.dir}/LICENSE`).includes("MIT License"), l.dir);
  }
  assertStringIncludes(read("AGENTS.md"), COMMAND);
  assertStringIncludes(read("AGENTS.md"), DEFAULT_LICENSE);
  assertStringIncludes(read("package.json"), `"license": "${DEFAULT_LICENSE}"`);
  const contributing = read("CONTRIBUTING.md");
  for (const w of ["git commit -s", "Refs #N", "commercial licenses"]) assertStringIncludes(contributing, w);
  for (const f of ["NOTICE", "LICENSING.md", "CONTRIBUTING.md"]) for (const n of ["Mizan", "Kanon", "Desired OS State"]) assertStringIncludes(read(f), n);
  assertStringIncludes(read("COMMERCIAL.md"), "TO BE COMPLETED BY THE OWNER");
});
