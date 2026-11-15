/**
 * Citations and links (commons 0011-documentation FR-011, FR-012): citations of commons' specifications become links, another
 * repository's stay text, and what does not resolve is a finding.
 *
 * @module
 */
import { assert, assertEquals, proves } from "../../ts/runtime/test.ts";
import type { Finding } from "../check.ts";
import { cite, hrefFor, type LinkIndex, linkFor } from "../links.ts";
import { plain } from "../model.ts";

const index: LinkIndex = {
  specs: new Map([["0009-sql-aide", new Set(["FR-001", "FR-026"])], ["0011-documentation", new Set(["FR-010"])]]),
  files: new Map([["commons/ts/data/sql-aide/mod.ts", "api/sql-aide/index.html"]]),
  exports: new Map([["sql-aide", new Map([["table", { path: "api/sql-aide/algebra-table.html", anchor: "table" }]])]]),
  blob: (p) => `https://github.example/${p}`,
};
const scope = { page: "x.html", file: "commons/ts/data/sql-aide/x.ts", area: "sql-aide", spec: "0009-sql-aide" };
const links = (xs: ReturnType<typeof cite>): string[] =>
  xs.flatMap((i) => (i.kind === "link" && i.href.kind === "page" ? [`${plain(i.children)}>${i.href.path}#${i.href.anchor ?? ""}`] : []));

proves(["0011-documentation FR-011"], "commons, bare and FR citations become links; another repository's stays text", () => {
  const found: Finding[] = [];
  const xs = cite("see commons 0009-sql-aide FR-026, (FR-001), 0011-documentation FR-010 and erga 009-machine-bootstrap FR-088", index, scope, found);
  assertEquals(links(xs), [
    "commons 0009-sql-aide>specs/0009-sql-aide.html#",
    "FR-026>specs/0009-sql-aide.html#fr-026",
    "FR-001>specs/0009-sql-aide.html#fr-001",
    "0011-documentation>specs/0011-documentation.html#",
    "FR-010>specs/0011-documentation.html#fr-010",
  ]);
  assert(plain(xs).endsWith("erga 009-machine-bootstrap FR-088"), "the other repository's citation is text");
  assertEquals(found, []);
});

proves(["0011-documentation FR-011", "0011-documentation FR-018"], "a specification or requirement commons does not have is a finding", () => {
  const found: Finding[] = [];
  cite("0099-nothing and 0009-sql-aide FR-999", index, scope, found);
  assertEquals(found.map((f) => f.problem.kind), ["unknown-spec", "unknown-requirement"]);
});

proves(["0011-documentation FR-012"], "{@link} goes to an export of the area or of a named area; an unknown name is a finding", () => {
  const found: Finding[] = [];
  const a = linkFor("table", undefined, index, scope, found)[0];
  const b = linkFor("sql-aide!table", "t", index, { ...scope, area: "kernel" }, found)[0];
  assertEquals(a?.kind === "link" && a.href.kind === "page" ? a.href.anchor : "", "table");
  assertEquals(b?.kind === "link" ? plain(b.children) : "", "t");
  linkFor("nothing", undefined, index, scope, found);
  assertEquals(found.map((f) => f.problem.kind), ["unknown-link"]);
});

proves(["0011-documentation FR-011"], "a link to a file goes to its page, a specification's file to its page, anything else to GitHub", () => {
  assertEquals(hrefFor("./mod.ts", index, scope), { kind: "page", path: "api/sql-aide/index.html" });
  assertEquals(hrefFor("../../spec-kit/specs/0009-sql-aide/spec.md", index, { ...scope, file: "commons/ts/data/x.ts" }), { kind: "page", path: "specs/0009-sql-aide.html" });
  assertEquals(hrefFor("./other.ts", index, scope), { kind: "external", url: "https://github.example/commons/ts/data/sql-aide/other.ts" });
});
