// Spec: 0005-grc-runners FR-006
/**
 * The `api` runner (0005-grc-runners FR-006): the input is `{ method, url, select? }` with `GET` or `HEAD` only; the call is made by a client the host gives, of the shape
 * `{ fetch({ method, url }) -> { status, body } }`, and the value is `{ status, body }` or what a JSON pointer selects from it.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Check, type Json, objectOf } from "@intellectual-frontiers/grc/governance";
import type { Observation, RunContext, Runner, RunnerProblem } from "@intellectual-frontiers/grc/physical";

/** What the host gives. */
export type ApiClient = { fetch(request: { readonly method: "GET" | "HEAD"; readonly url: string }): Promise<{ readonly status: number; readonly body: Json }> };

function pick(value: Json, pointer: string): Result<Json, string> {
  let at: Json = value;
  for (const raw of pointer === "" ? [] : pointer.replace(/^\//, "").split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    const next: Json | undefined = Array.isArray(at) ? at[Number(key)] : at !== null && typeof at === "object" ? (at as { readonly [k: string]: Json })[key] : undefined;
    if (next === undefined) return err(`the pointer ${pointer} names no member ${key}`);
    at = next;
  }
  return ok(at);
}

/** The `api` runner over a client. */
export function apiRunner(client: ApiClient): Runner {
  return {
    id: "api",
    async run(check: Check, ctx: RunContext): Promise<Result<Observation, RunnerProblem>> {
      const i = objectOf(check.runner.input);
      if (i === undefined || (i["method"] !== "GET" && i["method"] !== "HEAD") || typeof i["url"] !== "string") {
        return err({ kind: "refused", message: "the input of an api check is { method: GET | HEAD, url, select? }" });
      }
      const t0 = Date.now();
      const r = await client.fetch({ method: i["method"], url: i["url"] });
      let value: Json = { status: r.status, body: r.body };
      if (typeof i["select"] === "string") {
        const s = pick(value, i["select"]);
        if (s.kind === "err") return err({ kind: "failed", message: s.error });
        value = s.value;
      }
      return ok({ value, observedAt: ctx.now(), via: "api", tookMs: Date.now() - t0 });
    },
  };
}
