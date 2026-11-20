// Spec: 0047-arcactl-init FR-011
/**
 * What `arcactl` remembers of a person's instances (commons data 0047-arcactl-init FR-011): a JSON file in its own settings folder that it owns whole, with the instances it knows, which is the
 * default, and the profiles it has put the shell script into. It holds no password and no key: a password is in `.pgpass`, which libpq reads, and nowhere else.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Change, planWhole } from "./files.ts";
import type { Paths, Shell } from "./workstation.ts";
import { shells } from "./workstation.ts";

/** An instance `arcactl` knows. */
export interface Known {
  readonly name: string;
  /** What it is for: `dev`, `staging`, `prod`. */
  readonly env?: string;
  readonly schema?: string;
  readonly models?: readonly string[];
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
  readonly user?: string;
  readonly sslmode?: string;
  /** Whether `arcactl` wrote its service to `pg_service.conf` (and so owns it), as opposed to the person's own. */
  readonly ownsService?: boolean;
}

/** A shell profile the script is in. */
export interface Installed {
  readonly shell: Shell;
  /** The files whose block was written. */
  readonly files: readonly string[];
  /** The cached script they source. */
  readonly cache: string;
}

/** The whole of the state. */
export interface State {
  readonly version: 1;
  readonly default?: string;
  readonly instances: readonly Known[];
  readonly profiles: readonly Installed[];
}

export const emptyState: State = { version: 1, instances: [], profiles: [] };

const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

/** Reads the state file: none where it is not there, and what is wrong where it is not one. */
export function readState(paths: Paths): Result<State, string> {
  if (!existsSync(paths.instances)) return ok(emptyState);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(paths.instances, "utf8"));
  } catch (thrown) {
    return err(`${paths.instances} is not JSON: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
  if (typeof raw !== "object" || raw === null || (raw as { version?: unknown }).version !== 1) return err(`${paths.instances} is not a state file of version 1`);
  const o = raw as { default?: unknown; instances?: unknown; profiles?: unknown };
  const instances: Known[] = [];
  for (const i of Array.isArray(o.instances) ? o.instances : []) {
    const x = i as Record<string, unknown>;
    const name = str(x["name"]);
    if (name === undefined) return err(`${paths.instances}: an instance has no name`);
    instances.push({
      name,
      ...(str(x["env"]) === undefined ? {} : { env: str(x["env"]) as string }),
      ...(str(x["schema"]) === undefined ? {} : { schema: str(x["schema"]) as string }),
      ...(Array.isArray(x["models"]) ? { models: (x["models"] as unknown[]).filter((m): m is string => typeof m === "string") } : {}),
      ...(str(x["host"]) === undefined ? {} : { host: str(x["host"]) as string }),
      ...(typeof x["port"] === "number" ? { port: x["port"] } : {}),
      ...(str(x["database"]) === undefined ? {} : { database: str(x["database"]) as string }),
      ...(str(x["user"]) === undefined ? {} : { user: str(x["user"]) as string }),
      ...(str(x["sslmode"]) === undefined ? {} : { sslmode: str(x["sslmode"]) as string }),
      ...(x["ownsService"] === true ? { ownsService: true } : {}),
    });
  }
  const profiles: Installed[] = [];
  for (const p of Array.isArray(o.profiles) ? o.profiles : []) {
    const x = p as Record<string, unknown>;
    const shell = str(x["shell"]);
    if (shell === undefined || !(shells as readonly string[]).includes(shell) || !Array.isArray(x["files"]) || str(x["cache"]) === undefined) return err(`${paths.instances}: a profile is not one`);
    profiles.push({ shell: shell as Shell, files: (x["files"] as unknown[]).filter((f): f is string => typeof f === "string"), cache: str(x["cache"]) as string });
  }
  return ok({ version: 1, ...(str(o.default) === undefined ? {} : { default: str(o.default) as string }), instances, profiles });
}

/** The text of a state file: stable, so that writing the same state again changes nothing. */
export const stateText = (s: State): string => `${JSON.stringify({ version: 1, ...(s.default === undefined ? {} : { default: s.default }), instances: [...s.instances].sort((a, b) => a.name.localeCompare(b.name)), profiles: [...s.profiles].sort((a, b) => a.shell.localeCompare(b.shell)) }, null, 2)}\n`;

/** Plans writing the state. */
export const planState = (paths: Paths, s: State): Result<Change, import("./files.ts").FileError> => planWhole(paths.instances, stateText(s));

/** The state with an instance put in: replaced where its name is there. */
export function withInstance(s: State, k: Known, makeDefault: boolean): State {
  const rest = s.instances.filter((i) => i.name !== k.name);
  return { ...s, instances: [...rest, k], ...(makeDefault || s.default === undefined ? { default: k.name } : {}) };
}
