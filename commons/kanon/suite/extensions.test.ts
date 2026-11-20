/**
 * Tests of the table's instances, plugins and family, and of the check of a package that extends a host (commons kanon 0001-kanon-checker FR-010, FR-011, FR-012): the fixture host `fleet` with
 * two dialects and two plugins passes, and each way an extension can break the rules is found with its own code.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  classify,
  decodeTable,
  extensionFindings,
  importFindings,
  memberPackage,
  parseInstanceName,
  parsePackageName,
  parsePluginNoun,
  roleOf,
  type SourceFile,
} from "../src/mod.ts";
import {
  ANSIBLE,
  ANSIBLE_FILES,
  ANSIBLE_TABLE,
  DEVICE,
  DEVICE_FILES,
  DEVICE_TABLE,
  DSC,
  EXT_EXPORTS,
  extensionForm,
  HOST,
  HOST_EXPORTS,
  HOST_FILES,
  HOST_FORM,
  HOST_TABLE,
  SERVER,
  SERVER_FILES,
  SERVER_TABLE,
  table,
} from "./fixtures/fleet.ts";

/** A value as plain data, so that a branded string is compared as the text it is. */
const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v ?? null));
const rules = (fs: readonly { readonly rule: string }[]): readonly string[] => fs.map((f) => f.rule);
const ext = (t: typeof ANSIBLE_TABLE, files: readonly SourceFile[]) => extensionFindings(HOST_TABLE, HOST_EXPORTS, t, files, EXT_EXPORTS);
const at = (path: string, text: string): SourceFile => ({ path, text });

function refused(form: unknown): string {
  const r = decodeTable(form);
  assert(r.kind === "err", "the table is refused");
  return r.error;
}
const withHost = (patch: Record<string, unknown>): unknown => ({ ...HOST_FORM, ...patch });

proves(["0001-kanon-checker FR-010"], "a host's table declares its family, instances and plugins, and the package of each comes from the rule", () => {
  assertEquals(
    HOST_TABLE.instances.map((i) => (i.kind === "package" ? i.package : i.folder)),
    [ANSIBLE, DSC],
  );
  assertEquals(
    HOST_TABLE.plugins.map((p) => p.package),
    [SERVER, DEVICE],
  );
  assertEquals(plain(HOST_TABLE.plugins[1]?.dependsOn), [SERVER]);
  assertEquals(ANSIBLE_TABLE.extends, HOST);
  assertEquals(decodeTable({ package: HOST, units: [{ folder: "./", own: true }] }).kind, "ok");
});

proves(["0001-kanon-checker FR-010"], "a malformed instance, plugin or family is refused with a sentence", () => {
  assertStringIncludes(refused(withHost({ family: undefined })), "naming rule");
  assertStringIncludes(refused(withHost({ family: { dialect: "{host}-x", plugin: "{host}-{name}" } })), "template");
  assertStringIncludes(refused(withHost({ family: { dialect: "{host}-{name}", plugin: "{host}-{name}" } })), "same");
  assertStringIncludes(refused(withHost({ instances: [{ name: "ansible", instanceOf: "src/nowhere/", placement: "package" }] })), "no layered unit");
  assertStringIncludes(refused(withHost({ instances: [{ name: "Bad Name", instanceOf: "src/physical/dialect/", placement: "package" }] })), "instance name");
  assertStringIncludes(refused(withHost({ instances: [{ name: "a", instanceOf: "src/physical/dialect/", placement: "folder" }] })), "instances: true");
  assertStringIncludes(
    refused(
      withHost({
        instances: [
          { name: "a", instanceOf: "src/physical/dialect/", placement: "package" },
          { name: "a", instanceOf: "src/physical/dialect/", placement: "package" },
        ],
      }),
    ),
    "twice",
  );
  assertStringIncludes(refused(withHost({ plugins: [{ noun: "dialect-x" }] })), "dialect");
  assertStringIncludes(refused(withHost({ plugins: [{ noun: "a", dependsOn: ["a"] }] })), "itself");
  assertStringIncludes(refused(withHost({ plugins: [{ noun: "a", dependsOn: ["zzz"] }] })), "no plugin");
  assertStringIncludes(
    refused(
      withHost({
        plugins: [
          { noun: "a", dependsOn: ["b"] },
          { noun: "b", dependsOn: ["a"] },
        ],
      }),
    ),
    "loop",
  );
  assertStringIncludes(refused(withHost({ family: { ...HOST_FORM.family, contract: "plugin" } })), "export subpath");
  assertStringIncludes(refused(withHost({ extends: "@x/y" })), "never both");
});

proves(["0001-kanon-checker FR-011"], "a package is read as the host, a dialect or a plugin by the family's rule, a dialect before a plugin", () => {
  const rule = HOST_TABLE.family;
  assert(rule !== undefined);
  assertEquals(classify(rule, HOST_TABLE.package, HOST)?.kind, "host");
  assertEquals(plain(classify(rule, HOST_TABLE.package, ANSIBLE)), { kind: "dialect", name: "ansible" });
  assertEquals(plain(classify(rule, HOST_TABLE.package, SERVER)), { kind: "plugin", noun: "server" });
  assertEquals(classify(rule, HOST_TABLE.package, "@other/fleet-server"), undefined);
  assertEquals(classify(rule, HOST_TABLE.package, "@intellectual-frontiers/unrelated"), undefined);
  assertEquals(roleOf(HOST_TABLE, ANSIBLE)?.kind, "dialect");
  assertEquals(roleOf(HOST_TABLE, SERVER)?.kind, "plugin");
  assertEquals(roleOf(HOST_TABLE, "@intellectual-frontiers/fleet-dialect-nope"), undefined);
});

proves(["0001-kanon-checker FR-011"], "the name a rule makes is read back as the same member, for every dialect name and plugin noun", () => {
  const rule = HOST_TABLE.family;
  assert(rule !== undefined);
  const word = fc.stringMatching(/^[a-z][a-z0-9]{0,6}(-[a-z0-9]{1,5}){0,2}$/);
  fc.assert(
    fc.property(word, (w) => {
      const n = parseInstanceName(w);
      const p = parsePluginNoun(w);
      assert(n.kind === "ok" && p.kind === "ok");
      const d = memberPackage(rule, HOST_TABLE.package, { kind: "dialect", name: n.value });
      assert(d.kind === "ok");
      assertEquals(classify(rule, HOST_TABLE.package, d.value), { kind: "dialect", name: n.value });
      const pl = memberPackage(rule, HOST_TABLE.package, { kind: "plugin", noun: p.value });
      if (w.startsWith("dialect-")) assert(pl.kind === "err");
      else {
        assert(pl.kind === "ok");
        assertEquals(classify(rule, HOST_TABLE.package, pl.value), { kind: "plugin", noun: p.value });
      }
    }),
  );
});

proves(["0001-kanon-checker FR-010", "0001-kanon-checker FR-011"], "decoding any value gives a table or a sentence and never throws", () => {
  fc.assert(
    fc.property(fc.jsonValue(), (v) => {
      const r = decodeTable(v);
      assert(r.kind === "ok" || r.error.length > 0);
    }),
  );
});

proves(["0001-kanon-checker FR-012"], "the fixture host, its two dialects and its plugins have no finding", () => {
  assertEquals(rules(importFindings(HOST_TABLE, HOST_FILES, HOST_EXPORTS)), []);
  assertEquals(rules(ext(ANSIBLE_TABLE, ANSIBLE_FILES)), []);
  assertEquals(rules(ext(SERVER_TABLE, SERVER_FILES)), []);
  assertEquals(rules(ext(DEVICE_TABLE, DEVICE_FILES)), []);
});

proves(["0001-kanon-checker FR-012"], "a dialect that imports another dialect is instances/sibling, and a plugin it does not depend on is plugins/undeclared", () => {
  const dsc = at("src/mod.ts", `import { a } from "${DSC}";\nexport const x = a;\n`);
  assertEquals(rules(ext(ANSIBLE_TABLE, [dsc])), ["instances/sibling"]);
  const plugin = at("src/mod.ts", `import { s } from "${SERVER}";\nexport const x = s;\n`);
  assertEquals(rules(ext(ANSIBLE_TABLE, [plugin])), ["plugins/undeclared"]);
});

proves(["0001-kanon-checker FR-012"], "a plugin imports another plugin only through a declared dependency, and a dialect never", () => {
  const device = at("src/mod.ts", `import { contract } from "${HOST}/plugin";\nimport { d } from "${DEVICE}";\n`);
  assertEquals(rules(ext(SERVER_TABLE, [device])), ["plugins/undeclared"]);
  assertEquals(rules(ext(DEVICE_TABLE, DEVICE_FILES)), []);
  const dialect = at("src/mod.ts", `import { contract } from "${HOST}/plugin";\nimport { a } from "${ANSIBLE}";\n`);
  assertEquals(rules(ext(SERVER_TABLE, [dialect])), ["plugins/undeclared"]);
});

proves(["0001-kanon-checker FR-012"], "an extension reaches the host only through its exports: a path they do not name is layers/private", () => {
  const deep = at("src/mod.ts", `import { x } from "${HOST}/src/logical/mod.ts";\nimport { contract } from "${HOST}/plugin";\n`);
  assertEquals(rules(ext(SERVER_TABLE, [deep])), ["layers/private"]);
  assertEquals(rules(ext(ANSIBLE_TABLE, [at("src/mod.ts", `import { x } from "${HOST}/src/logical/mod.ts";\n`)])), ["layers/private"]);
});

proves(["0001-kanon-checker FR-012"], "a dialect reaches the layers above it and its port and no other physical unit", () => {
  const surface = table({ ...HOST_FORM, units: [...HOST_FORM.units] });
  const exportsMap = { ...HOST_EXPORTS, "./cli": "./src/physical/surfaces/cli/mod.ts" };
  const files = [at("src/mod.ts", `import { cli } from "${HOST}/cli";\n`)];
  assertEquals(rules(extensionFindings(surface, exportsMap, ANSIBLE_TABLE, files, EXT_EXPORTS)), ["layers/around"]);
  const plugin = [at("src/mod.ts", `import { cli } from "${HOST}/cli";\nimport { contract } from "${HOST}/plugin";\n`)];
  assertEquals(rules(extensionFindings(surface, exportsMap, SERVER_TABLE, plugin, EXT_EXPORTS)), []);
});

proves(["0001-kanon-checker FR-012"], "a host that imports a member of its family is plugins/inverted, in a unit and not in its own checking", () => {
  const files = [
    ...HOST_FILES,
    at("src/logical/uses.ts", `import { server } from "${SERVER}";\nimport { ansible } from "${ANSIBLE}/sub";\n`),
    at("suite/uses.test.ts", `import { server } from "${SERVER}";\n`),
  ];
  assertEquals(rules(importFindings(HOST_TABLE, files, HOST_EXPORTS)), ["plugins/inverted", "plugins/inverted"]);
});

proves(["0001-kanon-checker FR-012"], "a plugin that does not import the contract, and a host that does not export it, are plugins/contract", () => {
  const without = at("src/mod.ts", `import { l } from "${HOST}/logical";\n`);
  assertEquals(rules(ext(SERVER_TABLE, [without])), ["plugins/contract"]);
  const { "./plugin": _removed, ...noContract } = HOST_EXPORTS;
  assertEquals(rules(importFindings(HOST_TABLE, HOST_FILES, noContract)), ["plugins/contract"]);
});

proves(["0001-kanon-checker FR-012"], "a package the host does not declare, or one that extends another host, is family/name", () => {
  const stranger = table(extensionForm("@intellectual-frontiers/fleet-dialect-undeclared"));
  assertEquals(rules(ext(stranger, [at("src/mod.ts", "export const a = 1;\n")])), ["family/name"]);
  const other = table({ ...(extensionForm(ANSIBLE) as object), extends: "@intellectual-frontiers/other" });
  assertEquals(rules(ext(other, [at("src/mod.ts", "export const a = 1;\n")])), ["family/name"]);
  const plain = table({ package: ANSIBLE, units: [{ folder: "src/", layer: "physical" }] });
  assertEquals(rules(ext(plain, [at("src/mod.ts", "export const a = 1;\n")])), ["family/name"]);
});

proves(["0001-kanon-checker FR-012"], "a relative import that leaves the package is layers/relative", () => {
  const out = at("src/mod.ts", `import { a } from "${"../"}${"../"}fleet/src/logical/mod.ts";\nimport { contract } from "${HOST}/plugin";\n`);
  assertEquals(rules(ext(SERVER_TABLE, [out])), ["layers/relative"]);
});

proves(["0001-kanon-checker FR-012"], "folder instances: a sibling import is instances/sibling and a folder nobody declared is instances/undeclared", () => {
  const folders = table({
    package: "@intellectual-frontiers/x",
    family: { dialect: "{host}-dialect-{name}", plugin: "{host}-{name}" },
    units: [{ folder: "src/dialects/", layer: "physical", instances: true, mayImport: ["src/dialects/"] }],
    instances: [
      { name: "a", instanceOf: "src/dialects/", placement: "folder" },
      { name: "b", instanceOf: "src/dialects/", placement: "folder" },
    ],
  });
  const exportsMap = { "./a": "./src/dialects/a/mod.ts", "./b": "./src/dialects/b/mod.ts", "./c": "./src/dialects/c/mod.ts" };
  const files = [
    at("src/dialects/a/mod.ts", 'import { b } from "@intellectual-frontiers/x/b";\n'),
    at("src/dialects/b/mod.ts", "export const b = 1;\n"),
    at("src/dialects/c/mod.ts", "export const c = 1;\n"),
    at("src/dialects/c/more.ts", "export const d = 1;\n"),
  ];
  assertEquals(rules(importFindings(folders, files, exportsMap)), ["instances/sibling", "instances/undeclared"]);
});

proves(["0001-kanon-checker FR-012"], "every instance of a family is read as its member: a package's name comes from the rule and the table", () => {
  const p = parsePackageName(ANSIBLE);
  assert(p.kind === "ok");
  assertEquals(roleOf(HOST_TABLE, p.value)?.kind, "dialect");
});
