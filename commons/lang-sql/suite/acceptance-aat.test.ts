/**
 * The acceptance of sqlfs and sqlfind (commons lang-sql 0011-acceptance FR-007 to FR-009), over a fixture that is made the same way every time: the automated acceptance (three ways of answering each query must agree, with real `find`), the operational
 * acceptance (exit statuses, limits, what cannot be read, hostile values, a large tree) and the user acceptance (scenarios written by hand, and the demos that print them). The `find` of the system is used as it is; where it is not GNU's the BSD flavor
 * is run against it, and the golden files hold the argument lists of both flavors.
 *
 * Spec: 0011-acceptance FR-007, FR-008, FR-009
 *
 * @module
 */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { isOrdered, NOW, queries } from "../acceptance/aat.ts";
import { DEMOS, renderDemos } from "../acceptance/demos.ts";
import { SCENARIOS } from "../acceptance/scenarios.ts";
import { type Entry, entryOf } from "../acceptance/shared/language.ts";
import { makeFixture } from "../acceptance/shared/fixture.ts";
import { diskFs, memoryFs, ownerName } from "../acceptance/shared/walk.ts";
import { command as findCommand } from "../acceptance/sqlfind/main.ts";
import { compileFind, detectFlavor, runFind } from "../acceptance/sqlfind/mod.ts";
import { command as fsCommand } from "../acceptance/sqlfs/main.ts";
import { search } from "../acceptance/sqlfs/mod.ts";

const OWNER = ownerName(process.getuid?.() ?? 0);
const FLAVOR = await detectFlavor();

const keys = (rows: readonly unknown[], ordered: boolean): string[] => {
  const k = rows.map((r) => JSON.stringify(r));
  return ordered ? k : k.sort();
};

proves(["0011-acceptance FR-007"], "for every query of the table, sqlfs over the disk, sqlfs over the entries the fixture is meant to have and sqlfind through the real find give the same rows", async () => {
  const fx = makeFixture();
  try {
    const qs = queries({ owner: OWNER });
    assert(qs.length >= 60, "the table has its queries");
    let nonEmpty = 0;
    for (const q of qs) {
      const disk = await search(diskFs(fx.root), q, { now: NOW });
      const mem = await search(memoryFs(fx.entries), q, { now: NOW });
      assert(disk.kind === "ok" && mem.kind === "ok", q);
      const c = compileFind(q, fx.root, FLAVOR);
      assert(c.kind === "ok", q);
      const found = await runFind(c.value, { now: NOW });
      assert(found.kind === "ok", `${q}: ${found.kind === "err" ? JSON.stringify(found.error) : ""}`);
      const o = isOrdered(q);
      assertEquals(keys(mem.value.rows, o), keys(disk.value.rows, o), `memory against disk: ${q}`);
      assertEquals(keys(found.value.rows, o), keys(disk.value.rows, o), `${FLAVOR} find against disk: ${q}`);
      if (disk.value.rows.length > 0) nonEmpty++;
    }
    assert(nonEmpty >= qs.length - 12, `${nonEmpty} of ${qs.length} queries give rows`);
    // the fixture is what it is meant to be
    const walked: Entry[] = [];
    for await (const e of diskFs(fx.root).walk()) walked.push(e);
    assertEquals(walked, [...fx.entries]);
    assertEquals(fx.entries.length, 30);
    // the entries a symlink and its loop make
    assertEquals(fx.entries.filter((e) => e.kind === "l").map((e) => e.path), ["lib/link.ts", "lib/loop"]);
  } finally {
    fx.cleanup();
  }
});

const status = async (cmd: typeof fsCommand, args: readonly string[]): Promise<number> => (await cmd(args)).code;

proves(["0011-acceptance FR-008"], "each utility exits 0 for a query that runs, 1 for one that is wrong and 2 for a usage error; reports what it cannot read, lists a link that loops and does not follow it, limits depth and rows, leaves a hostile value in its own condition, and searches ten thousand entries in under ten seconds", async () => {
  const fx = makeFixture();
  try {
    for (const cmd of [fsCommand, findCommand]) {
      assertEquals(await status(cmd, ["--root", fx.root, "SELECT path FROM files"]), 0);
      assertEquals(await status(cmd, ["--root", fx.root, "SELECT nope FROM files"]), 1);
      assertEquals(await status(cmd, ["--root", fx.root, "SELEC path"]), 1);
      assertEquals(await status(cmd, ["--root", fx.root]), 2);
      assertEquals(await status(cmd, ["--root", join(fx.root, "missing"), "SELECT path FROM files"]), 2);
      assertEquals(await status(cmd, ["--root", join(fx.root, "README.md"), "SELECT path FROM files"]), 2);
      assertEquals(await status(cmd, ["--max-rows", "x", "SELECT 1 FROM files"]), 2);
      // the depth limit and the row limit apply, and the second is said
      const d = await cmd(["--root", fx.root, "--max-depth", "1", "--format", "paths", "SELECT path FROM files"]);
      assertEquals(d.out.split("\n").sort().join(","), ".hidden,README.md,docs,empty,lib,src");
      const r = await cmd(["--root", fx.root, "--max-rows", "4", "--format", "paths", "SELECT path FROM files ORDER BY path"]);
      assertEquals(r.out.split("\n").length, 4);
      assert(r.err.includes("only 4 rows are given"));
      const dflt = await cmd(["--root", fx.root, "--format", "json", "SELECT path FROM files"]);
      assertEquals((JSON.parse(dflt.out) as unknown[]).length, 30);
      // a link that loops is listed and not followed
      const l = await cmd(["--root", fx.root, "--format", "paths", "SELECT path FROM files WHERE kind = 'l' ORDER BY path"]);
      assertEquals(l.out, "lib/link.ts\nlib/loop");
      assertEquals((await cmd(["--root", fx.root, "--format", "paths", "SELECT path FROM files WHERE path GLOB 'lib/loop/*'"])).out, "");
      // a hostile value changes only its own condition
      const count = async (): Promise<number> => {
        let n = 0;
        for await (const _e of diskFs(fx.root).walk()) n++;
        return n;
      };
      const before = await count();
      for (const h of ["x'; -exec rm -rf / ;'", "'; DROP TABLE files; --", "-delete", "$(touch /tmp/pwned-by-sqlfs)"]) {
        const q = `SELECT path FROM files WHERE name = '${h.replace(/'/g, "''")}' OR path LIKE '${h.replace(/'/g, "''")}'`;
        const out = await cmd(["--root", fx.root, "--format", "paths", q]);
        assertEquals([out.code, out.out], [0, ""], q);
      }
      assertEquals(await count(), before);
      assert(!existsSync("/tmp/pwned-by-sqlfs"));
    }
    // what cannot be read is reported and the run goes on
    const flaky = {
      async *walk(o?: { readonly warn?: (m: string) => void }) {
        yield entryOf("a.txt", "f", 1, 1, 0o644, "me");
        o?.warn?.("cannot read secret: permission denied");
        yield entryOf("b.txt", "f", 1, 1, 0o644, "me");
      },
    };
    const warned: string[] = [];
    const s = await search(flaky, "SELECT path FROM files", { warn: (m) => warned.push(m) });
    assert(s.kind === "ok" && s.value.rows.length === 2 && warned.length === 1);
    const partial = compileFind("SELECT path FROM files", fx.root, "gnu");
    assert(partial.kind === "ok");
    const w: string[] = [];
    const out = await runFind(partial.value, {
      warn: (m) => w.push(m),
      exec: () => Promise.resolve({ code: 1, stdout: Buffer.from(["a.txt", "f", "1", "1", "644", "me"].join("\u0000") + "\u0000"), stderr: "find: './secret': Permission denied\n" }),
    });
    assert(out.kind === "ok" && out.value.rows.length === 1 && w[0] === "find: './secret': Permission denied");
    const failed = await runFind(partial.value, { exec: () => Promise.resolve({ code: 1, stdout: Buffer.alloc(0), stderr: "find: unknown predicate `-bogus'\n" }) });
    assert(failed.kind === "err" && failed.error[0]?.message === "find: unknown predicate `-bogus'");
    if (process.getuid?.() !== 0) {
      const dir = join(fx.root, "locked");
      mkdirSync(dir);
      writeFileSync(join(dir, "x.txt"), "x");
      chmodSync(dir, 0o000);
      try {
        const real: string[] = [];
        const r = await search(diskFs(fx.root), "SELECT path FROM files WHERE depth = 1", { warn: (m) => real.push(m) });
        assert(r.kind === "ok" && r.value.rows.length > 0);
        const all = await search(diskFs(fx.root), "SELECT path FROM files", { warn: (m) => real.push(m) });
        assert(all.kind === "ok" && real.some((m) => m.startsWith("cannot read locked")));
      } finally {
        chmodSync(dir, 0o755);
      }
    }
  } finally {
    fx.cleanup();
  }
  // ten thousand entries
  const big = mkdtempSync(join(tmpdir(), "sqlfs-big-"));
  try {
    for (let d = 0; d < 100; d++) {
      mkdirSync(join(big, `d${d}`));
      for (let f = 0; f < 99; f++) writeFileSync(join(big, `d${d}`, `f${f}.${f % 3 === 0 ? "txt" : "log"}`), "x".repeat(f));
    }
    const q = "SELECT path FROM files WHERE ext = 'txt' AND size > 10 ORDER BY path LIMIT 20";
    const t0 = Date.now();
    const a = await search(diskFs(big), q);
    const t1 = Date.now();
    const c = compileFind(q, big, FLAVOR);
    assert(a.kind === "ok" && c.kind === "ok");
    const f = await runFind(c.value);
    const t2 = Date.now();
    assert(f.kind === "ok");
    assertEquals(f.value.rows, a.value.rows);
    assertEquals(a.value.rows.length, 20);
    assert(t1 - t0 < 10000, `sqlfs took ${t1 - t0} ms`);
    assert(t2 - t1 < 10000, `sqlfind took ${t2 - t1} ms`);
  } finally {
    rmSync(big, { recursive: true, force: true });
  }
}, { timeout: 60_000 });

proves(["0011-acceptance FR-009"], "the scenarios are answered as written by hand by both utilities, and the demo files are what the utilities print", async () => {
  const fx = makeFixture();
  try {
    assert(SCENARIOS.length >= 10);
    for (const s of SCENARIOS) {
      const a = await search(diskFs(fx.root), s.query, { now: NOW });
      assert(a.kind === "ok", s.say);
      assertEquals(a.value.rows.map((r) => String(Object.values(r)[0])), [...s.expect], `sqlfs: ${s.say}`);
      const c = compileFind(s.query, fx.root, FLAVOR);
      assert(c.kind === "ok", s.say);
      const f = await runFind(c.value, { now: NOW });
      assert(f.kind === "ok", s.say);
      assertEquals(f.value.rows.map((r) => String(Object.values(r)[0])), [...s.expect], `sqlfind: ${s.say}`);
    }
  } finally {
    fx.cleanup();
  }
  const demos = await renderDemos();
  assertEquals(Object.keys(demos).length, SCENARIOS.length + 2);
  for (const [name, text] of Object.entries(demos)) assertEquals(readFileSync(join(DEMOS, name), "utf8"), text, `${name} is stale: run bun acceptance/demos.ts`);
  assertEquals(readdirSync(DEMOS).sort(), Object.keys(demos).sort(), "no demo file is left over");
});
