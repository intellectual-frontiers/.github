/**
 * Tests of the layers of Runbooks over the shared checker of Kanon (commons runbooks 0001-runbooks-layers FR-001, FR-002): the table in the manifest holds every file of the real tree with no finding, and `verify` runs every check.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { fs, path } from "@intellectual-frontiers/system";
import { library } from "../library.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

proves(["0001-runbooks-layers FR-001"], "the shared checker finds nothing in the real tree", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  assertEquals(decodeTable(library.kanon).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
});

proves(["0001-runbooks-layers FR-002"], "verify runs every check of the library", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test suite/"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-runbooks-layers FR-003"], "the library imports other libraries by package name and their allowed entries only, and never by a path out of its folder", async () => {
  const allowed: Readonly<Record<string, readonly string[]>> = {
    "@intellectual-frontiers/anyfs": ["governance"],
    "@intellectual-frontiers/grc": ["governance"],
    "@intellectual-frontiers/planning": ["governance"],
    "@intellectual-frontiers/workbench": ["governance", "logical"],
    "@intellectual-frontiers/runbooks": ["governance", "logical"],
    "@intellectual-frontiers/core": [""],
    "@intellectual-frontiers/system": [""],
  };
  const files: string[] = [];
  for (const dir of ["src", "tools"]) for await (const f of walk(path.join(ROOT, dir))) files.push(f);
  assert(files.length > 5, "the sources are read");
  for (const file of files) {
    const text = await fs.readTextFile(file);
    for (const m of text.matchAll(/from "([^"]+)"/gu)) {
      const spec = m[1] ?? "";
      if (spec.startsWith("node:") || spec.startsWith(".")) {
        assert(!spec.includes("../../../") && !(file.includes("/tools/") && spec.includes("../..") ), `${file}: ${spec}`);
        continue;
      }
      const [scope, name, ...rest] = spec.split("/");
      const pkg = `${scope}/${name}`;
      const subs = allowed[pkg];
      if (subs === undefined) {
        assert(pkg.startsWith("@intellectual-frontiers/mizan") || pkg.startsWith("@intellectual-frontiers/libraries") || pkg.startsWith("@intellectual-frontiers/test"), `${file}: ${spec} is a package the library may not import`);
        continue;
      }
      assert(subs.includes(rest.join("/")) || (rest.join("/") === "" && subs.includes("")) || pkg === "@intellectual-frontiers/core", `${file}: ${spec} is an entry the library may not import`);
    }
  }
  assert(!files.some((f) => f.endsWith(".ts") && /planning\/(logical|physical)/u.test(f)));
});

async function* walk(dir: string): AsyncGenerator<string> {
  for await (const e of fs.readDir(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory) yield* walk(p);
    else if (p.endsWith(".ts")) yield p;
  }
}

proves(["0001-runbooks-layers FR-004"], "the entries give a program the registry of verbs, the decoder and a starter runbook as values", async () => {
  const g = await import("@intellectual-frontiers/runbooks/governance");
  assert(g.VERBS.has("store.checkpoint") && g.VERBS.has("work.claim"));
  assertEquals(g.VERBS.has("rm.rf"), false);
  assertEquals(g.decodeRunbook(g.RESTORE_DRILL).kind, "ok");
  assertEquals(g.STARTERS.map((r) => r.id), ["restore-drill"]);
  const top = await import("@intellectual-frontiers/runbooks");
  assert(top.governance.VERBS.has("verb") === false && top.governance.VERBS.has("store.backup"));
});

proves(["0001-runbooks-layers FR-005"], "the manifest declares github and npm and the folder has the tool that packs it", async () => {
  assertEquals(library.distribution, ["github", "npm"]);
  assert(await fs.exists(path.join(ROOT, "tools", "pack.ts")));
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  assert((pkg.scripts["verify"] ?? "").includes("tools/pack.ts --check"));
});
