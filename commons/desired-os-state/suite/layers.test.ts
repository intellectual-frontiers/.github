/**
 * Tests of the layers of Desired OS State over the shared checker of Kanon (commons desired-os-state 0001-desired-os-state-layers FR-001 to FR-005): the table in the manifest holds every file of the real tree with no
 * finding, the same table finds each way an import can break it, the package exports what the specification says, `verify` runs every check and the release record agrees with the package.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable, importFindings, unitOf, type Table } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { fs, path } from "@intellectual-frontiers/system";
import { library } from "../library.ts";
import { release } from "../release.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const EXPORTS: Record<string, string> = {
  ".": "./src/mod.ts",
  "./governance": "./src/governance/mod.ts",
  "./logical": "./src/logical/mod.ts",
  "./dialect": "./src/physical/dialect/mod.ts",
  "./cli": "./src/physical/cli/mod.ts",
};
const PKG = "@intellectual-frontiers/desired-os-state";
const at = (path: string, text: string) => ({ path, text });

function table(): Table {
  const t = decodeTable(library.kanon);
  if (t.kind === "err") throw new Error(t.error);
  return t.value;
}
const rules = (files: readonly { path: string; text: string }[]): string[] => importFindings(table(), files, EXPORTS).map((f) => f.rule);

proves(["0001-desired-os-state-layers FR-001", "0001-desired-os-state-layers FR-002"], "the shared checker finds nothing in the real tree", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
  assertEquals(unitOf(table(), "src/governance/ids.ts")?.name, "src/governance/");
  assertEquals(unitOf(table(), "src/physical/dialect/types.ts")?.name, "src/physical/dialect/");
});

proves(["0001-desired-os-state-layers FR-001"], "a file in no unit is layers/unclassified", () => {
  assertEquals(rules([at("lib/x.ts", "export {};\n")]), ["layers/unclassified"]);
});

proves(["0001-desired-os-state-layers FR-002"], "below may not import above, a unit reaches another through exports, and each unit imports only what its row allows", () => {
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/logical";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/dialect";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/physical/dialect/a.ts", `import { x } from "${PKG}/logical";\n`)]), []);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "../governance/ids.ts";\n`)]), ["layers/relative"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/internal";\n`)]), ["layers/private"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "@intellectual-frontiers/crypto/sha256";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "node:fs";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/logical/a.ts", `import { sha256 } from "@intellectual-frontiers/crypto/sha256";\n`)]), []);
  assertEquals(rules([at("src/physical/dialect/a.ts", `import { planOf } from "@intellectual-frontiers/headless/logical";\n`)]), []);
  assertEquals(rules([at("src/physical/dialect/a.ts", `import { run } from "@intellectual-frontiers/headless/cli";\n`)]), ["layers/external"]);
  assertEquals(rules([at("suite/a.test.ts", `import { x } from "../src/logical/mod.ts";\n`)]), []);
});

proves(["0001-desired-os-state-layers FR-003"], "the package exports the library, its layers and the dialect port", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { name: string; version: string; exports: Record<string, string> };
  assertEquals(pkg.exports, EXPORTS);
  assertEquals(pkg.name, `@intellectual-frontiers/${library.name}`);
  assertEquals(pkg.version, library.version);
  assertEquals(Object.keys(pkg.exports), [...library.exports]);
  assertEquals(table().package, pkg.name);
});

proves(["0001-desired-os-state-layers FR-004"], "verify runs the compiler, the specification checks, the layers check, the trace check, the tests and the check of the package", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test ./suite/", "bun tools/pack.ts --check"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-desired-os-state-layers FR-005"], "the release record agrees with the manifest and the package", async () => {
  assertEquals(release.slug, library.name);
  assertEquals(release.version, library.version);
  assertEquals(release.kind, "Software");
  assertEquals(library.distribution, ["github", "npm"]);
});

/** The files of a folder, below it, as paths relative to it, without the folders that are not source. */
async function filesUnder(root: string, from = ""): Promise<string[]> {
  const out: string[] = [];
  for await (const entry of fs.readDir(path.join(root, from))) {
    if (["node_modules", "dist", "artifacts", ".git"].includes(entry.name)) continue;
    const rel = from === "" ? entry.name : `${from}/${entry.name}`;
    if (entry.isDirectory) out.push(...(await filesUnder(root, rel)));
    else out.push(rel);
  }
  return out;
}

proves(["0001-desired-os-state-layers FR-006", "0006-desired-os-state-on-workload FR-001"], "Desired OS State depends on workload and workload imports nothing of Desired OS State, in its sources, its manifest or its tests", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { devDependencies: Record<string, string> };
  assertEquals(pkg.devDependencies["@intellectual-frontiers/workload"], "link:../workload");
  const logical = table().units.find((u) => u.folder === "src/logical/");
  assert(logical !== undefined && "packages" in logical && logical.packages.some((p) => p.name === "@intellectual-frontiers/workload"), "the logical unit may import workload");
  const workload = path.resolve(ROOT, "..", "workload");
  const files = (await filesUnder(workload)).filter((f) => /\.(ts|json|md|tsv)$/u.test(f) && !f.startsWith("spec-kit/") && f !== "bun.lock");
  assert(files.length > 100, "the tree of workload is read");
  const found: string[] = [];
  for (const f of files) {
    const text = await fs.readTextFile(path.join(workload, f));
    if (/@intellectual-frontiers\/desired-os-state|commons\/desired-os-state/u.test(text)) found.push(f);
  }
  assertEquals(found, []);
});

proves(["0006-desired-os-state-on-workload FR-010", "0006-desired-os-state-on-workload FR-011", "0004-desired-os-state-dialects FR-008"], "the plan and approvals of Desired OS State, its converge plugin and its first-boot dialect are gone", async () => {
  for (const gone of ["src/logical/plan.ts", "src/logical/approvals.ts", "converge", "dialect-cloud-init", "dialect-boot"]) assertEquals(await fs.stat(path.join(ROOT, gone)).then(() => true, () => false), false, gone);
  const plugins = (library.kanon.plugins ?? []).map((p) => p.noun);
  assertEquals(plugins, ["tool", "dns"]);
  assert(!library.kanon.instances.some((i) => /cloud-init|boot/u.test(i.name)));
});
