/**
 * Tests of `runtime/watch.ts` (commons 0005-typescript-runtime FR-051) on a real temporary folder: files made, changed, removed and moved,
 * an editor's save as one event, a recursive watch, a watched file, and the ends of a watch (abort signal, `using`, leaving the loop).
 *
 * The platforms report changes late and in their own way (macOS's FSEvents may start a moment after the watch, CI machines are slow), so
 * no test sleeps for a fixed time and hopes: each waits, with a generous deadline, for the event it expects, doing again what should cause
 * it until it comes (a no-op where doing it again would change the meaning).
 *
 * @module
 */
import { errors } from "../src/errors.ts";
import * as fs from "../src/fs.ts";
import { join, toFileUrl } from "../src/path.ts";
import { assert, assertEquals, fail, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { type FsEvent, type FsWatcher, watchFs } from "../src/watch.ts";

const FR = "0001-system FR-016";
const DEBOUNCE = 200;
const DEADLINE = 20_000;
const SLOW = { timeout: 60_000 };

type Waited = { readonly event: FsEvent; readonly seen: readonly FsEvent[] };

/** Events until one satisfies `want`, doing `poke` at the start and every quarter second until it comes; fails at the deadline. */
async function until(w: FsWatcher, want: (e: FsEvent) => boolean, poke: () => void | Promise<void>, ms = DEADLINE): Promise<Waited> {
  const seen: FsEvent[] = [];
  const deadline = Date.now() + ms;
  let next = w.next();
  await poke();
  while (Date.now() < deadline) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = new Promise<"tick">((resolve) => (timer = setTimeout(() => resolve("tick"), 250)));
    const r = await Promise.race([next, tick]);
    clearTimeout(timer);
    if (r === "tick") {
      await poke();
      continue;
    }
    if (r.done === true) break;
    seen.push(r.value);
    if (want(r.value)) return { event: r.value, seen };
    next = w.next();
  }
  return fail(`no awaited event within ${String(ms)} ms; seen: ${JSON.stringify(seen)}`);
}

/** Every event within `ms` from now (the watch is not closed). */
async function during(w: FsWatcher, ms: number): Promise<FsEvent[]> {
  const seen: FsEvent[] = [];
  const end = Date.now() + ms;
  let next = w.next();
  for (;;) {
    const left = end - Date.now();
    if (left <= 0) break;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = new Promise<"tick">((resolve) => (timer = setTimeout(() => resolve("tick"), left)));
    const r = await Promise.race([next, tick]);
    clearTimeout(timer);
    if (r === "tick" || r.done === true) break;
    seen.push(r.value);
    next = w.next();
  }
  return seen;
}

const is =
  (kind: FsEvent["kind"], path: string) =>
  (e: FsEvent): boolean =>
    e.kind === kind && e.paths.includes(path);

const nothing = (): void => undefined;

proves(
  [FR],
  "a folder's files made, changed and removed are create, modify and remove events with their absolute paths",
  async () => {
    await fs.withTempDir(async (dir) => {
      using w = watchFs(dir, { debounceMs: DEBOUNCE });
      const a = join(dir, "a.txt");
      let n = 0;
      const created = await until(w, is("create", a), () => fs.writeTextFile(a, `v${String(n++)}`));
      assertEquals(created.event.paths, [a]);
      let size = 10;
      await until(w, is("modify", a), () => fs.writeTextFile(a, "x".repeat(size++)));
      await fs.remove(a);
      await until(w, is("remove", a), nothing);
    });
  },
  SLOW,
);

proves(
  [FR],
  "an editor's save, a new file renamed over the old one, is one modify event after the join, not three",
  async () => {
    await fs.withTempDir(async (dir) => {
      const y = join(dir, "y.txt");
      await fs.writeTextFile(y, "first");
      using w = watchFs(dir, { debounceMs: DEBOUNCE });
      // Wait until the watch sees changes at all.
      const probe = join(dir, "probe");
      await until(w, is("create", probe), () => fs.writeTextFile(probe, "p"));
      const tmp = join(dir, "y.txt.tmp");
      await fs.writeTextFile(tmp, "second, longer");
      await fs.rename(tmp, y);
      const first = await until(w, (e) => e.paths.includes(y), nothing);
      const after = await during(w, DEBOUNCE * 5);
      const aboutY = [first.event, ...after].filter((e) => e.paths.includes(y));
      assertEquals(aboutY.length, 1, JSON.stringify(aboutY));
      assert(first.event.kind === "modify" || first.event.kind === "rename", first.event.kind);
      assertEquals(await fs.readTextFile(y), "second, longer");
    });
  },
  SLOW,
);

proves(
  [FR],
  "a recursive watch sees a file made in a new folder deep inside, and a file moved is one rename (or a remove and a create)",
  async () => {
    await fs.withTempDir(async (dir) => {
      using w = watchFs(dir, { recursive: true, debounceMs: DEBOUNCE });
      const c = join(dir, "a", "b", "c.txt");
      let n = 0;
      await until(w, is("create", c), async () => {
        await fs.mkdir(join(dir, "a", "b"), { recursive: true });
        await fs.writeTextFile(c, `v${String(n++)}`);
      });
      const d = join(dir, "a", "d.txt");
      await fs.rename(c, d);
      const moved = await until(w, (e) => e.paths.includes(d), nothing);
      const rest = moved.event.kind === "rename" ? [] : await during(w, DEBOUNCE * 5);
      const all = [...moved.seen, ...rest];
      // A rename where the platform gives inodes; otherwise its two halves (FR-018).
      assert(
        all.some((e) => e.kind === "rename" && e.paths[0] === c && e.paths[1] === d) ||
          (all.some(is("remove", c)) && all.some(is("create", d))),
        JSON.stringify(all),
      );
    });
  },
  SLOW,
);

proves(
  [FR],
  "a watch of a folder without recursive does not report what happens deeper; a watched file reports itself alone",
  async () => {
    await fs.withTempDir(async (dir) => {
      await fs.mkdir(join(dir, "sub"));
      const f = join(dir, "f.txt");
      await fs.writeTextFile(f, "0");
      using flat = watchFs(dir, { debounceMs: DEBOUNCE });
      using one = watchFs(f, { debounceMs: DEBOUNCE });
      const deep = join(dir, "sub", "f.txt");
      const top = join(dir, "top.txt");
      // Something deep, then something at the top: the flat watch gives the top one and never the deep one.
      await fs.writeTextFile(deep, "deep");
      const flatSeen = await until(flat, is("create", top), () => fs.writeTextFile(top, "t"));
      assert(!flatSeen.seen.some((e) => e.paths.includes(deep)), JSON.stringify(flatSeen.seen));
      let size = 1;
      const oneSeen = await until(one, is("modify", f), () => fs.writeTextFile(f, "1".repeat(++size)));
      assert(
        oneSeen.seen.every((e) => e.paths.every((x) => x === f)),
        JSON.stringify(oneSeen.seen),
      );
    });
  },
  SLOW,
);

proves(
  [FR],
  "a watch ends by its abort signal, by using, and by leaving the loop; a path that is not there is NotFound",
  async () => {
    await fs.withTempDir(async (dir) => {
      const controller = new AbortController();
      const w = watchFs(dir, { signal: controller.signal });
      const loop = (async (): Promise<number> => {
        let n = 0;
        for await (const _ of w) n++;
        return n;
      })();
      controller.abort();
      assertEquals(await loop, 0);
      assertEquals(await w.next(), { value: undefined, done: true });
      const already = new AbortController();
      already.abort();
      assertEquals(await watchFs(dir, { signal: already.signal }).next(), { value: undefined, done: true });
      let kept: FsWatcher | undefined;
      {
        using u = watchFs(dir);
        kept = u;
      }
      assertEquals(await kept.next(), { value: undefined, done: true });
      {
        await using u = watchFs(toFileUrl(dir));
        kept = u;
      }
      assertEquals(await kept.next(), { value: undefined, done: true });
      const left = watchFs(dir, { debounceMs: DEBOUNCE });
      const f = join(dir, "x.txt");
      let k = 0;
      const writer = setInterval(() => {
        fs.writeTextFile(f, String(k++)).catch(() => undefined);
      }, 200);
      try {
        for await (const e of left) if (e.paths.includes(f)) break;
      } finally {
        clearInterval(writer);
      }
      assertEquals(await left.next(), { value: undefined, done: true });
      try {
        watchFs(join(dir, "none"));
        fail("a watch of nothing was made");
      } catch (e) {
        assert(e instanceof errors.NotFound, String(e));
      }
    });
  },
  SLOW,
);
