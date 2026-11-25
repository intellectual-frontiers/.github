/**
 * Tests of `folderHandler` and `serveFolder` (commons 0001-net FR-018): a folder of synthetic files served by a real server on port 0, with raw requests so that no client tidies a hostile path first.
 *
 * @module
 */
import { request } from "node:http";
import { mkdir, symlink, utimes, writeFile } from "node:fs/promises";
import { withTempDir } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { folderHandler, serveFolder, type Server } from "../src/serve.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const FOLDER = "0001-net FR-018";

type Reply = { readonly status: number; readonly headers: Readonly<Record<string, string | string[] | undefined>>; readonly body: Buffer };

/** A request with the path exactly as given (a client that normalizes `..` would hide the attack). */
function raw(server: Server, method: string, path: string, headers: Record<string, string> = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: server.addr.port, method, path, headers }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (c: Buffer) => parts.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(parts) }));
    });
    req.on("error", reject);
    req.end();
  });
}

const text = (r: Reply): string => r.body.toString("utf8");

/** A folder with an index, a page, assets of each type, a nested folder with no index and, outside it, a secret that a symlink points at. */
async function withFolder(f: (server: Server, root: string) => Promise<void>): Promise<void> {
  await withTempDir(async (dir) => {
    const root = join(dir, "rendition");
    const outside = join(dir, "outside");
    await mkdir(join(root, "docs", "deep"), { recursive: true });
    await mkdir(join(root, "bare"), { recursive: true });
    await mkdir(join(root, "classic"), { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(join(root, "README.html"), "<h1>synthetic-rendition-01</h1>");
    await writeFile(join(root, "classic", "index.html"), "<p>index wins</p>");
    await writeFile(join(root, "classic", "README.html"), "<p>readme loses</p>");
    await writeFile(join(root, "docs", "deep", "README.html"), "<p>deep</p>");
    await writeFile(join(root, "style.css"), "a{}");
    await writeFile(join(root, "app.js"), "export {}");
    await writeFile(join(root, "data.json"), "{}");
    await writeFile(join(root, "logo.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
    await writeFile(join(root, "a.png"), "png");
    await writeFile(join(root, "a.jpg"), "jpg");
    await writeFile(join(root, "a.webp"), "webp");
    await writeFile(join(root, "book.epub"), "epub");
    await writeFile(join(root, "note.txt"), "synthetic note");
    await writeFile(join(root, "blob.xyz"), "unknown");
    await writeFile(join(root, "empty.txt"), "");
    await writeFile(join(root, "UPPER.PDF"), "0123456789");
    await writeFile(join(root, "doc.pdf"), "0123456789");
    await writeFile(join(root, "a b.txt"), "space");
    await writeFile(join(outside, "secret.txt"), "synthetic-secret-01");
    await symlink(join(outside, "secret.txt"), join(root, "leak.txt"));
    await symlink(outside, join(root, "leakdir"));
    await symlink(join(root, "style.css"), join(root, "inside-link.css"));
    const server = await serveFolder(root, { port: 0 });
    try {
      await f(server, root);
    } finally {
      await server.shutdown();
    }
  });
}

proves([FOLDER], "the index of a folder is README.html, index.html wins where both are there, a directory is never listed, and a directory asked for without its slash is redirected", async () => {
  await withFolder(async (server) => {
    const home = await raw(server, "GET", "/");
    assertEquals([home.status, text(home), home.headers["content-type"]], [200, "<h1>synthetic-rendition-01</h1>", "text/html; charset=utf-8"]);
    assertEquals(text(await raw(server, "GET", "/README.html")), "<h1>synthetic-rendition-01</h1>");
    assertEquals(text(await raw(server, "GET", "/classic/")), "<p>index wins</p>");
    assertEquals(text(await raw(server, "GET", "/docs/deep/")), "<p>deep</p>");
    const redirect = await raw(server, "GET", "/docs/deep?x=1");
    assertEquals([redirect.status, redirect.headers["location"]], [301, "/docs/deep/?x=1"]);
    for (const path of ["/bare/", "/bare", "/docs/", "/docs", "/missing.html", "/missing/"]) {
      const r = await raw(server, "GET", path);
      assertEquals(r.status, 404, path);
      assert(!text(r).includes("README") && !text(r).includes("bare"), `no listing for ${path}`);
    }
  });
});

proves([FOLDER], "each file has its content type, an unknown extension is application/octet-stream, and every response has nosniff and no-cache", async () => {
  await withFolder(async (server) => {
    const types: Record<string, string> = {
      "/style.css": "text/css; charset=utf-8",
      "/app.js": "text/javascript; charset=utf-8",
      "/data.json": "application/json; charset=utf-8",
      "/logo.svg": "image/svg+xml",
      "/a.png": "image/png",
      "/a.jpg": "image/jpeg",
      "/a.webp": "image/webp",
      "/doc.pdf": "application/pdf",
      "/UPPER.PDF": "application/pdf",
      "/book.epub": "application/epub+zip",
      "/note.txt": "text/plain; charset=utf-8",
      "/blob.xyz": "application/octet-stream",
      "/a%20b.txt": "text/plain; charset=utf-8",
    };
    for (const [path, type] of Object.entries(types)) {
      const r = await raw(server, "GET", path);
      assertEquals([r.status, r.headers["content-type"]], [200, type], path);
    }
    for (const path of ["/", "/note.txt", "/missing", "/..%2f", "/style.css"]) {
      const r = await raw(server, "GET", path);
      assertEquals([r.headers["x-content-type-options"], r.headers["cache-control"]], ["nosniff", "no-cache"], path);
    }
    assertEquals((await raw(server, "POST", "/")).headers["x-content-type-options"], "nosniff");
    const empty = await raw(server, "GET", "/empty.txt");
    assertEquals([empty.status, empty.body.length, empty.headers["content-length"]], [200, 0, "0"]);
  });
});

proves([FOLDER], "a path that climbs out, is encoded to, is absolute, holds a NUL or a backslash, or is a symlink that leaves the root is never served and never says what is outside", async () => {
  await withFolder(async (server) => {
    const attempts = [
      "/../outside/secret.txt",
      "/%2e%2e/outside/secret.txt",
      "/%2E%2E/outside/secret.txt",
      "/..%2foutside%2fsecret.txt",
      "/%2e%2e%2foutside%2fsecret.txt",
      "/docs/../../outside/secret.txt",
      "/docs/%2e%2e/%2e%2e/outside/secret.txt",
      "/..\\outside\\secret.txt",
      "/..%5coutside%5csecret.txt",
      "/%5c..%5coutside%5csecret.txt",
      "/note.txt%00.png",
      "/%00",
      "//etc/passwd",
      "/etc/passwd",
      "/C:/Windows/win.ini",
      "/%43%3a/x",
      "/%ff",
      "/leak.txt",
      "/leakdir/secret.txt",
      "/leakdir/",
      "/leakdir",
      "/./note.txt/../../outside/secret.txt",
    ];
    for (const path of attempts) {
      const r = await raw(server, "GET", path);
      assert(r.status >= 400 && r.status < 500 && r.status !== 405, `${path} gave ${r.status}`);
      assert(!text(r).includes("synthetic-secret-01") && !text(r).includes("root:"), path);
      assert(!text(r).toLowerCase().includes("outside"), `${path} names what is outside`);
    }
    const absolute = await raw(server, "GET", "http://127.0.0.1/../outside/secret.txt");
    assert(!text(absolute).includes("synthetic-secret-01"));
    // a symlink that stays inside the root is a file of the root
    assertEquals(text(await raw(server, "GET", "/inside-link.css")), "a{}");
  });
});

proves([FOLDER], "a method but GET and HEAD is 405 with Allow, and HEAD gives the headers of GET with no body", async () => {
  await withFolder(async (server) => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH", "OPTIONS"]) {
      const r = await raw(server, method, "/note.txt");
      assertEquals([r.status, r.headers["allow"]], [405, "GET, HEAD"], method);
    }
    const get = await raw(server, "GET", "/note.txt");
    const head = await raw(server, "HEAD", "/note.txt");
    assertEquals([head.status, head.body.length], [200, 0]);
    for (const h of ["content-type", "content-length", "etag", "accept-ranges", "cache-control", "x-content-type-options"]) assertEquals(head.headers[h], get.headers[h], h);
    assertEquals(head.headers["content-length"], String("synthetic note".length));
    assertEquals((await raw(server, "HEAD", "/missing")).status, 404);
    assertEquals((await raw(server, "HEAD", "/../outside/secret.txt")).status >= 400, true);
  });
});

proves([FOLDER], "the ETag comes from size and modification time, a matching If-None-Match is 304 with no body, and a change makes it a different tag", async () => {
  await withFolder(async (server, root) => {
    const first = await raw(server, "GET", "/note.txt");
    const etag = String(first.headers["etag"]);
    assert(/^"[0-9a-f]+-[0-9a-f]+"$/u.test(etag), etag);
    for (const header of [etag, `W/${etag}`, `"other", ${etag}`, "*"]) {
      const r = await raw(server, "GET", "/note.txt", { "if-none-match": header });
      assertEquals([r.status, r.body.length, r.headers["etag"]], [304, 0, etag], header);
      assertEquals(r.headers["cache-control"], "no-cache");
    }
    assertEquals((await raw(server, "GET", "/note.txt", { "if-none-match": '"nope"' })).status, 200);
    assertEquals((await raw(server, "HEAD", "/note.txt", { "if-none-match": etag })).status, 304);
    await writeFile(join(root, "note.txt"), "synthetic note, changed");
    await utimes(join(root, "note.txt"), new Date(2030, 0, 1), new Date(2030, 0, 1));
    const changed = await raw(server, "GET", "/note.txt", { "if-none-match": etag });
    assertEquals(changed.status, 200);
    assertEquals(text(changed), "synthetic note, changed");
    assert(changed.headers["etag"] !== etag);
  });
});

proves([FOLDER], "a single range gives 206 with its Content-Range, an open or a suffix range works, one outside the file is 416, and anything else is the whole file", async () => {
  await withFolder(async (server) => {
    const part = await raw(server, "GET", "/doc.pdf", { range: "bytes=2-5" });
    assertEquals([part.status, text(part), part.headers["content-range"], part.headers["content-length"], part.headers["content-type"]], [206, "2345", "bytes 2-5/10", "4", "application/pdf"]);
    const open = await raw(server, "GET", "/doc.pdf", { range: "bytes=7-" });
    assertEquals([open.status, text(open), open.headers["content-range"]], [206, "789", "bytes 7-9/10"]);
    const suffix = await raw(server, "GET", "/doc.pdf", { range: "bytes=-3" });
    assertEquals([suffix.status, text(suffix), suffix.headers["content-range"]], [206, "789", "bytes 7-9/10"]);
    const clamped = await raw(server, "GET", "/doc.pdf", { range: "bytes=8-99" });
    assertEquals([clamped.status, text(clamped), clamped.headers["content-range"]], [206, "89", "bytes 8-9/10"]);
    const head = await raw(server, "HEAD", "/doc.pdf", { range: "bytes=0-1" });
    assertEquals([head.status, head.body.length, head.headers["content-range"]], [206, 0, "bytes 0-1/10"]);
    for (const range of ["bytes=10-", "bytes=20-30", "bytes=5-2", "bytes=-0"]) {
      const r = await raw(server, "GET", "/doc.pdf", { range });
      assertEquals([r.status, r.headers["content-range"], r.body.length], [416, "bytes */10", 0], range);
    }
    for (const range of ["bytes=0-1,4-5", "items=0-1", "bytes=a-b", "bytes=", "bytes=-"]) {
      const r = await raw(server, "GET", "/doc.pdf", { range });
      assertEquals([r.status, text(r)], [200, "0123456789"], range);
    }
    const etag = String((await raw(server, "GET", "/doc.pdf")).headers["etag"]);
    assertEquals((await raw(server, "GET", "/doc.pdf", { range: "bytes=0-1", "if-range": etag })).status, 206);
    assertEquals(text(await raw(server, "GET", "/doc.pdf", { range: "bytes=0-1", "if-range": '"stale"' })), "0123456789");
    assertEquals((await raw(server, "GET", "/doc.pdf")).headers["accept-ranges"], "bytes");
  });
});

proves([FOLDER], "serveFolder binds 127.0.0.1 by default, takes the options of serve, and folderHandler is a handler any server can use", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "README.html"), "<p>synthetic-rendition-02</p>");
    const server = await serveFolder(dir);
    try {
      assertEquals(server.addr.hostname, "127.0.0.1");
      assert(server.addr.port > 0);
      const res = await fetch(`http://127.0.0.1:${server.addr.port}/`);
      assertEquals([res.status, await res.text()], [200, "<p>synthetic-rendition-02</p>"]);
    } finally {
      await server.shutdown();
    }
    const handler = folderHandler(dir, { index: ["start.html"], types: { ".html": "text/plain" } });
    const info = { remoteAddr: { hostname: "127.0.0.1", port: 1 } };
    assertEquals((await handler(new Request("http://x.test/"), info)).status, 404);
    assertEquals((await handler(new Request("http://x.test/README.html"), info)).headers.get("content-type"), "text/plain");
    const gone = folderHandler(join(dir, "missing-root"));
    let thrown = false;
    try {
      await gone(new Request("http://x.test/"), info);
    } catch {
      thrown = true;
    }
    assert(thrown, "a root that is not there is the server's onError, never a file");
  });
});
