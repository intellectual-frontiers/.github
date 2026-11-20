/**
 * The packages of commons (commons 0032-lifting-libraries FR-005, FR-006, FR-013): every library whose distribution includes npm is packed by its own `tools/pack.ts`, its tarball is inspected (the files, the
 * published `package.json`, each entry's `types` and the declarations it reaches), installed under the `node_modules` of an empty project, imported by Node (no hook) and by Bun, and a consumer of every entry is
 * type-checked against it by the TypeScript 7 compiler under `moduleResolution: nodenext`. The inspection's refusals are each shown on a package made to fail.
 *
 * @module
 */
import { fs, path, proc } from "../commons/ts/runtime/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../commons/ts/runtime/test.ts";
import { inspectPackage } from "../commons/ts/tools/pack-library.ts";
import { readLibraries } from "../commons/ts/mizan/libraries.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const TSC = path.join(ROOT, "commons", "ts", "node_modules", "typescript", "bin", "tsc");

type Json = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Json => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : {});

/** The libraries of this repository that are published to npm and pack themselves. */
function npmLibraries(): readonly { readonly name: string; readonly dir: string }[] {
  const out: { name: string; dir: string }[] = [];
  for (const f of readLibraries(ROOT)) {
    if ("problem" in f) continue;
    if (!f.library.distribution.includes("npm")) continue;
    const dir = path.join(ROOT, "commons", f.library.name);
    if (fs.existsSync(path.join(dir, "tools", "pack.ts"))) out.push({ name: f.library.name, dir });
  }
  return out;
}

async function sh(argv: readonly string[], cwd: string): Promise<{ readonly code: number; readonly out: string }> {
  const r = await proc.run(argv, { cwd });
  return { code: r.code, out: `${r.stdout}${r.stderr}` };
}

proves(
  ["0032-lifting-libraries FR-005", "0032-lifting-libraries FR-006", "0032-lifting-libraries FR-013"],
  "the tarball of every library published to npm is inspected, installed, imported by Node with no hook and by Bun, and a consumer of every entry is type-checked against it",
  async () => {
    const bun = proc.which("bun") ?? "bun";
    const node = proc.which("node");
    const tmp = await fs.makeTempDir({ prefix: "commons-packages-" });
    try {
      const project = path.join(tmp, "project");
      await fs.mkdir(path.join(project, "node_modules"), { recursive: true });
      await fs.writeTextFile(path.join(project, "package.json"), '{ "name": "consumer", "private": true, "type": "module" }\n');
      const published: { name: string; manifest: Json }[] = [];
      for (const lib of npmLibraries()) {
        let installLog = "";
        // a library packs from its own installed tools (the compiler, the links to the libraries it depends on): a job that has not installed it does so, as a person's first `bun run verify` does
        // (an install of a folder that links to it leaves a `node_modules` of its own behind, so the compiler is what says the tools are there)
        if (!fs.existsSync(path.join(lib.dir, "node_modules", "typescript"))) {
          const installed = await sh([bun, "install", "--frozen-lockfile"], lib.dir);
          assertEquals(installed.code, 0, `${lib.name}: bun install: ${installed.out}`);
          installLog = installed.out;
        }
        // a `link:` dependency that the install left unlinked is linked as the install does (a folder of this repository, next to the library)
        const own = obj(JSON.parse(await fs.readTextFile(path.join(lib.dir, "package.json"))));
        for (const [dep, spec] of [...Object.entries(obj(own["dependencies"])), ...Object.entries(obj(own["devDependencies"]))]) {
          if (typeof spec !== "string" || !spec.startsWith("link:")) continue;
          const at = path.join(lib.dir, "node_modules", ...dep.split("/"));
          if (fs.existsSync(at)) continue;
          await fs.mkdir(path.dirname(at), { recursive: true });
          await fs.symlink(path.resolve(lib.dir, spec.slice("link:".length)), at);
        }
        const scope = path.join(lib.dir, "node_modules", "@intellectual-frontiers");
        const packed = await sh([bun, "tools/pack.ts"], lib.dir);
        assertEquals(
          packed.code,
          0,
          `${lib.name}: ${packed.out.slice(0, 1500)}\n(install: ${installLog.slice(0, 600)}; ${path.join(lib.dir, "node_modules")} holds ${
            fs.existsSync(scope)
              ? fs
                  .readDirSync(scope)
                  .map((e) => e.name)
                  .join(", ")
              : "no scope"
          })`,
        );
        // the packer prints the path of the tarball (the bundlers of the commands print what `bun pm pack` says besides)
        const tarball = (packed.out.match(/\S+\.tgz/g) ?? []).at(-1) ?? "";
        assert(tarball.endsWith(".tgz") && fs.existsSync(tarball), `${lib.name}: no tarball in ${packed.out}`);
        const manifestText = await sh(["tar", "-xzOf", tarball, "package/package.json"], lib.dir);
        assertEquals(manifestText.code, 0, manifestText.out);
        const manifest = obj(JSON.parse(manifestText.out));
        const name = String(manifest["name"]);
        const into = path.join(project, "node_modules", ...name.split("/"));
        await fs.mkdir(into, { recursive: true });
        const unpacked = await sh(["tar", "-xzf", tarball, "-C", into, "--strip-components=1"], lib.dir);
        assertEquals(unpacked.code, 0, unpacked.out);
        // the inspection of the tarball as it is installed
        assertEquals(inspectPackage(into), [], `${name}: the inspection of the tarball`);
        // a package of commons depends only on packages of commons that are in this project, and on none that is not on npm
        for (const dep of Object.keys(obj(manifest["dependencies"]))) {
          assert(dep.startsWith("@intellectual-frontiers/"), `${name} depends on ${dep}, which this test does not install`);
        }
        published.push({ name, manifest });
      }
      assert(published.length > 0, "no library is published to npm");
      // each library depends on libraries of this repository that were packed too
      for (const p of published) {
        for (const dep of Object.keys(obj(p.manifest["dependencies"]))) {
          assert(
            published.some((q) => q.name === dep),
            `${p.name} depends on ${dep}, which is not packed here`,
          );
        }
      }
      // the entries of every package, imported
      const entries = published.flatMap((p) =>
        Object.keys(obj(p.manifest["exports"])).map((k) => `${p.name}${k === "." ? "" : k.slice(1)}`),
      );
      if (entries.length > 0) {
        await fs.writeTextFile(
          path.join(project, "use.mjs"),
          `${entries.map((e, i) => `const m${i} = await import(${JSON.stringify(e)}); if (typeof m${i} !== "object") throw new Error(${JSON.stringify(e)});`).join("\n")}\nconsole.log("imported ${entries.length}");\n`,
        );
        if (node !== undefined) {
          const onNode = await sh([node, "use.mjs"], project);
          assertEquals(onNode.code, 0, `Node: ${onNode.out}`);
          assertStringIncludes(onNode.out, `imported ${entries.length}`);
        }
        const onBun = await sh([bun, "use.mjs"], project);
        assertEquals(onBun.code, 0, `Bun: ${onBun.out}`);
        assertStringIncludes(onBun.out, `imported ${entries.length}`);
        // a consumer of every entry, type-checked: each module is real (not `any`) and its declarations resolve
        await fs.writeTextFile(
          path.join(project, "consumer.ts"),
          [
            "type NotAny<T> = 0 extends 1 & T ? never : T;",
            ...entries.map((e, i) => `import * as e${i} from ${JSON.stringify(e)};\nexport const c${i}: NotAny<typeof e${i}> = e${i};`),
            "",
          ].join("\n"),
        );
        await fs.writeTextFile(
          path.join(project, "tsconfig.json"),
          JSON.stringify(
            {
              compilerOptions: {
                module: "nodenext",
                moduleResolution: "nodenext",
                target: "es2024",
                lib: ["es2024", "dom"],
                strict: true,
                noEmit: true,
                skipLibCheck: false,
                types: [],
              },
              include: ["consumer.ts"],
            },
            null,
            2,
          ),
        );
        const typed = await sh([node ?? bun, TSC, "-p", "tsconfig.json"], project);
        assertEquals(typed.code, 0, `tsc: ${typed.out}`);
      }
    } finally {
      await fs.remove(tmp, { recursive: true });
    }
  },
  { timeout: 600_000 },
);

proves(
  ["0032-lifting-libraries FR-013"],
  "a package with an entry that names no types, a declaration that is not there or one that imports a package it does not depend on is refused, and one that is whole is not",
  async () => {
    const dir = await fs.makeTempDir({ prefix: "commons-inspect-" });
    try {
      const make = async (name: string, manifest: Json, files: Readonly<Record<string, string>>): Promise<string> => {
        const root = path.join(dir, name);
        await fs.mkdir(root, { recursive: true });
        await fs.writeTextFile(path.join(root, "package.json"), JSON.stringify(manifest));
        for (const [f, text] of Object.entries(files)) {
          await fs.mkdir(path.dirname(path.join(root, f)), { recursive: true });
          await fs.writeTextFile(path.join(root, f), text);
        }
        return root;
      };
      const base = { name: "@x/lib", version: "1.0.0" };
      const whole = await make(
        "whole",
        { ...base, exports: { ".": { types: "./dist/a.d.ts", default: "./dist/a.js" } } },
        {
          "dist/a.d.ts": 'export type A = number;\nexport * from "./b.js";\n',
          "dist/b.d.ts": "export type B = string;\n",
          "dist/a.js": "export {};\n",
          "dist/b.js": "export {};\n",
        },
      );
      assertEquals(inspectPackage(whole), []);
      const noTypes = await make("no-types", { ...base, exports: { ".": "./dist/a.js" } }, { "dist/a.js": "export {};\n" });
      assertStringIncludes(inspectPackage(noTypes).join("\n"), "names no `types` file");
      const missing = await make(
        "missing",
        { ...base, exports: { ".": { types: "./dist/a.d.ts", default: "./dist/a.js" } } },
        { "dist/a.js": "export {};\n" },
      );
      assertStringIncludes(inspectPackage(missing).join("\n"), "dist/a.d.ts, which is not in the package");
      const unreached = await make(
        "unreached-import",
        { ...base, exports: { ".": { types: "./dist/a.d.ts", default: "./dist/a.js" } } },
        { "dist/a.d.ts": 'export * from "./gone.js";\n', "dist/a.js": "export {};\n" },
      );
      assertStringIncludes(inspectPackage(unreached).join("\n"), "whose declaration dist/gone.d.ts is not in the package");
      const foreign = await make(
        "foreign",
        { ...base, exports: { ".": { types: "./dist/a.d.ts", default: "./dist/a.js" } } },
        { "dist/a.d.ts": 'import type { Z } from "zod";\nexport type A = Z;\n', "dist/a.js": "export {};\n" },
      );
      assertStringIncludes(inspectPackage(foreign).join("\n"), "imports zod, which is not a dependency of @x/lib");
      const declared = await make(
        "declared",
        { ...base, dependencies: { zod: "3.0.0" }, exports: { ".": { types: "./dist/a.d.ts", default: "./dist/a.js" } } },
        { "dist/a.d.ts": 'import type { Z } from "zod";\nexport type A = Z;\n', "dist/a.js": "export {};\n" },
      );
      assertEquals(inspectPackage(declared), []);
      const notOnNpm = await make(
        "not-on-npm",
        { ...base, exports: { ".": { types: "./dist/a.d.ts", default: "./dist/a.js" } } },
        { "dist/a.d.ts": "export type A = number;\n", "dist/a.js": 'import "@intellectual-frontiers/commons/ts/kernel";\n' },
      );
      assertStringIncludes(inspectPackage(notOnNpm).join("\n"), "is not on npm");
      const tsPath = await make(
        "ts-path",
        { ...base, exports: { ".": { types: "./dist/a.d.ts", default: "./dist/a.js" } } },
        { "dist/a.d.ts": 'export * from "./b.ts";\n', "dist/b.d.ts": "export type B = 1;\n", "dist/a.js": "export {};\n" },
      );
      assertStringIncludes(inspectPackage(tsPath).join("\n"), "imports a `.ts` path");
    } finally {
      await fs.remove(dir, { recursive: true });
    }
  },
);
