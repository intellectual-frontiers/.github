/**
 * Tests of the program as a whole (commons anyfs-cli 0004-anyfs-cli-surfaces FR-001 to FR-004, FR-006, FR-009, FR-014 to FR-016): the openers of stores (memory, a folder, a host through the safe executor, one the
 * configuration brings), the world, the finding and loading of the configuration, the model of the program under the conformance of Headless, the tool server by tier, `places` and `doctor`, and `main` with its
 * envelope and its tier.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { describe } from "@intellectual-frontiers/headless/describe";
import { modelProblems, placedCommands, type Output, type RunOptions } from "@intellectual-frontiers/headless/logical";
import { served } from "@intellectual-frontiers/headless/mcp";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { CATALOGUE, PROBLEM_CODES, TIERS, VERB_IDS, VERBS } from "../src/governance/mod.ts";
import { EMPTY_CONFIG, parseConfig } from "../src/logical/mod.ts";
import { anyfsProgram, builtinKinds, findConfigFile, INERT_HOST, localPlace, systemWorld } from "../src/physical/mod.ts";
import { fill, lab, textOf, type Lab } from "./world.ts";

const program = anyfsProgram(INERT_HOST);

async function withLab<T>(body: (l: Lab) => Promise<T>): Promise<T> {
  const l = await lab();
  try {
    return await body(l);
  } finally {
    await l.cleanup();
  }
}

proves(["0004-anyfs-cli-surfaces FR-006"], "every verb has examples and its facts from the table, and the model of the program has no problem", () => {
  assertEquals(modelProblems(program, { requireReach: true }), []);
  const placed = placedCommands(program.children);
  const ids = placed.map((p) => p.id);
  for (const id of VERB_IDS) assert(ids.includes(id), id);
  assert(ids.includes("trust-host") && ids.includes("mcp"));
  for (const p of placed) {
    assert(p.command.examples.length > 0, `${p.id} has an example`);
    assert(p.command.examples.every((e) => e.says.trim() !== ""), `${p.id}'s examples say what they do`);
  }
  for (const p of placed) {
    const facts = VERBS[p.id as keyof typeof VERBS];
    if (facts !== undefined) assertEquals([p.facts.effect, p.facts.idempotent, p.facts.kind], [facts.effect, facts.idempotent, facts.kind], p.id);
  }
});

proves(["0004-anyfs-cli-surfaces FR-015"], "the program is one tree with its version, its codes and its tiers, described the same for every surface", () => {
  assertEquals(program.name, "anyfs");
  const model = JSON.stringify(describe(program));
  for (const id of VERB_IDS) assertStringIncludes(model, id);
  for (const code of PROBLEM_CODES) assertStringIncludes(model, code);
  assertStringIncludes(model, "writer");
  assertEquals(Object.keys(CATALOGUE).length, PROBLEM_CODES.length);
});

const names = (tier: keyof typeof TIERS): readonly string[] => {
  const r = served(program, TIERS[tier]);
  return r.kind === "ok" ? r.value.map((s) => s.tool.name) : [];
};

proves(["0004-anyfs-cli-surfaces FR-009"], "the tools a tier sees are the verbs of that tier and below, and a destruction is marked as one", () => {
  const reader = names("reader");
  const writer = names("writer");
  assert(reader.length > 0 && writer.length > reader.length);
  for (const id of VERB_IDS) {
    const tool = `anyfs_${id.replaceAll(" ", "_").replaceAll("-", "_")}`;
    const facts = VERBS[id];
    assertEquals(reader.includes(tool), facts.tier === "reader" && facts.channels.includes("mcp"), tool);
    assertEquals(writer.includes(tool), facts.channels.includes("mcp"), tool);
  }
  const all = served(program, TIERS.writer);
  assert(all.kind === "ok");
  const rm = all.value.find((s) => s.tool.name === "anyfs_rm")?.tool;
  assertEquals(rm?.annotations, { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false });
  const ls = all.value.find((s) => s.tool.name === "anyfs_ls")?.tool;
  assertEquals(ls?.annotations?.readOnlyHint, true);
});

proves(["0004-anyfs-cli-surfaces FR-003"], "the world opens each place once for a run, resolves a plain path to its root, and keeps state in its own folder", () =>
  withLab(async (l) => {
    const world = systemWorld({ env: () => undefined, cwd: l.dir, json: false, config: EMPTY_CONFIG, stateDir: l.state });
    const place = { kind: "memory" as const, name: "same" };
    const one = await world.open(place);
    const two = await world.open(place);
    assert(one.kind === "ok" && two.kind === "ok" && one.value === two.value);
    assertEquals(localPlace("/srv", "fleet/a", "linux"), { root: "/", inner: "/srv/fleet/a" });
    assertEquals(world.local("x/y").inner, `${l.dir}/x/y`);
    await world.state.write("nested/note.txt", "kept");
    assertEquals(await world.state.read("nested/note.txt"), "kept");
    assertEquals(await world.state.read("nothing"), undefined);
  }),
);

proves(["0004-anyfs-cli-surfaces FR-001"], "a store in memory is one for each name, a folder opens, and a kind with no opener is unavailable", () =>
  withLab(async (l) => {
    const kinds = builtinKinds(() => undefined, l.state, {});
    assertEquals(kinds.map((k) => k.kind), ["memory", "file", "ssh"]);
    const world = systemWorld({ env: () => undefined, cwd: l.dir, json: false, config: EMPTY_CONFIG, stateDir: l.state });
    const folder = await world.open({ kind: "file", path: l.dir });
    assert(folder.kind === "ok");
    const missing = await world.open({ kind: "file", path: path.join(l.dir, "nowhere") });
    assert(missing.kind === "err" && missing.error.code === "E-OPEN");
    const s3 = await world.open({ kind: "s3", bucket: "example-bucket", prefix: "" as never });
    assert(s3.kind === "err" && s3.error.code === "E-PLACE-UNAVAILABLE");
  }),
);

/** The memory store of the core, by the file URL its entry resolves to: a configuration file is a module of its own folder and imports by address. */
const MEMORY = import.meta.resolve("@intellectual-frontiers/anyfs/memory");

proves(["0004-anyfs-cli-surfaces FR-002"], "an opener in the configuration brings a kind the program lacks, with no change to the program", () =>
  withLab(async (l) => {
    await l.config(
      `import { memoryStore } from ${JSON.stringify(MEMORY)};\nconst shared = memoryStore({ name: "from-opener" });\nexport default { mounts: [{ name: "repo", place: "git+file:///tmp/example-repo" }], kinds: [{ kind: "git", open: async () => ({ kind: "ok", value: shared }) }] };\n`,
    );
    const places = await l.run(["places", "--open"]);
    assertEquals(places.code, 0);
    assertStringIncludes(places.out, "repo");
    assertStringIncludes(places.out, "from the configuration");
    assertStringIncludes(places.out, "strong: read write list stat delete cas batch rename history");
    const put = await l.run(["put", "repo:/note.txt", "-"], { stdin: new TextEncoder().encode("through the opener\n") });
    assertEquals(put.code, 0);
    assertEquals(textOf((await l.run(["ls", "repo:/"])).bytes), "");
  }),
);

/** An ssh program that is a shell of this computer: the last word of its argument vector is the command of the remote side, and the host is a folder of its own. */
function fakeSsh(home: string): (argv: readonly string[], opts?: RunOptions) => Promise<Output> {
  return (argv, opts = {}) => {
    const remote = argv[argv.length - 1] ?? "";
    return proc.output(["/bin/sh", "-c", remote], { env: { PATH: "/usr/bin:/bin", HOME: home, LC_ALL: "C" }, clearEnv: true, ...(opts.input === undefined ? { stdin: "null" as const } : { input: opts.input }) });
  };
}

proves(["0004-anyfs-cli-surfaces FR-001", "0004-anyfs-cli-surfaces FR-002"], "a host reached by SSH is a store through the safe executor, and a host that does not answer is a problem of the computer", () =>
  withLab(async (l) => {
    const host = path.join(l.dir, "host");
    await fill(l.dir, { "host/fleet/olympia.json": '{"name":"olympia"}\n' });
    const run = fakeSsh(path.join(l.dir, "home"));
    await fs.mkdir(path.join(l.dir, "home"), { recursive: true });
    const ran = async (args: readonly string[], runner = run) => {
      let out = "";
      let errText = "";
      const { main } = await import("../src/anyfs.ts");
      const code = await main(args, { cwd: l.dir, env: {}, stateDir: l.state, run: runner, out: (t) => void (out += t), err: (t) => void (errText += t), writeStdout: (b) => void (out += new TextDecoder().decode(b)) });
      return { code, out: out.replace(/\n$/, ""), err: errText };
    };
    const listed = await ran(["ls", `ssh://fleet.example.org${host}/fleet`]);
    assertEquals(listed.code, 0, listed.err);
    assertEquals(listed.out, "olympia.json");
    const cat = await ran(["cat", `ssh://fleet.example.org${host}/fleet/olympia.json`]);
    assertEquals(cat.out, '{"name":"olympia"}');
    const refused = await ran(["ls", `ssh://fleet.example.org${host}/fleet`], () => Promise.resolve({ code: 255, success: false, signal: null, stdout: new Uint8Array(), stderr: new TextEncoder().encode("Host key verification failed.\n") }));
    assertEquals(refused.code, 3);
    assertStringIncludes(refused.err, "E-OPEN");
  }),
);

proves(["0004-anyfs-cli-surfaces FR-004"], "the configuration is found from the working folder up, its absence is no problem, and a file that does not load or is not valid is a typed problem", () =>
  withLab(async (l) => {
    await fill(l.dir, { "work/file.txt": "x\n" });
    const none = await l.run(["ls", "work"]);
    assertEquals([none.code, none.out], [0, "file.txt"]);
    assertEquals(findConfigFile(path.join(l.dir, "work"), undefined, () => undefined), undefined);
    await l.config(`export default { mounts: [{ name: "fleet", place: "memory:x" }] };\n`);
    assertEquals(findConfigFile(path.join(l.dir, "work"), undefined, () => undefined), path.join(l.dir, "anyfs.config.ts"));
    assertEquals((await l.run(["places"], { cwd: path.join(l.dir, "work") })).code, 0);
    await fill(l.dir, { "invalid/anyfs.config.ts": `export default { mounts: [{ name: "X", place: "nope" }] };\n`, "broken/anyfs.config.ts": `export default {{{ not a module` });
    const invalid = await l.run(["places"], { cwd: path.join(l.dir, "invalid") });
    assertEquals(invalid.code, 1);
    assertStringIncludes(invalid.err, "E-CONFIG-INVALID");
    assertEquals((await l.run(["ls", "../work"], { cwd: path.join(l.dir, "invalid") })).out, "file.txt");
    const broken = await l.run(["ls", "fleet:/"], { cwd: path.join(l.dir, "broken") });
    assertEquals(broken.code, 3);
    assertStringIncludes(broken.err, "E-CONFIG-LOAD");
    assertStringIncludes((await l.run(["places"], { cwd: path.join(l.dir, "broken") })).err, "E-CONFIG-LOAD");
    const missing = await l.run(["--config", "nothing.ts", "places"]);
    assertStringIncludes(missing.err, "does not exist");
    assertEquals(parseConfig({}).kind, "ok");
    assertEquals(err(1).kind, "err");
    assertEquals(ok(1).kind, "ok");
  }),
);

proves(["0004-anyfs-cli-surfaces FR-014"], "places lists the mounts and the kinds of place where there is no configuration, and doctor says what the setup lacks", () =>
  withLab(async (l) => {
    const none = await l.run(["places"]);
    assertEquals(none.code, 0);
    assertStringIncludes(none.out, "no mounts");
    assertStringIncludes(none.out, "no anyfs.config.ts was found");
    assertStringIncludes(none.out, "memory: built in");
    assertStringIncludes(none.out, "s3: no store yet");
    await l.config(`export default { mounts: [{ name: "fleet", place: "ssh://alpha.example.org/srv/fleet" }, { name: "ro", place: "memory:r", readOnly: true }] };\n`);
    const some = await l.run(["places"]);
    assertStringIncludes(some.out, "fleet");
    assertStringIncludes(some.out, "ssh://alpha.example.org/srv/fleet");
    assertStringIncludes(some.out, "read-only");
    const doctor = await l.run(["doctor"], { env: { PATH: "/nowhere" } });
    assertStringIncludes(doctor.out, "mounts    2");
    assertStringIncludes(doctor.out, "ssh       not found");
    assertEquals(doctor.code, 1);
    assertStringIncludes(doctor.err, "E-ENVIRONMENT");
    const json = JSON.parse((await l.run(["places", "--json"])).out) as { data: { mounts: { name: string }[] } };
    assertEquals(json.data.mounts.map((m) => m.name), ["fleet", "ro"]);
  }),
);

proves(["0004-anyfs-cli-surfaces FR-016"], "main gives the exit status, the one envelope of --json, and the usage status for a tier that is none", () =>
  withLab(async (l) => {
    await fill(l.dir, { "d/a.txt": "x\n" });
    const json = await l.run(["ls", "--json", "d"]);
    const doc = JSON.parse(json.out) as { schema: string; program: string; command: string; ok: boolean; exit: { name: string } };
    assertEquals([doc.schema, doc.program, doc.command, doc.ok, doc.exit.name], ["headless.envelope/1", "anyfs", "ls", true, "ok"]);
    assertEquals((await l.run(["--version"])).out, "anyfs 0.1.0");
    const badTier = await l.run(["ls", "d"], { env: { ANYFS_TIER: "root" } });
    assertEquals(badTier.code, 2);
    assertStringIncludes(badTier.err, "is not a tier");
    const reader = await l.run(["rm", "--yes", path.join(l.dir, "d/a.txt")], { env: { ANYFS_TIER: "reader" } });
    assert(reader.code !== 0);
    assertEquals(await fs.exists(path.join(l.dir, "d/a.txt")), true);
    assertEquals((await l.run(["ls", "d"], { env: { ANYFS_TIER: "reader" } })).out, "a.txt");
    const bad = await l.run(["ls", "--json", "nowhere-at-all"]);
    const failed = JSON.parse(bad.out) as { ok: boolean; exit: { name: string }; problems: { code: string }[] };
    assertEquals([failed.ok, failed.exit.name, failed.problems[0]?.code], [false, "findings", "E-FILESYSTEM"]);
  }),
);
