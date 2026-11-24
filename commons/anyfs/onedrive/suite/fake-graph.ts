/**
 * A Microsoft Graph made in process, from its documentation (not from a recording of the live service): the items of a drive addressed by path (`/me/drive/root:/a/b`, `:/content`, `:/children`), names that are
 * case-insensitive and case-preserving, the folders that an upload makes on the way, a download that is redirected to a pre-authenticated address that must come without the token, `If-Match` on the entity tag (which
 * changes at every write), `@microsoft.graph.conflictBehavior`, paging with `@odata.nextLink`, the digest of the contents as `sha256Hash` where the service is told to give it, error objects, and a way to make any
 * request fail. It is a `Transport`, so no socket is opened.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { HttpRequest, HttpResponse, Transport } from "../src/mod.ts";

export const ENDPOINT = "https://graph.test/v1.0";
export const DOWNLOAD_HOST = "https://download.test";

type Node = { id: string; name: string; folder: boolean; bytes: Uint8Array; version: number; modified: string; sha: string; pkg?: boolean };

export type FakeGraph = {
  readonly transport: Transport;
  /** Every request that reached the service, as `METHOD address`. */
  readonly requests: string[];
  /** Every request with its headers, for the tests that read them. */
  readonly log: HttpRequest[];
  /** Makes the digest the service gives for a file wrong. */
  corrupt(path: string): void;
  /** Changes a file at once, behind the store's back (the digest of the text is given, since the change cannot wait). */
  bump(path: string, text: string, sha: string): void;
  /** Adds an item that is neither a file nor a folder (a package). */
  addPackage(path: string): void;
  /** Requests that carried a token to the download host: there must be none. */
  readonly leaked: string[];
  /** The tokens the service accepts. */
  readonly tokens: Set<string>;
  /** Makes a request fail: return a response to answer with it. */
  inject: ((request: HttpRequest) => HttpResponse | undefined) | undefined;
  /** Writes an object behind the store's back (another client of the drive). */
  put(path: string, text: string): Promise<void>;
  names(): string[];
  /** The text of a file, or nothing. */
  text(path: string): string | undefined;
};

export type FakeOptions = { readonly hashes?: boolean; readonly pageSize?: number; readonly token?: string };

const json = (status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse => ({ status, headers: { "content-type": "application/json", ...headers }, body: new TextEncoder().encode(JSON.stringify(body)) });
const fail = (status: number, code: string, message = code, headers: Record<string, string> = {}): HttpResponse => json(status, { error: { code, message } }, headers);

export function fakeGraph(options: FakeOptions = {}): FakeGraph {
  const hashes = options.hashes ?? true;
  const pageSize = options.pageSize ?? 3;
  const nodes = new Map<string, Node>();
  const tokens = new Set<string>([options.token ?? "good-token"]);
  let ids = 0;
  let clock = Date.UTC(2026, 10, 1);
  const keyOf = (segments: readonly string[]): string => segments.map((s) => s.toLowerCase()).join("/");
  const stamp = (): string => new Date((clock += 1000)).toISOString();
  const nodeJson = (n: Node): Record<string, unknown> =>
    n.pkg === true
      ? { id: n.id, name: n.name, size: 0, package: { type: "oneNote" }, lastModifiedDateTime: n.modified }
      : n.folder
      ? { id: n.id, name: n.name, folder: { childCount: [...nodes.keys()].filter((k) => k.startsWith(`${keyOf(pathOf(n))}/`)).length }, lastModifiedDateTime: n.modified }
      : { id: n.id, name: n.name, size: n.bytes.length, eTag: `"{${n.id}},${n.version}"`, cTag: `"c:{${n.id}},${n.version}"`, lastModifiedDateTime: n.modified, file: { mimeType: "application/octet-stream", ...(hashes ? { hashes: { sha256Hash: n.sha.toUpperCase() } } : {}) } };
  const paths = new Map<Node, string[]>();
  const pathOf = (n: Node): string[] => paths.get(n) ?? [];
  const root: Node = { id: "ROOT", name: "root", folder: true, bytes: new Uint8Array(), version: 1, modified: stamp(), sha: "" };
  const find = (segments: readonly string[]): Node | undefined => (segments.length === 0 ? root : nodes.get(keyOf(segments)));
  const make = (segments: readonly string[], folder: boolean, bytes = new Uint8Array(), sha = ""): Node => {
    const n: Node = { id: `ID${++ids}`, name: segments[segments.length - 1] ?? "", folder, bytes, version: 1, modified: stamp(), sha };
    nodes.set(keyOf(segments), n);
    paths.set(n, [...segments]);
    return n;
  };
  const children = (segments: readonly string[]): Node[] => {
    const prefix = segments.length === 0 ? "" : `${keyOf(segments)}/`;
    return [...nodes.entries()].filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/")).map(([, n]) => n).sort((a, b) => a.name.localeCompare(b.name));
  };
  const remove = (segments: readonly string[]): void => {
    const k = keyOf(segments);
    for (const key of [...nodes.keys()]) if (key === k || key.startsWith(`${k}/`)) nodes.delete(key);
  };

  const self: FakeGraph = {
    requests: [],
    log: [],
    leaked: [],
    corrupt(path) {
      const n = find(path.split("/"));
      if (n !== undefined) n.sha = "0".repeat(64);
    },
    bump(path, text, sha) {
      const n = find(path.split("/"));
      if (n === undefined) return;
      n.bytes = new TextEncoder().encode(text);
      n.sha = sha;
      n.version++;
      n.modified = stamp();
    },
    addPackage(path) {
      const segs = path.split("/");
      for (let i = 1; i < segs.length; i++) if (find(segs.slice(0, i)) === undefined) make(segs.slice(0, i), true);
      make(segs, false, new Uint8Array(), "").pkg = true;
    },
    tokens,
    inject: undefined,
    transport: undefined as unknown as Transport,
    async put(path, text) {
      const segs = path.split("/");
      for (let i = 1; i < segs.length; i++) if (find(segs.slice(0, i)) === undefined) make(segs.slice(0, i), true);
      const there = find(segs);
      const data = new TextEncoder().encode(text);
      const sha = await sha256(data);
      if (there === undefined) make(segs, false, data, sha);
      else {
        there.bytes = data;
        there.sha = sha;
        there.version++;
        there.modified = stamp();
      }
    },
    names: () => [...nodes.values()].map((n) => (n.folder ? `${pathOf(n).join("/")}/` : pathOf(n).join("/"))).sort(),
    text: (path) => {
      const n = find(path.split("/"));
      return n === undefined || n.folder ? undefined : new TextDecoder().decode(n.bytes);
    },
  };

  const serve = async (request: HttpRequest): Promise<HttpResponse> => {
    const url = new URL(request.url);
    if (request.url.startsWith(DOWNLOAD_HOST)) {
      self.log.push(request);
      if (request.headers["authorization"] !== undefined) self.leaked.push(request.url);
      const n = [...nodes.values()].find((x) => `${DOWNLOAD_HOST}/dl/${x.id}` === `${url.origin}${url.pathname}`);
      return n === undefined ? fail(404, "itemNotFound") : { status: 200, headers: { "last-modified": new Date(n.modified).toUTCString() }, body: n.bytes };
    }
    self.log.push(request);
    self.requests.push(`${request.method} ${decodeURIComponent(url.pathname)}${url.search === "" ? "" : "?"}${decodeURIComponent(url.search.slice(1))}`);
    const injected = self.inject?.(request);
    if (injected !== undefined) return injected;
    if (!tokens.has((request.headers["authorization"] ?? "").replace(/^Bearer /u, ""))) return fail(401, "InvalidAuthenticationToken", "Access token is empty or invalid");
    const prefix = new URL(ENDPOINT).pathname;
    let rest = decodeURIComponent(url.pathname).slice(prefix.length);
    const drive = /^\/(?:me\/drive|drives\/[^/]+)/u.exec(rest);
    if (drive === null) return fail(404, "itemNotFound", "no such drive");
    rest = rest.slice(drive[0].length);
    if (rest === "") return json(200, { id: "DRIVE", driveType: "personal" });
    let segments: string[] = [];
    let tail = "";
    if (rest === "/root") tail = "";
    else if (rest === "/root/children") tail = "children";
    else if (rest.startsWith("/root:/")) {
      const body = rest.slice("/root:/".length);
      const colon = body.indexOf(":");
      const pathPart = colon === -1 ? body : body.slice(0, colon);
      tail = colon === -1 ? "" : body.slice(colon + 2);
      segments = pathPart.split("/").filter((s) => s !== "");
    } else return fail(400, "invalidRequest", "address not understood");
    let node = find(segments);
    const method = request.method;
    if (tail === "children") {
      if (method !== "GET") return fail(405, "notAllowed");
      if (node === undefined || !node.folder) return fail(404, "itemNotFound");
      const all = children(segments);
      const top = Math.min(Number(url.searchParams.get("$top") ?? pageSize), pageSize);
      const skip = Number(url.searchParams.get("$skiptoken") ?? 0);
      const slice = all.slice(skip, skip + top);
      const next = skip + top < all.length ? { "@odata.nextLink": `${ENDPOINT}${drive[0]}${segments.length === 0 ? "/root/children" : `/root:/${segments.map(encodeURIComponent).join("/")}:/children`}?$top=${top}&$skiptoken=${skip + top}` } : {};
      return json(200, { value: slice.map(nodeJson), ...next });
    }
    if (tail === "content") {
      if (method === "GET") {
        if (node === undefined || node.folder) return fail(404, "itemNotFound");
        return { status: 302, headers: { location: `${DOWNLOAD_HOST}/dl/${node.id}` }, body: new Uint8Array() };
      }
      if (method === "PUT") {
        const body = request.body ?? new Uint8Array();
        const sha = await sha256(body);
        node = find(segments);
        const behavior = url.searchParams.get("@microsoft.graph.conflictBehavior") ?? "replace";
        const match = request.headers["if-match"];
        if (segments.length === 0) return fail(400, "invalidRequest");
        for (let i = 1; i < segments.length; i++) {
          const anc = find(segments.slice(0, i));
          if (anc !== undefined && !anc.folder) return fail(409, "nameAlreadyExists", "a name on the path is a file");
        }
        if (node !== undefined && node.folder) return fail(409, "nameAlreadyExists", "a folder has the name");
        if (node !== undefined && behavior === "fail") return fail(409, "nameAlreadyExists");
        if (match !== undefined && (node === undefined || `"{${node.id}},${node.version}"` !== match)) return fail(412, "preconditionFailed");
        for (let i = 1; i < segments.length; i++) if (find(segments.slice(0, i)) === undefined) make(segments.slice(0, i), true);
        if (node === undefined) {
          const made = make(segments, false, body.slice(), sha);
          return json(201, nodeJson(made));
        }
        node.bytes = body.slice();
        node.sha = sha;
        node.version++;
        node.modified = stamp();
        return json(200, nodeJson(node));
      }
      return fail(405, "notAllowed");
    }
    if (method === "GET") return node === undefined ? fail(404, "itemNotFound") : json(200, nodeJson(node));
    if (method === "DELETE") {
      if (node === undefined) return fail(404, "itemNotFound");
      const match = request.headers["if-match"];
      if (match !== undefined && `"{${node.id}},${node.version}"` !== match) return fail(412, "preconditionFailed");
      remove(segments);
      return { status: 204, headers: {}, body: new Uint8Array() };
    }
    return fail(405, "notAllowed");
  };
  (self as { transport: Transport }).transport = async (request) => ok(await serve(request));
  return self;
}
