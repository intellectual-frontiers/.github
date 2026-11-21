/**
 * Tests of the structure of the SQL stores (commons anyfs-sql 0001-sql-layers FR-001, FR-002): the manifest names a plugin of the family of AnyFS with the exports the package has, the governance layer does no
 * input or output, and no statement is made by putting a value into text.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { library } from "../library.ts";
import * as governance from "../src/governance/mod.ts";
import * as physical from "../src/physical/mod.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

async function sources(folder: string): Promise<readonly { readonly file: string; readonly text: string }[]> {
  const out: { file: string; text: string }[] = [];
  for await (const e of fs.readDir(path.join(ROOT, folder))) {
    const full = path.join(folder, e.name);
    if (e.isDirectory) out.push(...(await sources(full)));
    else if (e.name.endsWith(".ts")) out.push({ file: full, text: await fs.readTextFile(path.join(ROOT, full)) });
  }
  return out;
}

proves(["0001-sql-layers FR-001"], "the manifest is a plugin of the family of AnyFS whose exports are the ones of the package, and the layers are governance and physical", async () => {
  assertEquals(library.family, { host: "anyfs", role: "plugin" });
  assertEquals(library.kanon.extends, "@intellectual-frontiers/anyfs");
  assertEquals(library.distribution, ["github"]);
  assert(library.held.kind === "unfinished" && library.held.reason !== "");
  const manifest = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string> };
  assertEquals([...library.exports].sort(), Object.keys(manifest.exports).sort());
  assert(Object.keys(governance).includes("parseNaming") && Object.keys(physical).includes("openSqlStore") && Object.keys(physical).includes("migrate"));
  assertEquals(library.kanon.units.filter((u) => "layer" in u).map((u) => ("layer" in u ? u.layer : "")), ["governance", "physical"]);
});

proves(["0001-sql-layers FR-002"], "no source of the governance layer reaches a file, a network or a process", async () => {
  const forbidden = /from "node:|from "@intellectual-frontiers\/(system|net)|\bBun\.|\bDeno\.|\bfetch\(|\bprocess\.(env|exit)/;
  const files = await sources("src/governance");
  assert(files.length >= 5, "the sources are read");
  for (const f of files) assertEquals(forbidden.test(f.text), false, `${f.file} does input or output`);
});

proves(["0001-sql-layers FR-002"], "no source of the physical layer makes the text of a statement by putting a value into it: a template literal with a keyword of a statement and a variable is only in the builder and in the migrations, which write names", async () => {
  const files = await sources("src/physical");
  assert(files.length >= 8, "the sources are read");
  const statementWithVariable = /`[^`\n]*\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b[^`\n]*\$\{/u;
  for (const f of files) {
    if (f.file.endsWith("schema.ts") || f.file.endsWith("sql.ts")) continue;
    assertEquals(statementWithVariable.test(f.text), false, `${f.file} makes a statement from a value`);
  }
  // the builder puts a value into text only as a placeholder: its one template literal with a keyword is the name of a column
  const builder = files.find((f) => f.file.endsWith("physical/sql.ts"));
  assert(builder !== undefined);
  assertEquals(/(?<!\* .*)`[^`\n]*\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b[^`\n]*`/u.test(builder.text.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("/**")).join("\n")), false);
});
