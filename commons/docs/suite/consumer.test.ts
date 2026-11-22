/**
 * A repository that is not commons builds its site with the package (commons 0001-docs FR-005, FR-006): the packed package is installed into an empty project beside a small repository (a spec kit in the plain layout and a
 * `docs.config.ts` that imports the package by its name), `ifc-docs build` and `ifc-docs check` give no finding, every page is a static file with relative links that asks nothing of another host, and a repository at another
 * address, on another branch, has links to that address and names no other host.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { consumableDocs, DOCS } from "./packed.ts";

const FIXTURE = path.join(DOCS, "suite/fixture-repo");
const ADDRESS = "https://git.example.internal/team/private-repo";

/** Every file under a folder, as a path from it. */
async function filesOf(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (rel: string): Promise<void> => {
    for await (const e of fs.readDir(path.join(dir, rel))) {
      const child = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory) await walk(child);
      else out.push(child);
    }
  };
  await walk("");
  return out.sort();
}

proves(["0001-docs FR-005", "0001-docs FR-006"], "the packed package installed into an empty project builds and checks a small repository at a private address, with relative links, no other host and the links to files made from the configuration", async () => {
  const packed = await consumableDocs();
  assert(packed.tarball.endsWith(".tgz"), "a tarball");
  const project = await fs.makeTempDir({ prefix: "docs-consumer-" });
  // the small repository: the fixture's sources and specifications, and a configuration that imports the package by its name
  for (const f of await filesOf(FIXTURE)) {
    if (f === "docs.config.ts") continue;
    await fs.mkdir(path.dirname(path.join(project, f)), { recursive: true });
    await fs.copyFile(path.join(FIXTURE, f), path.join(project, f));
  }
  const config = (await fs.readTextFile(path.join(FIXTURE, "docs.config.ts")))
    .replace('repository: "https://github.com/example/fixture",', `repository: "${ADDRESS}",\n  branch: "trunk",`)
    .replace(/\n {4}linked: \[[^\]]*\],/, "")
    .replace('from "@intellectual-frontiers/docs"', `from "${packed.importName}"`);
  await fs.writeTextFile(path.join(project, "docs.config.ts"), config);
  await fs.writeTextFile(path.join(project, "package.json"), `${JSON.stringify({ name: "consumer", private: true, type: "module", dependencies: { [packed.packageName]: `file:${packed.tarball}`, typescript: "7.1.0-beta", shiki: "4.5.0", "beautiful-mermaid": "1.1.3" } }, null, 2)}\n`);
  // the package installs none of what Docs loads (commons 0036-distribution FR-023): the consumer that builds a site installs the compiler, the highlighter and the diagram renderer beside it
  const installed = await proc.run(["bun", "install"], { cwd: project });
  assertEquals(installed.code, 0, installed.stderr);
  const command = path.join(project, "node_modules", packed.packageName, packed.command);
  const built = await proc.run(["bun", command, "build", "--out", "site"], { cwd: project });
  assertEquals(built.code, 0, `${built.stdout}${built.stderr}`);
  const checked = await proc.run(["bun", command, "check"], { cwd: project });
  assertEquals(checked.code, 0, `${checked.stdout}${checked.stderr}`);
  // without the highlighter and the diagram renderer the site is still made, and Docs says which package is missing and the range to install (0036-distribution FR-033)
  const lean = `${project}-lean`;
  await fs.mkdir(lean, { recursive: true });
  for (const f of [...(await filesOf(FIXTURE)), ...["docs.config.ts"]]) {
    await fs.mkdir(path.dirname(path.join(lean, f)), { recursive: true });
    await fs.copyFile(path.join(project, f), path.join(lean, f));
  }
  await fs.writeTextFile(path.join(lean, "package.json"), `${JSON.stringify({ name: "consumer-lean", private: true, type: "module", dependencies: { [packed.packageName]: `file:${packed.tarball}`, typescript: "7.1.0-beta" } }, null, 2)}\n`);
  assertEquals((await proc.run(["bun", "install"], { cwd: lean })).code, 0);
  assert(!fs.existsSync(path.join(lean, "node_modules", "shiki")) && !fs.existsSync(path.join(lean, "node_modules", "beautiful-mermaid")), "neither optional peer is installed with the package");
  const plain = await proc.run(["bun", path.join(lean, "node_modules", packed.packageName, packed.command), "build", "--out", "site"], { cwd: lean });
  assertEquals(plain.code, 0, `${plain.stdout}${plain.stderr}`);
  assertStringIncludes(plain.stderr, "shiki is not installed");
  assertStringIncludes(plain.stderr, "install shiki at >=4.5.0 <5.0.0");
  assertStringIncludes(plain.stderr, "beautiful-mermaid is not installed");
  const site = path.join(project, "site");
  const pages = (await filesOf(site)).filter((f) => f.endsWith(".html"));
  for (const expected of ["index.html", "api/greeting/mod.html", "specs/001-greeting.html", "specs/matrix.html"]) assert(pages.includes(expected), `the site has ${expected}`);
  let internal = "";
  for (const page of pages) {
    const html = await fs.readTextFile(path.join(site, page));
    for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url = m[1] ?? "";
      if (/^https?:\/\//.test(url)) {
        assert(url.startsWith(ADDRESS), `${page} names ${url}, which is not the repository's address`);
        internal += `${url}\n`;
      }
    }
  }
  assertStringIncludes(internal, `${ADDRESS}/blob/trunk/`);
  assert(!internal.includes("github.com"), "no page names GitHub");
  const missing = await proc.run(["bun", command, "check"], { cwd: await fs.makeTempDir({ prefix: "docs-empty-" }) });
  assertEquals(missing.code, 2, "no configuration up to the root: exit status 2");
}, { timeout: 420_000 });
