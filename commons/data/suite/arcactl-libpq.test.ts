// Spec: 0047-arcactl-init FR-008, FR-009, FR-010
/**
 * The writers of `.pgpass`, `pg_service.conf` and `.psqlrc` (commons data 0047-arcactl-init FR-008 to FR-010), seen by the real `psql` and libpq: a server that asks for a password shows what libpq read
 * from `.pgpass`, and PGlite served on a TCP port shows what `psql` does with the service file and the `psqlrc`. Every file is in a temporary home.
 *
 * @module
 */
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, proves } from "@intellectual-frontiers/test";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { invariants } from "@intellectual-frontiers/data/sql/extensions/invariants";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { applyChange, type Credential, type Instance, type Paths, type Plan, checkCredential, checkInstance, fixModes, parsePgpass, parseServices, pathsOf, pgpassLine, planPgpass, planPsql, planServices, planUndo, psqlrcBody, readInstances, schemaOf, serviceSection, settingsOf, splitPgpass } from "@intellectual-frontiers/data/sql/cli";
import { passwordServer, pgliteServer, run } from "./net-fixtures.ts";
import { same } from "./governance-fixture.ts";

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const home = (): { dir: string; paths: Paths } => {
  const dir = mkdtempSync(join(tmpdir(), "arcactl-libpq-"));
  return { dir, paths: must(pathsOf({ platform: "linux", env: { HOME: dir } })) };
};
const apply = (plan: Plan): void => {
  for (const c of plan.changes) applyChange(c);
  fixModes(plan);
};
const cred = (over: Partial<Credential> = {}): Credential => ({ host: "127.0.0.1", port: "5432", database: "*", user: "app", password: "pw", ...over });
const base = (dir: string, extra: Record<string, string> = {}): Record<string, string> => ({ PATH: process.env["PATH"] ?? "/usr/bin", HOME: dir, PGCONNECT_TIMEOUT: "5", PGSSLMODE: "disable", ...extra });

proves(
  ["0047-arcactl-init FR-008"],
  "`.pgpass` lines escape a colon and a backslash and read back, the file is made 0600, a password is replaced or taken out without touching the person's lines or the other credentials, a line of the person's own that libpq would read first is said, and a credential that cannot be held is refused",
  () => {
    same(pgpassLine(cred({ host: "db:1", user: "a\\b", password: "p:w\\d" })), "db\\:1:5432:*:a\\\\b:p\\:w\\\\d");
    same(pgpassLine(cred({ host: "*", port: "*", database: "*", user: "*", password: "x" })), "*:*:*:*:x");
    const nasty = ["plain", "a:b", "a\\b", "\\:", ":::", "p w#d", "it's \"q\" $x `y`", "ünï✓", "end\\", "x\\\\y"];
    for (const pw of nasty) {
      const f = splitPgpass(pgpassLine(cred({ password: pw })));
      same(f?.[4], pw, JSON.stringify(pw));
      same(f?.length, 5);
    }
    same(splitPgpass("only:four:fields:here"), undefined);
    const parsed = parsePgpass("# a comment\n\nh:1:d:u:p\nbroken line\r\nh2:2:d:u2:p2\n");
    same([parsed.credentials.length, parsed.other], [2, ["broken line"]]);
    const bad = (c: Credential) => checkCredential(c).map((e) => (e.kind === "invalid" ? e.what : e.kind));
    same([bad(cred({ password: "" })), bad(cred({ password: "a\nb" })), bad(cred({ port: "x" })), bad(cred({ host: "" })), bad(cred({ port: "*" }))], [["password"], ["password"], ["port"], ["host"], []]);
    const { dir, paths } = home();
    try {
      const first = must(planPgpass(paths, { set: [cred({ database: "a", password: "one" }), cred({ database: "b", user: "bo", password: "two" })] }));
      same(first.changes[0]?.action, "create");
      apply(first);
      same(statSync(paths.pgpass).mode & 0o777, 0o600, "a new file is 0600");
      const text = readFileSync(paths.pgpass, "utf8");
      assert(text.includes("# >>> arcactl:credentials >>>") && text.includes("127.0.0.1:5432:a:app:one\n") && text.includes("127.0.0.1:5432:b:bo:two\n"), text);
      // the same again is nothing; a new password for the same place replaces it; another place stays
      same(must(planPgpass(paths, { set: [cred({ database: "a", password: "one" })] })).changes[0]?.action, "unchanged");
      apply(must(planPgpass(paths, { set: [cred({ database: "a", password: "changed" })] })));
      const after = parsePgpass(readFileSync(paths.pgpass, "utf8")).credentials.map((c) => `${c.database}:${c.user}:${c.password}`);
      same(after.toSorted(), ["a:app:changed", "b:bo:two"]);
      // the person's lines are kept, and one that comes first and matches is said
      writeFileSync(paths.pgpass, `# mine\n*:5432:*:app:theirs\n${readFileSync(paths.pgpass, "utf8")}`, { mode: 0o600 });
      const warned = must(planPgpass(paths, { set: [cred({ database: "a", password: "again" })] }));
      assert(warned.warnings.length === 1 && warned.warnings[0]?.includes("comes before") && !warned.warnings[0].includes("theirs"), JSON.stringify(warned.warnings));
      apply(warned);
      assert(readFileSync(paths.pgpass, "utf8").startsWith("# mine\n*:5432:*:app:theirs\n"));
      // taking one out, then all
      apply(must(planPgpass(paths, { remove: [{ host: "127.0.0.1", port: "5432", database: "b", user: "bo" }] })));
      same(parsePgpass(readFileSync(paths.pgpass, "utf8")).credentials.filter((c) => c.password !== "theirs").map((c) => c.database), ["a"]);
      apply(must(planPgpass(paths, { remove: [{ host: "127.0.0.1", port: "5432", database: "a", user: "app" }] })));
      same(readFileSync(paths.pgpass, "utf8"), "# mine\n*:5432:*:app:theirs\n", "the person's file as it was");
      // a mode that libpq would ignore is found and put right
      chmodSync(paths.pgpass, 0o644);
      const loose = must(planPgpass(paths, { set: [cred({ password: "x" })] }));
      same(loose.modes.map((m) => [m.from, m.to]), [[0o644, 0o600]]);
      fixModes(loose);
      same(statSync(paths.pgpass).mode & 0o777, 0o600);
      // what cannot be held, and a block that is not credentials
      assert(planPgpass(paths, { set: [cred({ password: "a\nb" })] }).kind === "err");
      writeFileSync(paths.pgpass, "# >>> arcactl:credentials >>>\nnot a credential:secretvalue\n# <<< arcactl:credentials <<<\n", { mode: 0o600 });
      const e = planPgpass(paths, { set: [cred()] });
      assert(e.kind === "err" && JSON.stringify(e.error).includes("***") && !JSON.stringify(e.error).includes("secretvalue"), "the password in a bad line is not shown");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

proves(
  ["0047-arcactl-init FR-008"],
  "the real libpq reads what is written to `.pgpass`: each password, whatever it holds, reaches a server that asks for one, a wildcard and an exact line match as libpq reads them, and a file the group can read is ignored until its mode is put right",
  async () => {
    const server = await passwordServer();
    const { dir, paths } = home();
    try {
      const psql = (user: string, db = "app_db") => run("psql", ["-w", "-h", "127.0.0.1", "-p", String(server.port), "-U", user, "-d", db, "-c", "select 1"], base(dir));
      const nasty = ["plain", "a:b", "a\\b", "\\:", "p w#d", "it's \"q\" $x `y`", "ünï✓", "end\\", "x\\\\y", ":::"];
      for (const pw of nasty) {
        apply(must(planPgpass(paths, { set: [{ host: "127.0.0.1", port: String(server.port), database: "*", user: "app", password: pw }] })));
        server.seen.length = 0;
        const r = await psql("app");
        same(server.seen.at(-1)?.password, pw, `${JSON.stringify(pw)}: ${r.err}`);
      }
      // an exact database beats nothing, a different user or database is not matched
      apply(must(planPgpass(paths, { remove: [{ host: "127.0.0.1", port: String(server.port), database: "*", user: "app" }], set: [{ host: "127.0.0.1", port: String(server.port), database: "only_this", user: "ann", password: "annpw" }] })));
      server.seen.length = 0;
      await psql("ann", "only_this");
      await psql("ann", "other_db");
      await psql("bob", "only_this");
      same(server.seen.map((s) => `${s.user}/${s.database}/${s.password}`), ["ann/only_this/annpw", "ann/other_db/undefined", "bob/only_this/undefined"]);
      // libpq ignores a password file the group can read, and says so
      chmodSync(paths.pgpass, 0o640);
      server.seen.length = 0;
      const ignored = await psql("ann", "only_this");
      same(server.seen.at(-1)?.password, undefined);
      assert(ignored.err.includes("group or world access"), ignored.err);
      const fix = must(planPgpass(paths, { set: [{ host: "127.0.0.1", port: String(server.port), database: "only_this", user: "ann", password: "annpw" }] }));
      same(fix.modes.length, 1);
      fixModes(fix);
      server.seen.length = 0;
      await psql("ann", "only_this");
      same(server.seen.at(-1)?.password, "annpw", "and then it is read");
    } finally {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

proves(
  ["0047-arcactl-init FR-009"],
  "the service file holds the instances in a block, reads them back, refuses a service the person already defined outside it and what is not valid, and the real psql connects by the service, by PGSERVICE as the shell sets it",
  async () => {
    const { dir, paths } = home();
    const db = await pgliteServer();
    try {
      const prod: Instance = { name: "prod-main", host: "127.0.0.1", port: db.port, database: "postgres", user: "postgres", sslmode: "disable", schema: "arca" };
      same(serviceSection(prod), `[prod-main]\nhost=127.0.0.1\nport=${db.port}\ndbname=postgres\nuser=postgres\nsslmode=disable\noptions=-c search_path=arca,public`);
      const staging: Instance = { name: "staging", host: "stg.example", port: 5433, database: "arca" };
      apply(must(planServices(paths, [prod, staging])));
      same(must(readInstances(paths)), [prod, staging]);
      assert(parseServices(readFileSync(paths.pgServiceFile, "utf8")).length === 2);
      same(must(planServices(paths, [prod, staging])).changes[0]?.action, "unchanged");
      // the real psql, by the service and by PGSERVICE
      const env = base(dir, { PGSERVICEFILE: paths.pgServiceFile });
      const byName = await run("psql", ["-X", "-Atc", "select 'reached'", "service=prod-main"], env);
      same([byName.code, byName.out.trim()], [0, "reached"], byName.err);
      const byEnv = await run("psql", ["-X", "-Atc", "select 'reached'"], { ...env, PGSERVICE: "prod-main" });
      same([byEnv.code, byEnv.out.trim()], [0, "reached"], byEnv.err);
      const unknown = await run("psql", ["-X", "-c", "select 1", "service=nope"], env);
      assert(unknown.code !== 0 && unknown.err.includes("nope"), unknown.err);
      // one taken out; none takes the block out and leaves the person's own
      apply(must(planServices(paths, [staging])));
      same(must(readInstances(paths)).map((i) => i.name), ["staging"]);
      writeFileSync(paths.pgServiceFile, `[mine]\nhost=h\n\n${readFileSync(paths.pgServiceFile, "utf8")}`);
      apply(must(planServices(paths, [])));
      same(readFileSync(paths.pgServiceFile, "utf8"), "[mine]\nhost=h\n");
      // a service of the person's own with the name of one of ours: refused, and the file is not changed
      const clash = planServices(paths, [{ name: "mine", host: "x" }]);
      assert(clash.kind === "err" && clash.error[0]?.kind === "conflict" && JSON.stringify(clash.error).includes("rename one"));
      same(readFileSync(paths.pgServiceFile, "utf8"), "[mine]\nhost=h\n");
      // what is not valid
      const kinds = (i: Instance) => checkInstance(i).map((e) => (e.kind === "invalid" ? e.what : e.kind));
      same([kinds({ name: "a b" }), kinds({ name: "a", host: "h\nx" }), kinds({ name: "a", port: 70000 }), kinds({ name: "a", sslmode: "maybe" }), kinds({ name: "a", schema: "Arca" }), kinds({ name: "a", user: " u" }), kinds(prod)], [["name"], ["host"], ["port"], ["sslmode"], ["schema"], ["user"], []]);
      assert(planServices(paths, [prod, prod]).kind === "err");
    } finally {
      await db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

proves(
  ["0047-arcactl-init FR-010"],
  "the psqlrc is a block that includes the file arcactl owns, which is quiet at start, names the instance, and gives the helper queries that work on a real database; and undoing takes away what was put in and leaves the person's own",
  async () => {
    const config = must(settingsOf({ models: ["identityAgent"] }));
    const schema = must(schemaOf(config)).schema;
    const bound = must(bind(schema, { dialect: postgres, schema: "arca", sources: [invariants()] }));
    const db = await pgliteServer(bound.statements.map((s) => s.sql));
    const { dir, paths } = home();
    try {
      writeFileSync(paths.psqlrc, "\\set MY_SETTING 1\n");
      const plan = must(planPsql(paths));
      same(plan.changes.map((c) => c.action), ["create", "update"]);
      apply(plan);
      const rc = readFileSync(paths.psqlrc, "utf8");
      assert(rc.startsWith("\\set MY_SETTING 1\n") && rc.includes(`\\i ${paths.arcaPsqlrc}`) && rc.includes("-- >>> arcactl:psql >>>"), rc);
      same(readFileSync(paths.arcaPsqlrc, "utf8").includes(psqlrcBody()), true);
      same(must(planPsql(paths)).changes.map((c) => c.action), ["unchanged", "unchanged"], "twice is once");
      const env = (extra: Record<string, string> = {}) => base(dir, { PSQLRC: paths.psqlrc, ...extra });
      const psql = (input: string, extra: Record<string, string> = {}) => run("psql", ["-h", "127.0.0.1", "-p", String(db.port), "-U", "postgres", "-d", "postgres", "-A", "-t"], env(extra), input);
      // quiet, and the person's own setting still applies
      const quiet = await psql("select 1;\n\\echo :MY_SETTING\n");
      same([quiet.code, quiet.out, quiet.err], [0, "1\n1\n", ""], quiet.err);
      // the instance and the helper queries
      const named = await psql("\\echo :arca_instance :arca_env\n", { ARCA_INSTANCE: "prod-main", ARCA_ENV: "prod" });
      same(named.out.trim(), "prod-main prod", named.err);
      const tables = await psql("set search_path to arca, public;\n:tables\n");
      assert(tables.out.includes("principal") && tables.out.includes("audit_event"), tables.out + tables.err);
      const inv = await psql("set search_path to arca, public;\n:invariants\n");
      assert(inv.out.includes("audit_event|inv_audit_event_append_only|O") && inv.out.includes("agent_budget"), inv.out + inv.err);
      const guard = await psql(":guard\n");
      assert(guard.out.includes("inv_guard_drop|O") && guard.out.includes("inv_guard_end|O"), guard.out + guard.err);
      const audit = await psql("set search_path to arca, public;\n:audit\n");
      same([audit.code, audit.err], [0, ""], audit.err);
      // a Windows path is given to \\i with forward slashes
      const win = must(pathsOf({ platform: "win32", env: { USERPROFILE: "C:\\Users\\Ann", APPDATA: "C:\\Users\\Ann\\AppData\\Roaming" } }));
      const wdir = mkdtempSync(join(tmpdir(), "arcactl-win-"));
      try {
        const include = must(planPsql({ ...win, psqlrc: join(wdir, "psqlrc.conf"), arcaPsqlrc: join(wdir, "arca-psqlrc") })).changes[1];
        assert(include?.after.includes(`\\i ${wdir}/arca-psqlrc`));
        const w = must(planPsql(win)).changes[1];
        assert(w?.after.includes("\\i C:/Users/Ann/AppData/Roaming/arcactl/psqlrc"), w?.after);
      } finally {
        rmSync(wdir, { recursive: true, force: true });
      }
      // undo: everything of ours out, the person's own as it was
      writeFileSync(paths.pgpass, "mine:1:d:u:p\n", { mode: 0o600 });
      apply(must(planPgpass(paths, { set: [cred()] })));
      apply(must(planServices(paths, [{ name: "x", host: "h" }])));
      const undo = must(planUndo(paths));
      apply(undo);
      same(readFileSync(paths.psqlrc, "utf8"), "\\set MY_SETTING 1\n");
      same(readFileSync(paths.pgpass, "utf8"), "mine:1:d:u:p\n");
      same(readFileSync(paths.arcaPsqlrc, "utf8"), "");
      assert(!existsSync(paths.pgServiceFile) || readFileSync(paths.pgServiceFile, "utf8") === "");
      same(must(planUndo(paths)).changes.every((c) => c.action === "unchanged"), true, "undone twice is undone");
    } finally {
      await db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
