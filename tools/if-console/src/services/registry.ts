// What a repository's launcher said about itself, kept so that it is asked once: its command list, each command's description and the
// values a noun's `list` offers. One cache for each repository, emptied when the launcher or its declaration changes on disk (see watch.ts),
// so that the next read asks the launcher again.
import type { CommandDetail, CommandList } from '../model/wire';

export class RegistryCache {
  list: CommandList | null = null;
  readonly details = new Map<string, CommandDetail>();
  readonly nounValues = new Map<string, string[]>();
  /** Counts how many times it was emptied: a test, or a view, can tell that what it holds is not the first answer. */
  generation = 0;

  clear(): void {
    this.list = null;
    this.details.clear();
    this.nounValues.clear();
    this.generation += 1;
  }
}
