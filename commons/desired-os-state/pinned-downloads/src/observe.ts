// Spec: 0004-pinned-downloads-dialect FR-002, FR-006
/**
 * What is installed: each tool is looked for in the store first (a copy whose install record is there and whose program is there too), then on the PATH under the program's name and each of its
 * other names, and each program found on the PATH is asked its version with the tool's arguments under a limit of time. A program that cannot be asked (a hang, a crash, no version in what it
 * says) is reported as found and unreadable and never ends the run. A tool that is in the store answers with no network and no write.
 *
 * @example
 * ```ts
 * import { versionOf } from "./observe.ts";
 * versionOf("jq-1.7.1"); // "1.7.1"
 * ```
 *
 * @module
 */
import { compareVersions } from "@intellectual-frontiers/toolchain/governance";
import type { ObservedTool } from "@intellectual-frontiers/toolchain/logical";
import * as fs from "@intellectual-frontiers/system/fs";
import * as path from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import type { ToolJob } from "./plan-file.ts";
import { readInstalled, type Store } from "./store.ts";

const VERSION = /\d+(?:\.\d+){1,3}(?:-[0-9A-Za-z.]+)?/;

/** The first version in a text (`jq-1.7.1` and `git version 2.43.0` give `1.7.1` and `2.43.0`), or nothing. */
export function versionOf(text: string): string | undefined {
  return VERSION.exec(text)?.[0];
}

/** Runs a program with the tool's arguments and gives what it said, or nothing where it could not be asked. */
export type Ask = (argv: readonly string[]) => Promise<string | undefined>;

/** An `Ask` that gives a program `ms` milliseconds and then stops it; where a program has started others that keep its output open, the answer is still given at the limit and never waits for them. */
export function askWithin(ms: number): Ask {
  return async (argv) => {
    const stop = new AbortController();
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => stop.abort(), ms)];
    try {
      const done = proc.run(argv, { signal: stop.signal, killAfterMs: 200 }).then(
        (out) => (out.success ? `${out.stdout}\n${out.stderr}` : undefined),
        () => undefined,
      );
      const limit = new Promise<undefined>((resolve) => timers.push(setTimeout(() => resolve(undefined), ms + 300)));
      return await Promise.race([done, limit]);
    } finally {
      for (const t of timers) clearTimeout(t);
    }
  };
}

/** What was found of one tool. */
export type Observation = {
  readonly seen: ObservedTool | undefined;
  /** Where it was found: the program's path. */
  readonly location: string | undefined;
  /** Why a program that was found could not be read. */
  readonly unreadable: string | undefined;
};

/** What `observeJob` looks in and asks with. */
export type ObserveOptions = {
  /** The PATH to look in. */
  readonly path: string | undefined;
  readonly ask: Ask;
};

/** The tool in the store: the version the job names where it is there, else the latest version that is. */
async function inStore(job: ToolJob, store: Store): Promise<Observation | undefined> {
  if (job.version !== null) {
    const there = await readInstalled(store, job.tool, job.version);
    if (there !== undefined) return { seen: { version: there.record.version, from: "store" }, location: there.program, unreadable: undefined };
  }
  const versions = (await fs.listDirs(path.join(store.root, job.tool))).sort((a, b) => compareVersions(b, a));
  for (const v of versions) {
    const there = await readInstalled(store, job.tool, v);
    if (there !== undefined) return { seen: { version: there.record.version, from: "store" }, location: there.program, unreadable: undefined };
  }
  return undefined;
}

/** What is observed of one tool: the store first, then the PATH. */
export async function observeJob(job: ToolJob, store: Store, o: ObserveOptions): Promise<Observation> {
  const stored = await inStore(job, store);
  if (stored !== undefined) return stored;
  for (const name of [job.program, ...job.alsoNamed]) {
    const found = o.path === undefined ? proc.which(name) : proc.which(name, o.path);
    if (found === undefined) continue;
    if (job.versionArgs.length === 0) return { seen: undefined, location: found, unreadable: `${name} cannot be asked its version` };
    const said = await o.ask([found, ...job.versionArgs]);
    const version = said === undefined ? undefined : versionOf(said);
    if (version === undefined) return { seen: undefined, location: found, unreadable: `${found} did not say its version` };
    return { seen: { version, from: "path" }, location: found, unreadable: undefined };
  }
  return { seen: undefined, location: undefined, unreadable: undefined };
}
