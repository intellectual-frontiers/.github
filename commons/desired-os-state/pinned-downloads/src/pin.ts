// Spec: 0005-pinned-downloads-pin FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The pin tool: from the addresses a publisher gives for a version of a program, it fetches each artifact, takes its SHA-256 itself, checks it against the checksum the publisher
 * publishes where the request names one, proves the artifact unpacks safely with the program where it is said to be, and writes a proposal for a person to review. It writes no pin: a
 * pin is written in the packaging ontology by its owner, and nothing a tool proposed becomes one unreviewed.
 *
 * @example
 * ```ts
 * import { readPinRequest } from "./pin.ts";
 * readPinRequest("{}").kind; // "err"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { Retries, fetchTo } from "@intellectual-frontiers/net/net";
import * as fs from "@intellectual-frontiers/system/fs";
import * as path from "@intellectual-frontiers/system/path";
import { describeInstallError, unpackVerified, type Os } from "./install.ts";

/** Where a publisher gives the checksum of an artifact: the address of a file, and the name the artifact has in it where the file lists several. */
export type ChecksumSource = { readonly url: string; readonly name?: string };

/** What is asked of one platform. */
export type PlatformRequest = { readonly downloadUrl: string; readonly archiveFormat: "zip" | "tar" | "file"; readonly binPath: string; readonly checksum?: ChecksumSource };

/** What is asked: a program at a version, and its artifact on each platform. */
export type PinRequest = { readonly name: string; readonly version: string; readonly program: string; readonly platforms: Readonly<Record<string, PlatformRequest>> };

/** How the checksum the publisher gives compares with the one taken: `verified` where equal, `mismatch` where not, `absent` where no source was named, `unreadable` where the file or the line could not be read. */
export type PublisherCheck = "verified" | "mismatch" | "absent" | "unreadable";

/** What was found of one platform. */
export type PlatformProposal = {
  readonly platform: string;
  readonly downloadUrl: string;
  readonly archiveFormat: "zip" | "tar" | "file";
  readonly binPath: string;
  /** The SHA-256 of the bytes this tool fetched, or nothing where none could be fetched. */
  readonly sha256: string | null;
  readonly bytes: number;
  readonly publisher: PublisherCheck;
  readonly publisherSays: string | null;
  /** Whether the artifact unpacked safely with the program where it is said to be, or why not. */
  readonly program: "found" | string;
  /** Everything a reviewer should know before taking it. */
  readonly concerns: readonly string[];
};

/** A proposal: ready for review only where every platform is verified by the publisher and has its program. */
export type PinProposal = { readonly format: "pinned-downloads-pin-proposal/1"; readonly name: string; readonly version: string; readonly program: string; readonly ready: boolean; readonly platforms: readonly PlatformProposal[] };

/** Fetches the bytes at an address, or says why not. */
export type FetchBytes = (url: string) => Promise<Result<Uint8Array, string>>;

const HEX64 = /^[0-9a-f]{64}$/;
const NAME = /^[a-z0-9][a-z0-9._-]*$/;

function isRecord(v: unknown): v is Readonly<Record<string, unknown>> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The platform's system, from its name (`windows-x64`, `macos-arm64`, `linux-x64`). */
export function osOfPlatform(platform: string): Os {
  return platform.startsWith("windows") ? "windows" : platform.startsWith("macos") ? "macos" : "linux";
}

function https(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return "is not an https address";
    if (u.username !== "" || u.password !== "") return "carries credentials";
    return undefined;
  } catch {
    return "is not an address";
  }
}

function platformOf(v: unknown, at: string): Result<PlatformRequest, string> {
  if (!isRecord(v)) return err(`${at} is not an object`);
  const { downloadUrl, archiveFormat, binPath, checksum } = v;
  if (typeof downloadUrl !== "string") return err(`${at} gives no address`);
  const bad = https(downloadUrl);
  if (bad !== undefined) return err(`${at}: the address ${bad}`);
  if (archiveFormat !== "zip" && archiveFormat !== "tar" && archiveFormat !== "file") return err(`${at}: the format is zip, tar or file`);
  if (typeof binPath !== "string") return err(`${at}: the folder of the program is a text (empty for the root)`);
  if (checksum === undefined) return ok({ downloadUrl, archiveFormat, binPath });
  if (!isRecord(checksum) || typeof checksum["url"] !== "string") return err(`${at}: a checksum names the address of the publisher's file`);
  const badSum = https(checksum["url"]);
  if (badSum !== undefined) return err(`${at}: the address of the checksum ${badSum}`);
  const name = checksum["name"];
  if (name !== undefined && typeof name !== "string") return err(`${at}: the name in the checksum file is a text`);
  return ok({ downloadUrl, archiveFormat, binPath, checksum: name === undefined ? { url: checksum["url"] } : { url: checksum["url"], name } });
}

/** A request from its text, or why it is not one: https addresses only, with no credentials, and a name, a version and a program of the usual form. */
export function readPinRequest(text: string): Result<PinRequest, string> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err("the request is not JSON");
  }
  if (!isRecord(raw)) return err("the request is not an object");
  const { name, version, program, platforms } = raw;
  if (typeof name !== "string" || !NAME.test(name)) return err("the request names no program in lower case words");
  if (typeof version !== "string" || version === "") return err("the request names no version");
  if (typeof program !== "string" || !NAME.test(program.toLowerCase())) return err("the request names no program file");
  if (!isRecord(platforms) || Object.keys(platforms).length === 0) return err("the request names no platform");
  const out: Record<string, PlatformRequest> = {};
  for (const [p, v] of Object.entries(platforms)) {
    const r = platformOf(v, `platform ${p}`);
    if (r.kind === "err") return r;
    out[p] = r.value;
  }
  return ok({ name, version, program, platforms: out });
}

/** The checksum a publisher's file gives for an artifact: the line that names it (`<hex>  <name>` or `<hex> *<name>`), or the one hash a file of one hash holds. */
export function checksumFrom(text: string, name: string | undefined): string | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  if (name !== undefined) {
    for (const l of lines) {
      const m = /^([0-9a-fA-F]{64})\s+\*?(.+)$/.exec(l);
      const file = m?.[2];
      if (m !== null && file !== undefined && (file === name || path.basename(file) === name)) return (m[1] ?? "").toLowerCase();
    }
    return undefined;
  }
  const first = lines[0]?.split(/\s+/)[0];
  return lines.length === 1 && first !== undefined && /^[0-9a-fA-F]{64}$/.test(first) ? first.toLowerCase() : undefined;
}

async function checkPlatform(req: PinRequest, platform: string, p: PlatformRequest, get: FetchBytes): Promise<PlatformProposal> {
  const base = { platform, downloadUrl: p.downloadUrl, archiveFormat: p.archiveFormat, binPath: p.binPath };
  const got = await get(p.downloadUrl);
  if (got.kind === "err") return { ...base, sha256: null, bytes: 0, publisher: "absent", publisherSays: null, program: "not fetched", concerns: [`the artifact could not be fetched: ${got.error}`] };
  const sum = await sha256(got.value);
  const concerns: string[] = [];

  let publisher: PublisherCheck = "absent";
  let publisherSays: string | null = null;
  if (p.checksum === undefined) concerns.push("no checksum from the publisher was named, so this hash is the first one seen and nothing else vouches for it");
  else {
    const file = await get(p.checksum.url);
    const said = file.kind === "ok" ? checksumFrom(new TextDecoder().decode(file.value), p.checksum.name) : undefined;
    if (file.kind === "err") {
      publisher = "unreadable";
      concerns.push(`the publisher's checksum file could not be fetched: ${file.error}`);
    } else if (said === undefined || !HEX64.test(said)) {
      publisher = "unreadable";
      concerns.push(`the publisher's checksum file has no line for ${p.checksum.name ?? "the artifact"}`);
    } else {
      publisherSays = said;
      publisher = said === sum ? "verified" : "mismatch";
      if (publisher === "mismatch") concerns.push(`the publisher says ${said} and the artifact is ${sum}`);
    }
  }

  const os = osOfPlatform(platform);
  const unpacked = await unpackVerified({ tool: req.name, version: req.version, platform, os, program: req.program, downloadUrl: p.downloadUrl, sha256: sum, archiveFormat: p.archiveFormat, binPath: p.binPath }, got.value);
  const program = unpacked.kind === "ok" ? "found" : describeInstallError(unpacked.error);
  if (unpacked.kind === "err") concerns.push(program);
  return { ...base, sha256: sum, bytes: got.value.length, publisher, publisherSays, program, concerns };
}

/** The proposal for a request: every platform fetched, hashed, checked against the publisher and unpacked; the platforms in the order of their names. */
export async function proposePin(req: PinRequest, get: FetchBytes): Promise<PinProposal> {
  const names = Object.keys(req.platforms).sort();
  const platforms: PlatformProposal[] = [];
  for (const n of names) {
    const p = req.platforms[n];
    if (p !== undefined) platforms.push(await checkPlatform(req, n, p, get));
  }
  const ready = platforms.length > 0 && platforms.every((p) => p.publisher === "verified" && p.program === "found" && p.sha256 !== null);
  return { format: "pinned-downloads-pin-proposal/1", name: req.name, version: req.version, program: req.program, ready, platforms };
}

/** The text of a proposal: JSON in a fixed order, with the note that it is a proposal and no pin. */
export function proposalText(p: PinProposal): string {
  const body = {
    _note: "A proposal to review, not a pin: a pin is written in the packaging ontology by its owner after a person has read this.",
    format: p.format,
    name: p.name,
    version: p.version,
    program: p.program,
    ready: p.ready,
    platforms: p.platforms.map((x) => ({
      platform: x.platform,
      downloadUrl: x.downloadUrl,
      archiveFormat: x.archiveFormat,
      binPath: x.binPath,
      sha256: x.sha256,
      bytes: x.bytes,
      publisher: x.publisher,
      publisherSays: x.publisherSays,
      program: x.program,
      concerns: [...x.concerns],
    })),
  };
  return JSON.stringify(body, null, 2) + "\n";
}

/** The real fetch: the bytes at an address, through the retries of the net library, held in a temporary folder that is removed. */
export function fetchBytes(retries: Retries): FetchBytes {
  return (url) =>
    fs.withTempDir(async (dir) => {
      const dest = path.join(dir, "artifact");
      const got = await fetchTo(retries, url, dest);
      return got.kind === "err" ? err(got.error) : ok(await fs.readFile(dest));
    });
}
