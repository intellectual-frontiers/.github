// Spec: 0002-native-pinned-install FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * What an install of a pinned tool is, as pure functions (reshaped from the workspaces manager's own, commons ergonex 0002-workspace-model FR-039): the bytes of a downloaded artifact are checked
 * against the pinned SHA-256 before anything is unpacked, an archive is unpacked in memory with every path checked, the install record keeps the SHA-256 of each file so that a change since can be
 * found, and a shim puts a command in one folder. No file is read or written here and no network is reached.
 *
 * @remarks
 * A hash that differs is `hash-mismatch` and nothing is returned: there is no function here that gives files for bytes that did not match. An archive is refused whole for a path that leaves the
 * folder, a path twice, or a link that cannot be installed safely (`links.ts` says which are: a relative target that stays inside the folder, names what the archive holds (a link may name a link) and passes through no other
 * link). A tar is read whether it is plain, gzipped or xz-compressed, found by its first bytes. The program of a tool is found at its folder with its name, with `.exe` added on Windows where the name has
 * no extension.
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
import { formatArchiveError, gunzip, isSafePath, untar, unzip, zipEntries, type ArchiveError } from "@intellectual-frontiers/formats/archive";
import { isXz, unxz } from "@intellectual-frontiers/formats/xz";
import { describeLinkRefusal, resolveLinks, type LinkRefusal, type Unpacked } from "./links.ts";

export type { LinkProblem, LinkRefusal, SymbolicLink, Unpacked } from "./links.ts";

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
  | LinkRefusal
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
      return describeLinkRefusal(e);
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

async function unpackTar(bytes: Uint8Array, windows: boolean): Promise<Result<Unpacked, InstallError>> {
  let raw = bytes;
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const g = await gunzip(bytes);
    if (g.kind === "err") return err({ kind: "unpack", error: g.error });
    raw = g.value;
  } else if (isXz(bytes)) {
    const x = await unxz(bytes);
    if (x.kind === "err") return err({ kind: "unpack", error: x.error });
    raw = x.value;
  }
  const entries = untar(raw);
  if (entries.kind === "err") return err({ kind: "unpack", error: entries.error });
  return resolveLinks(entries.value, windows);
}

async function unpackZip(bytes: Uint8Array): Promise<Result<Unpacked, InstallError>> {
  const listed = zipEntries(bytes);
  if (listed.kind === "err") return err({ kind: "unpack", error: listed.error });
  const seen = new Set<string>();
  for (const e of listed.value) {
    if (seen.has(e.name)) return err({ kind: "duplicate-path", path: e.name });
    seen.add(e.name);
  }
  const files = await unzip(bytes);
  return files.kind === "ok" ? ok({ files: files.value, executable: new Set<string>(), links: [] }) : err({ kind: "unpack", error: files.error });
}

/** The files and symbolic links of a downloaded artifact, once the bytes are the pinned bytes: the hash is checked first and nothing is unpacked for a hash that differs. */
export async function unpackVerified(spec: InstallSpec, bytes: Uint8Array): Promise<Result<Unpacked, InstallError>> {
  const actual = await sha256(bytes);
  if (!sameSha256(actual, spec.sha256)) return err({ kind: "hash-mismatch", url: spec.downloadUrl, expected: spec.sha256, actual });
  const program = programFile(spec);
  let files: Result<Unpacked, InstallError>;
  switch (spec.archiveFormat) {
    case "file":
      files = ok({ files: new Map([[program, bytes]]), executable: new Set([program]), links: [] });
      break;
    case "tar":
      files = await unpackTar(bytes, spec.os === "windows");
      break;
    case "zip":
      files = await unpackZip(bytes);
      break;
    default:
      return absurd(spec.archiveFormat);
  }
  if (files.kind === "err") return files;
  for (const path of [...files.value.files.keys(), ...files.value.links.map((l) => l.path)]) if (!isSafePath(path)) return err({ kind: "unpack", error: { kind: "unsafe-path", path } });
  if (!files.value.files.has(program) && !files.value.links.some((l) => l.path === program)) return err({ kind: "missing-program", path: program });
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
  /** The target of each symbolic link, by its path inside the folder. */
  readonly links: Readonly<Record<string, string>>;
};

const recordShape: Decoder<InstallRecord> = object({
  tool: string,
  version: string,
  platform: string,
  url: string,
  artifactSha256: string,
  program: string,
  files: record(string),
  links: record(string),
});

/** The record of an install: names the tool and the pin and holds the hash of every file. */
export async function installRecordOf(spec: InstallSpec, unpacked: Unpacked): Promise<InstallRecord> {
  const hashes: Record<string, string> = {};
  for (const path of [...unpacked.files.keys()].sort()) {
    const bytes = unpacked.files.get(path);
    if (bytes !== undefined) hashes[path] = await sha256(bytes);
  }
  const links: Record<string, string> = {};
  for (const l of [...unpacked.links].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) links[l.path] = l.target;
  return { tool: spec.tool, version: spec.version, platform: spec.platform, url: spec.downloadUrl, artifactSha256: spec.sha256, program: programFile(spec), files: hashes, links };
}

/** The text of an install record: JSON with its keys in a fixed order, two spaces and a final line break. */
export function writeInstallRecord(r: InstallRecord): string {
  const files: Record<string, string> = {};
  for (const k of Object.keys(r.files).sort()) files[k] = r.files[k] ?? "";
  const links: Record<string, string> = {};
  for (const k of Object.keys(r.links).sort()) links[k] = r.links[k] ?? "";
  return `${JSON.stringify({ tool: r.tool, version: r.version, platform: r.platform, url: r.url, artifactSha256: r.artifactSha256, program: r.program, files, links }, null, 2)}\n`;
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

/** What was found in a tool's folder: the SHA-256 of each file by its path, and the target of each symbolic link by its path. */
export type FoundFolder = { readonly files: Readonly<Record<string, string>>; readonly links: Readonly<Record<string, string>> };

/** Compares what was found in a tool's folder with its record, and the record with the pin; every file or link changed, missing or extra is told, in the order of the paths, files before links. */
export function installDrift(record: InstallRecord, found: FoundFolder, pinSha256?: string): readonly InstallDrift[] {
  const out: InstallDrift[] = [];
  if (pinSha256 !== undefined && pinSha256 !== record.artifactSha256) {
    out.push({ kind: "unpinned", reason: `the install came from an artifact of SHA-256 ${record.artifactSha256}, and the pin now names ${pinSha256}` });
  }
  const compare = (want: Readonly<Record<string, string>>, have: Readonly<Record<string, string>>): void => {
    for (const path of Object.keys(want).sort()) {
      const seen = Object.hasOwn(have, path) ? have[path] : undefined;
      if (seen === undefined) out.push({ kind: "missing", path });
      else if (seen !== want[path]) out.push({ kind: "changed", path });
    }
    for (const path of Object.keys(have).sort()) if (!Object.hasOwn(want, path)) out.push({ kind: "extra", path });
  };
  compare(record.files, found.files);
  compare(record.links, found.links);
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
