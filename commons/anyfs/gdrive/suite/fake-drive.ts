/**
 * A Google Drive made in process, from the documentation of the Drive API (version 3), not from a recording of the live service: files addressed by identifier with their parents, a folder as a file of a type of its own,
 * many files of one name in one folder (which Drive allows), names that a query matches more loosely than equality does (the fake matches without regard to case, so the store must compare exactly), the trash,
 * multipart and media uploads, `sha256Checksum` where the service is told to give it, `pageToken` paging, error objects with reasons, and a way to make any request fail. It is a `Transport`, so no socket is opened.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { HttpRequest, HttpResponse, Transport } from "../src/mod.ts";

export const ENDPOINT = "https://drive.test";
export const ROOT = "ROOT0";
const FOLDER = "application/vnd.google-apps.folder";

type Node = { id: string; name: string; mime: string; parents: string[]; bytes: Uint8Array; sha: string; created: number; modified: number; trashed: boolean };

export type FakeDrive = {
  readonly transport: Transport;
  readonly requests: string[];
  readonly log: HttpRequest[];
  readonly tokens: Set<string>;
  inject: ((request: HttpRequest) => HttpResponse | undefined) | undefined;
  /** Makes a file of a name in a folder, behind the store's back; a second one of the same name makes a duplicate. */
  put(folderId: string, name: string, text: string, mime?: string): Promise<string>;
  folder(parent: string, name: string): string;
  /** Every live (not trashed) path, folders ending with a slash. */
  tree(): string[];
  /** Every file in the trash, by name. */
  trashed(): string[];
  /** Makes the digest the service gives for a file wrong. */
  corrupt(id: string): void;
  /** All files with a name, trashed or not. */
  byName(name: string): { id: string; trashed: boolean; text: string }[];
};

export type FakeOptions = { readonly checksums?: boolean; readonly pageSize?: number; readonly token?: string; readonly looseNames?: boolean };

const json = (status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse => ({ status, headers: { "content-type": "application/json", ...headers }, body: new TextEncoder().encode(JSON.stringify(body)) });
const fail = (status: number, reason: string, message = reason, headers: Record<string, string> = {}): HttpResponse => json(status, { error: { code: status, message, errors: [{ message, domain: "global", reason }] } }, headers);

type Clause = { kind: "parent"; id: string } | { kind: "name"; name: string } | { kind: "trashed"; value: boolean };

/** The clauses of a query of Drive: `'ID' in parents`, `name = 'x'` and `trashed = false`, joined by `and`. */
function parseQuery(q: string): Clause[] | undefined {
  const tokens: string[] = [];
  let i = 0;
  while (i < q.length) {
    const c = q[i] ?? "";
    if (c === " ") i++;
    else if (c === "'") {
      let out = "";
      i++;
      while (i < q.length && q[i] !== "'") {
        if (q[i] === "\\") i++;
        out += q[i] ?? "";
        i++;
      }
      if (q[i] !== "'") return undefined;
      i++;
      tokens.push(`'${out}`);
    } else {
      let w = "";
      while (i < q.length && q[i] !== " ") w += q[i++];
      tokens.push(w);
    }
  }
  const clauses: Clause[] = [];
  let t = 0;
  while (t < tokens.length) {
    const a = tokens[t];
    if (a !== undefined && a.startsWith("'") && tokens[t + 1] === "in" && tokens[t + 2] === "parents") {
      clauses.push({ kind: "parent", id: a.slice(1) });
      t += 3;
    } else if (a === "name" && tokens[t + 1] === "=" && tokens[t + 2]?.startsWith("'") === true) {
      clauses.push({ kind: "name", name: (tokens[t + 2] ?? "").slice(1) });
      t += 3;
    } else if (a === "trashed" && tokens[t + 1] === "=" && (tokens[t + 2] === "false" || tokens[t + 2] === "true")) {
      clauses.push({ kind: "trashed", value: tokens[t + 2] === "true" });
      t += 3;
    } else return undefined;
    if (t < tokens.length) {
      if (tokens[t] !== "and") return undefined;
      t++;
    }
  }
  return clauses;
}

/** The two parts of a body of multipart/related: the first as text, the second as bytes. */
function parts(body: Uint8Array, boundary: string): { readonly meta: string; readonly data: Uint8Array } | undefined {
  const text = new TextDecoder("latin1").decode(body);
  const delim = `--${boundary}`;
  const first = text.indexOf(delim);
  const second = text.indexOf(delim, first + delim.length);
  const end = text.lastIndexOf(`${delim}--`);
  if (first < 0 || second < 0 || end < 0) return undefined;
  const sect = (from: number, to: number): { head: string; start: number; stop: number } => {
    const hdrEnd = text.indexOf("\r\n\r\n", from);
    return { head: text.slice(from, hdrEnd), start: hdrEnd + 4, stop: to - 2 };
  };
  const a = sect(first + delim.length, second);
  const b = sect(second + delim.length, end);
  return { meta: new TextDecoder().decode(body.slice(a.start, a.stop)), data: body.slice(b.start, b.stop) };
}

export function fakeDrive(options: FakeOptions = {}): FakeDrive {
  const checksums = options.checksums ?? true;
  const pageSize = options.pageSize ?? 3;
  const loose = options.looseNames ?? true;
  const nodes = new Map<string, Node>();
  const tokens = new Set<string>([options.token ?? "good-token"]);
  let ids = 0;
  let clock = Date.UTC(2026, 10, 1);
  const tick = (): number => ++clock;
  nodes.set(ROOT, { id: ROOT, name: "My Drive", mime: FOLDER, parents: [], bytes: new Uint8Array(), sha: "", created: tick(), modified: tick(), trashed: false });
  const meta = (n: Node): Record<string, unknown> => ({
    id: n.id,
    name: n.name,
    mimeType: n.mime,
    parents: n.parents,
    trashed: n.trashed,
    createdTime: new Date(n.created).toISOString(),
    modifiedTime: new Date(n.modified).toISOString(),
    ...(n.mime === FOLDER || n.mime.startsWith("application/vnd.google-apps.") ? {} : { size: String(n.bytes.length), ...(checksums ? { sha256Checksum: n.sha } : {}) }),
  });
  const add = (name: string, mime: string, parent: string, bytes: Uint8Array, sha: string): Node => {
    const n: Node = { id: `F${++ids}`, name, mime, parents: [parent], bytes, sha, created: tick(), modified: clock, trashed: false };
    nodes.set(n.id, n);
    return n;
  };
  const pathOf = (n: Node): string => {
    const parent = nodes.get(n.parents[0] ?? "");
    return parent === undefined || parent.id === ROOT ? n.name : `${pathOf(parent)}/${n.name}`;
  };
  const alive = (n: Node): boolean => {
    if (n.trashed) return false;
    const p = nodes.get(n.parents[0] ?? "");
    return p === undefined || p.id === ROOT || alive(p);
  };

  const self: FakeDrive = {
    requests: [],
    log: [],
    tokens,
    inject: undefined,
    transport: undefined as unknown as Transport,
    async put(folderId, name, text, mime = "application/octet-stream") {
      const bytes = new TextEncoder().encode(text);
      return add(name, mime, folderId, bytes, await sha256(bytes)).id;
    },
    folder: (parent, name) => add(name, FOLDER, parent, new Uint8Array(), "").id,
    tree: () => [...nodes.values()].filter((n) => n.id !== ROOT && alive(n)).map((n) => (n.mime === FOLDER ? `${pathOf(n)}/` : pathOf(n))).sort(),
    trashed: () => [...nodes.values()].filter((n) => n.trashed).map((n) => n.name).sort(),
    corrupt(id) {
      const n = nodes.get(id);
      if (n !== undefined) n.sha = "0".repeat(64);
    },
    byName: (name) => [...nodes.values()].filter((n) => n.name === name).map((n) => ({ id: n.id, trashed: n.trashed, text: new TextDecoder().decode(n.bytes) })),
  };

  const serve = async (request: HttpRequest): Promise<HttpResponse> => {
    const url = new URL(request.url);
    self.log.push(request);
    self.requests.push(`${request.method} ${url.pathname}${url.search === "" ? "" : `?${decodeURIComponent(url.search.slice(1))}`}`);
    const injected = self.inject?.(request);
    if (injected !== undefined) return injected;
    if (!tokens.has((request.headers["authorization"] ?? "").replace(/^Bearer /u, ""))) return fail(401, "authError", "Invalid Credentials");
    if (url.searchParams.get("supportsAllDrives") !== "true") return fail(400, "badRequest", "supportsAllDrives is not set");
    const path = url.pathname;
    const method = request.method;
    const upload = path.startsWith("/upload/drive/v3/files");
    const idMatch = /^\/(?:upload\/)?drive\/v3\/files\/([^/]+)$/u.exec(path);
    const id = idMatch === null ? undefined : decodeURIComponent(idMatch[1] ?? "");
    const notFound = (what: string): HttpResponse => fail(404, "notFound", `File not found: ${what}.`);

    if (method === "GET" && path === "/drive/v3/files") {
      const clauses = parseQuery(url.searchParams.get("q") ?? "");
      if (clauses === undefined) return fail(400, "invalidQuery", "Invalid Value");
      let all = [...nodes.values()].filter((n) => n.id !== ROOT && clauses.every((c) => (c.kind === "parent" ? n.parents.includes(c.id) : c.kind === "name" ? (loose ? n.name.toLowerCase() === c.name.toLowerCase() : n.name === c.name) : n.trashed === c.value)));
      all = all.sort((a, b) => (a.id < b.id ? -1 : 1));
      const size = Math.min(Number(url.searchParams.get("pageSize") ?? pageSize), pageSize);
      const skip = Number(url.searchParams.get("pageToken") ?? 0);
      const slice = all.slice(skip, skip + size);
      return json(200, { kind: "drive#fileList", files: slice.map(meta), ...(skip + size < all.length ? { nextPageToken: String(skip + size) } : {}) });
    }
    if (method === "GET" && id !== undefined && !upload) {
      const n = nodes.get(id);
      if (n === undefined) return notFound(id);
      if (url.searchParams.get("alt") === "media") return n.mime === FOLDER ? fail(403, "fileNotDownloadable", "Only files with binary content can be downloaded.") : { status: 200, headers: { "content-type": n.mime }, body: n.bytes };
      return json(200, meta(n));
    }
    if (method === "POST" && path === "/drive/v3/files") {
      const body = JSON.parse(new TextDecoder().decode(request.body ?? new Uint8Array())) as { name?: string; mimeType?: string; parents?: string[] };
      const parent = nodes.get(body.parents?.[0] ?? ROOT);
      if (parent === undefined || parent.mime !== FOLDER) return notFound(body.parents?.[0] ?? "");
      return json(200, meta(add(body.name ?? "Untitled", body.mimeType ?? FOLDER, parent.id, new Uint8Array(), "")));
    }
    if (method === "POST" && path === "/upload/drive/v3/files") {
      const type = request.headers["content-type"] ?? "";
      const boundary = /boundary=(.+)$/u.exec(type)?.[1];
      if (boundary === undefined) return fail(400, "badRequest", "multipart expected");
      const split = parts(request.body ?? new Uint8Array(), boundary);
      if (split === undefined) return fail(400, "badRequest", "multipart body");
      const data = split.data;
      const sha = await sha256(data);
      const body = JSON.parse(split.meta) as { name?: string; parents?: string[] };
      const parent = nodes.get(body.parents?.[0] ?? ROOT);
      if (parent === undefined || parent.mime !== FOLDER || parent.trashed) return notFound(body.parents?.[0] ?? "");
      return json(200, meta(add(body.name ?? "Untitled", "application/octet-stream", parent.id, data.slice(), sha)));
    }
    if (method === "PATCH" && upload && id !== undefined) {
      const body = request.body ?? new Uint8Array();
      const sha = await sha256(body);
      const n = nodes.get(id);
      if (n === undefined || n.trashed) return notFound(id);
      n.bytes = body.slice();
      n.sha = sha;
      n.modified = tick();
      return json(200, meta(n));
    }
    if (method === "PATCH" && id !== undefined) {
      const n = nodes.get(id);
      if (n === undefined) return notFound(id);
      const body = JSON.parse(new TextDecoder().decode(request.body ?? new Uint8Array())) as { trashed?: boolean };
      if (body.trashed !== undefined) n.trashed = body.trashed;
      n.modified = tick();
      return json(200, meta(n));
    }
    if (method === "DELETE" && id !== undefined) {
      if (!nodes.has(id)) return notFound(id);
      nodes.delete(id);
      return { status: 204, headers: {}, body: new Uint8Array() };
    }
    return fail(400, "badRequest", `no route for ${method} ${path}`);
  };
  (self as { transport: Transport }).transport = async (request) => ok(await serve(request));
  return self;
}
