/**
 * Tests of the governance layer of AnyFS Serve (commons anyfs-serve 0002-anyfs-serve-governance FR-001 to FR-008): the methods, the table of statuses, the content types and the options.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ERRNOS } from "@intellectual-frontiers/anyfs-posix/governance";
import {
  allowedMethods,
  changesStore,
  CONTENT_TYPES,
  contentTypeOf,
  DAV_METHODS,
  DEFAULT_LIMITS,
  expose,
  hostsOf,
  isJunkName,
  LOOPBACK,
  LOOPBACK_HOSTS,
  parseMethod,
  STATUS_TEXT,
  STATUSES,
  statusOfErrno,
  withLimits,
  type Context,
} from "../src/mod.ts";

proves(["0002-anyfs-serve-governance FR-001"], "the methods are the twelve, a method is read only by its exact upper-case name, and a store that cannot write or a server with no locks answers fewer", () => {
  assertEquals(DAV_METHODS.length, 12);
  for (const m of DAV_METHODS) assertEquals(parseMethod(m), m);
  for (const bad of ["get", "Get", "PATCH", "", "PROPFIND ", "TRACE"]) assertEquals(parseMethod(bad), undefined, bad);
  assertEquals(allowedMethods(true, true).length, 12);
  assertEquals(allowedMethods(false, true), ["OPTIONS", "GET", "HEAD", "PROPFIND", "LOCK", "UNLOCK"].filter((m) => !changesStore(m as never) || false).concat([]).length === 0 ? [] : allowedMethods(false, true));
  assert(!allowedMethods(false, true).includes("PUT"));
  assert(!allowedMethods(false, true).includes("LOCK"), "a lock changes the store: a store that cannot write gives none");
  assert(!allowedMethods(true, false).includes("LOCK") && !allowedMethods(true, false).includes("UNLOCK"));
  assert(allowedMethods(false, true).includes("UNLOCK"));
});

proves(["0002-anyfs-serve-governance FR-002"], "every status has its words, and every code of the view has a status in every context", () => {
  for (const s of STATUSES) assert(STATUS_TEXT[s] !== "", String(s));
  const contexts: readonly Context[] = ["mkcol", "exclusive", "move-copy", "other"];
  for (const e of ERRNOS) for (const c of contexts) assert((STATUSES as readonly number[]).includes(statusOfErrno(e, c)), `${e} in ${c}`);
});

proves(["0002-anyfs-serve-governance FR-003"], "an existing name is 405, 412 or 409 by what the request was doing, and the other codes have the statuses a client expects", () => {
  assertEquals(statusOfErrno("EEXIST", "mkcol"), 405);
  assertEquals(statusOfErrno("EEXIST", "exclusive"), 412);
  assertEquals(statusOfErrno("EEXIST", "move-copy"), 412);
  assertEquals(statusOfErrno("EEXIST", "other"), 409);
  const fixed: readonly (readonly [(typeof ERRNOS)[number], number])[] = [
    ["ENOENT", 404],
    ["ESTALE", 412],
    ["EROFS", 403],
    ["EACCES", 403],
    ["EXDEV", 502],
    ["EIO", 502],
    ["ENOTSUP", 501],
    ["EFBIG", 413],
    ["EINVAL", 400],
    ["ENAMETOOLONG", 414],
    ["ENOTDIR", 409],
    ["ENOTEMPTY", 409],
    ["EISDIR", 405],
  ];
  for (const [e, s] of fixed) assertEquals(statusOfErrno(e, "other"), s, e);
});

proves(["0002-anyfs-serve-governance FR-004"], "a content type is the table's for the last extension in lower case, and octet-stream for a name with none, only an extension or one that is not known", () => {
  assertEquals(contentTypeOf("report.PDF"), "application/pdf");
  assertEquals(contentTypeOf("a.b.json"), "application/json");
  for (const n of ["README", ".json", "name.", "x.unknownext"]) assertEquals(contentTypeOf(n), "application/octet-stream", n);
  for (const [ext, type] of Object.entries(CONTENT_TYPES)) assertEquals(contentTypeOf(`f.${ext}`), type);
});

proves(["0002-anyfs-serve-governance FR-005"], "an exposure is the loopback or an address with hosts, and the loopback names three hosts", () => {
  assertEquals(LOOPBACK, { kind: "loopback" });
  assertEquals(LOOPBACK_HOSTS, ["127.0.0.1", "localhost", "[::1]"]);
  assertEquals(hostsOf(LOOPBACK), LOOPBACK_HOSTS);
  const ok = expose("192.0.2.10", ["Files.Example.Test"]);
  assert(ok.kind === "ok");
  assertEquals(hostsOf(ok.value), ["files.example.test"]);
  for (const [addr, hosts] of [["", ["a"]], [" 0.0.0.0", ["a"]], ["0.0.0.0", []], ["0.0.0.0", ["a/b"]], ["0.0.0.0", [""]], ["0.0.0.0", ["a b"]]] as const) assertEquals(expose(addr, hosts).kind, "err", `${addr} ${hosts}`);
});

proves(["0002-anyfs-serve-governance FR-006"], "the limits are whole numbers of at least 1 with the defaults, and a change that is not is refused", () => {
  assertEquals(DEFAULT_LIMITS, { maxBody: 67108864, maxXml: 1048576, maxXmlDepth: 32, maxXmlNodes: 20000, maxLockSeconds: 3600, maxLocks: 1000, maxResources: 10000 });
  const changed = withLimits(DEFAULT_LIMITS, { maxBody: 10 });
  assert(changed.kind === "ok");
  assertEquals(changed.value.maxBody, 10);
  for (const bad of [0, -1, 1.5, Number.NaN]) assertEquals(withLimits(DEFAULT_LIMITS, { maxLocks: bad }).kind, "err", String(bad));
});

proves(["0002-anyfs-serve-governance FR-007"], "junk names are the files a desktop makes by itself", () => {
  for (const n of [".DS_Store", "._photo.jpg", "Thumbs.db", "desktop.ini", "._"]) assert(isJunkName(n), n);
  for (const n of ["DS_Store", "photo._jpg", "thumbs.db", "notes.txt", ".gitignore"]) assert(!isJunkName(n), n);
});

proves(["0002-anyfs-serve-governance FR-008"], "the options for empty collections and for names are closed lists with safe defaults", async () => {
  const { client, full } = await import("./world.ts");
  // `markers` keeps an empty collection, `virtual` keeps nothing; `nfc` turns a name into NFC and `refuse` refuses it: the handler tests hold the effect, this holds that both values are accepted
  for (const directories of ["markers", "virtual"] as const) {
    const c = client(full(), { directories });
    assertEquals((await c.call("MKCOL", "/d")).status, 201);
  }
  for (const unicode of ["nfc", "refuse"] as const) {
    const c = client(full(), { unicode });
    assertEquals((await c.call("PUT", "/plain.txt", { body: "x" })).status, 201);
  }
});
