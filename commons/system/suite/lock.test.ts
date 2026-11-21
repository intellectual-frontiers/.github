/**
 * Tests of `lock` (commons 0001-system FR-015): a lock taken, refused, waited for, taken over from a holder that no longer runs, inherited and released.
 *
 * @module
 */
import { exists, readTextFile, utime, withTempDir, writeTextFile } from "../src/fs.ts";
import { acquireLock, describeHolder, processRuns, readHolder } from "../src/lock.ts";
import { sleep } from "../src/proc.ts";
import { join } from "../src/path.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import process from "node:process";

const LOCK = "0001-system FR-015";

/** Whether the text of a lock file is the whole of a holder. */
function wholeHolder(text: string): boolean {
  try {
    const h = JSON.parse(text) as { pid?: unknown; token?: unknown };
    return typeof h.pid === "number" && typeof h.token === "string";
  } catch {
    return false;
  }
}

proves([LOCK], "a lock is taken once, refused or waited for while held, and given back", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "run.lock");
    const held = await acquireLock(path, { wait: false, command: "update" });
    assert(held !== undefined);
    const holder = await readHolder(path);
    assertEquals([holder?.pid, holder?.command], [process.pid, "update"]);
    assertStringIncludes(describeHolder(held.holder, Date.parse(held.holder.since) + 192_000), "update (pid ");
    assertStringIncludes(describeHolder(held.holder, Date.parse(held.holder.since) + 192_000), "for 3m 12s)");
    assertEquals(await acquireLock(path, { wait: false }), undefined);
    assertEquals(await acquireLock(path, { wait: true, pollMs: 10, timeoutMs: 50 }), undefined);
    let waitedFor = "";
    const waiting = acquireLock(path, { wait: true, pollMs: 10, onWait: (h) => (waitedFor = h?.command ?? "") });
    setTimeout(() => held.release(), 60);
    const second = await waiting;
    assert(second !== undefined);
    assertEquals(waitedFor, "update");
    second.release();
    second.release();
    assert(!(await exists(path)));
  });
});

proves([LOCK], "a lock whose holder no longer runs, or whose file is unreadable, is taken over; a child inherits it", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "run.lock");
    let dead = 2_000_000;
    while (processRuns(dead)) dead++;
    await writeTextFile(path, JSON.stringify({ pid: dead, command: "gone", since: new Date().toISOString(), token: "t" }));
    const taken = await acquireLock(path, { wait: false });
    assert(taken !== undefined);
    assertStringIncludes(await readTextFile(path), taken.holder.token);
    taken.release();
    await writeTextFile(path, "not json");
    await utime(path, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
    const again = await acquireLock(path, { wait: false, inheritEnv: "IFC_TS_TEST_LOCK" });
    assert(again !== undefined);
    assertEquals(process.env["IFC_TS_TEST_LOCK"], "1");
    const child = await acquireLock(path, { wait: false, inheritEnv: "IFC_TS_TEST_LOCK" });
    assert(child !== undefined);
    child.release();
    assert(await exists(path), "the inherited release leaves the parent's lock");
    again.release();
    assertEquals(process.env["IFC_TS_TEST_LOCK"], undefined);
    assert(processRuns(process.pid));
  });
});

proves([LOCK], "a lock file that cannot be read yet, because its holder is still writing it, is held and never taken over; once it is old it is abandoned", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "run.lock");
    await writeTextFile(path, "");
    assertEquals(await acquireLock(path, { wait: false }), undefined, "an empty lock file just made is a holder that has not finished");
    assertEquals(await readTextFile(path), "", "and is left as it is");
    assertEquals(await acquireLock(path, { wait: true, pollMs: 5, timeoutMs: 40 }), undefined);
    await utime(path, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
    const taken = await acquireLock(path, { wait: false });
    assert(taken !== undefined, "an empty lock file that has not changed for a minute is abandoned");
    taken.release();
    assert(!(await exists(path)));
    assertEquals((await acquireLock(path, { wait: false, unreadableGraceMs: 0 }))?.holder.pid, process.pid);
  });
});

proves([LOCK], "no lock file is ever seen half made: the holder is whole where the file is, and no leftover file of the making stays", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "run.lock");
    let seenUnreadable = 0;
    let stop = false;
    const watcher = (async () => {
      while (!stop) {
        if (await exists(path)) {
          const text = await readTextFile(path).catch(() => undefined);
          if (text !== undefined && !wholeHolder(text)) seenUnreadable++;
        }
        await sleep(0);
      }
    })();
    for (let i = 0; i < 150; i++) {
      const held = await acquireLock(path, { wait: false });
      assert(held !== undefined);
      held.release();
    }
    stop = true;
    await watcher;
    assertEquals(seenUnreadable, 0);
    const { readdirSync } = await import("node:fs");
    assertEquals(readdirSync(dir), []);
  });
});

proves([LOCK], "contenders in one process take a lock one at a time, and every one of them gets it in turn", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "run.lock");
    let inside = 0;
    let most = 0;
    let done = 0;
    const contender = async (): Promise<void> => {
      for (let round = 0; round < 25; round++) {
        const held = await acquireLock(path, { wait: true, pollMs: 1, command: "contender" });
        assert(held !== undefined);
        inside++;
        most = Math.max(most, inside);
        await sleep(0);
        inside--;
        held.release();
        done++;
      }
    };
    await Promise.all(Array.from({ length: 8 }, contender));
    assertEquals([most, done], [1, 200]);
  });
});

proves([LOCK], "an abandoned lock is removed by one run at a time: a fresh guard of a takeover makes the others wait, and a guard that a dead run left is taken over", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "run.lock");
    let dead = 2_000_000;
    while (processRuns(dead)) dead++;
    await writeTextFile(path, JSON.stringify({ pid: dead, command: "gone", since: new Date().toISOString(), token: "t" }));
    await writeTextFile(`${path}.takeover`, "another run\n");
    assertEquals(await acquireLock(path, { wait: false }), undefined, "another run is taking the abandoned lock over");
    assert(await exists(path), "and the lock is left to it");
    await utime(`${path}.takeover`, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
    const taken = await acquireLock(path, { wait: true, pollMs: 5, timeoutMs: 2000 });
    assert(taken !== undefined, "a guard left by a run that died does not hold the lock for ever");
    taken.release();
    assert(!(await exists(`${path}.takeover`)));
  });
});
