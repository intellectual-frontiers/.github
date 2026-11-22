/**
 * Tests of the codec and the envelope of NFS (commons anyfs-serve 0006-anyfs-serve-nfs FR-001 to FR-003): XDR against bytes written out by hand and by property, the refusals of the reader, ONC RPC records and replies
 * against the bytes of RFC 5531, and the table from the codes of the POSIX view to the statuses of RFC 1813.
 *
 * @module
 */
import fc from "fast-check";
import { ERRNOS } from "@intellectual-frontiers/anyfs-posix/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { accepted, decode, frame, isNfsStatus, NFS_STATUS, nfsStatusOfErrno, parseCall, progMismatch, RecordReader, XdrReader, XdrWriter, ERRNOS_DIFFER } from "../src/mod.ts";

const hexOf = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const bytesOf = (h: string): Uint8Array => Uint8Array.from(h.match(/../gu)?.map((x) => parseInt(x, 16)) ?? []);

proves(["0006-anyfs-serve-nfs FR-001"], "XDR writes what RFC 4506 says, byte for byte, and reads it back", () => {
  assertEquals(hexOf(new XdrWriter().u32(1).u32(0xffffffff).bytes()), "00000001ffffffff");
  assertEquals(hexOf(new XdrWriter().u64(0x0102030405060708n).bytes()), "0102030405060708");
  assertEquals(hexOf(new XdrWriter().bool(true).bool(false).bytes()), "0000000100000000");
  assertEquals(hexOf(new XdrWriter().string("abc").bytes()), "0000000361626300");
  assertEquals(hexOf(new XdrWriter().opaque(bytesOf("0102030405")).bytes()), "000000050102030405000000");
  const w = new XdrWriter().u32(7).u64(2 ** 40).bool(true).string("naïve").opaque(new Uint8Array([9, 8, 7]));
  const back = decode(w.bytes(), (r) => [r.u32(), r.u64(), r.bool(), r.string(), [...r.opaque()]] as const);
  assert(back.kind === "ok");
  assertEquals(back.kind === "ok" ? back.value : [], [7, 2 ** 40, true, "naïve", [9, 8, 7]]);
});

proves(["0006-anyfs-serve-nfs FR-001"], "any values written read back the same, and a string and opaque of any length are padded to four bytes", () => {
  fc.assert(
    fc.property(fc.array(fc.oneof(fc.record({ k: fc.constant("u32" as const), v: fc.nat({ max: 0xffffffff }) }), fc.record({ k: fc.constant("str" as const), v: fc.string() }), fc.record({ k: fc.constant("bin" as const), v: fc.uint8Array({ maxLength: 40 }) }), fc.record({ k: fc.constant("bool" as const), v: fc.boolean() }))), (items) => {
      const w = new XdrWriter();
      for (const i of items) {
        if (i.k === "u32") w.u32(i.v);
        else if (i.k === "str") w.string(i.v.toWellFormed());
        else if (i.k === "bin") w.opaque(i.v);
        else w.bool(i.v);
      }
      assertEquals(w.length % 4, 0);
      const r = new XdrReader(w.bytes());
      for (const i of items) {
        if (i.k === "u32") assertEquals(r.u32(), i.v);
        else if (i.k === "str") assertEquals(r.string(1 << 20), i.v.toWellFormed());
        else if (i.k === "bin") assertEquals([...r.opaque()], [...i.v]);
        else assertEquals(r.bool(), i.v);
      }
      assertEquals(r.left, 0);
    }),
    { numRuns: 200 },
  );
});

proves(["0006-anyfs-serve-nfs FR-001"], "the reader refuses a read past the end, a length that does not fit, padding that is not zero, a boolean that is not 0 or 1, a string that is not UTF-8 and a number past 2^53", () => {
  assertEquals(decode(bytesOf("000000"), (r) => r.u32()).kind, "err");
  assertEquals(decode(bytesOf("00000009aabb"), (r) => r.opaque()).kind, "err");
  assertEquals(decode(bytesOf("0000000101ff0000"), (r) => r.opaque()).kind, "err");
  assertEquals(decode(bytesOf("00000002"), (r) => r.bool()).kind, "err");
  assertEquals(decode(bytesOf("00000002c3280000"), (r) => r.string()).kind, "err");
  assertEquals(decode(bytesOf("00000100aa000000"), (r) => r.opaque(16)).kind, "err");
  assertEquals(decode(bytesOf("ffffffffffffffff"), (r) => r.u64()).kind, "err");
  assertEquals(decode(bytesOf("ffffffffffffffff"), (r) => r.u64big()).kind, "ok");
});

const NULL_CALL = "00000001" + "00000000" + "00000002" + "000186a3" + "00000003" + "00000000" + "00000000" + "00000000" + "00000000" + "00000000";

proves(["0006-anyfs-serve-nfs FR-002"], "a call of RFC 5531 is read from its bytes and its replies carry the xid and the accept status the standard names", () => {
  const parsed = parseCall(bytesOf(NULL_CALL));
  assert(parsed.kind === "call");
  if (parsed.kind !== "call") return;
  assertEquals([parsed.call.xid, parsed.call.prog, parsed.call.vers, parsed.call.proc, parsed.call.cred.flavor], [1, 100003, 3, 0, 0]);
  assertEquals(hexOf(accepted(1)), "00000001" + "00000001" + "00000000" + "00000000" + "00000000" + "00000000");
  assertEquals(hexOf(progMismatch(1, 3, 3)), "00000001" + "00000001" + "00000000" + "00000000" + "00000000" + "00000002" + "00000003" + "00000003");
  const wrongRpc = parseCall(bytesOf(NULL_CALL.replace("00000002", "00000003")));
  assert(wrongRpc.kind === "reply");
  assertEquals(wrongRpc.kind === "reply" ? hexOf(wrongRpc.reply) : "", "00000001" + "00000001" + "00000001" + "00000000" + "00000002" + "00000002");
  const garbage = parseCall(bytesOf("00000007" + "00000000" + "00000002" + "000186a3"));
  assert(garbage.kind === "reply");
  assertEquals(garbage.kind === "reply" ? hexOf(garbage.reply) : "", "00000007" + "00000001" + "00000000" + "00000000" + "00000000" + "00000004");
  assertEquals(parseCall(bytesOf("00000007" + "00000001")).kind, "drop");
});

proves(["0006-anyfs-serve-nfs FR-002"], "records are framed, joined from fragments and from pieces of a stream, and one longer than the limit is refused", () => {
  const rec = bytesOf(NULL_CALL);
  const framed = frame(rec);
  assertEquals(hexOf(framed.subarray(0, 4)), "8000002" + "8");
  const reader = new RecordReader(1024);
  // byte by byte
  let got: Uint8Array[] = [];
  for (const b of framed) {
    const r = reader.push(Uint8Array.of(b));
    assert(r.kind === "ok");
    if (r.kind === "ok") got = got.concat([...r.value]);
  }
  assertEquals(got.length, 1);
  assertEquals(hexOf(got[0] ?? new Uint8Array()), hexOf(rec));
  // two fragments of one record, then a second record in the same chunk
  const a = rec.subarray(0, 8);
  const b = rec.subarray(8);
  const head = (n: number, last: boolean): Uint8Array => bytesOf((((last ? 0x80000000 : 0) | n) >>> 0).toString(16).padStart(8, "0"));
  const chunk = Uint8Array.from([...head(a.length, false), ...a, ...head(b.length, true), ...b, ...framed]);
  const two = new RecordReader(1024).push(chunk);
  assert(two.kind === "ok");
  assertEquals(two.kind === "ok" ? two.value.map(hexOf) : [], [hexOf(rec), hexOf(rec)]);
  assertEquals(new RecordReader(16).push(framed).kind, "err");
  assertEquals(new RecordReader(40).push(Uint8Array.from([...head(30, false), ...new Uint8Array(30), ...head(30, false), ...new Uint8Array(30)])).kind, "err");
});

proves(["0006-anyfs-serve-nfs FR-003"], "every code of the POSIX view has a status of RFC 1813, the number of Linux where NFS uses it and its own where it differs", () => {
  for (const e of ERRNOS) assert(isNfsStatus(nfsStatusOfErrno(e)), e);
  assertEquals(nfsStatusOfErrno("ENOENT"), NFS_STATUS.NOENT);
  assertEquals(nfsStatusOfErrno("EACCES"), 13);
  assertEquals(nfsStatusOfErrno("EEXIST"), 17);
  assertEquals(nfsStatusOfErrno("EISDIR"), 21);
  assertEquals(nfsStatusOfErrno("ENOTDIR"), 20);
  assertEquals(nfsStatusOfErrno("EROFS"), 30);
  assertEquals(nfsStatusOfErrno("EFBIG"), 27);
  assertEquals(nfsStatusOfErrno("ENAMETOOLONG"), 63);
  assertEquals(nfsStatusOfErrno("ENOTEMPTY"), 66);
  assertEquals(nfsStatusOfErrno("ESTALE"), 70);
  assertEquals(nfsStatusOfErrno("ENOTSUP"), 10004);
  assertEquals(nfsStatusOfErrno("EBADF"), 10001);
  assertEquals([...ERRNOS_DIFFER].sort(), ["EBADF", "ENAMETOOLONG", "ENOTEMPTY", "ENOTSUP", "ESTALE"]);
});
