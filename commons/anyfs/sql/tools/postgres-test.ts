// Spec: 0010-sql-dialects FR-007
/**
 * A throwaway PostgreSQL server for the tests of the SQL stores (commons anyfs-sql 0010-sql-dialects FR-007): the cluster is made in a folder of its own, the server listens on the loopback on a free port and trusts the account that
 * runs it, databases are made and dropped by name, and everything is taken away again when the function that uses it ends. The server is the real one (`initdb`, `pg_ctl`); where the computer has none the answer says so and a
 * test that needs it is skipped with that sentence. A server that is already running is used where `ANYFS_SQL_TEST_PG` names it (`host:port:user`).
 *
 * ```sh
 * bun tools/postgres-test.ts check     say whether a server can be made here
 * ```
 *
 * @example
 * ```ts
 * import { withPostgres } from "./postgres-test.ts";
 * const r = await withPostgres(async (server) => (await server.createDatabase("a")).database);
 * r.kind === "ran" ? r.value : r.reason;
 * ```
 *
 * @module
 */
import net from "node:net";
import process from "node:process";
import { fs, path, proc } from "@intellectual-frontiers/system";

/** The server, as a test reaches it. */
export type PostgresServer = {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  /** The programs of the client, to run the real `pg_dump` and `psql` against the server. */
  readonly bin: { readonly pgDump: string; readonly psql: string };
  /** Makes a database of a name and gives its address. */
  createDatabase(name: string): Promise<{ readonly database: string }>;
  /** The environment a client program reads to reach a database of the server. */
  envOf(database: string): Readonly<Record<string, string>>;
};

/** What a use of the server ended with: it ran, or it could not be made and why. */
export type Postgres<T> = { readonly kind: "ran"; readonly value: T } | { readonly kind: "skipped"; readonly reason: string };

/** The programs of PostgreSQL on this computer, or what is missing. */
export type Programs = { readonly kind: "found"; readonly initdb: string; readonly pgCtl: string; readonly pgDump: string; readonly psql: string } | { readonly kind: "missing"; readonly reason: string };

const BIN_DIRS = ["/usr/lib/postgresql", "/usr/local/pgsql", "/opt/homebrew/opt/postgresql@16", "/usr/pgsql"] as const;

/** The directories that may hold the programs of a server: the `bin` folder of each version under the usual places. */
async function binDirs(): Promise<readonly string[]> {
  const found: string[] = [];
  for (const base of BIN_DIRS) {
    if (!(await fs.exists(base))) continue;
    if (await fs.exists(path.join(base, "bin"))) found.push(path.join(base, "bin"));
    try {
      for await (const e of fs.readDir(base)) if (e.isDirectory && (await fs.exists(path.join(base, e.name, "bin")))) found.push(path.join(base, e.name, "bin"));
    } catch {
      // not a folder of versions
    }
  }
  return found;
}

/** The programs of PostgreSQL on this computer. */
export async function programs(): Promise<Programs> {
  const dirs = await binDirs();
  const find = (name: string): string | undefined => proc.which(name) ?? dirs.map((d) => path.join(d, name)).find((p) => proc.isExecutable(p));
  const initdb = find("initdb");
  const pgCtl = find("pg_ctl");
  const pgDump = proc.which("pg_dump") ?? find("pg_dump");
  const psql = proc.which("psql") ?? find("psql");
  const lacking = [initdb === undefined ? "initdb" : "", pgCtl === undefined ? "pg_ctl" : "", pgDump === undefined ? "pg_dump" : "", psql === undefined ? "psql" : ""].filter((s) => s !== "");
  if (initdb === undefined || pgCtl === undefined || pgDump === undefined || psql === undefined) return { kind: "missing", reason: `this computer has no ${lacking.join(", ")} (install the PostgreSQL server and client to run the tests that need a real server)` };
  return { kind: "found", initdb, pgCtl, pgDump, psql };
}

/** A free port of the loopback. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

const serverOf = (host: string, port: number, user: string, bin: PostgresServer["bin"]): PostgresServer => ({
  host,
  port,
  user,
  bin,
  async createDatabase(name) {
    const made = await proc.output([bin.psql, "-h", host, "-p", String(port), "-U", user, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${name}"`, "-c", `CREATE DATABASE "${name}"`]);
    if (made.code !== 0) throw new Error(`the database ${name} was not made: ${new TextDecoder().decode(made.stderr)}`);
    return { database: name };
  },
  envOf: (database) => ({ PGHOST: host, PGPORT: String(port), PGUSER: user, PGDATABASE: database }),
});

/**
 * Runs a function against a real PostgreSQL server: a running one named by `ANYFS_SQL_TEST_PG` (`host:port:user`), or a throwaway one made for the run (as the `postgres` account where this process is root, which the server
 * refuses to run as) and stopped and removed after it. Where no server can be made the function is not run and the reason is given.
 */
export async function withPostgres<T>(fn: (server: PostgresServer) => Promise<T>): Promise<Postgres<T>> {
  const found = await programs();
  if (found.kind === "missing") return { kind: "skipped", reason: found.reason };
  const bin = { pgDump: found.pgDump, psql: found.psql };
  const given = process.env["ANYFS_SQL_TEST_PG"];
  if (given !== undefined && given !== "") {
    const [host, port, user] = given.split(":");
    if (host === undefined || port === undefined || user === undefined) return { kind: "skipped", reason: "ANYFS_SQL_TEST_PG is not host:port:user" };
    return { kind: "ran", value: await fn(serverOf(host, Number(port), user, bin)) };
  }
  const root = proc.isRoot();
  const account = root ? "postgres" : (process.env["USER"] ?? "postgres");
  const dir = await fs.makeTempDir({ prefix: "anyfs-pg-" });
  const as = (argv: readonly string[]): readonly string[] => (root ? ["runuser", "-u", account, "--", ...argv] : argv);
  let started = false;
  try {
    if (root) await proc.run(["chown", "-R", `${account}:${account}`, dir]);
    await fs.chmod(dir, 0o750);
    const initialised = await proc.output(as([found.initdb, "-D", path.join(dir, "data"), "--auth=trust", "-U", account, "-E", "UTF8"]));
    if (initialised.code !== 0) return { kind: "skipped", reason: `initdb failed: ${new TextDecoder().decode(initialised.stderr).trim().split("\n").pop() ?? ""}` };
    const port = await freePort();
    const start = await proc.output(as([found.pgCtl, "-D", path.join(dir, "data"), "-o", `-p ${port} -c listen_addresses=127.0.0.1 -k ${dir} -c fsync=off`, "-l", path.join(dir, "log"), "-w", "start"]));
    if (start.code !== 0) return { kind: "skipped", reason: `the server did not start: ${new TextDecoder().decode(start.stderr).trim().split("\n").pop() ?? ""}` };
    started = true;
    return { kind: "ran", value: await fn(serverOf("127.0.0.1", port, account, bin)) };
  } finally {
    if (started) await proc.output(as([found.pgCtl, "-D", path.join(dir, "data"), "-m", "immediate", "-w", "stop"])).catch(() => undefined);
    await fs.remove(dir, { recursive: true }).catch(() => undefined);
  }
}

if (import.meta.main && process.argv[2] === "check") {
  const found = await programs();
  console.log(found.kind === "found" ? `a server can be made: ${found.initdb}` : found.reason);
  process.exit(found.kind === "found" ? 0 : 1);
}
