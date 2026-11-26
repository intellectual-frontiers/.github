/**
 * Tests of `repoctl release train` (commons repoctl 0017-repoctl-release-train FR-001 to FR-007): the hand-off that refuses a commit that lacks the record, the release that is not made twice, the pins of real consumer
 * repositories that move, stay or wait, and the checks a consumer declares. The repositories are real Git repositories with a real remote; the installer of a consumer is a program of the test that says what a registry would,
 * and every other program is the real one.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { ok } from "@intellectual-frontiers/core";
import { fs, path } from "@intellectual-frontiers/system";
import { TIERS, VERBS } from "@intellectual-frontiers/repoctl/governance";
import { checksOf, folderOf, handoffOf, pinsOf, type Process, repinned, underFolder, type World } from "@intellectual-frontiers/repoctl/logical";
import { systemProcess, systemWorld } from "@intellectual-frontiers/repoctl/physical";
import { CAN_RUN, execute, git, hostOf, LIBRARIES, put } from "./world.ts";

const RECORD = "commons/generated/release.auto.json";
const PKG = "@intellectual-frontiers/commons";

const record = (version: string): string =>
  `${JSON.stringify({ generated: "test", releases: [{ slug: "commons", package: PKG, version, folder: "commons/commons", tag: `commons-v${version}`, publish: true }] }, null, 2)}\n`;

/** A repository with a bare remote; the record is written, and committed and pushed as far as the test says. */
async function withRelease<T>(state: "uncommitted" | "committed" | "pushed", use: (dir: string) => Promise<T>): Promise<T> {
  return await fs.withTempDir(async (root) => {
    const dir = path.join(root, "repo");
    const remote = path.join(root, "remote.git");
    await fs.mkdir(dir, { recursive: true });
    await git(root, "init", "-q", "--bare", remote);
    await git(dir, "init", "-q");
    await git(dir, "remote", "add", "origin", remote);
    await put(dir, "README.md", "start\n");
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Start");
    await put(dir, RECORD, record("0.2.0"));
    if (state !== "uncommitted") {
      await git(dir, "add", ".");
      await git(dir, "commit", "-q", "-m", "Release");
    }
    if (state === "pushed") await git(dir, "push", "-q", "origin", "HEAD:main");
    return await use(dir);
  });
}

/** A consumer repository: its tracked files are the given manifests and what else the test names. */
async function consumer(root: string, name: string, files: Readonly<Record<string, string>>): Promise<string> {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  await git(dir, "init", "-q");
  for (const [file, text] of Object.entries(files)) await put(dir, file, text);
  await git(dir, "add", ".");
  await git(dir, "commit", "-q", "-m", "Start");
  return dir;
}

const manifest = (deps: Readonly<Record<string, string>>): string => `${JSON.stringify({ name: "svc", version: "1.0.0", dependencies: deps }, null, 2)}\n`;

/** The installer of a test: `bun install` says what a registry would, and every other program is the real one. */
function installer(calls: string[], answers: readonly { readonly code: number; readonly stderr?: string }[]): Process {
  let n = 0;
  return {
    run: async (argv, options) => {
      if (argv[0] !== "bun" || argv[1] !== "install") return await systemProcess.run(argv, options);
      calls.push(`${argv.slice(1).join(" ")} @ ${options?.cwd ?? ""}`);
      if (argv.includes("--frozen-lockfile")) return { code: 0, stdout: "", stderr: "" };
      const a = answers[Math.min(n++, answers.length - 1)] ?? { code: 0 };
      if (a.code === 0 && options?.cwd !== undefined) await put(options.cwd, "bun.lock", `locked ${n}\n`);
      return { code: a.code, stdout: "", stderr: a.stderr ?? "" };
    },
  };
}

const PER_LIBRARY = (n: string): string | undefined => (n === "IFC_DISTRIBUTION" ? "per-library" : undefined);
const worldOf = (dir: string, process: Process = systemProcess): World => ({ ...systemWorld(dir, () => undefined, LIBRARIES), process });

proves(["0017-repoctl-release-train FR-001"], "the verb is declared beside the others: contributor, mutating, with a dry run, local, and it names no publication or tag in what it can do", () => {
  const f = VERBS["release train"];
  assertEquals([f.tier, f.effect, f.dryRun, f.channels.join(",")], ["contributor", "mutate", true, "local"]);
  assert(f.confirmation === "none" && f.humanOnly.length === 0, "it asks for no confirmation because it destroys nothing");
  assert(TIERS[f.tier] !== undefined);
});

proves(["0017-repoctl-release-train FR-003", "0017-repoctl-release-train FR-007"], "a release that is not committed is not handed off, one that is not pushed is not, and the step that publishes is named only where both are done", async () => {
  if (!CAN_RUN) return;
  await withRelease("uncommitted", async (dir) => {
    const host = hostOf(worldOf(dir));
    const first = await execute(host, ["release", "train", "--offline", "--json"]);
    assertEquals(first.code, 1, first.out + first.err);
    const doc = JSON.parse(first.out) as { data: { release: { state: string }; handoff: { kind: string; recordTracked: boolean; files: string[] } }; problems: { code: string }[] };
    assertEquals(doc.data.release.state, "waiting");
    assertEquals(doc.data.handoff.kind, "not-committed");
    assertEquals(doc.data.handoff.recordTracked, false);
    assertEquals(doc.problems.map((p) => p.code), ["E-TRAIN-NOT-COMMITTED"]);
    const text = await execute(host, ["release", "train", "--offline"]);
    assert(!/publishes the release/.test(text.out + text.err), "no step that publishes is said");
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Release");
    const second = await execute(host, ["release", "train", "--offline", "--json"]);
    assertEquals(second.code, 1);
    assertEquals((JSON.parse(second.out) as { problems: { code: string }[] }).problems.map((p) => p.code), ["E-TRAIN-NOT-PUSHED"]);
    await git(dir, "push", "-q", "origin", "HEAD:main");
    const third = await execute(host, ["release", "train", "--offline"]);
    assertEquals(third.code, 0, third.err);
    assertStringIncludes(third.out, "publishing is the step of a person");
    assertStringIncludes(third.out, "release    made before and waiting for its publication");
    assertEquals((await git(dir, "status", "--porcelain")).trim(), "", "the train wrote nothing here: the release was made before");
  });
});

proves(["0017-repoctl-release-train FR-003"], "the hand-off is a function of the repository: a change anywhere in the tree refuses it and names the file", async () => {
  if (!CAN_RUN) return;
  await withRelease("pushed", async (dir) => {
    const w = worldOf(dir);
    assertEquals((await handoffOf(w, RECORD)).kind, "ready");
    await put(dir, "notes.txt", "x\n");
    const h = await handoffOf(w, RECORD);
    assert(h.kind === "not-committed" && h.files.includes("notes.txt") && h.recordTracked);
  });
});

/** A repository of one library of the per-library mode whose record the train makes, with a remote. */
async function withLibrary<T>(use: (dir: string) => Promise<T>): Promise<T> {
  return await fs.withTempDir(async (root) => {
    const dir = path.join(root, "repo");
    await fs.mkdir(dir, { recursive: true });
    await git(root, "init", "-q", "--bare", path.join(root, "remote.git"));
    const name = "libraries";
    const rel = (v: string): string => `export const release = ${JSON.stringify({ slug: name, kind: "Library", title: name, authors: [{ name: "x" }], version: v, repository: "https://example.org/r" })};\n`;
    await put(dir, `commons/${name}/library.ts`, `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version: "0.1.0", exports: ["."], distribution: ["github", "npm"] })};\n`);
    await put(dir, `commons/${name}/package.json`, `${JSON.stringify({ name: `@intellectual-frontiers/${name}`, version: "0.1.0", exports: { ".": "./src/mod.ts" } }, null, 2)}\n`);
    await put(dir, `commons/${name}/src/mod.ts`, "export const x = 1;\n");
    await put(dir, `commons/${name}/release.ts`, rel("0.1.0"));
    await git(dir, "init", "-q");
    await git(dir, "remote", "add", "origin", path.join(root, "remote.git"));
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Start");
    await git(dir, "tag", "libraries-v0.1.0");
    await put(dir, `commons/${name}/src/mod.ts`, "export const x = 2;\n");
    await git(dir, "commit", "-q", "-am", "Change\n\nImpact: minor");
    return await use(dir);
  });
}

proves(["0017-repoctl-release-train FR-002"], "the release is made as `release apply` makes it, once: the second run finds it waiting and makes nothing again", async () => {
  if (!CAN_RUN) return;
  await withLibrary(async (dir) => {
    const releasing = { lock: () => Promise.resolve(ok(undefined)), sync: () => Promise.resolve(ok(undefined)), generate: () => Promise.resolve(ok(undefined)), prove: () => Promise.resolve(ok(undefined)) };
    const host = hostOf(worldOf(dir), { releasing, env: PER_LIBRARY });
    const dry = await execute(host, ["release", "train", "--offline", "--dry-run", "--json"]);
    assertEquals(dry.code, 0, dry.err);
    const planned = JSON.parse(dry.out) as { data: { release: { state: string; packages: { version: string }[] }; handoff: { kind: string } } };
    assertEquals([planned.data.release.state, planned.data.release.packages[0]?.version, planned.data.handoff.kind], ["planned", "0.2.0", "not-reached"]);
    assertEquals((await git(dir, "status", "--porcelain")).trim(), "", "a dry run writes nothing");
    const first = await execute(host, ["release", "train", "--offline", "--no-tests", "--json"]);
    const made = JSON.parse(first.out) as { data: { release: { state: string }; handoff: { kind: string } }; problems: { code: string }[] };
    assertEquals(made.data.release.state, "applied");
    assertEquals(made.data.handoff.kind, "not-committed", "what the release made is not committed, so it is not handed off");
    assertEquals(made.problems.map((p) => p.code), ["E-TRAIN-NOT-COMMITTED"]);
    assertStringIncludes(await fs.readTextFile(path.join(dir, "commons/libraries/library.ts")), '"version":"0.2.0"');
    const before = await git(dir, "status", "--porcelain");
    await put(dir, "commons/libraries/src/mod.ts", "export const x = 2;\n");
    const second = await execute(host, ["release", "train", "--offline", "--no-tests", "--json"]);
    assertEquals((JSON.parse(second.out) as { data: { release: { state: string } } }).data.release.state, "waiting");
    assertEquals(await git(dir, "status", "--porcelain"), before, "a release that waits is not made again");
  });
});

proves(["0017-repoctl-release-train FR-004"], "an exact pin below the record moves, a range, a link, a newer pin and a package that is not in the record stay, and only what is under --only moves", () => {
  const released = [{ package: PKG, version: "0.2.0" }];
  const text = manifest({ [PKG]: "0.1.0", "@other/pkg": "1.0.0" });
  const pins = pinsOf("services/a/package.json", text, released);
  assert(pins.kind === "ok");
  assertEquals(pins.value.map((p) => `${p.package} ${p.from}>${p.to}`), [`${PKG} 0.1.0>0.2.0`]);
  for (const kept of ["^0.1.0", "~0.1.0", "link:../x", "workspace:*", "0.2.0", "0.3.0", "latest"]) {
    const r = pinsOf("package.json", manifest({ [PKG]: kept }), released);
    assert(r.kind === "ok" && r.value.length === 0, `${kept} stays`);
  }
  assert(pinsOf("package.json", "{", released).kind === "err", "a manifest that is not JSON is named");
  assertEquals(repinned(text, pins.value), text.replace(`"${PKG}": "0.1.0"`, `"${PKG}": "0.2.0"`), "only the pin changes in the text");
  assertEquals([folderOf("services/a/package.json"), folderOf("package.json")], ["services/a", "."]);
  assert(underFolder("services/a", "services/a") && underFolder("services/a/x", "services/a") && !underFolder("services/ab", "services/a") && underFolder("anything", "."));
});

proves(["0017-repoctl-release-train FR-004", "0017-repoctl-release-train FR-005", "0017-repoctl-release-train FR-008"], "the pins of a consumer move with its lockfile, are installed twice, and the checks it declares all run, and only a failing check that blocks a release ends the verb with a failure", async () => {
  if (!CAN_RUN) return;
  await withRelease("pushed", async (dir) => {
    await fs.withTempDir(async (root) => {
      const node = (check: string, code: string): { check: string; argv: string[] } => ({ check, argv: ["node", "-e", code] });
      const checks = JSON.stringify({ verify: [node("types", "require('fs').writeFileSync('first','1')"), node("trace", "process.exit(3)"), node("tests", "process.exit(4)"), node("types", "process.exit(5)"), node("syntax", "require('fs').writeFileSync('last','1')")] });
      const c = await consumer(root, "product", {
        "services/a/package.json": manifest({ [PKG]: "0.1.0" }),
        "services/b/package.json": manifest({ [PKG]: "0.1.0" }),
        "commons-consumer.json": checks,
      });
      const calls: string[] = [];
      const host = hostOf(worldOf(dir, installer(calls, [{ code: 0 }])));
      const out = await execute(host, ["release", "train", "--consumer", c, "--only", "services/a", "--json"]);
      const doc = JSON.parse(out.out) as { data: { consumers: { pins: { file: string; state: string }[]; verify: { code: number }[] }[] }; problems: { code: string }[] };
      assertEquals(doc.data.consumers[0]?.pins.map((p) => `${p.file} ${p.state}`), ["services/a/package.json moved"]);
      assertStringIncludes(await fs.readTextFile(path.join(c, "services/a/package.json")), `"${PKG}": "0.2.0"`);
      assertStringIncludes(await fs.readTextFile(path.join(c, "services/b/package.json")), `"${PKG}": "0.1.0"`);
      assertEquals(calls.map((x) => x.split(" @ ")[0]), ["install", "install --frozen-lockfile"], "the install that updates the lockfile, then the one that refuses a lockfile that is not up to date");
      assert(calls[0]?.endsWith(path.join(c, "services/a")), "installed in the folder of the manifest");
      assertEquals(doc.data.consumers[0]?.verify.map((v) => v.code), [0, 3, 4, 5, 0], "every check runs, whatever an earlier one said");
      assert((await fs.exists(path.join(c, "first"))) && (await fs.exists(path.join(c, "last"))));
      assertEquals(doc.problems.map((p) => p.code), ["E-TRAIN-FINDING", "E-TRAIN-TESTS-FAILING", "E-TRAIN-VERIFY"], "a failing trace and failing tests are findings, a failing type check blocks");
      assertEquals(out.code, 1);
    });
  });
});

proves(["0017-repoctl-release-train FR-008"], "a consumer whose only failing checks are findings passes: the train ends well and says each finding", async () => {
  if (!CAN_RUN) return;
  await withRelease("pushed", async (dir) => {
    await fs.withTempDir(async (root) => {
      const node = (check: string, code: string): { check: string; argv: string[] } => ({ check, argv: ["node", "-e", code] });
      const c = await consumer(root, "product", { "package.json": manifest({ [PKG]: "0.1.0" }), "commons-consumer.json": JSON.stringify({ verify: [node("types", "process.exit(0)"), node("surface-thin", "process.exit(2)"), node("hygiene", "process.exit(2)"), node("tests", "process.exit(1)")] }) });
      const out = await execute(hostOf(worldOf(dir, installer([], [{ code: 0 }]))), ["release", "train", "--consumer", c, "--json"]);
      const doc = JSON.parse(out.out) as { problems: { code: string }[] };
      assertEquals(doc.problems.map((p) => p.code), ["E-TRAIN-FINDING", "E-TRAIN-FINDING", "E-TRAIN-TESTS-FAILING"]);
      assertEquals(out.code, 0, "no finding blocks");
      assertStringIncludes(JSON.stringify(doc), "FAILING TESTS");
    });
  });
});

proves(["0017-repoctl-release-train FR-005"], "a consumer that declares no check says so, and passes none", async () => {
  if (!CAN_RUN) return;
  await withRelease("pushed", async (dir) => {
    await fs.withTempDir(async (root) => {
      const c = await consumer(root, "product", { "package.json": manifest({ [PKG]: "0.1.0" }) });
      const out = await execute(hostOf(worldOf(dir, installer([], [{ code: 0 }]))), ["release", "train", "--consumer", c]);
      assertEquals(out.code, 0, out.err);
      assertStringIncludes(out.out, "declares no check");
      assert(!/passed/.test(out.out), "no check passed");
    });
  });
});

proves(["0017-repoctl-release-train FR-005"], "an install that cannot find the version leaves the consumer as it was and ends with a warning; --wait tries again until it can", async () => {
  if (!CAN_RUN) return;
  await withRelease("pushed", async (dir) => {
    await fs.withTempDir(async (root) => {
      const c = await consumer(root, "product", { "package.json": manifest({ [PKG]: "0.1.0" }), "bun.lock": "original\n" });
      const before = await git(c, "status", "--porcelain");
      const missing = { code: 1, stderr: `error: GET https://registry.example.test/${PKG} - 404` };
      const waiting = await execute(hostOf(worldOf(dir, installer([], [missing]))), ["release", "train", "--consumer", c, "--json"]);
      assertEquals(waiting.code, 0, "a warning is not a failure");
      const doc = JSON.parse(waiting.out) as { data: { consumers: { pins: { state: string }[] }[] }; problems: { code: string; level: string }[] };
      assertEquals(doc.data.consumers[0]?.pins.map((p) => p.state), ["waiting"]);
      assertEquals(doc.problems.map((p) => `${p.level} ${p.code}`), ["warn E-TRAIN-WAITING"]);
      assertEquals(await git(c, "status", "--porcelain"), before, "the manifest and the lockfile are as they were");
      const calls: string[] = [];
      const tries = await execute(hostOf(worldOf(dir, installer(calls, [missing, missing, { code: 0 }])), { train: { pollMs: 5 } }), ["release", "train", "--consumer", c, "--wait", "5", "--json"]);
      const done = JSON.parse(tries.out) as { data: { consumers: { pins: { state: string }[] }[] } };
      assertEquals(done.data.consumers[0]?.pins.map((p) => p.state), ["moved"]);
      assertEquals(calls.filter((x) => x.startsWith("install @")).length, 3, "tried until it could");
      await git(c, "checkout", "--", ".");
      const failing = await execute(hostOf(worldOf(dir, installer([], [{ code: 1, stderr: "error: unauthorized" }]))), ["release", "train", "--consumer", c, "--json"]);
      assertEquals(failing.code, 1);
      assertEquals((JSON.parse(failing.out) as { problems: { code: string }[] }).problems.map((p) => p.code), ["E-TRAIN-INSTALL"]);
    });
  });
});

proves(["0017-repoctl-release-train FR-006"], "--offline installs nothing and lists the pins it would move, and --dry-run writes nothing", async () => {
  if (!CAN_RUN) return;
  await withRelease("pushed", async (dir) => {
    await fs.withTempDir(async (root) => {
      const c = await consumer(root, "product", { "package.json": manifest({ [PKG]: "0.1.0" }) });
      for (const flag of ["--offline", "--dry-run"]) {
        const calls: string[] = [];
        const out = await execute(hostOf(worldOf(dir, installer(calls, [{ code: 0 }]))), ["release", "train", "--consumer", c, flag, "--json"]);
        assertEquals(out.code, 0, out.err);
        assertEquals(calls, [], `${flag}: no install`);
        assertEquals((JSON.parse(out.out) as { data: { consumers: { pins: { state: string }[] }[] } }).data.consumers[0]?.pins.map((p) => p.state), ["planned"]);
        assertEquals(await fs.readTextFile(path.join(c, "package.json")), manifest({ [PKG]: "0.1.0" }), `${flag}: the manifest is as it was`);
      }
    });
  });
});

proves(["0017-repoctl-release-train FR-004", "0017-repoctl-release-train FR-005"], "a consumer that is not a checkout, or whose declaration is wrong, is refused before any pin moves", async () => {
  if (!CAN_RUN) return;
  await withRelease("pushed", async (dir) => {
    await fs.withTempDir(async (root) => {
      const plain = path.join(root, "plain");
      await fs.mkdir(plain, { recursive: true });
      await put(plain, "package.json", manifest({ [PKG]: "0.1.0" }));
      const bad = await consumer(root, "bad", { "package.json": manifest({ [PKG]: "0.1.0" }), "commons-consumer.json": JSON.stringify({ verify: [{ check: "types", argv: [] }] }) });
      const calls: string[] = [];
      const out = await execute(hostOf(worldOf(dir, installer(calls, [{ code: 0 }]))), ["release", "train", "--consumer", plain, "--consumer", bad, "--json"]);
      assertEquals(out.code, 1);
      assertEquals((JSON.parse(out.out) as { problems: { code: string }[] }).problems.map((p) => p.code), ["E-TRAIN-CONSUMER", "E-TRAIN-CONSUMER"]);
      assertEquals(calls, []);
      assertStringIncludes(await fs.readTextFile(path.join(bad, "package.json")), `"${PKG}": "0.1.0"`);
    });
  });
  const classOf = (c: string): "blocking" | "finding" | undefined => (c === "types" ? "blocking" : c === "trace" ? "finding" : undefined);
  assert(checksOf('{"verify":[{"check":"types","argv":["a","b"]}]}', classOf).kind === "ok" && checksOf('{"verify":[]}', classOf).kind === "ok" && checksOf("{}", classOf).kind === "err" && checksOf('{"verify":[{"check":"types","argv":[1]}]}', classOf).kind === "err" && checksOf('{"verify":[{"check":"nope","argv":["a"]}]}', classOf).kind === "err" && checksOf('{"verify":[["a"]]}', classOf).kind === "err" && checksOf("x", classOf).kind === "err");
});

proves(["0017-repoctl-release-train FR-007"], "the summary names every phase and every pin as text and as data, and a phase that was not reached says why", async () => {
  if (!CAN_RUN) return;
  await fs.withTempDir(async (dir) => {
    await git(dir, "init", "-q");
    await put(dir, "README.md", "x\n");
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Start");
    const out = await execute(hostOf(worldOf(dir), { env: PER_LIBRARY }), ["release", "train", "--offline", "--dry-run"]);
    assertStringIncludes(out.out, "release    nothing to release");
    assertStringIncludes(out.out, "hand-off   not reached: no release is waiting");
    assertStringIncludes(out.out, "pins       no consumer was given");
  });
});
