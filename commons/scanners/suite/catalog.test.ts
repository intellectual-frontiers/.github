// Spec: 0002-scanners-catalog FR-001
/**
 * Tests of the catalog of scanners (commons scanners 0002-scanners-catalog): what can be run and what cannot, the checks a target passes before a tool sees it, the command line of each scanner as a list of arguments, and the pin of a binary. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { argvOf, NOT_RUN, parsePins, scannerById, SCANNERS, targetProblem } from "../src/governance/mod.ts";

/** The arguments of a scanner, or a failure of the test where there are none. */
function args(id: string, target: Parameters<typeof argvOf>[1], o: Parameters<typeof argvOf>[2] = { outDir: "/w" }): readonly string[] {
  const r = argvOf(id, target, o);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

proves(["0002-scanners-catalog FR-001"], "the scanners are data with the technique an engagement must allow, passive for the ones that read files, and what cannot be run says why", () => {
  assertEquals(SCANNERS.map((s) => s.id), ["tls-check", "nuclei", "nmap", "zap-baseline", "trivy", "trivy-image", "grype", "semgrep", "checkov"]);
  assertEquals(SCANNERS.filter((s) => s.technique === "passive").map((s) => s.id), ["trivy", "trivy-image", "grype", "semgrep", "checkov"]);
  assertEquals(scannerById("tls-check")?.tool, undefined);
  assertEquals(scannerById("tls-check")?.technique, "probe");
  assertEquals(scannerById("nuclei")?.technique, "scan");
  assert(NOT_RUN["mobsf"]?.includes("server"));
  assertEquals(scannerById("nope"), undefined);
  for (const s of SCANNERS) assert(s.summary !== "" && ["stdout", "file", "builtin"].includes(s.output.from), s.id);
});

proves(["0002-scanners-catalog FR-002"], "a target is refused unless it is fit for its kind, and one of the wrong kind is refused", () => {
  const ok = [{ kind: "endpoint", value: "https://app.example.test:8443/api/v1" }, { kind: "endpoint", value: "http://10.0.0.5" }, { kind: "host", value: "synthetic-server-02.example.test" }, { kind: "host", value: "192.0.2.10" }, { kind: "path", value: "/srv/code/portal" }, { kind: "path", value: "src/my app" }, { kind: "image", value: "registry.example.test/portal:1.4" }, { kind: "image", value: "alpine@sha256:abc123" }] as const;
  for (const t of ok) assertEquals(targetProblem(t), undefined, t.value);
  const bad = [{ kind: "endpoint", value: "https://a.example.test/x;rm -rf" }, { kind: "endpoint", value: "https://user:pw@a.example.test" }, { kind: "endpoint", value: "https://a.example.test/?q=1" }, { kind: "endpoint", value: "ftp://a.example.test" }, { kind: "endpoint", value: "https://a.example.test/a b" }, { kind: "endpoint", value: "-u https://a.example.test" }, { kind: "host", value: "-oX" }, { kind: "host", value: "a;b" }, { kind: "host", value: "a b" }, { kind: "path", value: "-rf" }, { kind: "path", value: "../etc" }, { kind: "path", value: "/a/../b" }, { kind: "path", value: "a\nb" }, { kind: "image", value: "-x" }, { kind: "image", value: "a b" }, { kind: "image", value: "a;b" }] as const;
  for (const t of bad) assert(targetProblem(t) !== undefined, t.value);
  const wrong = argvOf("nmap", { kind: "endpoint", value: "https://a.example.test" }, { outDir: "/w" });
  assert(wrong.kind === "err" && wrong.error.includes("scans a host"));
});

proves(["0002-scanners-catalog FR-003"], "the command line is a list of arguments from the scanner's own flags and a checked target, with a rate between 1 and 150, an explicit relative path and ports that are numbers", () => {
  const nuclei = argvOf("nuclei", { kind: "endpoint", value: "https://app.example.test" }, { outDir: "/w" });
  assert(nuclei.kind === "ok");
  assertEquals(nuclei.value, ["-u", "https://app.example.test", "-jsonl", "-silent", "-no-color", "-duc", "-rate-limit", "10", "-timeout", "10", "-retries", "0"]);
  for (const [rate, want] of [[5, "5"], [150, "150"], [0, "10"], [151, "10"], [2.5, "10"], [undefined, "10"]] as const) {
    const r = argvOf("nuclei", { kind: "endpoint", value: "https://a.example.test" }, { outDir: "/w", ...(rate === undefined ? {} : { rate }) });
    assert(r.kind === "ok" && r.value[r.value.indexOf("-rate-limit") + 1] === want, String(rate));
  }
  const nmap = argvOf("nmap", { kind: "host", value: "synthetic-server-02.example.test" }, { outDir: "/w" });
  assert(nmap.kind === "ok" && nmap.value.join(" ") === "-sV -Pn -T3 --top-ports 100 -oX - synthetic-server-02.example.test");
  const ports = argvOf("nmap", { kind: "host", value: "synthetic-server-02.example.test" }, { outDir: "/w", ports: "22,80,8000-8100" });
  assert(ports.kind === "ok" && ports.value.includes("22,80,8000-8100"));
  assert(argvOf("nmap", { kind: "host", value: "synthetic-server-02.example.test" }, { outDir: "/w", ports: "22; id" }).kind === "err");
  const trivy = argvOf("trivy", { kind: "path", value: "src/portal" }, { outDir: "/w" });
  assert(trivy.kind === "ok" && trivy.value.join(" ") === "fs --format sarif --quiet ./src/portal");
  assertEquals(args("trivy", { kind: "path", value: "/srv/portal" }, { outDir: "/w" }).at(-1), "/srv/portal");
  assertEquals(args("trivy-image", { kind: "image", value: "portal:1.4" }, { outDir: "/w" }), ["image", "--format", "sarif", "--quiet", "portal:1.4"]);
  assertEquals(args("grype", { kind: "path", value: "/srv/p" }, { outDir: "/w" })[0], "dir:/srv/p");
  assertEquals(args("checkov", { kind: "path", value: "/srv/p" }, { outDir: "/w" }).slice(-2), ["--output-file-path", "/w"]);
  assertEquals(args("zap-baseline", { kind: "endpoint", value: "https://a.example.test" }, { outDir: "/w" }).includes("/w/zap.json"), true);
  assert(argvOf("semgrep", { kind: "path", value: "/srv/p" }, { outDir: "/w" }).kind === "ok");
  assertEquals(args("tls-check", { kind: "endpoint", value: "https://a.example.test" }, { outDir: "/w" }), []);
  assert(argvOf("nope", { kind: "host", value: "a" }, { outDir: "/w" }).kind === "err");
  assert(argvOf("nuclei", { kind: "endpoint", value: "https://a.example.test/x;y" }, { outDir: "/w" }).kind === "err", "an unfit target gives no command line");
  for (const s of SCANNERS) {
    const t = s.target === "endpoint" ? { kind: "endpoint", value: "https://a.example.test" } : s.target === "host" ? { kind: "host", value: "a.example.test" } : s.target === "path" ? { kind: "path", value: "/srv/p" } : { kind: "image", value: "a:1" };
    const r = argvOf(s.id, t as never, { outDir: "/w" });
    assert(r.kind === "ok" && r.value.every((x) => typeof x === "string"), s.id);
  }
});

proves(["0002-scanners-catalog FR-004"], "a pin says the version, an absolute path and the SHA-256, and one that misses any is refused with every reason", () => {
  const good = { nuclei: { version: "3.3.0", path: "/opt/tools/nuclei", sha256: "a".repeat(64) } };
  const parsed = parsePins(good);
  assert(parsed.kind === "ok");
  assertEquals(parsed.value, good);
  const bad = parsePins({ nuclei: { version: "", path: "nuclei", sha256: "xyz" }, nmap: "no", trivy: { version: "0.50", path: "/opt/trivy", sha256: "b".repeat(64) } });
  assert(bad.kind === "err");
  assertEquals(bad.error.length, 4);
  for (const word of ["no version", "absolute", "64 hexadecimal", "nmap: a pin is"]) assert(bad.error.some((m) => m.includes(word)), word);
  assert(parsePins([]).kind === "err" && parsePins(null).kind === "err");
});
