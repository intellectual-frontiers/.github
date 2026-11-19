// Spec: 0005-repositories FR-002
/**
 * Writing `.ergonex/repositories.ts` (commons ergonex 0005-repositories FR-002): the whole file is written next to the old one and renamed over it, so that a run that stops half way leaves the file as it was.
 *
 * @module
 */
import { mkdir, rename, writeTextFile } from "../platform/r-fs.ts";
import { dirname } from "../platform/r-path.ts";
import { renderRepositories, type RepoEntry } from "../repositories.ts";
import { repositoriesPath } from "./workspace.ts";

/** Writes the list of repositories of a root. */
export async function writeRepositoryList(home: string, entries: readonly RepoEntry[]): Promise<void> {
  const path = repositoriesPath(home);
  await mkdir(dirname(path), { recursive: true });
  const next = `${path}.${process.pid}.tmp`;
  await writeTextFile(next, renderRepositories(entries));
  await rename(next, path);
}
