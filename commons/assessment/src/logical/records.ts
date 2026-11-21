// Spec: 0002-objective-evidence FR-001, FR-007
/**
 * The records of evidence as files (0002-objective-evidence FR-001, FR-007): one JSON5 file for each record, in the folder of its framework and objective, so that Git shows each piece of evidence as its own change. Reading refuses a record that breaks the rules of FR-001: a tool never determines,
 * a not-applicable needs a person and a reason, a validity ends after the evidence was gathered, and a source is named.
 *
 * @example
 * ```ts
 * import { recordPath } from "./records.ts";
 * recordPath({ id: "ev-1", framework: "nist-800-171a-r2", objective: "3.1.1[a]" }); // "nist-800-171a-r2/3.1.1_a/ev-1.json5"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Evidence, METHODS, RESULTS } from "@intellectual-frontiers/assessment/governance";
import { formatJson5Error, isJsonObject, type Json, parseJson5, toJson5 } from "@intellectual-frontiers/formats/json5";

const INSTANT = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;

/** The rules a record must keep, as problems (none where it keeps them). */
export function problemsOf(e: Evidence): readonly string[] {
  const out: string[] = [];
  if (e.id === "" || /[/\\\s]/.test(e.id)) out.push("the id is empty or has a slash or a space");
  if (e.framework === "" || e.objective === "") out.push("the framework and the objective are named");
  if (e.source.trim() === "") out.push("the source is named");
  if (!INSTANT.test(e.at)) out.push("`at` is an instant like 2026-11-21T12:00:00Z");
  if (e.validUntil !== undefined && (!INSTANT.test(e.validUntil) || e.validUntil <= e.at)) out.push("`validUntil` is an instant after `at`");
  if (e.determines && e.by.kind !== "person") out.push("a tool does not determine an objective: only a person does");
  if (e.result === "not-applicable" && (e.by.kind !== "person" || (e.note ?? "").trim() === "")) out.push("not-applicable is a person's word and has a reason in `note`");
  if (e.by.name.trim() === "") out.push("who made the record is named");
  return out;
}

/** The place of a record in a store: its framework, its objective (without the brackets) and its id. */
export function recordPath(e: Pick<Evidence, "id" | "framework" | "objective">): string {
  return `${e.framework}/${e.objective.replace(/\[/g, "_").replace(/\]/g, "")}/${e.id}.json5`;
}

/** The text of a record's file. */
export function encodeRecord(e: Evidence): string {
  const json: Record<string, Json> = { schema: "assessment-evidence/1", id: e.id, framework: e.framework, objective: e.objective, method: e.method, result: e.result, by: { kind: e.by.kind, name: e.by.name }, at: e.at };
  if (e.validUntil !== undefined) json["validUntil"] = e.validUntil;
  json["source"] = e.source;
  if (e.note !== undefined) json["note"] = e.note;
  json["determines"] = e.determines;
  return toJson5(json);
}

const text = (o: { readonly [k: string]: Json }, key: string): Result<string, string> => (typeof o[key] === "string" ? ok(o[key] as string) : err(`${key} is not text`));

/** A record from the text of its file, or what is wrong with it. */
export function decodeRecord(source: string): Result<Evidence, string> {
  const parsed = parseJson5(source);
  if (parsed.kind === "err") return err(formatJson5Error(parsed.error));
  const o = parsed.value;
  if (!isJsonObject(o) || o["schema"] !== "assessment-evidence/1") return err("not an evidence record (schema assessment-evidence/1)");
  const by = o["by"];
  if (by === undefined || !isJsonObject(by) || (by["kind"] !== "tool" && by["kind"] !== "person") || typeof by["name"] !== "string") return err("by is {kind: tool|person, name}");
  const method = o["method"];
  const result = o["result"];
  if (!METHODS.some((m) => m === method)) return err("method is examine, interview or test");
  if (!RESULTS.some((r) => r === result)) return err("result is pass, fail or not-applicable");
  const fields = [text(o, "id"), text(o, "framework"), text(o, "objective"), text(o, "at"), text(o, "source")];
  for (const f of fields) if (f.kind === "err") return err(f.error);
  const [id, framework, objective, at, src] = fields.map((f) => (f as { value: string }).value) as [string, string, string, string, string];
  if (typeof o["determines"] !== "boolean") return err("determines is true or false");
  const e: Evidence = {
    id, framework, objective, method: method as Evidence["method"], result: result as Evidence["result"], by: { kind: by["kind"], name: by["name"] }, at, source: src, determines: o["determines"],
    ...(typeof o["validUntil"] === "string" ? { validUntil: o["validUntil"] } : {}),
    ...(typeof o["note"] === "string" ? { note: o["note"] } : {}),
  };
  const bad = problemsOf(e);
  return bad.length > 0 ? err(bad.join("; ")) : ok(e);
}
