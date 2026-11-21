/**
 * Tests of the structure of the Git stores (commons anyfs-git 0001-git-layers FR-001, FR-002): the manifest names a plugin of the family of AnyFS with the exports the package has, the governance layer does no
 * input or output, and a commit is made with no signature and no hook whatever the repository's configuration says.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { expectAny } from "@intellectual-frontiers/anyfs/governance";
import { library } from "../library.ts";
import * as governance from "../src/governance/mod.ts";
import * as physical from "../src/physical/mod.ts";
import { bytes, fs as tfs, git, osPath, p, refIn, withRepo } from "./kit.ts";

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

proves(["0001-git-layers FR-001"], "the manifest is a plugin of the family of AnyFS whose exports are the ones of the package, and the layers are governance and physical", async () => {
  assertEquals(library.family, { host: "anyfs", role: "plugin" });
  assertEquals(library.kanon.extends, "@intellectual-frontiers/anyfs");
  const manifest = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string> };
  assertEquals([...library.exports].sort(), Object.keys(manifest.exports).sort());
  assert(Object.keys(governance).includes("parseIdentity") && Object.keys(physical).includes("gitRefStore") && Object.keys(physical).includes("gitWorktreeStore"));
  assertEquals(library.kanon.units.filter((u) => "layer" in u).map((u) => ("layer" in u ? u.layer : "")), ["governance", "physical"]);
});

proves(["0001-git-layers FR-002"], "no source of the governance layer reaches a file, a network or a process, and Git is run in one function of the physical layer", async () => {
  const forbidden = /from "node:|from "@intellectual-frontiers\/(system|net)|\bBun\.|\bDeno\.|\bfetch\(|\bprocess\.(env|exit)/;
  const files = await sources("src/governance");
  assert(files.length >= 3, "the sources are read");
  for (const f of files) assertEquals(forbidden.test(f.text), false, `${f.file} does input or output`);
  // Git is started in git.ts alone: no other source names a program to run
  for (const f of await sources("src/physical")) {
    if (f.file.endsWith("git.ts")) continue;
    assertEquals(/proc\.(run|output|must|spawn)\(/.test(f.text), false, `${f.file} starts a program`);
  }
});

proves(["0001-git-layers FR-002"], "a commit is made with no signature and no hook, whatever the configuration of the repository says", async () => {
  await withRepo("worktree", async (dir) => {
    // the repository asks for signing with a program that does not exist, and has a hook that would leave a mark
    await git(dir, "config", "commit.gpgsign", "true");
    await git(dir, "config", "gpg.program", "/nonexistent/gpg");
    const mark = osPath.join(dir, "hook-ran");
    const hook = osPath.join(dir, ".git", "hooks", "reference-transaction");
    await tfs.writeTextFile(hook, `#!/bin/sh\ntouch ${JSON.stringify(mark)}\n`, { mode: 0o755 });
    const ref = await refIn(dir);
    const w = await ref.store.write(p("a"), bytes("1"), expectAny);
    assertEquals(w.kind, "ok");
    assertEquals(await tfs.exists(mark), false, "no hook ran");
    assertEquals((await git(dir, "cat-file", "-p", "fleet")).includes("gpgsig"), false);
  });
});
