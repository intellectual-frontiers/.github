// Spec: 0003-anyfs-cli-logical FR-003
/**
 * What the verbs of the `anyfs` program are run in (commons anyfs-cli 0003-anyfs-cli-logical FR-003): the ports of the world they need and nothing else, so that the verbs are tested with stores in memory and a fake
 * standard input and output, and run for real with the process's own. The bytes of `cat` and `put` go through the ports and never through the text of an outcome, which is how they stay byte for byte.
 *
 * @example
 * ```ts
 * import type { World } from "./world.ts";
 * // declare const world: World; await world.readStdin();
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { Place } from "@intellectual-frontiers/anyfs/governance";
import type { AnyStore } from "@intellectual-frontiers/anyfs/logical";
import type { Config } from "./config.ts";

/** Why a store was not opened. */
export type OpenProblem = { readonly code: "E-PLACE-UNAVAILABLE" | "E-OPEN" | "E-ENVIRONMENT"; readonly message: string };

/** Where a plain path points: the root of the store of this computer it is in (`/` or a drive) and the path inside it. */
export type LocalPlace = { readonly root: string; readonly inner: string };

/** What the program keeps between runs: small texts by name, in its state folder. */
export type StateStore = {
  readonly read: (name: string) => Promise<string | undefined>;
  readonly write: (name: string, text: string) => Promise<void>;
};

/** The world a verb runs in. */
export type World = {
  /** The working folder, for the paths that are relative. */
  readonly cwd: string;
  /** The folder the program keeps its state in. */
  readonly stateDir: string;
  /** Whether the run's output is the one JSON document of `--json`: a verb then writes no bytes of its own to standard output. */
  readonly json: boolean;
  /** Opens the store of a place once for the run; the same place is the same store. */
  readonly open: (place: Place) => Promise<Result<AnyStore, OpenProblem>>;
  /** What a plain path points at on this computer. */
  readonly local: (path: string) => LocalPlace;
  /** Everything on standard input. */
  readonly readStdin: () => Promise<Uint8Array>;
  /** Bytes to standard output, as they are. */
  readonly writeStdout: (bytes: Uint8Array) => void;
  /** The bytes of a file of this computer. */
  readonly readLocalFile: (path: string) => Promise<Result<Uint8Array, string>>;
  readonly state: StateStore;
  /** A line to standard error, outside the report: what a long-running verb tells the person who started it (the address and the token of a server). */
  readonly notice: (text: string) => void;
  /** Aborted when the host asks the run to end (a test, or the process's own stop); a verb that waits listens to this as well as to the signal of its context. */
  readonly stop?: AbortSignal;
};

/** What the program holds for every run of its verbs. */
export type Host = {
  readonly env: (name: string) => string | undefined;
  readonly config: Config;
  /** Why the configuration could not be had, where a file was found and was wrong: a verb that needs the mounts ends with this. */
  readonly configProblem?: { readonly code: "E-CONFIG-LOAD" | "E-CONFIG-INVALID"; readonly message: string };
  /** The file the configuration was read from, where there was one. */
  readonly configFile?: string;
  readonly world: World;
};
