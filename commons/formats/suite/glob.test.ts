/**
 * Tests of `glob.ts`: a table of globs and paths written from what `@std/path`'s `globToRegExp` documents (wildcards, globstar,
 * classes, alternatives, extglob groups, escapes, separators), the options, the refused `!`, `isGlob` and `globRoot`.
 *
 * @module
 */
import fc from "fast-check";
import { formatGlobError, globRoot, globToRegExp, isGlob, matchGlob, type GlobOptions } from "../src/glob.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const FR = "0001-formats FR-017";

/** A glob, the paths it matches and the paths it does not. */
type Case = readonly [glob: string, matches: readonly string[], misses: readonly string[], options?: GlobOptions];

const CASES: readonly Case[] = [
  // `*`: any characters within one segment.
  ["*.ts", ["a.ts", ".ts", "mod.test.ts"], ["a.js", "src/a.ts", "a.tsx"]],
  ["src/*", ["src/a", "src/a.ts", "src/"], ["src", "src/a/b", "srcx/a"]],
  ["a*b", ["ab", "axxb"], ["a/b", "axb/c"]],
  // `**` alone in a segment: any number of segments.
  ["src/**/*.ts", ["src/a.ts", "src/a/b/c.ts", "src/a/b.ts"], ["srcx/a.ts", "src/a.js", "a.ts"]],
  ["**/*.md", ["a.md", "x/y/z.md"], ["a.mdx"]],
  ["a/**", ["a/", "a/b", "a/b/c"], ["b/a", "ab"]],
  ["a/**/b", ["a/b", "a/x/b", "a/x/y/b"], ["a/x/c", "ab"]],
  ["a**/b", ["a/b", "axx/b"], ["a/x/b"]],
  ["src/**/*.ts", [], ["src/a/b/c.ts"], { globstar: false }],
  ["src/**/*.ts", ["src/a/c.ts"], ["src/a.ts"], { globstar: false }],
  // `?`: one character, never `/`.
  ["?.ts", ["a.ts", "b.ts"], [".ts", "ab.ts", "/.ts"]],
  ["a?b", ["axb"], ["a/b", "ab"]],
  // Character classes.
  ["[abc].txt", ["a.txt", "c.txt"], ["d.txt", "ab.txt"]],
  ["[a-c]x", ["bx"], ["dx"]],
  ["[!abc].txt", ["d.txt", "z.txt"], ["a.txt", "/.txt"]],
  ["[^a]", ["^", "a"], ["b"]],
  ["[[:digit:]][[:upper:]]", ["1A"], ["a1", "Aa"]],
  ["[[:alpha:][:digit:]]", ["a", "7"], ["-"]],
  ["[[:punct:]]", ["!", "/", "~", "["], ["a", "0", " "]],
  ["[\\]]", ["]"], ["\\"]],
  // `{a,b}`: alternatives, also nested and with wildcards.
  ["*.{js,ts}", ["a.js", "a.ts"], ["a.md", "a.{js,ts}"]],
  ["{a,b{c,d}}", ["a", "bc", "bd"], ["b", "ac"]],
  ["{src,test}/*.ts", ["src/a.ts", "test/b.ts"], ["lib/a.ts"]],
  ["a{,.min}.js", ["a.js", "a.min.js"], ["a.max.js"]],
  // Extglob groups (on by default).
  ["?(a|b).ts", [".ts", "a.ts", "b.ts"], ["ab.ts"]],
  ["*(a|b).ts", [".ts", "abba.ts"], ["c.ts"]],
  ["+(a|b).ts", ["a.ts", "abba.ts"], [".ts"]],
  ["@(a|b).ts", ["a.ts", "b.ts"], ["ab.ts", ".ts"]],
  ["!(a|b).ts", ["c.ts", "xa.ts"], ["a.ts", "b.ts"]],
  ["x!(a).ts", ["xb.ts"], ["xa.ts"]],
  ["+(a).ts", ["+(a).ts"], ["a.ts"], { extended: false }],
  ["@(a).ts", ["@(a).ts"], ["a.ts"], { extended: false }],
  // Escapes and characters a regular expression would read.
  ["\\*.ts", ["*.ts"], ["a.ts"]],
  ["a\\?", ["a?"], ["ab"]],
  ["a.b", ["a.b"], ["axb"]],
  ["a+b(c)$^=|", ["a+b(c)$^=|"], ["aab(c)$^=|"]],
  ["x!y", ["x!y"], ["xy"]],
  // A segment that does not close is taken as written.
  ["a[b", ["a[b"], ["ab"]],
  ["a{b", ["a{b"], ["ab"]],
  ["{a/b}", ["{a/b}"], ["a", "b"]],
  ["a\\", ["a\\"], ["a"]],
  // Separators: runs are one, a trailing one is optional, a leading one anchors at the root.
  ["a//b", ["a/b", "a//b"], ["ab"]],
  ["a/b/", ["a/b", "a/b/"], ["a/b/c"]],
  ["/a/*", ["/a/b"], ["a/b", "/a/b/c"]],
  ["/", ["/", "//"], ["", "a"]],
  // Case.
  ["*.TS", ["a.TS"], ["a.ts"]],
  ["*.TS", ["a.ts", "A.Ts"], ["a.js"], { caseInsensitive: true }],
  // The empty glob matches nothing.
  ["", [], ["", "a", "/"]],
];

proves([FR], "a table of globs matches the paths @std/path's semantics give it, and no others", () => {
  for (const [glob, matches, misses, options] of CASES) {
    for (const path of matches) assertEquals(matchGlob(glob, path, options), { kind: "ok", value: true }, `${glob} should match ${path}`);
    for (const path of misses)
      assertEquals(matchGlob(glob, path, options), { kind: "ok", value: false }, `${glob} should not match ${path}`);
  }
});

proves([FR], "the edge case of the specification: src/**/*.ts", () => {
  assertEquals(matchGlob("src/**/*.ts", "src/a/b/c.ts"), { kind: "ok", value: true });
  assertEquals(matchGlob("src/**/*.ts", "srcx/a.ts"), { kind: "ok", value: false });
});

proves([FR], "a leading ! that is not an extglob group is refused", () => {
  const r = globToRegExp("!*.ts");
  assertEquals(r, { kind: "err", error: { kind: "negated", glob: "!*.ts" } });
  if (r.kind === "err") assert(formatGlobError(r.error).includes("!*.ts"));
  assertEquals(globToRegExp("!(a).ts", { extended: false }).kind, "err");
  assertEquals(matchGlob("\\!a", "!a"), { kind: "ok", value: true });
  assertEquals(globToRegExp("!(a).ts").kind, "ok");
});

proves([FR], "a glob of plain characters matches itself and nothing else", () => {
  const plain = fc.stringMatching(/^[a-z0-9._-]{1,8}(\/[a-z0-9._-]{1,8}){0,3}$/);
  fc.assert(
    fc.property(plain, plain, (a, b) => {
      assertEquals(isGlob(a), false);
      assertEquals(matchGlob(a, a), { kind: "ok", value: true });
      assertEquals(matchGlob(a, b), { kind: "ok", value: a === b });
    }),
  );
});

proves([FR], "* never crosses a /, and **/ crosses any number of them", () => {
  const seg = fc.stringMatching(/^[a-z]{1,6}$/);
  fc.assert(
    fc.property(fc.array(seg, { minLength: 1, maxLength: 5 }), (parts) => {
      const path = parts.join("/");
      assertEquals(matchGlob("*", path), { kind: "ok", value: parts.length === 1 });
      assertEquals(matchGlob("**", path), { kind: "ok", value: true });
      assertEquals(matchGlob("**/*", path), { kind: "ok", value: true });
      assertEquals(matchGlob(parts.map(() => "*").join("/"), path), { kind: "ok", value: true });
    }),
  );
});

proves([FR], "isGlob tells a glob from a path; globRoot gives the folder a walk starts from", () => {
  for (const g of ["*.ts", "a?", "[ab]", "{a,b}", "+(a)", "@(a)", "!(a)", "!a", "src/**/x"]) assert(isGlob(g), g);
  for (const p of ["a.ts", "src/a/b", "a\\*", "a[", "a{b", "a(b)", "x!y", ""]) assert(!isGlob(p), p);
  assertEquals(globRoot("src/**/*.ts"), "src");
  assertEquals(globRoot("src/lib/*.ts"), "src/lib");
  assertEquals(globRoot("*.ts"), ".");
  assertEquals(globRoot("a.ts"), ".");
  assertEquals(globRoot("a/b.ts"), "a");
  assertEquals(globRoot("/etc/*.conf"), "/etc");
  assertEquals(globRoot("/*"), "/");
  assertEquals(globRoot("a\\*b/c/*"), "a*b/c");
});
