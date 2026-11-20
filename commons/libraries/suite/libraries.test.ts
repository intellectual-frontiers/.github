/**
 * The manifest of a library of commons (commons 0027-commons-libraries FR-011 to FR-014): the decoder reads `library.ts` as data, the check finds where a manifest and its folder disagree, and the
 * generator makes the section "The libraries" and its rows of the register from the manifests. The real repository must have no finding and nothing stale; every rule is broken in a temporary folder
 * of real files and named.
 *
 * @module
 */
import {
  decodeLibrarySource,
  FIRST_GENERATED,
  generated,
  idsFor,
  idsIn,
  LIBRARY_FILE,
  manifestFindings,
  readLibraries,
  rowOf,
  synchronize,
} from "../src/libraries.ts";
import { mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const SPEC = "0027-commons-libraries";
const ROOT = resolve(fromFileUrl(new URL("../../..", import.meta.url)));

const manifest = (o: Readonly<Record<string, unknown>> = {}): string =>
  `export const library = ${JSON.stringify({ name: "alpha", level: "L1", specKit: "spec-kit", verify: "bun run verify", version: "0.2.0", exports: ["./a", "./b"], ...o })};\n`;

proves(
  [`${SPEC} FR-012`],
  "a manifest is read as data: its fields, L1 where it declares no level, and an error that names what is wrong",
  () => {
    const ok = decodeLibrarySource(manifest({ summary: "It does a thing." }));
    assert(ok.kind === "ok");
    assertEquals(
      [ok.value.name, ok.value.level, ok.value.specKit, ok.value.version, ok.value.exports],
      ["alpha", "L1", "spec-kit", "0.2.0", ["./a", "./b"]],
    );
    const plain = decodeLibrarySource('export const library = { name: "b", verify: "bun run verify", version: "1.0.0", exports: [] };\n');
    assert(plain.kind === "ok" && plain.value.level === "L1" && plain.value.specKit === undefined);
    const l0 = decodeLibrarySource(manifest({ level: "L0", specKit: undefined }));
    assert(l0.kind === "ok" && l0.value.level === "L0");
    for (const [text, says] of [
      [manifest({ level: "L9" }), "level"],
      [manifest({ owner: "me" }), "library.owner is an unknown field"],
      [manifest({ name: "Not Lower" }), "name"],
      [manifest({ exports: "./a" }), "exports"],
      ['export const library = { name: "a", verify: "x", version: "1", exports: [] };\nexport const other = 1;\n', "exports only library"],
      ["export const library = makeIt();\n", "not a literal"],
    ] as const) {
      const r = decodeLibrarySource(text);
      assert(r.kind === "err", text);
      assertStringIncludes(r.error, says);
    }
  },
);

/** A repository with one library `alpha` that a manifest and a package describe, and a specification of the libraries with its markers. */
async function repo(
  f: (root: string) => void | Promise<void>,
  edit: (o: Record<string, unknown>) => void = () => undefined,
): Promise<void> {
  await withTempDir(async (root) => {
    mkdirSync(join(root, "commons", "alpha", "spec-kit"), { recursive: true });
    writeTextFileSync(join(root, "commons", "alpha", "spec-kit", "registry.tsv"), "number\tslug\tstate\n");
    writeTextFileSync(join(root, "commons", "alpha", LIBRARY_FILE), manifest());
    const pkg: Record<string, unknown> = {
      name: "@intellectual-frontiers/alpha",
      version: "0.2.0",
      exports: { "./a": "./a.ts", "./b": "./b.ts" },
      scripts: { verify: "tsc && bun ../libraries/src/check.ts --root spec-kit --level L1 && bun test" },
    };
    edit(pkg);
    writeTextFileSync(join(root, "commons", "alpha", "package.json"), JSON.stringify(pkg));
    mkdirSync(join(root, "commons", "spec-kit", "specs", SPEC), { recursive: true });
    writeTextFileSync(
      join(root, "commons", "spec-kit", "specs", SPEC, "spec.md"),
      `## The libraries\n\nSee \`<!-- libraries:begin -->\` in a sentence.\n\n<!-- libraries:begin -->\n\n<!-- libraries:end -->\n\n## Out of scope\n`,
    );
    writeTextFileSync(
      join(root, "commons", "spec-kit", "enforcement.tsv"),
      `requirement\tmechanism\tby\tnote\n${SPEC} FR-001\tcheck\t.github: bun test ./tests/\tx\n`,
    );
    await f(root);
  });
}

proves(
  [`${SPEC} FR-015`, `${SPEC} FR-016`, `${SPEC} FR-017`, `${SPEC} FR-018`],
  "a library is published to GitHub and, where a decision says so, to npm as well: the default, the refusals, and the registries in the requirement",
  () => {
    const plain = decodeLibrarySource(manifest());
    assert(plain.kind === "ok");
    assertEquals(plain.value.distribution, ["github"]);
    const both = decodeLibrarySource(manifest({ distribution: ["github", "npm"] }));
    assert(both.kind === "ok");
    assertEquals(both.value.distribution, ["github", "npm"]);
    for (const [bad, needle] of [
      [{ distribution: ["npm"] }, "includes github"],
      [{ distribution: [] }, "at least one"],
      [{ distribution: ["github", "github"] }, "once"],
      [{ distribution: ["github", "registry.example.com"] }, "distribution"],
    ] as const) {
      const r = decodeLibrarySource(manifest(bad));
      assert(r.kind === "err", `refused: ${JSON.stringify(bad)}`);
      assertStringIncludes(r.error, needle);
    }
    const text = generated("x\n<!-- libraries:begin -->\n\n<!-- libraries:end -->\ny\n", "", [both.value]);
    assert(text.kind === "ok");
    assertStringIncludes(text.value.spec, "published to the GitHub package registry and npm, proved by");
  },
);

proves(
  [`${SPEC} FR-013`, "0028-conformance-levels FR-013"],
  "a manifest that agrees with its folder and package has no finding, and each disagreement is named",
  async () => {
    await repo((root) => assertEquals(manifestFindings(root), []));
    const cases: readonly (readonly [string, (o: Record<string, unknown>) => void, string])[] = [
      ["the package is named otherwise", (o) => void (o["name"] = "alpha"), "is not named @intellectual-frontiers/alpha"],
      ["the version differs", (o) => void (o["version"] = "0.3.0"), "the manifest says version 0.2.0 and the package says 0.3.0"],
      ["an export is missing", (o) => void (o["exports"] = { "./a": "./a.ts" }), "./b is not the package's"],
      [
        "an export is extra",
        (o) => void (o["exports"] = { "./a": "./a.ts", "./b": "./b.ts", "./c": "./c.ts" }),
        "./c is not the manifest's",
      ],
      ["verify is no script", (o) => void (o["scripts"] = { check: "tsc" }), 'the verify command "bun run verify" is not a script'],
      [
        "verify runs the check at L3",
        (o) => void (o["scripts"] = { verify: "bun ../libraries/src/check.ts --root spec-kit" }),
        "does not run the Mizan check with --level L1",
      ],
    ];
    for (const [what, edit, says] of cases) await repo((root) => assertStringIncludes(manifestFindings(root).join("\n"), says, what), edit);
    await repo((root) => {
      writeTextFileSync(join(root, "commons", "alpha", LIBRARY_FILE), manifest({ name: "beta" }));
      assertStringIncludes(manifestFindings(root).join("\n"), "is named beta, and its folder is alpha");
      writeTextFileSync(join(root, "commons", "alpha", LIBRARY_FILE), manifest({ specKit: "nowhere" }));
      assertStringIncludes(manifestFindings(root).join("\n"), "the spec kit nowhere the manifest names has no registry.tsv");
      writeTextFileSync(join(root, "commons", "alpha", LIBRARY_FILE), manifest({ specKit: undefined }));
      assertStringIncludes(manifestFindings(root).join("\n"), "declares L1 and no spec kit");
    });
  },
);

proves(
  [`${SPEC} FR-008`, `${SPEC} FR-012`],
  "a folder with a spec kit and no manifest is found, a manifest that cannot be read is found, and an L0 library needs no spec kit",
  async () => {
    await repo((root) => {
      mkdirSync(join(root, "commons", "gamma", "spec-kit"), { recursive: true });
      assertStringIncludes(manifestFindings(root).join("\n"), "commons/gamma has a spec kit and no library.ts");
      mkdirSync(join(root, "commons", "delta"), { recursive: true });
      writeTextFileSync(join(root, "commons", "delta", LIBRARY_FILE), 'export const library = { name: "delta" };\n');
      assertStringIncludes(manifestFindings(root).join("\n"), "commons/delta/library.ts:");
    });
    await withTempDir((root) => {
      mkdirSync(join(root, "commons", "zero"), { recursive: true });
      writeTextFileSync(
        join(root, "commons", "zero", LIBRARY_FILE),
        manifest({ name: "zero", level: "L0", specKit: undefined, exports: [] }),
      );
      writeTextFileSync(
        join(root, "commons", "zero", "package.json"),
        JSON.stringify({ name: "@intellectual-frontiers/zero", version: "0.2.0", scripts: { verify: "true" } }),
      );
      assertEquals(manifestFindings(root), []);
      assertEquals(readLibraries(root).length, 1);
      return Promise.resolve();
    });
  },
);

proves(
  [`${SPEC} FR-011`, `${SPEC} FR-014`],
  "the section and its rows are made from the manifests, keep a library's number, number a new one after the greatest and are written again byte for byte",
  async () => {
    await repo((root) => {
      const first = synchronize(root, false);
      assertEquals(first.problems, []);
      assertEquals(first.stale.length, 2);
      synchronize(root, true);
      assertEquals(synchronize(root, false), { stale: [], problems: [] });
      const spec = readTextFileSync(join(root, "commons", "spec-kit", "specs", SPEC, "spec.md"));
      assertStringIncludes(spec, `- **FR-${FIRST_GENERATED}**: \`commons/alpha\` MUST be a library at conformance level L1 (\`mz:Core\`)`);
      assertStringIncludes(spec, "See `<!-- libraries:begin -->` in a sentence.");
      const enforcement = readTextFileSync(join(root, "commons", "spec-kit", "enforcement.tsv"));
      assertStringIncludes(enforcement, `${SPEC} FR-${FIRST_GENERATED}\tcheck\t.github: cd commons/alpha && bun run verify\t`);
      // registering a library: a folder with a manifest and the generator
      mkdirSync(join(root, "commons", "aardvark"), { recursive: true });
      writeTextFileSync(
        join(root, "commons", "aardvark", LIBRARY_FILE),
        manifest({ name: "aardvark", level: "L0", specKit: undefined, exports: [] }),
      );
      writeTextFileSync(
        join(root, "commons", "aardvark", "package.json"),
        JSON.stringify({ name: "@intellectual-frontiers/aardvark", version: "0.2.0", scripts: { verify: "true" } }),
      );
      assertEquals(synchronize(root, false).stale.length, 2);
      synchronize(root, true);
      const after = readTextFileSync(join(root, "commons", "spec-kit", "specs", SPEC, "spec.md"));
      assertStringIncludes(after, `- **FR-${FIRST_GENERATED}**: \`commons/alpha\``);
      assertStringIncludes(
        after,
        `- **FR-${FIRST_GENERATED + 1}**: \`commons/aardvark\` MUST be a library at conformance level L0 (\`mz:Registered\`)`,
      );
      assertEquals(idsIn(after).get("aardvark"), `FR-${FIRST_GENERATED + 1}`);
      // a hand edit of the section is named, and written over
      writeTextFileSync(join(root, "commons", "spec-kit", "specs", SPEC, "spec.md"), after.replace("MUST be a library", "MUST be a thing"));
      assertEquals(synchronize(root, false).stale, [`commons/spec-kit/specs/${SPEC}/spec.md`]);
      // a specification with no markers is an error, never an empty section
      writeTextFileSync(join(root, "commons", "spec-kit", "specs", SPEC, "spec.md"), "## The libraries\n");
      assertStringIncludes(synchronize(root, false).problems.join("\n"), "has no <!-- libraries:begin -->");
    });
    const lib = { name: "a", level: "L1" as const, verify: "bun run verify", version: "1", exports: [], distribution: ["github" as const] };
    const libs = [lib];
    assertEquals([...idsFor(libs, new Map()).values()], [`FR-${FIRST_GENERATED}`]);
    assertEquals([...idsFor(libs, new Map([["a", "FR-150"]])).values()], ["FR-150"]);
    assertStringIncludes(rowOf("FR-101", lib), "commons/a: the verify of the library");
    assertEquals(generated("no markers", "", libs).kind, "err");
  },
);

proves(
  [`${SPEC} FR-008`, `${SPEC} FR-011`, `${SPEC} FR-013`],
  "this repository's manifests agree with their folders, and its section and rows are what they make",
  () => {
    assertEquals(manifestFindings(ROOT), []);
    assertEquals(synchronize(ROOT, false), { stale: [], problems: [] });
    assert(readLibraries(ROOT).some((l) => l.dir === "data" && "library" in l && l.library.level === "L1"));
  },
);

proves(
  [`${SPEC} FR-011`],
  "a checkout with CRLF line ends (a Windows one) finds the markers and the section as it does with LF: the files made are stale only by their text, never by their line ends",
  async () => {
    await repo((root) => {
      assertEquals(synchronize(root, true).problems, []);
      assertEquals(synchronize(root, false), { stale: [], problems: [] });
      for (const file of [
        join(root, "commons", "spec-kit", "specs", SPEC, "spec.md"),
        join(root, "commons", "spec-kit", "enforcement.tsv"),
      ]) {
        writeTextFileSync(file, readTextFileSync(file).replace(/\n/g, "\r\n"));
      }
      assertEquals(synchronize(root, false), { stale: [], problems: [] });
    });
  },
);
