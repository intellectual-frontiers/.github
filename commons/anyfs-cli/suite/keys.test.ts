/**
 * Tests of the verbs of keys and rosters (commons anyfs-cli 0007-anyfs-cli-keys FR-001 to FR-006): keys made through the program, rosters kept in files and handed through a real store (a folder), and a rotation whose
 * windows are held by the verification of signatures that the merge uses.
 *
 * @module
 */
import { makeSigner, parseRoster, parseSigningKey, verifySigned, type KeyRoster } from "@intellectual-frontiers/anyfs/merge";
import { parseReplicaId } from "@intellectual-frontiers/anyfs/governance";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { keyState, takeEntries } from "../src/logical/mod.ts";
import { lab, mountsOf, type Lab } from "./world.ts";

const HEX = (c: string): string => c.repeat(32);
const rid = (c: string) => {
  const r = parseReplicaId(HEX(c));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

async function withLab<T>(body: (l: Lab) => Promise<T>): Promise<T> {
  const l = await lab();
  try {
    await l.config(mountsOf(l.dir, ["shared"]));
    await fs.mkdir(path.join(l.dir, "shared"), { recursive: true });
    return await body(l);
  } finally {
    await l.cleanup();
  }
}

const rosterOf = async (l: Lab, file: string): Promise<KeyRoster> => {
  const r = parseRoster(await fs.readTextFile(path.join(l.dir, file)));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0007-anyfs-cli-keys FR-001", "0007-anyfs-cli-keys FR-002"], "keygen writes the key for its owner only, prints the entry and not the private key, never writes over a file, and is not a tool of the tool server", () =>
  withLab(async (l) => {
    const made = await l.run(["keygen", "--replica", HEX("a"), "--key", "a.key", "--not-before", "1000"]);
    assertEquals(made.code, 0, made.err + made.out);
    const kept = await fs.readTextFile(path.join(l.dir, "a.key"));
    const key = parseSigningKey(kept);
    assert(key.kind === "ok");
    if (key.kind !== "ok") return;
    assertEquals(key.value.entry.replica, rid("a"));
    assertEquals(key.value.entry.notBefore, 1000);
    assertStringIncludes(made.out, key.value.entry.keyId);
    assert(!made.out.includes(key.value.privateJwk.d ?? "?"), "the private key is not printed");
    assertEquals(((await fs.stat(path.join(l.dir, "a.key"))).mode ?? 0) & 0o777, 0o600);
    const again = await l.run(["keygen", "--replica", HEX("a"), "--key", "a.key"]);
    assertEquals(again.code, 1);
    assertEquals(await fs.readTextFile(path.join(l.dir, "a.key")), kept);
    assertEquals((await l.run(["keygen", "--replica", "nope", "--key", "z.key"])).code, 2);
    const { VERBS, LOCAL_ONLY_VERBS } = await import("../src/governance/mod.ts");
    for (const id of LOCAL_ONLY_VERBS) assertEquals([...VERBS[id].channels], ["local"], id);
    assertEquals(VERBS["roster show"].effect, "read");
  }),
);

proves(["0007-anyfs-cli-keys FR-003"], "roster add takes the public keys of keys and entries, idempotently, and roster show says whether each speaks", () =>
  withLab(async (l) => {
    await l.run(["keygen", "--replica", HEX("a"), "--key", "a.key"]);
    await l.run(["keygen", "--replica", HEX("b"), "--key", "b.key", "--not-after", "5"]);
    const first = await l.run(["roster", "add", "roster.json", "a.key", "b.key"]);
    assertEquals(first.code, 0, first.err);
    assertStringIncludes(first.out, "added 2 of 2");
    const roster = await rosterOf(l, "roster.json");
    assertEquals(roster.length, 2);
    assert(!(await fs.readTextFile(path.join(l.dir, "roster.json"))).includes('"d"'), "no private key in a roster");
    const again = await l.run(["roster", "add", "roster.json", "a.key"]);
    assertStringIncludes(again.out, "added 0 of 1");
    const shown = await l.run(["roster", "show", "--at", "100", "roster.json"]);
    assertEquals(shown.code, 0, shown.err);
    assertStringIncludes(shown.out, "active");
    assertStringIncludes(shown.out, "expired");
    // the same key id with another public key is refused
    const [a] = roster;
    assert(a !== undefined);
    if (a === undefined) return;
    const forged = [{ ...a, publicKey: roster[1]?.publicKey ?? "" }];
    await fs.writeTextFile(path.join(l.dir, "forged.json"), JSON.stringify(forged));
    const refused = await l.run(["roster", "add", "roster.json", "forged.json"]);
    assertEquals(refused.code, 1, refused.out + refused.err);
    assertStringIncludes(refused.err + refused.out, "another public key");
    assertEquals(keyState({ ...a, notBefore: 10 }, 5), "future");
  }),
);

proves(["0007-anyfs-cli-keys FR-004", "0007-anyfs-cli-keys FR-005"], "a roster is published to a store and fetched from it, and a new key is taken in only where its id was accepted", () =>
  withLab(async (l) => {
    await l.run(["keygen", "--replica", HEX("a"), "--key", "a.key"]);
    await l.run(["keygen", "--replica", HEX("b"), "--key", "b.key"]);
    await l.run(["roster", "add", "theirs.json", "a.key", "b.key"]);
    const published = await l.run(["roster", "publish", "theirs.json", "shared:/keys/roster.json"]);
    assertEquals(published.code, 0, published.err);
    const onStore = parseRoster(await fs.readTextFile(path.join(l.dir, "shared", "keys", "roster.json")));
    assert(onStore.kind === "ok" && onStore.value.length === 2);
    await l.run(["roster", "add", "mine.json", "a.key"]);
    const shown = await l.run(["roster", "fetch", "mine.json", "shared:/keys/roster.json"]);
    assertEquals(shown.code, 0, shown.err);
    assertStringIncludes(shown.out, "1 known, 0 added, 1 pending");
    assertEquals((await rosterOf(l, "mine.json")).length, 1);
    const theirs = await rosterOf(l, "theirs.json");
    const b = theirs.find((e) => e.replica === rid("b"));
    assert(b !== undefined);
    if (b === undefined) return;
    const wrong = await l.run(["roster", "fetch", "--accept", "0000000000000000", "mine.json", "shared:/keys/roster.json"]);
    assertStringIncludes(wrong.out, "0 added, 1 pending");
    const taken = await l.run(["roster", "fetch", "--accept", b.keyId, "mine.json", "shared:/keys/roster.json"]);
    assertEquals(taken.code, 0, taken.err);
    assertStringIncludes(taken.out, "1 added, 0 pending");
    assertEquals((await rosterOf(l, "mine.json")).length, 2);
    // a fetched roster never widens a window it already holds
    const [a] = theirs;
    assert(a !== undefined);
    if (a === undefined) return;
    const narrow = takeEntries([{ ...a, notAfter: 10 }], [a], new Set());
    assert(narrow.kind === "ok" && narrow.value.roster[0]?.notAfter === 10);
  }),
);

proves(["0007-anyfs-cli-keys FR-006"], "rotate ends the old key and starts a new one so that what the old key signed before the instant holds, and what it signs after does not", () =>
  withLab(async (l) => {
    await l.run(["keygen", "--replica", HEX("a"), "--key", "a.key"]);
    await l.run(["roster", "add", "roster.json", "a.key"]);
    const old = parseSigningKey(await fs.readTextFile(path.join(l.dir, "a.key")));
    assert(old.kind === "ok");
    if (old.kind !== "ok") return;
    const rotated = await l.run(["roster", "rotate", "--key", "a2.key", "--at", "5000", "roster.json", old.value.entry.keyId]);
    assertEquals(rotated.code, 0, rotated.err + rotated.out);
    assertEquals(((await fs.stat(path.join(l.dir, "a2.key"))).mode ?? 0) & 0o777, 0o600);
    const fresh = parseSigningKey(await fs.readTextFile(path.join(l.dir, "a2.key")));
    assert(fresh.kind === "ok");
    if (fresh.kind !== "ok") return;
    const roster = await rosterOf(l, "roster.json");
    assertEquals(roster.length, 2);
    const oldSigner = await makeSigner(old.value);
    const newSigner = await makeSigner(fresh.value);
    const digest = "d".repeat(64);
    const replica = rid("a");
    assertEquals(await verifySigned(roster, "anyfs-delta/1", digest, await oldSigner.sign("anyfs-delta/1", digest), replica, 4999), "ok");
    assertEquals(await verifySigned(roster, "anyfs-delta/1", digest, await oldSigner.sign("anyfs-delta/1", digest), replica, 5001), "unknown-key");
    assertEquals(await verifySigned(roster, "anyfs-delta/1", digest, await newSigner.sign("anyfs-delta/1", digest), replica, 5001), "ok");
    assertEquals(await verifySigned(roster, "anyfs-delta/1", digest, await newSigner.sign("anyfs-delta/1", digest), replica, 4000), "unknown-key");
    const again = await l.run(["roster", "rotate", "--key", "a2.key", "--at", "6000", "roster.json", old.value.entry.keyId]);
    assertEquals(again.code, 1, "a key file is never written over");
    assertEquals((await l.run(["roster", "rotate", "--key", "a3.key", "roster.json", "ffffffffffffffff"])).code, 1);
  }),
);
