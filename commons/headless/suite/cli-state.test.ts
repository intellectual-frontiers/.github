/**
 * Tests of `surfaces/cli/state.ts` and of the store that binds it to the file system: where the state is kept, the run log and its pruning after 30 days, the newest
 * log, and the memory of hints (commons headless 0004-headless-cli FR-007, FR-008, FR-014). The pruning is the behaviour of stolos's 019-output FR-002; it is run on
 * a real folder here as well as on the store in memory.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { fsStore } from "../src/surfaces/cli/host.ts";
import {
  dueHints,
  hintsFileOf,
  lastLog,
  logDirOf,
  logName,
  pruneLogs,
  readHints,
  RunLog,
  RUN_LOG_DAYS,
  stateDirOf,
  writeHints,
} from "../src/surfaces/cli/state.ts";
import { memoryStore } from "./world.ts";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 10, 56, 11);
const env = (vars: Record<string, string>) => (n: string): string | undefined => vars[n];

proves(["0004-headless-cli FR-014"], "the folder of state is the system's: XDG on Linux and macOS, the known folders on Windows, and none where there is no home", () => {
  assertEquals(stateDirOf("tool", env({ HOME: "/home/a" }), "linux"), "/home/a/.local/state/tool");
  assertEquals(stateDirOf("tool", env({ HOME: "/home/a", XDG_STATE_HOME: "/x" }), "linux"), "/x/tool");
  assertEquals(stateDirOf("tool", env({ HOME: "/Users/a" }), "darwin"), "/Users/a/.local/state/tool");
  assertEquals(stateDirOf("tool", env({ LOCALAPPDATA: "C:\\L" }), "windows"), "C:\\L\\tool\\state");
  assertEquals(stateDirOf("tool", env({ HOME: "/h", XDG_STATE_HOME: "relative" }), "linux"), "/h/.local/state/tool", "a variable that is not absolute is ignored");
  assertEquals(stateDirOf("tool", env({}), "linux"), undefined);
  assertEquals(logDirOf("/s", "linux"), "/s/log");
  assertEquals(hintsFileOf("/s", "linux"), "/s/hints.json");
  assertEquals(logDirOf("C:\\s", "windows"), "C:\\s\\log");
  assertEquals(hintsFileOf("C:\\s", "windows"), "C:\\s\\hints.json");
});

proves(["0004-headless-cli FR-007"], "a log is named by its time and process, and every line of it has its time, its kind and its number", () => {
  assertEquals(logName(NOW, 42), "20261120T105611-42.log");
  assertEquals(logName(0, 1), "19700101T000000-1.log");
  const store = memoryStore();
  let t = NOW;
  const log = new RunLog(store, "/s/log/a.log", () => t);
  assertEquals(log.write("run", "start"), 1);
  t += 1500;
  assertEquals(log.write("problem", "two\nlines"), 2);
  assertEquals(store.files.get("/s/log/a.log")?.text, "2026-11-20T10:56:11.000Z run      start\n2026-11-20T10:56:12.500Z problem  two\\nlines\n");
  fc.assert(
    fc.property(fc.array(fc.string(), { maxLength: 6 }), (texts) => {
      const s = memoryStore();
      const l = new RunLog(s, "/x.log", () => NOW);
      texts.forEach((x, i) => assertEquals(l.write("item", x), i + 1));
      assertEquals((s.files.get("/x.log")?.text ?? "").split("\n").length - 1, texts.length, "one line for each write, whatever the text");
    }),
  );
});

proves(["0004-headless-cli FR-007"], "logs older than 30 days are pruned, and nothing else; the newest log is found by its time", () => {
  assertEquals(RUN_LOG_DAYS, 30);
  const store = memoryStore();
  const put = (name: string, ageDays: number) => store.files.set(`/s/log/${name}`, { text: "x", mtimeMs: NOW - ageDays * DAY });
  put("old.log", 31);
  put("edge.log", 30);
  put("fresh.log", 1);
  put("notes.txt", 99);
  store.files.set("/s/log/unknown.log", { text: "x", mtimeMs: undefined as unknown as number });
  const gone = pruneLogs(store, "/s/log", "linux", NOW);
  assertEquals(gone, ["old.log"]);
  assertEquals([...store.files.keys()].sort(), ["/s/log/edge.log", "/s/log/fresh.log", "/s/log/notes.txt", "/s/log/unknown.log"]);
  assertEquals(lastLog(store, "/s/log", "linux"), "/s/log/fresh.log");
  assertEquals(lastLog(memoryStore(), "/s/log", "linux"), undefined);
  assertEquals(pruneLogs(memoryStore(), "/nowhere", "linux", NOW), []);
  fc.assert(
    fc.property(fc.array(fc.integer({ min: 0, max: 90 }), { maxLength: 8 }), (ages) => {
      const s = memoryStore();
      ages.forEach((a, i) => s.files.set(`/l/${i}.log`, { text: "", mtimeMs: NOW - a * DAY }));
      pruneLogs(s, "/l", "linux", NOW);
      assertEquals([...s.files.keys()].length, ages.filter((a) => a <= 30).length);
    }),
  );
});

proves(["0004-headless-cli FR-007"], "the file system's store makes folders, appends, lists files with their time, removes, and never throws; the pruning works on a real folder", async () => {
  await fs.withTempDir(async (dir) => {
    const store = fsStore();
    const file = path.join(dir, "deep", "er", "a.log");
    store.appendText(file, "one\n");
    store.appendText(file, "two\n");
    assertEquals(store.readText(file), "one\ntwo\n");
    store.writeText(path.join(dir, "deep", "er", "h.json"), "{}");
    assertEquals(store.list(path.join(dir, "deep", "er")).map((f) => f.name).sort(), ["a.log", "h.json"]);
    assert(store.list(path.join(dir, "deep")).length === 0, "a folder is not a file");
    assertEquals(store.list(path.join(dir, "nowhere")), []);
    assertEquals(store.readText(path.join(dir, "nowhere")), undefined);
    const logs = path.join(dir, "deep", "er");
    const old = path.join(logs, "old.log");
    store.writeText(old, "x");
    await fs.utime(old, new Date(NOW - 40 * DAY), new Date(NOW - 40 * DAY));
    assertEquals(pruneLogs(store, logs, "linux", NOW), ["old.log"]);
    assertEquals(store.readText(old), undefined);
    store.remove(old);
    // a path that cannot be written is lost, and nothing is thrown
    store.writeText(path.join(file, "below-a-file", "x"), "x");
    store.appendText(path.join(file, "below-a-file", "x"), "x");
    store.remove(path.join(dir, "never-there"));
  });
});

proves(["0004-headless-cli FR-008"], "the hints' memory is read as nothing where it is missing or wrong, written as read, and due hints are written once they are shown", () => {
  const store = memoryStore();
  assertEquals(readHints(store, "/h.json"), {});
  store.files.set("/h.json", { text: "not json", mtimeMs: 0 });
  assertEquals(readHints(store, "/h.json"), {});
  for (const bad of ["[]", "null", "7", '"x"']) {
    store.files.set("/h.json", { text: bad, mtimeMs: 0 });
    assertEquals(readHints(store, "/h.json"), {}, bad);
  }
  store.files.set("/h.json", { text: '{"a":5,"b":"x","c":null}', mtimeMs: 0 });
  assertEquals(readHints(store, "/h.json"), { a: 5 });
  writeHints(store, "/h.json", { x: 1, y: 2 });
  assertEquals(readHints(store, "/h.json"), { x: 1, y: 2 });
  const fresh = memoryStore();
  const hints = [{ id: "a", message: "A" }, { id: "a", message: "A again" }, { id: "b", message: "B" }];
  assertEquals(dueHints(fresh, "/h.json", hints, 10).map((h) => h.id), ["a", "b"]);
  assertEquals(readHints(fresh, "/h.json"), { a: 10, b: 10 });
  const writes = fresh.writes;
  assertEquals(dueHints(fresh, "/h.json", hints, 11), []);
  assertEquals(fresh.writes, writes, "nothing is written where nothing is shown");
  assertEquals(dueHints(undefined, "/h.json", hints, 10).map((h) => h.id), ["a", "b"]);
  assertEquals(dueHints(fresh, undefined, hints, 10).map((h) => h.id), ["a", "b"]);
});
