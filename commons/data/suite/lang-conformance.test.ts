/**
 * The conformance of the dialects (commons data 0069-sql-dialects FR-006 to FR-009): statements taken from open-source test suites, with their provenance and licenses; the invariants that hold for every one of them in
 * its dialect; and the number each file reads, which a ratchet holds so that it only rises.
 *
 * Spec: 0069-sql-dialects FR-006, FR-007, FR-008, FR-009
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ansi, lex, type Node, parse, rewriteScript, type Script, walk } from "@intellectual-frontiers/data/sql/lang";
import { toUnist } from "@intellectual-frontiers/data/sql/lang/extensions/unist";
import { CORPUS, corpusFiles, dialectOf, readAll, readBaseline, regressions } from "../tools/conformance-lang.ts";
import { DIALECT_NAMES, ROOT, wholeness } from "./lang-fixture.ts";

const rows = (): readonly Record<string, string>[] => {
  const [head, ...lines] = readFileSync(join(CORPUS, "PROVENANCE.tsv"), "utf8")
    .split("\n")
    .filter((l) => l !== "");
  const keys = (head ?? "").split("\t");
  return lines.map((l) => Object.fromEntries(l.split("\t").map((v, i) => [keys[i] ?? String(i), v])));
};

const PERMISSIVE = /^(MIT|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|ISC|PostgreSQL|CC0-1\.0|Unlicense|public domain)\b/;

/** A number that says which nodes a tree has and where, so that two parses can be told to be the same without writing both as text. */
function fingerprint(root: Node): number {
  let h = 17;
  walk(root, {
    enter: (n) => {
      h = (Math.imul(h, 31) + n.kind.length * 7 + n.start * 3 + n.end) | 0;
      return undefined;
    },
  });
  return h;
}

proves(
  ["0069-sql-dialects FR-006"],
  "every corpus file has a row of provenance with its repository, commit, license and statements, the license is permissive and its text is kept, and what is included is in the register of third-party files",
  () => {
    const files = corpusFiles().map(([p]) => p);
    assert(files.length >= 200, `${files.length} corpus files`);
    const provenance = rows();
    const listed = provenance.filter((r) => r["path"] !== "-");
    assertEquals(listed.map((r) => r["path"]).sort(), [...files].sort(), "a row for each file and a file for each row");
    const notices = readFileSync(join(ROOT, "../../THIRD_PARTY_NOTICES.md"), "utf8");
    const sources = new Set<string>();
    for (const r of listed) {
      assert(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(r["repo"] ?? ""), `${r["path"]}: a repository`);
      assert(/^[0-9a-f]{40}$/.test(r["sha"] ?? ""), `${r["path"]}: a commit`);
      assert(PERMISSIVE.test(r["spdx"] ?? ""), `${r["path"]}: ${r["spdx"]} is not a permissive license`);
      assert(
        (r["licpath"] ?? "") !== "" && Number(r["statements"]) > 0 && Number(r["bytes"]) > 0 && (r["how"] ?? "") !== "",
        `${r["path"]}: its row is complete`,
      );
      sources.add(r["path"]?.split("/")[0] ?? "");
    }
    assertEquals([...sources].sort(), [
      "calcite",
      "clickhouse",
      "duckdb",
      "postgres_regress",
      "spark",
      "sqlglot",
      "sqllogictest",
      "starrocks",
    ]);
    for (const s of sources) {
      assert(existsSync(join(CORPUS, "LICENSES", `${s}.txt`)), `${s}: the license text is kept`);
      assert(readFileSync(join(CORPUS, "LICENSES", `${s}.txt`), "utf8").length > 200, `${s}: the license text is there`);
      assert(notices.includes(`commons/data/suite/corpus/${s}`), `${s} is in THIRD_PARTY_NOTICES.md`);
    }
    for (const [path] of corpusFiles()) {
      const text = readFileSync(join(CORPUS, path), "utf8");
      assert(text.endsWith("\n") && !text.includes("\u0000"), `${path}: ends with a new line, no NUL`);
      assert(text.length <= 600_000, `${path}: at most 600 KB`);
    }
  },
);

proves(
  ["0069-sql-dialects FR-007"],
  "for every statement of every corpus in its dialect the lexer and the parser do not throw, every character is in a token, a comment or white space, ranges nest, comments are attached once, the projection and a rewrite with no rules hold, and a second run gives the same",
  () => {
    let statements = 0;
    for (const [path, name] of corpusFiles()) {
      const d = name === "ansi" ? ansi : dialectOf(name);
      assert(d !== undefined, `${path}: its dialect`);
      const text = readFileSync(join(CORPUS, path), "utf8");
      const lexed = lex(text, d.compiled);
      assertEquals(wholeness(lexed), undefined, `${path}: the parts of the text`);
      const p = parse(text, d);
      statements += p.script.statements.length;
      assertEquals(p.attachments.all.length, p.comments.length, `${path}: every comment is attached once`);
      walk(p.script, {
        enter: (n, parent) => {
          assert(n.start <= n.end, `${path}: ${n.kind} ends before it begins`);
          if (parent !== undefined)
            assert(parent.start <= n.start && n.end <= parent.end, `${path}: ${n.kind}@${n.start}-${n.end} is outside ${parent.kind}`);
          return undefined;
        },
      });
      assertEquals(fingerprint(parse(text, d).script), fingerprint(p.script), `${path}: the same on a second run`);
      assert(rewriteScript(p.script, {}) === p.script, `${path}: a rewrite with no rules is the same tree`);
      // the projection holds for a whole file where it is small and for its first statements where it is not
      const first = p.script.statements.slice(0, 300);
      const last = first[first.length - 1];
      const prefix = parse(text.slice(0, (last?.end ?? 0) + 1), d);
      const tree = toUnist(prefix);
      assert(tree.type === "script" && Array.isArray(tree.children), `${path}: the projection is a tree`);
    }
    assert(statements > 60_000, `${statements} statements were read`);
  },
);

proves(
  ["0069-sql-dialects FR-008"],
  "the number of statements each file reads with no error does not fall below the baseline, the lexer's errors do not rise above it, and every file has a row",
  () => {
    const results = readAll();
    assert(results.length >= 200);
    assertEquals(regressions(results, readBaseline()), []);
    const total = results.reduce((n, r) => n + r.statements, 0);
    const ok = results.reduce((n, r) => n + r.ok, 0);
    assert(ok / total > 0.75, `${((100 * ok) / total).toFixed(1)}% of ${total} statements are read`);
  },
);

proves(["0069-sql-dialects FR-009"], "every dialect is read in a corpus of its own, or is listed as an exception in the provenance", () => {
  const have = new Set(corpusFiles().map(([, d]) => d));
  const exceptions = rows().filter((r) => r["path"] === "-");
  for (const n of DIALECT_NAMES) {
    const excused = exceptions.some((r) => (r["how"] ?? "").startsWith(`${n}:`));
    assert(have.has(n) || excused, `${n} has neither a corpus nor an exception`);
  }
  assert(have.has("ansi"));
  assert(
    [...have].every((d) => d === "ansi" || DIALECT_NAMES.includes(d)),
    "no corpus is for an unknown dialect",
  );
  const c = (n: string): number => corpusFiles().filter(([, d]) => d === n).length;
  assert(
    c("postgres") >= 2 &&
      c("duckdb") >= 2 &&
      c("clickhouse") >= 2 &&
      c("mysql") >= 1 &&
      c("tsql") >= 1 &&
      c("snowflake") >= 1 &&
      c("bigquery") >= 1,
    "the large dialects have several",
  );
  const script: Script = parse("SELECT 1").script;
  assertEquals(script.statements.length, 1);
});
