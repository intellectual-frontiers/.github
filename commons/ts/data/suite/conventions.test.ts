/**
 * The conventions of the data libraries, held on their own source (commons 0006-sql-aide FR-001 to FR-005, FR-047, FR-048): what a file
 * may import, what syntax it may use, that nothing is configured in a file, and that everything exported is documented.
 *
 * @module
 */
import { fs, path } from "../../runtime/mod.ts";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const DATA = path.fromFileUrl(new URL("..", import.meta.url));

/** Every TypeScript file under a folder of `data/`, as paths relative to `data/`. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of [...fs.readDirSync(path.join(DATA, dir))].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory) out.push(...sources(rel));
    else if (entry.name.endsWith(".ts")) out.push(rel);
  }
  return out;
}
const read = (f: string): string => fs.readTextFileSync(path.join(DATA, f));
const library = sources("sql-aide");
const built = [...sources("arca"), ...sources("data-vault")];
const everything = [...library, ...built];
const written = everything.filter((f) => !f.includes(".auto."));

/** The text with comments, strings and templates blanked, so that a rule about code does not read prose. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/.*$/gm, "")
    .replace(/`(?:\\.|[^`\\])*`/g, (m) => "`" + m.slice(1, -1).replace(/[^\n]/g, " ") + "`")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}
const imports = (f: string): string[] => [...read(f).matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/gm)].map((m) => m[1] ?? "");
const resolved = (f: string, spec: string): string =>
  path.relative(DATA, path.resolve(path.dirname(path.join(DATA, f)), spec)).replaceAll("\\", "/");

proves(
  ["0006-sql-aide FR-001", "0006-sql-aide FR-002"],
  "the package installs nothing a harness would run, and is checked by the compiler of IFC TypeScript",
  () => {
    const pkg: unknown = JSON.parse(read("package.json"));
    assert(typeof pkg === "object" && pkg !== null);
    assertEquals("dependencies" in pkg, false, "no dependencies");
    assertEquals("engines" in pkg ? pkg.engines : null, { node: ">=26" });
    assert(read("tsconfig.json").includes('"extends": "../tsconfig.json"'), "the compiler's options are IFC TypeScript's");
  },
);

proves(["0006-sql-aide FR-002"], "a file of the library imports the library and the kernel, and the host only under runtime/", () => {
  for (const f of library) {
    for (const spec of imports(f)) {
      assert(spec.startsWith("."), `${f} imports ${spec}`);
      const target = resolved(f, spec);
      if (target.startsWith("sql-aide/")) continue;
      if (target === "../kernel/mod.ts") continue;
      assert(
        target === "../runtime/mod.ts" && f.startsWith("sql-aide/runtime/"),
        `${f} imports ${spec}, which is neither the library nor the kernel`,
      );
    }
  }
});

proves(["0006-sql-aide FR-047", "0006-sql-aide FR-048"], "a library built with SQL Aide imports its public entry point alone", () => {
  for (const f of built) {
    for (const spec of imports(f)) {
      assert(spec.startsWith("."), `${f} imports ${spec}`);
      const target = resolved(f, spec);
      const own = target.startsWith(`${f.split("/")[0]}/`);
      assert(own || target === "sql-aide/mod.ts", `${f} imports ${spec}: only its own files and sql-aide/mod.ts are its to import`);
    }
  }
});

proves(["0006-sql-aide FR-003"], "only erasable syntax, no any, no non-null assertion", () => {
  for (const f of written) {
    const c = code(read(f));
    assert(!/^\s*(?:export\s+)?(?:const\s+)?enum\s/m.test(c), `${f}: enum`);
    assert(!/^\s*(?:export\s+)?namespace\s/m.test(c), `${f}: namespace`);
    assert(!/(?::|<|\bas|,|\|)\s*any\b/.test(c), `${f}: any`);
    assert(!/[\w\])]!(?:\.|\[|\)|,|;)/.test(c), `${f}: non-null assertion`);
  }
  // the control: the patterns see what they look for
  assert(/(?::|<|\bas|,|\|)\s*any\b/.test("const x: any = 1") && /[\w\])]!(?:\.|\[|\)|,|;)/.test("a.b!.c"));
});

proves(["0006-sql-aide FR-004"], "no configuration file is named, and the host is read only under runtime/", () => {
  for (const f of written) {
    assert(!/["'`][^"'`\n]*\.(?:ya?ml|xml|toml)["'`]/.test(read(f)), `${f}: names a configuration file`);
    if (!f.startsWith("sql-aide/runtime/"))
      assert(!/\breadDir|\breadTextFile|\breadFile/.test(code(read(f))), `${f}: reads the file system outside runtime/`);
  }
});

proves(["0006-sql-aide FR-005"], "every file says what it is, and every exported declaration carries a TSDoc comment", () => {
  const missing: string[] = [];
  for (const f of everything) {
    const text = read(f);
    if (!/^\/\*\*[\s\S]*?@module[\s\S]*?\*\//.test(text)) missing.push(`${f}: no @module block at its top`);
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (!/^export\s+(?:async\s+)?(?:const|function|type\s+\w|interface|class)\b/.test(line)) return;
      let j = i - 1;
      while (j >= 0 && (lines[j] ?? "").trim() === "") j--;
      if (!(lines[j] ?? "").trim().endsWith("*/")) missing.push(`${f}:${i + 1}: ${line.slice(0, 60)}`);
    });
  }
  assertEquals(missing, []);
});
