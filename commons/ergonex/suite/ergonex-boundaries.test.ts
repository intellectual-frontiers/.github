/**
 * The boundaries of Ergonex as tests (commons 0002-workspace-model FR-005, FR-021, 0001-ergonex FR-024): the library imports commons only by package name; its pure core imports only the kernel, itself and
 * the Git host's types, and reads no clock, no environment and no file; every file has a module comment and every export a TSDoc; no code names a credential store or the user's Git configuration.
 *
 * @module
 */
import { readDirSync, readTextFileSync } from "../src/platform/r-fs.ts";
import { dirname, join, relative, resolve, toPosix, fromFileUrl } from "../src/platform/r-path.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

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
const WORKSPACES = sources("src");
/** The host layer of the library: a folder named `host` anywhere below workspaces/ (`host/`, `tools/host/`, `setup/host/`, `scan/host/`), and what runs `git`, reads and writes files and the environment, and the command that does so. */
const isHostLayer = (f: string): boolean =>
  f.split("/").includes("host") || f.startsWith("src/commands/") || f === "src/ergonex.ts" || f.startsWith("src/platform/r-");
/** The packages of commons the pure core may import: the foundation (core), the record of a test, the kernel, and the Git host (its types and the reading of a remote). */
const PURE_PACKAGES = [
  "@intellectual-frontiers/core",
  "@intellectual-frontiers/terminal/args",
  "@intellectual-frontiers/telemetry",
  "@intellectual-frontiers/crypto",
  "@intellectual-frontiers/formats",
  "@intellectual-frontiers/test/record",
  "@intellectual-frontiers/commons/ts/kernel",
  "@intellectual-frontiers/githost",
];
const PURE_WORKSPACES = WORKSPACES.filter((f) => !isHostLayer(f));

proves(
  ["0002-workspace-model FR-005"],
  "the library imports commons by package name only: no import leaves the library by a relative path",
  () => {
    assert(WORKSPACES.length >= 8);
    const bad: string[] = [];
    for (const f of [...WORKSPACES, ...sources("suite")]) {
      for (const s of specifiers(readTextFileSync(join(ROOT, f)))) {
        if (s.startsWith(".") && (targetOf(f, s).startsWith("..") || !/^(src|suite|tools)\//.test(targetOf(f, s)))) bad.push(`${f}: ${s}`);
      }
    }
    assertEquals(bad, []);
  },
);

proves(
  ["0002-workspace-model FR-021"],
  "the pure core imports only the kernel, itself and the Git host's types, and reads no clock, no environment, no file and no process",
  () => {
    const bad: string[] = [];
    for (const f of PURE_WORKSPACES) {
      const text = readTextFileSync(join(ROOT, f));
      for (const s of specifiers(text)) {
        if (!s.startsWith(".")) {
          if (!PURE_PACKAGES.includes(s)) bad.push(`${f}: ${s}`);
          continue;
        }
        const target = targetOf(f, s);
        if (!(target.startsWith("src/") && !isHostLayer(target))) bad.push(`${f}: ${s}`);
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
  ["0002-workspace-model FR-005", "0002-workspace-model FR-015"],
  "every file of src/ begins with a module comment, and every export has a TSDoc",
  () => {
    const bad: string[] = [];
    for (const f of WORKSPACES) {
      const text = readTextFileSync(join(ROOT, f));
      const head = /^(?:\/\/ Spec:[^\n]*\n)?\/\*\*[\s\S]*?\*\//.exec(text);
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

proves(
  ["0002-workspace-model FR-003", "0002-workspace-model FR-004", "0003-host FR-020"],
  "no code of src/ names ~/.ssh, a credential store, or the user's or the system's Git configuration, and none writes a Git configuration but a repository's own",
  () => {
    const bad: string[] = [];
    // two files may name what the rest must not, by the spec's own exceptions: the path guard names what it refuses to read (0023 FR-003), and `ergonex setup --git-include` is
    // the one place that may write the global Git configuration, only on request, with the diff shown and a yes (0024 FR-016)
    const REFUSES = "src/scan/boundary.ts";
    const GIT_INCLUDE = "src/setup/host/apply.ts";
    // and the module that wraps it names where the user's global Git configuration is (`GIT_CONFIG_GLOBAL`, else `~/.gitconfig`) for that one include
    const GIT_INCLUDE_MODULE = "src/commands/setup.ts";
    for (const f of WORKSPACES) {
      const text = readTextFileSync(join(ROOT, f));
      // code with its comments taken out but its strings kept: a path named in a string is a path read or written
      const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      for (const re of f === REFUSES
        ? []
        : [
            /\.ssh\b/,
            ...(f === GIT_INCLUDE_MODULE ? [] : [/\.gitconfig\b/]),
            /\/etc\/gitconfig/,
            /--global\b/,
            /--system\b/,
            ...(f === GIT_INCLUDE_MODULE ? [/GIT_CONFIG_SYSTEM/] : [/GIT_CONFIG_GLOBAL|GIT_CONFIG_SYSTEM/]),
            /credential\.helper|\.git-credentials|keychain|keyring/i,
            /\.npmrc|\.zshenv|\.profile\b/,
          ]) {
        if (re.test(stripped)) bad.push(`${f}: ${re.source}`);
      }
      // every `git config` the library runs either reads (`--get`) or sets in the repository's own configuration (`--local`)
      for (const m of f === GIT_INCLUDE ? [] : stripped.matchAll(/"config"[^\n]*/g))
        if (!/--(?:local|get)/.test(stripped.slice(Math.max(0, (m.index ?? 0) - 120), (m.index ?? 0) + 200)))
          bad.push(`${f}: a git config that neither reads nor is --local`);
    }
    assertEquals(bad, []);
  },
);

proves(
  ["0004-onboarding FR-005"],
  "no code of the library writes a package manager's configuration or holds a token: the token is named ERGONEX_GITHUB_TOKEN and never held",
  () => {
    const bad: string[] = [];
    for (const f of WORKSPACES) {
      const text = code(readTextFileSync(join(ROOT, f)));
      if (
        /\.npmrc|bunfig\.toml|\.yarnrc/.test(
          readTextFileSync(join(ROOT, f))
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/(^|[^:])\/\/.*$/gm, "$1"),
        )
      )
        bad.push(`${f}: names a package manager's configuration`);
      if (/\bgh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(text)) bad.push(`${f}: a token in code`);
    }
    assertEquals(bad, []);
  },
);
