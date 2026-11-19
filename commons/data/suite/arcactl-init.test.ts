// Spec: 0047-arcactl-init FR-011, FR-012, FR-013, FR-014, FR-015
/**
 * `arcactl init` and the discovery of instances (commons data 0047-arcactl-init FR-011 to FR-015), in a temporary home: the instances found from each source and looked at over a real socket; the
 * workstation set up (service, password, `psql`, shell profile) with the real `psql` and shell using it afterwards; running it again, undoing it, refusing it on a server, and the checks of the
 * workstation finding what is wrong.
 *
 * @module
 */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { invariants } from "@intellectual-frontiers/data/sql/extensions/invariants";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import {
  type Candidate,
  type Connection,
  discover,
  emptyState,
  main,
  type Paths,
  passwordFor,
  pathsOf,
  type Prompter,
  probe,
  readState,
  schemaOf,
  stateText,
  settingsOf,
  urlOf,
  workspaceConfigs,
  workstationChecks,
} from "@intellectual-frontiers/data/sql/cli";
import { passwordServer, pgliteServer, run } from "./net-fixtures.ts";
import { same } from "./governance-fixture.ts";

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const statements = must(bind(must(schemaOf(must(settingsOf({ models: ["identityAgent"] })))).schema, { dialect: postgres, schema: "arca", sources: [invariants()] })).statements.map((s) => s.sql);
const home = (): { dir: string; paths: Paths; env: Record<string, string> } => {
  const dir = mkdtempSync(join(tmpdir(), "arcactl-init-"));
  const env = { HOME: dir, SHELL: "/bin/bash", PATH: process.env["PATH"] ?? "/usr/bin" };
  return { dir, paths: must(pathsOf({ platform: "linux", env })), env };
};
const init = (env: Record<string, string>, args: string[], extra: Record<string, unknown> = {}) => main(["init", ...args], { env, cwd: "/nowhere", tty: true, platform: "linux", ...extra });
const mode = (p: string): number => statSync(p).mode & 0o777;

proves(
  ["0047-arcactl-init FR-011"],
  "discovery finds the instances from the connection given, libpq's environment, the service file, the hosts `.pgpass` has passwords for, what arcactl knows and (where asked) this machine, makes one of the same place, names it by its service, never takes a wildcard host, drops the password of a URL, and finds the arca.config.ts of an Ergonex workspace",
  () => {
    const { dir, paths, env } = home();
    try {
      writeFileSync(paths.pgServiceFile, "[staging]\nhost=stg.example\nport=5433\ndbname=arca\nuser=ann\nsslmode=require\n\n[nohost]\ndbname=x\n");
      writeFileSync(paths.pgpass, "stg.example:5433:arca:ann:pw1\n*:5432:*:bob:pw2\nprod.example:5432:*:carl:pw3\nlocalhost:5432:db:dan:pw4\n", { mode: 0o600 });
      const ws = join(dir, "workspace");
      mkdirSync(join(ws, "repo-a", "deep"), { recursive: true });
      mkdirSync(join(ws, "repo-b", "node_modules", "x"), { recursive: true });
      writeFileSync(join(ws, "repo-a", "arca.config.ts"), "export default {}");
      writeFileSync(join(ws, "repo-a", "deep", "arca.config.ts"), "export default {}");
      writeFileSync(join(ws, "repo-b", "node_modules", "x", "arca.config.ts"), "ignored");
      const known = { ...emptyState, instances: [{ name: "mine", host: "mine.example", port: 5432, database: "arca", user: "me" }] };
      const r = discover({ paths, env: { ...env, PGHOST: "env.example", PGPORT: "6000", PGUSER: "eve", PGSERVICE: "from-env" }, url: "postgres://urluser:s3cretpw@url.example:5440/urldb?sslmode=disable", local: true, state: known, workspace: ws });
      const by = Object.fromEntries(r.candidates.map((c) => [c.name, c]));
      same(Object.keys(by).toSorted(), ["from-env", "local", "localhost", "mine", "prod.example", "given", "staging"].toSorted());
      same([by["staging"]?.host, by["staging"]?.port, by["staging"]?.database, by["staging"]?.user, by["staging"]?.sslmode, by["staging"]?.userService], ["stg.example", 5433, "arca", "ann", "require", true]);
      assert(by["staging"]?.sources.includes("pg_service.conf") && by["staging"]?.sources.includes(".pgpass"), JSON.stringify(by["staging"]));
      same([by["given"]?.user, by["given"]?.port, by["given"]?.database], ["urluser", 5440, "urldb"]);
      assert(!JSON.stringify(r).includes("s3cretpw"), "the URL's password is dropped");
      assert(!r.candidates.some((c) => c.host === "*" || c.host === undefined || c.name === "nohost"), "no wildcard, no service without a host");
      same([by["mine"]?.sources, by["local"]?.host], [["arcactl"], "127.0.0.1"]);
      same(by["prod.example"]?.user, "carl");
      same(r.configs.map((c) => c.slice(ws.length + 1)), ["repo-a/arca.config.ts", "repo-a/deep/arca.config.ts"]);
      same(workspaceConfigs(join(dir, "none")), []);
      same(workspaceConfigs(ws, 0), []);
      // the same place from two sources is one, with the service's name and both sources
      const two = discover({ paths, env, state: emptyState });
      same(two.candidates.filter((c) => c.host === "stg.example").length, 1);
      // passwords are looked up as libpq reads them
      same([passwordFor(paths, { host: "stg.example", port: 5433, database: "arca", user: "ann" }), passwordFor(paths, { host: "any.example", port: 5432, database: "d", user: "bob" }), passwordFor(paths, { host: "stg.example", port: 5433, database: "arca", user: "zed" }), passwordFor(paths, { host: "prod.example", user: "carl" })], ["pw1", "pw2", undefined, "pw3"]);
      same(urlOf({ name: "x", sources: [], host: "h", port: 5, database: "d b", user: "u@x", sslmode: "require" }, "p:w/d@"), "postgres://u%40x:p%3Aw%2Fd%40@h:5/d%20b?sslmode=require");
      same(urlOf({ name: "x", sources: [] }), "postgres://127.0.0.1:5432/postgres");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

proves(["0047-arcactl-init FR-011"], "the state is written in a stable order, so that the same state is the same text, and a state file that is not one is said", () => {
  const a = { name: "a-one" };
  const b = { name: "b-two" };
  same(stateText({ version: 1, instances: [b, a], profiles: [] }), stateText({ version: 1, instances: [a, b], profiles: [] }));
  assert(stateText({ version: 1, instances: [b, a], profiles: [] }).indexOf("a-one") < stateText({ version: 1, instances: [b, a], profiles: [] }).indexOf("b-two"));
  const { dir, paths } = home();
  try {
    mkdirSync(join(paths.config), { recursive: true });
    writeFileSync(paths.instances, "not json");
    assert(readState(paths).kind === "err");
    writeFileSync(paths.instances, JSON.stringify({ version: 2 }));
    assert(readState(paths).kind === "err");
    writeFileSync(paths.instances, JSON.stringify({ version: 1, instances: [{ host: "h" }] }));
    assert(readState(paths).kind === "err");
    same(must(readState({ ...paths, instances: join(dir, "none.json") })), emptyState);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

proves(
  ["0047-arcactl-init FR-012"],
  "looking at an instance reads and changes nothing: it says whether it is reached, as whom, what that role could do (read, migrate, migrate and guard) and which arca models it has, and says why it is not reached without the password",
  async () => {
    const server = await pgliteServer(statements);
    try {
      const { connect } = await import("@intellectual-frontiers/data/sql/cli");
      const c: Candidate = { name: "p", sources: [], host: "127.0.0.1", port: server.port, database: "postgres", user: "postgres", sslmode: "disable" };
      const p = await probe(connect, c, undefined, "arca");
      assert(p.reachable && p.user === "postgres" && p.superuser === true && p.level === "migrate+guard" && /^PostgreSQL/.test(p.version ?? ""), JSON.stringify(p));
      assert(p.arca.exists && p.arca.tables > 70 && p.arca.models.includes("identityAgent") && p.arca.models.includes("arcaParty") && p.arca.models.includes("identity") && !p.arca.models.includes("issues"), JSON.stringify(p.arca));
      const other = await probe(connect, c, undefined, "nothing_here");
      same([other.reachable, other.arca.exists, other.arca.models], [true, false, []]);
      // nothing was changed by looking
      same((await server.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'arca'`)).rows[0]?.n, p.arca.tables);
      // not reached, and the password is not in what is said
      const dead = await probe(connect, { ...c, port: 1, user: "app" }, "never-shown", "arca");
      assert(!dead.reachable && dead.level === "none" && dead.error !== undefined && !dead.error.includes("never-shown"), JSON.stringify(dead));
    } finally {
      await server.close();
    }
    // what a role could do, from what the database says of it
    const answers = (su: boolean, cdb: boolean, schemaCreate: boolean, exists: boolean): ((o: unknown) => Promise<Connection>) => async () => ({
      kind: "custom",
      close: async () => undefined,
      driver: {
        exec: async () => undefined,
        query: async (q) => {
          if (q.includes("version()")) return [{ v: "PostgreSQL 16.1 on x", u: "role", su, cdb }];
          if (q.includes("information_schema.tables")) return exists ? [{ t: "tenant" }] : [];
          if (q.includes("information_schema.schemata")) return exists ? [{ x: 1 }] : [];
          if (q.includes("has_schema_privilege")) return [{ ok: schemaCreate }];
          return [];
        },
      },
    });
    const level = async (su: boolean, cdb: boolean, sc: boolean, exists: boolean) => (await probe(answers(su, cdb, sc, exists), { name: "x", sources: [], host: "h" }, undefined)).level;
    same([await level(true, false, false, true), await level(false, false, true, true), await level(false, false, false, true), await level(false, true, false, false), await level(false, false, false, false)], ["migrate+guard", "migrate", "read", "migrate", "read"]);
  },
);

proves(
  ["0047-arcactl-init FR-013"],
  "init sets up the workstation and no database: the service, the password in .pgpass alone, the psql files and the shell profile, shown first and made only where agreed, the same again changes nothing, and the real psql and a real shell then reach the instance by what was written",
  async () => {
    const server = await pgliteServer(statements);
    const { dir, paths, env } = home();
    try {
      const args = ["--instance", "prod-main", "--host", "127.0.0.1", "--port", String(server.port), "--database", "postgres", "--user", "postgres", "--sslmode", "disable", "--env", "dev", "--password-stdin", "--shell", "bash"];
      const stdin = async () => "the:pa\\ss'word\n";
      // asked to show the plan: nothing is written
      const dry = await init(env, [...args, "--dry-run"], { stdin });
      same(dry.code, 0, dry.err);
      assert(dry.out.includes("create") && dry.out.includes(paths.pgpass) && dry.out.includes("(dry run: nothing was written)") && !dry.out.includes("the:pa"), dry.out);
      assert(!existsSync(paths.pgpass) && !existsSync(paths.pgServiceFile) && !existsSync(paths.instances), "a dry run writes nothing");
      // no --yes, nobody to ask: the plan is shown and nothing is written, code 1
      const nobody = await init(env, args, { stdin });
      assert(nobody.code === 1 && nobody.out.includes("run it again with --yes") && !existsSync(paths.pgpass), nobody.out);
      // agreed
      const done = await init(env, [...args, "--yes"], { stdin });
      same(done.code, 0, done.out + done.err);
      assert(!done.out.includes("the:pa\\ss") && !done.out.includes("pa\\\\ss"), "the password is not shown");
      assert(done.out.includes("Checking your workstation:") && done.out.includes("PASS  ARCA-W006"), done.out);
      same(mode(paths.pgpass), 0o600);
      const pgpass = readFileSync(paths.pgpass, "utf8");
      assert(pgpass.includes(`127.0.0.1:${server.port}:postgres:postgres:the\\:pa\\\\ss'word`), pgpass);
      for (const f of [paths.pgServiceFile, paths.psqlrc, paths.arcaPsqlrc, paths.instances, join(paths.cache, "shell.bash"), join(dir, ".bashrc")]) assert(existsSync(f) && !readFileSync(f, "utf8").includes("pa\\ss") && !readFileSync(f, "utf8").includes("the:pa"), `${f} holds no password`);
      const st = must(readState(paths));
      same([st.default, st.instances[0]?.name, st.instances[0]?.ownsService, st.profiles[0]?.shell], ["prod-main", "prod-main", true, "bash"]);
      assert(readFileSync(join(dir, ".bashrc"), "utf8").includes("# >>> arcactl:shell >>>"));
      // again: nothing to change, nothing rewritten
      const before = [paths.pgpass, paths.pgServiceFile, paths.instances, join(dir, ".bashrc")].map((f) => statSync(f).mtimeMs);
      const again = await init(env, [...args, "--yes"], { stdin });
      same(again.code, 0, again.out + again.err);
      assert(again.out.includes("nothing to change") && !again.out.includes("done "), again.out);
      same([paths.pgpass, paths.pgServiceFile, paths.instances, join(dir, ".bashrc")].map((f) => statSync(f).mtimeMs), before);
      // the real psql, and a real bash that sources the profile, reach it by what was written
      const base = { PATH: env["PATH"] as string, HOME: dir, PGCONNECT_TIMEOUT: "5" };
      const viaService = await run("psql", ["-X", "-Atc", "select 'in'", "service=prod-main"], base);
      same([viaService.code, viaService.out.trim()], [0, "in"], viaService.err);
      const shell = await run("bash", ["--noprofile", "--norc", "-c", `source ${join(dir, ".bashrc")}; echo "$ARCA_INSTANCE $ARCA_ENV $PGSERVICE"; psql -Atc "select 'via shell'"`], { ...base, SHELL: "/bin/bash" });
      same(shell.out.trim().split("\n"), ["prod-main dev prod-main", "via shell"], shell.err);
      const psqlrc = await run("psql", ["-Atc", "\\echo :arca_instance"], { ...base, PGSERVICE: "prod-main", ARCA_INSTANCE: "prod-main" });
      same(psqlrc.out.trim(), "prod-main", psqlrc.err);
    } finally {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

proves(
  ["0047-arcactl-init FR-013", "0047-arcactl-init FR-014"],
  "init asks a person what it needs and changes nothing they decline, leaves their own lines and the block of Ergonex where they are, uses a service they defined themselves, and undo takes away only what init put in",
  async () => {
    const server = await pgliteServer();
    const { dir, paths, env } = home();
    try {
      writeFileSync(join(dir, ".bashrc"), "export MINE=1\n\n# >>> ergonex >>>\nexport ERGONEX_HOME=\"$HOME/workspaces\"\n# <<< ergonex <<<\n");
      writeFileSync(paths.pgpass, "other.example:5432:*:me:keep\n", { mode: 0o600 });
      writeFileSync(paths.pgServiceFile, `[theirs]\nhost=127.0.0.1\nport=${server.port}\ndbname=postgres\nuser=postgres\nsslmode=disable\n`);
      writeFileSync(paths.psqlrc, "\\set MY 1\n");
      const answers: string[] = ["theirs", "dev"];
      const asked: string[] = [];
      let confirms = 0;
      const prompt = (confirm: boolean): Prompter => ({
        interactive: true,
        ask: async (q, fallback) => (asked.push(q), answers.shift() ?? fallback),
        secret: async (q) => (asked.push(q), "typed-secret"),
        confirm: async (q) => (asked.push(q), confirms++, confirm),
      });
      // declined: nothing is written
      const declined = await init(env, ["--shell", "bash"], { prompt: prompt(false) });
      assert(declined.code === 1 && declined.out.includes("nothing was written"), declined.out);
      same(readFileSync(paths.pgpass, "utf8"), "other.example:5432:*:me:keep\n");
      assert(!existsSync(paths.instances));
      answers.push("theirs", "dev");
      // agreed
      const ok = await init(env, ["--shell", "bash"], { prompt: prompt(true) });
      same(ok.code, 0, ok.out + ok.err);
      assert(asked.some((q) => q.includes("default")) && asked.some((q) => q.startsWith("Password of postgres@127.0.0.1")) && confirms === 2, JSON.stringify(asked));
      const st = must(readState(paths));
      same([st.default, st.instances[0]?.ownsService], ["theirs", undefined], "their service is theirs");
      assert(!readFileSync(paths.pgServiceFile, "utf8").includes("arcactl:services"), "no service of ours is written over theirs");
      const pg = readFileSync(paths.pgpass, "utf8");
      assert(pg.startsWith("other.example:5432:*:me:keep\n") && pg.includes(`127.0.0.1:${server.port}:postgres:postgres:typed-secret`));
      const rc = readFileSync(join(dir, ".bashrc"), "utf8");
      assert(rc.startsWith("export MINE=1\n") && rc.includes("# >>> ergonex >>>") && rc.includes("# >>> arcactl:shell >>>") && rc.indexOf("ergonex <<<") < rc.indexOf("arcactl:shell >>>"), rc);
      assert(readFileSync(paths.psqlrc, "utf8").startsWith("\\set MY 1\n"));
      // undo: only what init put in
      const undo = await init(env, ["--undo", "--yes"]);
      same(undo.code, 0, undo.out + undo.err);
      same(readFileSync(paths.pgpass, "utf8"), "other.example:5432:*:me:keep\n");
      same(readFileSync(join(dir, ".bashrc"), "utf8"), "export MINE=1\n\n# >>> ergonex >>>\nexport ERGONEX_HOME=\"$HOME/workspaces\"\n# <<< ergonex <<<\n");
      same(readFileSync(paths.psqlrc, "utf8"), "\\set MY 1\n");
      assert(readFileSync(paths.pgServiceFile, "utf8").startsWith("[theirs]"));
      assert(!existsSync(paths.instances) && !existsSync(join(paths.cache, "shell.bash")), "its state and cache are gone");
      const nothing = await init(env, ["--undo", "--yes"]);
      assert(nothing.out.includes("nothing to change"), nothing.out);
    } finally {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

proves(
  ["0047-arcactl-init FR-013"],
  "init is for a workstation: a server run refuses it and writes nothing, an option, a model, a name or a shell that is not valid is refused before anything is written, a URL's password is not shown, and a file whose markers are broken is not changed",
  async () => {
    const { dir, paths, env } = home();
    try {
      const server = await main(["init", "--instance", "x", "--host", "h", "--yes"], { env, cwd: "/n", tty: false });
      assert(server.code === 2 && server.err.includes("this run is a server") && !existsSync(paths.instances), server.err);
      const ci = await main(["init", "--instance", "x", "--host", "h", "--yes"], { env: { ...env, CI: "true" }, cwd: "/n", tty: true });
      assert(ci.code === 2 && ci.err.includes("CI is set"), ci.err);
      const forced = await init({ ...env, CI: "true" }, ["--interactive", "--instance", "x", "--host", "127.0.0.1", "--port", "1", "--yes", "--no-psql", "--shell", "none"]);
      assert(forced.code === 1 && existsSync(paths.instances), "--interactive says a person is there; the instance is not reached, so the check fails");
      rmSync(paths.instances);
      rmSync(paths.pgServiceFile);
      const bad: [string[], string][] = [
        [["--frobnicate"], "no option"],
        [["--instance", "x", "--host", "h", "--models", "nope", "--yes"], "not one of"],
        [["--instance", "Bad Name", "--host", "h", "--yes"], "name"],
        [["--instance", "x", "--host", "h", "--shell", "csh", "--yes"], "not a shell"],
        [["--instance", "x", "--host", "h", "--password-stdin", "--yes"], "needs --user"],
        [["--instance", "nohost", "--yes"], "no --host"],
        [["--instance", "x", "--host", "h", "--port", "70000", "--yes"], "port"],
      ];
      for (const [args, text] of bad) {
        const r = await init(env, args, { stdin: async () => "pw\n" });
        assert(r.code === 2 && r.err.toLowerCase().includes(text.toLowerCase()) && r.out === "", `${args.join(" ")}: ${r.err}`);
      }
      assert(!existsSync(paths.instances) && !existsSync(paths.pgpass) && !existsSync(paths.pgServiceFile), "nothing was written");
      // a URL given with a password: not shown
      const url = await init(env, ["--url", "postgres://u:urlpw1234@127.0.0.1:1/db", "--instance", "u1", "--yes", "--shell", "none", "--no-psql"]);
      assert(!url.out.includes("urlpw1234") && !url.err.includes("urlpw1234"), url.out);
      rmSync(paths.instances, { force: true });
      // broken markers: refused, and the file is as it was
      writeFileSync(join(dir, ".bashrc"), "# >>> arcactl:shell >>>\nbroken\n");
      const broken = await init(env, ["--instance", "x", "--host", "127.0.0.1", "--port", "1", "--shell", "bash", "--yes", "--no-psql"]);
      assert(broken.code === 2 && broken.err.includes("markers") && readFileSync(join(dir, ".bashrc"), "utf8") === "# >>> arcactl:shell >>>\nbroken\n", broken.err);
      assert(!existsSync(paths.pgServiceFile), "and nothing else was written either");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

proves(
  ["0047-arcactl-init FR-015"],
  "the workstation checks find what is wrong: psql missing or old, a password file libpq would ignore, a missing service, a stale or changed psql file, a profile whose block or cache is gone or out of date, and an instance that is not reached; and they run as doctor --scope workstation",
  async () => {
    const server = await pgliteServer();
    const { dir, paths, env } = home();
    try {
      const args = ["--instance", "w1", "--host", "127.0.0.1", "--port", String(server.port), "--database", "postgres", "--user", "postgres", "--sslmode", "disable", "--password-stdin", "--shell", "bash", "--yes"];
      assert((await init(env, args, { stdin: async () => "pw\n" })).code === 0);
      const doctor = async (extra: Record<string, unknown> = {}, more: string[] = []) => {
        const r = await main(["doctor", "--scope", "workstation", "--json", ...more], { env, cwd: "/n", tty: true, platform: "linux", ...extra });
        return { code: r.code, ...(JSON.parse(r.out) as { results: { id: string; status: string; detail: string; next?: string }[] }) };
      };
      const status = (d: { results: { id: string; status: string }[] }, id: string): string | undefined => d.results.find((x) => x.id === id)?.status;
      const good = await doctor();
      same([good.code, good.results.map((r) => r.status)], [0, ["pass", "pass", "pass", "pass", "pass", "pass"]], JSON.stringify(good.results));
      // psql
      same(status(await doctor({ psqlVersion: () => undefined }), "ARCA-W001"), "fail");
      same(status(await doctor({ psqlVersion: () => "psql (PostgreSQL) 13.4" }), "ARCA-W001"), "warn");
      // the password file
      chmodSync(paths.pgpass, 0o644);
      const loose = await doctor();
      assert(status(loose, "ARCA-W002") === "fail" && loose.results.find((x) => x.id === "ARCA-W002")?.detail.includes("ignores"), JSON.stringify(loose.results[1]));
      chmodSync(paths.pgpass, 0o600);
      // the service, the psql files
      const svc = readFileSync(paths.pgServiceFile, "utf8");
      writeFileSync(paths.pgServiceFile, "");
      same(status(await doctor(), "ARCA-W003"), "fail");
      writeFileSync(paths.pgServiceFile, svc);
      const own = readFileSync(paths.arcaPsqlrc, "utf8");
      writeFileSync(paths.arcaPsqlrc, own.replace("\\x auto", "\\x off"));
      same(status(await doctor(), "ARCA-W004"), "fail");
      writeFileSync(paths.arcaPsqlrc, own);
      // the profile: the cache stale, the block changed, the cache gone
      const cache = join(paths.cache, "shell.bash");
      const script = readFileSync(cache, "utf8");
      writeFileSync(cache, script.replace("w1", "other"));
      const stale = await doctor();
      assert(status(stale, "ARCA-W005") === "fail" && stale.results.find((x) => x.id === "ARCA-W005")?.detail.includes("not the script"), JSON.stringify(stale.results[4]));
      writeFileSync(cache, script);
      const rc = readFileSync(join(dir, ".bashrc"), "utf8");
      writeFileSync(join(dir, ".bashrc"), rc.replace("shell.bash", "shell.elsewhere"));
      same(status(await doctor(), "ARCA-W005"), "fail");
      writeFileSync(join(dir, ".bashrc"), rc);
      rmSync(cache);
      assert((await doctor()).results.find((x) => x.id === "ARCA-W005")?.detail.includes("is missing"));
      const quiet = await run("bash", ["--noprofile", "--norc", "-c", `source ${join(dir, ".bashrc")}; echo started`], { PATH: env["PATH"] as string, HOME: dir });
      same([quiet.code, quiet.out.trim(), quiet.err], [0, "started", ""], "a shell whose cache is gone still starts, quietly");
      writeFileSync(cache, script);
      same((await doctor()).code, 0, "put right, it passes");
      // an instance that is not reached
      await server.close();
      const gone = await doctor();
      assert(status(gone, "ARCA-W006") === "fail" && gone.code === 1 && !JSON.stringify(gone).includes("pw\""), JSON.stringify(gone.results[5]));
      // the scope, a check by id, a server, and a workstation with nothing set up
      const one = await doctor({}, ["--check", "ARCA-W001"]);
      same(one.results.map((r) => r.id), ["ARCA-W001"]);
      const srv = await main(["doctor", "--scope", "workstation"], { env, cwd: "/n", tty: false });
      assert(srv.code === 2 && srv.err.includes("server"), srv.err);
      same((await main(["doctor", "--scope", "everything"], { env, cwd: "/n", tty: true })).code, 2);
      const empty = await workstationChecks({ paths, state: emptyState, psqlVersion: () => "psql (PostgreSQL) 16.1" });
      same(empty.results.map((r) => r.status), ["pass", "pass", "warn", "pass", "warn", "unknown"], "with no state: no default instance and no profiles; the psql files are there");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

proves(
  ["0047-arcactl-init FR-012", "0047-arcactl-init FR-013"],
  "init with nothing given shows the instances found with what each could do, a password goes only to the host it is written for, and init sets up the shell and the psql files with no instance at all",
  async () => {
    const server = await pgliteServer(statements);
    const asks = await passwordServer();
    const { dir, paths, env } = home();
    try {
      writeFileSync(paths.pgServiceFile, `[local-db]\nhost=127.0.0.1\nport=${server.port}\ndbname=postgres\nuser=postgres\nsslmode=disable\n`);
      writeFileSync(paths.pgpass, `127.0.0.1:${asks.port}:*:app:to-the-asking-server\n*:*:*:*:to-nobody-by-wildcard\n`, { mode: 0o600 });
      writeFileSync(paths.pgServiceFile, `${readFileSync(paths.pgServiceFile, "utf8")}\n[asks]\nhost=127.0.0.1\nport=${asks.port}\ndbname=db\nuser=app\nsslmode=disable\n`);
      const r = await init({ ...env, ERGONEX_HOME: join(dir, "ws") }, ["--discover", "--dry-run", "--shell", "none"]);
      same(r.code, 0, r.out + r.err);
      assert(r.out.includes("Instances you can reach:") && r.out.includes("local-db") && r.out.includes("migrate+guard") && r.out.includes("identityAgent") && r.out.includes("asks"), r.out);
      assert(!r.out.includes("to-the-asking-server") && !r.out.includes("to-nobody-by-wildcard"));
      assert(asks.seen.some((s) => s.password === "to-the-asking-server"), `the password went to its own host: ${JSON.stringify(asks.seen)}`);
      assert(!asks.seen.some((s) => s.password === "to-nobody-by-wildcard"), "a wildcard line is not sent to a host it does not name");
      // no instance: the psql files and the shell are still set up
      const none = await init(env, ["--shell", "bash", "--yes"]);
      assert(none.code === 1 && none.out.includes("there is no default instance"), none.out);
      assert(existsSync(paths.arcaPsqlrc) && readFileSync(join(dir, ".bashrc"), "utf8").includes("arcactl:shell"));
      const script = readFileSync(join(paths.cache, "shell.bash"), "utf8");
      assert(!script.includes("ARCA_INSTANCE='") && script.includes("export ARCA_SCHEMA='arca'"), script);
    } finally {
      await server.close();
      await asks.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
