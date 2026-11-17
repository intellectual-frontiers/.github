/**
 * `ifws list --probe` (commons 0025-ifws FR-028, FR-029, owner decision of 2026-11-17): a module found on the `PATH` is run, to ask it for its `--ifws-manifest`, only with the person's yes for it or with
 * `--yes` (and where there is no terminal and no `--yes` the run is a usage failure that runs nothing); it is not sandboxed. The five seconds stay the default wait, `--probe-timeout SECONDS` sets
 * another, and a module that does not answer in time is an `ifws:Warning` finding that names it and the wait, while the run goes on and lists every other module. The modules are real `sh` programs
 * on a real `PATH`; the answers of a person are given to the real `main` through its `interact`, and the rest is `ifws` run as a real program.
 *
 * @module
 */
import { chmod, existsSync, mkdir, readTextFile, writeTextFile } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { execPath } from "../runtime/proc.ts";
import { main } from "../workspaces/ifws.ts";
import { MANIFEST_TIMEOUT_MS } from "../workspaces/modules/external.ts";
import { IFWS, needsWorld, withWorld, type World } from "./ifws-fixtures.ts";

const MANIFEST = JSON.stringify({ contract: 1, name: "hello", summary: "Says hello.", commands: [{ name: "greet", summary: "Greets." }] });

/** An executable `ifws-<name>` in `dir`. */
async function program(dir: string, name: string, body: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, `ifws-${name}`);
  await writeTextFile(file, `#!/bin/sh\n${body}\n`);
  await chmod(file, 0o755);
}

type Listed = {
  data: { modules: { name: string; summary: string; opaque?: string; probed?: boolean; commands?: { name: string }[] }[] };
  findings: { ruleId: string; severity: string; subject: string; message: string }[];
};

/** A world with three modules on the PATH: one that answers, one that never does, and one that answers only after a second. */
async function withModules(f: (w: World, path: string, ran: string) => Promise<void>): Promise<void> {
  await withWorld(async (w) => {
    await w.ifws("init");
    const bin = join(w.dir, "bin");
    const ran = join(w.dir, "ran.txt");
    const record = `echo "$0 $*" >> ${JSON.stringify(ran)}`;
    await program(bin, "hello", `${record}\nif [ "$1" = "--ifws-manifest" ]; then echo '${MANIFEST}'; exit 0; fi\nexit 0`);
    await program(bin, "stuck", `${record}\nexec sleep 30`);
    await program(bin, "slow", `${record}\nsleep 2\necho '${MANIFEST.replace("hello", "slow")}'`);
    await f(w, `${bin}:${w.env["PATH"] ?? process.env["PATH"] ?? ""}`, ran);
  });
}

proves(
  ["0025-ifws FR-028"],
  "list --probe runs a module found on the PATH only after the person says yes to it, or with --yes; with no terminal and no --yes it is a usage failure that runs nothing",
  async () => {
    await withModules(async (w, path, ran) => {
      // no terminal, no --yes: refused before any module runs, the modules named
      const refused = await w.ifwsOn(execPath(), IFWS, ["list", "--probe"], { PATH: path });
      assertEquals(refused.code, 2, refused.stderr);
      assertStringIncludes(refused.stderr, "no terminal to ask on");
      assertStringIncludes(refused.stderr, "--yes");
      for (const name of ["hello", "stuck", "slow"]) assertStringIncludes(refused.stderr, name);
      assert(!existsSync(ran), "a module ran before anyone said yes");
      // the person answers module by module (the real main, a terminal that says yes to hello only)
      const asked: string[] = [];
      const out: string[] = [];
      const code = await main(["list", "--probe", "--probe-timeout", "1", "--json"], {
        env: { ...w.env, PATH: path },
        cwd: w.dir,
        out: (t) => void out.push(t),
        err: () => undefined,
        interact: {
          terminal: true,
          ask: (question) => {
            asked.push(question);
            return Promise.resolve(question.includes("ifws-hello") ? "y" : "n");
          },
        },
      });
      assertEquals(asked.length, 3, "each module found on the PATH is asked about, once");
      for (const q of asked) assertStringIncludes(q, "not sandboxed");
      const listed = JSON.parse(out.join("")) as Listed;
      const row = (name: string) => listed.data.modules.find((m) => m.name === name);
      assertEquals(row("hello")?.summary, "Says hello.");
      assertEquals(row("stuck")?.probed, false, "a module the person said no to is listed as not probed");
      assertEquals(row("slow")?.probed, false);
      assertEquals(
        listed.findings.filter((f) => f.ruleId === "ifws/module-probe-timeout"),
        [],
        "a declined module is not a timeout",
      );
      assertEquals(code, 0);
      const log = await readTextFile(ran);
      assertStringIncludes(log, "ifws-hello --ifws-manifest");
      assert(!log.includes("ifws-stuck") && !log.includes("ifws-slow"), "a module the person refused ran");
      // --yes: every module is run, with no question
      const asking: string[] = [];
      const all = await main(["list", "--probe", "--yes", "--probe-timeout", "1", "--json"], {
        env: { ...w.env, PATH: path },
        cwd: w.dir,
        out: () => undefined,
        err: () => undefined,
        interact: { terminal: true, ask: (q) => (asking.push(q), Promise.resolve("n")) },
      });
      assertEquals(asking, [], "--yes asked");
      assertEquals(all, 1, "the module that did not answer is a warning");
      assertStringIncludes(await readTextFile(ran), "ifws-stuck --ifws-manifest");
    });
  },
  needsWorld,
);

proves(
  ["0025-ifws FR-029"],
  "the wait for --ifws-manifest is five seconds by default and --probe-timeout sets another; a module that does not answer in time is an ifws:Warning that names it and the wait, listed as opaque, and the run goes on",
  async () => {
    await withModules(async (w, path) => {
      assertEquals(MANIFEST_TIMEOUT_MS, 5000);
      const [program, controller] = [execPath(), IFWS];
      const started = Date.now();
      const r = await w.ifwsOn(program, controller, ["list", "--probe", "--yes", "--probe-timeout", "1", "--json"], { PATH: path });
      const took = Date.now() - started;
      assert(took < 20_000, `the stuck module was waited for ${took} ms`);
      const listed = JSON.parse(r.stdout) as Listed;
      // not a failure of the run: a finding (status 1), every other module listed, the one that answered typed
      assertEquals(r.code, 1, r.stderr);
      const found = listed.findings.filter((f) => f.ruleId === "ifws/module-probe-timeout");
      assertEquals(found.map((f) => [f.subject, f.severity]).sort(), [
        ["slow", "Warning"],
        ["stuck", "Warning"],
      ]);
      for (const f of found) assertStringIncludes(f.message, "did not answer --ifws-manifest in 1 second");
      const row = (name: string) => listed.data.modules.find((m) => m.name === name);
      assertEquals(row("hello")?.summary, "Says hello.");
      assertEquals(
        row("hello")?.commands?.map((c) => c.name),
        ["greet"],
      );
      assertEquals(row("stuck")?.opaque, "no answer in 1 second");
      assert(
        listed.data.modules.some((m) => m.name === "doctor"),
        "the built-in modules are still listed",
      );
      // a longer wait lets the slow module answer: only the stuck one is a finding
      const longer = await w.ifwsOn(program, controller, ["list", "--probe", "--yes", "--probe-timeout", "4", "--json"], { PATH: path });
      const again = JSON.parse(longer.stdout) as Listed;
      assertEquals(
        again.findings.filter((f) => f.ruleId === "ifws/module-probe-timeout").map((f) => f.subject),
        ["stuck"],
      );
      const slow = again.data.modules.find((m) => m.name === "slow");
      assertEquals(slow?.opaque, undefined, "a longer wait lets it answer");
      assertEquals(
        slow?.commands?.map((c) => c.name),
        ["greet"],
      );
      // a wait that is not a whole number of seconds is a usage failure
      assertEquals((await w.ifwsOn(program, controller, ["list", "--probe", "--probe-timeout", "0"], { PATH: path })).code, 2);
      assertEquals((await w.ifwsOn(program, controller, ["list", "--probe", "--probe-timeout", "soon"], { PATH: path })).code, 2);
    });
  },
  needsWorld,
);
