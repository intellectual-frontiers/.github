// Spec: 0002-anyfs-gdrive-store FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-009
/**
 * The store over a folder of Google Drive. Drive addresses files by identifier, keeps a folder as a file of its own and allows many files of one name in one folder, so the store resolves a path to identifiers one folder
 * at a time by asking for a name in a parent, and where a name is held more than once it means the oldest (by creation time, then by identifier), which every writer follows. A write that expects no object makes the file and
 * then asks for the name again: where an older file is there it removes its own and says the object was there, so that of several writers exactly one wins; the folders it makes on the way are settled the same way. Drive
 * keeps no condition on a write, so the store has no `cas` and says so in its type: a revision cannot be expected here, and a store that pretended to would lose a change.
 *
 * The revision of an object is `sha256:` and the digest of its bytes, the same as in every other store: Drive keeps `sha256Checksum` for a blob, and where it does not the store reads the bytes.
 *
 * @remarks
 * Limits, said once: an object is whole and at most `maxBytes` (5 MiB, the most one multipart upload takes; a resumable upload is a later capability); a path costs a request for each of its folders, since identifiers
 * are not kept between operations; a listing walks every folder below the prefix; a Google document, sheet, slide or shortcut is not an object; two files of one name made by another client are one object, the oldest,
 * and the other is left alone; a delete moves to the trash unless the store is told to remove for good.
 *
 * @example
 * ```ts
 * import { openDriveStore, staticToken } from "./store.ts";
 * // const opened = await openDriveStore({ place, token: staticToken(process.env.TOKEN ?? "") });
 * // opened.kind === "ok" && opened.value.capabilities.has("cas"); // false
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
import { type CallError, makeDrive, type TokenSource } from "./api.ts";
import { problemOf, type Subject } from "./errors.ts";
import { byAge, type DriveFile, FIELDS, FOLDER_TYPE, parseFile, parsePage, quoted } from "./files.ts";
import { fetchTransport, type Transport } from "./transport.ts";

export { staticToken, type TokenSource } from "./api.ts";

/** The place of a store on Google Drive. */
export type DrivePlace = Extract<Place, { readonly kind: "gdrive" }>;

/** The capabilities of the store: no `cas`, because Drive keeps no condition on a write. */
export const CAPABILITIES = ["read", "write", "list", "stat", "delete"] as const;
/** The store. */
export type DriveStore = Store<(typeof CAPABILITIES)[number]>;

/** What a store is made with. */
export type DriveOptions = {
  /** The folder: `parsePlace("gdrive://FOLDER-ID")`. */
  readonly place: DrivePlace;
  readonly token: TokenSource;
  /** Where the API listens: `https://www.googleapis.com` where it is left out. */
  readonly endpoint?: string;
  /** The most bytes an object may have: 5 MiB where it is left out, and never more (the most one multipart upload takes). */
  readonly maxBytes?: number;
  /** What a delete does: move to the trash (the default) or remove for good. */
  readonly deletion?: "trash" | "delete";
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

const API = "https://www.googleapis.com";
const MULTIPART_MAX = 5 * 1024 * 1024;
const PAGE = 1000;

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

function safeJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

/** The body of a multipart upload: the metadata as JSON, then the bytes. The boundary is one that is not in the bytes. */
function multipart(metadata: unknown, bytes: Uint8Array): { readonly body: Uint8Array; readonly type: string } {
  const text = new TextDecoder("latin1");
  const hay = text.decode(bytes);
  let n = 0;
  let boundary = `anyfs-${n}-boundary`;
  while (hay.includes(boundary)) boundary = `anyfs-${++n}-boundary`;
  const enc = new TextEncoder();
  const head = enc.encode(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\ncontent-type: application/octet-stream\r\n\r\n`);
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return { body, type: `multipart/related; boundary=${boundary}` };
}

/** A store on a folder of Drive, or why there is none. The folder is asked once, so that a token that is not accepted, or a folder that is not there, is found here. */
export async function openDriveStore(options: DriveOptions): Promise<Result<DriveStore, string>> {
  const maxBytes = Math.min(options.maxBytes ?? MULTIPART_MAX, MULTIPART_MAX);
  const rootId = options.place.folder;
  const drive = makeDrive({ endpoint: options.endpoint ?? API, token: options.token, transport: options.transport ?? fetchTransport(), timeoutMs: options.timeoutMs ?? 30_000 });
  const concurrency = options.listConcurrency ?? 8;
  const maxEntries = options.maxEntries ?? 100_000;
  const maxRequests = options.maxRequests ?? 5000;
  const deletion = options.deletion ?? "trash";
  const probe = await drive.send({ method: "GET", path: `/drive/v3/files/${encodeURIComponent(rootId)}`, query: { fields: FIELDS } });
  if (probe.kind === "err") return err(`the folder ${rootId} could not be opened: ${probe.error.kind === "failure" ? `the Drive API answered ${probe.error.failure.status} ${probe.error.failure.reason}` : probe.error.message}`);
  const root = parseFile(safeJson(probe.value.body));
  if (root.kind === "err" || root.value.kind !== "folder") return err(`${rootId} is not a folder of Drive`);

  /** The files of a name in a parent that is not in the trash, the oldest first. The name is compared exactly: a query of Drive may match more loosely. */
  const named = async (parent: string, name: string, path: Path | undefined): Promise<Result<readonly DriveFile[], Problem>> => {
    const found: DriveFile[] = [];
    let token: string | undefined;
    for (let i = 0; i < 100; i++) {
      const answer = await drive.send({
        method: "GET",
        path: "/drive/v3/files",
        query: { q: `${quoted(parent)} in parents and name = ${quoted(name)} and trashed = false`, fields: `nextPageToken,files(${FIELDS})`, pageSize: "100", includeItemsFromAllDrives: "true", ...(token === undefined ? {} : { pageToken: token }) },
      });
      if (answer.kind === "err") return err(problemOfCall(answer.error, path === undefined ? {} : { path }));
      const page = parsePage(safeJson(answer.value.body));
      if (page.kind === "err") return err(unavailable(`a list of files could not be read: ${page.error}`, false, path));
      for (const f of page.value.files) if (!f.trashed && f.name === name) found.push(f);
      if (page.value.next === undefined) break;
      token = page.value.next;
    }
    return ok(found.sort(byAge));
  };

  const trash = async (file: DriveFile): Promise<void> => {
    if (deletion === "delete") await drive.send({ method: "DELETE", path: `/drive/v3/files/${encodeURIComponent(file.id)}` });
    else await drive.send({ method: "PATCH", path: `/drive/v3/files/${encodeURIComponent(file.id)}`, headers: { "content-type": "application/json" }, body: new TextEncoder().encode(JSON.stringify({ trashed: true })), query: { fields: "id" } });
  };

  /** The folder at the segments below the root: its identifier, or nothing where it is not there and `create` is not asked. Where a name on the way is a file, a refusal. */
  const folderAt = async (segments: readonly string[], create: boolean, path: Path | undefined): Promise<Result<string | undefined, Problem>> => {
    let parent = rootId;
    for (const name of segments) {
      const there = await named(parent, name, path);
      if (there.kind === "err") return there;
      const oldest = there.value[0];
      if (oldest !== undefined) {
        if (oldest.kind !== "folder") return err(refused("unportable-path", `${name} is a file where a folder is needed`, path));
        parent = oldest.id;
        continue;
      }
      if (!create) return ok(undefined);
      const made = await drive.send({
        method: "POST",
        path: "/drive/v3/files",
        headers: { "content-type": "application/json" },
        body: new TextEncoder().encode(JSON.stringify({ name, mimeType: FOLDER_TYPE, parents: [parent] })),
        query: { fields: FIELDS },
      });
      if (made.kind === "err") return err(problemOfCall(made.error, path === undefined ? {} : { path }));
      const mine = parseFile(safeJson(made.value.body));
      if (mine.kind === "err") return err(unavailable(`a folder could not be read: ${mine.error}`, false, path));
      // another writer may have made the same folder at the same time: the oldest is the folder, and ours goes
      const after = await named(parent, name, path);
      if (after.kind === "err") return after;
      const winner = after.value[0] ?? mine.value;
      if (winner.id !== mine.value.id) await trash(mine.value);
      if (winner.kind !== "folder") return err(refused("unportable-path", `${name} is a file where a folder is needed`, path));
      parent = winner.id;
    }
    return ok(parent);
  };

  const split = (path: Path): { readonly dirs: readonly string[]; readonly name: string } => {
    const parts = path.split("/");
    return { dirs: parts.slice(0, -1), name: parts[parts.length - 1] ?? "" };
  };

  /** The file at a path, the oldest of its name: a blob, or the problem (a folder, or a file of Google, is not an object of the store). */
  const fileAt = async (path: Path): Promise<Result<Extract<DriveFile, { kind: "blob" }>, Problem>> => {
    const { dirs, name } = split(path);
    const parent = await folderAt(dirs, false, path);
    if (parent.kind === "err") return parent;
    if (parent.value === undefined) return err({ kind: "missing", path });
    const found = await named(parent.value, name, path);
    if (found.kind === "err") return found;
    const oldest = found.value[0];
    return oldest !== undefined && oldest.kind === "blob" ? ok(oldest) : err({ kind: "missing", path });
  };

  const bytesOf = async (path: Path, file: DriveFile): Promise<Result<Uint8Array, Problem>> => {
    const got = await drive.send({ method: "GET", path: `/drive/v3/files/${encodeURIComponent(file.id)}`, query: { alt: "media" } });
    if (got.kind === "err") return err(problemOfCall(got.error, { path }));
    if (got.value.body.length > maxBytes) return err(refused("too-large", `${got.value.body.length} bytes are more than the ${maxBytes} this store takes`, path));
    return ok(got.value.body);
  };

  const revisionOfFile = async (path: Path, file: Extract<DriveFile, { kind: "blob" }>): Promise<Result<Revision, Problem>> => {
    if (file.sha256 !== undefined) return ok(revisionOf(file.sha256));
    if (file.size > maxBytes) return err(refused("too-large", `${file.size} bytes are more than the ${maxBytes} this store takes, and Drive keeps no digest of the object`, path));
    const bytes = await bytesOf(path, file);
    return bytes.kind === "ok" ? ok(revisionOf(await sha256(bytes.value))) : bytes;
  };

  /** A conflict about an object that is there: what it is at. */
  const conflictWith = async (path: Path, expect: Expect, file: Extract<DriveFile, { kind: "blob" }>): Promise<Problem> => {
    const rev = await revisionOfFile(path, file);
    return rev.kind === "ok" ? conflict(path, expect, { kind: "rev", rev: rev.value }) : rev.error;
  };

  const settleParse = (answer: Uint8Array, path: Path): Result<DriveFile, Problem> => {
    const parsed = parseFile(safeJson(answer));
    return parsed.kind === "ok" ? ok(parsed.value) : err(unavailable(`a file could not be read: ${parsed.error}`, false, path));
  };

  /** Removes the folders a delete left empty, from the parent of the path up to the folder of the store. Best effort. */
  const prune = async (path: Path): Promise<void> => {
    const dirs = split(path).dirs;
    for (let depth = dirs.length; depth >= 1; depth--) {
      const folder = await folderAt(dirs.slice(0, depth), false, path);
      if (folder.kind === "err" || folder.value === undefined) return;
      const children = await drive.send({ method: "GET", path: "/drive/v3/files", query: { q: `${quoted(folder.value)} in parents and trashed = false`, fields: "files(id)", pageSize: "1", includeItemsFromAllDrives: "true" } });
      if (children.kind === "err") return;
      const page = safeJson(children.value.body);
      const files = typeof page === "object" && page !== null ? (page as { files?: unknown }).files : undefined;
      if (!Array.isArray(files) || files.length > 0) return;
      await trash({ kind: "folder", id: folder.value, name: "", created: 0 });
    }
  };

  const handle: Handler = async (op: Op) => {
    switch (op.op) {
      case "read": {
        const file = await fileAt(op.path);
        if (file.kind === "err") return err(file.error);
        let bytes = await bytesOf(op.path, file.value);
        if (bytes.kind === "err") return err(bytes.error);
        let digest = await sha256(bytes.value);
        if (file.value.sha256 !== undefined && file.value.sha256 !== digest) {
          // the object may have changed between the two requests: ask once more before calling it tampered
          const again = await fileAt(op.path);
          if (again.kind === "err") return err(again.error);
          bytes = await bytesOf(op.path, again.value);
          if (bytes.kind === "err") return err(bytes.error);
          digest = await sha256(bytes.value);
          if (again.value.sha256 !== undefined && again.value.sha256 !== digest) return err(tampered(op.path, "the bytes are not the ones their digest in Drive says they are"));
        }
        return ok({ op: "read", value: { bytes: bytes.value, rev: revisionOf(digest), ...(file.value.modified === undefined ? {} : { modified: file.value.modified }) } });
      }
      case "stat": {
        const file = await fileAt(op.path);
        if (file.kind === "err") return err(file.error);
        const rev = await revisionOfFile(op.path, file.value);
        if (rev.kind === "err") return err(rev.error);
        const value: Stat = { path: op.path, size: file.value.size, rev: rev.value, ...(file.value.modified === undefined ? {} : { modified: file.value.modified }) };
        return ok({ op: "stat", value });
      }
      case "write": {
        if (op.expect.kind === "rev") return err(refused("unsupported-expectation", "Drive keeps no condition on a write: a revision cannot be expected here", op.path));
        if (op.bytes.length > maxBytes) return err(refused("too-large", `${op.bytes.length} bytes are more than the ${maxBytes} this store takes`, op.path));
        const hex = await sha256(op.bytes);
        const { dirs, name } = split(op.path);
        const parent = await folderAt(dirs, true, op.path);
        if (parent.kind === "err") return err(parent.error);
        if (parent.value === undefined) return err(unavailable("the folder could not be made", false, op.path));
        const there = await named(parent.value, name, op.path);
        if (there.kind === "err") return err(there.error);
        const oldest = there.value[0];
        if (oldest !== undefined && oldest.kind !== "blob") return err(refused("unportable-path", `${name} is ${oldest.kind === "folder" ? "a folder" : "a file of Google that has no bytes"}`, op.path));
        if (op.expect.kind === "absent" && oldest !== undefined) return err(await conflictWith(op.path, op.expect, oldest));
        const replace = async (file: DriveFile): Promise<Result<void, Problem>> => {
          const put = await drive.send({ method: "PATCH", path: `/upload/drive/v3/files/${encodeURIComponent(file.id)}`, query: { uploadType: "media", fields: FIELDS }, headers: { "content-type": "application/octet-stream" }, body: op.bytes });
          if (put.kind === "err") return err(problemOfCall(put.error, { path: op.path }));
          const back = settleParse(put.value.body, op.path);
          if (back.kind === "ok" && back.value.kind === "blob" && back.value.sha256 !== undefined && back.value.sha256 !== hex) return err(tampered(op.path, "Drive holds bytes that are not the ones sent"));
          return ok(undefined);
        };
        if (oldest !== undefined) {
          const done = await replace(oldest);
          if (done.kind === "err") return err(done.error);
          return ok({ op: "write", value: { rev: revisionOf(hex), created: false } });
        }
        const form = multipart({ name, parents: [parent.value] }, op.bytes);
        const made = await drive.send({ method: "POST", path: "/upload/drive/v3/files", query: { uploadType: "multipart", fields: FIELDS }, headers: { "content-type": form.type }, body: form.body });
        if (made.kind === "err") return err(problemOfCall(made.error, { path: op.path }));
        const mine = settleParse(made.value.body, op.path);
        if (mine.kind === "err") return err(mine.error);
        if (mine.value.kind === "blob" && mine.value.sha256 !== undefined && mine.value.sha256 !== hex) return err(tampered(op.path, "Drive holds bytes that are not the ones sent"));
        // another writer may have made the same name at the same time: the oldest is the object, and ours goes
        const after = await named(parent.value, name, op.path);
        if (after.kind === "err") return err(after.error);
        const winner = after.value[0];
        if (winner === undefined || winner.id === mine.value.id) return ok({ op: "write", value: { rev: revisionOf(hex), created: true } });
        await trash(mine.value);
        if (winner.kind !== "blob") return err(refused("unportable-path", `${name} is not a file`, op.path));
        if (op.expect.kind === "absent") return err(await conflictWith(op.path, op.expect, winner));
        const done = await replace(winner);
        if (done.kind === "err") return err(done.error);
        return ok({ op: "write", value: { rev: revisionOf(hex), created: false } });
      }
      case "delete": {
        if (op.expect.kind === "rev") return err(refused("unsupported-expectation", "Drive keeps no condition on a delete: a revision cannot be expected here", op.path));
        const { dirs, name } = split(op.path);
        const parent = await folderAt(dirs, false, op.path);
        if (parent.kind === "err") return err(parent.error);
        let files: readonly Extract<DriveFile, { kind: "blob" }>[] = [];
        if (parent.value !== undefined) {
          const found = await named(parent.value, name, op.path);
          if (found.kind === "err") return err(found.error);
          files = found.value.filter((f): f is Extract<DriveFile, { kind: "blob" }> => f.kind === "blob");
        }
        const oldest = files[0];
        if (op.expect.kind === "absent") {
          if (oldest !== undefined) return err(await conflictWith(op.path, op.expect, oldest));
          return ok({ op: "delete", value: { existed: false } });
        }
        if (oldest === undefined) return ok({ op: "delete", value: { existed: false } });
        // every file of the name goes, so that the name is gone and not shown by the next of its duplicates
        for (const f of files) await trash(f);
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
        const base = await folderAt(start, false, undefined);
        if (base.kind === "err") return err(base.error);
        const entries: { readonly path: Path; readonly file: Extract<DriveFile, { kind: "blob" }> }[] = [];
        let requests = 0;
        const folders: { readonly id: string; readonly segments: readonly string[] }[] = base.value === undefined ? [] : [{ id: base.value, segments: start }];
        while (folders.length > 0) {
          const folder = folders.pop() as { readonly id: string; readonly segments: readonly string[] };
          const children: DriveFile[] = [];
          let token: string | undefined;
          for (;;) {
            if (++requests > maxRequests) return err(unavailable(`the listing would take more than ${maxRequests} requests`, false));
            const page = await drive.send({
              method: "GET",
              path: "/drive/v3/files",
              query: { q: `${quoted(folder.id)} in parents and trashed = false`, fields: `nextPageToken,files(${FIELDS})`, pageSize: "1000", includeItemsFromAllDrives: "true", ...(token === undefined ? {} : { pageToken: token }) },
            });
            if (page.kind === "err") return err(problemOfCall(page.error, {}));
            const parsed = parsePage(safeJson(page.value.body));
            if (parsed.kind === "err") return err(unavailable(`a page of the listing could not be read: ${parsed.error}`, false));
            for (const f of parsed.value.files) if (!f.trashed) children.push(f);
            if (parsed.value.next === undefined) break;
            token = parsed.value.next;
          }
          // a name held more than once is one object: the oldest
          const oldestOf = new Map<string, DriveFile>();
          for (const f of children.sort(byAge)) if (!oldestOf.has(f.name)) oldestOf.set(f.name, f);
          for (const f of oldestOf.values()) {
            if (f.kind === "folder") folders.push({ id: f.id, segments: [...folder.segments, f.name] });
            else if (f.kind === "blob") {
              const path = parsePath([...folder.segments, f.name].join("/"));
              if (path.kind === "err") continue;
              entries.push({ path: path.value, file: f });
              if (entries.length > maxEntries) return err(unavailable(`the listing would hold more than ${maxEntries} entries`, false));
            }
          }
        }
        entries.sort((a, b) => comparePaths(a.path, b.path));
        const later = after === undefined ? entries : entries.filter((e) => comparePaths(e.path, after as string) > 0);
        const page = later.slice(0, limit);
        const stats = await mapLimit(page, concurrency, async (e): Promise<Result<Stat, Problem>> => {
          const rev = await revisionOfFile(e.path, e.file);
          return rev.kind === "err" ? rev : ok({ path: e.path, size: e.file.size, rev: rev.value, ...(e.file.modified === undefined ? {} : { modified: e.file.modified }) });
        });
        const out: Stat[] = [];
        for (const s of stats) {
          if (s.kind === "err") {
            if (s.error.kind === "missing") continue;
            return err(s.error);
          }
          out.push(s.value);
        }
        const last = page[page.length - 1];
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
        return err(refused("capability-absent", `a store on Google Drive does not have ${op.op}`));
      default:
        return err(unavailable("an operation of no known kind", false));
    }
  };

  const place: Place = options.place;
  return ok(makeStore({ id: formatPlace(place), place, consistency: options.consistency ?? "strong", traits: { caseSensitive: true, maxObject: maxBytes }, capabilities: CAPABILITIES, handle }));
}
