/**
 * What a harness imports once it depends on commons by Git, by the package's own name (commons 0005-typescript-runtime FR-029): the
 * kernel's results, the runtime's typed errors and files, and the test registration that records every test as evidence. A harness adds
 * the repository's root package at a commit, which its `bun.lock` then holds, and runs on Bun as it is, or on Node 26 with the hook
 * (FR-070):
 *
 * ```sh
 * bun add github:intellectual-frontiers/.github#<commit>
 * node --import @intellectual-frontiers/commons/ts/node app.ts
 * ```
 *
 * @module
 */
import { andThen, err, ok, type Result } from "@intellectual-frontiers/core";
import { errors, fs } from "@intellectual-frontiers/commons/ts/runtime";

/** Half of an even number, or why not. */
export const half = (n: number): Result<number, string> => (n % 2 === 0 ? ok(n / 2) : err(`${n} is odd`));

/** A quarter of a number, where both halvings succeed. */
export const quarter = (n: number): Result<number, string> => andThen(half(n), half);

/** The text of a file, or `undefined` where there is none: the runtime's `NotFound` is the one failure expected here. */
export async function textOrNothing(file: string): Promise<string | undefined> {
  try {
    return await fs.readTextFile(file);
  } catch (e) {
    if (e instanceof errors.NotFound) return undefined;
    throw e;
  }
}
