/**
 * Tests of the keys of a bucket and the paths of a store (commons anyfs-s3 0002-anyfs-s3-store FR-001, FR-002): the key of a path below a prefix and back, the encoding of a key in a URL, the findings of a key that is
 * not a path of the store, and the names of buckets.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { parsePath, parsePrefix, type Prefix } from "@intellectual-frontiers/anyfs/governance";
import { basePrefix, decodeListedKey, describeFinding, encodeKey, isOwn, keyOf, parseBucketName, pathOfKey } from "../src/mod.ts";

const prefix = (text: string): Prefix => {
  const r = parsePrefix(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const path = (text: string) => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0002-anyfs-s3-store FR-002"], "the key of a path is the prefix, a slash and the path (the path alone below the root), and the path of that key is the path", () => {
  assertEquals(keyOf(prefix("fleet"), path("hosts/alpha.json")), { kind: "ok", value: "fleet/hosts/alpha.json" });
  assertEquals(keyOf(prefix(""), path("hosts/alpha.json")), { kind: "ok", value: "hosts/alpha.json" });
  assertEquals(basePrefix(prefix("")), "");
  assertEquals(basePrefix(prefix("a/b")), "a/b/");
  const back = pathOfKey(prefix("fleet"), "fleet/hosts/alpha.json");
  assert(back.kind === "ok" && back.value === "hosts/alpha.json");
});

proves(["0002-anyfs-s3-store FR-002"], "a key that is not the key of a path of the store is a finding that says which kind: outside the prefix, not a path, not in normalization form C, or a name the store keeps", () => {
  const cases: readonly [string, string][] = [
    ["other/x", "outside"],
    ["fleet/", "outside"],
    ["fleet", "outside"],
    ["fleet//x", "not-a-path"],
    ["fleet/a/../b", "not-a-path"],
    ["fleet/a\\b", "not-a-path"],
    ["fleet/é", "not-normalized"],
    ["fleet/dir/.anyfs-probe-1", "own"],
  ];
  for (const [key, kind] of cases) {
    const r = pathOfKey(prefix("fleet"), key);
    assert(r.kind === "err", key);
    assertEquals(r.error.kind, kind, key);
    assert(describeFinding(r.error).length > 10);
  }
  assertEquals(isOwn("a/.anyfs-x/b"), true);
  assertEquals(isOwn("a/b.anyfs-x"), false);
});

proves(["0002-anyfs-s3-store FR-002"], "a key is encoded in a URL segment by segment as RFC 3986 says, the slash kept, and a listed key (`encoding-type=url`) is read back whatever it holds, a plus and a percent included", () => {
  assertEquals(encodeKey("a b/c+d/é😀/!'()*"), "a%20b/c%2Bd/%C3%A9%F0%9F%98%80/%21%27%28%29%2A");
  assertEquals(decodeListedKey("a+b%2Bc%25d/%C3%A9"), { kind: "ok", value: "a b+c%d/é" });
  assertEquals(decodeListedKey("%E0%A4%A").kind, "err");
});

proves(["0002-anyfs-s3-store FR-002"], "property: any path below any prefix goes to a key and back to the same path, and the encoded key of it decodes to the key", () => {
  const segment = fc.string({ unit: "grapheme", minLength: 1, maxLength: 12 }).filter((s) => parsePath(s).kind === "ok" && !s.includes("/") && !s.startsWith(".anyfs-"));
  const paths = fc.array(segment, { minLength: 1, maxLength: 5 }).map((s) => s.join("/")).filter((p) => parsePath(p).kind === "ok");
  fc.assert(
    fc.property(fc.option(paths, { nil: undefined }), paths, (pre, p) => {
      const pr = prefix(pre === undefined || parsePath(pre).kind !== "ok" ? "" : pre);
      const pa = path(p);
      const k = keyOf(pr, pa);
      if (k.kind === "err") return true;
      const back = pathOfKey(pr, k.value);
      const via = decodeURIComponent(encodeKey(k.value));
      return back.kind === "ok" && back.value === pa && via === k.value;
    }),
    { numRuns: 400 },
  );
});

proves(["0002-anyfs-s3-store FR-001"], "a bucket name is 3 to 63 lower case letters, digits, hyphens and dots, beginning and ending with a letter or a digit, with no two dots, no dot by a hyphen, not an address and none of the reserved prefixes and suffixes", () => {
  for (const good of ["abc", "fleet-backup", "a.b.c", "a1-b2", "x".repeat(63), "my.bucket-1"]) assertEquals(parseBucketName(good).kind, "ok", good);
  for (const bad of ["ab", "x".repeat(64), "Fleet", "fleet_backup", "-abc", "abc-", ".abc", "abc.", "a..b", "a.-b", "a-.b", "192.168.0.1", "xn--abc", "sthree-abc", "abc-s3alias", "abc--ol-s3", "has space", "ü-bucket", "a/b", ""]) assertEquals(parseBucketName(bad).kind, "err", bad);
});
