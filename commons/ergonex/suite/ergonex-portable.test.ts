/**
 * Tests of the portability of a path of the workspace (commons 0002-workspace-model FR-009 to FR-012): the fixture of hostile names (Windows device names with and without extensions and in any
 * case, trailing dots and spaces, forbidden and control characters, over-long and non-NFC names), the case-fold and normalization collisions, and the 259/260 rule of Windows paths.
 * Pure, so the tests run on every operating system and prove what a Windows file system would refuse.
 *
 * @module
 */
import fc from "fast-check";
import {
  checkPathLength,
  collisions,
  describePortableError,
  foldKey,
  MAX_SEGMENT_BYTES,
  nativePath,
  repoPath,
  segment,
  segmentsOf,
  WINDOWS_PATH_LIMIT,
} from "../src/portable.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const refusedAs = (text: string): string => {
  const r = segment(text);
  return r.kind === "ok" ? "ok" : r.error.kind;
};

proves(["0002-workspace-model FR-009"], "a segment is refused for an empty name, `.` and `..`", () => {
  assertEquals(refusedAs(""), "empty");
  assertEquals(refusedAs("."), "dot");
  assertEquals(refusedAs(".."), "dot");
  assertEquals(refusedAs("..."), "trailing-dot-or-space");
  assertEquals(refusedAs(".hidden"), "ok");
  assertEquals(refusedAs("..a"), "ok");
});

proves(["0002-workspace-model FR-009"], "a segment is refused for each of the nine forbidden characters and for control characters", () => {
  for (const ch of ["<", ">", ":", '"', "/", "\\", "|", "?", "*"]) {
    assertEquals(refusedAs(`a${ch}b`), "forbidden-character", ch);
    assertEquals(refusedAs(ch), "forbidden-character", ch);
  }
  for (const code of [0, 1, 9, 10, 13, 31, 127])
    assertEquals(refusedAs(`a${String.fromCharCode(code)}b`), "control-character", `U+${code.toString(16)}`);
  const hit = segment("a:b");
  assertEquals(
    hit.kind === "err" ? describePortableError(hit.error) : "",
    'the path segment "a:b" holds ":", which Windows does not allow in a name',
  );
  // a space inside, a dash, an underscore, a plus and non-ASCII letters are fine
  for (const ok of [
    "a b",
    "a-b",
    "a_b",
    "a+b",
    "été",
    "日本語",
    "emoji😀",
    "a@b",
    "a#b",
    "a$b",
    "a%b",
    "a&b",
    "a(b)",
    "a[b]",
    "a{b}",
    "a,b",
    "a;b",
    "a=b",
    "a'b",
    "a`b",
    "a~b",
    "a!b",
  ]) {
    assertEquals(refusedAs(ok), "ok", ok);
  }
});

proves(["0002-workspace-model FR-009"], "a segment is refused for a trailing dot or space", () => {
  for (const bad of ["name.", "name ", "name..", "name. ", "name .", "a.b."])
    assertEquals(refusedAs(bad), "trailing-dot-or-space", JSON.stringify(bad));
  for (const ok of ["name", ".name", "a.b", " name", "a. b"]) assertEquals(refusedAs(ok), "ok", JSON.stringify(ok));
});

proves(
  ["0002-workspace-model FR-009"],
  "a segment is refused for a Windows device name in any case and with any extension, superscript digits included",
  () => {
    const devices = [
      "CON",
      "PRN",
      "AUX",
      "NUL",
      ...Array.from({ length: 10 }, (_, i) => `COM${i}`),
      ...Array.from({ length: 10 }, (_, i) => `LPT${i}`),
    ];
    for (const d of devices) {
      for (const spelling of [d, d.toLowerCase(), d[0] + d.slice(1).toLowerCase()]) {
        assertEquals(refusedAs(spelling), "device-name", spelling);
        assertEquals(refusedAs(`${spelling}.txt`), "device-name", `${spelling}.txt`);
        assertEquals(refusedAs(`${spelling}.tar.gz`), "device-name", `${spelling}.tar.gz`);
      }
    }
    for (const d of ["COM\u00b9", "COM\u00b2", "COM\u00b3", "LPT\u00b9", "LPT\u00b2", "LPT\u00b3", "com\u00b2.log"])
      assertEquals(refusedAs(d), "device-name", d);
    assertEquals(refusedAs("aux.git"), "device-name");
    assertEquals(refusedAs("con"), "device-name");
    assertEquals(refusedAs("NUL .txt"), "device-name");
    assertEquals(refusedAs("CONIN$"), "device-name");
    const r = segment("aux.git");
    assertEquals(r.kind === "err" ? r.error : undefined, {
      kind: "device-name",
      segment: "aux.git",
      device: "AUX",
    });
    assert(
      describePortableError({
        kind: "device-name",
        segment: "aux.git",
        device: "AUX",
      }).includes("AUX"),
    );
    // names that only look like one are fine
    for (const ok of ["console", "CON1", "COM10", "COMA", "auxiliary", "nul-device", "lpt", "prn_", "com", "LPT\u2074", "xcon", "a.con"])
      assertEquals(refusedAs(ok), "ok", ok);
  },
);

proves(["0002-workspace-model FR-009"], "a segment is refused above 255 bytes of UTF-8, counted in bytes and not in characters", () => {
  assertEquals(refusedAs("a".repeat(MAX_SEGMENT_BYTES)), "ok");
  assertEquals(refusedAs("a".repeat(MAX_SEGMENT_BYTES + 1)), "too-long");
  // 127 two-byte letters are 254 bytes and 128 are 256
  assertEquals(refusedAs("é".repeat(127)), "ok");
  assertEquals(refusedAs("é".repeat(128)), "too-long");
  // 63 four-byte emoji are 252 bytes and 64 are 256
  assertEquals(refusedAs("😀".repeat(63)), "ok");
  assertEquals(refusedAs("😀".repeat(64)), "too-long");
  const r = segment("é".repeat(128));
  assertEquals(r.kind === "err" && r.error.kind === "too-long" ? r.error.bytes : 0, 256);
});

proves(["0002-workspace-model FR-009"], "a segment is refused where it is not in Unicode normalization form NFC", () => {
  const nfd = "e\u0301cole"; // e + combining acute: how macOS writes `école`
  const nfc = "\u00e9cole";
  assertEquals(nfd.normalize("NFC") === nfd, false);
  assertEquals(refusedAs(nfd), "not-nfc");
  assertEquals(refusedAs(nfc), "ok");
  assertEquals(refusedAs("Å"), "not-nfc"); // A + combining ring above
  assertEquals(refusedAs("Å"), "ok"); // the precomposed letter
  assertEquals(refusedAs("\u1100\u1161\u11a8"), "not-nfc"); // Hangul jamo: composed to a syllable in NFC
});

proves(
  ["0002-workspace-model FR-009", "0002-workspace-model FR-010"],
  "every segment a made path holds is portable, and the path keeps `/` between them whatever the platform",
  () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 12 }), {
          minLength: 1,
          maxLength: 5,
        }),
        (parts) => {
          const p = repoPath(parts);
          if (p.kind === "ok") {
            assertEquals(segmentsOf(p.value).length, parts.length);
            for (const s of segmentsOf(p.value)) assertEquals(segment(s).kind, "ok");
            assert(!p.value.includes("\\") && !p.value.startsWith("/") && !p.value.includes("//"));
          } else {
            assert(parts.some((s) => segment(s).kind === "err") || parts.length === 0);
          }
        },
      ),
      { numRuns: 400 },
    );
    assertEquals(repoPath([]).kind, "err");
    const p = repoPath(["github.com", "octo", "hello"]);
    assertEquals(p.kind === "ok" ? p.value : "", "github.com/octo/hello");
    // `..`, an absolute path and a drive cannot be made a path
    assertEquals(repoPath(["a", "..", "b"]).kind, "err");
    assertEquals(repoPath(["", "etc"]).kind, "err");
    assertEquals(repoPath(["C:", "x"]).kind, "err");
    assertEquals(repoPath(["a\\b"]).kind, "err");
    if (p.kind === "ok") {
      assertEquals(nativePath("/home/a/workspaces", p.value, "/"), "/home/a/workspaces/github.com/octo/hello");
      assertEquals(nativePath("C:\\Users\\a\\workspaces\\", p.value, "\\"), "C:\\Users\\a\\workspaces\\github.com\\octo\\hello");
    }
  },
);

proves(
  ["0002-workspace-model FR-011"],
  "two paths equal after NFC and case folding collide, each naming the other, and others do not",
  () => {
    const items = [
      { id: "repo Org/tool", path: "github.com/Org/tool" },
      { id: "repo org/tool", path: "github.com/org/tool" },
      { id: "repo other", path: "github.com/org/other" },
      { id: "school nfd", path: "github.com/o/e\u0301cole" },
      { id: "school nfc", path: "github.com/o/\u00c9COLE" },
      { id: "sharp", path: "gitlab.com/g/Stra\u00dfe" },
      { id: "caps", path: "gitlab.com/g/STRASSE" },
    ];
    const found = collisions(items);
    assertEquals(found.length, 3);
    assertEquals(
      found.map((c) => c.members.map((m) => m.id)).sort(),
      [
        ["repo Org/tool", "repo org/tool"],
        ["school nfd", "school nfc"],
        ["sharp", "caps"],
      ].sort(),
    );
    // a path listed twice collides with itself
    assertEquals(
      collisions([
        { id: "a", path: "x/y" },
        { id: "b", path: "x/y" },
      ]).length,
      1,
    );
    assertEquals(
      collisions([
        { id: "a", path: "x/y" },
        { id: "b", path: "x/z" },
      ]),
      [],
    );
    assertEquals(foldKey("github.com/Org/Tool"), foldKey("GITHUB.COM/org/tool"));
    // folding is idempotent and indifferent to the order of the letters of its input's case
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (s) => foldKey(foldKey(s)) === foldKey(s)),
      { numRuns: 300 },
    );
  },
);

proves(
  ["0002-workspace-model FR-012"],
  "a Windows path of 259 characters is accepted and of 260 is an error naming the path, unless long paths are enabled",
  () => {
    const root = "C:\\Users\\agent\\workspaces";
    const tail = (n: number): string => `${root}\\${"a".repeat(n - root.length - 1)}`;
    assertEquals(WINDOWS_PATH_LIMIT, 259);
    const at259 = tail(259);
    const at260 = tail(260);
    assertEquals(at259.length, 259);
    assertEquals(at260.length, 260);
    assertEquals(checkPathLength(at259, false), { kind: "ok", value: at259 });
    assertEquals(checkPathLength(at260, false), {
      kind: "err",
      error: { kind: "path-too-long", path: at260, length: 260, limit: 259 },
    });
    assertEquals(checkPathLength(at260, true), { kind: "ok", value: at260 });
    assertEquals(checkPathLength(tail(270), false).kind, "err");
    const longRepo = repoPath(["gitlab.com", ...Array.from({ length: 6 }, () => "g".repeat(40)), "service"]);
    assert(longRepo.kind === "ok");
    if (longRepo.kind === "ok") {
      const full = nativePath(root, longRepo.value, "\\");
      const r = checkPathLength(full, false);
      assertEquals(r.kind === "err" ? r.error.path : "", full);
      assertEquals(full.length > 259, true);
    }
  },
);
