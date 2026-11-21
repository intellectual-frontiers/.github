/**
 * The release of the one package (commons 0001-libraries FR-032): in `single` mode the plan is one release, `commons`, raised by the greatest `Impact:` across all libraries since the last tag with the rule of major version 0, a held library
 * counted like any other, a version ahead of its tag released as it is, the record naming the registries of its one entry, and the publication sending the tarball to the GitHub package registry alone.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { proc } from "@intellectual-frontiers/system";
import { mkdirSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { SINGLE_TARGETS } from "../src/distribution.ts";
import { offlineRegistry, planLines, publishAll, readRecord, recordText, releasePlan, type Tools } from "../src/releasing.ts";
import { currentLook } from "@intellectual-frontiers/system/tty";

const SPEC = "0001-libraries";

const manifest = (name: string, version: string, extra: Record<string, unknown> = {}): string =>
  `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version, exports: ["."], distribution: ["github", "npm"], ...extra })};\n`;

function put(dir: string, name: string, version: string, extra: Record<string, unknown> = {}): void {
  mkdirSync(join(dir, "commons", name, "src"), { recursive: true });
  writeTextFileSync(join(dir, "commons", name, "library.ts"), manifest(name, version, extra));
  writeTextFileSync(join(dir, "commons", name, "package.json"), `${JSON.stringify({ name: `@intellectual-frontiers/${name}`, version, exports: { ".": "./src/mod.ts" } }, null, 2)}\n`);
  writeTextFileSync(join(dir, "commons", name, "src", "mod.ts"), `export const ${name.replace(/-/g, "_")} = 1;\n`);
}

const offline = async (): Promise<undefined> => undefined;

proves([`${SPEC} FR-032`], "single mode plans one release of commons: raised by the greatest Impact across all libraries (a minor for a major while 0.x), a held library counted, a version ahead of its tag released as it is, and the record has the one entry and its tag", async () => {
  const git = proc.which("git");
  if (git === undefined) return;
  await withTempDir(async (dir) => {
    const g = async (...a: string[]): Promise<string> => {
      const r = await proc.run([git, "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a]);
      assertEquals(r.code, 0, `${a.join(" ")}: ${r.stderr}`);
      return r.stdout;
    };
    await g("init", "-q", "-b", "main");
    put(dir, "core", "0.1.5");
    put(dir, "lab", "0.1.0", { held: { kind: "tests-only", reason: "tests only" } });
    put(dir, "commons", "0.2.0", { bundle: "commons" });
    await g("add", ".");
    await g("commit", "-q", "-m", "Start");
    const plan = async (): Promise<string[]> => {
      const p = await releasePlan(dir, { mode: "single", registry: offlineRegistry, published: offline });
      assert(p.kind === "ok", p.kind === "err" ? p.error : "");
      return p.value.steps.map((s) => `${s.slug} ${s.from}>${s.to} ${s.tag} ${s.decision.kind} ${(s.registries ?? []).join("+")}`);
    };
    // no tag: released as it is
    assertEquals(await plan(), ["commons 0.2.0>0.2.0 commons-v0.2.0 as-is github"]);
    await g("tag", "commons-v0.2.0");
    assertEquals(await plan(), [], "tagged and unchanged: nothing");
    // a change of a held library, with a major impact, raises the one package's minor
    writeTextFileSync(join(dir, "commons/lab/src/extra.ts"), "export const x = 1;\n");
    await g("add", ".");
    await g("commit", "-q", "-m", "Change the held lab\n\nImpact: major");
    assertEquals(await plan(), ["commons 0.2.0>0.3.0 commons-v0.3.0 raised github"]);
    // a change with no stated impact is a patch, a stated minor a minor
    await g("reset", "-q", "--hard", "HEAD~1");
    writeTextFileSync(join(dir, "commons/core/src/extra.ts"), "export const y = 1;\n");
    await g("add", ".");
    await g("commit", "-q", "-m", "Change core");
    assertEquals(await plan(), ["commons 0.2.0>0.2.1 commons-v0.2.1 raised github"]);
    // no library is raised by itself: the only step is commons
    const p = await releasePlan(dir, { mode: "single", registry: offlineRegistry, published: offline });
    assert(p.kind === "ok");
    assertEquals(p.value.held, []);
    assertEquals(p.value.steps.length, 1);
    // the floor of the keys of exports against the version npm holds: a key that is gone is breaking, which raises the minor while 0.x
    const floor = await releasePlan(dir, { mode: "single", registry: offlineRegistry, published: () => Promise.resolve(["./core", "./gone"]) });
    assert(floor.kind === "ok");
    assertEquals(floor.value.steps.map((s) => s.to), ["0.3.0"]);
    assertStringIncludes(planLines(currentLook("stdout"), floor.value).join("\n"), "(to github)");
    // the record names the registries of its one entry
    const text = recordText(p.value);
    const back = readRecord(text);
    assert(back.kind === "ok");
    assertEquals(back.value.map((e) => `${e.slug} ${e.tag} ${(e.registries ?? []).join("+")}`), ["commons commons-v0.2.1 github"]);
    assertEquals(readRecord(text.replace('"github"', '"gitlab"')).kind, "err");
    // a manifest that is no package of the one folder is refused
    assertEquals((await releasePlan(dir, { mode: "single", registry: offlineRegistry, published: offline, raise: new Map([["core", undefined]]) })).kind, "err");
  });
});

proves([`${SPEC} FR-032`], "the registries of the one package are github alone, and the publication sends the tarball to the GitHub package registry and tags, and asks npm for nothing", async () => {
  assertEquals([...SINGLE_TARGETS], ["github"]);
  const asked: string[] = [];
  const tools: Tools = {
    onNpm: () => {
      asked.push("npm asked");
      return Promise.resolve(false);
    },
    npm: () => {
      asked.push("npm sent");
      return Promise.resolve(ok(undefined));
    },
    github: (e) => {
      asked.push(`github ${e.package}@${e.version}`);
      return Promise.resolve(e.package === "" ? err("none") : ok(undefined));
    },
    tag: (t) => {
      asked.push(`tag ${t}`);
      return Promise.resolve(ok("made"));
    },
  };
  const entry = { slug: "commons", package: "@intellectual-frontiers/commons", version: "0.2.0", folder: "commons/commons", tag: "commons-v0.2.0", publish: true } as const;
  const out = await publishAll([{ ...entry, registries: ["github"] }], tools);
  assertEquals(asked, ["github @intellectual-frontiers/commons@0.2.0", "tag commons-v0.2.0"]);
  assertEquals(out[0]?.tagged, "made");
  assertEquals(out[0]?.npm, "not-published");
  // npm switched on is the one change that sends it there too
  asked.length = 0;
  await publishAll([{ ...entry, registries: ["github", "npm"] }], tools);
  assertEquals(asked, ["npm asked", "npm sent", "github @intellectual-frontiers/commons@0.2.0", "tag commons-v0.2.0"]);
});
