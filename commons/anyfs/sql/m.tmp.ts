import { PGlite } from "@electric-sql/pglite";
const mb = () => Math.round(process.memoryUsage().rss / 1048576);
const mode = process.argv[2];
let tpl: Blob | File | undefined;
if (mode === "tpl") { const f = new PGlite(); await f.waitReady; tpl = await f.dumpDataDir("none"); await f.close(); console.log("after template", mb(), "MB"); }
const keep: PGlite[] = [];
for (let i = 0; i < 5; i++) {
  const db = mode === "tpl" ? new PGlite({ loadDataDir: tpl }) : new PGlite();
  await db.waitReady; keep.push(db);
  console.log(mode, "instance", i + 1, mb(), "MB");
}
