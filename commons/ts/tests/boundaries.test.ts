/**
 * The rules of IFC TypeScript as tests (commons 0005-typescript-runtime FR-002 to FR-004, FR-015, FR-016): the kernel imports nothing outside
 * itself; the runtime imports only `node:` builtins, the kernel and itself; no file names a vendor's API or registry; every file and every
 * export carries JSDoc; the development dependencies are pinned exactly, with a lockfile.
 *
 * @module
 */
import { readDirSync, readTextFile, readTextFileSync, statSync } from "../runtime/fs.ts";
import { dirname, fromFileUrl, join, relative, resolve, toPosix } from "../runtime/path.ts";
import { assert, assertEquals, proves } from "../runtime/test.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");

/** Every `.ts` file under a folder of the package, relative to the package with `/` between parts. */
function sources(folder: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readDirSync(dir)) {
      const p = join(dir, e.name);
      if (e.isDirectory) walk(p);
      else if (e.name.endsWith(".ts")) out.push(toPosix(relative(ROOT, p)));
    }
  };
  walk(join(ROOT, folder));
  return out.sort();
}

/** The module specifiers a file imports or re-exports, statically or dynamically. */
export function specifiers(text: string): string[] {
  const out: string[] = [];
  for (const re of [/^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/gm, /^\s*import\s*["']([^"']+)["']/gm, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g]) {
    for (const m of text.matchAll(re)) if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

/** The lines of a file that are code, not comments: a line whose text starts a comment, or lies inside a block comment, is left out. */
export function codeLines(text: string): { readonly line: number; readonly text: string }[] {
  const out: { line: number; text: string }[] = [];
  let inBlock = false;
  for (const [i, raw] of text.split("\n").entries()) {
    const t = raw.trim();
    if (inBlock) {
      if (t.includes("*/")) inBlock = false;
      continue;
    }
    if (t.startsWith("/*")) {
      inBlock = !t.includes("*/");
      continue;
    }
    if (t.startsWith("//")) continue;
    out.push({ line: i + 1, text: raw });
  }
  return out;
}

const KERNEL = sources("kernel");
const RUNTIME = sources("runtime");
const TESTS = sources("tests");

proves(["0005-typescript-runtime FR-002"], "the kernel imports nothing outside kernel/", () => {
  assert(KERNEL.length > 5);
  const bad: string[] = [];
  for (const f of KERNEL) {
    for (const s of specifiers(readTextFileSync(join(ROOT, f)))) {
      const target = toPosix(relative(ROOT, resolve(ROOT, dirname(f), s)));
      if (!s.startsWith("./") || !target.startsWith("kernel/")) bad.push(`${f}: ${s}`);
    }
  }
  assertEquals(bad, []);
});

proves(["0005-typescript-runtime FR-003"], "the runtime imports only node: builtins, kernel/ and runtime/", () => {
  assert(RUNTIME.length > 5);
  const bad: string[] = [];
  for (const f of RUNTIME) {
    for (const s of specifiers(readTextFileSync(join(ROOT, f)))) {
      if (s.startsWith("node:")) continue;
      const target = toPosix(relative(ROOT, resolve(ROOT, dirname(f), s)));
      if (!s.startsWith(".") || !(target.startsWith("kernel/") || target.startsWith("runtime/"))) bad.push(`${f}: ${s}`);
    }
  }
  assertEquals(bad, []);
});

const VENDOR = [/\bDeno\s*\./, /\bBun\s*\./, /["']jsr:/, /["']npm:/, /["']@std\//, /["']@erga\//, /["']https?:\/\/[^"']*\.(?:ts|js|mjs)["']/];
const HOST_IN_KERNEL = [/\bprocess\b/, /\bBuffer\b/, /\brequire\s*\(/, /\b__dirname\b/, /\bglobalThis\s*\.\s*(?:process|Deno|Bun)\b/];

proves(["0005-typescript-runtime FR-004"], "no code names Deno, Bun, a registry or a URL import; the kernel names no host global", () => {
  const bad: string[] = [];
  for (const f of [...KERNEL, ...RUNTIME, ...TESTS]) {
    for (const { line, text } of codeLines(readTextFileSync(join(ROOT, f)))) {
      for (const re of VENDOR) if (re.test(text) && !f.startsWith("tests/boundaries")) bad.push(`${f}:${line}: ${text.trim()}`);
      if (f.startsWith("kernel/")) for (const re of HOST_IN_KERNEL) if (re.test(text)) bad.push(`${f}:${line}: ${text.trim()}`);
    }
  }
  assertEquals(bad, []);
});

proves(["0005-typescript-runtime FR-004"], "the checks see what they look for (negative controls)", () => {
  assertEquals(specifiers(`import a from "x";\nexport { b } from './y.ts';\nimport "z";\nconst m = await import("w");\nimport type {\n  T,\n} from "v";`), ["x", "./y.ts", "v", "z", "w"]);
  const code = codeLines("/**\n * Deno.readTextFile\n */\n// Deno.x\nDeno.exit();");
  assertEquals(code, [{ line: 5, text: "Deno.exit();" }]);
  assert(VENDOR.some((re) => re.test(`import x from "jsr:@std/path";`)));
  assert(HOST_IN_KERNEL.some((re) => re.test("process.env")));
});

proves(["0005-typescript-runtime FR-015"], "every file begins with a JSDoc block that says @module, and every export has JSDoc", () => {
  const bad: string[] = [];
  for (const f of [...KERNEL, ...RUNTIME, ...TESTS]) {
    const text = readTextFileSync(join(ROOT, f));
    const head = /^\/\*\*[\s\S]*?\*\//.exec(text);
    if (head === null || !head[0].includes("@module")) bad.push(`${f}: no @module block at the top`);
    if (f.startsWith("tests/")) continue;
    const lines = text.split("\n");
    for (const [i, l] of lines.entries()) {
      if (!/^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|type\s+\w|interface|abstract\s+class)\b/.test(l)) continue;
      let j = i - 1;
      while (j >= 0 && (lines[j] ?? "").trim() === "") j--;
      if (!(lines[j] ?? "").trim().endsWith("*/")) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 60)} has no JSDoc`);
    }
  }
  assertEquals(bad, []);
});

proves(["0005-typescript-runtime FR-016"], "the development dependencies are pinned exactly, with a lockfile, and there are no runtime dependencies", async () => {
  const pkg: unknown = JSON.parse(await readTextFile(join(ROOT, "package.json")));
  assert(typeof pkg === "object" && pkg !== null);
  const dev: unknown = Reflect.get(pkg, "devDependencies");
  assert(typeof dev === "object" && dev !== null);
  const pins = Object.entries(dev);
  assertEquals(pins.map(([k]) => k).sort(), ["@types/node", "fast-check", "typescript"]);
  for (const [name, v] of pins) assert(typeof v === "string" && /^\d+\.\d+\.\d+$/.test(v), `${name} is not pinned exactly: ${String(v)}`);
  assert(/^7\./.test(String(Reflect.get(dev, "typescript"))), "TypeScript is 7");
  assertEquals(Reflect.get(pkg, "dependencies"), undefined);
  assertEquals(Reflect.get(pkg, "type"), "module");
  assert(statSync(join(ROOT, "package-lock.json")).isFile);
  const lock: unknown = JSON.parse(await readTextFile(join(ROOT, "package-lock.json")));
  const root: unknown = typeof lock === "object" && lock !== null ? Reflect.get(Reflect.get(lock, "packages") ?? {}, "") : undefined;
  assertEquals(typeof root === "object" && root !== null ? Reflect.get(root, "devDependencies") : undefined, dev);
});

proves(["0005-typescript-runtime FR-001"], "the layout: the folders and files are there, and runtime/mod.ts does not load the test runner", async () => {
  for (const f of ["kernel/mod.ts", "runtime/mod.ts", "runtime/test.ts", "package.json", "package-lock.json", "tsconfig.json", "tsconfig.kernel.json", "README.md"]) {
    assert(statSync(join(ROOT, f)).isFile, f);
  }
  const mod = await readTextFile(join(ROOT, "runtime", "mod.ts"));
  assert(!specifiers(mod).some((s) => s.includes("test")), "runtime/mod.ts re-exports test.ts");
  assert(!specifiers(await readTextFile(join(ROOT, "kernel", "mod.ts"))).some((s) => s.includes("runtime")));
});
