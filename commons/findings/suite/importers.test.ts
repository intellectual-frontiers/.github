// Spec: 0003-findings-importers FR-001
/**
 * Tests of the importers (commons findings 0003-findings-importers): a SARIF log, a ZAP report, a Burp report and a Nessus export, each with a secret planted where a tool puts what it saw, which must be in no finding; the choice of importer; and the reading of files and folders. Every name and value is made up.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { detectFormat, importBurp, importNessus, importReport, importSarif, importZap } from "../src/logical/mod.ts";
import { importPaths } from "../src/physical/mod.ts";

const SECRET = "hunter2-made-up-password";
const TOKEN = "ghp" + "_abcdefghijklmnopqrstuvwxyz0123456789ABCD";

const SARIF = JSON.stringify({
  version: "2.1.0",
  runs: [{
    tool: { driver: { name: "CodeScanner", version: "3.1", rules: [
      { id: "js/sql-injection", shortDescription: { text: "SQL injection" }, help: { text: "Use parameters." }, properties: { tags: ["security", "external/cwe/cwe-89"], "security-severity": "9.8" } },
      { id: "js/weak-hash", shortDescription: { text: "Weak hash" }, properties: { tags: ["external/cwe/cwe-327"] }, defaultConfiguration: { level: "warning" } },
      { id: "js/note", properties: {} },
    ] } },
    results: [
      { ruleId: "js/sql-injection", level: "error", message: { text: `Query built from input; token ${TOKEN}` }, locations: [{ physicalLocation: { artifactLocation: { uri: "src/db.js" }, region: { startLine: 42 } } }] },
      { ruleId: "js/weak-hash", message: { text: "MD5 used; see CVE-2024-0001" }, locations: [{ physicalLocation: { artifactLocation: { uri: "src/hash.js" }, region: { startLine: 7 } } }] },
      { ruleId: "js/note", level: "note", message: { text: "Just a note\nsecond line" } },
    ],
  }],
});

proves(["0003-findings-importers FR-001"], "a SARIF log gives a finding for each result with the severity from the score or the level, the weakness from the tags and the place as file and line, and a token in a message is redacted", () => {
  const r = importSarif("code.sarif", SARIF, "portal");
  assertEquals(r.problems, []);
  assertEquals(r.findings.map((f) => `${f.rule} ${f.severity} ${f.location ?? "-"} ${f.cwe.join()} ${f.asset}`), ["js/sql-injection critical src/db.js:42 CWE-89 portal", "js/weak-hash medium src/hash.js:7 CWE-327 portal", "js/note low -  portal"]);
  assertEquals(r.findings[0]?.source, { tool: "CodeScanner", version: "3.1", file: "code.sarif" });
  assertEquals(r.findings[0]?.solution, "Use parameters.");
  assertEquals(r.findings[1]?.cve, ["CVE-2024-0001"]);
  assertEquals(r.findings[2]?.title, "Just a note");
  assert(!JSON.stringify(r).includes(TOKEN));
  for (const [score, severity] of [[9, "critical"], [7.5, "high"], [4, "medium"], [0.1, "low"], [0, "info"]] as const) {
    const one = importSarif("x.sarif", JSON.stringify({ version: "2.1.0", runs: [{ tool: { driver: { name: "t" } }, results: [{ ruleId: "r", message: { text: "m" }, properties: { "security-severity": score } }] }] }), "a");
    assertEquals(one.findings[0]?.severity, severity, String(score));
  }
  assertEquals(importSarif("x", "not json", "a").problems.length, 1);
  assertEquals(importSarif("x", "{}", "a").problems.length, 1);
});

const ZAP = JSON.stringify({
  "@version": "2.15.0",
  site: [{
    "@name": "https://app.example.test", "@host": "app.example.test",
    alerts: [
      { pluginid: "40012", alert: "Cross Site Scripting (Reflected)", name: "Cross Site Scripting (Reflected)", riskcode: "3", desc: "<p>XSS is possible.</p>", solution: "<p>Encode output.</p>", cweid: "79", instances: [{ uri: "https://app.example.test/search?q=1", method: "GET", evidence: `<script>alert(1)</script> Cookie: session=${SECRET}` }, { uri: "https://app.example.test/find?q=2" }] },
      { pluginid: "10020", name: "Missing Anti-clickjacking Header", riskcode: "2", desc: "<p>No frame header.</p>", cweid: "1021", instances: [{ uri: "https://app.example.test/" }] },
      { pluginid: "10096", name: "Timestamp Disclosure", riskcode: "0", desc: "<p>Timestamp.</p>", cweid: "-1", instances: [] },
    ],
  }],
});

proves(["0003-findings-importers FR-002"], "a ZAP report gives a finding for each alert of each site by the risk code, the origin of the site as the asset, the first place and how many, and redacted evidence", () => {
  const r = importZap("zap.json", ZAP);
  assertEquals(r.problems, []);
  assertEquals(r.findings.map((f) => `${f.rule} ${f.severity} ${f.asset} ${f.location ?? "-"} ${f.cwe.join() || "-"}`), [
    "40012 high https://app.example.test https://app.example.test/search?q=1 CWE-79",
    "10020 medium https://app.example.test https://app.example.test/ CWE-1021",
    "10096 info https://app.example.test - -",
  ]);
  assertEquals(r.findings[0]?.description, "XSS is possible. (2 places)");
  assertEquals(r.findings[0]?.solution, "Encode output.");
  assertEquals(r.findings[0]?.source, { tool: "zap", version: "2.15.0", file: "zap.json" });
  assert(!JSON.stringify(r).includes(SECRET) && r.findings[0]?.evidence?.includes("Cookie: [redacted]"));
  assertEquals(importZap("x", "{}").problems.length, 1);
});

const BURP = `<?xml version="1.0"?>
<issues burpVersion="2025.5">
  <issue>
    <serialNumber>1</serialNumber>
    <type>5245344</type>
    <name>SQL injection</name>
    <host ip="192.0.2.5">https://shop.example.test</host>
    <path><![CDATA[/product]]></path>
    <location>/product [id parameter]</location>
    <severity>High</severity>
    <confidence>Certain</confidence>
    <issueBackground>&lt;p&gt;SQL injection is bad. See CVE-2024-1111.&lt;/p&gt;</issueBackground>
    <remediationBackground>&lt;p&gt;Use parameterized queries.&lt;/p&gt;</remediationBackground>
    <vulnerabilityClassifications>&lt;ul&gt;&lt;li&gt;&lt;a href="x"&gt;CWE-89: SQL Injection&lt;/a&gt;&lt;/li&gt;&lt;li&gt;CWE-943&lt;/li&gt;&lt;/ul&gt;</vulnerabilityClassifications>
    <requestresponse><request base64="true">${Buffer.from(`GET /product?id=1 HTTP/1.1\r\nAuthorization: Bearer ${SECRET}\r\n`).toString("base64")}</request></requestresponse>
  </issue>
  <issue>
    <type>1</type><name>Cookie without Secure flag</name><host>https://shop.example.test</host><path>/</path><severity>Information</severity>
  </issue>
</issues>`;

proves(["0003-findings-importers FR-003"], "a Burp report gives a finding for each issue with its severity, the host as the asset, the path as the place and the weaknesses of its classifications, and never reads a request or a response", () => {
  const r = importBurp("burp.xml", BURP);
  assertEquals(r.problems, []);
  assertEquals(r.findings.map((f) => `${f.rule} ${f.severity} ${f.asset} ${f.location ?? "-"} ${f.cwe.join()}`), ["5245344 high https://shop.example.test /product CWE-89,CWE-943", "1 info https://shop.example.test / "]);
  assertEquals(r.findings[0]?.cve, ["CVE-2024-1111"]);
  assertEquals(r.findings[0]?.solution, "Use parameterized queries.");
  assertEquals(r.findings[0]?.source.version, "2025.5");
  assert(!JSON.stringify(r).includes(SECRET) && !JSON.stringify(r).includes(Buffer.from(`GET /product`).toString("base64").slice(0, 12)));
  assertEquals(importBurp("x", "<a/>").problems.length, 1);
  assertEquals(importBurp("x", "<issues").problems.length, 1);
});

const NESSUS = `<?xml version="1.0"?>
<NessusClientData_v2>
  <Report name="weekly">
    <ReportHost name="athens.example.test">
      <HostProperties><tag name="host-ip">192.0.2.10</tag><tag name="credentials">${SECRET}</tag><tag name="operating-system">Linux</tag></HostProperties>
      <ReportItem port="443" svc_name="www" protocol="tcp" severity="4" pluginID="12345" pluginName="Example Server RCE">
        <synopsis>Remote code execution.</synopsis>
        <description>The server runs an old version. CVE-2024-2222 applies.</description>
        <solution>Upgrade to 2.0.</solution>
        <cve>CVE-2024-2222</cve><cve>CVE-2024-3333</cve>
        <cwe>94</cwe>
        <plugin_output>Banner: Example/1.0\nAuthorization: Bearer ${SECRET}</plugin_output>
      </ReportItem>
      <ReportItem port="0" svc_name="general" protocol="tcp" severity="0" pluginID="19506" pluginName="Scan Information">
        <synopsis>Info.</synopsis><description>Scan info.</description><solution>n/a</solution>
      </ReportItem>
      <ReportItem port="22" svc_name="ssh" protocol="tcp" severity="2" pluginID="10267" pluginName="SSH weak algorithms">
        <synopsis>Weak.</synopsis><description>Weak algorithms.</description><solution>Disable them.</solution>
      </ReportItem>
    </ReportHost>
  </Report>
</NessusClientData_v2>`;

proves(["0003-findings-importers FR-004"], "a Nessus export gives a finding for each item of each host with the severity, the port as the place, the CVEs and the weakness, redacted output, and never the properties of the host", () => {
  const r = importNessus("weekly.nessus", NESSUS);
  assertEquals(r.problems, []);
  assertEquals(r.findings.map((f) => `${f.rule} ${f.severity} ${f.asset} ${f.location ?? "-"}`), ["12345 critical athens.example.test 443/tcp", "19506 info athens.example.test -", "10267 medium athens.example.test 22/tcp"]);
  assertEquals(r.findings[0]?.cve, ["CVE-2024-2222", "CVE-2024-3333"]);
  assertEquals(r.findings[0]?.cwe, ["CWE-94"]);
  assertEquals(r.findings[0]?.solution, "Upgrade to 2.0.");
  assertEquals(r.findings[1]?.solution, undefined, "n/a is no solution");
  assert(!JSON.stringify(r).includes(SECRET), "neither the output nor the host properties");
  assert(r.findings[0]?.evidence?.includes("Authorization: [redacted]"));
  assertEquals(importNessus("x", "<a/>").problems.length, 1);
});

proves(["0003-findings-importers FR-005"], "the importer is chosen by what is in the report, a SARIF report needs the asset, and an unknown text is a problem", () => {
  assertEquals([SARIF, ZAP, BURP, NESSUS, "{}", "hello"].map((t) => detectFormat(t)), ["sarif", "zap", "burp", "nessus", undefined, undefined]);
  assertEquals(importReport("a.sarif", SARIF, "portal").findings.length, 3);
  assert(importReport("a.sarif", SARIF).problems[0]?.includes("give the asset"));
  assertEquals(importReport("a.json", ZAP).findings.length, 3);
  assertEquals(importReport("a.txt", "hello").problems.length, 1);
});

proves(["0003-findings-importers FR-006"], "a folder is walked and what no importer reads is skipped, a file named and unread is a problem, every finding gets its identity, and the same finding in two reports is one with the repeat counted", async () => {
  await fs.withTempDir(async (dir) => {
    await fs.mkdir(path.join(dir, "node_modules"), { recursive: true });
    await fs.writeTextFile(path.join(dir, "zap.json"), ZAP);
    await fs.writeTextFile(path.join(dir, "zap-again.json"), ZAP);
    await fs.writeTextFile(path.join(dir, "burp.xml"), BURP);
    await fs.writeTextFile(path.join(dir, "weekly.nessus"), NESSUS);
    await fs.writeTextFile(path.join(dir, "code.sarif"), SARIF);
    await fs.writeTextFile(path.join(dir, "package.json"), '{"name":"x"}');
    await fs.writeTextFile(path.join(dir, "node_modules", "zap.json"), ZAP);
    const r = await importPaths([dir], { asset: "portal" });
    assertEquals(r.problems, []);
    assertEquals(r.files.map((f) => `${path.basename(f.source)} ${f.format} ${f.findings}`), ["burp.xml burp 2", "code.sarif sarif 3", "weekly.nessus nessus 3", "zap-again.json zap 3", "zap.json zap 3"]);
    assertEquals(r.findings.length, 2 + 3 + 3 + 3);
    assertEquals(r.repeats, 3);
    assert(r.findings.every((f) => /^[0-9a-f]{16}$/.test(f.id)));
    assert(!JSON.stringify(r).includes(SECRET) && !JSON.stringify(r).includes(TOKEN));
    const named = await importPaths([path.join(dir, "package.json"), path.join(dir, "nothing.json")]);
    assertEquals(named.findings.length, 0);
    assertEquals(named.problems.length, 2);
    const noAsset = await importPaths([path.join(dir, "code.sarif")]);
    assertEquals(noAsset.problems.length, 1);
  });
});
