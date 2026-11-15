/**
 * Downloads over a network that fails now and works in a minute (commons 0005-typescript-runtime FR-024), on the web standard `fetch` and
 * `node:fs`. Taken from the machine setup's `net.ts`: a failure is classified (the name, the connection, a busy server, a certificate),
 * retried only where another try can help, with a longer wait each time (or as long as the server's `Retry-After` asks, up to the cap) and every retry said; a download that stops part way is resumed
 * with `Range`; and a file is kept only where its SHA-256 is the one expected. A download that fails is an expected outcome, so these
 * return a `Result`.
 *
 * @example
 * ```ts
 * import { downloadVerified, Retries } from "./net.ts";
 * import { sha256Of } from "../kernel/sha256.ts";
 * const sum = sha256Of("…64 hex digits…");
 * if (sum !== undefined) {
 *   const r = await downloadVerified(new Retries({ tries: 5, base: 2, cap: 30 }, console.error), "https://example.com/tool.tgz", sum, "/tmp/cache");
 *   if (r.kind === "ok") console.log("kept at", r.value);
 * }
 * ```
 *
 * @module
 */
import * as fsp from "node:fs/promises";
import { join } from "node:path";
import { absurd } from "../kernel/absurd.ts";
import { retryAfterMs } from "../kernel/http.ts";
import { err, ok, type Result } from "../kernel/result.ts";
import type { Sha256 } from "../kernel/sha256.ts";
import { exists, mkdir, remove, rename, sha256File, stat } from "./fs.ts";

/** Why a request failed, as far as the network is concerned. */
export type NetFailure =
  | { readonly kind: "dns" }
  | { readonly kind: "connect" }
  | { readonly kind: "broken" }
  | { readonly kind: "timeout" }
  | { readonly kind: "tls" }
  | { readonly kind: "certificate" }
  | { readonly kind: "http"; readonly status: number; readonly retryAfterMs?: number }
  | { readonly kind: "other"; readonly message: string };

const busy = (status: number): boolean => status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);

/** A failure as a person reads it. */
export function describeFailure(f: NetFailure): string {
  switch (f.kind) {
    case "dns":
      return "the name could not be looked up (DNS)";
    case "connect":
      return "no connection could be made";
    case "broken":
      return "the connection broke or the download stopped early";
    case "timeout":
      return "it took too long";
    case "tls":
      return "the secure connection could not be made";
    case "certificate":
      return "the certificate was not accepted (a proxy, or the computer's clock?)";
    case "http":
      return f.status === 416
        ? "the part already fetched did not fit, so it starts again"
        : busy(f.status)
          ? `the server answered ${f.status} (busy or not ready)`
          : `the server answered ${f.status}`;
    case "other":
      return f.message;
    default:
      return absurd(f);
  }
}

/** Whether another try may help: the name, the connection, a busy server; never a refusal or a certificate. */
export function retryable(f: NetFailure): boolean {
  switch (f.kind) {
    case "dns":
    case "connect":
    case "broken":
    case "timeout":
    case "tls":
      return true;
    case "certificate":
    case "other":
      return false;
    case "http":
      return busy(f.status) || f.status === 416;
    default:
      return absurd(f);
  }
}

const CODES: Readonly<Record<string, NetFailure["kind"]>> = {
  ENOTFOUND: "dns",
  EAI_AGAIN: "dns",
  ECONNREFUSED: "connect",
  ENETUNREACH: "connect",
  EHOSTUNREACH: "connect",
  UND_ERR_CONNECT_TIMEOUT: "timeout",
  UND_ERR_HEADERS_TIMEOUT: "timeout",
  UND_ERR_BODY_TIMEOUT: "timeout",
  ETIMEDOUT: "timeout",
  ECONNRESET: "broken",
  EPIPE: "broken",
  UND_ERR_SOCKET: "broken",
  ERR_TLS_CERT_ALTNAME_INVALID: "certificate",
  CERT_HAS_EXPIRED: "certificate",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "certificate",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "certificate",
  DEPTH_ZERO_SELF_SIGNED_CERT: "certificate",
  SELF_SIGNED_CERT_IN_CHAIN: "certificate",
};

const codeOf = (e: unknown): string | undefined => {
  if (typeof e !== "object" || e === null) return undefined;
  const c: unknown = Reflect.get(e, "code");
  return typeof c === "string" ? c : undefined;
};

/** What an error of `fetch` says, as a failure of the network: by its code (or its cause's) where it has one, else by its words. */
export function classify(e: unknown): NetFailure {
  if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) return { kind: "timeout" };
  const cause: unknown = e instanceof Error ? e.cause : undefined;
  const code = codeOf(e) ?? codeOf(cause);
  const byCode = code === undefined ? undefined : CODES[code];
  if (byCode !== undefined && byCode !== "http" && byCode !== "other") return { kind: byCode };
  const m = e instanceof Error ? `${e.message} ${cause instanceof Error ? cause.message : ""}` : String(e);
  if (/certificate|UnknownIssuer|invalid peer|self[ -]signed|CertNotValid/i.test(m)) return { kind: "certificate" };
  if (
    /dns error|failed to lookup|name or service not known|nodename nor servname|no such host|temporary failure in name resolution|ENOTFOUND/i.test(
      m,
    )
  ) {
    return { kind: "dns" };
  }
  if (/connection refused|ConnectionRefused|network is unreachable|no route to host|connect error|ECONNREFUSED/i.test(m))
    return { kind: "connect" };
  if (/timed? ?out|deadline/i.test(m)) return { kind: "timeout" };
  if (/tls|ssl|handshake/i.test(m)) return { kind: "tls" };
  if (
    /reset|broken pipe|unexpected eof|connection closed|IncompleteMessage|incomplete|error reading a body|body from connection|terminated|other side closed/i.test(
      m,
    )
  ) {
    return { kind: "broken" };
  }
  return { kind: "other", message: m.trim().slice(0, 200) };
}

/** How often and how patiently to try: at most `tries` attempts, waiting `base` seconds after the first failure, doubled each time up to `cap`. */
export type RetryPolicy = { readonly tries: number; readonly base: number; readonly cap: number };

/** One retry: what was retried, why, and which attempt comes next. */
export type RetryNote = { readonly what: string; readonly why: string; readonly attempt: number };

/** The retries of a run: how long to wait, each retry said through `report` and kept for a summary. */
export class Retries {
  /** The retries so far, in order. */
  readonly notes: RetryNote[] = [];
  /** The policy. */
  readonly policy: RetryPolicy;
  /** Where each retry is said. */
  readonly report: (line: string) => void;
  /** Seconds added to each wait so that many computers do not try together (0 to 2 by default). */
  readonly jitter: () => number;
  /** How a wait is spent (a timer by default; a test passes one that returns at once). */
  readonly pause: (seconds: number) => Promise<void>;

  /** Retries under a policy, said through `report`. */
  constructor(
    policy: RetryPolicy,
    report: (line: string) => void,
    jitter: () => number = () => Math.floor(Math.random() * 3),
    pause: (seconds: number) => Promise<void> = (s) => new Promise((r) => setTimeout(r, s * 1000)),
  ) {
    this.policy = policy;
    this.report = report;
    this.jitter = jitter;
    this.pause = pause;
  }

  /** The seconds to wait after attempt `attempt` failed: the base doubled each time, no more than the cap, plus the jitter. */
  wait(attempt: number): number {
    let d = this.policy.base;
    for (let i = 1; i < attempt && d < this.policy.cap; i++) d *= 2;
    return Math.min(d, this.policy.cap) + this.jitter();
  }

  /** Say that an attempt failed and when the next one is, keep it, and wait; a server's `Retry-After` (in seconds, up to the cap) wins. */
  async again(what: string, why: string, attempt: number, retryAfterSeconds?: number): Promise<void> {
    const w = retryAfterSeconds === undefined ? this.wait(attempt) : Math.min(Math.ceil(retryAfterSeconds), this.policy.cap);
    this.notes.push({ what, why, attempt: attempt + 1 });
    this.report(`${what}: ${why}; trying again in ${w}s (attempt ${attempt + 1} of ${this.policy.tries})`);
    await this.pause(w);
  }

  /** What the network cost, most retried first: `github.com (3), example.org (1)`. */
  top(n = 4): string {
    const by = new Map<string, number>();
    for (const x of this.notes) by.set(x.what, (by.get(x.what) ?? 0) + 1);
    return [...by.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([w, c]) => `${w} (${c})`)
      .join(", ");
  }
}

/** Limits of one try. */
export type FetchOptions = {
  /** No answer within this many seconds fails the try (20 by default). */
  readonly answerSeconds?: number;
  /** Less than 1 KB a second over this many seconds fails the try (60 by default). */
  readonly stallSeconds?: number;
  /** Headers to send. */
  readonly headers?: Readonly<Record<string, string>>;
};

/** One try: the file at `url` written to `dest`; a `dest` ending `.part` that already has bytes is resumed where the server can. */
export async function fetchOnce(url: string, dest: string, o: FetchOptions = {}): Promise<Result<void, NetFailure>> {
  const ctl = new AbortController();
  const answer = setTimeout(() => ctl.abort(new DOMException("no answer", "TimeoutError")), (o.answerSeconds ?? 20) * 1000);
  const have = dest.endsWith(".part") && (await exists(dest)) ? (await stat(dest)).size : 0;
  let res: Response;
  try {
    const range: Record<string, string> = have > 0 && !url.startsWith("file:") ? { Range: `bytes=${have}-` } : {};
    res = await fetch(url, { signal: ctl.signal, headers: { ...o.headers, ...range } });
  } catch (e) {
    return err(classify(e));
  } finally {
    clearTimeout(answer);
  }
  if (!res.ok) {
    await res.body?.cancel();
    const after = busy(res.status) ? retryAfterMs(res.headers.get("retry-after"), Date.now()) : undefined;
    return err({ kind: "http", status: res.status, ...(after === undefined ? {} : { retryAfterMs: after }) });
  }
  const append = res.status === 206;
  const stall = (o.stallSeconds ?? 60) * 1000;
  let window = 0;
  let windowStart = Date.now();
  const watch = setInterval(
    () => {
      if (Date.now() - windowStart < stall) return;
      if (window < (stall / 1000) * 1024) ctl.abort(new DOMException("stalled", "TimeoutError"));
      window = 0;
      windowStart = Date.now();
    },
    Math.min(5000, stall),
  );
  let file: fsp.FileHandle | undefined;
  try {
    file = await fsp.open(dest, append ? "a" : "w");
    if (res.body !== null) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        window += value.length;
        await file.write(value);
      }
    }
    return ok(undefined);
  } catch (e) {
    return err(classify(e));
  } finally {
    clearInterval(watch);
    await file?.close();
  }
}

/** The host a URL names, for saying what was retried. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/** The file at `url` written to `dest`, tried again where the network failed and another try can help; or why it was not. */
export async function fetchTo(retries: Retries, url: string, dest: string, o: FetchOptions = {}): Promise<Result<void, string>> {
  const name = hostOf(url);
  for (let n = 1; ; n++) {
    const r = await fetchOnce(url, dest, o);
    if (r.kind === "ok") return r;
    const f = r.error;
    if (!retryable(f) || n >= retries.policy.tries)
      return err(`${name}: ${describeFailure(f)} (after ${n} of ${retries.policy.tries} attempts)`);
    if (f.kind === "http" && f.status === 416) await remove(dest).catch(() => {});
    await retries.again(name, describeFailure(f), n, f.kind === "http" && f.retryAfterMs !== undefined ? f.retryAfterMs / 1000 : undefined);
  }
}

/**
 * The file in `cache/downloads/<sha256>`, fetched where it is not there, and kept only where its SHA-256 is `sum`. A download that stops
 * part way is kept as `.part` and resumed by the next try or the next run; a file that is not the one expected is removed, never kept.
 */
export async function downloadVerified(
  retries: Retries,
  url: string,
  sum: Sha256,
  cache: string,
  o: FetchOptions = {},
): Promise<Result<string, string>> {
  const dir = join(cache, "downloads");
  await mkdir(dir, { recursive: true });
  const f = join(dir, sum);
  if ((await exists(f)) && (await sha256File(f)) === sum) return ok(f);
  const part = `${f}.part`;
  const got = await fetchTo(retries, url, part, o);
  if (got.kind === "err") return err(`could not fetch ${url}: ${got.error}`);
  const actual = await sha256File(part);
  if (actual !== sum) {
    await remove(part).catch(() => {});
    return err(`the file at ${url} is not the one expected (its SHA-256 is ${actual}, expected ${sum}); nothing was kept`);
  }
  await rename(part, f);
  return ok(f);
}

/** Whether `host` answers over HTTPS (any answer counts, even a refusal), tried again where it does not, at most 5 times. */
export async function reach(retries: Retries, host: string, scheme: "https" | "http" = "https"): Promise<Result<void, NetFailure>> {
  const max = Math.min(5, retries.policy.tries);
  for (let n = 1; ; n++) {
    try {
      const res = await fetch(`${scheme}://${host}/`, { method: "HEAD", signal: AbortSignal.timeout(20_000) });
      await res.body?.cancel();
      return ok(undefined);
    } catch (e) {
      const f = classify(e);
      if (n >= max) return err(f);
      await retries.again(host, describeFailure(f), n);
    }
  }
}
