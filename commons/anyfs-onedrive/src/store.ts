// Spec: 0002-anyfs-onedrive-store FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-009
/**
 * The store over a drive and a folder of Microsoft Graph. Its objects are the files below the folder, addressed by path (`/me/drive/root:/a/b:/content`), whole (up to `maxBytes`, 64 MiB where it is left out; Graph takes
 * 250 MB in one request and an upload session for more is a later capability). The revision of an object is `sha256:` and the digest of its bytes, the same as in every other store: Graph keeps the digest of the contents
 * of a file as `sha256Hash` on some drives and not on others, so the store uses it where it is given and reads the bytes where it is not. The entity tag Graph gives is not a revision (it changes at every write, even of
 * the same bytes): it guards a write, which is made with `If-Match` on the entity tag of the object seen to be at the revision expected, and an object that is expected not to be there is written with
 * `conflictBehavior=fail`, so that of several writers one wins.
 *
 * @remarks
 * Limits, said once: a read keeps the whole object in memory and asks twice (the item, then the bytes); a listing walks every folder below the prefix and asks about the bytes of a file that carries no digest, so a listing
 * of a drive that gives none is as long as its data is; names are case-insensitive, so two paths that differ only by case are one object; a call is not retried here (the layer `retrying` does it for a problem that says it is
 * worth one); and the folders that a delete leaves empty are removed on the way up, which is a second request that may fail without the delete failing.
 *
 * @example
 * ```ts
 * import { openOneDriveStore, staticToken } from "./store.ts";
 * // const opened = await openOneDriveStore({ place, token: staticToken(process.env.TOKEN ?? "") });
 * // opened.kind === "ok" && opened.value.capabilities.has("cas"); // true
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { makeStore, type Handler, type Op, type Stat, type Store } from "@intellectual-frontiers/anyfs/logical";
import {
  comparePaths,
  conflict,
  type Consistency,
  type Cursor,
  type Expect,
  type Found,
  formatPlace,
  parseCursor,
  parsePath,
  parseRevision,
  type Path,
  type Place,
  type Problem,
  refused,
  type Revision,
  tampered,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";
import { kindOf, problemOf, type Subject } from "./errors.ts";
import { type CallError, makeGraph, type TokenSource } from "./graph.ts";
import { type Item, parseItem, parsePage } from "./items.ts";
import { childrenAddress, contentAddress, itemAddress, pathProblem, segmentProblem } from "./names.ts";
import { fetchTransport, type Transport } from "./transport.ts";

export { staticToken, type TokenSource } from "./graph.ts";

/** The place of a store on OneDrive. */
export type OneDrivePlace = Extract<Place, { readonly kind: "onedrive" }>;

/** The capabilities of the store. */
export const CAPABILITIES = ["read", "write", "list", "stat", "delete", "cas"] as const;
/** The store. */
export type OneDriveStore = Store<(typeof CAPABILITIES)[number]>;

/** What a store is made with. */
export type OneDriveOptions = {
  /** The drive and the folder: `parsePlace("onedrive://me/fleet")`. */
  readonly place: OneDrivePlace;
  readonly token: TokenSource;
  /** Where Graph listens: `https://graph.microsoft.com/v1.0` where it is left out. */
  readonly endpoint?: string;
  /** The most bytes an object may have: 64 MiB where it is left out, and never more than the 250 MB of one request. */
  readonly maxBytes?: number;
  readonly transport?: Transport;
  /** How long a request may take: 30 s where it is left out. */
  readonly timeoutMs?: number;
  /** How many files a listing asks the bytes of at once: 8 where it is left out. */
  readonly listConcurrency?: number;
  /** The most entries a listing walks: 100000 where it is left out. */
  readonly maxEntries?: number;
  /** The most requests a listing makes: 5000 where it is left out. */
  readonly maxRequests?: number;
  readonly consistency?: Consistency;
};

const GRAPH = "https://graph.microsoft.com/v1.0";
const SIMPLE_UPLOAD_MAX = 250_000_000;
const DEFAULT_MAX = 64 * 1024 * 1024;
const PAGE = 1000;
const HEX64 = /^[0-9a-f]{64}$/u;
const CONFLICT_BEHAVIOR = "@microsoft.graph.conflictBehavior";

const revisionOf = (hex: string): Revision => {
  const r = parseRevision(`sha256:${hex}`);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

async function mapLimit<T, R>(items: readonly T[], limit: number, f: (item: T) => Promise<R>): Promise<readonly R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await f(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

/** The problem a failed call is. */
function problemOfCall(e: CallError, subject: Subject): Problem {
  switch (e.kind) {
    case "transport":
      return unavailable(e.message, true, subject.path);
    case "token":
      return unavailable(`no token: ${e.message}`, false, subject.path);
    case "failure":
      return problemOf(e.failure, subject);
    default:
      return unavailable("a failure of no known kind", false, subject.path);
  }
}

/** A store on a drive and a folder of Graph, or why there is none. The drive is asked once, so that a token that is not accepted is found here. */
export async function openOneDriveStore(options: OneDriveOptions): Promise<Result<OneDriveStore, string>> {
  const maxBytes = Math.min(options.maxBytes ?? DEFAULT_MAX, SIMPLE_UPLOAD_MAX);
  const drive = options.place.drive;
  const prefixSegs = options.place.prefix === "" ? [] : (options.place.prefix as string).split("/");
  for (const s of prefixSegs) {
    const why = segmentProblem(s);
    if (why !== undefined) return err(`the folder ${options.place.prefix} is not one OneDrive keeps: ${why}`);
  }
  const graph = makeGraph({ endpoint: options.endpoint ?? GRAPH, token: options.token, transport: options.transport ?? fetchTransport(), timeoutMs: options.timeoutMs ?? 30_000 });
  const concurrency = options.listConcurrency ?? 8;
  const maxEntries = options.maxEntries ?? 100_000;
  const maxRequests = options.maxRequests ?? 5000;
  const probe = await graph.send({ method: "GET", address: itemAddress(drive, []), query: { $select: "id,name,folder" } });
  if (probe.kind === "err") return err(`the drive ${drive} could not be opened: ${problemOfCall(probe.error, {}).kind === "unavailable" ? (probe.error.kind === "failure" ? `Graph answered ${probe.error.failure.status} ${probe.error.failure.code}` : probe.error.message) : "refused"}`);

  const segsOf = (path: Path): readonly string[] => [...prefixSegs, ...path.split("/")];
  const ownProblem = (path: Path): Problem | undefined => {
    const why = pathProblem(path);
    return why === undefined ? undefined : refused("unportable-path", why, path);
  };

  /** The item at a path: a file, or the problem (a folder or a thing that is not a file is not an object of the store). */
  const itemAt = async (path: Path): Promise<Result<Extract<Item, { kind: "file" }>, Problem>> => {
    const got = await graph.send({ method: "GET", address: itemAddress(drive, segsOf(path)), query: { $select: "id,name,size,eTag,lastModifiedDateTime,file,folder,package,remoteItem" } });
    if (got.kind === "err") return err(problemOfCall(got.error, { path }));
    const item = parseItem(safeJson(got.value.body));
    if (item.kind === "err") return err(unavailable(`Graph gave an item that cannot be read: ${item.error}`, false, path));
    return item.value.kind === "file" ? ok(item.value) : err({ kind: "missing", path });
  };

  const bytesOf = async (path: Path): Promise<Result<Uint8Array, Problem>> => {
    const got = await graph.send({ method: "GET", address: contentAddress(drive, segsOf(path)), download: true });
    if (got.kind === "err") return err(problemOfCall(got.error, { path }));
    if (got.value.body.length > maxBytes) return err(refused("too-large", `${got.value.body.length} bytes are more than the ${maxBytes} this store takes`, path));
    return ok(got.value.body);
  };

  /** The revision of an object that has been asked about: the digest Graph keeps, or the digest of what a read gives. */
  const revisionOfItem = async (path: Path, item: Extract<Item, { kind: "file" }>): Promise<Result<Revision, Problem>> => {
    if (item.sha256 !== undefined) return ok(revisionOf(item.sha256));
    if (item.size > maxBytes) return err(refused("too-large", `${item.size} bytes are more than the ${maxBytes} this store takes, and the drive keeps no digest of the object`, path));
    const bytes = await bytesOf(path);
    return bytes.kind === "ok" ? ok(revisionOf(await sha256(bytes.value))) : bytes;
  };

  /** A conflict about an object: what it is at now. */
  const conflictAt = async (path: Path, expect: Expect): Promise<Problem> => {
    const now = await itemAt(path);
    if (now.kind === "err") return now.error.kind === "missing" ? conflict(path, expect, { kind: "absent" } satisfies Found) : now.error;
    const rev = await revisionOfItem(path, now.value);
    return rev.kind === "ok" ? conflict(path, expect, { kind: "rev", rev: rev.value }) : rev.error;
  };

  /** Removes the folders a delete left empty, from the parent of the path up to the folder of the store. Best effort. */
  const prune = async (path: Path): Promise<void> => {
    const segs = path.split("/");
    for (let depth = segs.length - 1; depth >= 1; depth--) {
      const folder = [...prefixSegs, ...segs.slice(0, depth)];
      const children = await graph.send({ method: "GET", address: childrenAddress(drive, folder), query: { $top: "1", $select: "id,name" } });
      if (children.kind === "err") return;
      const page = parsePage(safeJson(children.value.body));
      if (page.kind === "err" || page.value.items.length > 0) return;
      const gone = await graph.send({ method: "DELETE", address: itemAddress(drive, folder) });
      if (gone.kind === "err") return;
    }
  };

  const handle: Handler = async (op: Op) => {
    switch (op.op) {
      case "read": {
        const own = ownProblem(op.path);
        if (own !== undefined) return err(own);
        const item = await itemAt(op.path);
        if (item.kind === "err") return err(item.error);
        let bytes = await bytesOf(op.path);
        if (bytes.kind === "err") return err(bytes.error);
        let digest = await sha256(bytes.value);
        let known = item.value.sha256;
        if (known !== undefined && known !== digest) {
          // the object may have changed between the two requests: ask once more before calling it tampered
          const again = await itemAt(op.path);
          known = again.kind === "ok" ? again.value.sha256 : undefined;
          bytes = await bytesOf(op.path);
          if (bytes.kind === "err") return err(bytes.error);
          digest = await sha256(bytes.value);
          if (known !== undefined && known !== digest) return err(tampered(op.path, "the bytes are not the ones their digest in Graph says they are"));
        }
        return ok({ op: "read", value: { bytes: bytes.value, rev: revisionOf(digest), ...(item.value.modified === undefined ? {} : { modified: item.value.modified }) } });
      }
      case "stat": {
        const own = ownProblem(op.path);
        if (own !== undefined) return err(own);
        const item = await itemAt(op.path);
        if (item.kind === "err") return err(item.error);
        const rev = await revisionOfItem(op.path, item.value);
        if (rev.kind === "err") return err(rev.error);
        const value: Stat = { path: op.path, size: item.value.size, rev: rev.value, ...(item.value.modified === undefined ? {} : { modified: item.value.modified }) };
        return ok({ op: "stat", value });
      }
      case "write": {
        const own = ownProblem(op.path);
        if (own !== undefined) return err(own);
        if (op.bytes.length > maxBytes) return err(refused("too-large", `${op.bytes.length} bytes are more than the ${maxBytes} this store takes`, op.path));
        const hex = await sha256(op.bytes);
        const headers: Record<string, string> = { "content-type": "application/octet-stream" };
        const query: Record<string, string> = {};
        let created = false;
        switch (op.expect.kind) {
          case "absent":
            query[CONFLICT_BEHAVIOR] = "fail";
            created = true;
            break;
          case "any": {
            const before = await itemAt(op.path);
            created = before.kind === "err" && before.error.kind === "missing";
            if (before.kind === "err" && before.error.kind !== "missing") return err(before.error);
            query[CONFLICT_BEHAVIOR] = "replace";
            break;
          }
          case "rev": {
            const wanted = op.expect.rev as string;
            if (!wanted.startsWith("sha256:") || !HEX64.test(wanted.slice(7))) return err(refused("unsupported-expectation", `${wanted} is not a revision of this store: a revision is sha256: and the digest of the bytes`, op.path));
            const before = await itemAt(op.path);
            if (before.kind === "err") return err(before.error.kind === "missing" ? conflict(op.path, op.expect, { kind: "absent" }) : before.error);
            const have = await revisionOfItem(op.path, before.value);
            if (have.kind === "err") return err(have.error);
            if (have.value !== op.expect.rev) return err(conflict(op.path, op.expect, { kind: "rev", rev: have.value }));
            if (before.value.eTag === "") return err(unavailable("Graph gave no entity tag to hold the write to", false, op.path));
            headers["if-match"] = before.value.eTag;
            query[CONFLICT_BEHAVIOR] = "replace";
            break;
          }
          default:
            return err(unavailable("an expectation of no known kind", false, op.path));
        }
        const sent = await graph.send({ method: "PUT", address: contentAddress(drive, segsOf(op.path)), query, headers, body: op.bytes });
        if (sent.kind === "err") {
          const e = sent.error;
          if (e.kind === "failure" && op.expect.kind !== "any") {
            const kind = kindOf(e.failure);
            if (kind === "precondition" || kind === "locked" || (kind === "name-exists" && op.expect.kind === "absent")) {
              const found = await conflictAt(op.path, op.expect);
              if (found.kind === "conflict" || found.kind === "unavailable") return err(found);
            }
            if (op.expect.kind === "rev" && kind === "not-found") return err(conflict(op.path, op.expect, { kind: "absent" }));
          }
          return err(problemOfCall(e, { path: op.path }));
        }
        const answered = parseItem(safeJson(sent.value.body));
        if (answered.kind === "ok" && answered.value.kind === "file" && answered.value.sha256 !== undefined && answered.value.sha256 !== hex) return err(tampered(op.path, "Graph holds bytes that are not the ones sent"));
        return ok({ op: "write", value: { rev: revisionOf(hex), created } });
      }
      case "delete": {
        const own = ownProblem(op.path);
        if (own !== undefined) return err(own);
        const before = await itemAt(op.path);
        const exists = before.kind === "ok";
        if (before.kind === "err" && before.error.kind !== "missing") return err(before.error);
        if (op.expect.kind === "absent") {
          if (exists) return err(await conflictAt(op.path, op.expect));
          return ok({ op: "delete", value: { existed: false } });
        }
        const headers: Record<string, string> = {};
        if (op.expect.kind === "rev") {
          if (before.kind === "err") return err(conflict(op.path, op.expect, { kind: "absent" }));
          const wanted = op.expect.rev as string;
          if (!wanted.startsWith("sha256:") || !HEX64.test(wanted.slice(7))) return err(refused("unsupported-expectation", `${wanted} is not a revision of this store: a revision is sha256: and the digest of the bytes`, op.path));
          const have = await revisionOfItem(op.path, before.value);
          if (have.kind === "err") return err(have.error);
          if (have.value !== op.expect.rev) return err(conflict(op.path, op.expect, { kind: "rev", rev: have.value }));
          headers["if-match"] = before.value.eTag;
        }
        if (before.kind === "err") return ok({ op: "delete", value: { existed: false } });
        const done = await graph.send({ method: "DELETE", address: itemAddress(drive, segsOf(op.path)), headers });
        if (done.kind === "err") {
          const e = done.error;
          if (e.kind === "failure" && kindOf(e.failure) === "not-found") return ok({ op: "delete", value: { existed: false } });
          if (e.kind === "failure" && op.expect.kind === "rev" && (kindOf(e.failure) === "precondition" || kindOf(e.failure) === "locked")) return err(await conflictAt(op.path, op.expect));
          return err(problemOfCall(e, { path: op.path }));
        }
        await prune(op.path);
        return ok({ op: "delete", value: { existed: true } });
      }
      case "list": {
        const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), PAGE);
        const start = op.prefix === "" ? [] : (op.prefix as string).split("/");
        let after: string | undefined;
        if (op.after !== undefined) {
          try {
            after = decodeURIComponent(op.after);
          } catch {
            return err(unavailable("the cursor is not one this store made", false));
          }
        }
        const found: { readonly path: Path; readonly item: Extract<Item, { kind: "file" }> }[] = [];
        const folders: (readonly string[])[] = [start];
        let requests = 0;
        while (folders.length > 0) {
          const folder = folders.pop() as readonly string[];
          let next: string | undefined;
          for (;;) {
            if (++requests > maxRequests) return err(unavailable(`the listing would take more than ${maxRequests} requests`, false));
            const page = await graph.send(
              next === undefined
                ? { method: "GET", address: childrenAddress(drive, [...prefixSegs, ...folder]), query: { $top: "200", $select: "id,name,size,eTag,lastModifiedDateTime,file,folder,package,remoteItem" } }
                : { method: "GET", url: next },
            );
            if (page.kind === "err") {
              if (page.error.kind === "failure" && kindOf(page.error.failure) === "not-found") break;
              return err(problemOfCall(page.error, {}));
            }
            const parsed = parsePage(safeJson(page.value.body));
            if (parsed.kind === "err") return err(unavailable(`a page of the listing could not be read: ${parsed.error}`, false));
            for (const item of parsed.value.items) {
              if (item.kind === "folder") {
                if (segmentProblem(item.name) === undefined) folders.push([...folder, item.name]);
              } else if (item.kind === "file") {
                const path = parsePath([...folder, item.name].join("/"));
                if (path.kind === "err" || pathProblem(path.value) !== undefined) continue;
                found.push({ path: path.value, item });
                if (found.length > maxEntries) return err(unavailable(`the listing would hold more than ${maxEntries} entries`, false));
              }
            }
            if (parsed.value.next === undefined) break;
            next = parsed.value.next;
          }
        }
        found.sort((a, b) => comparePaths(a.path, b.path));
        const later = after === undefined ? found : found.filter((f) => comparePaths(f.path, after as string) > 0);
        const entries = later.slice(0, limit);
        const stats = await mapLimit(entries, concurrency, async (e): Promise<Result<Stat, Problem>> => {
          const rev = await revisionOfItem(e.path, e.item);
          return rev.kind === "err" ? rev : ok({ path: e.path, size: e.item.size, rev: rev.value, ...(e.item.modified === undefined ? {} : { modified: e.item.modified }) });
        });
        const out: Stat[] = [];
        for (const s of stats) {
          if (s.kind === "err") {
            // a file that went between the listing and the question is not in the list; any other problem is the list's
            if (s.error.kind === "missing") continue;
            return err(s.error);
          }
          out.push(s.value);
        }
        const last = entries[entries.length - 1];
        let next: Cursor | undefined;
        if (later.length > limit && last !== undefined) {
          const c = parseCursor(encodeURIComponent(last.path));
          if (c.kind === "err") return err(unavailable(c.error, false));
          next = c.value;
        }
        return ok({ op: "list", value: next === undefined ? { entries: out } : { entries: out, next } });
      }
      case "batch":
      case "rename":
      case "history":
      case "rangeRead":
      case "append":
      case "search":
        return err(refused("capability-absent", `a store on OneDrive does not have ${op.op}`));
      default:
        return err(unavailable("an operation of no known kind", false));
    }
  };

  const place: Place = options.place;
  return ok(makeStore({ id: formatPlace(place), place, consistency: options.consistency ?? "strong", traits: { caseSensitive: false, maxObject: maxBytes }, capabilities: CAPABILITIES, handle }));
}

function safeJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}
