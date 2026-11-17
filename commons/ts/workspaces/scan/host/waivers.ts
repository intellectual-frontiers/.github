/**
 * The waivers of the signed-commit rule that a managed repository's own harness record holds (commons 0023-if-workspaces FR-049): the Decisions of `ifccm.declaration.ts` at the root of the
 * repository, the file `0020-ifccm` FR-033 reads, of which an entry `signing-waiver <account> <key>` waives the rule for that bot account and that key and no other. The file is read as data,
 * never run (`mizan/changes/declaration.ts`), from inside the workspace root only.
 *
 * @remarks
 * A record that cannot be read waives nothing and is said (a note naming the repository), so that a harness is never left believing a waiver holds. A repository with no record has no waiver.
 *
 * @module
 */
import { decodeHarnessRecord, formatRecordError, signingWaivers } from "../../../mizan/changes/declaration.ts";
import type { SigningWaiver, SigningWaivers } from "../policy-scans.ts";
import { readInside } from "./scan.ts";

/** The name of the record in a repository's root. */
export const RECORD_FILE = "ifccm.declaration.ts";

/** The waivers of each repository (by its path under `root`) and what could not be read. */
export type WaiversRead = {
  readonly waivers: SigningWaivers;
  readonly notes: readonly { readonly repo: string; readonly reason: string }[];
};

/** Reads the harness record of each repository and the waivers its Decisions make. */
export async function readSigningWaivers(root: string, repositories: readonly string[]): Promise<WaiversRead> {
  const waivers = new Map<string, readonly SigningWaiver[]>();
  const notes: { repo: string; reason: string }[] = [];
  for (const repo of repositories) {
    const text = await readInside(root, `${repo}/${RECORD_FILE}`);
    if (text.kind === "err") {
      notes.push({ repo, reason: `${RECORD_FILE} could not be read: ${text.error.reason}` });
      continue;
    }
    if (text.value === undefined) continue;
    const record = decodeHarnessRecord(text.value);
    if (record.kind === "err") {
      notes.push({ repo, reason: `${RECORD_FILE} could not be read as data: ${formatRecordError(record.error)}` });
      continue;
    }
    const found = signingWaivers(record.value.decisions);
    if (found.length > 0) waivers.set(repo, found);
  }
  return { waivers, notes };
}
