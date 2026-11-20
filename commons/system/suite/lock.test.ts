/**
 * Tests of `lock` (commons 0001-system FR-015): a lock taken, refused, waited for, taken over from a holder that no longer runs, inherited and released.
 *
 * @module
 */
import { exists, readTextFile, withTempDir, writeTextFile } from "../src/fs.ts";
import { acquireLock, describeHolder, processRuns, readHolder } from "../src/lock.ts";
import { join } from "../src/path.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import process from "node:process";

const LOCK = "0001-system FR-015";

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
