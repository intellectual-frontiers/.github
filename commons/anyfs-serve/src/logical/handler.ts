// Spec: 0003-anyfs-serve-logical FR-010, FR-011, FR-012, FR-013, FR-014, FR-015
/**
 * The handler: a function from a web `Request` to a `Response` that serves one AnyFS store as WebDAV on the POSIX view of it. It answers OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND, PROPPATCH, LOCK and
 * UNLOCK, checks the host, the credentials and the locks before it touches the store, takes every guard of a write from the request (`If-Match`, `If-None-Match`, `If`) and gives it to the store as the expectation of
 * the write where the store can hold it, and says in `X-Anyfs-Fidelity` how each answer was carried out. It holds no socket: a test calls it with a `Request`, and the server of the physical layer hosts it.
 *
 * @example
 * ```ts
 * import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
 * import { handler } from "./handler.ts";
 * import { noAuthentication } from "./auth.ts";
 * const serve = handler(memoryStore(), { authenticator: noAuthentication });
 * const response = await serve(new Request("http://127.0.0.1/note.txt", { method: "PUT", body: "hello" }));
 * response.status; // 201
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type Expect,
  expectAbsent,
  expectAny,
  expectRev,
  type Path,
  type Problem,
} from "@intellectual-frontiers/anyfs/governance";
import type { Store, Written } from "@intellectual-frontiers/anyfs/logical";
import {
  defaultPolicy,
  type DirEntry,
  type Fidelity,
  keepMarkers,
  type PosixError,
  type PosixPath,
  type PosixStat,
  ROOT_PATH,
  storePathOf,
  withPolicy,
  baseName,
  parentPosix,
  joinPosix,
  isBelow,
  emulated,
  worse,
  native,
  refusedBy,
} from "@intellectual-frontiers/anyfs-posix/governance";
import { posix, type Viewable } from "@intellectual-frontiers/anyfs-posix/physical";
import {
  allowedMethods,
  type Authenticator,
  type DavMethod,
  type Directories,
  DEFAULT_LIMITS,
  isJunkName,
  type Junk,
  type Limits,
  LOOPBACK_HOSTS,
  parseMethod,
  type Status,
  type Unicode,
  contentTypeOf,
  changesStore,
} from "@intellectual-frontiers/anyfs-serve/governance";
import { credentialsOf } from "./auth.ts";
import { hrefOf, pathOfDestination, pathOfUrl } from "./href.ts";
import { ifHolds, type IfList, parseIf, submittedTokens } from "./ifheader.ts";
import { newLockTable, type LockDepth } from "./lock.ts";
import { multistatus, propResponse, propfindRequest, proppatchRequest, statusResponse, lockElement, type ResourceFacts } from "./props.ts";
import { errorAnswer, type Answer, responseOf, textAnswer, xmlAnswer } from "./respond.ts";
import { childElements, dav, DAV_NS, describeXmlProblem, el, isNamed, parseXml, textOf, type XmlElement } from "./xml.ts";
import { statusLine } from "@intellectual-frontiers/anyfs-serve/governance";

/** What happened to one request: for a log, a trace or an audit, with no credential and no body. */
export type ServeEvent = { readonly method: string; readonly path: string; readonly status: number; readonly fidelity: string | undefined; readonly milliseconds: number };

/** What the handler is told. */
export type HandlerOptions = {
  /** Who may ask. There is no default: a server that asks nobody says so with `noAuthentication`. */
  readonly authenticator: Authenticator;
  /** The host names a request may name in `Host`, without ports; the loopback names by default. */
  readonly hosts?: readonly string[];
  /** The address the server answers below, `/` by default. */
  readonly base?: string;
  readonly limits?: Limits;
  /** What to do with the files a desktop makes by itself: `allow` by default. */
  readonly junk?: Junk;
  /** Whether an empty collection is kept as an object: `markers` by default. */
  readonly directories?: Directories;
  /** What to do with a name that is not NFC: turn it into NFC (the default) or refuse it. */
  readonly unicode?: Unicode;
  /** Whether LOCK and UNLOCK are answered (class 2): on by default. */
  readonly locks?: boolean;
  /** The realm of the challenge. */
  readonly realm?: string;
  /** The time in milliseconds; the clock by default. */
  readonly clock?: () => number;
  /** Told of every request when it is answered. */
  readonly onEvent?: (event: ServeEvent) => void;
};

type Lists = readonly IfList[] | undefined;

const MARKER = ".keep";

/** The handler of a store. */
export function handler(store: Store<Viewable>, options: HandlerOptions): (request: Request) => Promise<Response> {
  const limits = options.limits ?? DEFAULT_LIMITS;
  const base = options.base ?? "/";
  const junk = options.junk ?? "allow";
  const directories = options.directories ?? "markers";
  const unicode = options.unicode ?? "nfc";
  const locksOn = options.locks ?? true;
  const realm = options.realm ?? "anyfs";
  const clock = options.clock ?? (() => Date.now());
  const hosts = (options.hosts ?? LOOPBACK_HOSTS).map((h) => h.toLowerCase());
  const markers = directories === "markers" ? keepMarkers(MARKER) : ok({ kind: "none" } as const);
  const policy = markers.kind === "ok" ? withPolicy(defaultPolicy(), { markers: markers.value }) : ok(defaultPolicy());
  const view = posix(store, policy.kind === "ok" ? { policy: policy.value } : {});
  const table = newLockTable(clock, { maxSeconds: limits.maxLockSeconds, maxLocks: limits.maxLocks });
  const writable = store.capabilities.has("write");
  const casable = store.capabilities.has("cas");
  const maxBody = Math.min(limits.maxBody, store.traits.maxObject ?? Number.MAX_SAFE_INTEGER);
  const allow = allowedMethods(writable, locksOn).join(", ");
  const davHeader = locksOn ? "1, 2" : "1";

  // ---- store access that the view does not give: a write with the expectation of the request, and a read that gives the bytes with their revision
  const store2 = store as unknown as { readonly handle: Store<Viewable>["handle"] };
  async function writeObject(path: Path, bytes: Uint8Array, expect: Expect): Promise<Result<Written, Problem>> {
    const r = await store2.handle({ op: "write", path, bytes, expect });
    if (r.kind === "err") return r;
    return r.value.op === "write" ? ok(r.value.value) : err({ kind: "unavailable", detail: "the store answered another operation", retryable: false });
  }
  async function readObject(path: Path): Promise<Result<{ readonly bytes: Uint8Array; readonly rev: string; readonly modified?: string }, Problem>> {
    const r = await store2.handle({ op: "read", path });
    if (r.kind === "err") return r;
    return r.value.op === "read" ? ok(r.value.value) : err({ kind: "unavailable", detail: "the store answered another operation", retryable: false });
  }
  const problemAnswer = (p: Problem, fidelity: Fidelity): Answer => {
    switch (p.kind) {
      case "missing":
        return textAnswer(404, `${p.path} is not there`, {}, fidelity);
      case "conflict":
        return textAnswer(412, "the object is not as the request expected", {}, fidelity);
      case "refused":
        return textAnswer(p.reason === "too-large" ? 413 : 403, p.detail, {}, refusedBy("read-only", p.detail));
      case "unavailable":
        return textAnswer(503, p.detail, { "retry-after": "5" }, fidelity);
      case "tampered":
        return textAnswer(502, p.detail, {}, fidelity);
    }
  };

  const hostOk = (request: Request): boolean => {
    const raw = request.headers.get("host") ?? new URL(request.url).host;
    const h = raw.startsWith("[") ? raw.slice(0, raw.indexOf("]") + 1) : raw.split(":")[0] ?? "";
    return hosts.includes(h.toLowerCase());
  };

  async function readBody(request: Request, max: number): Promise<Uint8Array | "too-large"> {
    const declared = request.headers.get("content-length");
    if (declared !== null && Number(declared) > max) return "too-large";
    if (request.body === null) return new Uint8Array(0);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await reader.cancel();
        return "too-large";
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  }
  const readXml = async (request: Request): Promise<string | Answer> => {
    const body = await readBody(request, limits.maxXml);
    if (body === "too-large") return textAnswer(413, "the request body is larger than the server reads");
    return new TextDecoder().decode(body);
  };

  const parentOf = (p: PosixPath): PosixPath => parentPosix(p);
  const isMarker = (p: PosixPath): boolean => directories === "markers" && baseName(p) === MARKER;
  const junkRefused = (p: PosixPath): boolean => {
    const n = baseName(p);
    return junk === "refuse" && n !== undefined && isJunkName(n);
  };

  async function statOf(p: PosixPath): Promise<Result<PosixStat, PosixError>> {
    const r = await view.stat(p);
    return r.kind === "ok" ? ok(r.value.value) : err(r.error);
  }

  const parseLists = (request: Request): Result<Lists, Answer> => {
    const header = request.headers.get("if");
    if (header === null) return ok(undefined);
    const p = parseIf(header);
    return p.kind === "ok" ? ok(p.value) : err(textAnswer(400, `the If header is not read: ${p.error}`));
  };

  /** Whether a change of these resources is held by a lock the caller did not submit, and whether the If header holds for the first of them. */
  async function guard(request: Request, targets: readonly { readonly path: PosixPath; readonly subtree: boolean }[], etagOfFirst?: string): Promise<Answer | undefined> {
    const lists = parseLists(request);
    if (lists.kind === "err") return lists.error;
    const submitted = lists.value === undefined ? new Set<string>() : submittedTokens(lists.value);
    const first = targets[0];
    if (lists.value !== undefined && first !== undefined) {
      const tokens = new Set(table.covering(first.path).map((l) => l.token));
      const holds = ifHolds(lists.value, {
        etag: etagOfFirst,
        tokens,
        names: (resource) => {
          try {
            const url = new URL(resource, new URL(request.url));
            const named = pathOfUrl(url, base, unicode);
            return named.kind === "ok" && named.value.path === first.path;
          } catch {
            return false;
          }
        },
      });
      if (!holds) return textAnswer(412, "the If header does not hold for the resource");
    }
    for (const t of targets) {
      const blocked = table.blocking(t.path, submitted, t.subtree);
      if (blocked !== undefined) {
        const body = el(dav("error"), [el(dav("lock-token-submitted"), [el(dav("href"), [hrefOf(blocked.path, false, base)])])]);
        return xmlAnswer(423, body);
      }
    }
    return undefined;
  }

  const etagHeader = (rev: string): Record<string, string> => ({ etag: `"${rev}"` });
  const lastModified = (iso: string | undefined): Record<string, string> => (iso === undefined ? {} : { "last-modified": new Date(iso).toUTCString() });
  const matches = (header: string, rev: string): boolean => header.trim() === "*" || header.split(",").some((t) => t.trim().replace(/^W\//u, "").replace(/^"|"$/gu, "") === rev);

  // ---- OPTIONS, GET, HEAD
  async function optionsAnswer(): Promise<Answer> {
    return { status: 200, headers: { dav: davHeader, allow, "ms-author-via": "DAV", "content-length": "0" } };
  }

  const escapeHtml = (s: string): string => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

  async function getAnswer(request: Request, path: PosixPath, head: boolean): Promise<Answer> {
    const st = await statOf(path);
    if (st.kind === "err") return errorAnswer(st.error, "other");
    if (st.value.type === "dir") {
      const listing = await view.readdir(path);
      if (listing.kind === "err") return errorAnswer(listing.error, "other");
      const names = visible(listing.value.value);
      const rows = names
        .map((e) => `<li><a href="${escapeHtml(hrefOf(joinPosix(path, e.name), e.type === "dir", base))}">${escapeHtml(e.name)}${e.type === "dir" ? "/" : ""}</a></li>`)
        .join("");
      const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(path)}</title><h1>${escapeHtml(path)}</h1><ul>${rows}</ul>`;
      return { status: 200, headers: { "content-type": "text/html; charset=utf-8", "content-length": String(new TextEncoder().encode(html).length) }, body: head ? undefined : html, fidelity: listing.value.fidelity, file: true };
    }
    const key = storePathOf(path);
    if (key.kind === "err" || key.value === undefined) return textAnswer(400, "that is not an object");
    const read = await readObject(key.value);
    if (read.kind === "err") return problemAnswer(read.error, native);
    const rev = read.value.rev;
    const inm = request.headers.get("if-none-match");
    const im = request.headers.get("if-match");
    if (im !== null && !matches(im, rev)) return textAnswer(412, "the object is not at the revision the request names", etagHeader(rev));
    if (inm !== null && matches(inm, rev)) return { status: 304, headers: { ...etagHeader(rev), ...lastModified(read.value.modified) } };
    const bytes = read.value.bytes;
    const headers: Record<string, string> = { "content-type": contentTypeOf(path), "accept-ranges": "bytes", ...etagHeader(rev), ...lastModified(read.value.modified) };
    const range = request.headers.get("range");
    if (range !== null) {
      const m = /^bytes=(\d*)-(\d*)$/u.exec(range.trim());
      if (m !== null && (m[1] !== "" || m[2] !== "")) {
        const total = bytes.length;
        let start: number;
        let end: number;
        if (m[1] === "") {
          start = Math.max(0, total - Number(m[2]));
          end = total - 1;
        } else {
          start = Number(m[1]);
          end = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1);
        }
        if (start >= total || start > end) return { status: 416, headers: { "content-range": `bytes */${total}` } };
        const slice = bytes.subarray(start, end + 1);
        return { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${total}`, "content-length": String(slice.length) }, body: head ? undefined : slice, fidelity: emulated("whole-object-range"), file: true };
      }
    }
    return { status: 200, headers: { ...headers, "content-length": String(bytes.length) }, body: head ? undefined : bytes, fidelity: native, file: true };
  }

  const visible = (entries: readonly DirEntry[]): readonly DirEntry[] => entries.filter((e) => !(junk === "hide" && isJunkName(e.name)));

  // ---- PUT
  async function putAnswer(request: Request, path: PosixPath): Promise<Answer> {
    if (!writable) return textAnswer(403, "the store is read-only", { allow }, refusedBy("read-only", "the store has no write"));
    if (path === ROOT_PATH) return textAnswer(405, "the root is a collection", { allow });
    if (isMarker(path)) return textAnswer(403, "that name is kept for the server");
    if (junkRefused(path)) return textAnswer(403, "the server does not keep the files a desktop makes by itself");
    const key = storePathOf(path);
    if (key.kind === "err" || key.value === undefined) return textAnswer(400, "that is not a name of the store");
    const cur = await statOf(path);
    const exists = cur.kind === "ok";
    if (cur.kind === "ok" && cur.value.type === "dir") return textAnswer(405, "a collection is made with MKCOL", { allow });
    if (cur.kind === "err" && cur.error.errno !== "ENOENT") return errorAnswer(cur.error, "other");
    const currentRev = cur.kind === "ok" ? cur.value.rev : undefined;
    const locked = await guard(request, [{ path, subtree: false }], currentRev);
    if (locked !== undefined) return locked;
    // the ancestors are collections or nothing: a file on the way is a conflict
    for (let a = parentOf(path); a !== ROOT_PATH; a = parentOf(a)) {
      const s = await statOf(a);
      if (s.kind === "ok" && s.value.type === "file") return textAnswer(409, `${a} is a file, so ${path} cannot be below it`);
    }
    let expect: Expect = expectAny;
    let fidelity: Fidelity = native;
    const inm = request.headers.get("if-none-match");
    const im = request.headers.get("if-match");
    if (inm !== null) {
      if (inm.trim() === "*") {
        if (exists) return textAnswer(412, "there is already an object", currentRev === undefined ? {} : etagHeader(currentRev));
        expect = expectAbsent;
      } else if (currentRev !== undefined && matches(inm, currentRev)) return textAnswer(412, "the object is at a revision the request excludes", etagHeader(currentRev));
    }
    if (im !== null) {
      if (!exists || currentRev === undefined) return textAnswer(412, "there is no object");
      if (!matches(im, currentRev)) return textAnswer(412, "the object is not at the revision the request names", etagHeader(currentRev));
      if (casable && im.trim() !== "*") expect = expectRev(currentRev as never);
      else if (!casable) fidelity = emulated("unguarded-write", "the store cannot hold the revision of the request while it writes");
    }
    const body = await readBody(request, maxBody);
    if (body === "too-large") return textAnswer(413, "the object is larger than the server holds");
    const written = await writeObject(key.value, body, expect);
    if (written.kind === "err") return problemAnswer(written.error, fidelity);
    return { status: written.value.created ? 201 : 204, headers: { ...etagHeader(written.value.rev), ...(written.value.created ? { location: hrefOf(path, false, base) } : {}) }, fidelity };
  }

  // ---- DELETE
  async function deleteAnswer(request: Request, path: PosixPath): Promise<Answer> {
    if (!writable) return textAnswer(403, "the store is read-only", { allow }, refusedBy("read-only", "the store has no write"));
    if (path === ROOT_PATH) return textAnswer(403, "the root is not deleted");
    const st = await statOf(path);
    if (st.kind === "err") return errorAnswer(st.error, "other");
    const locked = await guard(request, [{ path, subtree: true }], st.value.rev);
    if (locked !== undefined) return locked;
    const im = request.headers.get("if-match");
    if (im !== null && st.value.type === "file" && st.value.rev !== undefined && !matches(im, st.value.rev)) return textAnswer(412, "the object is not at the revision the request names", etagHeader(st.value.rev));
    if (st.value.type === "file") {
      const r = await view.unlink(path);
      if (r.kind === "err") return errorAnswer(r.error, "other");
      table.drop(path);
      return { status: 204, fidelity: r.value.fidelity };
    }
    const r = await view.removeAll(path);
    if (r.kind === "err") {
      const rep = r.error.report;
      if (rep !== undefined && rep.failed.length > 0) {
        const parts = rep.failed.map((f) => statusResponse(f.path, false, 502, base));
        return xmlAnswer(207, multistatus(parts), {}, r.error.fidelity);
      }
      return errorAnswer(r.error, "other");
    }
    table.drop(path);
    return { status: 204, fidelity: r.value.fidelity };
  }

  // ---- MKCOL
  async function mkcolAnswer(request: Request, path: PosixPath): Promise<Answer> {
    if (!writable) return textAnswer(403, "the store is read-only", { allow }, refusedBy("read-only", "the store has no write"));
    const body = await readBody(request, 1);
    if (body === "too-large" || body.length > 0) return textAnswer(415, "a collection is made with no body");
    if (path === ROOT_PATH) return textAnswer(405, "the root is there");
    if (isMarker(path) || junkRefused(path)) return textAnswer(403, "the server does not keep that name");
    const locked = await guard(request, [{ path, subtree: false }]);
    if (locked !== undefined) return locked;
    const here = await statOf(path);
    if (here.kind === "ok") return textAnswer(405, "there is already something there", { allow });
    if (here.error.errno !== "ENOENT") return errorAnswer(here.error, "mkcol");
    const parent = parentOf(path);
    if (parent !== ROOT_PATH) {
      const ps = await statOf(parent);
      if (ps.kind === "err") return ps.error.errno === "ENOENT" ? textAnswer(409, `${parent} is not there`) : errorAnswer(ps.error, "mkcol");
      if (ps.value.type !== "dir") return textAnswer(409, `${parent} is a file`);
    }
    const made = await view.mkdir(path);
    if (made.kind === "err") return errorAnswer(made.error, "mkcol");
    return { status: 201, headers: { location: hrefOf(path, true, base) }, fidelity: made.value.fidelity };
  }

  // ---- COPY, MOVE
  async function copyTree(src: PosixPath, dst: PosixPath, deep: boolean): Promise<{ readonly fidelity: Fidelity; readonly failed: readonly { readonly path: PosixPath; readonly status: Status }[] }> {
    const failed: { path: PosixPath; status: Status }[] = [];
    let fidelity: Fidelity = native;
    const note = (f: Fidelity): void => {
      fidelity = worse(fidelity, f);
    };
    const one = async (from: PosixPath, to: PosixPath): Promise<void> => {
      const st = await statOf(from);
      if (st.kind === "err") {
        failed.push({ path: from, status: 404 });
        return;
      }
      if (st.value.type === "file") {
        const data = await view.readFile(from);
        if (data.kind === "err") {
          failed.push({ path: from, status: 502 });
          return;
        }
        const w = await view.writeFile(to, data.value.value);
        if (w.kind === "err") {
          failed.push({ path: to, status: errorAnswer(w.error, "other").status });
          return;
        }
        note(w.value.fidelity);
        note(emulated("write-back-buffer", "a copy reads the object and writes it again: the store has no copy of its own"));
        return;
      }
      const m = await view.mkdir(to);
      if (m.kind === "err" && m.error.errno !== "EEXIST") {
        failed.push({ path: to, status: errorAnswer(m.error, "other").status });
        return;
      }
      if (m.kind === "ok") note(m.value.fidelity);
      if (!deep) return;
      const list = await view.readdir(from);
      if (list.kind === "err") {
        failed.push({ path: from, status: 502 });
        return;
      }
      for (const e of list.value.value) await one(joinPosix(from, e.name), joinPosix(to, e.name));
    };
    await one(src, dst);
    return { fidelity, failed };
  }

  async function copyMoveAnswer(request: Request, path: PosixPath, move: boolean): Promise<Answer> {
    if (!writable) return textAnswer(403, "the store is read-only", { allow }, refusedBy("read-only", "the store has no write"));
    const destination = request.headers.get("destination");
    if (destination === null) return textAnswer(400, "a Destination header is required");
    const host = request.headers.get("host") ?? new URL(request.url).host;
    const dest = pathOfDestination(destination, host, base, unicode);
    if (dest.kind === "err") return textAnswer(dest.error.kind === "other-host" ? 502 : dest.error.kind === "outside" ? 502 : 400, dest.error.message);
    const to = dest.value.path;
    const overwrite = (request.headers.get("overwrite") ?? "T").toUpperCase() !== "F";
    const depthHeader = (request.headers.get("depth") ?? "infinity").toLowerCase();
    if (move && depthHeader !== "infinity") return textAnswer(400, "a MOVE moves the whole of a collection: the depth is infinity");
    if (depthHeader !== "0" && depthHeader !== "infinity") return textAnswer(400, "the depth of a COPY is 0 or infinity");
    if (path === ROOT_PATH || to === ROOT_PATH) return textAnswer(403, "the root is neither copied nor replaced");
    if (path === to) return textAnswer(403, "the source and the destination are the same");
    if (isBelow(path, to) || isBelow(to, path)) return textAnswer(403, "a resource is not copied or moved into itself or over a resource it lies in");
    if (isMarker(to) || junkRefused(to)) return textAnswer(403, "the server does not keep that name");
    const src = await statOf(path);
    if (src.kind === "err") return errorAnswer(src.error, "move-copy");
    const guards = move ? [{ path: to, subtree: true }, { path, subtree: true }] : [{ path: to, subtree: true }];
    const locked = await guard(request, guards);
    if (locked !== undefined) return locked;
    const parent = parentOf(to);
    if (parent !== ROOT_PATH) {
      const ps = await statOf(parent);
      if (ps.kind === "err") return ps.error.errno === "ENOENT" ? textAnswer(409, `${parent} is not there`) : errorAnswer(ps.error, "move-copy");
      if (ps.value.type !== "dir") return textAnswer(409, `${parent} is a file`);
    }
    const there = await statOf(to);
    let existed = false;
    if (there.kind === "ok") {
      existed = true;
      if (!overwrite) return textAnswer(412, "there is already something at the destination");
      const gone = there.value.type === "file" ? await view.unlink(to) : await view.removeAll(to);
      if (gone.kind === "err") return errorAnswer(gone.error, "move-copy");
      table.drop(to);
    } else if (there.error.errno !== "ENOENT") return errorAnswer(there.error, "move-copy");
    const status: Status = existed ? 204 : 201;
    if (move) {
      const r = await view.rename(path, to);
      if (r.kind === "err") return errorAnswer(r.error, "move-copy");
      table.drop(path);
      return { status, headers: existed ? {} : { location: hrefOf(to, src.value.type === "dir", base) }, fidelity: r.value.fidelity };
    }
    const done = await copyTree(path, to, depthHeader === "infinity");
    if (done.failed.length > 0) return xmlAnswer(207, multistatus(done.failed.map((f) => statusResponse(f.path, false, f.status, base))), {}, done.fidelity);
    return { status, headers: existed ? {} : { location: hrefOf(to, src.value.type === "dir", base) }, fidelity: done.fidelity };
  }

  // ---- PROPFIND, PROPPATCH
  const factsOf = (path: PosixPath, st: PosixStat): ResourceFacts => ({
    path,
    collection: st.type === "dir",
    ...(st.type === "file" ? { size: st.size } : {}),
    ...(st.rev === undefined ? {} : { etag: st.rev }),
    ...(st.mtime === undefined ? {} : { modified: st.mtime }),
    locks: table.covering(path),
  });

  async function propfindAnswer(request: Request, path: PosixPath): Promise<Answer> {
    const depth = (request.headers.get("depth") ?? "infinity").toLowerCase();
    if (depth !== "0" && depth !== "1") return xmlAnswer(403, el(dav("error"), [el(dav("propfind-finite-depth"))]));
    const text = await readXml(request);
    if (typeof text !== "string") return text;
    const req = propfindRequest(text, { maxBytes: limits.maxXml, maxDepth: limits.maxXmlDepth, maxNodes: limits.maxXmlNodes });
    if (req.kind === "err") return textAnswer(400, req.error);
    const st = await statOf(path);
    if (st.kind === "err") return errorAnswer(st.error, "other");
    const responses: XmlElement[] = [propResponse(factsOf(path, st.value), req.value, base)];
    let fidelity: Fidelity = native;
    if (depth === "1" && st.value.type === "dir") {
      const list = await view.readdir(path);
      if (list.kind === "err") return errorAnswer(list.error, "other");
      fidelity = list.value.fidelity;
      const entries = visible(list.value.value);
      if (entries.length + 1 > limits.maxResources) return textAnswer(413, "the answer would hold more resources than the server gives");
      for (const e of entries) {
        const child = joinPosix(path, e.name);
        const facts: ResourceFacts = {
          path: child,
          collection: e.type === "dir",
          ...(e.type === "file" && e.size !== undefined ? { size: e.size } : {}),
          ...(e.rev === undefined ? {} : { etag: e.rev }),
          ...(e.mtime === undefined ? {} : { modified: e.mtime }),
          locks: table.covering(child),
        };
        responses.push(propResponse(facts, req.value, base));
      }
    }
    return xmlAnswer(207, multistatus(responses), {}, fidelity);
  }

  async function proppatchAnswer(request: Request, path: PosixPath): Promise<Answer> {
    const text = await readXml(request);
    if (typeof text !== "string") return text;
    const req = proppatchRequest(text, { maxBytes: limits.maxXml, maxDepth: limits.maxXmlDepth, maxNodes: limits.maxXmlNodes });
    if (req.kind === "err") return textAnswer(400, req.error);
    const st = await statOf(path);
    if (st.kind === "err") return errorAnswer(st.error, "other");
    const locked = await guard(request, [{ path, subtree: false }], st.value.rev);
    if (locked !== undefined) return locked;
    const names = [...req.value.set, ...req.value.remove];
    const refused = el(dav("propstat"), [el(dav("prop"), names.map((n) => el(n))), el(dav("status"), [statusLine(403)]), el(dav("error"), [el(dav("cannot-modify-protected-property"))])]);
    const body = multistatus([el(dav("response"), [el(dav("href"), [hrefOf(path, st.value.type === "dir", base)]), refused])]);
    return xmlAnswer(207, body, {}, refusedBy("not-in-model", "the store keeps no properties of its own: a property cannot be set"));
  }

  // ---- LOCK, UNLOCK
  const timeoutOf = (request: Request): number => {
    const t = request.headers.get("timeout");
    const m = t === null ? null : /Second-(\d+)/u.exec(t);
    return m === null ? limits.maxLockSeconds : Number(m[1]);
  };
  const lockBody = (locks: ReturnType<typeof table.covering>): string => writeLockBody(locks);
  const writeLockBody = (locks: ReturnType<typeof table.covering>): string => {
    const prop = el(dav("prop"), [el(dav("lockdiscovery"), locks.map((l) => lockElement(l, base)))]);
    return xmlBody(prop);
  };
  const xmlBody = (e: XmlElement): string => xmlAnswer(200, e).body as string;

  async function lockAnswer(request: Request, path: PosixPath): Promise<Answer> {
    const text = await readXml(request);
    if (typeof text !== "string") return text;
    if (text.trim() === "") {
      const lists = parseLists(request);
      if (lists.kind === "err") return lists.error;
      const token = lists.value === undefined ? undefined : [...submittedTokens(lists.value)][0];
      if (token === undefined) return textAnswer(400, "a refresh names its lock in the If header");
      const r = table.refresh(token, timeoutOf(request));
      if (r.kind === "err") return textAnswer(412, "there is no such lock");
      return { status: 200, headers: { "content-type": "application/xml; charset=utf-8" }, body: lockBody([r.value]) };
    }
    if (!writable) return textAnswer(403, "the store is read-only", { allow }, refusedBy("read-only", "the store has no write"));
    const doc = parseXml(text, { maxBytes: limits.maxXml, maxDepth: limits.maxXmlDepth, maxNodes: limits.maxXmlNodes });
    if (doc.kind === "err") return textAnswer(400, describeXmlProblem(doc.error));
    if (!isNamed(doc.value, DAV_NS, "lockinfo")) return textAnswer(400, "the body of a LOCK is a lockinfo element of DAV:");
    const kids = childElements(doc.value);
    const scope = kids.find((k) => isNamed(k, DAV_NS, "lockscope"));
    const kind = kids.find((k) => isNamed(k, DAV_NS, "locktype"));
    if (scope === undefined || kind === undefined) return textAnswer(400, "a lockinfo has a lockscope and a locktype");
    if (!childElements(scope).some((e) => isNamed(e, DAV_NS, "exclusive"))) return textAnswer(412, "only exclusive locks are given");
    if (!childElements(kind).some((e) => isNamed(e, DAV_NS, "write"))) return textAnswer(412, "only write locks are given");
    const ownerEl = kids.find((k) => isNamed(k, DAV_NS, "owner"));
    const owner = ownerEl === undefined ? "" : textOf(ownerEl).trim();
    const depthHeader = (request.headers.get("depth") ?? "infinity").toLowerCase();
    if (depthHeader !== "0" && depthHeader !== "infinity") return textAnswer(400, "the depth of a LOCK is 0 or infinity");
    const guarded = await guard(request, [{ path, subtree: depthHeader === "infinity" }]);
    // a lock on a resource that another lock covers is refused by the table; the submitted tokens of the If header only matter to the check of the change
    void guarded;
    const here = await statOf(path);
    let created = false;
    let fidelity: Fidelity = native;
    if (here.kind === "err") {
      if (here.error.errno !== "ENOENT") return errorAnswer(here.error, "other");
      if (path === ROOT_PATH || isMarker(path) || junkRefused(path)) return textAnswer(403, "the server does not keep that name");
      const key = storePathOf(path);
      if (key.kind === "err" || key.value === undefined) return textAnswer(400, "that is not a name of the store");
      const w = await writeObject(key.value, new Uint8Array(0), expectAbsent);
      if (w.kind === "err") return problemAnswer(w.error, native);
      created = true;
      fidelity = emulated("write-back-buffer", "a lock on a name that is not there makes an empty object, because the store keeps no names without objects");
    }
    const made = table.create({ path, depth: depthHeader as LockDepth, owner, seconds: timeoutOf(request) });
    if (made.kind === "err") return made.error.kind === "locked" ? xmlAnswer(423, el(dav("error"), [el(dav("no-conflicting-lock"), [el(dav("href"), [hrefOf(made.error.by.path, false, base)])])])) : textAnswer(503, "the server holds as many locks as it gives", { "retry-after": "5" });
    return { status: created ? 201 : 200, headers: { "content-type": "application/xml; charset=utf-8", "lock-token": `<${made.value.token}>` }, body: lockBody([made.value]), fidelity };
  }

  async function unlockAnswer(request: Request, path: PosixPath): Promise<Answer> {
    const header = request.headers.get("lock-token");
    const m = header === null ? null : /^<(.+)>$/u.exec(header.trim());
    if (m === null || m[1] === undefined) return textAnswer(400, "UNLOCK names its lock in Lock-Token");
    const r = table.release(m[1], path);
    return r.kind === "ok" ? { status: 204 } : textAnswer(409, "that lock is not held at this resource");
  }

  async function dispatch(request: Request, method: DavMethod, path: PosixPath): Promise<Answer> {
    switch (method) {
      case "OPTIONS":
        return optionsAnswer();
      case "GET":
        return getAnswer(request, path, false);
      case "HEAD":
        return getAnswer(request, path, true);
      case "PUT":
        return putAnswer(request, path);
      case "DELETE":
        return deleteAnswer(request, path);
      case "MKCOL":
        return mkcolAnswer(request, path);
      case "COPY":
        return copyMoveAnswer(request, path, false);
      case "MOVE":
        return copyMoveAnswer(request, path, true);
      case "PROPFIND":
        return propfindAnswer(request, path);
      case "PROPPATCH":
        return proppatchAnswer(request, path);
      case "LOCK":
        return locksOn ? lockAnswer(request, path) : textAnswer(405, "locks are not given", { allow });
      case "UNLOCK":
        return locksOn ? unlockAnswer(request, path) : textAnswer(405, "locks are not given", { allow });
    }
  }

  void changesStore;

  return async (request) => {
    const started = clock();
    const url = new URL(request.url);
    const finish = (a: Answer): Response => {
      const headers = { dav: davHeader, ...(a.headers ?? {}) };
      options.onEvent?.({ method: request.method, path: url.pathname, status: a.status, fidelity: a.fidelity === undefined ? undefined : a.fidelity.kind, milliseconds: clock() - started });
      return responseOf({ ...a, headers });
    };
    if (!hostOk(request)) return finish(textAnswer(403, "that host is not served here"));
    const method = parseMethod(request.method);
    if (method === undefined) return finish(textAnswer(405, "that method is not answered", { allow }));
    const credentials = credentialsOf(request.headers.get("authorization"));
    let may = false;
    try {
      may = await options.authenticator(credentials);
    } catch {
      may = false;
    }
    if (!may) return finish(textAnswer(401, "credentials are required", { "www-authenticate": `Basic realm="${realm}", charset="UTF-8", Bearer realm="${realm}"` }));
    if (request.url.includes("#")) return finish(textAnswer(400, "an address has no fragment"));
    const addressed = pathOfUrl(url, base, unicode);
    if (addressed.kind === "err") return finish(textAnswer(addressed.error.kind === "outside" ? 404 : 400, addressed.error.message));
    if (method !== "OPTIONS" && changesStore(method) && !writable && method !== "LOCK") return finish(textAnswer(403, "the store is read-only", { allow }, refusedBy("read-only", "the store has no write")));
    try {
      return finish(await dispatch(request, method, addressed.value.path));
    } catch (e) {
      return finish(textAnswer(500, `the server could not answer: ${e instanceof Error ? e.message : "an error"}`));
    }
  };
}
