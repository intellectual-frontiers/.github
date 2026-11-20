/**
 * The lift of `commons/ts` into libraries by concern (commons 0032-lifting-libraries FR-001, FR-002, FR-003, FR-007, FR-012): the table of the map in the specification is read, and the libraries that exist
 * are held to it: named for their concern, depending only downward, importing no file outside their folder by a relative path, testing themselves in their own `suite/`, and no importer of this repository naming
 * the old path of a module that was lifted. Each rule is broken in a copy and named.
 *
 * @module
 */
import { fs, path } from "../commons/system/src/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../commons/test/src/test.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const SPEC = "commons/spec-kit/specs/0032-lifting-libraries/spec.md";
const LANGUAGES = ["ts", "js", "node", "bun", "python", "py", "deno"] as const;

type Row = { readonly layer: number; readonly name: string; readonly takes: readonly string[] };

/** The rows of the table of the map: `| layer | library | takes |`. */
export function mapOf(spec: string): readonly Row[] {
  const rows: Row[] = [];
  for (const line of spec.split("\n")) {
    const m = /^\s*\|\s*(\d)\s*\|\s*([a-z][a-z0-9-]*)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (m?.[1] === undefined || m[2] === undefined || m[3] === undefined) continue;
    rows.push({ layer: Number(m[1]), name: m[2], takes: m[3].split(",").map((t) => t.trim()) });
  }
  return rows;
}

const isDir = (p: string): boolean => fs.existsSync(p) && fs.statSync(p).isDirectory;

/** The `.ts` files under a folder, leaving out `node_modules` and `dist`. */
function tsFiles(dir: string): readonly string[] {
  const out: string[] = [];
  if (!isDir(dir)) return out;
  for (const e of fs.readDirSync(dir)) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory) out.push(...tsFiles(p));
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

const SPECIFIER = /(?:\bfrom\s+|\bimport\s+|\bimport\(\s*)["']([^"']+)["']/g;

/** What is wrong with the libraries of a repository against the table of the map, one sentence each. */
export function liftFindings(repo: string): readonly string[] {
  const found: string[] = [];
  const spec = fs.readTextFileSync(path.join(repo, SPEC));
  const map = mapOf(spec);
  const layerOf = new Map(map.map((r) => [r.name, r.layer] as const));
  const commons = path.join(repo, "commons");
  // FR-001: a library is named for its concern, and its package for its folder
  for (const name of fs
    .readDirSync(commons)
    .filter((e) => e.isDirectory)
    .map((e) => e.name)
    .sort()) {
    const dir = path.join(commons, name);
    if (!fs.existsSync(path.join(dir, "library.ts"))) continue;
    if ((LANGUAGES as readonly string[]).includes(name)) found.push(`commons/${name} is named for a language`);
    const pkg = JSON.parse(fs.readTextFileSync(path.join(dir, "package.json"))) as { name?: string };
    if (pkg.name !== `@intellectual-frontiers/${name}`)
      found.push(`commons/${name}/package.json is named ${pkg.name ?? "nothing"}, not @intellectual-frontiers/${name}`);
  }
  const lifted = map.filter((r) => fs.existsSync(path.join(commons, r.name, "library.ts")));
  for (const lib of lifted) {
    const dir = path.join(commons, lib.name);
    const pkg = JSON.parse(fs.readTextFileSync(path.join(dir, "package.json"))) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    // FR-003: dependencies are declared and run downward
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })) {
      const other = dep.replace("@intellectual-frontiers/", "");
      const layer = layerOf.get(other);
      if (dep.startsWith("@intellectual-frontiers/") && layer !== undefined && layer >= lib.layer)
        found.push(`${lib.name} (layer ${lib.layer}) depends on ${other} (layer ${layer}), which is not below it`);
    }
    // FR-003: no relative import of a file outside the folder
    for (const file of tsFiles(dir)) {
      const text = fs.readTextFileSync(file);
      for (const m of text.matchAll(SPECIFIER)) {
        const spec1 = m[1] ?? "";
        if (!spec1.startsWith(".")) continue;
        const target = path.resolve(path.dirname(file), spec1);
        if (path.relative(dir, target).startsWith(".."))
          found.push(`${path.relative(repo, file)} imports ${spec1}, a file outside commons/${lib.name}`);
      }
    }
    // FR-007: the library tests itself in its own folder
    if (!tsFiles(path.join(dir, "suite")).some((f) => f.endsWith(".test.ts"))) found.push(`commons/${lib.name} has no tests in its suite/`);
  }
  // FR-012: no importer names the old path of a module that was lifted
  const oldPaths = lifted.flatMap((lib) => lib.takes.filter((t) => /^(?:kernel|runtime)\/[a-z0-9-]+$/.test(t)).map((t) => `${t}.ts`));
  if (oldPaths.length > 0) {
    const skip = [path.join(commons, "ts", "data")];
    const scan = (dir: string): void => {
      for (const e of fs.readDirSync(dir)) {
        if (["node_modules", "dist", ".git", ".claude", "build", "out"].includes(e.name)) continue;
        const p = path.join(dir, e.name);
        if (skip.some((s) => p === s)) continue;
        if (e.isDirectory) scan(p);
        else if (e.name.endsWith(".ts")) {
          for (const m of fs.readTextFileSync(p).matchAll(SPECIFIER)) {
            const s = m[1] ?? "";
            if (s.startsWith(".") && oldPaths.some((o) => s.endsWith(`/${o}`))) {
              // the file itself must be gone: a specifier that still resolves to a file is the file of another library of that name (a kernel module never moved)
              const target = path.resolve(path.dirname(p), s);
              if (!fs.existsSync(target)) found.push(`${path.relative(repo, p)} imports ${s}, the old path of a module that was lifted`);
            }
          }
        }
      }
    };
    scan(repo);
  }
  return found;
}

proves(
  [
    "0032-lifting-libraries FR-001",
    "0032-lifting-libraries FR-002",
    "0032-lifting-libraries FR-003",
    "0032-lifting-libraries FR-007",
    "0032-lifting-libraries FR-012",
  ],
  "the libraries that exist are those of the map: named for their concern, depending only downward, importing no file outside their folder, testing themselves, and no importer names a lifted module's old path",
  () => {
    const map = mapOf(fs.readTextFileSync(path.join(ROOT, SPEC)));
    assertEquals(map.length, 16, "the map names sixteen libraries");
    assertEquals(new Set(map.map((r) => r.name)).size, 16);
    assertEquals(
      map
        .map((r) => r.layer)
        .filter((l, i, a) => a.indexOf(l) === i)
        .sort(),
      [0, 1, 2, 3, 4],
    );
    assertEquals(liftFindings(ROOT), []);
  },
);

proves(
  ["0032-lifting-libraries FR-003", "0032-lifting-libraries FR-007", "0032-lifting-libraries FR-012"],
  "each rule is broken in a copy of the files and named",
  async () => {
    const dir = await fs.makeTempDir({ prefix: "commons-lift-" });
    try {
      const put = async (rel: string, text: string): Promise<void> => {
        await fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
        await fs.writeTextFile(path.join(dir, rel), text);
      };
      await put(SPEC, ["| 0 | core | kernel/result |", "| 1 | formats | kernel/json5 |", "| 1 | crypto | kernel/sha256 |", ""].join("\n"));
      const lib = async (name: string, deps: Record<string, string>): Promise<void> => {
        await put(`commons/${name}/library.ts`, "export const library = {};\n");
        await put(`commons/${name}/package.json`, JSON.stringify({ name: `@intellectual-frontiers/${name}`, dependencies: deps }));
      };
      await lib("core", { "@intellectual-frontiers/formats": "1.0.0" });
      await lib("formats", { "@intellectual-frontiers/crypto": "1.0.0" });
      await lib("crypto", {});
      await put("commons/core/src/mod.ts", 'import { x } from "../../ts/kernel/x.ts";\nexport { x };\n');
      await put("commons/formats/suite/a.test.ts", "export {};\n");
      // the old path of a lifted module, written so that this file does not name it
      const old = (from: string): string => `import { r } from "${from}/kernel/${"res" + "ult"}.ts";\nexport { r };\n`;
      await put("commons/crypto/src/a.ts", old("../../ts"));
      await put("commons/ts/other.ts", old("."));
      const found = liftFindings(dir).join("\n");
      assertStringIncludes(found, "core (layer 0) depends on formats (layer 1), which is not below it");
      assertStringIncludes(found, "formats (layer 1) depends on crypto (layer 1), which is not below it");
      assertStringIncludes(found, "commons/core has no tests in its suite/");
      assertStringIncludes(found, "commons/core/src/mod.ts imports ../../ts/kernel/x.ts, a file outside commons/core");
      assertStringIncludes(found, `commons/ts/other.ts imports ./kernel/${"res" + "ult"}.ts, the old path of a module that was lifted`);
      assert(!found.includes("commons/formats has no tests"), found);
      await lib("python", {});
      assertStringIncludes(liftFindings(dir).join("\n"), "commons/python is named for a language");
    } finally {
      await fs.remove(dir, { recursive: true });
    }
  },
);
