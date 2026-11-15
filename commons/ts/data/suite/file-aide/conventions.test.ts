/**
 * The conventions of File Aide and of IFRFS, held on their own source (commons 0010-file-aide FR-001 to FR-005, FR-038): what a file may
 * import, what syntax it may use, that no code is made from text, that nothing is configured in a file, and that every export is documented.
 *
 * @module
 */
import { fs, path } from "../../../runtime/mod.ts";
import { assert, assertEquals, proves } from "../../../runtime/test.ts";

const DATA = path.fromFileUrl(new URL("../..", import.meta.url));

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
const library = sources("file-aide");
const built = sources("ifrfs");
const everything = [...library, ...built];

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

proves(["0010-file-aide FR-001"], "File Aide is TypeScript in the data package, checked by IFC TypeScript's compiler options", () => {
  assert(library.includes("file-aide/mod.ts"), "the public entry point");
  const tsconfig = read("tsconfig.json");
  assert(
    tsconfig.includes('"extends": "../tsconfig.json"') && tsconfig.includes('"file-aide/**/*.ts"') && tsconfig.includes('"ifrfs/**/*.ts"'),
  );
});

proves(
  ["0010-file-aide FR-002"],
  "a file of File Aide imports File Aide, the kernel and SQL Aide's entry point, and the host only under runtime/",
  () => {
    const pkg: unknown = JSON.parse(read("package.json"));
    assert(typeof pkg === "object" && pkg !== null && !("dependencies" in pkg), "no dependencies");
    for (const f of library) {
      for (const spec of imports(f)) {
        assert(spec.startsWith("."), `${f} imports ${spec}`);
        const target = resolved(f, spec);
        if (target.startsWith("file-aide/") || target === "../kernel/mod.ts" || target === "sql-aide/mod.ts") continue;
        assert(target === "../runtime/mod.ts" && f.startsWith("file-aide/runtime/"), `${f} imports ${spec}`);
      }
    }
  },
);

proves(["0010-file-aide FR-038"], "IFRFS imports File Aide's public entry point alone, and nothing of erga", () => {
  for (const f of built) {
    for (const spec of imports(f)) {
      const target = resolved(f, spec);
      assert(target.startsWith("ifrfs/") || target === "file-aide/mod.ts", `${f} imports ${spec}`);
    }
    assert(!/@erga\//.test(read(f)), `${f} names an erga package`);
  }
});

proves(["0010-file-aide FR-003"], "only erasable syntax, no any, no non-null assertion, and no code made from text", () => {
  for (const f of everything) {
    const c = code(read(f));
    assert(!/^\s*(?:export\s+)?(?:const\s+)?enum\s/m.test(c), `${f}: enum`);
    assert(!/^\s*(?:export\s+)?namespace\s/m.test(c), `${f}: namespace`);
    assert(!/(?::|<|\bas|,|\|)\s*any\b/.test(c), `${f}: any`);
    assert(!/[\w\])]!(?:\.|\[|\)|,|;)/.test(c), `${f}: non-null assertion`);
    assert(!/\bnew\s+Function\b|\beval\s*\(|\bimport\s*\(/.test(c), `${f}: code made from text`);
  }
  assert(/\bnew\s+Function\b|\beval\s*\(/.test("const f = new Function('x'); eval(y)"), "the control");
});

proves(["0010-file-aide FR-004"], "no configuration file is named, and the host is read only under runtime/", () => {
  for (const f of everything) {
    assert(!/["'`][^"'`\n]*\.(?:ya?ml|xml|toml)["'`]/.test(read(f)), `${f}: names a configuration file`);
    if (!f.startsWith("file-aide/runtime/"))
      assert(!/\breadDir|\breadTextFile|\breadFile/.test(code(read(f))), `${f}: reads the file system`);
  }
});

proves(["0010-file-aide FR-005"], "every file says what it is, and every exported declaration carries a TSDoc comment", () => {
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
