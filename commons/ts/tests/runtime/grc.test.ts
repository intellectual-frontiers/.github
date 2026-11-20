/**
 * Tests of `runtime/grc.ts`: waivers, risks and impact declarations loaded from TOML, YAML, JSON and JSON5 files written to a temporary
 * folder (the same random waivers read back alike from each format), a generic decoder through `loadData`, and the errors, each naming the
 * file: an extension that is no format, a file that is not there, text that does not parse (with its line), and a value that does not
 * decode (with its path, a waiver with no expiry included).
 *
 * @module
 */
import fc from "fast-check";
import { object, string } from "@intellectual-frontiers/core";
import { toJson5 } from "@intellectual-frontiers/formats/json5";
import { toToml } from "@intellectual-frontiers/formats/toml";
import { toYaml } from "@intellectual-frontiers/formats/yaml";
import { withTempDir, writeTextFile } from "@intellectual-frontiers/system/fs";
import { formatLoadError, formatOf, loadData, loadImpactDeclarations, loadRisks, loadWaivers, type LoadError } from "../../runtime/grc.ts";
import { join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "../../runtime/test.ts";

const FR = "0007-grc FR-022";

const WAIVERS_TOML = `
[[waivers]]
id = "W-1"
control = "ac-2"
subjects = ["web-*", "db 1"]
reason = "legacy host retired next quarter"
approvedBy = "security-lead"
grantedAt = 2026-03-01T00:00:00Z
expiresAt = 2026-03-31T00:00:00+02:00
`;

const RISKS_YAML = `
risks:
  - id: R-1
    title: Data loss in the primary region
    likelihood: moderate
    impact: very-high
    treatment: mitigate
    owner: platform-owner
    reviewBy: "2026-06-01T00:00:00Z"
    controls: [cp-9]
  - id: R-2
    title: Vendor lock-in
    likelihood: low
    impact: moderate
    treatment: accept
    owner: cto
    reviewBy: "2026-12-01T00:00:00Z"
`;

const DECLARATIONS_JSON5 = `// which paths bear on which controls
[
  { paths: ["infra/**"], controls: ["cm-3"] },
  { paths: ["src/auth/**", "docs/é *.md"], controls: ["ia-2", "ac-2",], },
]`;

proves([FR], "waivers, risks and impact declarations load from TOML, YAML and JSON5, TOML date-times read as instants", async () => {
  await withTempDir(async (dir) => {
    const w = join(dir, "waivers.toml");
    await writeTextFile(w, WAIVERS_TOML);
    const waivers = await loadWaivers(w);
    assert(waivers.kind === "ok", waivers.kind === "err" ? formatLoadError(waivers.error) : "");
    assertEquals(waivers.value.length, 1);
    assertEquals(waivers.value[0]?.grantedAt, "2026-03-01T00:00:00.000Z");
    assertEquals(waivers.value[0]?.expiresAt, "2026-03-30T22:00:00.000Z");
    assertEquals(waivers.value[0]?.subjects, ["web-*", "db 1"]);

    const r = join(dir, "risks.YML");
    await writeTextFile(r, RISKS_YAML);
    const risks = await loadRisks(r);
    assert(risks.kind === "ok", risks.kind === "err" ? formatLoadError(risks.error) : "");
    assertEquals(
      risks.value.map((x) => [x.id, x.likelihood, x.impact, x.controls]),
      [
        ["R-1", "moderate", "very-high", ["cp-9"]],
        ["R-2", "low", "moderate", undefined],
      ],
    );

    const d = join(dir, "impact.json5");
    await writeTextFile(d, DECLARATIONS_JSON5);
    const decl = await loadImpactDeclarations(d);
    assertEquals(decl, {
      kind: "ok",
      value: [
        { paths: ["infra/**"], controls: ["cm-3"] },
        { paths: ["src/auth/**", "docs/é *.md"], controls: ["ia-2", "ac-2"] },
      ],
    });
    const j = join(dir, "impact.json");
    await writeTextFile(j, `\ufeff{"declarations": [{"paths": ["a/**"], "controls": ["x"]}]}`);
    assertEquals(await loadImpactDeclarations(j), { kind: "ok", value: [{ paths: ["a/**"], controls: ["x"] }] });
  });
});

const ROLES = ["security-lead", "cto", "platform-owner"] as const;
const DAY = 86_400_000;
const waiverArb = fc.record(
  {
    id: fc.stringMatching(/^W-[0-9]{1,4}$/),
    control: fc.stringMatching(/^[a-z]{2}-[0-9]{1,2}$/),
    subjects: fc.array(fc.string({ minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 3 }),
    reason: fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim() !== ""),
    approvedBy: fc.constantFrom(...ROLES),
    granted: fc.integer({ min: 0, max: 20_000 }),
    days: fc.integer({ min: 1, max: 400 }),
  },
  { noNullPrototype: true },
);

proves([FR], "the same waivers read back alike from TOML, YAML, JSON and JSON5 files", async () => {
  await withTempDir(async (dir) => {
    await fc.assert(
      fc.asyncProperty(fc.array(waiverArb, { minLength: 1, maxLength: 4 }), async (raw) => {
        const list = raw.map((w) => ({
          id: w.id,
          control: w.control,
          subjects: w.subjects,
          reason: w.reason,
          approvedBy: w.approvedBy,
          grantedAt: new Date(w.granted * DAY).toISOString(),
          expiresAt: new Date((w.granted + w.days) * DAY).toISOString(),
        }));
        const texts: readonly (readonly [string, string])[] = [
          ["w.toml", toToml({ waivers: list })],
          ["w.yaml", toYaml(list)],
          ["w.json", JSON.stringify({ waivers: list })],
          ["w.json5", toJson5({ waivers: list })],
        ];
        for (const [name, text] of texts) {
          const path = join(dir, name);
          await writeTextFile(path, text);
          const r = await loadWaivers(path);
          assert(r.kind === "ok", `${name}: ${r.kind === "err" ? formatLoadError(r.error) : ""}`);
          assertEquals<unknown>(r.value, list);
        }
      }),
      { numRuns: 25 },
    );
  });
});

/** The error of a load, which must fail. */
function failed<T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: LoadError }): LoadError {
  assert(r.kind === "err", "the load was expected to fail");
  return r.error;
}

proves([FR], "errors name the file and where it goes wrong: format, read, parse (line) and decode (path)", async () => {
  await withTempDir(async (dir) => {
    const txt = join(dir, "waivers.txt");
    assertEquals(failed(await loadWaivers(txt)), { kind: "format", file: txt });
    const absent = join(dir, "absent.toml");
    const read = failed(await loadWaivers(absent));
    assertEquals(read.kind, "read");
    assertStringIncludes(formatLoadError(read), absent);

    const badToml = join(dir, "bad.toml");
    await writeTextFile(badToml, `[[waivers]]\nid = "W-1"\ncontrol = \n`);
    const p = failed(await loadWaivers(badToml));
    assert(p.kind === "parse" && p.format === "toml" && p.line === 3, JSON.stringify(p));
    assertStringIncludes(formatLoadError(p), `${badToml}:3:`);

    const badJson = join(dir, "bad.json");
    await writeTextFile(badJson, `{\n  "waivers": [,]\n}`);
    const pj = failed(await loadWaivers(badJson));
    assert(pj.kind === "parse" && pj.format === "json", JSON.stringify(pj));

    const noExpiry = join(dir, "no-expiry.yaml");
    await writeTextFile(
      noExpiry,
      `waivers:\n  - id: W-9\n    control: ac-2\n    subjects: [web-1]\n    reason: r\n    approvedBy: cto\n    grantedAt: "2026-03-01T00:00:00Z"\n`,
    );
    const ne = failed(await loadWaivers(noExpiry));
    assert(ne.kind === "decode", JSON.stringify(ne));
    assertEquals(ne.error.path, "$.waivers[0]");
    assertStringIncludes(formatLoadError(ne), "W-9 has no expiry");
    assertStringIncludes(formatLoadError(ne), noExpiry);

    const badRisk = join(dir, "risks.json");
    await writeTextFile(
      badRisk,
      JSON.stringify([
        { id: "R-1", title: "t", likelihood: "low", impact: "low", treatment: "accept", owner: "cto", reviewBy: "2026-01-01T00:00:00Z" },
        {
          id: "R-2",
          title: "t",
          likelihood: "sometimes",
          impact: "low",
          treatment: "accept",
          owner: "cto",
          reviewBy: "2026-01-01T00:00:00Z",
        },
      ]),
    );
    const br = failed(await loadRisks(badRisk));
    assert(br.kind === "decode");
    assertEquals(br.error.path, "$[1].likelihood");

    const shape = join(dir, "decl.json");
    await writeTextFile(shape, `{"other": []}`);
    const sh = failed(await loadImpactDeclarations(shape));
    assert(sh.kind === "decode");
    assertEquals(sh.error.path, "$");
  });
});

proves([FR], "loadData decodes any file with the caller's decoder, by its extension's format", async () => {
  assertEquals(["a.toml", "a.yaml", "a.yml", "A.JSON", "a.json5", "a.ini", "toml"].map(formatOf), [
    "toml",
    "yaml",
    "yaml",
    "json",
    "json5",
    undefined,
    undefined,
  ]);
  await withTempDir(async (dir) => {
    const decoder = object({ name: string });
    const path = join(dir, "pack.toml");
    await writeTextFile(path, `name = "baseline"\n`);
    assertEquals(await loadData(path, decoder), { kind: "ok", value: { name: "baseline" } });
    await writeTextFile(path, `name = 3\n`);
    const e = failed(await loadData(path, decoder));
    assert(e.kind === "decode" && e.error.path === "$.name");
  });
});
