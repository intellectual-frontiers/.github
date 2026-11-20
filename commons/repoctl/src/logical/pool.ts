// Spec: 0003-repoctl-sync FR-007
/**
 * Jobs run a few at a time (commons repoctl 0003-repoctl-sync FR-007): the checks of the libraries are independent reads, so they run in a pool of a fixed width, and their results are in the order of the jobs, whatever order they
 * finished in. A pure function of the jobs it is given.
 *
 * @example
 * ```ts
 * import { pool } from "./pool.ts";
 * await pool([3, 1, 2], 2, (n) => Promise.resolve(n * 2)); // [6, 2, 4]
 * ```
 *
 * @module
 */

/** Runs `job` on each item, at most `width` at a time, and gives the results in the order of the items. */
export async function pool<T, R>(items: readonly T[], width: number, job: (item: T) => Promise<R>): Promise<readonly R[]> {
  const results: R[] = [];
  const order = items.map((item, index) => ({ item, index }));
  const slots: Promise<void>[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const mine = order[next++];
      if (mine === undefined) return;
      results[mine.index] = await job(mine.item);
    }
  };
  for (let i = 0; i < Math.max(1, Math.min(width, items.length)); i++) slots.push(worker());
  await Promise.all(slots);
  return results;
}
