/**
 * The boundaries of IF Workspaces and the Git host adapters as tests (commons 0023-if-workspaces FR-005, FR-015, FR-021): `workspaces/` is rung 10 and no rung below imports it; its pure core
 * imports only the kernel, itself and the pure part of `githost/`, and reads no clock, no environment and no file; the adapters import only the kernel, the runtime and `githost/`; every file has
 * a module comment and every export a TSDoc.
 *
 * @module
 */
import { readDirSync, readTextFileSync } from "../runtime/fs.ts";
import { dirname, join, relative, resolve, toPosix, fromFileUrl } from "../runtime/path.ts";
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

/** The module specifiers a file imports or re-exports. */
function specifiers(text: string): string[] {
  const out: string[] = [];
  for (const re of [
    /^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/gm,
    /^\s*import\s*["']([^"']+)["']/gm,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const m of text.matchAll(re)) if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

/** The code of a file without its comments and the contents of its strings. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
}

const targetOf = (file: string, spec: string): string => toPosix(relative(ROOT, resolve(ROOT, dirname(file), spec)));
const WORKSPACES = sources("workspaces");
const GITHOST = sources("githost");
const PURE_GITHOST = ["githost/types.ts", "githost/capabilities.ts", "githost/remote.ts"];
/** The host layer of the library: what runs `git`, reads and writes files and the environment, and the command that does so. */
const isHostLayer = (f: string): boolean =>
  f.startsWith("workspaces/host/") || f.startsWith("workspaces/commands/") || f === "workspaces/ifws.ts";
const PURE_WORKSPACES = WORKSPACES.filter((f) => !isHostLayer(f));

proves(
  ["0023-if-workspaces FR-005"],
  "no rung below imports workspaces/: the kernel, the runtime, the lint plugin, Mizan and the Git host adapters do not",
  () => {
    assert(WORKSPACES.length >= 8);
    const bad: string[] = [];
    for (const folder of ["kernel", "runtime", "lint", "mizan", "githost", "tools"]) {
      for (const f of sources(folder)) {
        for (const s of specifiers(readTextFileSync(join(ROOT, f)))) {
          if (s.startsWith(".") && targetOf(f, s).startsWith("workspaces/")) bad.push(`${f}: ${s}`);
        }
      }
    }
    assertEquals(bad, []);
  },
);

proves(
  ["0023-if-workspaces FR-021"],
  "the pure core imports only the kernel, itself and the pure part of githost/, and reads no clock, no environment, no file and no process",
  () => {
    const bad: string[] = [];
    for (const f of PURE_WORKSPACES) {
      const text = readTextFileSync(join(ROOT, f));
      for (const s of specifiers(text)) {
        if (!s.startsWith(".")) {
          bad.push(`${f}: ${s}`);
          continue;
        }
        const target = targetOf(f, s);
        const ok =
          target.startsWith("kernel/") || (target.startsWith("workspaces/") && !isHostLayer(target)) || PURE_GITHOST.includes(target);
        if (!ok) bad.push(`${f}: ${s}`);
      }
      for (const re of [
        /\bDate\.now\s*\(/,
        /\bnew Date\s*\(\s*\)/,
        /\bprocess\b/,
        /\bBun\b/,
        /\bDeno\b/,
        /\bMath\.random\s*\(/,
        /\bglobalThis\b/,
        /\bfetch\s*\(/,
        /\beval\s*\(/,
        /\bnew Function\b/,
      ]) {
        if (re.test(code(text))) bad.push(`${f}: ${re.source}`);
      }
    }
    assertEquals(bad, []);
  },
);

proves(
  ["0023-if-workspaces FR-015"],
  "the pure part of githost/ imports only the kernel and itself, and the adapters only the kernel, the runtime and githost/",
  () => {
    assertEquals(GITHOST.filter((f) => PURE_GITHOST.includes(f)).length, PURE_GITHOST.length);
    const bad: string[] = [];
    for (const f of GITHOST) {
      for (const s of specifiers(readTextFileSync(join(ROOT, f)))) {
        if (s.startsWith("node:")) {
          bad.push(`${f}: ${s}`);
          continue;
        }
        const target = targetOf(f, s);
        const allowed = PURE_GITHOST.includes(f)
          ? target.startsWith("kernel/") || PURE_GITHOST.includes(target)
          : target.startsWith("kernel/") || target.startsWith("runtime/") || target.startsWith("githost/");
        if (!s.startsWith(".") || !allowed) bad.push(`${f}: ${s}`);
      }
    }
    assertEquals(bad, []);
    // the adapters hold no credential in a file or a module-level variable: no member of the environment is read here (the caller hands the environment over)
    for (const f of GITHOST) {
      const text = code(readTextFileSync(join(ROOT, f)));
      assert(!/\bprocess\.env\b|\benv\.get\s*\(|\bBun\.env\b/.test(text), `${f} reads the environment`);
      assert(!/writeTextFile|writeFile|appendFile|localStorage/.test(text), `${f} writes a file`);
    }
  },
);

proves(
  ["0023-if-workspaces FR-005", "0023-if-workspaces FR-015"],
  "every file of workspaces/ and githost/ begins with a module comment, and every export has a TSDoc",
  () => {
    const bad: string[] = [];
    for (const f of [...WORKSPACES, ...GITHOST]) {
      const text = readTextFileSync(join(ROOT, f));
      const head = /^\/\*\*[\s\S]*?\*\//.exec(text);
      if (head === null || !head[0].includes("@module")) bad.push(`${f}: no @module block at the top`);
      const lines = text.split("\n");
      for (const [i, l] of lines.entries()) {
        if (!/^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|type\s+\w|interface)\b/.test(l)) continue;
        let j = i - 1;
        while (j >= 0 && (lines[j] ?? "").trim() === "") j--;
        if (!(lines[j] ?? "").trim().endsWith("*/")) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 60)} has no TSDoc`);
      }
    }
    assertEquals(bad, []);
  },
);
