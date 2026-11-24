/**
 * Replicas that merge, exchanging through a medium (commons anyfs-bridge 0007-bridge-exchange FR-008, FR-009, FR-010 and commons anyfs-sql 0009-sql-compaction FR-006): three SQLite databases, each a replica, publish what
 * they made to a shared place and take what the others published, and all hold the same files, with the concurrent edit kept as a sibling. The shared place is a folder, a branch of a real Git repository, a real
 * OpenSSH server and a real S3-compatible server (RustFS); each where it can be run, and skipped with the reason where it cannot. An exchange that is cut in the middle leaves whole files only, a replica that was away
 * comes back and catches up, and the vectors they publish let one of them collect the rows all hold and the others take the epoch, after which the delta files all have taken are pruned. Every name is made up.
 *
 * @module
 */
import process from "node:process";
import { assert, assertEquals, proves } from "../commons/test/src/test.ts";
import { err } from "../commons/core/src/mod.ts";
import { expectAny, parsePlace, ROOT, unavailable, type ReplicaId } from "../commons/anyfs/src/governance/mod.ts";
import { makeStore, type OpCapability, type Store } from "../commons/anyfs/src/logical/mod.ts";
import { localStore } from "../commons/anyfs/src/physical/local/mod.ts";
import { adoptPublished, openSqlStore, publishEpoch, type SqlStore } from "../commons/anyfs/sql/src/mod.ts";
import { openSqliteFile } from "../commons/anyfs/sql/src/physical/adapters/sqlite.ts";
import {
  type Mergeable,
  memoryCursor,
  publishVector,
  pruneDeltas,
  readVectors,
  syncThrough,
} from "../commons/anyfs/bridge/src/exchange/mod.ts";
import { gitRefStore, parseIdentity } from "../commons/anyfs/git/src/mod.ts";
import { openSshStore } from "../commons/anyfs/ssh/src/mod.ts";
import {
  createBucket,
  fetchTransport,
  makeClient,
  openS3Store,
  parseBucketName,
  parseEndpoint,
  staticCredentials,
} from "../commons/anyfs/s3/src/mod.ts";
import { rustfsBinary, startRustfs } from "../commons/anyfs/s3/tools/rustfs.ts";
import { executorOf, placeOf, withSshd } from "../commons/anyfs/ssh/tools/sshd-test.ts";
import { fs, path, proc } from "../commons/system/src/mod.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();
const gitEnv = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };

type Medium = Store<"read" | "write" | "list" | "delete">;
type Replica = {
  readonly sql: SqlStore;
  readonly id: ReplicaId;
  readonly cursor: ReturnType<typeof memoryCursor>;
  readonly close: () => Promise<void>;
};

const ids = (n: number): ReplicaId[] =>
  Array.from({ length: n }, (_, i) => {
    const bytes = new Uint8Array(16).fill(i + 11);
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return hex as ReplicaId;
  });

async function replicas(dir: string, n: number): Promise<readonly Replica[]> {
  const all = ids(n);
  let now = Date.UTC(2026, 0, 1);
  const clock = (): number => (now += 5);
  const out: Replica[] = [];
  for (const [i, id] of all.entries()) {
    const port = await openSqliteFile(path.join(dir, `r${i}.db`));
    if (port.kind === "err") throw new Error(port.error);
    const opened = await openSqlStore(port.value, { replica: id, clock, trust: { kind: "allowlist", replicas: new Set(all) } });
    if (opened.kind === "err") throw new Error(opened.error);
    out.push({ sql: opened.value, id, cursor: memoryCursor(), close: () => port.value.close() });
  }
  return out;
}

const put = async (r: Replica, file: string, body: string): Promise<void> => {
  const p = (await import("../commons/anyfs/src/governance/mod.ts")).parsePath(file);
  if (p.kind === "err") throw new Error(p.error);
  const w = await r.sql.store.write(p.value, enc.encode(body), expectAny);
  if (w.kind === "err") throw new Error(`write ${file}: ${w.error.kind}`);
};

async function filesOf(r: Replica): Promise<string> {
  const l = await r.sql.store.list(ROOT, { limit: 10000 });
  if (l.kind === "err") throw new Error("list");
  const out: string[] = [];
  for (const e of l.value.entries) {
    const x = await r.sql.store.read(e.path);
    if (x.kind === "err") throw new Error("read");
    out.push(`${e.path}=${dec.decode(x.value.bytes)}`);
  }
  return out.join("\n");
}

const sync = async (r: Replica, medium: Medium, more: { readonly maxRows?: number } = {}) => {
  const done = await syncThrough({ self: r.id, replica: r.sql.store as unknown as Mergeable, medium, cursor: r.cursor, ...more });
  if (done.kind === "err") throw new Error(JSON.stringify(done.error));
  return done.value;
};

/** What every medium is put through. */
async function exercise(name: string, medium: Medium, dir: string): Promise<string> {
  const started = Date.now();
  const [a, b, c] = (await replicas(dir, 3)) as [Replica, Replica, Replica];
  await put(a, "shared/one.txt", "from a");
  await put(a, "both.txt", "a says");
  await put(b, "both.txt", "b says");
  await put(b, "two.txt", "from b");
  // a and b exchange while c is away
  for (let round = 0; round < 2; round++) for (const r of [a, b]) await sync(r, medium);
  assertEquals(await filesOf(a), await filesOf(b), `${name}: a and b hold the same files`);
  // c was away: it writes, comes back, and everyone catches up
  await put(c, "three.txt", "from c, after a long absence");
  for (let round = 0; round < 3; round++) for (const r of [a, b, c]) await sync(r, medium);
  const files = [await filesOf(a), await filesOf(b), await filesOf(c)];
  assertEquals(new Set(files).size, 1, `${name}: all three hold the same files`);
  assert(files[0]?.includes("three.txt="), `${name}: the replica that was away is among them`);
  // a second round when nothing changed publishes nothing and takes nothing
  const quiet = await sync(a, medium);
  assertEquals([quiet.published.length, quiet.pulled.applied], [0, 0], `${name}: nothing changed, nothing done`);
  // the concurrent edit of both.txt is kept: one wins and the other is a sibling, at every replica
  const bothPath = (await import("../commons/anyfs/src/governance/mod.ts")).parsePath("both.txt");
  assert(bothPath.kind === "ok");
  for (const r of [a, b, c])
    assertEquals((await r.sql.siblings(bothPath.value)).length, 1, `${name}: the loser of the concurrent edit is a sibling`);

  // an exchange cut in the middle leaves whole files only
  for (let i = 0; i < 4; i++) await put(a, `more/${i}.txt`, `m${i}`);
  let writes = 0;
  const caps = [...medium.capabilities].filter((x): x is OpCapability => x !== "watch" && x !== "lock");
  const breaking = makeStore({
    id: "breaking",
    place: medium.place,
    consistency: medium.consistency,
    traits: medium.traits,
    capabilities: caps,
    handle: async (op) => (op.op === "write" && ++writes === 3 ? err(unavailable("the medium went away", true)) : medium.handle(op)),
  }) as unknown as Medium;
  const cut = await syncThrough({
    self: a.id,
    replica: a.sql.store as unknown as Mergeable,
    medium: breaking,
    cursor: a.cursor,
    maxRows: 1,
  });
  assert(cut.kind === "err", `${name}: the cut exchange says so`);
  for (const r of [b, c, a]) await sync(r, medium, { maxRows: 1 });
  for (const r of [b, c, a]) await sync(r, medium);
  assertEquals(new Set([await filesOf(a), await filesOf(b), await filesOf(c)]).size, 1, `${name}: after the cut, all converge`);

  // the vectors let one replica collect what all hold; the others take the epoch; the files all have taken are pruned
  const del = (await import("../commons/anyfs/src/governance/mod.ts")).parsePath("two.txt");
  assert(del.kind === "ok");
  assert((await b.sql.store.delete(del.value, expectAny)).kind === "ok");
  for (let round = 0; round < 3; round++) for (const r of [a, b, c]) await sync(r, medium);
  for (const r of [a, b, c])
    assert((await publishVector({ self: r.id, replica: r.sql.store as unknown as Mergeable, medium })).kind === "ok");
  const vectors = await readVectors(medium);
  assert(vectors.kind === "ok" && Object.keys(vectors.value).length === 3);
  const roster = [a.id, b.id, c.id];
  const collected = await a.sql.compact({ reports: vectors.kind === "ok" ? vectors.value : {}, roster });
  assert(collected.kind === "ok", `${name}: a collects against a complete roster${collected.kind === "err" ? `: ${collected.error}` : ""}`);
  assert((await publishEpoch(medium, collected.value.proposal)).kind === "ok");
  for (const r of [b, c]) {
    const taken = await adoptPublished(medium, r.sql.port, r.sql.ctx);
    assert(taken.kind === "ok" && taken.value.adopted.length === 1, `${name}: the epoch is adopted`);
  }
  assertEquals(new Set([await filesOf(a), await filesOf(b), await filesOf(c)]).size, 1, `${name}: the same files after the collection`);
  const pruned = await pruneDeltas(medium, roster);
  assert(pruned.kind === "ok" && pruned.value.removed.length > 0, `${name}: the files all have taken are pruned`);
  for (const r of [a, b, c]) assertEquals((await r.sql.verify()).length, 0, `${name}: the rows that are left are well formed`);
  for (const r of [a, b, c]) await r.close();
  return `${name}: ${Date.now() - started} ms`;
}

const tempDir = (prefix: string): Promise<string> => fs.makeTempDir({ prefix }).then((d) => fs.realPath(d));

proves(
  ["0007-bridge-exchange FR-008", "0007-bridge-exchange FR-009", "0007-bridge-exchange FR-010", "0009-sql-compaction FR-006"],
  "three SQLite replicas exchange through a folder: they converge, a cut exchange leaves whole files, the vectors let one collect and the others take the epoch",
  async () => {
    const dir = await tempDir("anyfs-medium-folder-");
    try {
      const shared = path.join(dir, "shared");
      await fs.mkdir(shared);
      const m = await localStore(shared);
      if (m.kind === "err") throw new Error(m.error);
      console.log(`[anyfs merge medium] ${await exercise("folder", m.value as unknown as Medium, dir)}`);
    } finally {
      await fs.remove(dir, { recursive: true }).catch(() => undefined);
    }
  },
);

proves(
  ["0007-bridge-exchange FR-008", "0007-bridge-exchange FR-009", "0007-bridge-exchange FR-010", "0009-sql-compaction FR-006"],
  "three SQLite replicas exchange through a branch of a real Git repository",
  async (t) => {
    if (proc.which("git") === undefined) {
      t.skip("this computer has no git");
      return;
    }
    const dir = await tempDir("anyfs-medium-git-");
    try {
      const repo = path.join(dir, "exchange.git");
      const init = await proc.run(["git", "-C", dir, "init", "-q", "--bare", "-b", "main", repo], { env: gitEnv });
      if (!init.success) throw new Error(init.stderr);
      const identity = parseIdentity("Exchange", "exchange@example.test");
      if (identity.kind === "err") throw new Error(identity.error);
      const git = await gitRefStore({ repo, branch: "exchange", commit: { author: identity.value, clock: () => Date.UTC(2026, 0, 1) } });
      if (git.kind === "err") throw new Error(git.error);
      console.log(`[anyfs merge medium] ${await exercise("git branch", git.value.store as unknown as Medium, dir)}`);
    } finally {
      await fs.remove(dir, { recursive: true }).catch(() => undefined);
    }
  },
);

proves(
  ["0007-bridge-exchange FR-008", "0007-bridge-exchange FR-009", "0007-bridge-exchange FR-010", "0009-sql-compaction FR-006"],
  "three SQLite replicas exchange through a real OpenSSH server",
  async () => {
    const dir = await tempDir("anyfs-medium-ssh-");
    try {
      const ran = await withSshd(async (host) => {
        const opened = await openSshStore(executorOf(host), { place: placeOf(host), root: `${host.root}/exchange`, create: true });
        if (opened.kind === "err") throw new Error(opened.error);
        console.log(`[anyfs merge medium] ${await exercise("real sshd", opened.value.store as unknown as Medium, dir)}`);
      });
      if (ran.kind === "skipped") console.log(`[anyfs merge medium] the real sshd was not run: ${ran.reason}`);
    } finally {
      await fs.remove(dir, { recursive: true }).catch(() => undefined);
    }
  },
);

proves(
  ["0007-bridge-exchange FR-008", "0007-bridge-exchange FR-009", "0007-bridge-exchange FR-010", "0009-sql-compaction FR-006"],
  "three SQLite replicas exchange through a bucket of a real S3-compatible server",
  async (t) => {
    const bin = await rustfsBinary();
    if (bin.kind === "err") {
      t.skip(`RustFS was not run: ${bin.error}`);
      return;
    }
    const run = await startRustfs(bin.value);
    if (run.kind === "err") {
      t.skip(`RustFS was not run: ${run.error}`);
      return;
    }
    process.once("exit", () => run.value.kill());
    const dir = await tempDir("anyfs-medium-s3-");
    try {
      const keys = staticCredentials(run.value.accessKey, run.value.secretKey);
      const bucket = parseBucketName("exchange");
      const endpoint = parseEndpoint(run.value.endpoint);
      if (keys.kind === "err" || bucket.kind === "err" || endpoint.kind === "err")
        throw new Error("the throwaway keys, bucket or endpoint are not accepted");
      const client = makeClient({
        endpoint: endpoint.value,
        region: "us-east-1",
        bucket: bucket.value,
        addressing: "path",
        credentials: keys.value,
        transport: fetchTransport(),
        timeoutMs: 10_000,
        payload: "auto",
        now: () => new Date(),
      });
      const made = await createBucket(client, "us-east-1");
      if (made.kind === "err") throw new Error(made.error);
      const place = parsePlace("s3://exchange/sync");
      if (place.kind === "err" || place.value.kind !== "s3") throw new Error("not a place");
      const opened = await openS3Store({ place: place.value, credentials: keys.value, endpoint: run.value.endpoint });
      if (opened.kind === "err") throw new Error(opened.error);
      if (opened.value.mode === "read-only") throw new Error("the keys can write");
      console.log(`[anyfs merge medium] ${await exercise("real S3 (RustFS)", opened.value.store as unknown as Medium, dir)}`);
    } finally {
      run.value.kill();
      await fs.remove(dir, { recursive: true }).catch(() => undefined);
    }
  },
);
