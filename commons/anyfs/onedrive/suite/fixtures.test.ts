/**
 * The shapes Microsoft Graph is documented to answer with, decoded by the store (commons anyfs-onedrive 0003-anyfs-onedrive-tests FR-002). THESE FIXTURES ARE MADE FROM THE DOCUMENTATION OF MICROSOFT GRAPH
 * (the examples of the driveItem resource, of the children of a folder and of the error object), NOT RECORDED FROM A LIVE SERVICE: nothing here shows that the service answers so today. A recording against a test tenant
 * would replace them, and is the first thing a live run should add.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { failureOf, kindOf, parseItem, parsePage } from "../src/mod.ts";

const ETAG = '"{ABCDEF01-2345-6789-ABCD-EF0123456789},2"';

const FILE_PERSONAL = { id: "0123456789abc", name: "filename.txt", eTag: ETAG, cTag: '"c:{ABCDEF01-2345-6789-ABCD-EF0123456789},2"', createdDateTime: "2016-03-21T20:01:37Z", lastModifiedDateTime: "2016-03-21T20:01:37Z", size: 12345, file: { mimeType: "text/plain", hashes: { quickXorHash: "bGlrZSBhIG1hZ2ljIGhhc2g=", sha1Hash: "DA39A3EE5E6B4B0D3255BFEF95601890AFD80709" } } };
const FILE_WITH_SHA256 = { ...FILE_PERSONAL, file: { mimeType: "text/plain", hashes: { sha256Hash: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855" } } };
const FOLDER = { id: "01ABC", name: "Documents", folder: { childCount: 4 }, lastModifiedDateTime: "2016-03-21T20:01:37Z", size: 4096 };
const NOTEBOOK = { id: "01NOTE", name: "Notebook", package: { type: "oneNote" }, size: 100 };
const SHORTCUT = { id: "01LINK", name: "Shared", remoteItem: { id: "other", parentReference: { driveId: "d" } }, folder: undefined, file: { mimeType: "x" } };

proves(["0003-anyfs-onedrive-tests FR-002"], "a drive item is read as a file with its hashes where Graph gives them, a folder, or something that is neither, and a field of another type is a reason", () => {
  const personal = parseItem(FILE_PERSONAL);
  assert(personal.kind === "ok" && personal.value.kind === "file");
  if (personal.kind === "ok" && personal.value.kind === "file") {
    assertEquals([personal.value.name, personal.value.size, personal.value.eTag], ["filename.txt", 12345, ETAG]);
    assertEquals(personal.value.sha256, undefined, "a drive that keeps no SHA-256 has none here");
    assertEquals(personal.value.modified, "2016-03-21T20:01:37.000Z");
  }
  const business = parseItem(FILE_WITH_SHA256);
  assert(business.kind === "ok" && business.value.kind === "file" && business.value.sha256 === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  const folder = parseItem(FOLDER);
  assert(folder.kind === "ok" && folder.value.kind === "folder");
  assertEquals(parseItem(NOTEBOOK).kind === "ok" && (parseItem(NOTEBOOK) as { value: { kind: string } }).value.kind, "other");
  const shortcut = parseItem(SHORTCUT);
  assert(shortcut.kind === "ok" && shortcut.value.kind === "other");
  assertEquals(parseItem({ id: "1", name: "x", size: "12", file: {} }).kind, "err");
  assertEquals(parseItem({ id: "", name: "x" }).kind, "err");
  assertEquals(parseItem([]).kind, "err");
  assertEquals(parseItem({ id: "1", name: "x", size: 1, file: { hashes: { sha256Hash: "not hex" } } }).kind === "ok", true, "a hash that is not one is not used");
});

proves(["0003-anyfs-onedrive-tests FR-002"], "a page of children is read with its link to the next page, and a page that is not one is a reason", () => {
  const page = parsePage({ value: [FILE_PERSONAL, FOLDER, NOTEBOOK], "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/drive/root/children?$skiptoken=abc" });
  assert(page.kind === "ok");
  if (page.kind === "ok") {
    assertEquals(page.value.items.map((i) => i.kind), ["file", "folder", "other"]);
    assertEquals(page.value.next, "https://graph.microsoft.com/v1.0/me/drive/root/children?$skiptoken=abc");
  }
  const last = parsePage({ value: [] });
  assert(last.kind === "ok" && last.value.next === undefined);
  assertEquals(parsePage({ value: "no" }).kind, "err");
  assertEquals(parsePage({ value: [{ id: 1 }] }).kind, "err");
  assertEquals(parsePage({ value: [], "@odata.nextLink": 5 }).kind, "err");
  assertEquals(parsePage(null).kind, "err");
});

proves(["0003-anyfs-onedrive-tests FR-002"], "the error objects of the documentation are read for their code and message, with Retry-After, and are the kinds they are said to be", () => {
  const json = (code: string): Uint8Array => new TextEncoder().encode(JSON.stringify({ error: { code, message: "The resource could not be found.", innerError: { "request-id": "r", date: "2016-03-21T20:01:37" } } }));
  const found = failureOf(404, {}, json("itemNotFound"));
  assertEquals([found.status, found.code, found.message], [404, "itemNotFound", "The resource could not be found."]);
  assertEquals(kindOf(found), "not-found");
  assertEquals(kindOf(failureOf(409, {}, json("nameAlreadyExists"))), "name-exists");
  assertEquals(kindOf(failureOf(412, {}, json("preconditionFailed"))), "precondition");
  assertEquals(kindOf(failureOf(429, { "retry-after": "120" }, json("activityLimitReached"))), "throttled");
  assertEquals(failureOf(429, { "retry-after": "120" }, json("activityLimitReached")).retryAfterMs, 120_000);
  assertEquals(kindOf(failureOf(503, {}, new Uint8Array())), "server");
  assertEquals(kindOf(failureOf(401, {}, json("InvalidAuthenticationToken"))), "bad-token");
  assertEquals(kindOf(failureOf(507, {}, json("quotaLimitReached"))), "quota");
});
