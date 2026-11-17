/**
 * The Trust page (commons 0022-trust FR-001 to FR-005, FR-007 to FR-009; 0021-ifqs FR-004), generated from a real temporary Git repository's
 * quality branch: every requirement with its grade and freshness, failures before successes, the scope and its refusal of a statement of
 * conformity, the stale notice, the three audiences and what each redacts (a private marker never reaches the public page), and the same bytes
 * for the same evidence. The console of 0021-ifqs FR-037 and the publication of FR-006 are not built here.
 *
 * @module
 */
import { audiences } from "../../ontology/ifqs/ifqs.ts";
import { collect } from "../quality/assessor/host.ts";
import { AUDIENCES, redactFor } from "../quality/trust/audience.ts";
import { conformityClaim, DEFAULT_SCOPE } from "../quality/trust/view.ts";
import { checkTrust, generateTrust, type TrustPage } from "../quality/trust/host.ts";
import { makeTempDir, readTextFile, remove, writeTextFile } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { needsGit, parsed, at, list } from "./quality-fixtures.ts";
import { DAY, demoEvidence, demoRepository, MARKER } from "./quality-trust-fixtures.ts";

const RULES = { terms: [MARKER] };

async function page(
  repo: string,
  audience: "Public" | "Assessor" | "Internal",
  extra: { today?: string; scopeNote?: string } = {},
): Promise<TrustPage> {
  const c = await collect({ repo, ...(extra.today === undefined ? {} : { today: extra.today }) });
  assert(c.kind === "ok", c.kind === "err" ? JSON.stringify(c.error) : "");
  const p = generateTrust(c.value, {
    harness: "demo harness",
    audience,
    rules: RULES,
    ...(extra.scopeNote === undefined ? {} : { scopeNote: extra.scopeNote }),
  });
  assert(p.kind === "ok", p.kind === "err" ? p.error : "");
  return p.value;
}

async function withDemo(f: (repo: string) => Promise<void>): Promise<void> {
  const repo = await makeTempDir({ prefix: "ifc-trust-" });
  try {
    await demoEvidence(repo, await demoRepository(repo));
    await f(repo);
  } finally {
    await remove(repo, { recursive: true });
  }
}

proves(
  ["0022-trust FR-001", "0022-trust FR-002", "0021-ifqs FR-004"],
  "the page is generated from the evidence: each requirement with its grade, freshness, day and run, the review debt, the objectives and the counts of passed, failed and not_run, and --check fails where a file differs",
  () =>
    withDemo(async (repo) => {
      const p = await page(repo, "Public");
      assertStringIncludes(p.html, "0099-demo FR-001");
      assertStringIncludes(p.html, "E3 tested");
      assertStringIncludes(p.html, "Review debt");
      assertStringIncludes(p.html, "not run");
      const json = parsed(p.json);
      assertEquals(at(json, "schema"), "ifqs-trust/1");
      assertEquals(at(json, "figures", "passed"), 3);
      assertEquals(at(json, "figures", "failed"), 1);
      assertEquals(at(json, "figures", "notRun"), 1);
      const first = list(at(json, "requirements")).find((r) => at(r, "id") === "0099-demo FR-001");
      assertEquals(at(first, "grade"), "E3");
      assertEquals(at(first, "freshness"), "Fresh");
      assertEquals(at(first, "day"), DAY);
      assertEquals(typeof at(first, "run"), "string");
      assert(list(at(json, "objectives")).length > 0, "the objectives with their budgets are shown");
      assertEquals(typeof at(json, "proof", "reviewDebt"), "number");
      // the page on disk is checked
      const html = join(repo, "trust.html");
      const jsonFile = join(repo, "trust.json");
      await writeTextFile(html, p.html);
      await writeTextFile(jsonFile, p.json);
      assertEquals((await checkTrust(p, { html, json: jsonFile })).kind, "ok");
      await writeTextFile(html, p.html.replace("E3 tested", "E5 observed"));
      const edited = await checkTrust(p, { html, json: jsonFile });
      assert(edited.kind === "err" && edited.error.includes("trust.html"), "a page edited by hand fails the check");
      // a repository with no evidence says so, every requirement at E0
      const empty = await makeTempDir({ prefix: "ifc-trust-empty-" });
      try {
        await demoRepository(empty);
        const none = await page(empty, "Public");
        assertStringIncludes(none.html, "No evidence is kept yet");
      } finally {
        await remove(empty, { recursive: true });
      }
    }),
  needsGit,
);

proves(
  ["0022-trust FR-003"],
  "failures are listed before any success: the failed case, the case that did not run, the open nonconformance with its age and its state",
  () =>
    withDemo(async (repo) => {
      const p = await page(repo, "Internal", { today: "2026-11-20" });
      const where = (s: string): number => p.html.indexOf(s);
      assert(
        where("Open nonconformances") > 0 && where("Open nonconformances") < where('<h2 id="figures">'),
        "open nonconformances come first",
      );
      assert(where("Failed cases") < where('<h2 id="figures">') && where("Failed cases") < where('<h2 id="requirements">'));
      assert(where("Cases that did not run") < where('<h2 id="figures">'));
      assertStringIncludes(p.html, "NC-0001");
      assertStringIncludes(p.html, "3 days");
      const json = parsed(p.json);
      assertEquals(at(json, "open", "failedCases"), 1);
      assertEquals(at(json, "open", "nonconformances"), 1);
      assertEquals(list(at(json, "failures")).length, 2, "nothing is dropped");
    }),
  needsGit,
);

proves(
  ["0022-trust FR-004"],
  "the page states its scope and what it does not cover, and the generator refuses a page that says the harness conforms, is certified or complies",
  () =>
    withDemo(async (repo) => {
      const p = await page(repo, "Public", { scopeNote: "The unit tests of the demo harness at one revision." });
      assertStringIncludes(p.html, "The unit tests of the demo harness at one revision.");
      assertStringIncludes(p.html, "It covers the harness above at revision");
      const c = await collect({ repo });
      assert(c.kind === "ok");
      for (const claim of [
        "The demo harness complies with ISO 9001.",
        "It is certified to a standard.",
        "Conforms to the control AC-2.",
        "This is a conformant harness.",
      ]) {
        const r = generateTrust(c.value, { harness: "demo", audience: "Public", rules: RULES, scopeNote: claim });
        assert(r.kind === "err" && r.error.includes("FR-004"), claim);
      }
      const named = generateTrust(c.value, {
        harness: "demo",
        audience: "Public",
        rules: RULES,
        notCovered: ["a statement that it is compliant"],
      });
      assertEquals(named.kind, "err");
      // the quality system's own word is not a claim, and the page's own sentences state none outside the one that denies it
      assertEquals(conformityClaim("an open nonconformance and a non-conformance"), undefined);
      assertEquals(conformityClaim(p.html.replace(DEFAULT_SCOPE, "").replace(/It does not state[^<]*/g, "")), undefined);
    }),
  needsGit,
);

proves(
  ["0022-trust FR-005"],
  "a page whose newest run is older than the cadence of a run says that it is stale and by how long",
  () =>
    withDemo(async (repo) => {
      const fresh = await page(repo, "Public", { today: "2026-12-01" });
      assert(!fresh.html.includes("This page is stale"), "14 days old is within the 30 days of a run");
      const stale = await page(repo, "Public", { today: "2026-12-30" });
      assertStringIncludes(stale.html, "This page is stale");
      assertStringIncludes(stale.html, "13 days past it");
      assertEquals(at(parsed(stale.json), "stale", "overdueDays"), 13);
    }),
  needsGit,
);

proves(
  ["0022-trust FR-007", "0022-trust FR-008", "0022-trust FR-009"],
  "a rendering is for one audience: the public page leaves out a customer's name, an address, a host and a failure's message and counts what it redacted, no figure changes between audiences, and the same evidence gives the same bytes",
  () =>
    withDemo(async (repo) => {
      assertEquals([...AUDIENCES].sort(), Object.keys(audiences).sort(), "the audiences are the code list of ifqs:Audience");
      const pub = await page(repo, "Public");
      const internal = await page(repo, "Internal");
      const assessor = await page(repo, "Assessor");
      for (const needle of [MARKER, "owner@customer.example", "db.customer.example", "expected the order"]) {
        assert(!pub.html.includes(needle) && !pub.json.includes(needle), `the public page leaves out ${needle}`);
      }
      assertStringIncludes(internal.html, "expected the order");
      assertStringIncludes(internal.html, "db.customer.example");
      assert(
        assessor.html.includes("expected the order") && !assessor.html.includes("owner@customer.example"),
        "an assessor sees the message with personal data redacted",
      );
      const redactions = at(parsed(pub.json), "redactions");
      assert(typeof redactions === "number" && redactions >= 4, `the public page counts its redactions (${String(redactions)})`);
      assertStringIncludes(pub.html, `${String(redactions)} values redacted`);
      // no figure changes: the counts, grades and digests are the wider audience's
      for (const key of ["figures", "proof", "requirements", "objectives", "head", "open"]) {
        assertEquals(JSON.stringify(at(parsed(pub.json), key)), JSON.stringify(at(parsed(internal.json), key)), key);
      }
      // the same evidence and audience give the same bytes
      const again = await page(repo, "Public");
      assertEquals(again.html, pub.html);
      assertEquals(again.json, pub.json);
      // the redaction of a text is deterministic and counted
      const a = redactFor("Public", RULES, `${MARKER} saw https://x.example/a and 10.0.0.1 in /home/ana/work and mail ana@example.com`);
      assertEquals(a.text, "REDACTED saw REDACTED and REDACTED in REDACTED and mail REDACTED");
      assertEquals(a.count, 5);
      assertEquals(redactFor("Public", RULES, `${MARKER}`), redactFor("Public", RULES, `${MARKER}`));
      assertEquals(
        redactFor("Internal", RULES, "token: abcdefghijkl1234").text.includes("abcdefghijkl1234"),
        false,
        "secrets are redacted for every audience",
      );
    }),
  needsGit,
);

proves(
  ["0022-trust FR-002"],
  "the page file is the one a reader's browser gets: one self-contained HTML document with embedded CSS, no script and no external resource",
  () =>
    withDemo(async (repo) => {
      const p = await page(repo, "Public");
      assert(p.html.startsWith("<!doctype html>"));
      assert(!/<script|<link |src=|href=["']http|@import|url\(/i.test(p.html), "no script and no external resource");
      assertStringIncludes(p.html, "prefers-color-scheme");
      assertEquals((await readTextFile(join(repo, "second.test.ts"))).length > 0, true);
    }),
  needsGit,
);
