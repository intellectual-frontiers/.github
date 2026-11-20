// Spec: 0001-kanon-checker FR-001
/**
 * The two names a table is made of (commons 0033-kanon FR-010): a folder of a library and a package's name, branded types made only by their smart constructors (parse, don't validate).
 *
 * @module
 */
import { type Brand, err, ok, refine, type Result, string } from "@intellectual-frontiers/core";

/** A folder of a library from its root, with a trailing `/` (`./` for the files at the root): made only by `parseFolder`. */
export type FolderName = Brand<string, "kanon folder">;
/** A package's name, as `@scope/name` or `name`: made only by `parsePackageName`. */
export type PackageName = Brand<string, "kanon package name">;

const folderDecoder = refine(
  string,
  "kanon folder",
  (t) => t === "./" || (/^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\/$/.test(t) && !t.split("/").includes("..")),
);
const packageDecoder = refine(string, "kanon package name", (t) => /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(t));

/** A folder from text, or why the text is not one: the one way a `FolderName` is made. */
export function parseFolder(text: string): Result<FolderName, string> {
  const r = folderDecoder(text, "folder");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a folder: it ends with a slash, as ./ or src/governance/`);
}

/** A package name from text, or why the text is not one: the one way a `PackageName` is made. */
export function parsePackageName(text: string): Result<PackageName, string> {
  const r = packageDecoder(text, "package");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a package name, as @scope/name`);
}

