// Spec: 0003-anyfs-serve-logical FR-004
/**
 * The answers: how a response is made, how the fidelity of a POSIX operation is written in `X-Anyfs-Fidelity`, and how an error of the POSIX view becomes a status. Every answer carries `Cache-Control: no-store`
 * and `X-Content-Type-Options: nosniff`, and an answer made from a file carries `Content-Security-Policy: sandbox`, so that a browser that is pointed at the server cannot run a file as a page of the server.
 *
 * @example
 * ```ts
 * import { fidelityHeader } from "./respond.ts";
 * fidelityHeader({ kind: "native" }); // "native"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Fidelity, PosixError } from "@intellectual-frontiers/anyfs-posix/governance";
import { type Context, RETRY_AFTER_SECONDS, type Status, statusOfErrno } from "@intellectual-frontiers/anyfs-serve/governance";
import { type XmlElement, writeXml } from "./xml.ts";

/** A fidelity as the value of the header: `native`, `emulated; reason=…; risk=…` or `refused; reason=…`. */
export function fidelityHeader(f: Fidelity): string {
  switch (f.kind) {
    case "native":
      return "native";
    case "emulated":
      return `emulated; reason=${f.reason}; risk=${f.risk}`;
    case "refused":
      return `refused; reason=${f.reason}`;
    default:
      return absurd(f);
  }
}

/** What an answer is made from. */
export type Answer = {
  readonly status: Status;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array | string | undefined;
  readonly fidelity?: Fidelity;
  /** The answer shows the content of a file. */
  readonly file?: boolean;
};

/** The response of an answer. */
export function responseOf(a: Answer): Response {
  const headers = new Headers({ "cache-control": "no-store", "x-content-type-options": "nosniff", ...(a.headers ?? {}) });
  if (a.fidelity !== undefined) headers.set("x-anyfs-fidelity", fidelityHeader(a.fidelity));
  if (a.file === true) headers.set("content-security-policy", "sandbox");
  const body = a.body === undefined || a.status === 204 || a.status === 304 ? null : typeof a.body === "string" ? new TextEncoder().encode(a.body) : a.body;
  return new Response(body as BodyInit | null, { status: a.status, headers });
}

/** An answer whose body is XML. */
export function xmlAnswer(status: Status, root: XmlElement, extra: Readonly<Record<string, string>> = {}, fidelity?: Fidelity): Answer {
  return { status, headers: { "content-type": "application/xml; charset=utf-8", ...extra }, body: writeXml(root), ...(fidelity === undefined ? {} : { fidelity }) };
}

/** A plain answer that says what went wrong in a sentence. */
export function textAnswer(status: Status, message: string, headers: Readonly<Record<string, string>> = {}, fidelity?: Fidelity): Answer {
  return { status, headers: { "content-type": "text/plain; charset=utf-8", ...headers }, body: `${message}\n`, ...(fidelity === undefined ? {} : { fidelity }) };
}

/** The answer to an error of the POSIX view: the status of its code in the context, or 503 with a wait where the store is not there now, or 502 where what it holds is not what it says. */
export function errorAnswer(e: PosixError, context: Context): Answer {
  const p = e.problem;
  if (p !== undefined && p.kind === "unavailable") return textAnswer(503, e.message, { "retry-after": String(RETRY_AFTER_SECONDS) }, e.fidelity);
  if (p !== undefined && p.kind === "tampered") return textAnswer(502, e.message, {}, e.fidelity);
  return textAnswer(statusOfErrno(e.errno, context), e.message, {}, e.fidelity);
}
