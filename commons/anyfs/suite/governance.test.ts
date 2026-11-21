/**
 * Tests of the governance of AnyFS (commons anyfs 0002-anyfs-governance FR-001 to FR-008): the paths and prefixes, their normalization and portability, the revisions and cursors, the expectations and what a store of
 * some capabilities takes, the closed lists of capabilities, the places and their round trip, and the problems with one sentence each.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  availability,
  CAPABILITIES,
  CAPABILITY_SUMMARY,
  comparePaths,
  conflict,
  CONSISTENCIES,
  CORE_CAPABILITIES,
  describeProblem,
  expectAbsent,
  expectAny,
  expectRev,
  type ExpectFor,
  formatPlace,
  isCapability,
  isUnder,
  missing,
  OPTIONAL_CAPABILITIES,
  parseCursor,
  parsePath,
  parsePlace,
  parsePrefix,
  parseRevision,
  type Path,
  PLACE_KINDS,
  portabilityFindings,
  REFUSALS,
  refused,
  relativeTo,
  ROOT,
  schemeOf,
  tampered,
  unavailable,
} from "../src/governance/mod.ts";

const path = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const refusedText = (text: string): string => {
  const r = parsePath(text);
  return r.kind === "err" ? r.error : "";
};

proves(["0002-anyfs-governance FR-001"], "a path is a relative key of segments, refusing the way up, backslashes, control characters, empty segments, long names and lone surrogates, and it is normalized", () => {
  for (const ok of ["a", "a/b", "fleet/olympia/asset.json", "ünï/çödé", "日本語", "emoji/😀", "with space/x", "a.b/c..d", "..a/b..", ".hidden"]) assertEquals(parsePath(ok).kind, "ok", ok);
  for (const bad of ["", "/a", "a/", "a//b", ".", "..", "a/./b", "a/../b", "a\\b", "a\u0000b", "a\u0007b", "a\u007fb", "x".repeat(256), "a/" + "é".repeat(128), "a".repeat(1025), "\ud800"]) {
    assertEquals(parsePath(bad).kind, "err", JSON.stringify(bad).slice(0, 30));
  }
  assertStringIncludes(refusedText("a/../b"), "..");
  assertEquals(path("é"), path("é"), "decomposed and composed are one path");
  assertEquals(parsePath("e\u0301").kind === "ok" && parsePath("e\u0301").kind === "ok" ? path("e\u0301") : "", "é");
  assertEquals(parsePrefix("").kind === "ok" ? ROOT : undefined, ROOT);
  assertEquals(parsePrefix("a/").kind, "err");
  const a = path("a/b");
  assert(isUnder(ROOT, a));
  const prefix = parsePrefix("a");
  assert(prefix.kind === "ok");
  assert(isUnder(prefix.value, a));
  assert(!isUnder(prefix.value, path("ab/c")), "a prefix is a folder and not a text");
  assert(!isUnder(prefix.value, path("a")), "a prefix is not below itself");
  assertEquals(relativeTo(prefix.value, a), "b");
  fc.assert(
    fc.property(fc.array(fc.stringMatching(/^[a-z0-9]{1,8}$/), { minLength: 1, maxLength: 6 }), (parts) => {
      const text = parts.join("/");
      const r = parsePath(text);
      return r.kind === "ok" && r.value === text;
    }),
  );
});

proves(["0002-anyfs-governance FR-002"], "paths are compared as text in the order of their code points, and portability names what another file system could not hold", () => {
  assertEquals(["b", "a", "é", "😀", "\uffe5", "Z"].sort(comparePaths), ["Z", "a", "b", "é", "\uffe5", "😀"]);
  assert(comparePaths("a", "a") === 0 && comparePaths("a", "ab") < 0 && comparePaths("😀", "\uffe5") > 0);
  assertEquals(portabilityFindings(path("fine/name.txt")), []);
  assertStringIncludes(portabilityFindings(path("a/b:c")).join(" "), ":");
  assertStringIncludes(portabilityFindings(path("a/what?")).join(" "), "?");
  assertStringIncludes(portabilityFindings(path("trailing./x")).join(" "), "space or a dot");
  assertStringIncludes(portabilityFindings(path("dir/CON")).join(" "), "device");
  assertStringIncludes(portabilityFindings(path("dir/aux.txt")).join(" "), "device");
  assert(path("File") !== path("file"), "paths are case sensitive");
});

proves(["0002-anyfs-governance FR-003"], "a revision is scheme:value and a cursor is opaque printable text, each made only by its parser", () => {
  for (const ok of ["sha256:ab12", "etag:\"x-1\"", "git:0123abcd", "ver:7"]) assertEquals(parseRevision(ok).kind, "ok", ok);
  for (const bad of ["", "sha256", "SHA:1", "sha256:", "sha256:a b", "1:abc", `sha256:${"a".repeat(260)}`]) assertEquals(parseRevision(bad).kind, "err", bad.slice(0, 20));
  const r = parseRevision("sha256:ab12");
  assert(r.kind === "ok");
  assertEquals(schemeOf(r.value), "sha256");
  assertEquals(parseCursor("abc%20def").kind, "ok");
  assertEquals(parseCursor("").kind, "err");
  assertEquals(parseCursor("a b").kind, "err");
});

proves(["0002-anyfs-governance FR-004"], "an expectation is any, absent or a revision, and only a store with cas takes a revision", () => {
  const rev = parseRevision("sha256:1");
  assert(rev.kind === "ok");
  assertEquals(expectAny.kind, "any");
  assertEquals(expectAbsent.kind, "absent");
  assertEquals(expectRev(rev.value), { kind: "rev", rev: rev.value });
  const noCas: ExpectFor<"read" | "write"> = expectAny;
  const withCas: ExpectFor<"write" | "cas"> = expectRev(rev.value);
  // @ts-expect-error a store without cas takes no revision
  const bad: ExpectFor<"write"> = expectRev(rev.value);
  assert(noCas.kind === "any" && withCas.kind === "rev" && bad !== undefined);
});

proves(["0002-anyfs-governance FR-005"], "the capabilities are a closed union of five core and nine optional ones, each with a sentence", () => {
  assertEquals([...CORE_CAPABILITIES], ["read", "write", "list", "stat", "delete"]);
  assertEquals(OPTIONAL_CAPABILITIES.length, 9);
  assertEquals(CAPABILITIES.length, 14);
  for (const c of CAPABILITIES) {
    assert(isCapability(c));
    assert(CAPABILITY_SUMMARY[c].length > 10, c);
  }
  assert(!isCapability("chmod") && !isCapability(""));
});

proves(["0002-anyfs-governance FR-006"], "a store declares how consistent it is, from a closed list", () => {
  assertEquals([...CONSISTENCIES], ["strong", "read-your-writes", "eventual-listing"]);
});

proves(["0002-anyfs-governance FR-007"], "a place is a typed address that formats back to itself, and only memory and file are implemented", () => {
  const texts = [
    "memory:scratch",
    "file:///var/lib/fleet",
    "file:///C:/data/fleet",
    "ssh://shah@olympia.example:2222/srv/fleet",
    "ssh://host/srv",
    "ssh://[::1]/srv/x",
    "git+file:///work/fleet#main",
    "git+file:///work/fleet",
    "github://intellectual-frontiers/fleet@main/hosts",
    "github://intellectual-frontiers/fleet",
    "gitlab://gitlab.example/group/sub/project@v1/ops",
    "gitlab://gitlab.com/group/project",
    "s3://fleet-backups/2026/11",
    "s3://fleet-backups",
    "onedrive://b!abc-123/Documents/fleet",
    "gdrive://1AbCdEfGhIjK",
    "sql://sqlite/%2Fvar%2Flib%2Ffleet.db",
  ];
  for (const t of texts) {
    const p = parsePlace(t);
    assert(p.kind === "ok", `${t}: ${p.kind === "err" ? p.error : ""}`);
    assertEquals(formatPlace(p.value), t, t);
    const again = parsePlace(formatPlace(p.value));
    assert(again.kind === "ok");
    assertEquals(again.value, p.value, t);
  }
  const kinds = new Set(texts.map((t) => { const p = parsePlace(t); return p.kind === "ok" ? p.value.kind : ""; }));
  assertEquals([...kinds].sort(), [...PLACE_KINDS].sort());
  for (const bad of ["", "nothing", "ftp://x/y", "file://host/x", "file:///a/../b", "ssh://host:99999/x", "github://x", "s3://B/x", "gdrive://", "memory:", "sql://Sqlite/x", "git+file://host/x", "github://owner/repo@ref/../x"]) {
    assertEquals(parsePlace(bad).kind, "err", bad);
  }
  assertStringIncludes((parsePlace("ftp://x/y") as { error: string }).error, "scheme");
  for (const k of PLACE_KINDS) assertEquals(availability(k), k === "memory" || k === "file" ? "implemented" : "planned");
});

proves(["0002-anyfs-governance FR-008"], "a problem is one of five kinds, each in one sentence that names the path", () => {
  const p = path("fleet/a");
  const rev = parseRevision("sha256:1");
  assert(rev.kind === "ok");
  const all = [
    missing(p),
    conflict(p, expectAbsent, { kind: "rev", rev: rev.value }),
    conflict(p, expectRev(rev.value), { kind: "absent" }),
    refused("read-only", "the store is read only", p),
    refused("consent", "not allowed"),
    unavailable("the host does not answer", true, p),
    unavailable("the disk is full", false),
    tampered(p, "the digest differs"),
  ];
  for (const x of all) {
    const s = describeProblem(x);
    assert(s.length > 10 && !s.includes("\n"), s);
  }
  assertStringIncludes(describeProblem(all[0] as never), "fleet/a");
  assertStringIncludes(describeProblem(all[1] as never), "no object");
  assertEquals(new Set(all.map((x) => x.kind)).size, 5);
  assertEquals([...REFUSALS].length, 7);
});
