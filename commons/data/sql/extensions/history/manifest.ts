// Spec: 0018-sql-history FR-002
/**
 * The manifest of a history (commons data 0018-sql-history FR-002): the files in order, each with the hash of its text and a chain hash of the entry before it. A file that is changed, taken out,
 * put in or moved breaks the chain, and a file whose identifier no longer matches what it holds is found even where its manifest entry was edited to match.
 *
 * @module
 */
import { type Artifact, hashOf, sha256Hex, stepIdOf } from "./deps.ts";
import { parseStep } from "./format.ts";

/** One entry of the manifest. */
export interface ManifestEntry {
  readonly number: number;
  readonly file: string;
  readonly id: string;
  readonly from: string;
  readonly to: string;
  /** The SHA-256 of the file's text. */
  readonly sha256: string;
  readonly chain: string;
}

/** The manifest. */
export interface Manifest {
  readonly format: 1;
  readonly dialect: string;
  /** The state the history starts from. */
  readonly base: string;
  readonly entries: readonly ManifestEntry[];
}

/** The chain hash before the first entry. */
export const GENESIS = "0".repeat(64);

/** The chain hash of an entry, given the one before it. */
export const chainOf = (previous: string, e: Omit<ManifestEntry, "chain">): string =>
  hashOf({ previous, number: e.number, file: e.file, id: e.id, from: e.from, to: e.to, sha256: e.sha256 });

/** The manifest as text. */
export const renderManifest = (m: Manifest): string => `${JSON.stringify(m, null, 2)}\n`;

/** What is wrong with a history. */
export type Problem =
  | { readonly kind: "manifest"; readonly why: string }
  | { readonly kind: "missing"; readonly file: string }
  | { readonly kind: "edited"; readonly file: string }
  | { readonly kind: "identity"; readonly file: string }
  | { readonly kind: "chain"; readonly number: number }
  | { readonly kind: "order"; readonly number: number }
  | { readonly kind: "unreadable"; readonly file: string; readonly why: string };

/**
 * Whether a history holds together.
 *
 * @param files - the files of the history, by path
 * @param folder - the folder the history is in
 * @returns the manifest and what is wrong with the history
 */
export function checkHistory(
  files: readonly Artifact[],
  folder: string,
): { readonly manifest: Manifest | undefined; readonly problems: readonly Problem[] } {
  const text = files.find((f) => f.path === `${folder}/manifest.json`)?.text;
  if (text === undefined) return { manifest: undefined, problems: [] };
  let manifest: Manifest;
  try {
    manifest = JSON.parse(text) as Manifest;
  } catch {
    return { manifest: undefined, problems: [{ kind: "manifest", why: "the manifest is not JSON" }] };
  }
  const problems: Problem[] = [];
  let previous = GENESIS;
  let at = manifest.base;
  manifest.entries.forEach((e, i) => {
    if (e.number !== i + 1 || e.from !== at) problems.push({ kind: "order", number: e.number });
    at = e.to;
    const file = files.find((f) => f.path === e.file);
    if (file === undefined) problems.push({ kind: "missing", file: e.file });
    else {
      if (sha256Hex(file.text) !== e.sha256) problems.push({ kind: "edited", file: e.file });
      const parsed = parseStep(file.text);
      if (parsed.kind === "err") problems.push({ kind: "unreadable", file: e.file, why: parsed.error.join("; ") });
      else if (
        stepIdOf({
          from: parsed.value.step.from,
          to: parsed.value.step.to,
          key: parsed.value.step.key,
          up: parsed.value.step.up,
          verify: parsed.value.step.verify,
        }) !== parsed.value.step.id ||
        parsed.value.step.id !== e.id
      )
        problems.push({ kind: "identity", file: e.file });
    }
    const { chain, ...rest } = e;
    if (chain !== chainOf(previous, rest)) problems.push({ kind: "chain", number: e.number });
    previous = chain;
  });
  return { manifest, problems };
}
