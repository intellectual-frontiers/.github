/**
 * Tests of the verbs for stores that merge (commons anyfs-cli 0004-anyfs-cli-surfaces FR-017, FR-018): `merge` plans first with a hash and applies only what the hash approves; `sync-medium` exchanges a store with a shared place.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { lab, type Lab } from "./world.ts";

const MERGE = import.meta.resolve("@intellectual-frontiers/anyfs/memory-merge");
const HEX = (c: string): string => c.repeat(32);

/** A configuration with two memory stores that merge, each holding one file of its own, built the same way on every run (fixed identities and clock). */
const config = (shared: string): string => `import { memoryMergeStore } from ${JSON.stringify(MERGE)};
import { parsePath } from ${JSON.stringify(import.meta.resolve("@intellectual-frontiers/anyfs"))};
const text = (s) => new TextEncoder().encode(s);
const id = (c) => c.repeat(32);
const make = async (name, c, file, body) => {
  let tick = 1000;
  const s = memoryMergeStore({ name, replica: id(c), clock: () => (tick += 1), trust: { kind: "open" } });
  const p = parsePath(file);
  const w = await s.store.write(p.value, text(body), { kind: "any" });
  if (w.kind !== "ok") throw new Error(JSON.stringify(w));
  return s.store;
};
const left = await make("left", "a", "one.txt", "one\\n");
const right = await make("right", "b", "two.txt", "two\\n");
export default { mounts: [{ name: "left", place: "git+file:///tmp/example-left" }, { name: "right", place: "git+file:///tmp/example-right" }, { name: "plain", place: "memory:plain" }, { name: "shared", place: ${JSON.stringify(`file://${shared}`)} }], kinds: [{ kind: "git", open: async (p) => ({ kind: "ok", value: p.repo.includes("left") ? left : right }) }] };
`;

async function withLab<T>(body: (l: Lab) => Promise<T>): Promise<T> {
  const l = await lab();
  try {
    await fs.mkdir(path.join(l.dir, "shared"), { recursive: true });
    await l.config(config(path.join(l.dir, "shared")));
    return await body(l);
  } finally {
    await l.cleanup();
  }
}

proves(["0004-anyfs-cli-surfaces FR-017"], "merge plans first with a hash, refuses a stale hash, and a store that does not merge", () =>
  withLab(async (l) => {
    const dry = await l.run(["merge", "--dry-run", "left:/", "right:/"]);
    assertEquals(dry.code, 0, dry.err);
    assert(/plan [0-9a-f]{64}/.test(dry.out), dry.out);
    assertStringIncludes(dry.err, "--yes --plan-hash");
    assertEquals((await l.run(["merge", "left:/", "right:/"])).code, 2);
    const stale = await l.run(["merge", "--yes", "--plan-hash", "1".repeat(64), "left:/", "right:/"]);
    assertEquals(stale.code, 1, stale.out + stale.err);
    assertStringIncludes(stale.err, "E-PLAN-STALE");
    const plain = await l.run(["merge", "--dry-run", "left:/", "plain:/"]);
    assertEquals(plain.code, 1, plain.out + plain.err);
    assertStringIncludes(plain.err, "E-PLAN-REFUSED");
  }),
);

proves(["0004-anyfs-cli-surfaces FR-018"], "sync-medium needs a replica identity, plans under --dry-run and exchanges with the shared place", () =>
  withLab(async (l) => {
    const medium = path.join(l.dir, "shared");
    const noId = await l.run(["sync-medium", "left:/", "shared:/"]);
    assertEquals(noId.code, 2);
    const dry = await l.run(["sync-medium", "--dry-run", "--replica", HEX("a"), "left:/", "shared:/"]);
    assertEquals(dry.code, 0, dry.err);
    assertStringIncludes(dry.out, "to publish");
    const listed: string[] = [];
    for await (const e of fs.readDir(medium)) listed.push(e.name);
    assertEquals(listed.length, 0);
    const done = await l.run(["sync-medium", "--replica", HEX("a"), "left:/", "shared:/"]);
    assertEquals(done.code, 0, done.err);
    assertStringIncludes(done.out, "published", done.out);
    for await (const e of fs.readDir(medium)) assertEquals(e.name.length > 0, true, e.name);
    assert(await fs.exists(path.join(medium, "deltas", HEX("a"))), "no deltas folder");
  }),
);
