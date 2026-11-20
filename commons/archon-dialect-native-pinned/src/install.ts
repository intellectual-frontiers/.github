// Spec: 0002-native-pinned-install FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * What an install of a pinned tool is, as pure functions (reshaped from the workspaces manager's own, commons ergonex 0002-workspace-model FR-039): the bytes of a downloaded artifact are checked
 * against the pinned SHA-256 before anything is unpacked, an archive is unpacked in memory with every path checked, the install record keeps the SHA-256 of each file so that a change since can be
 * found, and a shim puts a command in one folder. No file is read or written here and no network is reached.
 *
 * @remarks
 * A hash that differs is `hash-mismatch` and nothing is returned: there is no function here that gives files for bytes that did not match. An archive is refused whole for a path that leaves the
 * folder, a path twice, or a link (a link cannot be installed safely from memory). The program of a tool is found at its folder with its name, with `.exe` added on Windows where the name has no
 * extension.
 *
 * @example
 * ```ts
 * import { programFile } from "./install.ts";
 * programFile({ program: "bun", binPath: "bun-linux-x64", os: "linux" }); // "bun-linux-x64/bun"
 * ```
 *
 * @module
 */
import { absurd, err, formatDecodeError, json, object, ok, record, string, type Decoder, type Result } from "@intellectual-frontiers/core";
import { sameSha256, sha256, type Sha256 } from "@intellectual-frontiers/crypto/sha256";
import { filesOf, formatArchiveError, gunzip, isSafePath, untar, unzip, zipEntries, type ArchiveError, type Files } from "@intellectual-frontiers/formats/archive";

/** The operating systems a tool is installed on. */
export type Os = "linux" | "macos" | "windows";

/** What an install is made from: the tool, and the download its pin gave for the platform. */
export type InstallSpec = {
  readonly tool: string;
  readonly version: string;
  readonly platform: string;
  readonly os: Os;
  readonly program: string;
  readonly downloadUrl: string;
  readonly sha256: Sha256;
  readonly archiveFormat: "zip" | "tar" | "file";
  readonly binPath: string;
};

/** Why a tool was not installed; nothing is written for any of them. */
export type InstallError =
  | { readonly kind: "hash-mismatch"; readonly url: string; readonly expected: Sha256; readonly actual: Sha256 }
  | { readonly kind: "unpack"; readonly error: ArchiveError }
  | { readonly kind: "duplicate-path"; readonly path: string }
  | { readonly kind: "link"; readonly path: string }
  | { readonly kind: "missing-program"; readonly path: string };

/** An install error as one sentence that says what happened and that nothing was written. */
export function describeInstallError(e: InstallError): string {
  switch (e.kind) {
    case "hash-mismatch":
      return `the bytes of ${e.url} are SHA-256 ${e.actual}, and the pin is ${e.expected}; the artifact is refused and nothing was written`;
    case "unpack":
      return `the artifact could not be unpacked, ${formatArchiveError(e.error)}; nothing was written`;
    case "duplicate-path":
      return `the artifact holds the path ${e.path} twice; it is refused and nothing was written`;
    case "link":
      return `the artifact holds a link at ${e.path}, which cannot be installed safely; it is refused and nothing was written`;
    case "missing-program":
      return `the artifact holds no file ${e.path}, the program of the tool; nothing was written`;
    default:
      return absurd(e);
  }
}

/** The path of the program inside an install: its folder, and its name with `.exe` where the system is Windows and the name has no extension. */
export function programFile(s: { readonly program: string; readonly binPath: string; readonly os: Os }): string {
  const name = s.os === "windows" && !/\.[A-Za-z0-9]+$/.test(s.program) ? `${s.program}.exe` : s.program;
  return s.binPath === "" ? name : `${s.binPath}/${name}`;
}

async function unpackTar(bytes: Uint8Array): Promise<Result<Files, InstallError>> {
  const gzipped = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  let raw = bytes;
  if (gzipped) {
    const g = await gunzip(bytes);
    if (g.kind === "err") return err({ kind: "unpack", error: g.error });
    raw = g.value;
  }
  const entries = untar(raw);
  if (entries.kind === "err") return err({ kind: "unpack", error: entries.error });
  const seen = new Set<string>();
  for (const e of entries.value) {
    if (e.kind === "symlink" || e.kind === "hardlink") return err({ kind: "link", path: e.path });
    if (e.kind !== "file") continue;
    if (seen.has(e.path)) return err({ kind: "duplicate-path", path: e.path });
    seen.add(e.path);
  }
  return ok(filesOf(entries.value));
}

async function unpackZip(bytes: Uint8Array): Promise<Result<Files, InstallError>> {
  const listed = zipEntries(bytes);
  if (listed.kind === "err") return err({ kind: "unpack", error: listed.error });
  const seen = new Set<string>();
  for (const e of listed.value) {
    if (seen.has(e.name)) return err({ kind: "duplicate-path", path: e.name });
    seen.add(e.name);
  }
  const files = await unzip(bytes);
  return files.kind === "ok" ? ok(files.value) : err({ kind: "unpack", error: files.error });
}

/** The files of a downloaded artifact, once the bytes are the pinned bytes: the hash is checked first and nothing is unpacked for a hash that differs. */
export async function unpackVerified(spec: InstallSpec, bytes: Uint8Array): Promise<Result<Files, InstallError>> {
  const actual = await sha256(bytes);
  if (!sameSha256(actual, spec.sha256)) return err({ kind: "hash-mismatch", url: spec.downloadUrl, expected: spec.sha256, actual });
  const program = programFile(spec);
  let files: Result<Files, InstallError>;
  switch (spec.archiveFormat) {
    case "file":
      files = ok(new Map([[program, bytes]]));
      break;
    case "tar":
      files = await unpackTar(bytes);
      break;
    case "zip":
      files = await unpackZip(bytes);
      break;
    default:
      return absurd(spec.archiveFormat);
  }
  if (files.kind === "err") return files;
  for (const path of files.value.keys()) if (!isSafePath(path)) return err({ kind: "unpack", error: { kind: "unsafe-path", path } });
  if (!files.value.has(program)) return err({ kind: "missing-program", path: program });
  return ok(files.value);
}

/** The name of the install record inside a tool's folder. */
export const INSTALL_RECORD = ".archon-install.json";

/** What an install left: the tool, the artifact it came from, the program and the SHA-256 of each file, written beside the files. */
export type InstallRecord = {
  readonly tool: string;
  readonly version: string;
  readonly platform: string;
  readonly url: string;
  /** The SHA-256 of the pinned artifact. */
  readonly artifactSha256: string;
  /** The path of the program inside the folder. */
  readonly program: string;
  /** The SHA-256 of each file, by its path inside the folder. */
  readonly files: Readonly<Record<string, string>>;
};

const recordShape: Decoder<InstallRecord> = object({
  tool: string,
  version: string,
  platform: string,
  url: string,
  artifactSha256: string,
  program: string,
  files: record(string),
});

/** The record of an install: names the tool and the pin and holds the hash of every file. */
export async function installRecordOf(spec: InstallSpec, files: Files): Promise<InstallRecord> {
  const hashes: Record<string, string> = {};
  for (const path of [...files.keys()].sort()) {
    const bytes = files.get(path);
    if (bytes !== undefined) hashes[path] = await sha256(bytes);
  }
  return { tool: spec.tool, version: spec.version, platform: spec.platform, url: spec.downloadUrl, artifactSha256: spec.sha256, program: programFile(spec), files: hashes };
}

/** The text of an install record: JSON with its keys in a fixed order, two spaces and a final line break. */
export function writeInstallRecord(r: InstallRecord): string {
  const files: Record<string, string> = {};
  for (const k of Object.keys(r.files).sort()) files[k] = r.files[k] ?? "";
  return `${JSON.stringify({ tool: r.tool, version: r.version, platform: r.platform, url: r.url, artifactSha256: r.artifactSha256, program: r.program, files }, null, 2)}\n`;
}

/** An install record from its text, or why it is not one. */
export function readInstallRecord(text: string): Result<InstallRecord, string> {
  const r = json(text, recordShape);
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

/** What a comparison of an installed folder with its record found. */
export type InstallDrift =
  | { readonly kind: "changed"; readonly path: string }
  | { readonly kind: "missing"; readonly path: string }
  | { readonly kind: "extra"; readonly path: string }
  | { readonly kind: "unpinned"; readonly reason: string };

/** Compares the files found in a tool's folder (path to SHA-256) with its record, and the record with the pin; every difference is told, in the order of the paths. */
export function installDrift(record: InstallRecord, found: Readonly<Record<string, string>>, pinSha256?: string): readonly InstallDrift[] {
  const out: InstallDrift[] = [];
  if (pinSha256 !== undefined && pinSha256 !== record.artifactSha256) {
    out.push({ kind: "unpinned", reason: `the install came from an artifact of SHA-256 ${record.artifactSha256}, and the pin now names ${pinSha256}` });
  }
  for (const path of Object.keys(record.files).sort()) {
    const have = Object.hasOwn(found, path) ? found[path] : undefined;
    if (have === undefined) out.push({ kind: "missing", path });
    else if (have !== record.files[path]) out.push({ kind: "changed", path });
  }
  for (const path of Object.keys(found).sort()) if (!Object.hasOwn(record.files, path)) out.push({ kind: "extra", path });
  return out;
}

/** An install drift as one sentence. */
export function describeDrift(tool: string, d: InstallDrift): string {
  switch (d.kind) {
    case "changed":
      return `${tool}: ${d.path} is not the file that was installed (its SHA-256 differs from the install record)`;
    case "missing":
      return `${tool}: ${d.path} is gone from the tool's folder`;
    case "extra":
      return `${tool}: ${d.path} is in the tool's folder and was not installed with it`;
    case "unpinned":
      return `${tool}: ${d.reason}`;
    default:
      return absurd(d);
  }
}

/** A shim: the file's name below the shim folder and its text. */
export type Shim = { readonly name: string; readonly text: string };

/** A path as one POSIX shell word in single quotes. */
function shellQuote(path: string): string {
  return `'${path.replaceAll("'", `'\\''`)}'`;
}

/**
 * The shim of one command of a tool: a POSIX `sh` script that runs the installed program with its arguments (`command`), or on Windows a `.cmd` file (`command.cmd`). `exe` is the absolute path of
 * the installed program; a path that cannot be put in the file safely (a line break anywhere, a `"`, `%`, `^`, `&`, `|`, `<` or `>` on Windows) is refused.
 */
export function shimOf(os: Os, command: string, exe: string): Result<Shim, string> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(command)) return err(`${JSON.stringify(command)} is not a command name`);
  if (/[\r\n\0]/.test(exe)) return err("the path of the program holds a line break");
  if (os === "windows") {
    if (/["%^&|<>]/.test(exe)) return err("the path of the program holds a character a .cmd file cannot hold safely");
    return ok({ name: `${command}.cmd`, text: `@echo off\r\n"${exe}" %*\r\n` });
  }
  return ok({ name: command, text: `#!/bin/sh\nexec ${shellQuote(exe)} "$@"\n` });
}
