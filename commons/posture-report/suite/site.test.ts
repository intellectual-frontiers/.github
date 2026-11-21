/**
 * Tests of the report site (commons posture-report 0002-report-site FR-001 to FR-007): a made-up posture with a met requirement, one with a screenshot, one with nothing, a shared responsibility and a stray, shown on the index and the pages, the escaping of hostile text, no script and no address of anywhere,
 * the same bytes every time, and a site written to a folder.
 *
 * @module
 */
import { assess, gradeObjectives } from "@intellectual-frontiers/assessment/logical";
import type { Evidence, Objective } from "@intellectual-frontiers/assessment/governance";
import { fs, path } from "@intellectual-frontiers/system";
import { matrix } from "@intellectual-frontiers/tenancy/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { ReportInput } from "../src/governance/mod.ts";
import { buildSite, escapeHtml, pageName } from "../src/logical/mod.ts";
import { writeSite } from "../src/physical/mod.ts";

const NOW = "2026-11-21T12:00:00Z";
const F = "nist-800-171a-r2";
const OBJECTIVES: readonly Objective[] = [
  { id: "3.1.1[a]", requirement: "3.1.1", statement: "authorized users are identified." },
  { id: "3.1.1[b]", requirement: "3.1.1", statement: "devices are <script>alert(1)</script> identified." },
  { id: "3.1.2", requirement: "3.1.2", statement: "transactions are limited." },
  { id: "3.1.3", requirement: "3.1.3", statement: "flow is controlled." },
];
const ev = (o: Partial<Evidence> & { id: string }): Evidence => ({ framework: F, objective: "3.1.1[a]", method: "examine", result: "pass", by: { kind: "person", name: "Ann \"the\" <Assessor>" }, at: "2026-11-20T00:00:00Z", source: "doc:ssp & plan", determines: true, ...o });
const EVIDENCE: readonly Evidence[] = [
  ev({ id: "e1" }), ev({ id: "e2", objective: "3.1.1[b]" }),
  ev({ id: "e3", objective: "3.1.2", determines: false, origin: "screenshot" }),
  ev({ id: "e9", objective: "9.9[z]" }),
];
const input = (): ReportInput => ({
  title: "Acme <Corp> posture", generatedAt: NOW, framework: { id: F, title: "SP 800-171A" },
  assessment: assess(F, OBJECTIVES, EVIDENCE, NOW), grades: gradeObjectives(OBJECTIVES, EVIDENCE, NOW),
  responsibilities: matrix(F, ["3.1.1", "3.1.2", "3.1.3"], [{ framework: F, requirement: "3.1.1", who: "client" }, { framework: F, requirement: "3.1.2", who: "shared", note: "Client signs; provider enforces." }]),
  requirementTitles: { "3.1.1": "Limit system access" },
});

proves(["0002-report-site FR-001", "0002-report-site FR-002", "0002-report-site FR-003"], "the site has the index, the stylesheet, a page for each requirement and the data, and the index shows standings, counts, who answers, who is not named and the strays, with no percentage", () => {
  const site = buildSite(input());
  assertEquals([...site.keys()].sort(), ["index.html", "report.json", "requirements/3.1.1.html", "requirements/3.1.2.html", "requirements/3.1.3.html", "style.css"]);
  const index = site.get("index.html") ?? "";
  assert(index.includes('<a href="requirements/3.1.1.html">3.1.1</a>') && index.includes("Limit system access"));
  assert(index.includes('class="met">Met<') && index.includes("Partial") && index.includes("No evidence"), index);
  assert(index.includes("<td>client</td>") && index.includes("<td>shared</td>") && index.includes("not stated"));
  assert(index.includes("Nobody is named for") && index.includes("3.1.3"));
  assert(index.includes("Evidence for objectives this framework does not have") && index.includes("9.9[z]"));
  assert(index.includes("Weak: 1") && index.includes("Moderate: 2"), "grades are counted: a screenshot is weak, a person's word is moderate");
  assert(!/%|percent/i.test(index.replace("Read-only; every number is a count, and no percentage is given.", "")), "no percentage");
  const json = JSON.parse(site.get("report.json") ?? "{}") as { counts: Record<string, number>; requirements: { requirement: string; rollup: string }[] };
  assertEquals(json.requirements.map((r) => [r.requirement, r.rollup]), [["3.1.1", "met"], ["3.1.2", "partial"], ["3.1.3", "no-evidence"]]);
});

proves(["0002-report-site FR-004"], "a requirement's page gives each objective with its standing, grade and basis, a table of evidence, and who answers with the note", () => {
  const p = buildSite(input()).get("requirements/3.1.2.html") ?? "";
  assert(p.includes("3.1.2 ") && p.includes("Supported by tools") === false || p.includes("Partial"), p);
  assert(p.includes("rests on e3, screenshot, 1 days old") && p.includes('class="weak">weak<'));
  assert(p.includes("<th scope=\"col\">Source</th>") && p.includes("doc:ssp &amp; plan"));
  assert(p.includes("shared: Client signs; provider enforces."));
  const none = buildSite(input()).get("requirements/3.1.3.html") ?? "";
  assert(none.includes("No evidence recorded.") && none.includes("not stated"));
  const one = buildSite(input()).get("requirements/3.1.1.html") ?? "";
  assert(one.includes("3.1.1 Limit system access") && one.includes('id="3_1_1_a_"'));
});

proves(["0002-report-site FR-005", "0002-report-site FR-006"], "hostile text is escaped, file names are safe, there is no script and no address of anywhere, and the same input gives the same bytes", () => {
  assertEquals(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assertEquals(pageName("3.1.1"), "requirements/3.1.1.html");
  assertEquals(pageName("../../etc/passwd"), "requirements/.._.._etc_passwd.html");
  const site = buildSite(input());
  for (const [name, text] of site) {
    if (!name.endsWith(".html")) continue;
    assert(!text.includes("<script") && !/<script/i.test(text), `${name} has no script element`);
    assert(!/https?:\/\//.test(text) && !/(src|action)=/.test(text), `${name} reaches nowhere`);
    assert(text.startsWith("<!doctype html>") && text.includes('<html lang="en">') && /<title>.+<\/title>/.test(text) && text.includes("<h1>") && (!text.includes("<table>") || text.includes('scope="col"')), name);
  }
  assert((site.get("requirements/3.1.1.html") ?? "").includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert((site.get("index.html") ?? "").includes("Acme &lt;Corp&gt; posture"));
  assert(!(site.get("style.css") ?? "").includes("url("), "the stylesheet fetches nothing");
  assertEquals([...buildSite(input())], [...buildSite(input())]);
});

proves(["0002-report-site FR-007"], "a site is written under the folder in the order of its paths, and a path that leaves the site is refused", async () => {
  await fs.withTempDir(async (dir) => {
    const written = await writeSite(dir, buildSite(input()));
    assertEquals(written, ["index.html", "report.json", "requirements/3.1.1.html", "requirements/3.1.2.html", "requirements/3.1.3.html", "style.css"]);
    assertEquals(await fs.readTextFile(path.join(dir, "index.html")), buildSite(input()).get("index.html"));
    let refused = false;
    try {
      await writeSite(dir, new Map([["../escape.html", "x"]]));
    } catch {
      refused = true;
    }
    assert(refused && !(await fs.exists(path.join(dir, "..", "escape.html"))));
  });
});
