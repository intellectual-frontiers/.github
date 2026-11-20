/**
 * Tests of `semver.ts`: parsing and printing are inverse, the order is a total order that agrees with semver.org's own examples,
 * bumps raise the version, and dotted versions compare part by part.
 *
 * @module
 */
import fc from "fast-check";
import {
  atLeast,
  bump,
  bumpSuffices,
  compareDotted,
  compareSemVer,
  dottedParts,
  formatRange,
  formatSemVer,
  maxSatisfying,
  parseRange,
  parseSemVer,
  satisfies,
  type SemVer,
  versionIn,
} from "../src/semver.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const FR = "0001-formats FR-015";

const ident = fc.oneof(fc.nat({ max: 1000 }).map(String), fc.stringMatching(/^[0-9]*[A-Za-z-][0-9A-Za-z-]{0,5}$/));
const semver: fc.Arbitrary<SemVer> = fc.record(
  {
    major: fc.nat({ max: 50 }),
    minor: fc.nat({ max: 50 }),
    patch: fc.nat({ max: 50 }),
    pre: fc.array(ident, { minLength: 1, maxLength: 3 }).map((xs) => xs.join(".")),
    build: fc.array(fc.stringMatching(/^[0-9A-Za-z-]{1,4}$/), { minLength: 1, maxLength: 2 }).map((xs) => xs.join(".")),
  },
  { requiredKeys: ["major", "minor", "patch"], noNullPrototype: true },
);

proves([FR, "0001-core FR-004"], "a version printed and parsed is the same version (round trip)", () => {
  fc.assert(fc.property(semver, (v) => assertEquals(parseSemVer(formatSemVer(v)), { kind: "ok", value: v })));
});

proves([FR, "0001-core FR-004"], "the order is reflexive, antisymmetric, transitive and total", () => {
  fc.assert(fc.property(semver, (a) => assertEquals(compareSemVer(a, a), 0)));
  fc.assert(fc.property(semver, semver, (a, b) => assertEquals(compareSemVer(a, b), -compareSemVer(b, a) || 0)));
  fc.assert(
    fc.property(semver, semver, semver, (a, b, c) => {
      if (compareSemVer(a, b) <= 0 && compareSemVer(b, c) <= 0) assert(compareSemVer(a, c) <= 0);
    }),
  );
  fc.assert(fc.property(semver, semver, (a, b) => assert([-1, 0, 1].includes(compareSemVer(a, b)))));
});

proves([FR], "the order is semver.org's (§11): its own example list is sorted, and the build is ignored", () => {
  const list = [
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    "1.0.0",
    "2.0.0",
    "2.1.0",
    "2.1.1",
  ];
  const parsed = list.map((t) => {
    const r = parseSemVer(t);
    if (r.kind === "err") throw new Error(r.error);
    return r.value;
  });
  for (let i = 1; i < parsed.length; i++)
    assert(compareSemVer(parsed[i - 1] as SemVer, parsed[i] as SemVer) < 0, `${list[i - 1]} < ${list[i]}`);
  const shuffled = [...parsed].reverse().sort(compareSemVer).map(formatSemVer);
  assertEquals(shuffled, list);
  assertEquals(compareSemVer({ major: 1, minor: 0, patch: 0, build: "a" }, { major: 1, minor: 0, patch: 0, build: "b" }), 0);
});

proves([FR], "what is not a semantic version is refused; a leading v is accepted", () => {
  for (const bad of ["1", "1.2", "01.2.3", "1.2.3-", "1.2.3-01", "1.2.3+", "a.b.c", "1.2.3.4", "99999999999999999999.0.0"]) {
    assertEquals(parseSemVer(bad).kind, "err", bad);
  }
  assertEquals(parseSemVer("v2.9.8"), { kind: "ok", value: { major: 2, minor: 9, patch: 8 } });
});

proves([FR, "0001-core FR-004"], "a bump is above what it bumps and suffices for its change", () => {
  fc.assert(
    fc.property(semver, fc.constantFrom("major", "minor", "patch"), (v, level) => {
      const next = bump(v, level);
      assert(compareSemVer(next, v) > 0 || v.pre !== undefined);
      assert(bumpSuffices(v, next, { kind: "fix" }) || v.pre !== undefined);
    }),
  );
  const v = { major: 1, minor: 2, patch: 3 };
  assert(bumpSuffices(v, bump(v, "major"), { kind: "breaking" }));
  assert(!bumpSuffices(v, bump(v, "minor"), { kind: "breaking" }));
  assert(bumpSuffices({ major: 0, minor: 2, patch: 3 }, { major: 0, minor: 3, patch: 0 }, { kind: "breaking" }));
  assert(bumpSuffices(v, bump(v, "minor"), { kind: "addition" }));
  assert(!bumpSuffices(v, bump(v, "patch"), { kind: "addition" }));
  assert(bumpSuffices(v, v, { kind: "none" }));
});

proves([FR], "dotted versions compare part by part, a missing part as 0", () => {
  assert(atLeast("2.10.0", "2.9.8"));
  assert(!atLeast("2.9", "2.9.1"));
  assert(atLeast("2.9", "2.9.0"));
  assert(atLeast("v26.13.1", "26"));
  assertEquals(compareDotted("1.4.4", "1.4.4"), 0);
  assertEquals(dottedParts("1.2-rc3"), [1, 2, 0]);
  assertEquals(versionIn("bun 1.4.4 (linux x64)"), "1.4.4");
  assertEquals(versionIn("no version"), undefined);
  fc.assert(
    fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 4 }), fc.array(fc.nat(), { minLength: 1, maxLength: 4 }), (a, b) => {
      const x = a.join(".");
      const y = b.join(".");
      assertEquals(compareDotted(x, y), -compareDotted(y, x) || 0);
      assertEquals(atLeast(x, y) || atLeast(y, x), true);
    }),
  );
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Ranges (FR-067)
// ---------------------------------------------------------------------------------------------------------------------------------

const RANGE = "0001-formats FR-016";

function v(text: string): SemVer {
  const r = parseSemVer(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

function sat(version: string | SemVer, range: string, includePrerelease = false): boolean {
  const r = parseRange(range);
  if (r.kind === "err") throw new Error(r.error);
  return satisfies(typeof version === "string" ? v(version) : version, r.value, { includePrerelease });
}

function desugared(range: string): string {
  const r = parseRange(range);
  return r.kind === "ok" ? formatRange(r.value) : r.error;
}

// Small versions, so that ranges over them both hold and fail, with a few pre-releases.
const small: fc.Arbitrary<SemVer> = fc
  .tuple(
    fc.nat({ max: 3 }),
    fc.nat({ max: 3 }),
    fc.nat({ max: 3 }),
    fc.option(fc.constantFrom("0", "alpha", "beta.2", "rc.1"), { nil: undefined }),
  )
  .map(([major, minor, patch, pre]) => ({ major, minor, patch, ...(pre === undefined ? {} : { pre }) }));
const release: fc.Arbitrary<SemVer> = small.map(({ major, minor, patch }) => ({ major, minor, patch }));

proves([RANGE], "ranges desugar into comparators exactly as node-semver documents them", () => {
  const table: readonly (readonly [string, string])[] = [
    ["1.2.3 - 2.3.4", ">=1.2.3 <=2.3.4"],
    ["1.2 - 2.3.4", ">=1.2.0 <=2.3.4"],
    ["1.2.3 - 2.3", ">=1.2.3 <2.4.0-0"],
    ["1.2.3 - 2", ">=1.2.3 <3.0.0-0"],
    ["*", "*"],
    ["", "*"],
    ["1.x", ">=1.0.0 <2.0.0-0"],
    ["1.2.x", ">=1.2.0 <1.3.0-0"],
    ["1", ">=1.0.0 <2.0.0-0"],
    ["1.2", ">=1.2.0 <1.3.0-0"],
    ["~1.2.3", ">=1.2.3 <1.3.0-0"],
    ["~1.2", ">=1.2.0 <1.3.0-0"],
    ["~1", ">=1.0.0 <2.0.0-0"],
    ["~0.2.3", ">=0.2.3 <0.3.0-0"],
    ["~0.2", ">=0.2.0 <0.3.0-0"],
    ["~0", ">=0.0.0 <1.0.0-0"],
    ["~1.2.3-beta.2", ">=1.2.3-beta.2 <1.3.0-0"],
    ["~>3.2.1", ">=3.2.1 <3.3.0-0"],
    ["^1.2.3", ">=1.2.3 <2.0.0-0"],
    ["^0.2.3", ">=0.2.3 <0.3.0-0"],
    ["^0.0.3", ">=0.0.3 <0.0.4-0"],
    ["^1.2.3-beta.2", ">=1.2.3-beta.2 <2.0.0-0"],
    ["^0.0.3-beta", ">=0.0.3-beta <0.0.4-0"],
    ["^1.2.x", ">=1.2.0 <2.0.0-0"],
    ["^0.0.x", ">=0.0.0 <0.1.0-0"],
    ["^0.0", ">=0.0.0 <0.1.0-0"],
    ["^1.x", ">=1.0.0 <2.0.0-0"],
    ["^0.x", ">=0.0.0 <1.0.0-0"],
    [">1", ">=2.0.0"],
    [">1.2", ">=1.3.0"],
    ["<1.2", "<1.2.0-0"],
    ["<=1.2", "<1.3.0-0"],
    [">= 1.2.3 < 2", ">=1.2.3 <2.0.0-0"],
    [">*", "<0.0.0-0"],
    ["=v1.2.3+build.5", "1.2.3"],
    ["1.2.7 || >=1.2.9 <2.0.0", "1.2.7 || >=1.2.9 <2.0.0"],
  ];
  for (const [range, comparators] of table) assertEquals(desugared(range), comparators, range);
});

proves([RANGE], "node-semver's own cases: the versions each range includes and excludes, pre-releases among them", () => {
  const include: readonly (readonly [string, string])[] = [
    ["1.0.0 - 2.0.0", "1.2.3"],
    ["^1.2.3+build", "1.3.0"],
    ["1.2.3-pre+asdf - 2.4.3-pre+asdf", "1.2.3"],
    ["*", "1.2.3"],
    ["~1.2.1 >=1.2.3", "1.2.3"],
    ["0.1.20 || 1.2.4", "1.2.4"],
    ["||", "1.3.4"],
    ["2.x.x", "2.1.3"],
    ["1.2.x || 2.x", "2.1.3"],
    ["x", "1.2.3"],
    ["2.*.*", "2.1.3"],
    ["~2.4", "2.4.5"],
    ["~ 1.0", "1.0.2"],
    [">= 1", "1.0.0"],
    ["< 1.2", "1.1.1"],
    ["=0.7.x", "0.7.2"],
    ["<=0.7.x", "0.7.2"],
    ["^0.1", "0.1.2"],
    ["^1.2 ^1", "1.4.2"],
    ["^1.2.3-alpha", "1.2.3-pre"],
    ["^0.0.1-alpha", "0.0.1-beta"],
    ["^x", "1.2.3"],
    ["x - 1.0.0", "0.9.7"],
    ["x - 1.x", "0.9.7"],
    ["1.0.0 - x", "1.9.7"],
    ["<=7.x", "7.9.9"],
    ["^1.2.3-beta.2", "1.2.3-beta.4"],
  ];
  const exclude: readonly (readonly [string, string])[] = [
    ["1.0.0 - 2.0.0", "2.2.3"],
    ["1.2.3+asdf - 2.4.3+asdf", "1.2.3-pre.2"],
    ["^1.2.3+build", "2.0.0"],
    ["^1.2.3", "1.2.3-pre"],
    ["^1.2", "1.2.0-pre"],
    [">1.2", "1.3.0-beta"],
    ["<=1.2.3", "1.2.3-beta"],
    ["=0.7.x", "0.7.0-asdf"],
    ["<=0.7.x", "0.7.0-asdf"],
    ["=1.2.3", "1.2.3-beta"],
    [">1.2", "1.2.8"],
    ["^0.0.1", "0.0.2"],
    ["^1.2.3", "2.0.0-alpha"],
    ["^1.2.3", "1.2.2"],
    ["*", "1.2.3-foo"],
    ["~1.2.3", "1.3.0"],
    ["<1.2", "1.2.0"],
    ["2.x.x", "3.1.3"],
    [">=0.2.3 || <0.0.1", "0.0.3"],
    ["~0.0.1", "0.1.0-alpha"],
    ["^1.2.3", "1.2.4-beta"],
    [">*", "0.0.0"],
  ];
  for (const [range, version] of include) assert(sat(version, range), `${range} includes ${version}`);
  for (const [range, version] of exclude) assert(!sat(version, range), `${range} excludes ${version}`);
  assert(sat("1.2.3-foo", "*", true) && sat("1.2.4-beta", "^1.2.3", true), "with includePrerelease, the comparators alone decide");
  const caret = parseRange("^1.2");
  assert(caret.kind === "ok");
  assertEquals(maxSatisfying(["1.2.3", "1.9.0", "2.0.0", "1.10.0-rc.1"].map(v), caret.value), v("1.9.0"));
  assertEquals(maxSatisfying(["2.0.0"].map(v), caret.value), undefined);
});

proves([RANGE], "what is not a range is an error naming it, never a range that holds every version", () => {
  for (const bad of [
    ">=1.2.3 <",
    "blerg",
    "1.x.3",
    "^1.2.x-beta",
    "1.2.3 - ",
    "!1.2.3",
    "1.2.3.4",
    ">=01.2.3",
    "~>",
    "9007199254740992.0.0",
  ]) {
    const r = parseRange(bad);
    assert(r.kind === "err" && r.error.startsWith(JSON.stringify(bad)), bad);
  }
});

proves(
  [RANGE, "0001-core FR-004"],
  "laws: caret, tilde and x-ranges are their comparators; a hyphen is >= and <=; || is or; a space is and",
  () => {
    fc.assert(
      fc.property(small, release, (x, b) => {
        const [M, m, p] = [b.major, b.minor, b.patch];
        const upper = M > 0 ? `${M + 1}.0.0-0` : m > 0 ? `0.${m + 1}.0-0` : `0.0.${p + 1}-0`;
        assertEquals(sat(x, `^${M}.${m}.${p}`), sat(x, `>=${M}.${m}.${p} <${upper}`));
        assertEquals(sat(x, `~${M}.${m}.${p}`), sat(x, `>=${M}.${m}.${p} <${M}.${m + 1}.0-0`));
        assertEquals(sat(x, `${M}.x`), sat(x, `>=${M}.0.0 <${M + 1}.0.0-0`));
        assertEquals(sat(x, `${M}.${m}.x`), sat(x, `>=${M}.${m}.0 <${M}.${m + 1}.0-0`));
        if (M > 0) assertEquals(sat(x, `^${M}.${m}.${p}`), sat(x, `>=${M}.${m}.${p} <${M + 1}.0.0-0`));
      }),
    );
    fc.assert(
      fc.property(small, small, small, (x, a, b) => {
        const [A, B] = [formatSemVer(a), formatSemVer(b)];
        assertEquals(sat(x, `${A} - ${B}`), sat(x, `>=${A} <=${B}`));
        assertEquals(sat(x, `>=${A} || <${B}`), sat(x, `>=${A}`) || sat(x, `<${B}`));
        if (x.pre === undefined) assertEquals(sat(x, `>=${A} <${B}`), sat(x, `>=${A}`) && sat(x, `<${B}`));
        assertEquals(sat(x, A), compareSemVer(x, a) === 0 && (x.pre === undefined || a.pre !== undefined));
        assert(sat(x, `>=${formatSemVer(x)}`) && !sat(x, `<${formatSemVer(x)}`));
        assertEquals(sat(x, "*"), x.pre === undefined);
        assert(sat(x, "*", true));
      }),
    );
  },
);

proves([RANGE, "0001-core FR-004"], "a range printed and read back is the same range (round trip)", () => {
  const word = fc.oneof(
    small.map(formatSemVer),
    fc.tuple(fc.constantFrom("^", "~", ">", ">=", "<", "<=", "="), small).map(([op, x]) => `${op}${formatSemVer(x)}`),
    fc
      .tuple(fc.constantFrom("", "^", "~", ">", "<="), fc.nat({ max: 3 }), fc.constantFrom(".x", ".2.*", ""))
      .map(([op, n, rest]) => `${op}${n}${rest}`),
  );
  const range = fc
    .array(
      fc.array(word, { minLength: 0, maxLength: 3 }).map((ws) => ws.join(" ")),
      { minLength: 1, maxLength: 3 },
    )
    .map((ss) => ss.join(" || "));
  fc.assert(
    fc.property(range, (text) => {
      const r = parseRange(text);
      assert(r.kind === "ok", text);
      if (r.kind === "ok") assertEquals(parseRange(formatRange(r.value)), r);
    }),
  );
});
