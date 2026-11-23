/**
 * Tests of the host side of Kanon (commons kanon 0001-kanon-checker FR-007): a library's table, `exports` and files are read from a folder, and the command judges the findings against a baseline
 * of keys that only shrinks (exit 0, 1 and 2). Each folder is a real temporary folder.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs } from "@intellectual-frontiers/system";
import { run, runBundle } from "../src/check.ts";
import { BASELINE, findings, readBundle, readExports, readSources, readTable } from "../src/host.ts";
import { makeBundle, verifyBundle } from "../src/mod.ts";

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

proves(["0001-kanon-checker FR-007"], "the manifest reader uses the real export and rejects executable initializers", () => {
  const fake = 'export const library = { kanon: {} };';
  const good = library(`// ${fake}\nconst sample = '${fake}';\n${MANIFEST}`, {});
  const expression = library(MANIFEST.replace("};", "} || makeLibrary();"), {});
  try {
    assertEquals(unwrap(readTable(good)).package, PKG);
    assertEquals(readTable(expression).kind, "err");
  } finally {
    fs.removeSync(good, { recursive: true });
    fs.removeSync(expression, { recursive: true });
  }
});

proves(["0001-kanon-checker FR-003", "0001-kanon-checker FR-007"], "a syntax error fails the command despite a baseline", () => {
  const root = library(MANIFEST, { "src/mod.ts": "const broken = ;" });
  const baseline = "layers/syntax src/mod.ts\n";
  try {
    fs.writeTextFileSync(`${root}/${BASELINE}`, baseline);
    for (const args of [[], ["--write-baseline"]]) {
      const outcome = run(root, args);
      assertEquals(outcome.code, 1);
      assertStringIncludes(outcome.lines.join("\n"), "src/mod.ts:1: layers/syntax");
      assertEquals(fs.readTextFileSync(`${root}/${BASELINE}`), baseline);
    }
  } finally {
    fs.removeSync(root, { recursive: true });
  }
});

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

proves(["0002-kanon-content-checks FR-011"], "a folder is read as a bundle, nothing is written, and an extra file in it is found", async () => {
  const dir = fs.makeTempDirSync({ prefix: "kanon-bundle-" });
  const bundle = await makeBundle({ name: "e", library: "e", title: "E", summary: "E.", layers: [], elements: [], trace: [], findings: [], dispositions: [], instances: [] });
  for (const [name, text] of bundle.files) fs.writeTextFileSync(`${dir}/${name}`, text);
  fs.writeTextFileSync(`${dir}/manifest.json`, bundle.manifest);
  const before = [...fs.readDirSync(dir)].map((e) => e.name).sort();
  const read = unwrap(readBundle(dir));
  assertEquals([...read.files.keys()], ["dispositions.json", "elements.json", "model.json", "relations.json", "trace.json"]);
  assertEquals([...fs.readDirSync(dir)].map((e) => e.name).sort(), before, "reading writes nothing");
  assertEquals((await verifyBundle(read)).kind, "ok");
  assertEquals((await runBundle(dir)).code, 0);
  fs.mkdirSync(`${dir}/sub`, { recursive: true });
  fs.writeTextFileSync(`${dir}/sub/extra.txt`, "x");
  const again = await verifyBundle(unwrap(readBundle(dir)));
  assert(again.kind === "err" && again.error[0]?.kind === "extra" && again.error[0].path === "sub/extra.txt");
  assertEquals(readBundle(`${dir}/absent`).kind, "err");
  assertEquals((await runBundle(dir)).code, 2);
});

proves(["0027-commons-libraries FR-026", "0033-kanon FR-035"], "a folder of a library inside a host's folder is an extension read as its own library, and the host's sources do not include it", () => {
  const root = library(MANIFEST, { "src/mod.ts": "export const a = 1;\n", "ext/library.ts": "export const library = {};\n", "ext/src/mod.ts": "export const b = 1;\n" });
  try {
    const paths = unwrap(readSources(root)).map((f) => f.path);
    assert(paths.includes("src/mod.ts"));
    assert(!paths.some((p) => p.startsWith("ext/")), `the extension's files are the host's: ${paths.join(", ")}`);
  } finally {
    fs.removeSync(root, { recursive: true });
  }
});
