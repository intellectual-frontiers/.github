// Spec: 0004-anyfs-cli-surfaces FR-003
/**
 * The world of the process (commons anyfs-cli 0004-anyfs-cli-surfaces FR-003): the stores it opens through the openers of the program and of the configuration, one per place for a run; standard input and output as the
 * bytes they are; a plain path as the root of its store and the path inside it; and a small state folder for the bases of two-way syncs and the ledgers of mirrors. A test makes the same world with its own streams and
 * folder.
 *
 * @example
 * ```ts
 * import { localPlace } from "./world.ts";
 * localPlace("/srv/fleet", "a/b", "linux"); // { root: "/", inner: "/srv/fleet/a/b" }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { formatPlace, type Place } from "@intellectual-frontiers/anyfs/governance";
import type { AnyStore } from "@intellectual-frontiers/anyfs/logical";
import type { RunLocal } from "@intellectual-frontiers/headless/targets/ssh";
import { dirsOf } from "@intellectual-frontiers/system/dirs";
import { mkdir, readFile, readTextFile, writeTextFile } from "@intellectual-frontiers/system/fs";
import { dirname, join, parse, resolve, sep } from "@intellectual-frontiers/system/path";
import { cwd as workingFolder, env as processEnv } from "@intellectual-frontiers/system/proc";
import { stdin, stdout } from "@intellectual-frontiers/system/stdio";
import { type Config, type LocalPlace, type OpenProblem, type World } from "@intellectual-frontiers/anyfs-cli/logical";
import { builtinKinds } from "./openers.ts";
import { osOf } from "./os.ts";

/** Where a plain path points: the root of the store it is in (`/`, or a drive) and the path inside the store, with slashes. */
export function localPlace(cwd: string, path: string, os: "linux" | "darwin" | "windows"): LocalPlace {
  const abs = resolve(cwd, path);
  const root = parse(abs).root;
  const rest = abs.slice(root.length).split(os === "windows" ? "\\" : sep).filter((s) => s !== "");
  return { root, inner: `/${rest.join("/")}` };
}

/** What a world is made from. */
export type WorldOptions = {
  readonly env: (name: string) => string | undefined;
  readonly cwd: string;
  readonly json: boolean;
  readonly config: Config;
  /** The folder of the state; the program's own folder (`$XDG_STATE_HOME/anyfs`) where left out. */
  readonly stateDir?: string;
  /** How the ssh program is run; the system's where left out. */
  readonly run?: RunLocal;
  readonly readStdin?: () => Promise<Uint8Array>;
  readonly writeStdout?: (bytes: Uint8Array) => void;
};

/** The state folder of the program for an environment. */
export function stateDirOf(env: (name: string) => string | undefined): string {
  return dirsOf("anyfs", env, osOf()).state ?? join(workingFolder(), ".anyfs-state");
}

/** The world of this process. */
export function systemWorld(o: WorldOptions): World {
  const stateDir = o.stateDir ?? stateDirOf(o.env);
  const openers = new Map([...builtinKinds(o.env, stateDir, o.config.ssh, o.run), ...o.config.kinds].map((k) => [k.kind, k] as const));
  const opened = new Map<string, Promise<Result<AnyStore, OpenProblem>>>();
  const open = (place: Place): Promise<Result<AnyStore, OpenProblem>> => {
    const key = formatPlace(place);
    const held = opened.get(key);
    if (held !== undefined) return held;
    const made = (async (): Promise<Result<AnyStore, OpenProblem>> => {
      const opener = openers.get(place.kind);
      if (opener === undefined) return err({ code: "E-PLACE-UNAVAILABLE", message: `${key}: no store for a place of the kind ${place.kind} is installed` });
      try {
        const store = await opener.open(place, { env: o.env, stateDir });
        return store.kind === "ok" ? ok(store.value) : err({ code: "E-OPEN", message: `${key}: ${store.error}` });
      } catch (e) {
        return err({ code: "E-OPEN", message: `${key}: ${e instanceof Error ? e.message : String(e)}` });
      }
    })();
    opened.set(key, made);
    return made;
  };
  const stateFile = (name: string): string => join(stateDir, name);
  return {
    cwd: o.cwd,
    stateDir,
    json: o.json,
    open,
    local: (path) => localPlace(o.cwd, path, osOf()),
    readStdin: o.readStdin ?? (() => stdin.bytes()),
    writeStdout: o.writeStdout ?? ((bytes) => void stdout.writeSync(bytes)),
    readLocalFile: async (path) => {
      try {
        return ok(await readFile(resolve(o.cwd, path)));
      } catch (e) {
        return err(`${path}: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    state: {
      read: async (name) => {
        try {
          return await readTextFile(stateFile(name));
        } catch {
          return undefined;
        }
      },
      write: async (name, text) => {
        await mkdir(dirname(stateFile(name)), { recursive: true });
        await writeTextFile(stateFile(name), text);
      },
    },
  };
}

/** The process's environment as a function that treats an empty variable as not set. */
export function processEnvFn(): (name: string) => string | undefined {
  const all = processEnv.toObject();
  return (name) => {
    const v = all[name];
    return v === "" ? undefined : v;
  };
}

/** The working folder of the process. */
export const processCwd = (): string => workingFolder();
