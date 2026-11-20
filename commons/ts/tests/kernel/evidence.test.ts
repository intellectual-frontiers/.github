/**
 * Tests of `kernel/evidence.ts`: RFC 8785's own examples (its sample object, its member ordering by UTF-16 code units and its number
 * serializations from Appendix B), one digest for equal evidence, a ledger whose tampering is named by place and kind, manifests that name
 * each missing, extra or different file and whose signature a caller's verifier checks, and bundles that are the same bytes every time,
 * begin with their manifest and are refused when a file was added.
 *
 * @module
 */
import fc from "fast-check";
import { concat, gzip, tar, tarHeader, untar, gunzip } from "@intellectual-frontiers/formats/archive";
import {
  appendEntry,
  BUNDLE_MANIFEST,
  BUNDLE_SIGNATURE,
  canonicalize,
  entryDigest,
  evidenceDigest,
  GENESIS,
  type LedgerEntry,
  ledgerHead,
  ledgerLines,
  type LedgerRecord,
  manifestBytes,
  manifestOf,
  parseLedger,
  parseManifest,
  readBundle,
  verifyLedger,
  verifyManifest,
  verifyManifestSignature,
  writeBundle,
} from "../../kernel/evidence.ts";
import { type Instant, instantOf } from "../../kernel/grc.ts";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const FR = (n: string): `0007-grc FR-${string}` => `0007-grc FR-${n}`;
const enc = new TextEncoder();
const BS = "\\";
const ch = (...codes: number[]): string => String.fromCharCode(...codes);

function at(text: string): Instant {
  const i = instantOf(text);
  if (i === undefined) throw new Error(`not an instant: ${text}`);
  return i;
}

function canon(v: unknown): string {
  const r = canonicalize(v);
  if (r.kind === "err") throw new Error(`${r.error.path}: ${r.error.reason}`);
  return r.value;
}

proves([FR("006")], "RFC 8785 section 3.2.2's sample object canonicalizes as the RFC shows", () => {
  const input = {
    numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 0.000000000000000000000000001],
    string: `${ch(0x20ac)}$${ch(0x0f)}${ch(0x0a)}A'${ch(0x42)}${ch(0x22)}${ch(0x5c)}${BS}"/`,
    literals: [null, true, false],
  };
  const expected =
    '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],' +
    `"string":"${ch(0x20ac)}$${BS}u000f${BS}nA'B${BS}"${BS}${BS}${BS}${BS}${BS}"/"}`;
  assertEquals(canon(input), expected);
  assertEquals(canon(JSON.parse(canon(input))), expected);
});

proves([FR("006")], "RFC 8785 section 3.2.3: members are sorted by the UTF-16 code units of their names", () => {
  const input: Record<string, string> = {
    [ch(0x20ac)]: "Euro Sign",
    [ch(0x0d)]: "Carriage Return",
    [ch(0xfb33)]: "Hebrew Letter Dalet With Dagesh",
    "1": "One",
    [ch(0xd83d, 0xde00)]: "Emoji: Grinning Face",
    [ch(0x80)]: "Control",
    [ch(0xf6)]: "Latin Small Letter O With Diaeresis",
  };
  const names: readonly (readonly [string, string])[] = [
    [`${BS}r`, "Carriage Return"],
    ["1", "One"],
    [ch(0x80), "Control"],
    [ch(0xf6), "Latin Small Letter O With Diaeresis"],
    [ch(0x20ac), "Euro Sign"],
    [ch(0xd83d, 0xde00), "Emoji: Grinning Face"],
    [ch(0xfb33), "Hebrew Letter Dalet With Dagesh"],
  ];
  assertEquals(canon(input), `{${names.map(([k, v]) => `"${k}":"${v}"`).join(",")}}`);
});

proves([FR("006")], "RFC 8785 Appendix B: IEEE 754 doubles serialize as the RFC lists; NaN and Infinity are refused", () => {
  const vectors: readonly (readonly [string, string | undefined])[] = [
    ["0000000000000000", "0"],
    ["8000000000000000", "0"],
    ["0000000000000001", "5e-324"],
    ["8000000000000001", "-5e-324"],
    ["7fefffffffffffff", "1.7976931348623157e+308"],
    ["ffefffffffffffff", "-1.7976931348623157e+308"],
    ["4340000000000000", "9007199254740992"],
    ["c340000000000000", "-9007199254740992"],
    ["4430000000000000", "295147905179352830000"],
    ["7fffffffffffffff", undefined],
    ["7ff0000000000000", undefined],
    ["44b52d02c7e14af5", "9.999999999999997e+22"],
    ["44b52d02c7e14af6", "1e+23"],
    ["44b52d02c7e14af7", "1.0000000000000001e+23"],
    ["444b1ae4d6e2ef4e", "999999999999999700000"],
    ["444b1ae4d6e2ef4f", "999999999999999900000"],
    ["444b1ae4d6e2ef50", "1e+21"],
    ["3eb0c6f7a0b5ed8c", "9.999999999999997e-7"],
    ["3eb0c6f7a0b5ed8d", "0.000001"],
    ["41b3de4355555553", "333333333.3333332"],
    ["41b3de4355555554", "333333333.33333325"],
    ["41b3de4355555555", "333333333.3333333"],
    ["41b3de4355555556", "333333333.3333334"],
    ["41b3de4355555557", "333333333.33333343"],
    ["becbf647612f3696", "-0.0000033333333333333333"],
    ["43143ff3c1cb0959", "1424953923781206.2"],
  ];
  const view = new DataView(new ArrayBuffer(8));
  for (const [hex, text] of vectors) {
    view.setBigUint64(0, BigInt(`0x${hex}`));
    const r = canonicalize(view.getFloat64(0));
    assertEquals(r.kind === "ok" ? r.value : undefined, text, hex);
  }
});

proves([FR("006")], "what is not JSON is refused with its path; members that are undefined are left out", () => {
  const bad = (v: unknown): string | undefined => {
    const r = canonicalize(v);
    return r.kind === "err" ? r.error.path : undefined;
  };
  assertEquals(bad({ a: [1, Number.NaN] }), "$.a[1]");
  assertEquals(bad({ "a b": { c: new Date(0) } }), '$["a b"].c');
  assertEquals(bad({ s: ch(0xd800) }), "$.s");
  assertEquals(bad([undefined]), "$[0]");
  assertEquals(bad(1n), "$");
  const cyclic: Record<string, unknown> = {};
  cyclic["self"] = cyclic;
  assertEquals(bad(cyclic), "$.self");
  const shared = { x: 1 };
  assertEquals(canon({ a: shared, b: shared, c: undefined }), '{"a":{"x":1},"b":{"x":1}}');
});

proves([FR("006")], "equal evidence has one digest: member order and number spelling do not matter", async () => {
  const a = await evidenceDigest(JSON.parse('{"b":1,"a":2.0}'));
  const b = await evidenceDigest(JSON.parse('{"a":2,"b":1}'));
  assertEquals(a, b);
  assertEquals(a, { kind: "ok", value: await sha256('{"a":2,"b":1}') });
  fc.assert(
    fc.property(fc.jsonValue({ noUnicodeString: false }), (v) => {
      const once = canon(v);
      assertEquals(canon(JSON.parse(once)), once);
    }),
  );
});

// ---------------------------------------------------------------------------------------------------------------------------- ledger

async function ledgerOf(n: number): Promise<readonly LedgerEntry[]> {
  let entries: readonly LedgerEntry[] = [];
  for (let i = 1; i <= n; i++) {
    const r = await appendEntry(entries, {
      at: at(`2026-03-0${i}T00:00:00Z`),
      kind: "observation",
      subject: { kind: "host", id: `h${i}` },
      evidence: await sha256(`evidence ${i}`),
    });
    if (r.kind === "err") throw new Error(r.error.reason);
    entries = r.value;
  }
  return entries;
}

async function rehash(e: Omit<LedgerEntry, "digest">): Promise<LedgerEntry> {
  const d = await entryDigest(e);
  if (d.kind === "err") throw new Error(d.error.reason);
  return { ...e, digest: d.value };
}

proves([FR("007")], "a ledger chains each entry to the one before (64 zeros first) and round-trips through JSON lines", async () => {
  const entries = await ledgerOf(5);
  assertEquals(entries[0]?.prev, GENESIS);
  assertEquals(entries[0]?.seq, 1);
  assertEquals(entries[3]?.prev, entries[2]?.digest);
  const text = ledgerLines(entries);
  assertEquals(text.split("\n").length, 6);
  assertEquals(parseLedger(text), { kind: "ok", value: entries });
  assertEquals(await verifyLedger(entries), { kind: "ok", value: ledgerHead(entries) });
  assertEquals(await verifyLedger([]), { kind: "ok", value: { seq: 0, digest: GENESIS } });
  const broken = parseLedger(`${text}{"seq":"six"}\n`);
  assert(broken.kind === "err" && broken.error.line === 6 && broken.error.error.path === "$.seq");
  await fc.assert(
    fc.asyncProperty(fc.array(fc.tuple(fc.string(), fc.string()), { maxLength: 6 }), async (records) => {
      let l: readonly LedgerEntry[] = [];
      for (const [kind, id] of records) {
        const rec: LedgerRecord = { at: at("2026-01-01T00:00:00Z"), kind, subject: { kind: "x", id }, evidence: GENESIS };
        const r = await appendEntry(l, rec);
        if (r.kind === "ok") l = r.value;
      }
      const back = parseLedger(ledgerLines(l));
      assert(back.kind === "ok");
      assertEquals((await verifyLedger(back.value)).kind, "ok");
    }),
  );
});

proves([FR("007")], "verification names the first entry changed, removed, inserted or reordered", async () => {
  const l = await ledgerOf(5);
  const [e1, e2, e3, e4, e5] = l;
  assert(e1 !== undefined && e2 !== undefined && e3 !== undefined && e4 !== undefined && e5 !== undefined);
  const edited = { ...e3, kind: "forged" };
  assertEquals(await verifyLedger([e1, e2, edited, e4, e5]), {
    kind: "err",
    error: { kind: "changed", seq: 3, reason: "its digest is not the SHA-256 of its content" },
  });
  const rehashed = await rehash({ ...e3, subject: { kind: "host", id: "other" } });
  const r1 = await verifyLedger([e1, e2, rehashed, e4, e5]);
  assert(r1.kind === "err" && r1.error.kind === "changed" && r1.error.seq === 3, JSON.stringify(r1));
  const r2 = await verifyLedger([e1, e2, e4, e5]);
  assert(r2.kind === "err" && r2.error.kind === "removed" && r2.error.seq === 3, JSON.stringify(r2));
  const r3 = await verifyLedger([e1, e2, e4, e3, e5]);
  assert(r3.kind === "err" && r3.error.kind === "reordered" && r3.error.seq === 3, JSON.stringify(r3));
  const forged = await rehash({
    seq: 3,
    prev: e2.digest,
    at: e3.at,
    kind: "observation",
    subject: { kind: "host", id: "ghost" },
    evidence: GENESIS,
  });
  const r4 = await verifyLedger([e1, e2, forged, e3, e4, e5]);
  assert(r4.kind === "err" && r4.error.kind === "inserted" && r4.error.seq === 3, JSON.stringify(r4));
  const firstGone = await verifyLedger([e2, e3, e4, e5]);
  assert(firstGone.kind === "err" && firstGone.error.kind === "removed" && firstGone.error.seq === 1);
});

proves(
  [FR("007"), FR("008")],
  "removing the last entry is not detectable from the ledger alone, but is against a signed head",
  async () => {
    const l = await ledgerOf(5);
    const head = ledgerHead(l);
    const truncated = l.slice(0, 4);
    assertEquals((await verifyLedger(truncated)).kind, "ok");
    const r = await verifyLedger(truncated, head);
    assert(r.kind === "err" && r.error.kind === "removed" && r.error.seq === 5);
    assertEquals((await verifyLedger(l, head)).kind, "ok");
    const later = await appendEntry(l, { at: at("2026-04-01T00:00:00Z"), kind: "k", subject: { kind: "s", id: "t" }, evidence: GENESIS });
    assert(later.kind === "ok");
    assertEquals((await verifyLedger(later.value, head)).kind, "ok", "appending after a signed head is allowed");
  },
);

// ---------------------------------------------------------------------------------------------------------------------------- manifest

const files = (entries: Record<string, string>): Map<string, Uint8Array> =>
  new Map(Object.entries(entries).map(([k, v]) => [k, enc.encode(v)]));

proves([FR("008")], "a manifest lists files by path, size and SHA-256 in the byte order of their paths, and reads back", async () => {
  const fs = files({ e: "1", é: "22", Z: "333", "a/x": "", b: "b" });
  const m = await manifestOf(fs);
  assertEquals(
    m.files.map((f) => f.path),
    ["Z", "a/x", "b", "e", "é"],
  );
  assertEquals(m.files[2], { path: "b", size: 1, sha256: await sha256("b") });
  const bytes = manifestBytes(m);
  assertEquals(new TextDecoder().decode(bytes), `${canon({ files: m.files })}\n`);
  assertEquals(parseManifest(bytes), { kind: "ok", value: m });
  const swapped = JSON.stringify({ files: [m.files[1], m.files[0]] });
  assertEquals(parseManifest(swapped), { kind: "err", error: { kind: "manifest-order", path: "a/x" } });
  assertEquals(parseManifest(JSON.stringify({ files: [{ path: "../x", size: 0, sha256: GENESIS }] })), {
    kind: "err",
    error: { kind: "manifest-unsafe-path", path: "../x" },
  });
});

proves([FR("008")], "verifying files names each one missing, extra or different", async () => {
  const m = await manifestOf(files({ a: "1", b: "2", c: "3" }));
  assertEquals((await verifyManifest(m, files({ a: "1", b: "2", c: "3" }))).kind, "ok");
  const r = await verifyManifest(m, files({ a: "1", c: "changed", d: "new" }));
  assert(r.kind === "err");
  assertEquals(
    r.error.map((x) => [x.kind, x.path]),
    [
      ["missing", "b"],
      ["different", "c"],
      ["extra", "d"],
    ],
  );
});

async function ed25519(): Promise<{
  sign: (m: Uint8Array) => Promise<Uint8Array>;
  verify: (m: Uint8Array, s: Uint8Array) => Promise<boolean>;
}> {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
  return {
    sign: async (m) => new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, new Uint8Array(m))),
    verify: (m, s) => crypto.subtle.verify({ name: "Ed25519" }, pair.publicKey, new Uint8Array(s), new Uint8Array(m)),
  };
}

proves([FR("008")], "a manifest's signature is checked by the caller's function over its exact bytes", async () => {
  const keys = await ed25519();
  const bytes = manifestBytes(await manifestOf(files({ a: "1" })));
  const sig = await keys.sign(bytes);
  assertEquals((await verifyManifestSignature(bytes, sig, keys.verify)).kind, "ok");
  const tampered = manifestBytes(await manifestOf(files({ a: "2" })));
  assertEquals(await verifyManifestSignature(tampered, sig, keys.verify), {
    kind: "err",
    error: { kind: "bad-signature", reason: "the signature does not verify" },
  });
  const throws = await verifyManifestSignature(bytes, sig, () => {
    throw new Error("no key");
  });
  assertEquals(throws, { kind: "err", error: { kind: "bad-signature", reason: "no key" } });
});

// ---------------------------------------------------------------------------------------------------------------------------- bundle

proves([FR("009")], "a bundle is the same bytes every time, begins with its manifest and reads back with it checked", async () => {
  const fs = files({ "reports/b.json": "{}", "a.txt": "hello", "z/y/x.bin": "x" });
  const one = await writeBundle(fs);
  const two = await writeBundle(new Map([...fs].reverse()));
  assert(one.kind === "ok" && two.kind === "ok");
  assertEquals(one.value, two.value);
  const raw = await gunzip(one.value);
  assert(raw.kind === "ok");
  const entries = untar(raw.value);
  assert(entries.kind === "ok");
  assertEquals(entries.value[0]?.path, BUNDLE_MANIFEST);
  const back = await readBundle(one.value);
  assert(back.kind === "ok");
  assertEquals([...back.value.files.keys()].sort(), ["a.txt", "reports/b.json", "z/y/x.bin"]);
  assertEquals(back.value.signature, { kind: "none" });
  assertEquals(await writeBundle(files({ [BUNDLE_MANIFEST]: "x" })), {
    kind: "err",
    error: { kind: "reserved-path", path: BUNDLE_MANIFEST },
  });
});

proves([FR("009")], "a bundle with a file added after its manifest was written is refused, naming the file", async () => {
  const fs = files({ "a.txt": "hello" });
  const m = manifestBytes(await manifestOf(fs));
  const header = tarHeader(BUNDLE_MANIFEST, m.length, false);
  const rest = tar(files({ "a.txt": "hello", "added.txt": "late" }));
  assert(header !== undefined && rest.kind === "ok");
  const forged = gzip(concat([header, m, new Uint8Array((512 - (m.length % 512)) % 512), rest.value]));
  const r = await readBundle(forged);
  assert(r.kind === "err" && r.error.kind === "mismatch");
  assertEquals(r.error.mismatches, [{ kind: "extra", path: "added.txt" }]);
  const noManifest = await readBundle(gzip(rest.value));
  assertEquals(noManifest, { kind: "err", error: { kind: "no-manifest" } });
});

proves([FR("008"), FR("009")], "a signed bundle carries its signature second, verified by the caller's function", async () => {
  const keys = await ed25519();
  const fs = files({ "a.txt": "hello" });
  const signed = await writeBundle(fs, { sign: keys.sign });
  assert(signed.kind === "ok");
  const raw = await gunzip(signed.value);
  assert(raw.kind === "ok");
  const entries = untar(raw.value);
  assertEquals(entries.kind === "ok" ? entries.value.map((e) => e.path) : [], [BUNDLE_MANIFEST, BUNDLE_SIGNATURE, "a.txt"]);
  const ok = await readBundle(signed.value, { verify: keys.verify });
  assert(ok.kind === "ok");
  assertEquals(ok.value.signature, { kind: "verified" });
  const other = await ed25519();
  const bad = await readBundle(signed.value, { verify: other.verify });
  assert(bad.kind === "err" && bad.error.kind === "bad-signature");
  const unsigned = await writeBundle(fs);
  assert(unsigned.kind === "ok");
  assertEquals(await readBundle(unsigned.value, { verify: keys.verify }), { kind: "err", error: { kind: "unsigned" } });
  const unverified = await readBundle(signed.value);
  assert(unverified.kind === "ok" && unverified.value.signature.kind === "unverified");
});
