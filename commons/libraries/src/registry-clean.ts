// Spec: 0001-libraries FR-033
/**
 * The versions of the package of the release that a registry no longer needs (commons 0001-libraries FR-033): a pure function of the versions a registry lists and the number of the newest to keep, and the program that reads the listing as lines of
 * JSON and prints the plan. It deletes nothing: the workflow `maintenance` (commons 0030-generated-workflows FR-012) deletes what the plan names and nothing else. The order is the order of the numbers (`0.10.0` is after `0.9.0`), a version that is not
 * a plain `<major>.<minor>.<patch>` is never selected, and the newest is always kept.
 *
 * @example
 * ```ts
 * import { planClean } from "./registry-clean.ts";
 * const r = planClean([{ id: 1, name: "0.1.0" }, { id: 2, name: "0.10.0" }, { id: 3, name: "0.9.0" }], 1);
 * r.kind === "ok" ? r.value.delete.map((v) => v.name) : []; // ["0.1.0", "0.9.0"]
 * ```
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** A version a registry lists: its identifier there and its name. */
export type Listed = { readonly id: number; readonly name: string };

/** What to keep and what to delete, each in the order of the numbers, newest first. */
export type CleanPlan = { readonly keep: readonly Listed[]; readonly delete: readonly Listed[]; readonly notPlain: readonly Listed[] };

const PLAIN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** The numbers of a plain version, or nothing for any other name. */
export function numbersOf(name: string): readonly [number, number, number] | undefined {
  const m = PLAIN.exec(name);
  return m === null ? undefined : [Number(m[1]), Number(m[2]), Number(m[3])];
}

const newestFirst = (a: Listed, b: Listed): number => {
  const [x, y] = [numbersOf(a.name), numbersOf(b.name)];
  if (x === undefined || y === undefined) return a.name < b.name ? -1 : 1;
  return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
};

/** The plan for the versions listed, or why none can be made. A name that is not plain is kept and listed apart; the newest `keep` plain versions are kept; the others are to be deleted. */
export function planClean(listed: readonly Listed[], keep: number): Result<CleanPlan, string> {
  if (!Number.isInteger(keep) || keep < 1) return err(`keep is ${String(keep)}: a whole number of at least 1`);
  if (listed.length === 0) return err("no version is listed: there is nothing to plan, and an empty listing is more likely a failed read than an empty registry");
  const names = new Set<string>();
  for (const v of listed) {
    if (!Number.isInteger(v.id) || v.id < 1) return err(`version ${v.name} has the identifier ${String(v.id)}: not a registry identifier`);
    if (names.has(v.name)) return err(`the name ${v.name} is listed twice`);
    names.add(v.name);
  }
  const plain = listed.filter((v) => numbersOf(v.name) !== undefined).sort(newestFirst);
  const notPlain = listed.filter((v) => numbersOf(v.name) === undefined).sort(newestFirst);
  if (plain.length === 0) return err("no plain version (major.minor.patch) is listed, so none can be called the newest");
  return ok({ keep: plain.slice(0, keep), delete: plain.slice(keep), notPlain });
}

/** The listing as lines of JSON (`{"id":1,"name":"0.1.0"}`), or the first line that is not one. */
export function parseListing(text: string): Result<readonly Listed[], string> {
  const out: Listed[] = [];
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  for (const [i, line] of lines.entries()) {
    let j: unknown;
    try {
      j = JSON.parse(line);
    } catch {
      return err(`line ${i + 1} is not JSON`);
    }
    if (typeof j !== "object" || j === null) return err(`line ${i + 1} is not an object`);
    const o = j as { readonly id?: unknown; readonly name?: unknown };
    if (typeof o.id !== "number" || typeof o.name !== "string") return err(`line ${i + 1} has no numeric id and text name`);
    out.push({ id: o.id, name: o.name });
  }
  return ok(out);
}

/** The text of a plan: what is kept, what is deleted and what is left alone, one line each. */
export function planText(plan: CleanPlan): string {
  return [
    ...plan.keep.map((v) => `keep    ${v.name}  (id ${v.id})`),
    ...plan.notPlain.map((v) => `leave   ${v.name}  (id ${v.id}; not a plain version)`),
    ...plan.delete.map((v) => `delete  ${v.name}  (id ${v.id})`),
  ].join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--keep");
  const keep = at >= 0 ? Number(argv[at + 1]) : 1;
  const text = readFileSync(0, "utf8");
  const listed = parseListing(text);
  const plan = listed.kind === "err" ? listed : planClean(listed.value, keep);
  if (plan.kind === "err") {
    process.stderr.write(`${plan.error}\n`);
    process.exitCode = 2;
  } else {
    process.stdout.write(`${planText(plan.value)}\n`);
    process.stdout.write(`${JSON.stringify({ delete: plan.value.delete.map((v) => v.id) })}\n`);
  }
}
