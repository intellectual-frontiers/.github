/**
 * Tests of trust and signing in the verbs for stores that merge (commons anyfs-cli 0005-anyfs-cli-merge-signing FR-001 to FR-004): `--trust signed` refuses what is not signed, `--sign-key` signs with the key of the replica that made
 * the delta, a key and a roster are named by a file or by `env:NAME` and never by their text, a mount may say the trust and the keys, and a command line that asks for what it cannot have is a usage error.
 *
 * @module
 */
import { generateSigningKey, rosterText, signingKeyText, type SigningKey } from "@intellectual-frontiers/anyfs/merge";
import { parseReplicaId } from "@intellectual-frontiers/anyfs/governance";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path, proc } from "@intellectual-frontiers/system";
import process from "node:process";
import { lab, type Lab } from "./world.ts";

const MERGE = import.meta.resolve("@intellectual-frontiers/anyfs/memory-merge");
const HEX = (c: string): string => c.repeat(32);
const replica = (c: string) => {
  const r = parseReplicaId(HEX(c));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

const config = (shared: string, extra: string): string => `import { memoryMergeStore } from ${JSON.stringify(MERGE)};
import { parsePath } from ${JSON.stringify(import.meta.resolve("@intellectual-frontiers/anyfs"))};
const text = (s) => new TextEncoder().encode(s);
const id = (c) => c.repeat(32);
const make = async (name, c, file, body) => {
  let tick = 1000;
  const s = memoryMergeStore({ name, replica: id(c), clock: () => (tick += 1), trust: { kind: "open" } });
  const w = await s.store.write(parsePath(file).value, text(body), { kind: "any" });
  if (w.kind !== "ok") throw new Error(JSON.stringify(w));
  return s.store;
};
const left = await make("left", "a", "one.txt", "one\\n");
const right = await make("right", "b", "two.txt", "two\\n");
export default { mounts: [{ name: "left", place: "git+file:///tmp/example-left" }, { name: "right", place: "git+file:///tmp/example-right" }, { name: "shared", place: ${JSON.stringify(`file://${shared}`)} }${extra}], kinds: [{ kind: "git", open: async (p) => ({ kind: "ok", value: p.repo.includes("left") ? left : right }) }] };
`;

type Keys = { readonly a: SigningKey; readonly b: SigningKey; readonly roster: string; readonly keyA: string; readonly keyB: string };

async function withLab<T>(extra: (dir: string) => string, body: (l: Lab, k: Keys) => Promise<T>): Promise<T> {
  const l = await lab();
  try {
    await fs.mkdir(path.join(l.dir, "shared"), { recursive: true });
    const [a, b] = await Promise.all([generateSigningKey(replica("a")), generateSigningKey(replica("b"))]);
    const keys: Keys = { a, b, roster: path.join(l.dir, "roster.json"), keyA: path.join(l.dir, "a.key"), keyB: path.join(l.dir, "b.key") };
    await fs.writeTextFile(keys.roster, rosterText([a.entry, b.entry]));
    await fs.writeTextFile(keys.keyA, signingKeyText(a));
    await fs.writeTextFile(keys.keyB, signingKeyText(b));
    await l.config(config(path.join(l.dir, "shared"), extra(l.dir)));
    return await body(l, keys);
  } finally {
    await l.cleanup();
  }
}

proves(["0005-anyfs-cli-merge-signing FR-001"], "merge under --trust signed refuses deltas that are not signed, says so by kind, and takes them when each is signed with the key of its origin", () =>
  withLab(() => "", async (l, k) => {
    const unsigned = await l.run(["merge", "--yes", "--trust", "signed", "--roster", k.roster, "left:/", "right:/"]);
    assertEquals(unsigned.code, 1, unsigned.out + unsigned.err);
    assertStringIncludes(unsigned.out, "refused (unsigned)");
    assertStringIncludes(unsigned.err, "E-MERGE-REFUSED");
    const signed = await l.run(["merge", "--yes", "--trust", "signed", "--roster", k.roster, "--sign-key", `${k.keyA},${k.keyB}`, "left:/", "right:/"]);
    assertEquals(signed.code, 0, signed.out + signed.err);
    assertStringIncludes(signed.out, "the two hold the same rows now");
  }),
);

proves(["0005-anyfs-cli-merge-signing FR-002"], "a key and a roster are named by a file or by env:NAME; a variable that is not set, text that is not a key and a roster that does not hold the key are refused without the secret in the answer", () =>
  withLab(() => "", async (l, k) => {
    const keyText = signingKeyText(k.a);
    const rosterTextOf = rosterText([k.a.entry, k.b.entry]);
    const viaEnv = await l.run(["merge", "--yes", "--trust", "signed", "--roster", "env:ROSTER", "--sign-key", "env:KEY_A,env:KEY_B", "left:/", "right:/"], { env: { ROSTER: rosterTextOf, KEY_A: keyText, KEY_B: signingKeyText(k.b) } });
    assertEquals(viaEnv.code, 0, viaEnv.out + viaEnv.err);
    const unset = await l.run(["merge", "--dry-run", "--trust", "signed", "--roster", k.roster, "--sign-key", "env:NOPE", "left:/", "right:/"]);
    assertEquals(unset.code, 2);
    assertStringIncludes(unset.err, "NOPE");
    await fs.writeTextFile(path.join(l.dir, "bad.key"), "not a key");
    const notKey = await l.run(["merge", "--yes", "--trust", "signed", "--roster", k.roster, "--sign-key", path.join(l.dir, "bad.key"), "left:/", "right:/"]);
    assertEquals(notKey.code, 2);
    const leak = JSON.parse(keyText).privateJwk.d as string;
    assert(!notKey.out.includes(leak) && !notKey.err.includes(leak));
    const missing = await l.run(["merge", "--yes", "--trust", "signed", "--roster", "env:UNSET", "left:/", "right:/"]);
    assertEquals(missing.code, 2);
  }),
);

proves(["0005-anyfs-cli-merge-signing FR-003"], "sync-medium signs what it publishes with the key of the store's replica and takes only what the trust takes: a file of a key that is not on the roster is refused and kept as refused", () =>
  withLab(() => "", async (l, k) => {
    const medium = path.join(l.dir, "shared");
    const published = await l.run(["sync-medium", "--replica", HEX("a"), "--sign-key", k.keyA, "left:/", "shared:/"]);
    assertEquals(published.code, 0, published.err);
    const names: string[] = [];
    for await (const e of fs.readDir(path.join(medium, "deltas", HEX("a")))) names.push(e.name);
    assertEquals(names.length, 1);
    const body = await fs.readTextFile(path.join(medium, "deltas", HEX("a"), names[0] as string));
    assertStringIncludes(body, `ed25519:${k.a.entry.keyId}:`);
    // the other side takes it under a roster that knows the key
    const taken = await l.run(["sync-medium", "--replica", HEX("b"), "--trust", "signed", "--roster", k.roster, "right:/", "shared:/"]);
    assertEquals(taken.code, 0, taken.out + taken.err);
    assertStringIncludes(taken.out, "took 1 file");
    // and refuses it where the roster does not know the key of a
    const lonely = path.join(l.dir, "lonely.json");
    await fs.writeTextFile(lonely, rosterText([k.b.entry]));
    for await (const e of fs.readDir(l.state)) if (e.name.startsWith("sync-medium-")) await fs.remove(path.join(l.state, e.name));
    const refused = await l.run(["sync-medium", "--replica", HEX("b"), "--trust", "signed", "--roster", lonely, "--sign-key", k.keyB, "right:/", "shared:/"]);
    assertEquals(refused.code, 1, refused.out + refused.err);
    assertStringIncludes(refused.out, "refused (unknown-key)");
    assertStringIncludes(refused.err, "E-FILES-ASIDE");
    // a key of another replica than the store's is a usage error
    const wrong = await l.run(["sync-medium", "--replica", HEX("a"), "--sign-key", k.keyB, "left:/", "shared:/"]);
    assertEquals(wrong.code, 2, wrong.out + wrong.err);
  }),
);

proves(["0005-anyfs-cli-merge-signing FR-004"], "a mount may say the trust and the keys, a flag overrides it, and a command line that asks for a mode it cannot have is a usage error", () =>
  withLab(
    (dir) =>
      `, { name: "signedleft", place: "git+file:///tmp/example-left", trust: { mode: "signed", roster: ${JSON.stringify(path.join(dir, "roster.json"))}, signKeys: [${JSON.stringify(path.join(dir, "a.key"))}] } }`,
    async (l, k) => {
      // the mount of the first side says signed and holds the key of a; the second side takes it, and b's own deltas are unsigned and refused by the first
      const viaMount = await l.run(["merge", "--yes", "signedleft:/", "right:/"]);
      assertEquals(viaMount.code, 1, viaMount.out + viaMount.err);
      assertStringIncludes(viaMount.out, "refused (unsigned)");
      const flagged = await l.run(["merge", "--yes", "--trust", "open", "signedleft:/", "right:/"]);
      assertEquals(flagged.code, 0, flagged.out + flagged.err);
      assertEquals((await l.run(["merge", "--dry-run", "--trust", "signed", "left:/", "right:/"])).code, 2);
      assertEquals((await l.run(["merge", "--dry-run", "--trust", "allowlist", "left:/", "right:/"])).code, 2);
      assertEquals((await l.run(["merge", "--dry-run", "--trust", "maybe", "left:/", "right:/"])).code, 2);
      assertEquals((await l.run(["merge", "--dry-run", "--roster", k.roster, "left:/", "right:/"])).code, 2);
      const allow = await l.run(["merge", "--yes", "--trust", "allowlist", "--replicas", `${HEX("a")},${HEX("b")}`, "left:/", "right:/"]);
      assertEquals(allow.code, 0, allow.out + allow.err);
    },
  ),
);

proves(["0005-anyfs-cli-merge-signing FR-005"], "the tool that makes a key writes the file for its owner only, prints the entry for the roster and not the private key, and never writes over a key", async () => {
  const l = await lab();
  try {
    const file = path.join(l.dir, "made.key");
    const tool = path.join(import.meta.dirname, "..", "tools", "keygen.ts");
    const made = await proc.output([process.execPath, tool, "--replica", HEX("c"), "--key", file]);
    assertEquals(made.code, 0, new TextDecoder().decode(made.stderr));
    const printed = new TextDecoder().decode(made.stdout);
    const entry = JSON.parse(printed) as { replica: string; keyId: string };
    assertEquals(entry.replica, HEX("c"));
    const kept = await fs.readTextFile(file);
    assert(!printed.includes(JSON.parse(kept).privateJwk.d as string), "the private key is not printed");
    assertEquals(((await fs.stat(file)).mode ?? 0) & 0o777, 0o600);
    const again = await proc.output([process.execPath, tool, "--replica", HEX("c"), "--key", file]);
    assertEquals(again.code, 1);
    assertEquals(await fs.readTextFile(file), kept);
  } finally {
    await l.cleanup();
  }
});
