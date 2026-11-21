/**
 * The one package of commons (commons 0036-distribution FR-021 to FR-026), proved by real installs: `bun tools/pack.ts` in `commons/commons` makes the tarball of `@intellectual-frontiers/commons`; its inspection is run again on the unpacked
 * tarball; it is installed into an empty project with npm and with Bun; every entry of every library is imported on Node 26 and on Bun (with no hook: Node does not strip the types of a file under `node_modules`); the commands are run; no specifier
 * still names a library by its own package; and a consumer that imports every entry is type-checked by TypeScript 7 under `nodenext` and `bundler`, with the `dom` library and without it. The measures (size, files, entries, install times) are
 * printed. It needs `npm`, `node` (26) and `bun` on the path and the network of a package manager.
 *
 * @module
 */
import { fs, path, proc } from "../../commons/system/src/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../../commons/test/src/test.ts";
import { filesUnder } from "../../commons/libraries/src/pack-library.ts";
import { inspectCommons, oldSpecifiers } from "../../commons/libraries/src/pack-commons.ts";
import { linter } from "../../commons/lint/src/test-rule.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..");
const FOLDER = path.join(ROOT, "commons", "commons");
const TSC = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");
const SELF = "@intellectual-frontiers/commons";

type Json = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Json => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : {});

async function sh(
  argv: readonly string[],
  cwd: string,
  env?: Record<string, string>,
): Promise<{ readonly code: number; readonly out: string; readonly ms: number }> {
  const t = Date.now();
  const r = await proc.run(argv, { cwd, ...(env === undefined ? {} : { env }) });
  return { code: r.code, out: `${r.stdout}${r.stderr}`, ms: Date.now() - t };
}

proves(
  [
    "0036-distribution FR-021",
    "0036-distribution FR-022",
    "0036-distribution FR-023",
    "0036-distribution FR-024",
    "0036-distribution FR-025",
    "0036-distribution FR-026",
  ],
  "the one package is packed from the real libraries, inspected, installed with npm and with Bun, every entry of every library imported on Node and on Bun, its commands run, and a consumer of every entry type-checked with and without the dom library",
  async () => {
    const bun = proc.which("bun") ?? "bun";
    const node = proc.which("node") ?? "node";
    const npm = proc.which("npm") ?? "npm";
    const tmp = await fs.makeTempDir({ prefix: "commons-package-" });
    try {
      const installed = await sh([bun, "install", "--frozen-lockfile"], FOLDER);
      assertEquals(installed.code, 0, `bun install in commons/commons: ${installed.out}`);
      const packed = await sh([bun, "tools/pack.ts"], FOLDER);
      assertEquals(packed.code, 0, packed.out.slice(0, 3000));
      const tarball = (packed.out.match(/\S+\.tgz/g) ?? []).at(-1) ?? "";
      assert(tarball.endsWith(".tgz") && fs.existsSync(tarball), `no tarball in ${packed.out}`);
      const bytes = (await fs.stat(tarball)).size;
      // the tarball unpacked: the inspection again, the license, and the facts
      const unpacked = path.join(tmp, "unpacked");
      await fs.mkdir(unpacked, { recursive: true });
      assertEquals((await sh(["tar", "-xzf", tarball, "-C", unpacked, "--strip-components=1"], tmp)).code, 0);
      const manifest = obj(JSON.parse(await fs.readTextFile(path.join(unpacked, "package.json"))));
      const libraries = fs
        .readDirSync(path.join(ROOT, "commons"))
        .filter(
          (e) =>
            e.isDirectory &&
            fs.existsSync(path.join(ROOT, "commons", e.name, "library.ts")) &&
            !["commons", "foundation", "patterns", "programs", "standards"].includes(e.name),
        )
        .map((e) => e.name);
      assertEquals(inspectCommons(unpacked, libraries), [], "the inspection of the tarball");
      assertEquals(manifest["name"], SELF);
      assertEquals(manifest["license"], "PolyForm-Noncommercial-1.0.0");
      assertStringIncludes(await fs.readTextFile(path.join(unpacked, "LICENSE")), "PolyForm Noncommercial License 1.0.0");
      assertEquals(Object.keys(obj(manifest["bin"])).sort(), ["anyfs", "arcactl", "ergonex", "ifc-docs", "repoctl"]);
      assertEquals(obj(manifest["repository"])["url"], "git+https://github.com/intellectual-frontiers/.github.git");
      assertEquals(
        obj(manifest["publishConfig"])["registry"],
        "https://npm.pkg.github.com",
        "the package is sent to the GitHub package registry alone",
      );
      const sideEffects = manifest["sideEffects"];
      assert(
        Array.isArray(sideEffects) && sideEffects.includes("./telemetry/dist/src/host/otel.js"),
        "the telemetry host installs a port when loaded: it is not marked free of effects",
      );
      const keys = Object.keys(obj(manifest["exports"]));
      for (const lib of libraries)
        assert(
          keys.some((k) => k === `./${lib}` || k.startsWith(`./${lib}/`)),
          `${lib} has no entry`,
        );
      assert(libraries.includes("lab") && libraries.includes("data"), "lab (tests only) and data are in the package");
      // no specifier in the whole package still names a library by its own package
      let files = 0;
      for (const rel of filesUnder(unpacked)) {
        files++;
        if (/\.(?:js|mjs|ts)$/.test(rel)) assertEquals(oldSpecifiers(await fs.readTextFile(path.join(unpacked, rel))), [], rel);
      }
      // the installs of an empty project, with npm and with Bun, each timed
      const report: Record<string, unknown> = { bytes, files, libraries: libraries.length, entries: keys.length };
      const entries = keys.map((k) => `${SELF}/${k.slice(2)}`);
      const importAll = [
        `const entries = ${JSON.stringify(entries)};`,
        "const bad = [];",
        'for (const e of entries) { try { await import(e); } catch (error) { bad.push(e + ": " + String(error && error.message).split("\\n")[0]); } }',
        'console.log(JSON.stringify({ runtime: typeof Bun === "undefined" ? "node" : "bun", entries: entries.length, bad }));',
        "process.exit(0);",
        "",
      ].join("\n");
      for (const [tool, add] of [
        ["npm", [npm, "install", "--no-audit", "--no-fund", tarball]],
        ["bun", [bun, "add", tarball]],
      ] as const) {
        const project = path.join(tmp, `project-${tool}`);
        await fs.mkdir(project, { recursive: true });
        await fs.writeTextFile(path.join(project, "package.json"), '{ "name": "consumer", "private": true, "type": "module" }\n');
        await fs.writeTextFile(path.join(project, "use.mjs"), importAll);
        const cache = path.join(tmp, `cache-${tool}`);
        const added = await sh(add, project, tool === "bun" ? { BUN_INSTALL_CACHE_DIR: cache } : {});
        assertEquals(added.code, 0, `${tool}: ${added.out}`);
        report[`${tool}InstallMs`] = added.ms;
        const onNode = await sh([node, "use.mjs"], project);
        assertEquals(onNode.code, 0, `Node: ${onNode.out}`);
        assertEquals(
          JSON.parse(onNode.out.trim().split("\n").at(-1) ?? "{}"),
          { runtime: "node", entries: keys.length, bad: [] },
          `every entry is imported on Node (${tool})`,
        );
        const onBun = await sh([bun, "use.mjs"], project);
        assertEquals(onBun.code, 0, `Bun: ${onBun.out}`);
        assertEquals(
          JSON.parse(onBun.out.trim().split("\n").at(-1) ?? "{}"),
          { runtime: "bun", entries: keys.length, bad: [] },
          `every entry is imported on Bun (${tool})`,
        );
        // a function that is called, not only imported
        await fs.writeTextFile(
          path.join(project, "call.mjs"),
          `import { ok } from "${SELF}/core";\nimport { sha256 } from "${SELF}/crypto/sha256";\nconsole.log(ok(1).kind, await sha256(new TextEncoder().encode("a")));\n`,
        );
        for (const rt of [node, bun]) {
          const called = await sh([rt, "call.mjs"], project);
          assertStringIncludes(called.out, "ok ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");
        }
        // the folders that libraries read at run time are in the installed package, and the libraries that read them find them, under Node (from the compiled modules) and under Bun (from the sources): the NIST catalogs load
        // through the catalog loader of grc, the guides of Docs are beside its modules, and Quality finds the two source files of its verifier
        await fs.writeTextFile(
          path.join(project, "runtime.mjs"),
          [
            'import { existsSync, readdirSync } from "node:fs";',
            'import { dirname, join } from "node:path";',
            'import { fileURLToPath } from "node:url";',
            `import { PACKAGE_DIR as sp800 } from "${SELF}/catalog-nist-sp800/physical";`,
            `import { PACKAGE_DIR as csf } from "${SELF}/catalog-nist-csf-2/physical";`,
            `import { readCatalogPackage } from "${SELF}/grc/physical";`,
            `import { standardKinds } from "${SELF}/grc/logical";`,
            `import { verifierCandidates, verifierSources } from "${SELF}/quality/assessor/host";`,
            "const out = {};",
            "for (const [name, dir] of [['sp800', sp800], ['csf', csf]]) {",
            "  const r = await readCatalogPackage(dir, standardKinds());",
            "  out[name] = r.kind === 'ok' ? r.value.documents.map((d) => d.controls.length) : JSON.stringify(r.error).slice(0, 300);",
            "}",
            `const root = dirname(fileURLToPath(import.meta.resolve("${SELF}/docs")));`,
            "const guides = [join(root, '..', 'guides'), join(root, '..', '..', 'guides')];",
            "out.guides = guides.map((g) => existsSync(g) ? readdirSync(g).length : 0);",
            "const here = dirname(fileURLToPath(import.meta.resolve('" + SELF + "/quality/assessor/host')));",
            "const v = await verifierSources(here);",
            "out.verifier = v.kind === 'ok' ? [v.value.pack.length > 100, v.value.main.length > 100] : v.error;",
            "out.candidates = verifierCandidates(here, 'verify-pack.ts').length;",
            'console.log(JSON.stringify({ runtime: typeof Bun === "undefined" ? "node" : "bun", ...out }));',
            "process.exit(0);",
            "",
          ].join("\n"),
        );
        for (const rt of [node, bun]) {
          const ran = await sh([rt, "runtime.mjs"], project);
          assertEquals(ran.code, 0, `${tool}: runtime ${rt}: ${ran.out.slice(0, 800)}`);
          const seen = JSON.parse(ran.out.trim().split("\n").at(-1) ?? "{}") as Record<string, unknown>;
          const label = `${tool} on ${rt}`;
          assertEquals(seen["sp800"], [1014, 2781, 97, 422], `${label}: the SP 800 catalog loads from the installed package`);
          assert(
            Array.isArray(seen["csf"]) && seen["csf"].length === 1 && Number(seen["csf"][0]) > 100,
            `${label}: the CSF 2.0 catalog loads from the installed package: ${JSON.stringify(seen["csf"])}`,
          );
          assertEquals(seen["verifier"], [true, true], `${label}: Quality finds its verifier's two files`);
          assert(
            Array.isArray(seen["guides"]) && seen["guides"].some((n) => typeof n === "number" && n > 20),
            `${label}: the guides of Docs are in the package`,
          );
        }
        // the commands run on Node, by their launchers
        for (const c of ["anyfs", "ergonex", "repoctl", "ifc-docs", "arcactl"]) {
          const ran = await sh([node, path.join(project, "node_modules", ".bin", c), "--help"], project);
          assertEquals(ran.code, 0, `${tool}: ${c}: ${ran.out.slice(0, 500)}`);
          assert(ran.out.length > 20, `${c} printed nothing`);
        }
        const du = await sh(["du", "-sk", path.join(project, "node_modules")], project);
        report[`${tool}NodeModulesKb`] = Number.parseInt(du.out, 10);
        // a consumer of every entry, type-checked: with and without the dom library, under nodenext and bundler
        await fs.writeTextFile(
          path.join(project, "consumer.ts"),
          [
            ...entries.map((e, i) => `import type * as m${i} from ${JSON.stringify(e)};`),
            `export type All = [${entries.map((_, i) => `typeof m${i}`).join(", ")}];`,
            "",
          ].join("\n"),
        );
        if (tool === "npm") {
          for (const [name, lib, module, resolution] of [
            ["nodom", ["es2024"], "nodenext", "nodenext"],
            ["dom", ["es2024", "dom"], "nodenext", "nodenext"],
            ["bundler", ["es2024"], "esnext", "bundler"],
          ] as const) {
            await fs.writeTextFile(
              path.join(project, `tsconfig.${name}.json`),
              JSON.stringify({
                compilerOptions: {
                  target: "es2024",
                  lib,
                  module,
                  moduleResolution: resolution,
                  strict: true,
                  noEmit: true,
                  types: ["node"],
                  typeRoots: [path.join(ROOT, "node_modules", "@types")],
                  skipLibCheck: false,
                  exactOptionalPropertyTypes: true,
                },
                files: ["consumer.ts"],
              }),
            );
            const typed = await sh([node, TSC, "-p", `tsconfig.${name}.json`], project);
            assertEquals(typed.code, 0, `tsc ${name}: ${typed.out.slice(0, 3000)}`);
          }
          // the plugin of the lint library, as installed, is loaded by Bun's linter by the name of the package
          const ready = await linter();
          if (ready.kind === "ok") {
            await fs.mkdir(path.join(project, "src"), { recursive: true });
            await fs.writeTextFile(path.join(project, "src", "a.ts"), "export const n = 1;\nconsole.log(n);\n");
            await fs.writeTextFile(
              path.join(project, "bunfig.toml"),
              `[lint]\nplugins = ["${SELF}/lint"]\n[lint.rules]\n"ifc/module-doc" = "error"\n`,
            );
            const linted = await sh([...ready.value, "lint", "src"], project);
            assertStringIncludes(linted.out, "ifc/module-doc");
          }
        }
      }
      console.log(`commons package: ${JSON.stringify(report)}`);
    } finally {
      await fs.remove(tmp, { recursive: true });
    }
  },
  { timeout: 900_000 },
);
