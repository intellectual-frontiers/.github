// Spec: 0004-scanners-run FR-001
/**
 * Tests of running a scanner (commons scanners 0004-scanners-run) with a real child process: a tool that is a small script that leaves a mark when it starts, so that the absence of the mark proves that it was not started. The engagement's say comes first, the pin is checked by digest, the arguments are a list and the
 * environment is bare, the output is read into findings about the asset, and every run has a record. Every name and value is made up.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { Pins } from "../src/governance/mod.ts";
import { runScanner, type Authorize, type RunInput } from "../src/physical/mod.ts";

const NOW = "2026-12-01T12:00:00Z";
const yes: Authorize = (asset, technique) => ({ allowed: true, reason: `${technique} on ${asset}` });
const no: Authorize = (asset, technique) => ({ allowed: false, reason: `the engagement does not allow ${technique} on ${asset}` });

const NUCLEI_LINE = JSON.stringify({ "template-id": "CVE-2024-9999", info: { name: "Example RCE", severity: "critical", classification: { "cve-id": ["CVE-2024-9999"] } }, host: "https://elsewhere.example.test", "matched-at": "https://elsewhere.example.test/x" });
const SARIF = JSON.stringify({ version: "2.1.0", runs: [{ tool: { driver: { name: "trivy" } }, results: [{ ruleId: "CVE-2024-1", level: "error", message: { text: "Vulnerable package" }, locations: [{ physicalLocation: { artifactLocation: { uri: "go.mod" }, region: { startLine: 3 } } }] }] }] });

async function sha256(file: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new Uint8Array(await fs.readFile(file)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A tool that leaves a mark of how it was started (its arguments, the working folder, whether a secret of this process reached it) and prints what it is told to. */
async function tool(dir: string, name: string, prints: string): Promise<{ readonly file: string; readonly mark: string; readonly pins: (version?: string) => Promise<Pins> }> {
  const file = path.join(dir, name);
  const mark = path.join(dir, `${name}.mark`);
  await fs.writeTextFile(file, `#!/bin/sh\n{ echo "args: $*"; echo "cwd: $(pwd)"; echo "home: $HOME"; echo "secret: \${OPSFOLIO_TEST_SECRET:-none}"; echo "path: $PATH"; } > '${mark}'\ncat <<'EOF'\n${prints}\nEOF\n`);
  await fs.chmod(file, 0o755);
  return { file, mark, pins: async (version = "1.0.0") => ({ [name]: { version, path: file, sha256: await sha256(file) } }) };
}

const input = (over: Partial<RunInput>): RunInput => ({ scanner: "nuclei", asset: "portal", target: { kind: "endpoint", value: "https://app.example.test" }, authorize: yes, pins: {}, now: NOW, ...over });

proves(["0004-scanners-run FR-001"], "a run is refused with the reason and a record, before anything else, for an unknown scanner, a target of the wrong kind or an unfit one, and a path that does not exist", async () => {
  const bad = [
    input({ scanner: "nope" }),
    input({ scanner: "nmap" }),
    input({ target: { kind: "endpoint", value: "https://app.example.test/a;b" } }),
    input({ scanner: "trivy", target: { kind: "path", value: "/no/such/folder" } }),
    input({ scanner: "trivy", target: { kind: "path", value: "../up" } }),
  ];
  const reasons: string[] = [];
  for (const i of bad) {
    const r = await runScanner(i);
    assert(r.kind === "err", i.scanner);
    assertEquals(r.error.record.refused, r.error.reason);
    assertEquals([r.error.record.asset, r.error.record.findings], ["portal", 0]);
    reasons.push(r.error.reason);
  }
  assert(reasons[0]?.includes("no scanner nope") && reasons[1]?.includes("scans a host") && reasons[2]?.includes("not an address") && reasons[3]?.includes("does not exist") && reasons[4]?.includes("not a path") === false);
});

proves(["0004-scanners-run FR-002"], "the engagement is asked first for the scanner's technique on the estate's asset, and a no starts nothing: the tool leaves no mark, even where it is not pinned", async () => {
  await fs.withTempDir(async (dir) => {
    const t = await tool(dir, "nuclei", NUCLEI_LINE);
    const asked: string[] = [];
    const spy: Authorize = (asset, technique) => (asked.push(`${asset} ${technique}`), no(asset, technique));
    const r = await runScanner(input({ authorize: spy, pins: await t.pins() }));
    assert(r.kind === "err" && r.error.reason.startsWith("not allowed: the engagement does not allow scan on portal"), JSON.stringify(r));
    assertEquals(asked, ["portal scan"]);
    assert(!(await fs.exists(t.mark)), "the tool was not started");
    const unpinned = await runScanner(input({ authorize: no, pins: {} }));
    assert(unpinned.kind === "err" && unpinned.error.reason.includes("not allowed"), "the engagement's no is the first answer, before the pin is looked at");
    const passive = await runScanner(input({ scanner: "trivy", target: { kind: "path", value: dir }, authorize: spy, pins: {} }));
    assert(passive.kind === "err");
    assertEquals(asked.at(-1), "portal passive");
  });
});

proves(["0004-scanners-run FR-003"], "a tool runs only when it has a pin and the file has the pinned digest: a missing pin, a missing file and a changed file are refused and the tool is not started", async () => {
  await fs.withTempDir(async (dir) => {
    const t = await tool(dir, "nuclei", NUCLEI_LINE);
    const none = await runScanner(input({ pins: {} }));
    assert(none.kind === "err" && none.error.reason.includes("has no pin") && none.error.reason.includes("opsfolio scan pin"));
    const pins = await t.pins("3.3.0");
    const missing = await runScanner(input({ pins: { nuclei: { ...(pins["nuclei"] as { version: string; path: string; sha256: string }), path: path.join(dir, "gone") } } }));
    assert(missing.kind === "err" && missing.error.reason.includes("does not exist") && missing.error.reason.includes("3.3.0"));
    const pinned = (pins["nuclei"] as { sha256: string }).sha256;
    await fs.writeTextFile(t.file, `#!/bin/sh\necho changed\n`);
    await fs.chmod(t.file, 0o755);
    const changed = await runScanner(input({ pins }));
    assert(changed.kind === "err", "a tool changed after it was pinned");
    assert(changed.error.reason.includes(pinned) && changed.error.reason.includes(await sha256(t.file)) && changed.error.reason.includes("is not the pinned nuclei 3.3.0"), changed.error.reason);
    assertEquals(changed.error.record.tool?.sha256, pinned);
    assert(!(await fs.exists(t.mark)), "no refused tool was started");
  });
});

proves(["0004-scanners-run FR-004"], "a tool is started with a list of arguments, in an empty folder that is removed afterwards, with a bare environment that holds no secret of the caller, and is stopped at its time limit", async () => {
  await fs.withTempDir(async (dir) => {
    process.env["OPSFOLIO_TEST_SECRET"] = "hunter2-made-up";
    try {
      const t = await tool(dir, "nmap", `<?xml version="1.0"?><nmaprun version="7.95"><host><address addr="192.0.2.10"/><ports><port protocol="tcp" portid="22"><state state="open"/><service name="ssh"/></port></ports></host></nmaprun>`);
      const r = await runScanner(input({ scanner: "nmap", target: { kind: "host", value: "synthetic-server-02.example.test" }, pins: await t.pins() }));
      assert(r.kind === "ok", JSON.stringify(r));
      const mark = await fs.readTextFile(t.mark);
      assert(mark.includes("args: -sV -Pn -T3 --top-ports 100 -oX - synthetic-server-02.example.test"), mark);
      assert(mark.includes("secret: none") && !mark.includes("hunter2"), "the caller's environment does not reach the tool");
      assert(mark.includes("path: /usr/local/bin:/usr/bin:/bin"), mark);
      const cwd = /cwd: (.*)/.exec(mark)?.[1] ?? "";
      assert(cwd.includes("opsfolio-scan-") && cwd !== dir, cwd);
      assertEquals(/home: (.*)/.exec(mark)?.[1], cwd);
      assert(!(await fs.exists(cwd)), "the working folder is removed afterwards");
    } finally {
      delete process.env["OPSFOLIO_TEST_SECRET"];
    }
    const slow = path.join(dir, "nuclei");
    await fs.writeTextFile(slow, "#!/bin/sh\nexec sleep 30\n");
    await fs.chmod(slow, 0o755);
    const started = Date.now();
    const r = await runScanner(input({ pins: { nuclei: { version: "1", path: slow, sha256: await sha256(slow) } }, timeoutMs: 400 }));
    assert(r.kind === "err" && r.error.reason.includes("printed nothing"), JSON.stringify(r));
    assert(Date.now() - started < 8000, "the tool was stopped at its time limit");
  });
});

proves(["0004-scanners-run FR-005"], "what a tool prints is read into findings about the estate's asset, an empty or unreadable output is a refusal, a path scanner's output file is read, and every run has a record", async () => {
  await fs.withTempDir(async (dir) => {
    const n = await tool(dir, "nuclei", NUCLEI_LINE);
    const r = await runScanner(input({ pins: await n.pins("3.3.0") }));
    assert(r.kind === "ok", JSON.stringify(r));
    assertEquals(r.value.findings.map((f) => `${f.rule} ${f.severity} ${f.asset} ${f.location}`), ["CVE-2024-9999 critical portal https://elsewhere.example.test/x"]);
    assertEquals(r.value.record, { scanner: "nuclei", asset: "portal", target: "https://app.example.test", technique: "scan", startedAt: NOW, tookMs: r.value.record.tookMs, tool: { name: "nuclei", version: "3.3.0", sha256: (await n.pins())["nuclei"]?.sha256 ?? "" }, exit: 0, findings: 1 });

    const tr = await tool(dir, "trivy", SARIF);
    const code = path.join(dir, "code");
    await fs.mkdir(code);
    const s = await runScanner(input({ scanner: "trivy", target: { kind: "path", value: code }, asset: "portal-app", pins: await tr.pins("0.58.0") }));
    assert(s.kind === "ok", JSON.stringify(s));
    assertEquals(s.value.findings.map((f) => `${f.rule} ${f.asset} ${f.location}`), ["CVE-2024-1 portal-app go.mod:3"]);
    assertEquals(s.value.record.technique, "passive");
    assert((await fs.readTextFile(tr.mark)).includes(`args: fs --format sarif --quiet ${code}`));

    const empty = await tool(dir, "grype", "");
    const e = await runScanner(input({ scanner: "grype", target: { kind: "path", value: code }, pins: await empty.pins() }));
    assert(e.kind === "err" && e.error.reason.includes("printed nothing to read") && e.error.record.exit === 0, JSON.stringify(e));
    const junk = await tool(dir, "semgrep", "this is not a report");
    const j = await runScanner(input({ scanner: "semgrep", target: { kind: "path", value: code }, pins: await junk.pins() }));
    assert(j.kind === "err" && j.error.reason.includes("not one an importer reads"), JSON.stringify(j));
  });
});

proves(["0004-scanners-run FR-005"], "the built-in check needs no pin, is asked as a probe, and gives findings about the asset from what the probe saw", async () => {
  const asked: string[] = [];
  const probe = async (url: string): Promise<{ answer: { status: number; headers: Record<string, string>; setCookies: string[] }; handshake: undefined }> => (asked.push(url), { answer: { status: 200, headers: {}, setCookies: [] }, handshake: undefined });
  const r = await runScanner(input({ scanner: "tls-check", authorize: (a, t) => (asked.push(`${a} ${t}`), yes(a, t)), probe }));
  assert(r.kind === "ok");
  assertEquals(asked, ["portal probe", "https://app.example.test"]);
  assertEquals(r.value.record.tool, undefined);
  assert(r.value.findings.length >= 4 && r.value.findings.every((f) => f.asset === "portal" && f.source.tool === "tls-check"));
  const down = await runScanner(input({ scanner: "tls-check", probe: async () => Promise.reject(new Error("connection refused")) }));
  assert(down.kind === "err" && down.error.reason.includes("could not reach") && down.error.reason.includes("connection refused"));
  const denied = await runScanner(input({ scanner: "tls-check", authorize: no, probe: async () => (asked.push("PROBED"), { answer: { status: 200, headers: {}, setCookies: [] }, handshake: undefined }) }));
  assert(denied.kind === "err" && !asked.includes("PROBED"), "a no sends nothing to the target");
});
