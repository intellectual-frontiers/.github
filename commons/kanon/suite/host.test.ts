/**
 * Tests of the host side of Kanon (commons kanon 0001-kanon-checker FR-007): a library's table, `exports` and files are read from a folder, and the command judges the findings against a baseline
 * of keys that only shrinks (exit 0, 1 and 2). Each folder is a real temporary folder.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs } from "@intellectual-frontiers/system";
import { run } from "../src/check.ts";
import { BASELINE, findings, readExports, readSources, readTable } from "../src/host.ts";

const PKG = "@intellectual-frontiers/demo";

function unwrap<T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: string }): T {
  assert(r.kind === "ok");
  return r.value;
}

/** A library of a table with Governance and Logical, whose Governance imports Logical (a climb), with the files given. */
function library(manifest: string, files: Readonly<Record<string, string>>): string {
  const root = fs.makeTempDirSync({ prefix: "kanon-" });
  fs.writeTextFileSync(`${root}/library.ts`, manifest);
  fs.writeTextFileSync(
    `${root}/package.json`,
    JSON.stringify({ name: PKG, exports: { ".": "./src/mod.ts", "./logical": "./src/logical/mod.ts" } }),
  );
  for (const [name, text] of Object.entries(files)) {
    const dir = name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : "";
    if (dir !== "") fs.mkdirSync(`${root}/${dir}`, { recursive: true });
    fs.writeTextFileSync(`${root}/${name}`, text);
  }
  return root;
}

const MANIFEST = `export const library = {
  name: "demo",
  kanon: {
    package: "${PKG}",
    units: [
      { folder: "./", own: true },
      { folder: "src/", layer: "logical" },
      { folder: "src/governance/", layer: "governance" },
      { folder: "src/logical/", layer: "logical" },
    ],
  },
};
`;
const FILES = {
  "src/mod.ts": "export const a = 1;\n",
  "src/governance/mod.ts": `import { x } from "${PKG}/logical";\nexport const g = x;\n`,
  "src/logical/mod.ts": "export const x = 1;\n",
  "node_modules/skip/index.ts": "export const skipped = 1;\n",
  "spec-kit/skip.ts": "export const skipped = 1;\n",
};

proves(
  ["0001-kanon-checker FR-007"],
  "the table, the exports and the files are read from a library's folder, leaving out node_modules and the spec kit",
  () => {
    const root = library(MANIFEST, FILES);
    try {
      const t = readTable(root);
      assert(t.kind === "ok");
      assertEquals(t.value.package, PKG);
      assertEquals(Object.keys(unwrap(readExports(root))), [".", "./logical"]);
      assertEquals(
        unwrap(readSources(root)).map((f) => f.path),
        ["library.ts", "src/governance/mod.ts", "src/logical/mod.ts", "src/mod.ts"],
      );
      const f = findings(root);
      assert(f.kind === "ok");
      assertEquals(
        f.value.map((x) => x.rule),
        ["layers/above"],
      );
    } finally {
      fs.removeSync(root, { recursive: true });
    }
  },
);

proves(["0001-kanon-checker FR-007"], "a manifest with no table, or a table that is not one, exits 2", () => {
  const none = library('export const library = { name: "demo" };\n', {});
  const bad = library(
    'export const library = { name: "demo", kanon: { package: "x", units: [{ folder: "a/", layer: "middle" }] } };\n',
    {},
  );
  try {
    assertEquals(run(none, []).code, 2);
    const r = run(bad, []);
    assertEquals(r.code, 2);
    assertStringIncludes(r.lines.join("\n"), "units[0]");
  } finally {
    fs.removeSync(none, { recursive: true });
    fs.removeSync(bad, { recursive: true });
  }
});

proves(
  ["0001-kanon-checker FR-007"],
  "the command exits 1 on a new finding, 0 where it is held, and 1 on a held line that no longer occurs",
  () => {
    const root = library(MANIFEST, FILES);
    try {
      const fresh = run(root, []);
      assertEquals(fresh.code, 1);
      assertStringIncludes(fresh.lines.join("\n"), "layers/above");
      assertEquals(run(root, ["--write-baseline"]).code, 0);
      assertEquals(run(root, []).code, 0);
      fs.writeTextFileSync(`${root}/src/governance/mod.ts`, "export const g = 1;\n");
      const stale = run(root, []);
      assertEquals(stale.code, 1);
      assertStringIncludes(stale.lines.join("\n"), `${BASELINE}: stale`);
    } finally {
      fs.removeSync(root, { recursive: true });
    }
  },
);

proves(["0001-kanon-checker FR-007", "0001-kanon-checker FR-009"], "a package that is not JSON, and a folder that is not there, are values and not throws", () => {
  const root = library(MANIFEST, FILES);
  try {
    fs.writeTextFileSync(`${root}/package.json`, "{ not json");
    assertEquals(readExports(root).kind, "err");
    assertEquals(findings(root).kind, "err");
    assertEquals(readSources(`${root}/nowhere`).kind, "err");
  } finally {
    fs.removeSync(root, { recursive: true });
  }
});

proves(["0001-kanon-checker FR-007", "0001-kanon-checker FR-009"], "the host reads through a port: a record of functions that a test can give", () => {
  const files = {
    exists: (p: string) => p === "/lib/library.ts",
    readDir: () => [],
    readText: () => MANIFEST,
  };
  const t = readTable("/lib", files);
  assert(t.kind === "ok");
  assertEquals(readTable("/other", files).kind, "err");
});
