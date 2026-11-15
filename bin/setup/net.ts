// A network that fails now and works in a minute (009-machine-bootstrap FR-031 to FR-037): every download and every step that needs the network is tried
// again where the network is what failed, with a longer wait each time, and each retry is said and kept for the summary. A refusal (not allowed, not found, a
// file that is not the one expected, a certificate the computer does not accept) is not tried again: another try cannot change it.
import { err, ok, type Result, type Sha256 } from "./result.ts";
import type { RetryPolicy } from "./options.ts";
import { exists, type Ran, run, type RunOptions } from "./proc.ts";

/** Why a request failed, as far as the network is concerned. */
export type NetFailure =
  | { readonly kind: "dns" }
  | { readonly kind: "connect" }
  | { readonly kind: "broken" }
  | { readonly kind: "timeout" }
  | { readonly kind: "tls" }
  | { readonly kind: "certificate" }
  | { readonly kind: "http"; readonly status: number }
  | { readonly kind: "other"; readonly message: string };

export function describe(f: NetFailure): string {
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
  }
}

const busy = (status: number) => status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);

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
  }
}

/** What an error of fetch() says, as a failure of the network. */
export function classify(e: unknown): NetFailure {
  if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) return { kind: "timeout" };
  const m = e instanceof Error ? `${e.message} ${e.cause instanceof Error ? e.cause.message : ""}` : String(e);
  if (/certificate|UnknownIssuer|invalid peer|self[ -]signed|CertNotValid/i.test(m)) return { kind: "certificate" };
  if (/dns error|failed to lookup|name or service not known|nodename nor servname|no such host|temporary failure in name resolution/i.test(m)) return { kind: "dns" };
  if (/connection refused|ConnectionRefused|network is unreachable|no route to host|connect error/i.test(m)) return { kind: "connect" };
  if (/timed? ?out|deadline/i.test(m)) return { kind: "timeout" };
  if (/tls|ssl|handshake/i.test(m)) return { kind: "tls" };
  if (/reset|broken pipe|unexpected eof|connection closed|IncompleteMessage|incomplete|error reading a body|body from connection/i.test(m)) return { kind: "broken" };
  return { kind: "other", message: m.trim().slice(0, 200) };
}

/** The retries of this run: what, why, which try (FR-033), kept for the summary and the support file. */
export type RetryNote = { readonly what: string; readonly why: string; readonly attempt: number };

export class Retries {
  readonly notes: RetryNote[] = [];
  constructor(
    readonly policy: RetryPolicy,
    readonly report: (line: string) => void,
    readonly jitter: () => number = () => Math.floor(Math.random() * 3),
    readonly pause: (seconds: number) => Promise<void> = (s) => new Promise((r) => setTimeout(r, s * 1000)),
  ) {}

  /** The seconds to wait after the attempt that just failed: the base doubled each time, no more than the cap, and up to 2 more so that many computers do not try together. */
  wait(attempt: number): number {
    let d = this.policy.base;
    for (let i = 1; i < attempt && d < this.policy.cap; i++) d *= 2;
    return Math.min(d, this.policy.cap) + this.jitter();
  }

  /** Say that an attempt failed and when the next one is, keep it, and wait. */
  async again(what: string, why: string, attempt: number): Promise<void> {
    const w = this.wait(attempt);
    this.notes.push({ what, why, attempt: attempt + 1 });
    this.report(`${what}: ${why}; trying again in ${w}s (attempt ${attempt + 1} of ${this.policy.tries})`);
    await this.pause(w);
  }

  /** What the network cost this run, most first: "github.com (3), static.rust-lang.org (1)". */
  top(n = 4): string {
    const by = new Map<string, number>();
    for (const x of this.notes) by.set(x.what, (by.get(x.what) ?? 0) + 1);
    return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w, c]) => `${w} (${c})`).join(", ");
  }
}

/** Whether the words a command printed say the network failed (not a refusal, not a certificate), so that the command is worth running again. */
export function netWords(text: string): boolean {
  if (/certificate problem|self[ -]signed|unknown ca|not allowed|denied|authentication failed|not found|404/i.test(text)) return false;
  return /could not resolve|temporary failure (in name )?resolution|temporary failure resolving|name or service not known|connection failed|unable to connect|could not connect|dns error|connection (reset|refused|timed out|closed)|timed out|timeout|network is unreachable|no route to host|early eof|rpc failed|unexpected disconnect|broken pipe|handshake|tls|ssl|error sending request|failed to (fetch|download)|unable to access|\b50[0234]\b|too many requests/i
    .test(text);
}

/** A command that uses the network, run again where its own words say the network failed; anything else is returned at once. */
export async function retryCommand(retries: Retries, what: string, argv: readonly string[], opts: RunOptions = {}, before?: () => Promise<void>): Promise<Ran> {
  for (let n = 1;; n++) {
    await before?.();
    const r = await run(argv, opts);
    if (r.code === 0 || n >= retries.policy.tries || !netWords(r.output)) return r;
    const why = r.output.split("\n").find((l) =>
      /could not resolve|name resolution|name or service|timed out|timeout|reset|refused|unreachable|early eof|rpc failed|50[0234]|tls|ssl/i.test(l)
    ) ?? "";
    await retries.again(what, why.slice(0, 90), n);
  }
}

export type FetchOptions = {
  /** no answer within this many seconds fails the try (FR-031: 20) */
  readonly answerSeconds?: number;
  /** under 1 KB a second over this many seconds fails the try (FR-031: 60) */
  readonly stallSeconds?: number;
  readonly headers?: Readonly<Record<string, string>>;
};

/** One try: the file at URL into DEST; a DEST ending .part that has bytes is resumed where the server can. */
export async function fetchOnce(url: string, dest: string, o: FetchOptions = {}): Promise<Result<void, NetFailure>> {
  const ctl = new AbortController();
  const answer = setTimeout(() => ctl.abort(new DOMException("no answer", "TimeoutError")), (o.answerSeconds ?? 20) * 1000);
  const have = dest.endsWith(".part") && exists(dest) ? Deno.statSync(dest).size : 0;
  let res: Response;
  try {
    res = await fetch(url, { signal: ctl.signal, headers: { ...(o.headers ?? {}), ...(have > 0 && !url.startsWith("file:") ? { Range: `bytes=${have}-` } : {}) } });
  } catch (e) {
    clearTimeout(answer);
    return err(classify(e));
  }
  clearTimeout(answer);
  if (!res.ok) {
    await res.body?.cancel();
    return err({ kind: "http", status: res.status });
  }
  const append = res.status === 206;
  const stall = (o.stallSeconds ?? 60) * 1000;
  let file: Deno.FsFile | null = null;
  let window = 0;
  let windowStart = Date.now();
  const watch = setInterval(() => {
    if (Date.now() - windowStart >= stall) {
      if (window < (stall / 1000) * 1024) ctl.abort(new DOMException("stalled", "TimeoutError"));
      window = 0;
      windowStart = Date.now();
    }
  }, Math.min(5000, stall));
  try {
    file = await Deno.open(dest, { write: true, create: true, append, truncate: !append });
    if (res.body !== null) {
      for await (const chunk of res.body) {
        window += chunk.length;
        let n = 0;
        while (n < chunk.length) n += await file.write(chunk.subarray(n));
      }
    }
    return ok(undefined);
  } catch (e) {
    return err(classify(e));
  } finally {
    clearInterval(watch);
    file?.close();
  }
}

/** The file at URL, tried again where the network failed (said each time, and kept for the summary). */
export async function fetchTo(retries: Retries, url: string, dest: string, o: FetchOptions = {}): Promise<Result<void, string>> {
  const name = url.replace(/^[a-z]+:\/\//, "").split("/")[0] || url;
  for (let n = 1;; n++) {
    const r = await fetchOnce(url, dest, o);
    if (r.ok) return r;
    const f = r.error;
    if (!retryable(f) || n >= retries.policy.tries) return err(`${name}: ${describe(f)} (after ${n} of ${retries.policy.tries} attempts)`);
    if (f.kind === "http" && f.status === 416) await Deno.remove(dest).catch(() => {});
    await retries.again(name, describe(f), n);
  }
}

export async function sha256File(path: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", await Deno.readFile(path));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The file in the cache, fetched if it is not there, and only if its SHA-256 is the one given (FR-025, FR-035). A download that stops part way is kept as .part
 * and resumed by the next try or the next run; a file that is not the one expected is never kept.
 */
export async function downloadVerified(retries: Retries, url: string, sum: Sha256, cache: string, o: FetchOptions = {}): Promise<Result<string, string>> {
  await Deno.mkdir(`${cache}/downloads`, { recursive: true });
  const f = `${cache}/downloads/${sum}`;
  if (exists(f) && await sha256File(f) === sum) return ok(f);
  const part = `${f}.part`;
  const got = await fetchTo(retries, url, part, o);
  if (!got.ok) return err(`could not fetch ${url}: ${got.error}`);
  const actual = await sha256File(part);
  if (actual !== sum) {
    await Deno.remove(part).catch(() => {});
    return err(`the file at ${url} is not the one expected (its SHA-256 is ${actual}, expected ${sum}); nothing was installed`);
  }
  await Deno.rename(part, f);
  return ok(f);
}

/** Whether HOST answers over https (any answer counts, even a refusal), tried again where it does not, at most 5 times (FR-037). */
export async function reach(retries: Retries, host: string): Promise<Result<void, NetFailure>> {
  const max = Math.min(5, retries.policy.tries);
  for (let n = 1;; n++) {
    try {
      const res = await fetch(`https://${host}/`, { method: "HEAD", signal: AbortSignal.timeout(20_000) });
      await res.body?.cancel();
      return ok(undefined);
    } catch (e) {
      const f = classify(e);
      if (n >= max) return err(f);
      await retries.again(host, describe(f), n);
    }
  }
}
