// Spec: 0002-libraries-ci-findings FR-003
/**
 * The parsers that read what a tool printed into findings (commons 0038-build-policy FR-013): one function for each tool of the closed table, pure over the text the tool wrote, so that each is tested on real output kept in the
 * test's fixtures. A parser reads what is there and makes nothing up; where a tool failed and printed nothing a parser can read, the wrapper makes the finding `no-output` of that tool, and a parser says nothing.
 *
 * @remarks
 * The key of a finding is the text that tells it from another of the same code in the same file and is never a line or a time, so that a finding that moves is the same finding (`findingId`). The tools' own formats: `tsc` (`file(line,col): error TSnnnn: message`),
 * `bun test` (`(fail) name [time]`, under a header line naming the file), the linter (`<error|warning file= line= column= rule=>` and the message), the formatter (a path for each file it would change), `repoctl check` (`[x] where: message [E-CODE]`), the
 * checks of Mizan and Kanon (`file:line: message`, `file:line: code: message`) and the generator's check (`file is not what the model makes`).
 *
 * @example
 * ```ts
 * import { parseOutput } from "./parsers.ts";
 * parseOutput("tsc", "a.ts(1,7): error TS2322: no", { module: "core", run: "1", commit: "c", step: "s", at: "2026-11-22T00:00:00Z" }).length; // 1
 * ```
 *
 * @module
 */
import { type Evidence, type Finding, makeFinding, type Severity, sha256Of } from "./findings.ts";
import type { Tool } from "./policy.ts";

/** What a parser needs to know of the run and the step it reads. */
export type ParseContext = { readonly module: string; readonly run: string; readonly commit: string; readonly step: string; readonly at: string };

type Draft = { readonly code: string; readonly file?: string; readonly line?: number; readonly severity: Severity; readonly message: string; readonly key: string };

const TSC = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/;
const TSC_GLOBAL = /^error (TS\d+): (.*)$/;

function tsc(out: string): readonly Draft[] {
  const drafts: Draft[] = [];
  for (const raw of out.split("\n")) {
    const line = raw.trimEnd();
    const m = TSC.exec(line);
    if (m !== null) drafts.push({ code: m[5] ?? "TS", file: m[1] ?? "", line: Number(m[2]), severity: m[4] === "warning" ? "warning" : "error", message: m[6] ?? "", key: `${m[5]}:${m[6]}` });
    else {
      const g = TSC_GLOBAL.exec(line);
      if (g !== null) drafts.push({ code: g[1] ?? "TS", severity: "error", message: g[2] ?? "", key: `${g[1]}:${g[2]}` });
    }
  }
  return drafts;
}

function bunTest(out: string): readonly Draft[] {
  const drafts: Draft[] = [];
  let file: string | undefined;
  for (const raw of out.split("\n")) {
    const line = raw.trimEnd();
    const header = /^(\S.*\.(?:test\.)?(?:ts|tsx|js|mjs)):$/.exec(line);
    if (header !== null) {
      file = header[1];
      continue;
    }
    const fail = /^\(fail\) (.*?)(?: \[[\d.]+m?s\])?$/.exec(line);
    const node = /^\s*✖ (.*?) \([\d.]+ms\)$/.exec(line);
    if (node !== null && !/failing tests:?$/.test(node[1] ?? "")) drafts.push({ code: "test-failed", ...(file === undefined ? {} : { file }), severity: "error", message: `the test failed: ${node[1]}`, key: node[1] ?? "" });
    if (fail !== null) drafts.push({ code: "test-failed", ...(file === undefined ? {} : { file }), severity: "error", message: `the test failed: ${fail[1]}`, key: fail[1] ?? "" });
    else if (/^error: test timed out/.test(line)) drafts.push({ code: "test-timeout", ...(file === undefined ? {} : { file }), severity: "error", message: line.slice(7), key: `timeout ${file ?? ""}` });
    else if (/^# Unhandled error between tests/.test(line)) drafts.push({ code: "unhandled-error", ...(file === undefined ? {} : { file }), severity: "error", message: "an unhandled error between tests", key: `unhandled ${file ?? ""}` });
  }
  return drafts;
}

function lint(out: string): readonly Draft[] {
  const drafts: Draft[] = [];
  const lines = out.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^<(error|warning) file="([^"]*)" line="(\d+)" column="\d+" rule="([^"]*)"[^>]*>$/.exec(lines[i] ?? "");
    if (m === null) continue;
    const message = (lines[i + 1] ?? "").trim();
    drafts.push({ code: m[4] ?? "lint", file: m[2] ?? "", line: Number(m[3]), severity: m[1] === "warning" ? "warning" : "error", message, key: `${m[4]}:${message}` });
  }
  return drafts;
}

function format(out: string): readonly Draft[] {
  const drafts: Draft[] = [];
  const path = /^[\w@./+-]+\.(?:ts|tsx|js|mjs|json|json5|md|yml|yaml|css|html)$/;
  for (const raw of out.split("\n")) {
    const line = raw.trim();
    if (path.test(line)) drafts.push({ code: "unformatted", file: line, severity: "warning", message: `${line} is not formatted`, key: line });
  }
  return drafts;
}

function repoctlCheck(out: string): readonly Draft[] {
  const drafts: Draft[] = [];
  for (const raw of out.split("\n")) {
    const m = /^\[x\] (.*) \[(E-[A-Z0-9-]+)\]$/.exec(raw.trimEnd());
    if (m === null) continue;
    const where = /^([^\s:]+?)(?::(\d+))?: (.*)$/.exec(m[1] ?? "");
    const message = where?.[3] ?? m[1] ?? "";
    drafts.push({ code: m[2] ?? "E", ...(where === null ? {} : { file: where[1] ?? "" }), ...(where?.[2] === undefined ? {} : { line: Number(where[2]) }), severity: "error", message, key: `${where?.[1] ?? ""}:${message}` });
  }
  return drafts;
}

function mizanCheck(out: string): readonly Draft[] {
  const drafts: Draft[] = [];
  for (const raw of out.split("\n")) {
    const line = raw.trimEnd();
    if (line === "" || /^(mizan|kanon|[a-z-]+-check)[\w-]*:/.test(line) || /^exit \d+$/.test(line)) continue;
    const m = /^([^\s:]+?)(?::(\d+))?: (.*)$/.exec(line);
    if (m === null || !/[./]/.test(m[1] ?? "")) continue;
    drafts.push({ code: "spec-format", file: m[1] ?? "", ...(m[2] === undefined ? {} : { line: Number(m[2]) }), severity: "error", message: m[3] ?? "", key: `${m[1]}:${m[3]}` });
  }
  return drafts;
}

function kanonCheck(out: string): readonly Draft[] {
  const drafts: Draft[] = [];
  for (const raw of out.split("\n")) {
    const m = /^([^\s:]+?):(\d+): ([a-z]+\/[a-z-]+): (.*)$/.exec(raw.trimEnd());
    if (m === null) continue;
    drafts.push({ code: m[3] ?? "kanon", file: m[1] ?? "", line: Number(m[2]), severity: "error", message: m[4] ?? "", key: `${m[1]}:${m[3]}:${m[4]}` });
  }
  return drafts;
}

function generatedFiles(out: string): readonly Draft[] {
  const drafts: Draft[] = [];
  for (const raw of out.split("\n")) {
    const m = /^(\S+) is not what the (?:model|register|generator) makes/.exec(raw.trimEnd());
    if (m !== null) drafts.push({ code: "stale-generated", file: m[1] ?? "", severity: "error", message: raw.trim(), key: m[1] ?? "" });
  }
  return drafts;
}

/** The drafts of a tool's output: what its parser reads (none for the tools that have no parser of their own). */
function draftsOf(tool: Tool, out: string): readonly Draft[] {
  switch (tool) {
    case "tsc":
      return tsc(out);
    case "bun-test":
      return bunTest(out);
    case "lint":
      return lint(out);
    case "format":
      return format(out);
    case "repoctl-check":
      return repoctlCheck(out);
    case "mizan-check":
      return mizanCheck(out);
    case "kanon-check":
      return kanonCheck(out);
    case "generated-files":
      return generatedFiles(out);
    case "verify":
      return [...tsc(out), ...bunTest(out), ...kanonCheck(out)];
    case "checks":
      return [...generatedFiles(out), ...repoctlCheck(out), ...kanonCheck(out), ...mizanCheck(out)];
    case "exit-status":
    case "install":
    case "policy":
      return [];
  }
}

/** The findings a tool's output holds, with their ids and their evidence (the SHA-256 of the output), in the order the tool printed them and without a finding twice. */
export function parseOutput(tool: Tool, output: string, ctx: ParseContext): readonly Finding[] {
  const evidence: Evidence = { run: ctx.run, commit: ctx.commit, step: ctx.step, logSha256: sha256Of(output) };
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const d of draftsOf(tool, output)) {
    const f = makeFinding({ tool, module: ctx.module, evidence, at: ctx.at, ...d });
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

/** The finding of a step that did not end as a tool does: it could not be started, it exited non-zero with nothing a parser reads, or the time limit stopped it (`tool-error`, `no-output`, `timeout`). */
export function outcomeFinding(tool: Tool, code: "tool-error" | "no-output" | "timeout", message: string, ctx: ParseContext, output: string): Finding {
  return makeFinding({ tool, code, module: ctx.module, severity: "error", message, key: `${ctx.step}:${code}`, evidence: { run: ctx.run, commit: ctx.commit, step: ctx.step, logSha256: sha256Of(output) }, at: ctx.at });
}
