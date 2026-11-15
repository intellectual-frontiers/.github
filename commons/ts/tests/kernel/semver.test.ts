/**
 * Tests of `kernel/semver.ts`: parsing and printing are inverse, the order is a total order that agrees with semver.org's own examples,
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
  formatSemVer,
  parseSemVer,
  type SemVer,
  versionIn,
} from "../../kernel/semver.ts";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-007";

const ident = fc.oneof(
  fc.nat({ max: 1000 }).map(String),
  fc.stringMatching(/^[0-9]*[A-Za-z-][0-9A-Za-z-]{0,5}$/),
);
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

proves([FR, "0005-typescript-runtime FR-014"], "a version printed and parsed is the same version (round trip)", () => {
  fc.assert(fc.property(semver, (v) => assertEquals(parseSemVer(formatSemVer(v)), { kind: "ok", value: v })));
});

proves([FR, "0005-typescript-runtime FR-014"], "the order is reflexive, antisymmetric, transitive and total", () => {
  fc.assert(fc.property(semver, (a) => assertEquals(compareSemVer(a, a), 0)));
  fc.assert(fc.property(semver, semver, (a, b) => assertEquals(compareSemVer(a, b), -compareSemVer(b, a) || 0)));
  fc.assert(fc.property(semver, semver, semver, (a, b, c) => {
    if (compareSemVer(a, b) <= 0 && compareSemVer(b, c) <= 0) assert(compareSemVer(a, c) <= 0);
  }));
  fc.assert(fc.property(semver, semver, (a, b) => assert([-1, 0, 1].includes(compareSemVer(a, b)))));
});

proves([FR], "the order is semver.org's (§11): its own example list is sorted, and the build is ignored", () => {
  const list = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0", "2.0.0", "2.1.0", "2.1.1"];
  const parsed = list.map((t) => {
    const r = parseSemVer(t);
    if (r.kind === "err") throw new Error(r.error);
    return r.value;
  });
  for (let i = 1; i < parsed.length; i++) assert(compareSemVer(parsed[i - 1] as SemVer, parsed[i] as SemVer) < 0, `${list[i - 1]} < ${list[i]}`);
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

proves([FR, "0005-typescript-runtime FR-014"], "a bump is above what it bumps and suffices for its change", () => {
  fc.assert(fc.property(semver, fc.constantFrom("major", "minor", "patch"), (v, level) => {
    const next = bump(v, level);
    assert(compareSemVer(next, v) > 0 || v.pre !== undefined);
    assert(bumpSuffices(v, next, { kind: "fix" }) || v.pre !== undefined);
  }));
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
  assertEquals(versionIn("deno 2.9.8 (stable, release, x86_64-unknown-linux-gnu)"), "2.9.8");
  assertEquals(versionIn("no version"), undefined);
  fc.assert(fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 4 }), fc.array(fc.nat(), { minLength: 1, maxLength: 4 }), (a, b) => {
    const x = a.join(".");
    const y = b.join(".");
    assertEquals(compareDotted(x, y), -compareDotted(y, x) || 0);
    assertEquals(atLeast(x, y) || atLeast(y, x), true);
  }));
});
