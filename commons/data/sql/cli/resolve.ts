// Spec: 0046-arcactl FR-014
/**
 * Where `arcactl` connects when it is given no URL (commons data 0046-arcactl FR-014): as `psql` does, from libpq's variables, then from the service the variable `PGSERVICE` names in `pg_service.conf`, and the
 * password from `PGPASSWORD`, then from the service, then from `.pgpass`. Bun's own client reads the variables and neither file, so without this the connection that `arcactl init` sets up (a service and a line of
 * `.pgpass`) is one that `psql` uses and `arcactl doctor` cannot. A target is made only where a host is known; otherwise the driver reads the environment and the sockets as it did. No password is ever printed.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { parsePgpass, parseServices } from "./libpq.ts";
import { type Platform, pathsOf } from "./workstation.ts";

/** Where a connection goes, as far as libpq's variables and files say. */
export interface Target {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string | undefined;
  readonly password: string | undefined;
  readonly sslmode: string | undefined;
  /** Where each part came from: `environment`, `service <name>`, `.pgpass`; never a value. */
  readonly from: readonly string[];
}

const readOr = (path: string): string => {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  } catch {
    return "";
  }
};

/**
 * The target libpq's variables and files give, or nothing where no host is known.
 *
 * @param env - the environment
 * @param platform - whose files these are; this machine's by default
 * @param home - the home directory; this user's by default
 */
export function resolveTarget(env: Readonly<Record<string, string | undefined>>, platform?: Platform, home?: string): Target | undefined {
  const plat = platform ?? ((process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux") as Platform);
  const paths = pathsOf({ platform: plat, env: { ...env, HOME: env["HOME"] ?? home ?? homedir() } });
  if (paths.kind === "err") return undefined;
  const from: string[] = [];
  const name = env["PGSERVICE"];
  const service = name === undefined || name === "" ? undefined : parseServices(readOr(paths.value.pgServiceFile)).find((s) => s.name === name);
  if (name !== undefined && name !== "" && service === undefined) return undefined;
  // libpq's order: what the service says, then the environment, then the defaults
  const pick = (variable: string, key: string): string | undefined => {
    const s = service?.settings[key];
    if (s !== undefined && s !== "") {
      if (!from.includes(`service ${name}`)) from.push(`service ${name}`);
      return s;
    }
    const e = env[variable];
    if (e !== undefined && e !== "") {
      if (!from.includes("environment")) from.push("environment");
      return e;
    }
    return undefined;
  };
  const host = pick("PGHOST", "host");
  if (host === undefined || host.startsWith("/")) return undefined;
  const port = Number(pick("PGPORT", "port") ?? 5432);
  const user = pick("PGUSER", "user");
  const database = pick("PGDATABASE", "dbname") ?? user ?? "postgres";
  const sslmode = pick("PGSSLMODE", "sslmode");
  let password = pick("PGPASSWORD", "password");
  if (password === undefined && user !== undefined) {
    const want = { host, port: String(port), database, user };
    const hit = parsePgpass(readOr(paths.value.pgpass)).credentials.find((c) => (["host", "port", "database", "user"] as const).every((k) => c[k] === "*" || c[k] === want[k]));
    if (hit !== undefined) {
      password = hit.password;
      from.push(".pgpass");
    }
  }
  return { host, port, database, user, password, sslmode, from };
}

/** The URL of a target, for the program and never for the screen: the user and the password are encoded. */
export function urlOfTarget(t: Target): string {
  const auth = t.user === undefined ? "" : `${encodeURIComponent(t.user)}${t.password === undefined ? "" : `:${encodeURIComponent(t.password)}`}@`;
  return `postgres://${auth}${t.host}:${t.port}/${encodeURIComponent(t.database)}${t.sslmode === undefined ? "" : `?sslmode=${encodeURIComponent(t.sslmode)}`}`;
}
