/**
 * Tests of the module convention of `ergonex` as pure functions (commons 0001-ergonex FR-004 to FR-008, FR-010, FR-011, FR-022): the name of a module and the nearest names to a typo, the order of the
 * three sources and the module a later source hides, a registered module's `modules.auto.json` and its pinned hash, the answer of an external module to `--ergonex-manifest` and its JSON Schema made from
 * the same fields, the four exit statuses, and a command declared on Headless that parses its words once and is given its options as a typed value. The sources are lists a test writes; the programs themselves
 * are run by `ergonex-command.test.ts`.
 *
 * @module
 */
import { run, type Io } from "@intellectual-frontiers/headless/cli";
import { programOf } from "@intellectual-frontiers/headless/logical";
import { flag } from "../src/platform/k-args.ts";
import { defineCommand, type Host } from "../src/commands/define.ts";
import { HOME, reads } from "../src/commands/options.ts";
import type { Finding } from "../src/findings.ts";
import { err, ok } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto";
import { exitStatuses, moduleSources } from "./vocabulary.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { CONTRACT_VERSION, decodeExternalManifest, externalManifestSchema } from "../src/modules/external.ts";
import { moduleName, nearestNames } from "../src/modules/name.ts";
import {
  decodeRegistered,
  findModule,
  hiddenFindings,
  programMatches,
  resolveAll,
  type Candidates,
  type Found,
} from "../src/modules/registry.ts";
import { EXIT_STATUSES, exitCodeOf, MODULE_SOURCES, type Outcome, precedenceOf } from "../src/modules/types.ts";

const found = (name: string, source: Found["source"], where: string): Found => ({ name, source, summary: `the ${name} module`, where });

proves(
  ["0001-ergonex FR-005"],
  "a module name is lower-case letters, digits and hyphens, beginning with a letter, at most 32 characters; anything else is refused and never reaches a shell",
  () => {
    for (const ok of ["doctor", "a", "a1-b2", "x".repeat(32)]) assertEquals(moduleName(ok).kind, "ok", ok);
    for (const bad of ["", "../x", "a b", "A", "1a", "-a", "a/b", "a\\b", "a;b", "a$(x)", "a.b", "x".repeat(33), "é", "a\nb"]) {
      assertEquals(moduleName(bad).kind, "err", JSON.stringify(bad));
    }
    const r = moduleName("../x");
    assert(r.kind === "err" && r.error.kind === "bad-start");
  },
);

proves(
  ["0001-ergonex FR-006"],
  "an unknown name is answered with up to three modules within an edit distance of two, nearest first, or none",
  () => {
    const names = ["workspace", "worktree", "status", "doctor", "plan", "apply", "render", "list", "shell", "verify", "init"];
    assertEquals(nearestNames("wrkspace", names), ["workspace"]);
    assertEquals(nearestNames("statsu", names), ["status"]);
    assertEquals(nearestNames("worktre", names), ["worktree"]);
    assertEquals(nearestNames("zzzzzzzz", names), []);
    const many = nearestNames("lan", ["plan", "clan", "slan", "flan", "list"]);
    assertEquals(many.length, 3);
    assert(many.every((n) => n.endsWith("lan")));
  },
);

proves(
  ["0001-ergonex FR-004", "0001-ergonex FR-003"],
  "a module is found in the order built-in, registered, path; the first runs and a module of a later source that it hides is an informational finding",
  () => {
    const c: Candidates = {
      builtIn: [found("doctor", "BuiltIn", "built-in"), found("plan", "BuiltIn", "built-in")],
      registered: [found("hello", "Registered", "/opt/hello"), found("plan", "Registered", "/opt/plan")],
      path: [
        found("doctor", "Path", "/usr/bin/ergonex-doctor"),
        found("hello", "Path", "/usr/bin/ergonex-hello"),
        found("zeta", "Path", "/usr/bin/ergonex-zeta"),
      ],
    };
    const r = resolveAll(c);
    assertEquals(
      r.modules.map((m) => [m.name, m.source]),
      [
        ["doctor", "BuiltIn"],
        ["hello", "Registered"],
        ["plan", "BuiltIn"],
        ["zeta", "Path"],
      ],
    );
    assertEquals(findModule(c, "doctor")?.where, "built-in");
    assertEquals(findModule(c, "nope"), undefined);
    const fs = hiddenFindings(r, "2026-11-17");
    assertEquals(fs.map((f) => [f.ruleId, f.severity, f.subject]).sort(), [
      ["ergonex/module-hidden", "Informational", "doctor"],
      ["ergonex/module-hidden", "Informational", "hello"],
      ["ergonex/module-hidden", "Informational", "plan"],
    ]);
    assertStringIncludes(fs.find((f) => f.subject === "doctor")?.message ?? "", "/usr/bin/ergonex-doctor");
    assertEquals([...MODULE_SOURCES].map(precedenceOf), [1, 2, 3]);
  },
);

proves(
  ["0001-ergonex FR-004", "0001-ergonex FR-010"],
  "the order of the sources and the four statuses are the ones of the ontology's code lists",
  () => {
    assertEquals(
      Object.entries(moduleSources)
        .sort(([, a], [, b]) => a.values.precedence - b.values.precedence)
        .map(([k]) => k),
      [...MODULE_SOURCES],
    );
    for (const s of MODULE_SOURCES) assertEquals(precedenceOf(s), moduleSources[s].values.precedence);
    assertEquals([...EXIT_STATUSES].sort(), Object.keys(exitStatuses).sort());
    for (const s of EXIT_STATUSES) assertEquals(exitCodeOf(s), exitStatuses[s].values.exitCode);
  },
);

proves(
  ["0001-ergonex FR-011"],
  "a registered module names its program and may pin its SHA-256; a name, a hash or a duplicate that is wrong is refused",
  async () => {
    const hash = await sha256("the program");
    const text = JSON.stringify({
      modules: [
        {
          name: "hello",
          program: "/opt/ergonex-hello",
          sha256: hash,
          summary: "Says hello.",
        },
        { name: "plain", program: "/opt/p" },
      ],
    });
    const r = decodeRegistered(text);
    assert(r.kind === "ok");
    if (r.kind !== "ok") return;
    assertEquals(
      r.value.map((m) => m.name),
      ["hello", "plain"],
    );
    const hello = r.value[0];
    assert(hello !== undefined);
    if (hello === undefined) return;
    assert(programMatches(hello, hash));
    assert(!programMatches(hello, await sha256("another program")));
    const plain = r.value[1];
    assert(plain !== undefined && programMatches(plain, await sha256("anything")), "a module with no pin matches");
    for (const bad of [
      { modules: [{ name: "Bad Name", program: "/p" }] },
      { modules: [{ name: "a", program: "/p", sha256: "abc" }] },
      {
        modules: [
          { name: "a", program: "/p" },
          { name: "a", program: "/q" },
        ],
      },
      { modules: "none" },
    ]) {
      assertEquals(decodeRegistered(JSON.stringify(bad)).kind, "err", JSON.stringify(bad));
    }
    assertEquals(decodeRegistered("not json").kind, "err");
  },
);

proves(
  ["0001-ergonex FR-008"],
  "an external module's answer to --ergonex-manifest is checked by a typed decoder, and its JSON Schema is made from the same fields",
  () => {
    const good = {
      contract: CONTRACT_VERSION,
      name: "hello",
      summary: "Says hello.",
      commands: [{ name: "greet", summary: "Greets." }],
    };
    const r = decodeExternalManifest(JSON.stringify(good));
    assert(r.kind === "ok");
    if (r.kind === "ok")
      assertEquals(
        r.value.commands.map((c) => c.name),
        ["greet"],
      );
    for (const bad of [
      "",
      "not json",
      "{}",
      JSON.stringify({ ...good, contract: 99 }),
      JSON.stringify({ ...good, name: "../x" }),
      JSON.stringify({ ...good, commands: [{ name: 1 }] }),
      JSON.stringify({ ...good, summary: 3 }),
    ]) {
      assertEquals(decodeExternalManifest(bad).kind, "err", bad);
    }
    const schema = externalManifestSchema();
    assertEquals(schema["$schema"], "https://json-schema.org/draft/2020-12/schema");
    assertEquals(schema["required"], ["contract", "name", "summary", "commands"]);
    // every field the schema requires is one the decoder reads: dropping any one makes the decoder refuse
    for (const field of ["contract", "name", "summary", "commands"] as const) {
      const without = Object.fromEntries(Object.entries(good).filter(([k]) => k !== field));
      assertEquals(decodeExternalManifest(JSON.stringify(without)).kind, "err", field);
    }
    const properties = schema["properties"];
    assert(typeof properties === "object" && properties !== null && !Array.isArray(properties));
    assertEquals(Object.keys(properties).sort(), ["commands", "contract", "name", "summary"]);
  },
);

const IO: Io = {
  env: () => undefined,
  os: "linux",
  terminal: { stdin: false, stdout: false, stderr: false },
  columns: undefined,
  now: () => 0,
  pid: 1,
  readLine: () => Promise.resolve(undefined),
};

const hostOf = (): Host => ({
  env: {},
  cwd: "/",
  today: "2026-11-17",
  platform: { os: "linux", arch: "x86_64", windows: false },
  places: undefined,
  builtins: [],
  homeFor: (o) => o ?? "/home",
  stdin: () => Promise.resolve(""),
  argv: [],
  now: () => 0,
  run: { failure: undefined },
});

proves(
  ["0001-ergonex FR-007", "0001-ergonex FR-022"],
  "a command declared on Headless parses its words once into a typed value, answers help without running, and refuses an option it does not know with status 2 and without running",
  async () => {
    let ran = 0;
    const seen: unknown[] = [];
    const greet = defineCommand({
      name: "greet",
      summary: "Greets.",
      options: { ...HOME, loud: flag({ help: "Shout." }) },
      action: reads(),
      run: (ctx, args) => {
        ran++;
        seen.push([args.options.loud, ctx.home, ctx.mode]);
        return Promise.resolve(ok({ text: "hello", data: { loud: args.options.loud }, findings: [] }));
      },
    });
    const program = programOf({ name: "ergonex", summary: "x", version: "0.0.0", children: [greet(hostOf())] });
    const a = await run(program, ["greet", "--loud", "--home", "/w", "--no-color"], IO);
    assertEquals([a.code, a.out], [0, "hello\n"]);
    assertEquals(seen, [[true, "/w", "apply"]]);
    const help = await run(program, ["greet", "--help"], IO);
    assertEquals(help.code, 0);
    assertStringIncludes(help.out, "--loud");
    assertStringIncludes(help.out, "--home");
    assertEquals(ran, 1, "help ran the command");
    const unknown = await run(program, ["greet", "--louder"], IO);
    assertEquals(unknown.code, 2);
    assertStringIncludes(unknown.err, "did you mean --loud");
    assertEquals(ran, 1, "a usage error ran the command");
    const positional = await run(program, ["greet", "extra"], IO);
    assertEquals(positional.code, 2);
  },
);

proves(
  ["0001-ergonex FR-010", "0001-ergonex FR-022"],
  "a finding of severity error or warning fails the run (status 1), an informational finding alone does not, and a failure of the body is recorded as usage or environment for the program's statuses 2 and 3",
  async () => {
    const finding = (severity: Finding["severity"]): Finding => ({ ruleId: "ergonex/generated-drift", severity, message: "x is not written", subject: "x", firstSeen: "2026-11-17" });
    const host = hostOf();
    const make = (name: string, body: () => Promise<Outcome>) =>
      defineCommand({ name, summary: name, options: { ...HOME }, action: reads(), run: body })(host);
    const program = programOf({
      name: "ergonex",
      summary: "x",
      version: "0.0.0",
      children: [
        make("warned", () => Promise.resolve(ok({ text: "", data: null, findings: [finding("Warning")] }))),
        make("noted", () => Promise.resolve(ok({ text: "", data: null, findings: [finding("Informational")] }))),
        make("broken", () => Promise.resolve(err({ kind: "environment" as const, message: "no git" }))),
      ],
    });
    const warned = await run(program, ["warned"], IO);
    assertEquals(warned.code, 1);
    assertStringIncludes(warned.err, "[E-GENERATED-DRIFT]");
    assertEquals((await run(program, ["noted"], IO)).code, 0);
    assertEquals(host.run.failure, undefined);
    const broken = await run(program, ["broken"], IO);
    assertEquals(broken.code, 1);
    assertEquals(host.run.failure, "environment");
  },
);
