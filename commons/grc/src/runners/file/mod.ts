// Spec: 0005-grc-runners FR-005
/**
 * The `file` runner (0005-grc-runners FR-005), for files and configuration: the input is `{ path, format, select? }`, the file is read by a reader the host gives, decoded as `json`, `lines` or
 * `text`, and a value is selected by a JSON pointer (RFC 6901). A file that is not there is a problem, not a value.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Check, type Json, objectOf } from "@intellectual-frontiers/grc/governance";
import type { Observation, RunContext, Runner, RunnerProblem } from "@intellectual-frontiers/grc/physical";

/** What the host gives: the text of a file, or `undefined` where there is none. */
export type FileReader = { read(path: string): Promise<string | undefined> };

/** The value a JSON pointer names in `value`, or why it names none. */
export function selectPointer(value: Json, pointer: string): Result<Json, string> {
  if (pointer === "") return ok(value);
  if (!pointer.startsWith("/")) return err(`the pointer ${pointer} does not begin with /`);
  let at: Json = value;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(at)) {
      const n = /^(0|[1-9]\d*)$/.test(key) ? Number(key) : -1;
      const next: Json | undefined = at[n];
      if (next === undefined) return err(`the pointer ${pointer} names no member ${key}`);
      at = next;
    } else if (at !== null && typeof at === "object") {
      const next: Json | undefined = (at as { readonly [k: string]: Json })[key];
      if (next === undefined || !Object.hasOwn(at, key)) return err(`the pointer ${pointer} names no member ${key}`);
      at = next;
    } else return err(`the pointer ${pointer} goes into a value that has no members`);
  }
  return ok(at);
}

/** The `file` runner over a reader. */
export function fileRunner(reader: FileReader): Runner {
  return {
    id: "file",
    async run(check: Check, ctx: RunContext): Promise<Result<Observation, RunnerProblem>> {
      const i = objectOf(check.runner.input);
      if (i === undefined || typeof i["path"] !== "string" || !["json", "lines", "text"].includes(String(i["format"]))) {
        return err({ kind: "refused", message: 'the input of a file check is { path, format: "json" | "lines" | "text", select? }' });
      }
      const t0 = Date.now();
      const text = await reader.read(i["path"]);
      if (text === undefined) return err({ kind: "unavailable", message: `the file ${i["path"]} is not there` });
      let value: Json;
      if (i["format"] === "json") {
        try {
          value = JSON.parse(text) as Json;
        } catch (e) {
          return err({ kind: "failed", message: `${i["path"]} is not JSON: ${e instanceof Error ? e.message : String(e)}` });
        }
      } else value = i["format"] === "lines" ? text.split("\n").filter((l) => l !== "") : text;
      if (typeof i["select"] === "string") {
        const s = selectPointer(value, i["select"]);
        if (s.kind === "err") return err({ kind: "failed", message: s.error });
        value = s.value;
      }
      return ok({ value, observedAt: ctx.now(), via: "file", tookMs: Date.now() - t0 });
    },
  };
}
