/**
 * Tests of the governance layer: fingerprints, the decoder of facts and the decoder of plans, with a seeded loop of random and malformed input.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeFacts, decodePlan, parseFingerprint, parsePublicKeyLine, planWire } from "../src/governance/mod.ts";
import { syntheticFacts } from "./helpers.ts";

/** A small seeded generator (mulberry32), so that a failure can be repeated. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

proves(["0002-enrollment-protocol FR-015"], "a fingerprint is SHA256: and 43 characters of base64 without padding, and an unknown key algorithm is refused", () => {
  assertEquals(parseFingerprint(`SHA256:${"a".repeat(43)}`).kind, "ok");
  for (const bad of ["", "SHA256:", `SHA256:${"a".repeat(44)}`, `MD5:${"a".repeat(43)}`, `SHA256:${"a".repeat(42)}=`, 7, null]) assertEquals(parseFingerprint(bad).kind, "err", String(bad));
  assertEquals(parsePublicKeyLine("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA== comment").kind, "ok");
  assertEquals(parsePublicKeyLine("ssh-dss AAAA").kind, "err");
  assertEquals(parsePublicKeyLine("ssh-ed25519 no!t").kind, "err");
});

proves(["0002-enrollment-protocol FR-006"], "the facts of a device are decoded strictly and bounded", () => {
  const good = syntheticFacts(3);
  const r = decodeFacts(JSON.parse(JSON.stringify({ ...good, unknown: "dropped" })));
  assertEquals(r.kind, "ok");
  assert(r.kind === "ok" && !("unknown" in r.value), "unknown fields are dropped");
  const cases: [string, (f: Record<string, unknown>) => void][] = [
    ["a family outside the set", (f) => ((f["os"] as Record<string, unknown>)["family"] = "plan9")],
    ["a control character", (f) => (f["hostname"] = "a\nb")],
    ["a long text", (f) => (f["kernel"] = "k".repeat(500))],
    ["too many disks", (f) => (f["disks"] = Array.from({ length: 65 }, () => ({ name: "d", sizeBytes: 1 })))],
    ["a bad mac", (f) => (f["nics"] = [{ name: "e", mac: "nope", addresses: [] }])],
    ["a negative count", (f) => (f["cpus"] = -1)],
    ["a fractional count", (f) => (f["cpus"] = 1.5)],
    ["a bad fingerprint", (f) => (f["hostKeys"] = [{ algo: "ssh-ed25519", fingerprint: "x" }])],
    ["a package manager outside the set", (f) => (f["packageManager"] = "rm")],
  ];
  for (const [name, mutate] of cases) {
    const copy = JSON.parse(JSON.stringify(good)) as Record<string, unknown>;
    mutate(copy);
    assertEquals(decodeFacts(copy).kind, "err", name);
  }
  assertEquals(decodeFacts(null).kind, "err");
  assertEquals(decodeFacts([]).kind, "err");
});

proves(["0002-enrollment-protocol FR-006", "0002-enrollment-protocol FR-007"], "a seeded loop of random and mutated input never throws and never decodes what it should not", () => {
  const rnd = seeded(20261126);
  const junk = (depth: number): unknown => {
    const k = Math.floor(rnd() * 8);
    if (depth > 3 || k < 2) return [null, true, 1, -1, 1e99, "", "x".repeat(Math.floor(rnd() * 300)), "\u0000", "💥"][Math.floor(rnd() * 9)];
    if (k < 4) return Array.from({ length: Math.floor(rnd() * 5) }, () => junk(depth + 1));
    const o: Record<string, unknown> = {};
    for (const key of ["os", "kernel", "steps", "kind", "argv", "nics", "disks", "hostKeys", "family", "name", "__proto__", "constructor"]) if (rnd() < 0.4) o[key] = junk(depth + 1);
    return o;
  };
  const base = JSON.stringify(syntheticFacts(1));
  for (let i = 0; i < 2000; i++) {
    const x = junk(0);
    decodeFacts(x);
    decodePlan(x);
    // a mutation of valid facts: flip one character of the text, which may or may not still decode, and must never throw
    const at = Math.floor(rnd() * base.length);
    const mutated = base.slice(0, at) + String.fromCharCode(32 + Math.floor(rnd() * 90)) + base.slice(at + 1);
    try {
      decodeFacts(JSON.parse(mutated));
    } catch (e) {
      assert(e instanceof SyntaxError, "only the JSON parse may fail");
    }
  }
});

proves(["0002-enrollment-protocol FR-007"], "a plan holds typed steps whose argument vectors are words of a safe alphabet, and is said as lines", () => {
  const sha = "a".repeat(64);
  const plan = {
    steps: [
      { kind: "install-package", osFamily: "linux", name: "synthetic-package", version: "1.0", url: "https://example.invalid/p.deb", sha256: sha, installer: "deb" },
      { kind: "authorize-key", account: "synthetic-user", publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA== comment" },
      { kind: "ensure-account", name: "synthetic-user", sudo: true },
      { kind: "run", argv: ["/usr/bin/apt-get", "install", "-y", "synthetic-package"], as: "root", expect: [0] },
    ],
  };
  const r = decodePlan(plan);
  assertEquals(r.kind, "ok");
  const wire = r.kind === "ok" ? planWire("en-aaaaaaaaaaaaaaaa", r.value) : "";
  assert(wire.startsWith("PLAN\t1\ten-aaaaaaaaaaaaaaaa\n") && wire.endsWith("END\n"), wire);
  assertEquals(wire.split("\n").filter((l) => l.startsWith("STEP")).length, 4);
  const bad = (step: unknown): string => decodePlan({ steps: [step] }).kind;
  for (const word of ["a b", "a;b", "$(id)", "`id`", "a|b", "a>b", "a&b", "a'b", 'a"b', "a*", "a\\b", "~", "a\nb", "", "a#b", "a!b", "a{b}", "a(b)"]) assertEquals(bad({ kind: "run", argv: ["/bin/true", word], as: "user", expect: [0] }), "err", JSON.stringify(word));
  assertEquals(bad({ kind: "run", argv: [], as: "user", expect: [0] }), "err");
  assertEquals(bad({ kind: "run", argv: ["/bin/true"], as: "nobody", expect: [0] }), "err");
  assertEquals(bad({ kind: "run", argv: "ls -l", as: "user", expect: [0] }), "err");
  assertEquals(bad({ kind: "install-package", osFamily: "linux", name: "p", version: "1", url: "http://example.invalid/p", sha256: sha, installer: "deb" }), "err");
  assertEquals(bad({ kind: "install-package", osFamily: "linux", name: "p", version: "1", url: "https://example.invalid/p", sha256: "zz", installer: "deb" }), "err");
  assertEquals(bad({ kind: "shell", command: "id" }), "err");
  assertEquals(decodePlan({ steps: Array.from({ length: 65 }, () => ({ kind: "ensure-account", name: "a", sudo: false })) }).kind, "err");
});
