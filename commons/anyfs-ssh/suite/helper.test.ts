/**
 * Tests of the helper script, run for real under each shell of this computer through the path an ssh executor takes (commons anyfs-ssh 0002-anyfs-ssh-helper FR-001 to FR-010): the module made from the
 * script is current and its hash is the hash of the script, every command answers by its exit status and its output, a path that is not a path of the store or that leaves the folder is refused, a
 * write is whole and atomic, two writers that expect the same revision cannot both win, and a lock of a process that is gone is taken over.
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { POSIX_HELPER, POSIX_HELPER_SHA256 } from "../src/helper/mod.ts";
import { moduleOf } from "../tools/helper.ts";
import { fakeHost, type FakeHost, runHelper } from "./support.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const SHELLS = ["dash", "bash"].filter((s) => proc.which(s) !== undefined);
const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);
const HELLO = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

async function onHost<T>(shell: string | undefined, run: (host: FakeHost) => Promise<T>): Promise<T> {
  const host = await fakeHost(shell === undefined ? {} : { shell });
  try {
    return await run(host);
  } finally {
    await host.cleanup();
  }
}
const h = (host: FakeHost, command: string, args: readonly string[], input?: string) => runHelper(host, POSIX_HELPER, command, args, input === undefined ? undefined : bytes(input));

proves(["0002-anyfs-ssh-helper FR-001"], "the module is made from the script and the hash is the hash of the script", async () => {
  const script = await fs.readTextFile(path.join(ROOT, "src/helper/posix.sh"));
  assertEquals(POSIX_HELPER, script);
  assertEquals(POSIX_HELPER_SHA256, await sha256(script));
  assertEquals(await fs.readTextFile(path.join(ROOT, "src/helper/posix.ts")), await moduleOf(script));
  const out = await proc.output(["sha256sum", path.join(ROOT, "src/helper/posix.sh")]);
  assertStringIncludes(new TextDecoder().decode(out.stdout), POSIX_HELPER_SHA256);
});

for (const shell of SHELLS) {
  proves(["0002-anyfs-ssh-helper FR-003", "0002-anyfs-ssh-helper FR-004"], `under ${shell}: probe, write, read, stat, list, delete and rename answer as the protocol says`, () =>
    onHost(shell, async (host) => {
      const probe = await h(host, "probe", ["keep"]);
      assertEquals(probe.code, 0);
      assertStringIncludes(probe.stdout, "protocol=1");
      assertStringIncludes(probe.stdout, "dialect=posix");
      assertStringIncludes(probe.stdout, "case=sensitive");
      assertEquals((await h(host, "read", ["a/b.txt", "0"])).code, 10);
      assertEquals(await h(host, "write", ["a/b.txt", "absent", "0"], "hello"), { code: 0, stdout: `created sha256:${HELLO}\n`, stderr: "" });
      const read = await h(host, "read", ["a/b.txt", "0"]);
      assertEquals([read.code, read.stdout], [0, "hello"]);
      const stat = await h(host, "stat", ["a/b.txt"]);
      assertEquals(stat.code, 0);
      assertEquals(stat.stdout.split("\t").filter((_, i) => i !== 1), ["5", `${HELLO}\n`]);
      assertEquals((await h(host, "write", ["a/b.txt", "any", "0"], "hello")).stdout, `updated sha256:${HELLO}\n`);
      assertEquals((await h(host, "write", ["c.txt", "any", "0"], "")).stdout, `created sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\n`);
      assertEquals((await h(host, "list", [""])).stdout.split("\n").filter((l) => l !== "").sort(), ["a/b.txt", "c.txt"]);
      assertEquals((await h(host, "list", ["a"])).stdout, "a/b.txt\n");
      assertEquals((await h(host, "statmany", [], "a/b.txt\nnone.txt\nc.txt\n")).stdout.split("\n").filter((l) => l !== "").map((l) => l.split("\t")[0]), ["a/b.txt", "c.txt"]);
      assertEquals((await h(host, "rename", ["a/b.txt", "d/e.txt", "any"])).stdout, `moved sha256:${HELLO}\n`);
      assertEquals((await h(host, "stat", ["a/b.txt"])).code, 10);
      assertEquals(await fs.exists(path.join(host.root, "a")), false, "the folder a rename emptied is taken away");
      assertEquals((await h(host, "delete", ["d/e.txt", "any"])).stdout, "existed\n");
      assertEquals((await h(host, "delete", ["d/e.txt", "any"])).stdout, "none\n");
      assertEquals(await fs.exists(path.join(host.root, "d")), false);
    }),
  );

  proves(["0002-anyfs-ssh-helper FR-005"], `under ${shell}: an expectation that does not hold is a conflict that says what was found, and nothing is written`, () =>
    onHost(shell, async (host) => {
      await h(host, "write", ["a.txt", "absent", "0"], "hello");
      const again = await h(host, "write", ["a.txt", "absent", "0"], "other");
      assertEquals([again.code, again.stdout], [11, `found sha256:${HELLO}\n`]);
      const wrong = await h(host, "write", ["a.txt", `rev:${"0".repeat(64)}`, "0"], "other");
      assertEquals([wrong.code, wrong.stdout], [11, `found sha256:${HELLO}\n`]);
      const none = await h(host, "write", ["nope.txt", `rev:${HELLO}`, "0"], "x");
      assertEquals([none.code, none.stdout], [11, "found absent\n"]);
      assertEquals((await h(host, "read", ["a.txt", "0"])).stdout, "hello");
      const right = await h(host, "write", ["a.txt", `rev:${HELLO}`, "0"], "second");
      assertEquals(right.code, 0);
      assertEquals((await h(host, "delete", ["a.txt", `rev:${HELLO}`])).code, 11);
      await h(host, "write", ["b.txt", "any", "0"], "b");
      const clash = await h(host, "rename", ["a.txt", "b.txt", "any"]);
      assertEquals([clash.code, clash.stdout.startsWith("found sha256:"), clash.stdout.endsWith(" at to\n")], [11, true, true]);
      const files: { name: string }[] = [];
      for await (const f of fs.readDir(host.root)) files.push(f);
      assertEquals(files.map((f) => f.name).filter((n) => n.startsWith(".anyfs-tmp")), [], "no temporary file is left");
    }),
  );

  proves(["0002-anyfs-ssh-helper FR-006"], `under ${shell}: a name that is not a path of the store, a path outside the folder and a link are refused`, () =>
    onHost(shell, async (host) => {
      for (const bad of ["", "/abs", "a/", "a//b", ".", "..", "../x", "a/../b", "a/./b", "x\ny"]) {
        const r = await h(host, "stat", [bad]);
        assertEquals([r.code, r.stdout], [12, "shape\n"], JSON.stringify(bad));
      }
      assertEquals((await h(host, "stat", [".anyfs-x"])).stdout, "hidden\n");
      assertEquals((await h(host, "stat", ["a/.anyfs-x"])).stdout, "hidden\n");
      const outside = await fs.makeTempDir({ prefix: "anyfs-outside-" });
      try {
        await fs.writeTextFile(path.join(outside, "secret.txt"), "secret");
        await fs.symlink(outside, path.join(host.root, "escape"));
        await fs.symlink(path.join(outside, "secret.txt"), path.join(host.root, "link.txt"));
        for (const args of [["escape/secret.txt"], ["link.txt"], ["escape/new.txt"]]) {
          const r = await h(host, "stat", args);
          assertEquals([r.code, r.stdout], [12, "outside\n"], args.join());
        }
        assertEquals((await h(host, "write", ["escape/new.txt", "any", "0"], "x")).code, 12);
        assertEquals((await h(host, "read", ["link.txt", "0"])).code, 12);
        assertEquals((await h(host, "delete", ["link.txt", "any"])).code, 12);
        assertEquals(await fs.exists(path.join(outside, "new.txt")), false);
        assertEquals(await fs.readTextFile(path.join(outside, "secret.txt")), "secret");
        assertEquals((await h(host, "list", [""])).stdout, "", "a link is not an object");
      } finally {
        await fs.remove(outside, { recursive: true });
      }
      await h(host, "write", ["f", "any", "0"], "x");
      assertEquals((await h(host, "write", ["f/g", "any", "0"], "x")).stdout, "notdir\n");
      await fs.mkdir(path.join(host.root, "dir"));
      assertEquals((await h(host, "write", ["dir", "any", "0"], "x")).stdout, "notfile\n");
    }),
  );

  proves(["0002-anyfs-ssh-helper FR-007"], `under ${shell}: names with spaces, quotes, dollar signs, a leading dash and non-ASCII letters are kept as they are`, () =>
    onHost(shell, async (host) => {
      const names = ["a b/c d.txt", "it's", 'say "x"', "$(touch pwned)", "`touch pwned`", "-rf", "--help", "é/ü ö", "a;b|c&d", "*", "~", "{a,b}"];
      for (const n of names) assertEquals((await h(host, "write", [n, "any", "0"], `body of ${n}`)).code, 0, n);
      assertEquals((await h(host, "list", [""])).stdout.split("\n").filter((l) => l !== "").sort(), [...names].sort());
      for (const n of names) assertEquals((await h(host, "read", [n, "0"])).stdout, `body of ${n}`, n);
      assertEquals(await fs.exists(path.join(host.root, "pwned")), false);
      assertEquals(await fs.exists(path.join(process.cwd(), "pwned")), false);
    }),
  );

  proves(["0002-anyfs-ssh-helper FR-008"], `under ${shell}: of many writers that expect the same revision exactly one wins`, () =>
    onHost(shell, async (host) => {
      await h(host, "write", ["race.txt", "any", "0"], "hello");
      const results = await Promise.all(Array.from({ length: 8 }, (_, i) => h(host, "write", ["race.txt", `rev:${HELLO}`, "0"], `writer ${i}`)));
      assertEquals(results.filter((r) => r.code === 0).length, 1, results.map((r) => r.code).join());
      assertEquals(results.filter((r) => r.code === 11).length, 7);
      const racers = await Promise.all(Array.from({ length: 8 }, (_, i) => h(host, "write", ["fresh.txt", "absent", "0"], `writer ${i}`)));
      assertEquals(racers.filter((r) => r.code === 0).length, 1);
      assertEquals(racers.filter((r) => r.code === 11).length, 7);
    }),
  );
}

proves(["0002-anyfs-ssh-helper FR-008"], "a lock that belongs to a process that is gone is taken over, and one that is alive is waited for", () =>
  onHost(undefined, async (host) => {
    await h(host, "write", ["x.txt", "any", "0"], "hello");
    const dead = await proc.output(["sh", "-c", "echo $$"]);
    const pid = new TextDecoder().decode(dead.stdout).trim();
    const key = await sha256("x.txt");
    const lock = path.join(host.root, ".anyfs-locks", `${key}.d`);
    await fs.mkdir(lock, { recursive: true });
    await fs.writeTextFile(path.join(lock, "pid"), `${pid}\n`);
    const taken = await h(host, "write", ["x.txt", `rev:${HELLO}`, "0"], "after the dead one");
    assertEquals(taken.code, 0, taken.stdout + taken.stderr);
    assertEquals(await fs.exists(lock), false, "the lock is released");
    // a live holder: this process
    await fs.mkdir(lock, { recursive: true });
    await fs.writeTextFile(path.join(lock, "pid"), `${proc.pid}\n`);
    const started = Date.now();
    const racing = h(host, "write", ["x.txt", `rev:${await sha256("after the dead one")}`, "0"], "waits");
    await new Promise((r) => setTimeout(r, 400));
    await fs.remove(lock, { recursive: true });
    const done = await racing;
    assertEquals(done.code, 0);
    assert(Date.now() - started >= 300, "the writer waited for the holder");
  }),
);

proves(["0002-anyfs-ssh-helper FR-009"], "a read of more than the most it is told is refused, and a write of more is refused with nothing kept", () =>
  onHost(undefined, async (host) => {
    await h(host, "write", ["big", "any", "0"], "0123456789");
    assertEquals((await h(host, "read", ["big", "5"])).code, 14);
    assertEquals((await h(host, "read", ["big", "10"])).stdout, "0123456789");
    assertEquals((await h(host, "write", ["big2", "any", "4"], "0123456789")).code, 14);
    assertEquals((await h(host, "stat", ["big2"])).code, 10);
  }),
);

proves(["0002-anyfs-ssh-helper FR-010"], "the helper is kept on a host under a name that carries its hash, once, and a script that does not have the hash is refused", () =>
  onHost(undefined, async (host) => {
    const dir = path.join(host.home, "state");
    const first = await h(host, "install", [POSIX_HELPER_SHA256, dir], POSIX_HELPER);
    assertEquals(first.code, 0);
    assertEquals(first.stdout, path.join(dir, `helper-${POSIX_HELPER_SHA256}.sh`));
    assertEquals(await fs.readTextFile(first.stdout), POSIX_HELPER);
    assertEquals((await fs.stat(first.stdout)).mode !== null && ((await fs.stat(first.stdout)).mode ?? 0) & 0o222, 0, "it is not writable");
    assertEquals((await h(host, "install", [POSIX_HELPER_SHA256, dir], "")).stdout, first.stdout, "kept already: nothing is read");
    const wrong = await h(host, "install", ["0".repeat(64), dir], "echo not the helper");
    assertEquals([wrong.code, wrong.stdout.startsWith("hash ")], [30, true]);
    assertEquals(await fs.exists(path.join(dir, `helper-${"0".repeat(64)}.sh`)), false);
    const viaDefault = await h(host, "install", [POSIX_HELPER_SHA256, "default"], POSIX_HELPER);
    assertEquals(viaDefault.stdout, path.join(host.home, ".local/state/anyfs", `helper-${POSIX_HELPER_SHA256}.sh`));
  }),
);

proves(["0002-anyfs-ssh-helper FR-006"], "a store at the root of the host's file system reads what is below it and keeps its locks in the account's own folder", async () => {
  await fs.withTempDir(async (home) => {
    const run = (command: string, ...args: readonly string[]) => proc.run(["/bin/sh", "-c", POSIX_HELPER, "anyfs-helper", command, "/", ...args], { env: { PATH: "/usr/bin:/bin", HOME: home, LC_ALL: "C" }, clearEnv: true, stdin: "null" });
    await fs.writeTextFile(path.join(home, "kept.txt"), "kept\n");
    const stat = await run("stat", `${home.slice(1)}/kept.txt`);
    assertEquals(stat.code, 0, stat.stderr);
    const outside = await run("stat", `${home.slice(1)}/../kept.txt`);
    assertEquals(outside.code, 12);
    assertEquals(await fs.exists("/.anyfs-locks"), false);
  });
});
