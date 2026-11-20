// Spec: 0001-repoctl-layers FR-006
/**
 * The ports of Repoctl (commons repoctl 0001-repoctl-layers FR-006): everything a verb needs of the world, as records of functions that the Physical layer fills and a test fills with its own. A program is run through `Process`
 * (the same shape as Headless' executor, with the output as text), a file is read and written through `Files`, the registry of npm is asked through `Registry`, and a credential is taken through `Credentials` and never
 * through the environment of a verb. Nothing in Governance or Logical reads a file, runs a program or reaches the network except through these.
 *
 * @example
 * ```ts
 * import type { Process } from "@intellectual-frontiers/repoctl/logical";
 * const none: Process = { run: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }) };
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { Secret } from "@intellectual-frontiers/headless/logical";
import type { VersionConstant } from "./constants.ts";

/** How a program ended, with its output as text. */
export type Run = { readonly code: number; readonly stdout: string; readonly stderr: string };

/** How to run a program: where, and with which variables added to its environment. */
export type RunOptions = { readonly cwd?: string; readonly env?: Readonly<Record<string, string>> };

/** The port that runs a program by its argument vector, with no shell between. */
export type Process = { readonly run: (argv: readonly string[], options?: RunOptions) => Promise<Run> };

/** The port of files. Paths are absolute; a folder's entries are names. */
export type Files = {
  /** The text of a file, or undefined where it is not there. */
  readonly read: (path: string) => Promise<string | undefined>;
  /** Writes a text (making the folder), with the mode where one is given. */
  readonly write: (path: string, text: string, mode?: number) => Promise<void>;
  /** Removes a file; nothing where it is not there. */
  readonly remove: (path: string) => Promise<void>;
  /** Whether a file or a folder is there. */
  readonly exists: (path: string) => Promise<boolean>;
  /** The names in a folder, files and folders, sorted; none where it is not there. */
  readonly list: (dir: string) => Promise<readonly string[]>;
  /** Every file under a folder, as paths from the folder, sorted, leaving out `node_modules`; none where it is not there. */
  readonly walk: (dir: string) => Promise<readonly string[]>;
  /** Makes a private folder outside the repository and gives its path. */
  readonly makeTemp: (prefix: string) => Promise<string>;
  /** Removes a folder and what is in it. */
  readonly removeTree: (path: string) => Promise<void>;
};

/** What npm shows of a package. */
export type NpmView = { readonly latest: string | undefined; readonly versions: readonly string[] };

/** The port of the registry of npm: what it shows of a package, or `absent` where it has none, or why it could not be asked. */
export type Registry = { readonly view: (name: string) => Promise<Result<NpmView | "absent", string>> };

/** The port of credentials: the token for npm is held by whoever publishes and is read from where the host keeps it, never from a verb's own options. */
export type Credentials = { readonly npmToken: () => Secret | undefined };

/** What a library says of itself, read from its manifest. */
export type LibraryInfo = {
  readonly name: string;
  /** Its folder from the repository's root. */
  readonly folder: string;
  readonly version: string;
  readonly level: string;
  /** Its spec kit from its folder, where it has one. */
  readonly specKit: string | undefined;
  readonly npm: boolean;
  readonly versionConstants: readonly VersionConstant[];
};

/** The port of the manifests: every library of the repository, or why they cannot be read. */
export type Libraries = { readonly list: () => Promise<Result<readonly LibraryInfo[], string>> };

/** The world a verb runs in: the repository's root and every port. */
export type World = {
  /** The absolute path of the repository's root. */
  readonly repo: string;
  readonly process: Process;
  readonly files: Files;
  readonly registry: Registry;
  readonly credentials: Credentials;
  readonly libraries: Libraries;
};
