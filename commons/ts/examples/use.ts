/**
 * What a harness imports once it depends on IFC TypeScript's released tarball, by the package's own name (commons
 * 0005-typescript-runtime FR-029): the kernel's results, the runtime's typed errors and files, and the test registration that records
 * every test as evidence. A harness installs the release asset first:
 *
 * ```sh
 * bun add https://github.com/intellectual-frontiers/.github/releases/download/ifc-ts-v0.4.0/intellectual-frontiers-ifc-ts-0.4.0.tgz
 * ```
 *
 * @module
 */
import { andThen, err, ok, type Result } from "@intellectual-frontiers/ifc-ts/kernel";
import { errors, fs } from "@intellectual-frontiers/ifc-ts/runtime";

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
