/**
 * The files GitHub reads, made from the typed model (commons 0030-generated-workflows FR-001, FR-004): `renderWorkflow` and `renderAction` give the YAML of a workflow and of a composite action as text, the
 * same bytes for the same values, each beginning with a line that says it is generated and by what.
 *
 * @remarks
 * The YAML written is the small part of it that GitHub's files need: mappings in the order the model gives, lists, scalars, comments and literal blocks for a script of more than one line. A scalar is written as it is where
 * a YAML reader would read it as the same string, and in double quotes (JSON's) where it would read it as a number, a boolean, a null or a mapping. A script of one line is a scalar; one of several lines is a literal block that
 * keeps its last newline (`|`) or drops it (`|-`) as the script has it.
 *
 * @limits
 * It writes and never reads; the parity of a rendering with a file that was written by hand is a comparison of what a YAML reader makes of the two (`tests/commons-workflows-schema.test.ts`).
 *
 * @example
 * ```ts
 * import { renderWorkflow } from "./render.ts";
 * import { job, run, use } from "./model.ts";
 * renderWorkflow({ file: "x", name: "x", on: { push: {} }, jobs: { t: job({ runsOn: "ubuntu-latest", timeoutMinutes: 5, steps: [use("actions/checkout@v4"), run("bun test")] }) } }).includes("runs-on: ubuntu-latest"); // true
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { CompositeAction, Filter, Job, Permissions, Scalar, Step, Workflow } from "./model.ts";

/** The command that writes the files, named in the first line of each. */
export const GENERATOR = "bun commons/ts/tools/generate-workflows.ts";

const RESERVED = /^(?:true|false|null|yes|no|on|off|y|n|~)$/i;
const PLAIN = /^[A-Za-z_./][A-Za-z0-9_ ./@-]*$/;

/** A scalar as YAML: plain where it is read back as the same string, otherwise in double quotes. */
export function scalar(v: Scalar): string {
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (PLAIN.test(v) && !RESERVED.test(v) && !/^[-+]?(?:\d|\.\d)/.test(v) && !v.endsWith(" ") && !v.startsWith(" ")) return v;
  // an expression, which GitHub's own examples write as it is: plain where nothing in the text would end a plain scalar
  if (v.includes("${{") && !v.startsWith(" ") && !v.endsWith(" ") && !/: | #|"|\n|^[[{!&*|>%@`'-]/.test(v)) return v;
  return JSON.stringify(v);
}

/** A key as YAML: the names GitHub uses are plain, anything else is quoted. */
function key(k: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(k) ? k : JSON.stringify(k);
}

const pad = (n: number): string => " ".repeat(n);

function comment(text: string | undefined, n: number): string[] {
  return text === undefined ? [] : text.split("\n").map((l) => (l === "" ? `${pad(n)}#` : `${pad(n)}# ${l}`));
}

/** `name: value` at an indent, a literal block where the value is a script of several lines. */
function entry(k: string, v: Scalar, n: number): string[] {
  if (typeof v === "string" && v.includes("\n")) {
    const keep = v.endsWith("\n") ? "|" : "|-";
    const body = (v.endsWith("\n") ? v.slice(0, -1) : v).split("\n");
    return [`${pad(n)}${key(k)}: ${keep}`, ...body.map((l) => (l === "" ? "" : `${pad(n + 2)}${l}`))];
  }
  return [`${pad(n)}${key(k)}: ${scalar(v)}`];
}

function mapping(k: string, m: Readonly<Record<string, Scalar>> | undefined, n: number): string[] {
  if (m === undefined || Object.keys(m).length === 0) return [];
  return [`${pad(n)}${key(k)}:`, ...Object.entries(m).flatMap(([a, b]) => entry(a, b, n + 2))];
}

function list(k: string, items: readonly (string | number)[], n: number): string[] {
  return [`${pad(n)}${key(k)}:`, ...items.map((i) => `${pad(n + 2)}- ${scalar(i)}`)];
}

function flowList(k: string, items: readonly (string | number)[], n: number): string[] {
  return [`${pad(n)}${key(k)}: [${items.map((i) => scalar(i)).join(", ")}]`];
}

function permissions(p: Permissions | undefined, n: number): string[] {
  return mapping("permissions", p, n);
}

function filter(k: string, f: Filter | undefined, n: number): string[] {
  if (f === undefined) return [];
  const inner = [
    ...(f.branches === undefined ? [] : flowList("branches", f.branches, n + 2)),
    ...(f.paths === undefined ? [] : list("paths", f.paths, n + 2)),
    ...(f.tags === undefined ? [] : list("tags", f.tags, n + 2)),
  ];
  return inner.length === 0 ? [`${pad(n)}${key(k)}:`] : [`${pad(n)}${key(k)}:`, ...inner];
}

function step(s: Step, n: number): string[] {
  const out: string[] = [...comment(s.comment, n)];
  const props: string[][] = [];
  if (s.name !== undefined) props.push(entry("name", s.name, 0));
  if (s.id !== undefined) props.push(entry("id", s.id, 0));
  if (s.when !== undefined) props.push(entry("if", s.when, 0));
  switch (s.kind) {
    case "uses":
      props.push(entry("uses", s.uses, 0));
      if (s.with !== undefined) props.push(mapping("with", s.with, 0));
      break;
    case "run":
      if (s.shell !== undefined) props.push(entry("shell", s.shell, 0));
      props.push(entry("run", s.run, 0));
      break;
    default:
      return absurd(s);
  }
  if (s.env !== undefined) props.push(mapping("env", s.env, 0));
  if (s.workingDirectory !== undefined) props.push(entry("working-directory", s.workingDirectory, 0));
  if (s.timeoutMinutes !== undefined) props.push(entry("timeout-minutes", s.timeoutMinutes, 0));
  const lines = props.flat();
  lines.forEach((l, i) => out.push(i === 0 ? `${pad(n)}- ${l}` : l === "" ? "" : `${pad(n + 2)}${l}`));
  return out;
}

function jobLines(id: string, j: Job): string[] {
  const out: string[] = [...comment(j.comment, 2), `  ${key(id)}:`];
  if (j.name !== undefined) out.push(...entry("name", j.name, 4));
  out.push(...entry("runs-on", j.runsOn, 4));
  out.push(...entry("timeout-minutes", j.timeoutMinutes, 4));
  if (j.needs !== undefined) out.push(...flowList("needs", j.needs, 4));
  if (j.when !== undefined) out.push(...entry("if", j.when, 4));
  out.push(...permissions(j.permissions, 4));
  if (j.environment !== undefined) {
    out.push("    environment:", ...entry("name", j.environment.name, 6));
    if (j.environment.url !== undefined) out.push(...entry("url", j.environment.url, 6));
  }
  out.push(...mapping("env", j.env, 4));
  if (j.strategy !== undefined) {
    out.push("    strategy:");
    if (j.strategy.failFast !== undefined) out.push(...entry("fail-fast", j.strategy.failFast, 6));
    out.push("      matrix:", ...Object.entries(j.strategy.matrix).flatMap(([k, v]) => flowList(k, v, 8)));
  }
  out.push("    steps:", ...j.steps.flatMap((s) => step(s, 6)));
  return out;
}

/** The text of a workflow's file. */
export function renderWorkflow(w: Workflow): string {
  const out: string[] = [`# Generated by ${GENERATOR}; do not edit (commons 0030-generated-workflows).`, `name: ${scalar(w.name)}`, ""];
  if (w.comment !== undefined) out.push(...comment(w.comment, 0));
  out.push("on:");
  out.push(...filter("push", w.on.push, 2), ...filter("pull_request", w.on.pullRequest, 2));
  if (w.on.workflowDispatch === true) out.push("  workflow_dispatch:");
  if (w.on.workflowCall === true) out.push("  workflow_call:");
  out.push("");
  if (w.permissions !== undefined) out.push(...permissions(w.permissions, 0), "");
  if (w.env !== undefined) out.push(...mapping("env", w.env, 0), "");
  if (w.concurrency !== undefined) {
    out.push(
      "concurrency:",
      ...entry("group", w.concurrency.group, 2),
      ...entry("cancel-in-progress", w.concurrency.cancelInProgress, 2),
      "",
    );
  }
  out.push("jobs:");
  Object.entries(w.jobs).forEach(([id, j], i) => {
    if (i > 0) out.push("");
    out.push(...jobLines(id, j));
  });
  return `${out.join("\n")}\n`;
}

/** The text of a composite action's `action.yml`. */
export function renderAction(a: CompositeAction): string {
  const out: string[] = [`# Generated by ${GENERATOR}; do not edit (commons 0030-generated-workflows FR-008).`, `name: ${scalar(a.name)}`];
  out.push(...entry("description", a.description, 0));
  out.push("inputs:");
  for (const [k, v] of Object.entries(a.inputs)) {
    out.push(`  ${key(k)}:`, ...entry("description", v.description, 4));
    if (v.default !== undefined) out.push(...entry("default", v.default, 4));
  }
  out.push("runs:", "  using: composite", "  steps:", ...a.steps.flatMap((s) => step(s, 4)));
  return `${out.join("\n")}\n`;
}
