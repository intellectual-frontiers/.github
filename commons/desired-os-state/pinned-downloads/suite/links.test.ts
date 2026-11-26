/**
 * Tests of the links of an archive (commons desired-os-state-pinned-downloads 0002-pinned-downloads-install FR-007, FR-008): the layouts of a Node release and of a Temurin JRE, made by the system `tar` and
 * compressed with xz and gzip, unpack with the links they hold; each way a link can be untrustworthy refuses the whole archive with its path and one reason; a hard link is a copy; and where the system
 * cannot make links a link to a file is a copy and a link to a folder is refused. Every name and byte is made up.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { untar } from "@intellectual-frontiers/formats/archive";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { describeInstallError, unpackVerified, type InstallSpec, type LinkProblem } from "../src/install.ts";
import { describeLinkRefusal, resolveLinks } from "../src/links.ts";
import { rawTar, type RawEntry } from "./tars.ts";

const text = (s: string): Uint8Array => new TextEncoder().encode(s);
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

async function spec(bytes: Uint8Array, more: Partial<InstallSpec> = {}): Promise<InstallSpec> {
  return { tool: "node", version: "1.0.0", platform: "linux-x64", os: "linux", program: "node", downloadUrl: "https://example.test/node", sha256: await sha256(bytes), archiveFormat: "tar", binPath: "node-v1/bin", ...more };
}

function resolved(entries: readonly RawEntry[], windows = false) {
  const read = untar(rawTar(entries));
  if (read.kind === "err") throw new Error("the test's own tar is not a tar");
  return resolveLinks(read.value, windows);
}

function refusal(entries: readonly RawEntry[], windows = false): { readonly path: string; readonly why: LinkProblem } | string {
  const r = resolved(entries, windows);
  if (r.kind === "ok") return "the archive was accepted";
  return r.error.kind === "link" ? { path: r.error.path, why: r.error.why } : r.error.kind;
}

const FILE = (path: string, executable = false): RawEntry => ({ path, data: text(`${path}\n`), executable });

proves(["0002-pinned-downloads-install FR-007"], "a Node release, xz-compressed, and a Temurin JRE, gzipped, unpack with their links: files, the execute bits the archive gave, and the links to make", async () => {
  const node = fixture("node-like.tar.xz");
  const n = await unpackVerified(await spec(node), node);
  assert(n.kind === "ok", n.kind === "err" ? describeInstallError(n.error) : "");
  assertEquals(n.value.links, [
    { path: "node-v1/bin/npm", target: "../lib/node_modules/npm/bin/npm-cli.js" },
    { path: "node-v1/bin/npx", target: "../lib/node_modules/npm/bin/npx-cli.js" },
  ]);
  assertEquals([...n.value.files.keys()].sort(), ["node-v1/bin/node", "node-v1/include/node.h", "node-v1/lib/node_modules/npm/bin/npm-cli.js", "node-v1/lib/node_modules/npm/bin/npx-cli.js"]);
  assertEquals([...n.value.executable].sort(), ["node-v1/bin/node", "node-v1/lib/node_modules/npm/bin/npm-cli.js", "node-v1/lib/node_modules/npm/bin/npx-cli.js"]);

  const jre = fixture("temurin-like.tar.gz");
  const j = await unpackVerified(await spec(jre, { tool: "jre", program: "java", binPath: "jdk-21/bin" }), jre);
  assert(j.kind === "ok", j.kind === "err" ? describeInstallError(j.error) : "");
  assertEquals(j.value.links, [
    { path: "jdk-21/legal/jdk.jsobject/ASSEMBLY_EXCEPTION", target: "../java.base/ASSEMBLY_EXCEPTION" },
    { path: "jdk-21/legal/jdk.jsobject/LICENSE", target: "../java.base/LICENSE" },
  ]);
  assertEquals([...j.value.executable], ["jdk-21/bin/java"]);
});

proves(["0002-pinned-downloads-install FR-007"], "a link may name a folder, a file below another folder, or reach up and down inside the folder, and the program may itself be a link", () => {
  const r = resolved([
    FILE("pkg/v1/bin/tool", true),
    { kind: "symlink", path: "pkg/current", link: "v1" },
    { kind: "symlink", path: "pkg/bin", link: "v1/bin" },
    { kind: "symlink", path: "pkg/v1/lib/up", link: "../bin/tool" },
    { kind: "symlink", path: "pkg/v1/lib/deep/again", link: "../../bin/tool" },
  ]);
  assert(r.kind === "ok", JSON.stringify(r));
  assertEquals(r.value.links.map((l) => `${l.path} -> ${l.target}`), ["pkg/bin -> v1/bin", "pkg/current -> v1", "pkg/v1/lib/deep/again -> ../../bin/tool", "pkg/v1/lib/up -> ../bin/tool"].sort());
});

proves(["0002-pinned-downloads-install FR-007"], "a link may name another link, to any depth, where the chain ends at something the archive holds and no folder on the way is a link; on a system without links each becomes a copy of the file at the end", () => {
  const entries = [
    FILE("tl/bin/pdftex", true),
    { kind: "symlink", path: "tl/bin/latex", link: "pdftex" },
    { kind: "symlink", path: "tl/bin/allec", link: "latex" },
    { kind: "symlink", path: "tl/bin/allcm", link: "allec" },
  ] as const;
  const r = resolved([...entries]);
  assert(r.kind === "ok", JSON.stringify(r));
  assertEquals(r.value.links.map((l) => `${l.path} -> ${l.target}`), ["tl/bin/allcm -> allec", "tl/bin/allec -> latex", "tl/bin/latex -> pdftex"]);
  const w = resolved([...entries], true);
  assert(w.kind === "ok", JSON.stringify(w));
  assertEquals([...w.value.files.keys()].sort(), ["tl/bin/allcm", "tl/bin/allec", "tl/bin/latex", "tl/bin/pdftex"]);
});

proves(["0002-pinned-downloads-install FR-007"], "each way a link cannot be trusted refuses the whole archive with the path of the link and one reason", () => {
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/l", link: "/etc/passwd" }]), { path: "a/l", why: "absolute" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/l", link: "C:/Windows/system32" }]), { path: "a/l", why: "absolute" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/l", link: "..\\f" }]), { path: "a/l", why: "absolute" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/l", link: "" }]), { path: "a/l", why: "absolute" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/l", link: "../../f" }]), { path: "a/l", why: "escapes" });
  assertEquals(refusal([FILE("a/b/f"), { kind: "symlink", path: "a/b/l", link: "../../../x" }]), { path: "a/b/l", why: "escapes" });
  assertEquals(refusal([FILE("f"), { kind: "symlink", path: "l", link: "../f" }]), { path: "l", why: "escapes" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/l", link: "missing" }]), { path: "a/l", why: "dangling" });
  assertEquals(refusal([FILE("a/b/f"), { kind: "symlink", path: "a/b/l", link: "." }]), { path: "a/b/l", why: "loops" });
  assertEquals(refusal([FILE("a/b/f"), { kind: "symlink", path: "a/b/l", link: ".." }]), { path: "a/b/l", why: "loops" });
  assertEquals(refusal([FILE("a/b/f"), { kind: "symlink", path: "a/b/l", link: "../.." }]), { path: "a/b/l", why: "loops" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/l", link: ".." }]), { path: "a/l", why: "loops" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/one", link: "two" }, { kind: "symlink", path: "a/two", link: "one" }]), { path: "a/one", why: "loops" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/one", link: "missing" }, { kind: "symlink", path: "a/two", link: "one" }]), { path: "a/one", why: "dangling" });
  assertEquals(refusal([FILE("a/d/f"), { kind: "symlink", path: "a/dir", link: "d" }, { kind: "symlink", path: "a/two", link: "dir/f" }]), { path: "a/two", why: "through-link" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/a", link: "a" }]), { path: "a/a", why: "loops" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/f", link: "f" }]), { path: "a/f", why: "collides" });
  assertEquals(refusal([FILE("a/d/f"), { kind: "symlink", path: "a/d", link: "d/f" }]), { path: "a/d", why: "written-through" });
  assertEquals(refusal([{ kind: "dir", path: "a/d" }, FILE("a/f"), { kind: "symlink", path: "a/d", link: "f" }]), { path: "a/d", why: "collides" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/l", link: "f" }, { kind: "symlink", path: "a/l", link: "f" }]), { path: "a/l", why: "collides" });
  assertEquals(refusal([FILE("a/d/f"), { kind: "symlink", path: "a/l", link: "d" }, FILE("a/l/written")]), { path: "a/l", why: "written-through" });
  assertEquals(refusal([FILE("a/d/f"), { kind: "symlink", path: "a/l", link: "d" }, { kind: "dir", path: "a/l/sub" }]), { path: "a/l", why: "written-through" });
  assertEquals(refusal([FILE("a/d/f"), { kind: "symlink", path: "a/l", link: "d" }, { kind: "symlink", path: "a/l/inner", link: "../d" }]), { path: "a/l", why: "written-through" });
  assertEquals(refusal([FILE("a/f"), { kind: "hardlink", path: "a/h", link: "a/missing" }]), { path: "a/h", why: "hardlink-target" });
  assertEquals(refusal([{ kind: "hardlink", path: "a/h", link: "a/f" }, FILE("a/f")]), { path: "a/h", why: "hardlink-target" });
  assertEquals(refusal([FILE("a/f"), { kind: "symlink", path: "a/l", link: "f" }, { kind: "hardlink", path: "a/h", link: "a/l" }]), { path: "a/h", why: "hardlink-target" });
  assertEquals(refusal([FILE("a/f"), { kind: "hardlink", path: "a/f", link: "a/f" }]), "duplicate-path");
});

proves(["0002-pinned-downloads-install FR-007"], "every refusal is a sentence that names the path of the link, says why and says that nothing was written, one for each reason", () => {
  const reasons: readonly LinkProblem[] = ["absolute", "escapes", "dangling", "loops", "through-link", "collides", "written-through", "hardlink-target", "directory-on-windows"];
  const seen = new Set<string>();
  for (const why of reasons) {
    const sentence = describeLinkRefusal({ kind: "link", path: "pkg/l", why });
    assert(sentence.includes("pkg/l") && sentence.includes("nothing was written"), sentence);
    seen.add(sentence);
  }
  assertEquals(seen.size, reasons.length);
  const bytes = rawTar([FILE("pkg/bin/node", true), { kind: "symlink", path: "pkg/bin/x", link: "/bin/sh" }]);
  assertEquals(typeof describeInstallError({ kind: "link", path: "pkg/bin/x", why: "absolute" }), "string");
  assert(bytes.length > 0);
});

proves(["0002-pinned-downloads-install FR-008"], "a hard link is a copy of the file it names, executable where either is, and a file below no link is the same on every system", () => {
  const r = resolved([FILE("pkg/real", true), { kind: "hardlink", path: "pkg/copy", link: "pkg/real" }, FILE("pkg/other")]);
  assert(r.kind === "ok");
  assertEquals(r.value.files.get("pkg/copy"), r.value.files.get("pkg/real"));
  assertEquals([...r.value.executable].sort(), ["pkg/copy", "pkg/real"]);
  assertEquals(r.value.links, []);
});

proves(["0002-pinned-downloads-install FR-008"], "where the system cannot make links a link to a file is a copy of the file and a link to a folder is refused", async () => {
  const node = fixture("node-like.tar.xz");
  const w = await unpackVerified(await spec(node, { os: "windows", platform: "windows-x64", program: "node.exe" }), node);
  assert(w.kind === "err" && w.error.kind === "missing-program", "the program of the made-up windows tool is not in the archive");
  const entries = untar(rawTar([FILE("node-v1/bin/node.exe", true), FILE("node-v1/lib/npm-cli.js", true), { kind: "symlink", path: "node-v1/bin/npm", link: "../lib/npm-cli.js" }]));
  assert(entries.kind === "ok");
  const r = resolveLinks(entries.value, true);
  assert(r.kind === "ok");
  assertEquals(r.value.links, []);
  assertEquals(r.value.files.get("node-v1/bin/npm"), r.value.files.get("node-v1/lib/npm-cli.js"));
  assertEquals(refusal([FILE("pkg/v1/f"), { kind: "symlink", path: "pkg/current", link: "v1" }], true), { path: "pkg/current", why: "directory-on-windows" });
  assertEquals(refusal([FILE("pkg/v1/f"), { kind: "symlink", path: "pkg/current", link: "v1" }], false), "the archive was accepted");
});
