// Spec: 0002-scanners-catalog FR-001, FR-002, FR-003
/**
 * The scanners that can be run, as data, and the command line each is given. A scanner has an identity, the tool it runs (none for the built-in check), the technique an engagement must allow for it (`passive` for the ones that read files and send nothing to a target, `probe` for a normal client's requests, `scan` for the ones that send
 * many), what it scans (an endpoint's address, a host, a path, an image), and how its output is read. A command line is made only from the scanner's own flags and a target that has passed its check: an address, a host name, a path or an image reference, never anything that begins with a dash or holds a space, a quote, a semicolon or a newline.
 * The tool is called with an argument vector and never through a shell.
 *
 * @example
 * ```ts
 * import { argvOf } from "./catalog.ts";
 * argvOf("nmap", { kind: "host", value: "synthetic-server-02.example.test" }, { outDir: "/tmp/x" }); // { kind: "ok", value: ["-sV", ...] }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** What a scanner scans. */
export type TargetKind = "endpoint" | "host" | "path" | "image";

/** A target: what it is and its text. */
export type Target = { readonly kind: TargetKind; readonly value: string };

/** A scanner. */
export type Scanner = {
  readonly id: string;
  /** The tool it runs, or nothing for the check that is built in. */
  readonly tool: string | undefined;
  /** The technique an engagement must allow: `passive` sends nothing to a target. */
  readonly technique: "passive" | "probe" | "scan";
  readonly target: TargetKind;
  readonly summary: string;
  /** Where the output is read from: the standard output, or a file the tool writes in the folder it is given. */
  readonly output: { readonly from: "stdout" } | { readonly from: "file"; readonly name: string } | { readonly from: "builtin" };
};

/** The scanners that can be run. */
export const SCANNERS: readonly Scanner[] = [
  { id: "tls-check", tool: undefined, technique: "probe", target: "endpoint", summary: "One TLS handshake and one HEAD request: the protocol, the certificate, and the security headers and cookie flags of the answer. Built in: no binary.", output: { from: "builtin" } },
  { id: "nuclei", tool: "nuclei", technique: "scan", target: "endpoint", summary: "Templates of known weaknesses, sent to the address, at a low rate.", output: { from: "stdout" } },
  { id: "nmap", tool: "nmap", technique: "scan", target: "host", summary: "The common ports of a host and the service on each open one.", output: { from: "stdout" } },
  { id: "zap-baseline", tool: "zap-baseline.py", technique: "scan", target: "endpoint", summary: "OWASP ZAP's baseline: a passive scan of what a crawl of the address returns.", output: { from: "file", name: "zap.json" } },
  { id: "trivy", tool: "trivy", technique: "passive", target: "path", summary: "Vulnerable packages, secrets and misconfigurations in a folder. Reads files; sends nothing to a target.", output: { from: "stdout" } },
  { id: "trivy-image", tool: "trivy", technique: "passive", target: "image", summary: "Vulnerable packages in a container image. Reads the image; sends nothing to a target.", output: { from: "stdout" } },
  { id: "grype", tool: "grype", technique: "passive", target: "path", summary: "Vulnerable packages in a folder.", output: { from: "stdout" } },
  { id: "semgrep", tool: "semgrep", technique: "passive", target: "path", summary: "Static analysis of source code.", output: { from: "stdout" } },
  { id: "checkov", tool: "checkov", technique: "passive", target: "path", summary: "Static analysis of infrastructure as code.", output: { from: "file", name: "results_sarif.sarif" } },
];

/** What cannot be run, and why. */
export const NOT_RUN: Readonly<Record<string, string>> = { mobsf: "MobSF is a server that is started and asked over an API: it is not run by a command line, and a scan of an app is a separate permission" };

/** A scanner by identity. */
export function scannerById(id: string): Scanner | undefined {
  return SCANNERS.find((s) => s.id === id);
}

const ENDPOINT = /^https?:\/\/[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::\d{1,5})?(?:\/[A-Za-z0-9._~/-]*)?$/;
const HOST = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const PATH = /^[A-Za-z0-9_./][A-Za-z0-9_ ./-]*$/;
const IMAGE = /^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/;

/** Whether a target is fit to be given to a tool: why not, or nothing. */
export function targetProblem(t: Target): string | undefined {
  const bad = (what: string): string => `${JSON.stringify(t.value)} is not ${what}`;
  switch (t.kind) {
    case "endpoint":
      return ENDPOINT.test(t.value) && t.value.length <= 300 ? undefined : bad("an address of the form http(s)://host[:port][/path], with no query, no credentials and no spaces");
    case "host":
      return HOST.test(t.value) && t.value.length <= 253 ? undefined : bad("a host name or an address (letters, digits, dots and hyphens)");
    case "path":
      return PATH.test(t.value) && !t.value.includes("..") && t.value.length <= 500 ? undefined : bad("a path (letters, digits, dots, slashes, hyphens, underscores and spaces; none begins with a dash or goes up a folder)");
    case "image":
      return IMAGE.test(t.value) && t.value.length <= 300 ? undefined : bad("an image reference (letters, digits and . _ / : @ -)");
  }
}

/** What the command line may depend on besides the target. */
export type ArgvOptions = { readonly outDir: string; readonly rate?: number; readonly ports?: string };

/** The arguments of a scanner for a target (the tool itself is not among them), or why they cannot be made. */
export function argvOf(id: string, target: Target, o: ArgvOptions): Result<readonly string[], string> {
  const scanner = scannerById(id);
  if (scanner === undefined) return err(`there is no scanner ${id} (${SCANNERS.map((s) => s.id).join(", ")})`);
  if (scanner.target !== target.kind) return err(`${id} scans ${scanner.target === "endpoint" ? "an endpoint" : `a ${scanner.target}`}, not ${target.kind === "endpoint" ? "an endpoint" : `a ${target.kind}`}`);
  const problem = targetProblem(target);
  if (problem !== undefined) return err(problem);
  const rate = Number.isInteger(o.rate) && (o.rate as number) >= 1 && (o.rate as number) <= 150 ? (o.rate as number) : 10;
  const t = target.kind === "path" && !target.value.startsWith("/") && !target.value.startsWith("./") ? `./${target.value}` : target.value;
  switch (id) {
    case "tls-check":
      return ok([]);
    case "nuclei":
      return ok(["-u", t, "-jsonl", "-silent", "-no-color", "-duc", "-rate-limit", String(rate), "-timeout", "10", "-retries", "0"]);
    case "nmap": {
      if (o.ports !== undefined && !/^\d{1,5}(-\d{1,5})?(,\d{1,5}(-\d{1,5})?)*$/.test(o.ports)) return err(`${JSON.stringify(o.ports)} is not a list of ports (22,80,8000-8100)`);
      return ok(["-sV", "-Pn", "-T3", ...(o.ports === undefined ? ["--top-ports", "100"] : ["-p", o.ports]), "-oX", "-", t]);
    }
    case "zap-baseline":
      return ok(["-t", t, "-J", `${o.outDir}/zap.json`, "-I", "-m", "2"]);
    case "trivy":
      return ok(["fs", "--format", "sarif", "--quiet", t]);
    case "trivy-image":
      return ok(["image", "--format", "sarif", "--quiet", t]);
    case "grype":
      return ok([`dir:${t}`, "-o", "sarif", "-q"]);
    case "semgrep":
      return ok(["scan", "--sarif", "--quiet", "--metrics=off", "--config", "auto", t]);
    case "checkov":
      return ok(["-d", t, "-o", "sarif", "--quiet", "--output-file-path", o.outDir]);
    default:
      return err(`no command line is made for ${id}`);
  }
}
