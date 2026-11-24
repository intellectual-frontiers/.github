/**
 * Tests of signed changes in the SQL stores (commons anyfs-sql 0011-sql-signing FR-001 to FR-004): replicas on each engine pass the suite of signed deltas; an epoch is taken under signed trust only
 * when its proposer is a replica of the roster and signed it; a dump is replayed under signed trust only with the manifest its replica signed for that text; a raw import by the real sqlite3 of rows of a replica the roster
 * does not name is refused by the database itself, and what the database cannot check there (the signature) is said.
 *
 * @module
 */
import { runSigningConformance, type MakeSigned } from "@intellectual-frontiers/anyfs/conformance";
import { expectAny, ROOT, type ReplicaId } from "@intellectual-frontiers/anyfs/governance";
import { generateSigningKey, makeSigner, rosterTrust, signDelta } from "@intellectual-frontiers/anyfs/merge";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { adoptPublished, publishEpoch } from "../src/physical/compact.ts";
import { dumpArgv, dumpText, importDumps, manifestText, parseManifest, signDump } from "../src/physical/dump.ts";
import { ENGINES, bytes, monotone, osPath, p, replicaOf, sqliteFile, storeOn, text, withTemp } from "./kit.ts";

const failures = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

for (const engine of ENGINES) {
  proves(["0011-sql-signing FR-001"], `on ${engine.name} replicas pass every case of the suite of signed deltas`, async () => {
    const make: MakeSigned = async (ids, trusts) => {
      const clock = monotone(Date.now());
      const faces = [];
      for (const [i, id] of ids.entries()) {
        const s = await storeOn(await engine.make(), { replica: id, clock, trust: trusts[i] ?? { kind: "open" } });
        faces.push({ store: s.store as unknown as Parameters<MakeSigned>[0] extends never ? never : import("@intellectual-frontiers/anyfs/conformance").MergeFace["store"], replica: s.replica });
      }
      return faces;
    };
    const reports = await runSigningConformance(make);
    assertEquals(failures(reports), []);
    assertEquals(reports.length, 9);
  });
}

const rid = (n: number): ReplicaId => replicaOf(n + 20);

const files = async (s: Awaited<ReturnType<typeof storeOn>>): Promise<string> => {
  const listing = await s.store.list(ROOT, { limit: 100000 });
  assert(listing.kind === "ok");
  const out: string[] = [];
  for (const e of listing.value.entries) {
    const r = await s.store.read(e.path);
    assert(r.kind === "ok");
    out.push(`${e.path}=${text(r.value.bytes)}`);
  }
  return out.join("\n");
};

proves(["0011-sql-signing FR-002"], "an epoch is taken under signed trust only from a replica of the roster that signed it: unsigned, signed by another key and from a replica off the list are refused, and a signed one is taken and ends with the same files", async () => {
  const clock = monotone(Date.now());
  const [ka, kb, kx] = await Promise.all([generateSigningKey(rid(0)), generateSigningKey(rid(1)), generateSigningKey(rid(2))]);
  const roster = [ka.entry, kb.entry];
  const sa = await makeSigner(ka);
  const sx = await makeSigner(kx);
  const a = await storeOn(await sqliteFile(":memory:"), { replica: rid(0), clock, trust: rosterTrust(roster) });
  const b = await storeOn(await sqliteFile(":memory:"), { replica: rid(1), clock, trust: rosterTrust(roster) });
  assert((await a.store.write(p("one.txt"), bytes("1"), expectAny)).kind === "ok");
  assert((await a.store.write(p("two.txt"), bytes("2"), expectAny)).kind === "ok");
  assert((await a.store.delete(p("two.txt"), expectAny)).kind === "ok");
  const delta = await a.store.deltaSince({});
  assert(delta.kind === "ok");
  assert((await b.store.applyDelta(await signDelta(delta.value, sa))).kind === "ok");
  const vector = await b.store.versionVector();
  assert(vector.kind === "ok");
  const done = await a.compact({ reports: { [b.replica]: { ...vector.value } }, roster: [a.replica, b.replica] });
  assert(done.kind === "ok");
  // not signed: refused, and the file says why
  const bare = memoryStore({ name: "bare" });
  assert((await publishEpoch(bare, done.value.proposal)).kind === "ok");
  const unsigned = await adoptPublished(bare, b.port, b.ctx);
  assert(unsigned.kind === "ok" && unsigned.value.adopted.length === 0 && unsigned.value.refused.length === 1 && /not signed/.test(unsigned.value.refused[0] ?? ""), JSON.stringify(unsigned));
  // signed by a key that is not the proposer's: refused
  const wrong = memoryStore({ name: "wrong" });
  assert((await publishEpoch(wrong, done.value.proposal, sx)).kind === "ok");
  const byWrong = await adoptPublished(wrong, b.port, b.ctx);
  assert(byWrong.kind === "ok" && byWrong.value.adopted.length === 0 && byWrong.value.refused.length === 1, JSON.stringify(byWrong));
  // a replica off the list it must also be on: refused though its signature holds
  const listed = await storeOn(await sqliteFile(":memory:"), { replica: rid(1), clock, trust: rosterTrust(roster, new Set([rid(1)])) });
  const signed = memoryStore({ name: "signed" });
  assert((await publishEpoch(signed, done.value.proposal, sa)).kind === "ok");
  const offList = await adoptPublished(signed, listed.port, listed.ctx);
  assert(offList.kind === "ok" && offList.value.adopted.length === 0 && offList.value.refused.length === 1, JSON.stringify(offList));
  // signed by the proposer: taken, and the same files
  const taken = await adoptPublished(signed, b.port, b.ctx);
  assert(taken.kind === "ok" && taken.value.adopted.length === 1, JSON.stringify(taken));
  assertEquals(await files(b), await files(a));
});

proves(["0011-sql-signing FR-003"], "a dump is replayed under signed trust only with the manifest its replica signed for that text: unsigned, altered, counted wrong, signed by another key and from a replica off the list are refused, and a signed one is taken, with the manifest read back from its file", async () => {
  await withTemp(async (dir) => {
    const clock = monotone(Date.now());
    const [ka, kc] = await Promise.all([generateSigningKey(rid(0)), generateSigningKey(rid(2))]);
    const roster = [ka.entry, kc.entry];
    const file = osPath.join(dir, "a.db");
    const a = await storeOn(await sqliteFile(file), { replica: rid(0), clock, trust: rosterTrust(roster) });
    for (const [path, body] of [["a.txt", "one"], ["dir/b.txt", "two"]] as const) assert((await a.store.write(p(path), bytes(body), expectAny)).kind === "ok");
    await a.checkpoint();
    const dump = await proc.must(dumpArgv(file, a.facts.naming) as string[]);
    const sa = await makeSigner(ka);
    const sc = await makeSigner(kc);
    const signed = await signDump(dump, a.facts.naming, sa);
    assert(signed.kind === "ok");
    const into = (): Promise<Awaited<ReturnType<typeof storeOn>>> => sqliteFile(":memory:").then((port) => storeOn(port, { replica: rid(1), clock, trust: rosterTrust(roster) }));
    const unsigned = await importDumps(await into(), [dump]);
    assert(unsigned.kind === "err" && /not signed/.test(unsigned.error));
    const altered = await importDumps(await into(), [{ text: `${dump}\n`, manifest: signed.value.manifest }]);
    assert(altered.kind === "err" && /not the one its manifest was signed for/.test(altered.error));
    const counted = await importDumps(await into(), [{ text: dump, manifest: { ...signed.value.manifest, versions: signed.value.manifest.versions + 1 } }]);
    assert(counted.kind === "err");
    const other = await signDump(dump, a.facts.naming, sc);
    assert(other.kind === "ok");
    const byOther = await importDumps(await into(), [{ text: dump, manifest: { ...other.value.manifest, replica: a.replica } }]);
    assert(byOther.kind === "err" && /does not hold|know/.test(byOther.error), byOther.kind === "err" ? byOther.error : "taken");
    const listed = await storeOn(await sqliteFile(":memory:"), { replica: rid(1), clock, trust: rosterTrust(roster, new Set([rid(1), rid(2)])) });
    const offList = await importDumps(listed, [signed.value]);
    assert(offList.kind === "err" && /does not take rows from/.test(offList.error));
    // the manifest is kept in a file next to the dump, and read back
    const back = parseManifest(manifestText(signed.value.manifest));
    assert(back.kind === "ok");
    assertEquals(back.value, signed.value.manifest);
    assertEquals(parseManifest("{}").kind, "err");
    const fresh = await into();
    const taken = await importDumps(fresh, [{ text: dump, manifest: back.value }]);
    assert(taken.kind === "ok", taken.kind === "err" ? taken.error : "");
    assertEquals(taken.value.findings, []);
    assertEquals(await files(fresh), await files(a));
    // a dump of the library's own writing is signed the same way on any engine
    const written = await signDump(await dumpText(a.port, a.facts.naming), a.facts.naming, sa);
    assert(written.kind === "ok");
  });
});

proves(["0011-sql-signing FR-004"], "a raw import by the real sqlite3 under signed trust writes no row of a replica the roster does not name, and the signature, which the database cannot check, is held by the library's import", async () => {
  await withTemp(async (dir) => {
    const clock = monotone(Date.now());
    const [ka, kb] = await Promise.all([generateSigningKey(rid(0)), generateSigningKey(rid(1))]);
    const roster = [ka.entry, kb.entry];
    // a replica that is not in the roster writes a database, and the dump of it is imported by the real command into a database that takes signed changes
    const stranger = await storeOn(await sqliteFile(osPath.join(dir, "s.db")), { replica: rid(5), clock, trust: { kind: "open" } });
    assert((await stranger.store.write(p("evil.txt"), bytes("x"), expectAny)).kind === "ok");
    await stranger.checkpoint();
    const strangerDump = await proc.must(dumpArgv(osPath.join(dir, "s.db"), stranger.facts.naming) as string[]);
    const target = osPath.join(dir, "t.db");
    const t = await storeOn(await sqliteFile(target), { replica: rid(1), clock, trust: rosterTrust(roster) });
    await t.checkpoint();
    await proc.must(["sh", "-c", `printf '%s' "$0" | sqlite3 ${target}`, strangerDump]).catch(() => undefined);
    const after = await t.store.list(ROOT, { limit: 100 });
    assert(after.kind === "ok" && after.value.entries.length === 0, "the database took nothing of a replica off the roster");
    // a replica of the roster is taken by the real command, with no signature to check: the library's import is what holds that
    const member = await storeOn(await sqliteFile(osPath.join(dir, "m.db")), { replica: rid(0), clock, trust: { kind: "open" } });
    assert((await member.store.write(p("ok.txt"), bytes("y"), expectAny)).kind === "ok");
    await member.checkpoint();
    const memberDump = await proc.must(dumpArgv(osPath.join(dir, "m.db"), member.facts.naming) as string[]);
    await proc.must(["sh", "-c", `printf '%s' "$0" | sqlite3 ${target}`, memberDump]);
    await t.reindex();
    assertEquals(await files(t), "ok.txt=y");
    assert(t.ctx.config.trust.kind === "signed");
    void kb;
  });
});
