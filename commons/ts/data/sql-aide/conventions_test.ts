// The conventions of the library, checked on its own source (commons 0005-sql-aide FR-001 to FR-005).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TS = resolve(HERE, "../..");
const DATA = resolve(HERE, "..");

/** Every TypeScript file under a folder, as paths relative to `commons/ts`. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (name.endsWith(".ts")) out.push(relative(TS, p));
  }
  return out;
}
const isTest = (f: string): boolean => /_test\.ts$|_types\.ts$/.test(f);
const isGenerated = (f: string): boolean => f.includes(".auto.");
const library = sources(HERE).filter((f) => !isTest(f));
const everything = sources(DATA).filter((f) => !isTest(f) && !isGenerated(f));
const read = (f: string): string => readFileSync(join(TS, f), "utf8");
/** The text with comments, strings and template literals blanked, so that a rule about code does not read prose. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/.*$/gm, "")
    .replace(/`(?:\\.|[^`\\])*`/g, (m) => "`" + m.slice(1, -1).replace(/[^\n]/g, " ") + "`")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}

test("the package installs nothing a harness would run, and names the runtimes (FR-001, FR-002)", () => {
  const pkg: unknown = JSON.parse(read("package.json"));
  assert.ok(typeof pkg === "object" && pkg !== null);
  assert.equal("dependencies" in pkg, false, "no dependencies");
  assert.deepEqual("engines" in pkg ? pkg.engines : null, { node: ">=26", bun: ">=1.4" });
  const tsconfig = read("tsconfig.json");
  for (const option of ['"strict": true', '"erasableSyntaxOnly": true', '"noUncheckedIndexedAccess": true']) assert.ok(tsconfig.includes(option), option);
});

test("a file of the library imports only the library, and a runtime's module only under runtime/ (FR-002)", () => {
  for (const f of library) {
    for (const m of read(f).matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/gm)) {
      const spec = m[1] ?? "";
      if (spec.startsWith("node:") || spec.startsWith("bun:")) {
        assert.ok(f.includes("/runtime/"), `${f} imports ${spec} outside runtime/`);
        continue;
      }
      assert.ok(spec.startsWith("."), `${f} imports ${spec}`);
      const target = relative(HERE, resolve(dirname(join(TS, f)), spec));
      assert.ok(!target.startsWith(".."), `${f} imports ${spec}, outside the library`);
    }
  }
});

test("a library built with it imports its public entry point alone (FR-047, FR-048)", () => {
  for (const f of everything.filter((x) => !x.startsWith("data/sql-aide/"))) {
    for (const m of read(f).matchAll(/\bfrom\s+"([^"]+)"/g)) {
      const spec = m[1] ?? "";
      if (!spec.includes("sql-aide")) continue;
      assert.ok(/sql-aide\/mod\.ts$/.test(spec), `${f} imports ${spec}, not the public entry point`);
    }
  }
});

test("only erasable syntax, no any, no non-null assertion (FR-003)", () => {
  for (const f of everything) {
    const c = code(read(f));
    assert.ok(!/^\s*(?:export\s+)?(?:const\s+)?enum\s/m.test(c), `${f}: enum`);
    assert.ok(!/^\s*(?:export\s+)?namespace\s/m.test(c), `${f}: namespace`);
    assert.ok(!/(?::|<|\bas|,|\|)\s*any\b/.test(c), `${f}: any`);
    assert.ok(!/[\w\])]!(?:\.|\[|\)|,|;)/.test(c), `${f}: non-null assertion`);
  }
});

test("no configuration file is read, and nothing is found by scanning (FR-004)", () => {
  for (const f of library) {
    const text = read(f);
    assert.ok(!/["'`][^"'`\n]*\.(?:ya?ml|xml|toml)["'`]/.test(text), `${f}: names a configuration file`);
    if (!f.includes("/runtime/")) assert.ok(!/\breaddir|\breadFile/.test(code(text)), `${f}: reads the file system outside runtime/`);
  }
});

test("every exported declaration carries a TSDoc comment (FR-005)", () => {
  const missing: string[] = [];
  for (const f of everything) {
    const lines = read(f).split("\n");
    lines.forEach((line, i) => {
      if (!/^export\s+(?:async\s+)?(?:const|function|type|interface|class)\s/.test(line)) return;
      let j = i - 1;
      while (j >= 0 && (lines[j] ?? "").trim() === "") j--;
      if (!(lines[j] ?? "").trim().endsWith("*/")) missing.push(`${f}:${i + 1}: ${line.slice(0, 60)}`);
    });
  }
  assert.deepEqual(missing, []);
});
