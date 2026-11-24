/**
 * The shapes the Drive API (version 3) is documented to answer with, decoded by the store (commons anyfs-gdrive 0003-anyfs-gdrive-tests FR-002). THESE FIXTURES ARE MADE FROM THE DOCUMENTATION OF THE DRIVE API (the
 * examples of the `files` resource, of a list of files and of the error object), NOT RECORDED FROM A LIVE SERVICE: nothing here shows that the service answers so today. A recording against a test account would replace
 * them, and is the first thing a live run should add.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { byAge, failureOf, kindOf, parseFile, parsePage, quoted } from "../src/mod.ts";

const BLOB = { kind: "drive#file", id: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms", name: "Report.pdf", mimeType: "application/pdf", size: "12345", md5Checksum: "d41d8cd98f00b204e9800998ecf8427e", sha256Checksum: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855", createdTime: "2016-03-21T20:01:37.000Z", modifiedTime: "2016-03-22T10:00:00.123Z", trashed: false };
const FOLDER = { kind: "drive#file", id: "0B1", name: "Reports", mimeType: "application/vnd.google-apps.folder", createdTime: "2016-03-21T20:01:37.000Z", trashed: false };
const DOC = { kind: "drive#file", id: "1doc", name: "Minutes", mimeType: "application/vnd.google-apps.document", createdTime: "2016-03-21T20:01:37.000Z", trashed: false };
const SHORTCUT = { kind: "drive#file", id: "1sc", name: "Link", mimeType: "application/vnd.google-apps.shortcut", createdTime: "2016-03-21T20:01:37.000Z", trashed: false };

proves(["0003-anyfs-gdrive-tests FR-002"], "a file is read as a blob with its digest, a folder, or something of Google that has no bytes, a file in the trash is marked, and a field of another type is a reason", () => {
  const blob = parseFile(BLOB);
  assert(blob.kind === "ok" && blob.value.kind === "blob");
  if (blob.kind === "ok" && blob.value.kind === "blob") {
    assertEquals([blob.value.name, blob.value.size, blob.value.sha256], ["Report.pdf", 12345, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"]);
    assertEquals(blob.value.modified, "2016-03-22T10:00:00.123Z");
    assertEquals(blob.value.created, Date.parse("2016-03-21T20:01:37.000Z"));
  }
  const noDigest = parseFile({ ...BLOB, sha256Checksum: undefined });
  assert(noDigest.kind === "ok" && noDigest.value.kind === "blob" && noDigest.value.sha256 === undefined);
  assert(parseFile(FOLDER).kind === "ok" && (parseFile(FOLDER) as { value: { kind: string } }).value.kind === "folder");
  assertEquals((parseFile(DOC) as { value: { kind: string } }).value.kind, "other");
  assertEquals((parseFile(SHORTCUT) as { value: { kind: string } }).value.kind, "other");
  assertEquals((parseFile({ ...BLOB, trashed: true }) as { value: { trashed: boolean } }).value.trashed, true);
  assertEquals(parseFile({ ...BLOB, size: "twelve" }).kind, "err");
  assertEquals(parseFile({ ...BLOB, id: "" }).kind, "err");
  assertEquals(parseFile({ ...BLOB, mimeType: 5 }).kind, "err");
  assertEquals(parseFile(null).kind, "err");
});

proves(["0003-anyfs-gdrive-tests FR-002"], "a list of files is read with the token of the next page, one that is not a list is a reason, and the oldest of a name is the one by creation time and then by identifier", () => {
  const page = parsePage({ kind: "drive#fileList", incompleteSearch: false, files: [BLOB, FOLDER, DOC], nextPageToken: "~!!~AI9FV7R" });
  assert(page.kind === "ok");
  if (page.kind === "ok") {
    assertEquals(page.value.files.map((f) => f.kind), ["blob", "folder", "other"]);
    assertEquals(page.value.next, "~!!~AI9FV7R");
  }
  const last = parsePage({ files: [] });
  assert(last.kind === "ok" && last.value.next === undefined);
  assertEquals(parsePage({ files: {} }).kind, "err");
  assertEquals(parsePage({ files: [{}] }).kind, "err");
  assertEquals(parsePage({ files: [], nextPageToken: 1 }).kind, "err");
  const a = { kind: "folder", id: "b", name: "x", created: 5 } as const;
  const b = { kind: "folder", id: "a", name: "x", created: 5 } as const;
  const c = { kind: "folder", id: "z", name: "x", created: 1 } as const;
  assertEquals([a, b, c].sort(byAge).map((f) => f.id), ["z", "a", "b"]);
  assertEquals(quoted("it's a \\ name"), "'it\\'s a \\\\ name'");
});

proves(["0003-anyfs-gdrive-tests FR-002"], "the error objects of the documentation are read for their reason and message and are the kinds they are said to be", () => {
  const err = (status: number, message: string, reason: string): Uint8Array => new TextEncoder().encode(JSON.stringify({ error: { code: status, message, errors: [{ message, domain: "global", reason, location: "fileId", locationType: "parameter" }] } }));
  const nf = failureOf(404, {}, err(404, "File not found: 1abc.", "notFound"));
  assertEquals([nf.status, nf.reason, nf.message], [404, "notFound", "File not found: 1abc."]);
  assertEquals(kindOf(nf), "not-found");
  assertEquals(kindOf(failureOf(403, {}, err(403, "User Rate Limit Exceeded.", "userRateLimitExceeded"))), "throttled");
  assertEquals(kindOf(failureOf(403, {}, err(403, "The user does not have sufficient permissions for this file.", "insufficientFilePermissions"))), "denied");
  assertEquals(kindOf(failureOf(403, {}, err(403, "The user's Drive storage quota has been exceeded.", "storageQuotaExceeded"))), "quota");
  assertEquals(kindOf(failureOf(401, {}, err(401, "Invalid Credentials", "authError"))), "bad-token");
  assertEquals(kindOf(failureOf(500, {}, err(500, "Internal Error", "backendError"))), "server");
  assertEquals(kindOf(failureOf(503, {}, new Uint8Array())), "server");
  assertEquals(kindOf(failureOf(400, {}, err(400, "Invalid Value", "invalid"))), "invalid");
});
