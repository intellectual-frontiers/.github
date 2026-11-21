/**
 * The shape of the library's three layers (commons lang-sql 0010-aide FR-001): the core imports only itself, `aide` imports the core and commons' core and no `node:` module, `acceptance` may use `node:` modules, and the manifest exports each folder of `aide`
 * and none of `acceptance`.
 *
 * Spec: 0010-aide FR-001
 *
 * @module
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const tsFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".ts"))
        .map((e) => join(e.parentPath, e.name))
        .filter((f) => !f.includes(`${sep}node_modules${sep}`))
    : [];

const specifiers = (text: string): string[] => {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    for (const m of line.matchAll(/^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/g)) if (m[1] !== undefined) out.push(m[1]);
    for (const m of line.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
};

proves(["0010-aide FR-001"], "src/aide imports only src/aide, the core and commons' core and no node: module, the core never imports aide or acceptance, and the manifest exports aide and not acceptance", () => {
  const src = join(ROOT, "src");
  const aide = join(src, "aide");
  const acceptance = join(ROOT, "acceptance");
  const files = tsFiles(aide);
  assert(files.length >= 6, "aide was found");
  for (const f of files) {
    for (const s of specifiers(readFileSync(f, "utf8"))) {
      if (s.startsWith(".")) {
        const target = resolve(dirname(f), s);
        assert(target.startsWith(aide + sep) || target.startsWith(src + sep), `${relative(ROOT, f)} imports ${s}`);
      } else assertEquals(s, "@intellectual-frontiers/core", `${relative(ROOT, f)} imports ${s}`);
    }
  }
  for (const f of tsFiles(src).filter((x) => !x.startsWith(aide + sep))) {
    for (const s of specifiers(readFileSync(f, "utf8"))) {
      if (!s.startsWith(".")) continue;
      const target = resolve(dirname(f), s);
      assert(!target.startsWith(aide + sep) && !target.startsWith(acceptance + sep), `${relative(ROOT, f)} imports ${s}`);
    }
  }
  for (const f of tsFiles(acceptance)) {
    for (const s of specifiers(readFileSync(f, "utf8"))) {
      if (!s.startsWith(".")) continue;
      assert((resolve(dirname(f), s) + sep).startsWith(ROOT + sep), `${relative(ROOT, f)} imports ${s}, which is outside the library`);
    }
  }
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { exports: Record<string, string> };
  for (const e of readdirSync(aide, { withFileTypes: true })) if (e.isDirectory()) assertEquals(pkg.exports[`./aide/${e.name}`], `./src/aide/${e.name}/mod.ts`, e.name);
  assertEquals(
    Object.keys(pkg.exports).filter((k) => k.includes("acceptance")),
    [],
  );
});
