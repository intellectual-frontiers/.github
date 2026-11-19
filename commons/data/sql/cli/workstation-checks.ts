// Spec: 0047-arcactl-init FR-015
/**
 * The checks of a workstation (commons data 0047-arcactl-init FR-015): `psql` is there and new enough for the helper file, `.pgpass` is one libpq will use, the default instance has its service, the `psqlrc`
 * block and the file it includes are current, each profile that `arcactl` wrote has its block and the cache it sources is the script as it would be made now, and the default instance can be reached.
 * Each says what to do, and each is read-only. `arcactl init` ends by running them.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { blockOf } from "./blocks.ts";
import type { CheckResult, Report, Status } from "./doctor.ts";
import { type Candidate, passwordFor, probe } from "./discover.ts";
import type { Connection, ConnectOptions } from "./connection.ts";
import { parsePgpass, parseServices, psqlrcBody } from "./libpq.ts";
import { pgpassModeOk } from "./files.ts";
import { cacheOf, profileBody, scriptFor } from "./profile.ts";
import type { Known, State } from "./state.ts";
import type { Paths } from "./workstation.ts";

/** What the workstation checks are given. */
export interface Workstation {
  readonly paths: Paths;
  readonly state: State;
  /** How `psql --version` is asked; the real one by default. */
  readonly psqlVersion?: () => string | undefined;
  readonly connect?: (o: ConnectOptions) => Promise<Connection>;
}

const readOr = (p: string): string => {
  try {
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  } catch {
    return "";
  }
};

/** `psql --version` of the real program. */
export function realPsqlVersion(): string | undefined {
  const r = spawnSync("psql", ["--version"], { encoding: "utf8", timeout: 5000 });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

type Check = { readonly id: string; readonly title: string; readonly run: (w: Workstation, known: Known | undefined) => Promise<Omit<CheckResult, "id" | "title">> };

const defaultOf = (s: State): Known | undefined => s.instances.find((i) => i.name === s.default);

const checks: readonly Check[] = [
  {
    id: "ARCA-W001",
    title: "psql",
    async run(w) {
      const text = (w.psqlVersion ?? realPsqlVersion)();
      if (text === undefined) return { status: "fail", detail: "psql is not on the PATH", next: "install the PostgreSQL client (postgresql-client, or libpq's psql)" };
      const major = Number(/(\d+)(?:\.\d+)*\s*(?:\(|$|\n)/.exec(text.replace(/^psql \(PostgreSQL\)\s*/, ""))?.[1] ?? "0");
      return major >= 15 ? { status: "pass", detail: text } : { status: "warn", detail: `${text}: the helper file of arcactl needs psql 15 or later (\\getenv)`, next: "install psql 15 or later" };
    },
  },
  {
    id: "ARCA-W002",
    title: "passwords (.pgpass)",
    async run(w, known) {
      const text = readOr(w.paths.pgpass);
      if (blockOf(text, "credentials", "#").kind === "err") return { status: "fail", detail: `the arcactl block of ${w.paths.pgpass} is broken (a marker is missing or twice)`, next: "repair or remove the block, then run arcactl init" };
      const mine = blockOf(text, "credentials", "#");
      const body = mine.kind === "ok" ? mine.value : undefined;
      if (body === undefined) return { status: "pass", detail: "arcactl stores no password: libpq will use its own sources (trust, peer, a service, your own .pgpass lines)" };
      if (w.paths.platform !== "win32" && existsSync(w.paths.pgpass) && !pgpassModeOk(statSync(w.paths.pgpass).mode)) return { status: "fail", detail: `${w.paths.pgpass} can be read by the group or others: libpq ignores it`, next: "run arcactl init, or chmod 600 the file" };
      const creds = parsePgpass(body).credentials;
      if (known?.host !== undefined && !creds.some((c) => c.host === known.host)) return { status: "warn", detail: `arcactl has no password for ${known.host} (the default instance ${known.name})`, next: "run arcactl init --instance with the password, if it needs one" };
      return { status: "pass", detail: `${creds.length} credential${creds.length === 1 ? "" : "s"} of arcactl's, in a file libpq will use` };
    },
  },
  {
    id: "ARCA-W003",
    title: "the service of the default instance",
    async run(w, known) {
      if (known === undefined) return { status: "warn", detail: "there is no default instance", next: "run arcactl init --instance <name> --host <host> ..." };
      const has = parseServices(readOr(w.paths.pgServiceFile)).some((s) => s.name === known.name);
      return has ? { status: "pass", detail: `${known.name} is a service in ${w.paths.pgServiceFile}` } : { status: "fail", detail: `${known.name} is not a service in ${w.paths.pgServiceFile}`, next: "run arcactl init to write it" };
    },
  },
  {
    id: "ARCA-W004",
    title: "psql settings",
    async run(w) {
      const inc = blockOf(readOr(w.paths.psqlrc), "psql", "--");
      const own = blockOf(readOr(w.paths.arcaPsqlrc), "psql", "--");
      if (inc.kind === "err" || own.kind === "err") return { status: "fail", detail: "a block of the psqlrc files is broken", next: "repair or remove it, then run arcactl init" };
      if (inc.value === undefined) return { status: "warn", detail: `${w.paths.psqlrc} does not include arcactl's settings`, next: "run arcactl init" };
      if (own.value !== psqlrcBody()) return { status: "fail", detail: `${w.paths.arcaPsqlrc} is not as this arcactl writes it`, next: "run arcactl init" };
      return { status: "pass", detail: "psql includes arcactl's prompt, settings and helper queries" };
    },
  },
  {
    id: "ARCA-W005",
    title: "shell profiles",
    async run(w, known) {
      if (w.state.profiles.length === 0) return { status: "warn", detail: "arcactl has not put its script into any shell profile", next: "run arcactl init --shell auto" };
      const problems: string[] = [];
      for (const p of w.state.profiles) {
        const cache = cacheOf(w.paths, p.shell);
        for (const f of p.files) {
          const b = blockOf(readOr(f), "shell", "#");
          if (b.kind === "err" || b.value === undefined) problems.push(`${f} has no arcactl block`);
          else if (b.value !== profileBody(p.shell, cache)) problems.push(`${f}: the block is not as this arcactl writes it`);
        }
        if (!existsSync(cache)) problems.push(`${cache} is missing`);
        else if (readFileSync(cache, "utf8") !== scriptFor(p.shell, w.paths, known)) problems.push(`${cache} is not the script for ${known?.name ?? "no instance"} as it is made now`);
      }
      return problems.length === 0 ? { status: "pass", detail: `${w.state.profiles.map((p) => p.shell).join(", ")}: the profile sources a current script` } : { status: "fail", detail: problems.join("; "), next: "run arcactl init to write them again" };
    },
  },
  {
    id: "ARCA-W006",
    title: "the default instance can be reached",
    async run(w, known) {
      if (known?.host === undefined) return { status: "unknown", detail: "there is no default instance with a host to reach" };
      if (w.connect === undefined) return { status: "unknown", detail: "no connection was made" };
      const c: Candidate = { name: known.name, sources: [], host: known.host, ...(known.port === undefined ? {} : { port: known.port }), ...(known.database === undefined ? {} : { database: known.database }), ...(known.user === undefined ? {} : { user: known.user }), ...(known.sslmode === undefined ? {} : { sslmode: known.sslmode }) };
      const p = await probe(w.connect, c, passwordFor(w.paths, c), known.schema);
      return p.reachable ? { status: "pass", detail: `${known.name}: ${p.version} as ${p.user}` } : { status: "fail", detail: `${known.name} is not reached: ${p.error}`, next: "check the host, the port, the password in .pgpass and the network" };
    },
  },
];

/** The ids of the workstation checks. */
export const workstationIds: readonly string[] = checks.map((c) => c.id);

/** Runs the checks of a workstation. */
export async function workstationChecks(w: Workstation, only?: readonly string[]): Promise<Report> {
  const known = defaultOf(w.state);
  const results: CheckResult[] = [];
  for (const c of checks) {
    if (only !== undefined && !only.includes(c.id)) continue;
    try {
      results.push({ id: c.id, title: c.title, ...(await c.run(w, known)) });
    } catch (thrown) {
      results.push({ id: c.id, title: c.title, status: "unknown", detail: `could not check: ${thrown instanceof Error ? thrown.message : String(thrown)}` });
    }
  }
  const summary: Record<Status, number> = { pass: 0, warn: 0, fail: 0, unknown: 0 };
  for (const r of results) summary[r.status]++;
  return { results, summary, code: summary.warn + summary.fail + summary.unknown === 0 ? 0 : 1 };
}
