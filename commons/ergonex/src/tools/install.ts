// Spec: 0002-workspace-model FR-039
/**
 * What an install of a pinned tool is, as pure functions (commons 0002-workspace-model FR-039, 0001-ergonex FR-018): the bytes of a downloaded artifact are checked against the pinned SHA-256
 * BEFORE anything is unpacked or written, an archive is unpacked in memory with every path checked (nothing may leave the tool's folder), the folder of the install and its install record
 * (the SHA-256 of each file, so that `ergonex tools verify` can find a file changed since) and the shims that put the tool's commands in one folder.
 *
 * @remarks
 * `host/install.ts` fetches through the runtime's `Transport` and writes; this module decides. A hash that differs is `hash-mismatch` and the caller has written nothing: there is no function
 * here that returns files for bytes that did not match. A catalog that pins `latest` or a range cannot reach this module (`catalog.ts` refuses it), and `pinProblem` refuses it again
 * for a tool built by hand.
 *
 * @module
 */
import { absurd, type Decoder, formatDecodeError, json, object, record, string, err, ok, type Result } from "@intellectual-frontiers/core";
import { type ArchiveError, type Files, filesOf, formatArchiveError, gunzip, untar, unzip } from "@intellectual-frontiers/formats";
import { sameSha256, sha256, type Sha256 } from "@intellectual-frontiers/crypto";
import { urlProblem, type Tool, type ToolArtifact, type ToolOs } from "./catalog.ts";

/** Why a tool was not installed; nothing is written for any of them. */
export type InstallError =
  | {
      readonly kind: "unpinned";
      readonly tool: string;
      readonly reason: string;
    }
  | {
      readonly kind: "no-artifact";
      readonly tool: string;
      readonly system: string;
    }
  | { readonly kind: "fetch"; readonly url: string; readonly reason: string }
  | {
      readonly kind: "hash-mismatch";
      readonly url: string;
      readonly expected: Sha256;
      readonly actual: Sha256;
    }
  | { readonly kind: "unpack"; readonly error: ArchiveError }
  | { readonly kind: "missing-bin"; readonly bin: string }
  | { readonly kind: "write"; readonly path: string; readonly reason: string };

/** An install error as one sentence that says what happened and that nothing was written. */
export function describeInstallError(e: InstallError): string {
  switch (e.kind) {
    case "unpinned":
      return `${e.tool} is not pinned: ${e.reason}; nothing was installed`;
    case "no-artifact":
      return `the catalog pins no artifact of ${e.tool} for ${e.system}; nothing was installed`;
    case "fetch":
      return `${e.url} could not be fetched (${e.reason}); nothing was written`;
    case "hash-mismatch":
      return `the bytes of ${e.url} are SHA-256 ${e.actual}, and the catalog pins ${e.expected}; the artifact is refused and nothing was written`;
    case "unpack":
      return `the artifact could not be unpacked, ${formatArchiveError(e.error)}; nothing was written`;
    case "missing-bin":
      return `the artifact holds no file ${e.bin}, the executable the catalog names; nothing was written`;
    case "write":
      return `${e.path} could not be written (${e.reason})`;
    default:
      return absurd(e);
  }
}

/** Why a tool may not be installed at all (a version that is not a pin, a URL that is not a pin), or undefined where it may. */
export function pinProblem(tool: Tool, artifact: ToolArtifact, loopbackHttp = false): string | undefined {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/.test(tool.version))
    return `${JSON.stringify(tool.version)} is not a pinned version (never \`latest\` and never a range)`;
  const url = urlProblem(artifact.url, loopbackHttp);
  return url === undefined ? undefined : `the URL is not a pin: ${url}`;
}

/** The files of a downloaded artifact, once the bytes are the pinned bytes: the hash is checked first and nothing is unpacked for a hash that differs. */
export async function unpackVerified(artifact: ToolArtifact, bytes: Uint8Array): Promise<Result<Files, InstallError>> {
  const actual = await sha256(bytes);
  if (!sameSha256(actual, artifact.sha256))
    return err({
      kind: "hash-mismatch",
      url: artifact.url,
      expected: artifact.sha256,
      actual,
    });
  let files: Result<Files, ArchiveError>;
  switch (artifact.kind) {
    case "file":
      files = ok(new Map([[artifact.bin, bytes]]));
      break;
    case "tar.gz": {
      const raw = await gunzip(bytes);
      if (raw.kind === "err") return err({ kind: "unpack", error: raw.error });
      const entries = untar(raw.value);
      files = entries.kind === "ok" ? ok(filesOf(entries.value)) : entries;
      break;
    }
    case "zip":
      files = await unzip(bytes);
      break;
    default:
      return absurd(artifact.kind);
  }
  if (files.kind === "err") return err({ kind: "unpack", error: files.error });
  if (!files.value.has(artifact.bin)) return err({ kind: "missing-bin", bin: artifact.bin });
  return ok(files.value);
}

/** The name of the install record inside a tool's folder. */
export const INSTALL_RECORD = ".ergonex-install.json";

/** What an install left: the tool, the artifact it came from and the SHA-256 of each file, written beside the files. */
export type InstallRecord = {
  readonly name: string;
  readonly version: string;
  readonly os: string;
  readonly arch: string;
  readonly url: string;
  /** The SHA-256 of the pinned artifact. */
  readonly artifactSha256: string;
  readonly bin: string;
  /** The SHA-256 of each file, by its path inside the folder. */
  readonly files: Readonly<Record<string, string>>;
};

const recordShape: Decoder<InstallRecord> = object({
  name: string,
  version: string,
  os: string,
  arch: string,
  url: string,
  artifactSha256: string,
  bin: string,
  files: record(string),
});

/** The record of an install: names the tool and the pin and holds the hash of every file. */
export async function installRecordOf(tool: Tool, artifact: ToolArtifact, files: Files): Promise<InstallRecord> {
  const hashes: Record<string, string> = {};
  for (const path of [...files.keys()].sort()) {
    const bytes = files.get(path);
    if (bytes !== undefined) hashes[path] = await sha256(bytes);
  }
  return {
    name: tool.name,
    version: tool.version,
    os: artifact.os,
    arch: artifact.arch,
    url: artifact.url,
    artifactSha256: artifact.sha256,
    bin: artifact.bin,
    files: hashes,
  };
}

/** The text of an install record: JSON with its keys in a fixed order and a final newline. */
export function writeInstallRecord(r: InstallRecord): string {
  const files: Record<string, string> = {};
  for (const k of Object.keys(r.files).sort()) files[k] = r.files[k] ?? "";
  return `${JSON.stringify({ name: r.name, version: r.version, os: r.os, arch: r.arch, url: r.url, artifactSha256: r.artifactSha256, bin: r.bin, files }, null, 2)}\n`;
}

/** An install record from its text, or why it is not one. */
export function readInstallRecord(text: string): Result<InstallRecord, string> {
  const r = json(text, recordShape);
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

/** What `ergonex tools verify` found wrong in an installed tool. */
export type InstallDrift =
  | { readonly kind: "changed"; readonly path: string }
  | { readonly kind: "missing"; readonly path: string }
  | { readonly kind: "extra"; readonly path: string }
  | { readonly kind: "unpinned"; readonly reason: string };

/** Compares the files found in a tool's folder (path to SHA-256) with its record, and the record with the catalog's pin; every difference is told, in the order of the paths. */
export function installDrift(record: InstallRecord, found: Readonly<Record<string, string>>, pin?: ToolArtifact): readonly InstallDrift[] {
  const out: InstallDrift[] = [];
  if (pin !== undefined && pin.sha256 !== record.artifactSha256) {
    out.push({
      kind: "unpinned",
      reason: `the install came from an artifact of SHA-256 ${record.artifactSha256}, and the catalog now pins ${pin.sha256}`,
    });
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
export function describeDrift(name: string, d: InstallDrift): string {
  switch (d.kind) {
    case "changed":
      return `${name}: ${d.path} is not the file that was installed (its SHA-256 differs from the install record)`;
    case "missing":
      return `${name}: ${d.path} is gone from the tool's folder`;
    case "extra":
      return `${name}: ${d.path} is in the tool's folder and was not installed with it`;
    case "unpinned":
      return `${name}: ${d.reason}`;
    default:
      return absurd(d);
  }
}

/** The folder of the shims below the home: `.ergonex/bin`. */
export const SHIM_DIR = ".ergonex/bin";

/** A shim: the file's name below the shim folder and its text. */
export type Shim = { readonly name: string; readonly text: string };

/** A path as one POSIX shell word in single quotes. */
function shellQuote(path: string): string {
  return `'${path.replaceAll("'", `'\\''`)}'`;
}

/**
 * The shim of one command of a tool: a POSIX `sh` script that runs the installed executable with its arguments (`name`), or on Windows a `.cmd` file (`name.cmd`). `exe` is the absolute path
 * of the installed executable; a path that cannot be put in the file safely (a `%` or a quote on Windows, a newline anywhere) is refused.
 */
export function shimOf(os: ToolOs, command: string, exe: string): Result<Shim, string> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(command)) return err(`${JSON.stringify(command)} is not a command name`);
  if (/[\r\n\0]/.test(exe)) return err("the path of the executable holds a line break");
  if (os === "windows") {
    if (/["%^&|<>]/.test(exe)) return err("the path of the executable holds a character a .cmd file cannot hold safely");
    return ok({ name: `${command}.cmd`, text: `@echo off\r\n"${exe}" %*\r\n` });
  }
  return ok({
    name: command,
    text: `#!/bin/sh\nexec ${shellQuote(exe)} "$@"\n`,
  });
}
