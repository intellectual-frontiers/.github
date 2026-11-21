// Spec: 0002-findings-model FR-001
/**
 * Tests of what a finding is (commons findings 0002-findings-model): the severities, the redaction of evidence, the identity of a finding that survives a change of query string, and the helpers that read a weakness and a vulnerability. Every name and value is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { cvesIn, cweOf, fingerprintOf, identify, MAX_EVIDENCE, normalizeLocation, redact, SEVERITIES, type RawFinding } from "../src/governance/mod.ts";

const F = (over: Partial<RawFinding> = {}): RawFinding => ({ rule: "10020", title: "Missing header", severity: "medium", asset: "https://app.example.test", location: "https://app.example.test/login?next=%2Fhome", description: "d", cwe: [], cve: [], source: { tool: "zap", file: "a.json" }, ...over });

proves(["0002-findings-model FR-001"], "the severities run from the worst, and a weakness is read from a number or a text and none from 0 or -1", () => {
  assertEquals([...SEVERITIES], ["critical", "high", "medium", "low", "info"]);
  assertEquals([cweOf(79), cweOf("CWE-89"), cweOf("cwe_352"), cweOf("0"), cweOf(-1), cweOf(undefined), cweOf("none")], ["CWE-79", "CWE-89", "CWE-352", undefined, undefined, undefined, undefined]);
  assertEquals(cvesIn("see cve-2024-12345 and CVE-2023-0001, again CVE-2024-12345"), ["CVE-2024-12345", "CVE-2023-0001"]);
});

proves(["0002-findings-model FR-002"], "evidence is cut short and what looks like a credential is replaced", () => {
  const secret = "hunter2-made-up-password";
  const token = "ghp" + "_abcdefghijklmnopqrstuvwxyz0123456789ABCD";
  const text = `GET /a HTTP/1.1\nAuthorization: Bearer abc.def.ghi\nCookie: session=${secret}\nX-Api-Key: ${secret}\npassword=${secret}\nbody ${token}\nkey ${"A".repeat(60)}\n${"-----BEGIN" + " PRIVATE KEY-----"}\nMIImadeup\n${"-----END" + " PRIVATE KEY-----"}\nplain text stays`;
  const r = redact(text);
  for (const gone of [secret, token, "abc.def.ghi", "MIImadeup", "A".repeat(60)]) assert(!r.includes(gone), gone);
  assert(r.includes("Authorization: [redacted]") && r.includes("[redacted private key]") && r.includes("plain text stays") && r.includes("GET /a HTTP/1.1"), r);
  const long = redact("x ".repeat(1000));
  assertEquals(long.length, MAX_EVIDENCE + 3);
  assert(long.endsWith("..."));
  assertEquals(redact("short and plain"), "short and plain");
});

proves(["0002-findings-model FR-003"], "the identity of a finding survives a change of query string, differs by rule, asset, place and tool, and two of one identity are one with the repeats counted", async () => {
  assertEquals(normalizeLocation("https://a.example.test/x/?q=1#f"), "https://a.example.test/x");
  assertEquals(normalizeLocation(undefined), "");
  const a = await fingerprintOf(F());
  assert(/^[0-9a-f]{16}$/.test(a));
  assertEquals(await fingerprintOf(F({ location: "https://app.example.test/login?next=%2Fother" })), a);
  assertEquals(await fingerprintOf(F({ asset: "HTTPS://APP.EXAMPLE.TEST" })), a);
  for (const other of [F({ rule: "10021" }), F({ asset: "https://other.example.test" }), F({ location: "https://app.example.test/logout" }), F({ source: { tool: "burp", file: "a.xml" } })]) assert((await fingerprintOf(other)) !== a);
  const r = await identify([F(), F({ title: "again" }), F({ rule: "x" })]);
  assertEquals(r.findings.length, 2);
  assertEquals(r.repeats, 1);
  assertEquals(r.findings[0]?.title, "Missing header");
});
