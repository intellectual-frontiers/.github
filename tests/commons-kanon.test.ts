/**
 * Kanon, the pattern of a library built in three layers (commons 0033-kanon): the import check finds each code from a table, nothing of Governance is silently dropped, a manifest may declare the
 * table and a library that does must run the check, a model is the shape of the documentation generator's layered model, and the ontology `kanon` has the ten classes and the three layers with their
 * alignment, and a host with dialects and plugins is held by the same check, the matrix and the manifests. Each rule is broken in a copy and named.
 *
 * @module
 */
import { fs, path } from "../commons/system/src/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../commons/test/src/test.ts";
import {
  buildMatrix,
  decodeTable,
  droppedFindings,
  extensionFindings,
  matrixMarkdown,
  parseInstanceName,
  type ElementId,
  importFindings,
  type LayeredModel,
  parseElementId,
} from "../commons/kanon/src/mod.ts";
import type { LayeredModel as DocsLayeredModel } from "@intellectual-frontiers/docs";
import { decodeLibrarySource, manifestFindings } from "../commons/libraries/src/libraries.ts";
import { reservationFindings } from "../commons/libraries/src/family.ts";
import { classes, layers, terms } from "../commons/ontology/src/kanon/mod.ts";

const PKG = "@intellectual-frontiers/demo";
const RAW = {
  package: PKG,
  units: [
    { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
    { folder: "src/logical/", layer: "logical" },
    { folder: "src/surfaces/", layer: "physical", instances: true },
    { folder: "src/models/", layer: "physical", instances: true, mayImport: ["src/models/"] },
    { folder: "suite/", own: true },
  ],
};
const parsedTable = decodeTable(RAW);
assert(parsedTable.kind === "ok", "the table is one");
const TABLE = parsedTable.value;
function id(text: string): ElementId {
  const r = parseElementId(text);
  assert(r.kind === "ok", text);
  return r.value;
}
const EXPORTS: Record<string, string> = {
  "./governance": "./src/governance/mod.ts",
  "./logical": "./src/logical/mod.ts",
  "./cli": "./src/surfaces/cli/mod.ts",
  "./a": "./src/models/a/mod.ts",
  "./b": "./src/models/b/mod.ts",
};
const at = (file: string, text: string) => ({ path: file, text });
const rules = (files: readonly { path: string; text: string }[]): string[] => importFindings(TABLE, files, EXPORTS).map((f) => f.rule);
/** A step up, written so that this file does not itself read as an import of a file outside the repository. */
const UP = "../";

proves(
  ["0033-kanon FR-004", "0033-kanon FR-011"],
  "a climb is layers/above and a reach around a unit is layers/around, as data from a table",
  () => {
    assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/logical";\n`)]), ["layers/above"]);
    assertEquals(rules([at("src/surfaces/cli/a.ts", `import { x } from "${PKG}/a";\n`)]), ["layers/around"]);
    assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/governance";\n`)]), []);
  },
);

proves(["0033-kanon FR-011"], "each of the other codes is found: unclassified, relative, private, external and cycle", () => {
  assertEquals(rules([at("src/loose/a.ts", "export const a = 1;\n")]), ["layers/unclassified"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${UP}surfaces/cli/run.ts";\n`)]), ["layers/relative"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/hidden";\n`)]), ["layers/private"]);
  assertEquals(rules([at("src/governance/a.ts", 'import { x } from "@intellectual-frontiers/system";\n')]), ["layers/external"]);
  assertEquals(
    rules([at("src/models/a/x.ts", `import { y } from "${PKG}/b";\n`), at("src/models/b/y.ts", `import { x } from "${PKG}/a";\n`)]),
    ["layers/cycle"],
  );
});

proves(
  ["0033-kanon FR-006"],
  "an extension reaches a library only through exports: a relative import and an import by a path exports does not name are found",
  () => {
    assertEquals(rules([at("src/models/a/x.ts", `import { y } from "${UP}b/y.ts";\n`)]), ["layers/relative"]);
    assertEquals(rules([at("src/models/a/x.ts", `import { y } from "${PKG}/src/logical/mod.ts";\n`)]), ["layers/private"]);
  },
);

function model(dispositions: LayeredModel["dispositions"]): LayeredModel {
  return {
    name: "demo",
    library: "demo",
    title: "Demo",
    summary: "A model.",
    layers: [
      { id: "governance", title: "Governance", summary: "What it is.", kinds: ["action"] },
      { id: "logical", title: "Logical", summary: "Made from it.", kinds: ["verb"] },
    ],
    elements: [
      {
        id: id("headless:demo/run"),
        layer: "governance",
        kind: "action",
        name: "run",
        definition: "Runs.",
        source: { file: "src/governance/run.ts", line: 3 },
        properties: { effect: "write" },
      },
      {
        id: id("cli:demo run"),
        layer: "logical",
        kind: "verb",
        name: "run",
        definition: "Runs.",
        source: { file: "src/logical/run.ts", line: 9 },
        properties: {},
      },
    ],
    trace: [{ from: id("headless:demo/run"), to: id("cli:demo run"), how: "projects to" }],
    findings: [],
    dispositions,
    instances: [],
  };
}

proves(["0033-kanon FR-005"], "an annotation with no end is kanon/dropped, and is not once it is named unexpressed with its reason", () => {
  const found = droppedFindings(model([]));
  assertEquals(
    found.map((f) => f.rule),
    ["kanon/dropped"],
  );
  assertStringIncludes(found[0]?.message ?? "", "effect");
  assertEquals(
    droppedFindings(model([{ element: id("headless:demo/run"), annotation: "effect", outcome: "unexpressed", reason: "no surface yet" }])),
    [],
  );
  assertEquals(
    droppedFindings(model([{ element: id("headless:demo/run"), annotation: "effect", outcome: "expressed", target: id("cli:demo run") }])),
    [],
  );
});

proves(
  ["0033-kanon FR-013"],
  "a LayeredModel is the shape of the layered model of the documentation generator, with the ids and kinds agreed",
  () => {
    const m: DocsLayeredModel = { ...model([]) };
    assertEquals(
      m.elements.map((e) => e.id),
      ["headless:demo/run", "cli:demo run"],
    );
    assertEquals(m.trace[0]?.how, "projects to");
  },
);

const MANIFEST = (kanon: string) => `export const library = {
  name: "demo",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  exports: ["."],
  ${kanon}
};
`;
const KANON_FIELD = `kanon: { package: "${PKG}", units: [{ folder: "src/governance/", layer: "governance" }, { folder: "src/logical/", layer: "logical" }] },`;

proves(["0033-kanon FR-010"], "the manifest accepts a kanon table, and refuses a unit in a fourth layer or a field of another form", () => {
  const ok = decodeLibrarySource(MANIFEST(KANON_FIELD));
  assert(ok.kind === "ok");
  assertEquals(ok.value.kanon?.units.length, 2);
  assert(decodeLibrarySource(MANIFEST("")).kind === "ok", "a library with no kanon is not Kanon, and is read");
  const fourth = decodeLibrarySource(MANIFEST(`kanon: { package: "${PKG}", units: [{ folder: "src/a/", layer: "fourth" }] },`));
  assert(fourth.kind === "err");
  assertStringIncludes(fourth.error, "kanon");
  const form = decodeLibrarySource(MANIFEST('kanon: "governance",'));
  assert(form.kind === "err");
});

/** A repository of one library, with the verify script given, and the findings of the check of its manifests. */
function manifestFindingsOf(kanon: string, verify: string): readonly string[] {
  const repo = fs.makeTempDirSync({ prefix: "kanon-repo-" });
  try {
    const dir = path.join(repo, "commons", "demo");
    fs.mkdirSync(path.join(dir, "spec-kit"), { recursive: true });
    fs.writeTextFileSync(path.join(dir, "spec-kit", "registry.tsv"), "number\tslug\tstate\n");
    fs.writeTextFileSync(path.join(dir, "library.ts"), MANIFEST(kanon));
    fs.writeTextFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "@intellectual-frontiers/demo",
        version: "0.1.0",
        exports: { ".": "./src/mod.ts" },
        scripts: { verify: `tsc -p tsconfig.json && bun ../libraries/src/check.ts --root spec-kit --level L1${verify}` },
      }),
    );
    return manifestFindings(repo);
  } finally {
    fs.removeSync(repo, { recursive: true });
  }
}

proves(
  ["0033-kanon FR-014"],
  "the check of the manifests finds a library that declares kanon and whose verify does not run the check of the table",
  () => {
    assertEquals(manifestFindingsOf("", ""), [], "a library that is not Kanon needs nothing");
    const without = manifestFindingsOf(KANON_FIELD, "");
    assertEquals(without.length, 1);
    assertStringIncludes(without[0] ?? "", "kanon");
    assertEquals(manifestFindingsOf(KANON_FIELD, " && bun ../kanon/src/check.ts"), []);
  },
);

proves(
  ["0033-kanon FR-015", "0033-kanon FR-031"],
  "the ontology kanon has the twelve classes (ten, and Relation and Bundle), the three layers with their rank and MDA viewpoint, and a record of the basis of each class",
  () => {
    const labels = classes.map((c) => c.values.label?.value);
    assertEquals(labels, ["Layer", "Element", "Projection", "Trace edge", "Surface", "Finding", "Instance", "Plugin", "Family", "Matrix", "Relation", "Bundle"]);
    assertEquals(
      Object.values(layers).map((l) => [l.values.layerRank, l.values.mdaViewpoint, l.values.dataModelingLevel]),
      [
        [1, "CIM", "conceptual"],
        [2, "PIM", "logical"],
        [3, "PSM", "physical"],
      ],
    );
    assertEquals(terms.length, 12);
    for (const t of terms) assertEquals(t.values.mappingRelation, "subClassOf");
  },
);

const HOST_PKG = "@intellectual-frontiers/fleet";
const host = decodeTable({
  package: HOST_PKG,
  family: { dialect: "{host}-dialect-{name}", plugin: "{host}-{name}", contract: "./plugin" },
  units: [
    { folder: "src/governance/", layer: "governance" },
    { folder: "src/dialect/", layer: "physical" },
  ],
  instances: [
    { name: "ansible", instanceOf: "src/dialect/", placement: "package" },
    { name: "dsc", instanceOf: "src/dialect/", placement: "package" },
  ],
  plugins: [{ noun: "server" }],
});
assert(host.kind === "ok", "the host's table is one");
const HOST_EXPORTS = { "./governance": "./src/governance/mod.ts", "./dialect": "./src/dialect/mod.ts" };
const ansible = decodeTable({ package: `${HOST_PKG}-dialect-ansible`, extends: HOST_PKG, units: [{ folder: "src/", layer: "physical" }] });
assert(ansible.kind === "ok", "the dialect's table is one");

proves(
  ["0033-kanon FR-019", "0033-kanon FR-020"],
  "an instance that imports another instance, and a host that imports its extension, are found by their codes",
  () => {
    const sibling = [{ path: "src/mod.ts", text: `import { a } from "${HOST_PKG}-dialect-dsc";\n` }];
    assertEquals(
      extensionFindings(host.value, HOST_EXPORTS, ansible.value, sibling, { ".": "./src/mod.ts" }).map((f) => f.rule),
      ["instances/sibling"],
    );
    const via = [{ path: "src/mod.ts", text: `import { g } from "${HOST_PKG}/governance";\n` }];
    assertEquals(extensionFindings(host.value, HOST_EXPORTS, ansible.value, via, { ".": "./src/mod.ts" }), []);
    const deep = [{ path: "src/mod.ts", text: `import { g } from "${HOST_PKG}/src/governance/mod.ts";\n` }];
    assertEquals(
      extensionFindings(host.value, HOST_EXPORTS, ansible.value, deep, { ".": "./src/mod.ts" }).map((f) => f.rule),
      ["layers/private"],
    );
    const inverted = [{ path: "src/governance/mod.ts", text: `import { a } from "${HOST_PKG}-dialect-ansible";\n` }];
    assertEquals(
      importFindings(host.value, inverted, HOST_EXPORTS).map((f) => f.rule),
      ["plugins/inverted", "plugins/contract"],
    );
  },
);

proves(
  ["0033-kanon FR-021"],
  "a family's rule is data: the package of a member is made from it and a noun that reads as a dialect is refused",
  () => {
    assertEquals(
      host.value.instances.map((i) => (i.kind === "package" ? String(i.package) : "")),
      [`${HOST_PKG}-dialect-ansible`, `${HOST_PKG}-dialect-dsc`],
    );
    assertEquals(
      host.value.plugins.map((p) => String(p.package)),
      [`${HOST_PKG}-server`],
    );
    const bad = decodeTable({
      package: HOST_PKG,
      family: { dialect: "{host}-dialect-{name}", plugin: "{host}-{name}" },
      units: [{ folder: "src/a/", layer: "physical" }],
      plugins: [{ noun: "dialect-x" }],
    });
    assert(bad.kind === "err");
  },
);

proves(
  ["0033-kanon FR-022", "0033-kanon FR-023"],
  "an annotation accounted for in one dialect and not the other is dropped for the other, and the matrix says so",
  () => {
    const ansibleName = parseInstanceName("ansible");
    const dscName = parseInstanceName("dsc");
    assert(ansibleName.kind === "ok" && dscName.kind === "ok");
    const base = model([
      {
        element: id("headless:demo/run"),
        annotation: "effect",
        outcome: "expressed",
        target: id("cli:demo run"),
        instance: ansibleName.value,
      },
    ]);
    const m: LayeredModel = { ...base, instances: [ansibleName.value, dscName.value] };
    const found = droppedFindings(m);
    assertEquals(found.length, 1);
    assertStringIncludes(found[0]?.message ?? "", "dsc");
    const table = matrixMarkdown(buildMatrix(m));
    assertStringIncludes(table, "| expressed (cli:demo run) | dropped |");
  },
);

proves(["0033-kanon FR-024"], "the names held for the fleet libraries are refused to a library of no family, with no folder", () => {
  assertEquals(reservationFindings([{ name: "archon-dialect-x" }]).length, 1);
  assertEquals(reservationFindings([{ name: "estate", family: { host: "estate", role: "host" } }]), []);
});
