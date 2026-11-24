/**
 * The writer the multi-process test starts twice: it opens one SQLite file, writes some objects of its own, and tries to be the one that makes `race`, then prints what happened as one line of JSON.
 *
 * ```sh
 * bun suite/child-writer.ts FILE ID COUNT
 * ```
 *
 * @module
 */
import { expectAbsent, expectAny, parsePath } from "@intellectual-frontiers/anyfs/governance";
import { proc } from "@intellectual-frontiers/system";
import { openSqlStore } from "../src/mod.ts";
import { openSqliteFile } from "../src/physical/adapters/sqlite.ts";

const [file, id, count] = proc.args;
if (file === undefined || id === undefined || count === undefined) throw new Error("usage: child-writer FILE ID COUNT");
const path = (t: string): ReturnType<typeof parsePath> extends { value: infer V } ? V : never => {
  const r = parsePath(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value as never;
};
const port = await openSqliteFile(file, { busyMs: 20_000 });
if (port.kind === "err") throw new Error(port.error);
const opened = await openSqlStore(port.value);
if (opened.kind === "err") throw new Error(opened.error);
const store = opened.value.store;
let wrote = 0;
let failed = 0;
for (let i = 0; i < Number(count); i++) {
  const r = await store.write(path(`own/${id}/${i}`), new TextEncoder().encode(`${id} ${i}`), expectAny);
  if (r.kind === "ok") wrote++;
  else failed++;
}
const race = await store.write(path("race"), new TextEncoder().encode(id), expectAbsent);
console.log(JSON.stringify({ id, wrote, failed, won: race.kind === "ok", raceKind: race.kind === "err" ? race.error.kind : "ok" }));
await port.value.close();
